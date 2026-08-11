// Processa notificacoes diarias em lotes pequenos para evitar picos de carga.
// Requer VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
// AGENDA_PUSH_CRON_SECRET e SUPABASE_SERVICE_ROLE_KEY.

// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TIME_ZONE = 'America/Sao_Paulo';
const DELIVERY_TIME = '19:00';
const DELIVERY_WINDOW_MINUTES = 30;
const BATCH_SIZE = 100;
const SEND_CONCURRENCY = 10;
const RETRY_DELAY_MINUTES = 2;
const DASHBOARD_URL = '/?tab=dashboard';

interface EngagementTarget {
  delivery_id: string;
  subscription_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  first_name?: string | null;
}

const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { 'Content-Type': 'application/json' } },
);

function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) throw new Error('Supabase nao configurado');

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function assertCronSecret(req: Request): void {
  const expected = Deno.env.get('AGENDA_PUSH_CRON_SECRET') ?? '';
  const received = req.headers.get('x-cron-secret') ?? '';
  if (!expected || received !== expected) throw new Error('Execucao nao autorizada');
}

function configureWebPush(): void {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:suporte@filmstec.shop';
  if (!publicKey || !privateKey) throw new Error('Chaves VAPID nao configuradas');
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function getDeliveryContext(now: Date): { due: boolean; dateKey: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now).reduce<Record<string, number>>((result, part) => {
    if (part.type !== 'literal') result[part.type] = Number(part.value);
    return result;
  }, {});
  const [targetHour, targetMinute] = DELIVERY_TIME.split(':').map(Number);
  const delta = ((parts.hour * 60) + parts.minute) - ((targetHour * 60) + targetMinute);

  return {
    due: delta >= 0 && delta < DELIVERY_WINDOW_MINUTES,
    dateKey: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
  };
}

function createPayload(firstName: string | null | undefined, dateKey: string): string {
  const safeName = firstName?.trim().slice(0, 40);
  const greeting = safeName ? `${safeName}, anote` : 'Anote';
  return JSON.stringify({
    title: 'Fechamento do dia',
    body: `${greeting} seus gastos de hoje e mantenha seu financeiro em dia.`,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: `daily-expenses-${dateKey}`,
    url: DASHBOARD_URL,
    timestamp: Date.now(),
    vibrate: [220, 100, 220],
    requireInteraction: false,
    actions: [{ action: 'open-dashboard', title: 'Registrar gasto' }],
  });
}

async function claimBatch(
  admin: ReturnType<typeof createAdminClient>,
  dateKey: string,
): Promise<EngagementTarget[]> {
  const { data, error } = await admin.rpc('claim_daily_engagement_batch', {
    p_engagement_date: dateKey,
    p_batch_size: BATCH_SIZE,
  });
  if (error) throw error;
  return data || [];
}

async function updateDelivery(
  admin: ReturnType<typeof createAdminClient>,
  target: EngagementTarget,
  status: 'sent' | 'failed',
  error?: unknown,
): Promise<void> {
  const nextAttemptAt = new Date(Date.now() + (RETRY_DELAY_MINUTES * 60_000)).toISOString();
  const { error: updateError } = await admin
    .from('agenda_push_daily_engagement')
    .update(status === 'sent' ? {
      status,
      sent_at: new Date().toISOString(),
      error_message: null,
      next_attempt_at: null,
    } : {
      status,
      failed_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message.slice(0, 500) : 'Falha ao enviar push',
      next_attempt_at: nextAttemptAt,
    })
    .eq('id', target.delivery_id);
  if (updateError) throw updateError;
}

async function processTarget(
  admin: ReturnType<typeof createAdminClient>,
  target: EngagementTarget,
  dateKey: string,
): Promise<'sent' | 'failed'> {
  try {
    await webpush.sendNotification({
      endpoint: target.endpoint,
      keys: { p256dh: target.p256dh, auth: target.auth },
    }, createPayload(target.first_name, dateKey), {
      TTL: 12 * 60 * 60,
      urgency: 'normal',
    });
    await updateDelivery(admin, target, 'sent');
    return 'sent';
  } catch (error) {
    await updateDelivery(admin, target, 'failed', error);
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await admin
        .from('agenda_push_subscriptions')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('id', target.subscription_id);
    }
    console.error('[daily-engagement-batch] falha ao enviar:', error);
    return 'failed';
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  });

  await Promise.all(runners);
  return results;
}

serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ success: false, error: 'Metodo nao permitido' }, 405);

  try {
    assertCronSecret(req);
    const context = getDeliveryContext(new Date());
    if (!context.due) return jsonResponse({ success: true, due: false, claimed: 0, sent: 0 });

    configureWebPush();
    const admin = createAdminClient();
    const targets = await claimBatch(admin, context.dateKey);
    const results = await mapWithConcurrency(
      targets,
      SEND_CONCURRENCY,
      (target) => processTarget(admin, target, context.dateKey),
    );
    const sent = results.filter((result) => result === 'sent').length;

    return jsonResponse({
      success: true,
      due: true,
      claimed: targets.length,
      sent,
      failed: results.length - sent,
      hasMore: targets.length === BATCH_SIZE,
    });
  } catch (error) {
    console.error('[daily-engagement-batch] erro:', error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Erro inesperado',
    }, 400);
  }
});
