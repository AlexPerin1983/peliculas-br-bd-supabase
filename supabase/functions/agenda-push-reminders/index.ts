// Supabase Edge Function: envia lembretes push para agendamentos proximos.
// Requer secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
// AGENDA_PUSH_CRON_SECRET e SUPABASE_SERVICE_ROLE_KEY.

// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const DEFAULT_REMINDER_MINUTES = 30;
const CRON_DRIFT_MINUTES = 5;
const LATE_REMINDER_GRACE_MINUTES = 10;
const AGENDA_URL = '/?tab=agenda';
const TIME_ZONE = 'America/Sao_Paulo';
const RECEIPT_URL = 'https://avlefzsipbqvollukgyt.supabase.co/functions/v1/agenda-push-receipts';

interface AgendamentoReminder {
  id: number;
  user_id: string;
  client_id?: number | null;
  client_name: string;
  start: string;
  end?: string | null;
  notes?: string | null;
  address?: string | null;
  maps_url?: string | null;
}

interface ProfileScope {
  id: string;
  organization_id: string | null;
}

interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  organization_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  reminder_minutes: number | null;
  daily_summary_enabled?: boolean | null;
  daily_summary_time?: string | null;
}

interface PushReceiptTarget {
  kind: 'reminder' | 'daily-summary';
  id: string;
  token: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

function createSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey =
    Deno.env.get('SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL ou SERVICE_ROLE_KEY nao configurada');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createSupabaseUserClient(authHeader: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  if (!supabaseUrl || !anonKey) {
    throw new Error('SUPABASE_URL ou SUPABASE_ANON_KEY nao configurada');
  }

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getAuthenticatedUserId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;

  try {
    const userClient = createSupabaseUserClient(authHeader);
    const {
      data: { user },
      error,
    } = await userClient.auth.getUser();

    if (error || !user) return null;

    return user.id;
  } catch (_error) {
    return null;
  }
}

function assertCronSecret(req: Request): void {
  const expectedSecret = Deno.env.get('AGENDA_PUSH_CRON_SECRET') ?? '';
  const receivedSecret = req.headers.get('x-cron-secret') ?? '';

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    throw new Error('Execucao nao autorizada');
  }
}

function configureWebPush(): void {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:suporte@filmstec.shop';

  if (!publicKey || !privateKey) {
    throw new Error('Chaves VAPID nao configuradas');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function getStartValue(row: Record<string, unknown>): string {
  return String(row.start ?? row.start_time ?? '');
}

function getEndValue(row: Record<string, unknown>): string | null {
  const value = row.end ?? row.end_time;
  return typeof value === 'string' ? value : null;
}

function getClientId(row: Record<string, unknown>): number | null {
  const value = row.client_id ?? row.cliente_id;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAgendamento(row: Record<string, unknown>): AgendamentoReminder {
  return {
    id: Number(row.id),
    user_id: String(row.user_id),
    client_id: getClientId(row),
    client_name: String(row.client_name || 'Cliente'),
    start: getStartValue(row),
    end: getEndValue(row),
    notes: typeof row.notes === 'string' ? row.notes : null,
  };
}

function formatClientAddress(row: Record<string, unknown>): string {
  const get = (key: string) => {
    const value = row[key];
    return typeof value === 'string' ? value.trim() : '';
  };

  const structured = [
    get('logradouro'),
    get('numero'),
    get('complemento'),
    get('bairro'),
    get('cidade'),
    get('uf'),
    get('cep'),
  ].filter(Boolean).join(', ');

  return structured || get('endereco');
}

function buildMapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
}

async function attachClientAddresses(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  agendamentos: AgendamentoReminder[],
): Promise<void> {
  const clientIds = [...new Set(
    agendamentos
      .map((agendamento) => agendamento.client_id)
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
  )];

  if (clientIds.length === 0) return;

  const { data, error } = await adminClient
    .from('clients')
    .select('id,logradouro,numero,complemento,bairro,cidade,uf,cep')
    .in('id', clientIds);

  if (error || !data) return;

  const addressById = new Map<number, string>();
  (data as Record<string, unknown>[]).forEach((row) => {
    const id = Number(row.id);
    if (Number.isFinite(id)) {
      addressById.set(id, formatClientAddress(row));
    }
  });

  agendamentos.forEach((agendamento) => {
    if (typeof agendamento.client_id !== 'number') return;
    const address = addressById.get(agendamento.client_id);
    if (address) {
      agendamento.address = address;
      agendamento.maps_url = buildMapsUrl(address);
    }
  });
}

function isModernColumnError(error: unknown): boolean {
  const message = [
    (error as { message?: string })?.message,
    (error as { details?: string })?.details,
    (error as { hint?: string })?.hint,
    (error as { code?: string })?.code,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return message.includes('start') && (
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('could not find')
  );
}

async function fetchAgendamentosInRange(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  from: Date,
  horizon: Date,
): Promise<AgendamentoReminder[]> {
  const fromIso = from.toISOString();
  const horizonIso = horizon.toISOString();
  const byId = new Map<number, AgendamentoReminder>();

  const modernQuery = await adminClient
    .from('agendamentos')
    .select('id,user_id,client_id,client_name,start,end,notes')
    .gte('start', fromIso)
    .lte('start', horizonIso)
    .order('start', { ascending: true })
    .limit(200);

  if (!modernQuery.error) {
    (modernQuery.data || []).forEach((row: Record<string, unknown>) => {
      const agendamento = normalizeAgendamento(row);
      if (Number.isFinite(agendamento.id) && agendamento.start) {
        byId.set(agendamento.id, agendamento);
      }
    });
  } else if (!isModernColumnError(modernQuery.error)) {
    throw modernQuery.error;
  }

  const legacyQuery = await adminClient
    .from('agendamentos')
    .select('id,user_id,client_id,client_name,start_time,end_time,notes')
    .gte('start_time', fromIso)
    .lte('start_time', horizonIso)
    .order('start_time', { ascending: true })
    .limit(200);

  if (!legacyQuery.error) {
    (legacyQuery.data || []).forEach((row: Record<string, unknown>) => {
      const agendamento = normalizeAgendamento(row);
      if (Number.isFinite(agendamento.id) && agendamento.start && !byId.has(agendamento.id)) {
        byId.set(agendamento.id, agendamento);
      }
    });
  } else if (byId.size === 0 && !isModernColumnError(legacyQuery.error)) {
    throw legacyQuery.error;
  }

  return [...byId.values()].sort((left, right) => (
    new Date(left.start).getTime() - new Date(right.start).getTime()
  ));
}

async function fetchUpcomingAgendamentos(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  now: Date,
  horizon: Date,
): Promise<AgendamentoReminder[]> {
  const lowerBound = new Date(now.getTime() - (LATE_REMINDER_GRACE_MINUTES * 60_000));

  return fetchAgendamentosInRange(adminClient, lowerBound, horizon);
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function fetchProfiles(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  userIds: string[],
): Promise<Map<string, ProfileScope>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await adminClient
    .from('profiles')
    .select('id,organization_id')
    .in('id', userIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((profile: ProfileScope) => [profile.id, profile]));
}

async function fetchSubscriptions(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  userIds: string[],
  organizationIds: string[],
): Promise<PushSubscriptionRecord[]> {
  const byId = new Map<string, PushSubscriptionRecord>();

  if (userIds.length > 0) {
    const { data, error } = await adminClient
      .from('agenda_push_subscriptions')
      .select('id,user_id,organization_id,endpoint,p256dh,auth,reminder_minutes,daily_summary_enabled,daily_summary_time')
      .eq('enabled', true)
      .in('user_id', userIds);

    if (error) throw error;
    (data || []).forEach((subscription: PushSubscriptionRecord) => byId.set(subscription.id, subscription));
  }

  if (organizationIds.length > 0) {
    const { data, error } = await adminClient
      .from('agenda_push_subscriptions')
      .select('id,user_id,organization_id,endpoint,p256dh,auth,reminder_minutes,daily_summary_enabled,daily_summary_time')
      .eq('enabled', true)
      .in('organization_id', organizationIds);

    if (error) throw error;
    (data || []).forEach((subscription: PushSubscriptionRecord) => byId.set(subscription.id, subscription));
  }

  return [...byId.values()];
}

async function fetchMaxReminderMinutes(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
): Promise<number> {
  const { data, error } = await adminClient
    .from('agenda_push_subscriptions')
    .select('reminder_minutes')
    .eq('enabled', true)
    .order('reminder_minutes', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return DEFAULT_REMINDER_MINUTES;

  const value = Number(data.reminder_minutes);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_REMINDER_MINUTES;
}

async function fetchDailySummarySubscriptions(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
): Promise<PushSubscriptionRecord[]> {
  const { data, error } = await adminClient
    .from('agenda_push_subscriptions')
    .select('id,user_id,organization_id,endpoint,p256dh,auth,reminder_minutes,daily_summary_enabled,daily_summary_time')
    .eq('enabled', true)
    .eq('daily_summary_enabled', true);

  if (error) throw error;

  return data || [];
}

function shouldNotify(nowMs: number, agendamento: AgendamentoReminder, subscription: PushSubscriptionRecord): boolean {
  const startMs = new Date(agendamento.start).getTime();
  const reminderMinutes = subscription.reminder_minutes || DEFAULT_REMINDER_MINUTES;
  const reminderAtMs = startMs - (reminderMinutes * 60_000);
  const latestSendMs = startMs + (LATE_REMINDER_GRACE_MINUTES * 60_000);

  return Number.isFinite(startMs)
    && nowMs <= latestSendMs
    && reminderAtMs <= nowMs;
}

function formatReminderLead(reminderMinutes: number): string {
  if (reminderMinutes % 1440 === 0) {
    const days = reminderMinutes / 1440;
    return days === 1 ? 'em 1 dia' : `em ${days} dias`;
  }
  if (reminderMinutes % 60 === 0) {
    const hours = reminderMinutes / 60;
    return hours === 1 ? 'em 1 hora' : `em ${hours} horas`;
  }
  return `em ${reminderMinutes} min`;
}

function createPayload(
  agendamento: AgendamentoReminder,
  reminderMinutes: number,
  receipt?: PushReceiptTarget,
): string {
  const startDate = new Date(agendamento.start);
  const startTime = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(startDate);

  const lead = formatReminderLead(reminderMinutes);
  const bodyLines = [`Atendimento as ${startTime} (${lead}).`];
  if (agendamento.address) {
    bodyLines.push(`Local: ${agendamento.address}`);
  }

  const actions: Array<{ action: string; title: string }> = [
    { action: 'open-agenda', title: 'Abrir agenda' },
  ];
  if (agendamento.maps_url) {
    actions.push({ action: 'navigate', title: 'Como chegar' });
  }

  return JSON.stringify({
    title: `Agenda: ${agendamento.client_name}`,
    body: bodyLines.join('\n'),
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: `agenda-${agendamento.id}-${reminderMinutes}`,
    url: AGENDA_URL,
    mapsUrl: agendamento.maps_url || null,
    address: agendamento.address || null,
    actions,
    agendamentoId: agendamento.id,
    timestamp: Date.now(),
    vibrate: [180, 80, 180],
    receipt: receipt ? { ...receipt, url: RECEIPT_URL } : null,
    requireInteraction: Boolean(agendamento.maps_url),
  });
}

function getTimeZoneParts(date: Date): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return parts.reduce<Record<string, number>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = Number(part.value);
    }

    return acc;
  }, {});
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day + days));

  return formatDateKey(utcDate.getUTCFullYear(), utcDate.getUTCMonth() + 1, utcDate.getUTCDate());
}

function getLocalDateKey(date: Date): string {
  const parts = getTimeZoneParts(date);

  return formatDateKey(parts.year, parts.month, parts.day);
}

function getTomorrowDateKey(date: Date): string {
  return addDaysToDateKey(getLocalDateKey(date), 1);
}

function getTimeZoneOffsetMs(date: Date): number {
  const parts = getTimeZoneParts(date);
  const utcLike = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);

  return utcLike - date.getTime();
}

function zonedDateTimeToUtc(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = getTimeZoneOffsetMs(utcGuess);

  return new Date(utcGuess.getTime() - offset);
}

function getLocalDayUtcRange(dateKey: string): { start: Date; end: Date } {
  const start = zonedDateTimeToUtc(dateKey, '00:00');
  const nextDateKey = addDaysToDateKey(dateKey, 1);
  const nextStart = zonedDateTimeToUtc(nextDateKey, '00:00');

  return {
    start,
    end: new Date(nextStart.getTime() - 1),
  };
}

function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const match = /^(\d{2}):(\d{2})/.exec(time);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return (hours * 60) + minutes;
}

function getLocalMinutesSinceMidnight(date: Date): number {
  const parts = getTimeZoneParts(date);

  return (parts.hour * 60) + parts.minute;
}

function isDailySummaryDue(now: Date, subscription: PushSubscriptionRecord): boolean {
  if (!subscription.daily_summary_enabled) return false;

  const targetMinutes = parseTimeToMinutes(subscription.daily_summary_time);
  if (targetMinutes === null) return false;

  const currentMinutes = getLocalMinutesSinceMidnight(now);
  const delta = currentMinutes - targetMinutes;

  return delta >= 0 && delta <= CRON_DRIFT_MINUTES;
}

function formatSummaryItem(agendamento: AgendamentoReminder): string {
  const startTime = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(new Date(agendamento.start));
  const clientName = agendamento.client_name.length > 28
    ? `${agendamento.client_name.slice(0, 25)}...`
    : agendamento.client_name;

  return `${startTime} ${clientName}`;
}

function createDailySummaryPayload(
  summaryDate: string,
  agendamentos: AgendamentoReminder[],
  tagSuffix = 'daily',
  receipt?: PushReceiptTarget,
): string {
  const count = agendamentos.length;
  const visibleItems = agendamentos.slice(0, 4).map(formatSummaryItem);
  const overflow = count > visibleItems.length ? ` +${count - visibleItems.length}` : '';
  const body = count > 0
    ? `${visibleItems.join(' | ')}${overflow}`
    : 'Nenhum atendimento agendado para amanha.';

  return JSON.stringify({
    title: count > 0
      ? `Agenda de amanha: ${count} atendimento${count === 1 ? '' : 's'}`
      : 'Agenda de amanha livre',
    body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: `agenda-summary-${summaryDate}-${tagSuffix.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
    url: AGENDA_URL,
    summaryDate,
    timestamp: Date.now(),
    vibrate: [220, 100, 220],
    receipt: receipt ? { ...receipt, url: RECEIPT_URL } : null,
    requireInteraction: true,
  });
}

function createTestPayload(): string {
  const sentAt = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(new Date());

  return JSON.stringify({
    title: 'Teste dos alertas da agenda',
    body: `Se esta mensagem chegou, os alertas estao funcionando. Enviado as ${sentAt}.`,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: `agenda-test-${Date.now()}`,
    url: AGENDA_URL,
    timestamp: Date.now(),
    vibrate: [180, 80, 180],
    requireInteraction: false,
  });
}

function createReminderTestPayload(agendamento: AgendamentoReminder): string {
  const startTime = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(new Date(agendamento.start));

  const bodyLines = [`Proximo: ${agendamento.client_name} as ${startTime}.`];
  if (agendamento.address) {
    bodyLines.push(`Local: ${agendamento.address}`);
    bodyLines.push('Toque em "Como chegar" para testar a navegacao.');
  }

  const actions: Array<{ action: string; title: string }> = [
    { action: 'open-agenda', title: 'Abrir agenda' },
  ];
  if (agendamento.maps_url) {
    actions.push({ action: 'navigate', title: 'Como chegar' });
  }

  return JSON.stringify({
    title: 'Teste dos alertas da agenda',
    body: bodyLines.join('\n'),
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: `agenda-test-${Date.now()}`,
    url: AGENDA_URL,
    mapsUrl: agendamento.maps_url || null,
    address: agendamento.address || null,
    actions,
    timestamp: Date.now(),
    vibrate: [180, 80, 180],
    requireInteraction: Boolean(agendamento.maps_url),
  });
}

async function findNextTestAgendamento(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  organizationId: string | null,
): Promise<AgendamentoReminder | null> {
  const now = new Date();
  const horizon = new Date(now.getTime() + (30 * 24 * 60 * 60_000));
  const agendamentos = await fetchAgendamentosInRange(adminClient, now, horizon);
  const profileIds = uniqueValues([userId, ...agendamentos.map((a) => a.user_id)]);
  const profiles = await fetchProfiles(adminClient, profileIds);
  const scoped = agendamentos.filter((a) => (
    a.user_id === userId ||
    (organizationId && profiles.get(a.user_id)?.organization_id === organizationId)
  ));

  if (scoped.length === 0) return null;

  await attachClientAddresses(adminClient, scoped);

  // Prefere o proximo agendamento que tenha endereco (para testar a navegacao).
  return scoped.find((a) => Boolean(a.address)) ?? scoped[0];
}

async function registerPendingDelivery(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  agendamentoId: number,
  subscriptionId: string,
  reminderMinutes: number,
): Promise<{ id: string; token: string } | null> {
  const { data, error } = await adminClient
    .from('agenda_push_deliveries')
    .insert({
      agendamento_id: agendamentoId,
      subscription_id: subscriptionId,
      reminder_minutes: reminderMinutes,
      status: 'pending',
    })
    .select('id,receipt_token')
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return null;
    }

    throw error;
  }

  return {
    id: data.id as string,
    token: data.receipt_token as string,
  };
}

async function markDeliverySent(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  deliveryId: string,
): Promise<void> {
  await adminClient
    .from('agenda_push_deliveries')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', deliveryId);
}

async function markDeliveryFailed(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  deliveryId: string,
  error: unknown,
): Promise<void> {
  await adminClient
    .from('agenda_push_deliveries')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : 'Falha ao enviar push',
    })
    .eq('id', deliveryId);
}

async function registerPendingDailySummary(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  subscriptionId: string,
  summaryDate: string,
  scheduledTime: string,
  appointmentCount: number,
): Promise<{ id: string; token: string } | null> {
  const { data, error } = await adminClient
    .from('agenda_push_daily_summaries')
    .insert({
      subscription_id: subscriptionId,
      summary_date: summaryDate,
      scheduled_time: scheduledTime,
      appointment_count: appointmentCount,
      status: 'pending',
    })
    .select('id,receipt_token')
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return null;
    }

    throw error;
  }

  return {
    id: data.id as string,
    token: data.receipt_token as string,
  };
}

async function markDailySummarySent(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  summaryId: string,
): Promise<void> {
  await adminClient
    .from('agenda_push_daily_summaries')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', summaryId);
}

async function markDailySummaryFailed(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  summaryId: string,
  error: unknown,
): Promise<void> {
  await adminClient
    .from('agenda_push_daily_summaries')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : 'Falha ao enviar resumo diario',
    })
    .eq('id', summaryId);
}

async function disableExpiredSubscription(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  subscription: PushSubscriptionRecord,
  error: unknown,
): Promise<void> {
  const statusCode = (error as { statusCode?: number })?.statusCode;
  if (statusCode !== 404 && statusCode !== 410) return;

  await adminClient
    .from('agenda_push_subscriptions')
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq('id', subscription.id);
}

async function sendPushToSubscription(
  subscription: PushSubscriptionRecord,
  payload: string,
): Promise<void> {
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    payload,
    {
      TTL: 24 * 60 * 60,
      urgency: 'high',
    },
  );
}

async function handleTestRequest(req: Request): Promise<Response> {
  configureWebPush();

  const adminClient = createSupabaseAdminClient();
  const userId = await getAuthenticatedUserId(req.headers.get('Authorization'));

  if (!userId) {
    return jsonResponse({ success: false, error: 'Usuario nao autenticado' }, 401);
  }

  const profiles = await fetchProfiles(adminClient, [userId]);
  const organizationId = profiles.get(userId)?.organization_id ?? null;
  const subscriptions = await fetchSubscriptions(
    adminClient,
    [userId],
    organizationId ? [organizationId] : [],
  );

  // Usa o proximo agendamento real (com endereco, se houver) para que o teste
  // mostre exatamente como sera o alerta, incluindo o botao "Como chegar".
  const nextAgendamento = await findNextTestAgendamento(adminClient, userId, organizationId);
  const payload = nextAgendamento
    ? createReminderTestPayload(nextAgendamento)
    : createTestPayload();

  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await sendPushToSubscription(subscription, payload);
      sent += 1;
    } catch (error) {
      await disableExpiredSubscription(adminClient, subscription, error);
      failed += 1;
      console.error('[agenda-push-reminders] falha ao enviar teste:', error);
    }
  }

  return jsonResponse({
    success: sent > 0,
    sent,
    failed,
    subscriptions: subscriptions.length,
    hasAddress: Boolean(nextAgendamento?.address),
    error: sent > 0 ? null : 'Nenhum dispositivo ativo recebeu o teste',
  }, sent > 0 ? 200 : 400);
}

async function handleDailySummaryTestRequest(req: Request): Promise<Response> {
  configureWebPush();

  const adminClient = createSupabaseAdminClient();
  const userId = await getAuthenticatedUserId(req.headers.get('Authorization'));

  if (!userId) {
    return jsonResponse({ success: false, error: 'Usuario nao autenticado' }, 401);
  }

  const profiles = await fetchProfiles(adminClient, [userId]);
  const organizationId = profiles.get(userId)?.organization_id ?? null;
  const subscriptions = await fetchSubscriptions(
    adminClient,
    [userId],
    organizationId ? [organizationId] : [],
  );
  const summaryDate = getTomorrowDateKey(new Date());
  const dayRange = getLocalDayUtcRange(summaryDate);
  const agendamentos = await fetchAgendamentosInRange(adminClient, dayRange.start, dayRange.end);
  const profileIds = uniqueValues([
    userId,
    ...agendamentos.map((agendamento) => agendamento.user_id),
  ]);
  const allProfiles = await fetchProfiles(adminClient, profileIds);
  const scopedAgendamentos = agendamentos.filter((agendamento) => (
    agendamento.user_id === userId ||
    (organizationId && allProfiles.get(agendamento.user_id)?.organization_id === organizationId)
  ));

  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await sendPushToSubscription(subscription, createDailySummaryPayload(
        summaryDate,
        scopedAgendamentos,
        `test-${Date.now()}`,
      ));
      sent += 1;
    } catch (error) {
      await disableExpiredSubscription(adminClient, subscription, error);
      failed += 1;
      console.error('[agenda-push-reminders] falha ao enviar resumo de teste:', error);
    }
  }

  return jsonResponse({
    success: sent > 0,
    sent,
    failed,
    subscriptions: subscriptions.length,
    appointmentCount: scopedAgendamentos.length,
    error: sent > 0 ? null : 'Nenhum dispositivo ativo recebeu o resumo de teste',
  }, sent > 0 ? 200 : 400);
}

async function processDailySummaries(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  now: Date,
): Promise<{ checked: number; sent: number; skipped: number; failed: number }> {
  const subscriptions = await fetchDailySummarySubscriptions(adminClient);
  const dueSubscriptions = subscriptions.filter((subscription) => isDailySummaryDue(now, subscription));

  if (dueSubscriptions.length === 0) {
    return { checked: 0, sent: 0, skipped: 0, failed: 0 };
  }

  const summaryDate = getTomorrowDateKey(now);
  const dayRange = getLocalDayUtcRange(summaryDate);
  const agendamentos = await fetchAgendamentosInRange(adminClient, dayRange.start, dayRange.end);
  const profileIds = uniqueValues([
    ...dueSubscriptions.map((subscription) => subscription.user_id),
    ...agendamentos.map((agendamento) => agendamento.user_id),
  ]);
  const profiles = await fetchProfiles(adminClient, profileIds);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const subscription of dueSubscriptions) {
    const subscriptionOrgId = subscription.organization_id ?? profiles.get(subscription.user_id)?.organization_id ?? null;
    const scopedAgendamentos = agendamentos.filter((agendamento) => (
      agendamento.user_id === subscription.user_id ||
      (subscriptionOrgId && profiles.get(agendamento.user_id)?.organization_id === subscriptionOrgId)
    ));
    const summaryReceipt = await registerPendingDailySummary(
      adminClient,
      subscription.id,
      summaryDate,
      subscription.daily_summary_time || '18:00',
      scopedAgendamentos.length,
    );

    if (!summaryReceipt) {
      skipped += 1;
      continue;
    }

    try {
      await sendPushToSubscription(subscription, createDailySummaryPayload(
        summaryDate,
        scopedAgendamentos,
        subscription.daily_summary_time || 'daily',
        {
          kind: 'daily-summary',
          id: summaryReceipt.id,
          token: summaryReceipt.token,
        },
      ));
      await markDailySummarySent(adminClient, summaryReceipt.id);
      sent += 1;
    } catch (error) {
      await markDailySummaryFailed(adminClient, summaryReceipt.id, error);
      await disableExpiredSubscription(adminClient, subscription, error);
      failed += 1;
      console.error('[agenda-push-reminders] falha ao enviar resumo diario:', error);
    }
  }

  return {
    checked: dueSubscriptions.length,
    sent,
    skipped,
    failed,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Metodo nao permitido' }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));

    if (body?.type === 'test') {
      return await handleTestRequest(req);
    }

    if (body?.type === 'daily-summary-test') {
      return await handleDailySummaryTestRequest(req);
    }

    assertCronSecret(req);
    configureWebPush();

    const adminClient = createSupabaseAdminClient();
    const now = new Date();
    const maxReminderMinutes = await fetchMaxReminderMinutes(adminClient);
    const horizon = new Date(now.getTime() + ((maxReminderMinutes + CRON_DRIFT_MINUTES) * 60_000));
    const agendamentos = await fetchUpcomingAgendamentos(adminClient, now, horizon);
    await attachClientAddresses(adminClient, agendamentos);

    const userIds = uniqueValues(agendamentos.map((agendamento) => agendamento.user_id));
    const profiles = await fetchProfiles(adminClient, userIds);
    const organizationIds = uniqueValues(userIds.map((userId) => profiles.get(userId)?.organization_id ?? null));
    const subscriptions = await fetchSubscriptions(adminClient, userIds, organizationIds);
    const nowMs = now.getTime();

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const agendamento of agendamentos) {
      const organizationId = profiles.get(agendamento.user_id)?.organization_id ?? null;
      const scopedSubscriptions = subscriptions.filter((subscription) => (
        subscription.user_id === agendamento.user_id ||
        (organizationId && subscription.organization_id === organizationId)
      ));

      for (const subscription of scopedSubscriptions) {
        if (!shouldNotify(nowMs, agendamento, subscription)) {
          skipped += 1;
          continue;
        }

        const reminderMinutes = subscription.reminder_minutes || DEFAULT_REMINDER_MINUTES;
        const deliveryReceipt = await registerPendingDelivery(
          adminClient,
          agendamento.id,
          subscription.id,
          reminderMinutes,
        );

        if (!deliveryReceipt) {
          skipped += 1;
          continue;
        }

        try {
          await sendPushToSubscription(subscription, createPayload(
            agendamento,
            reminderMinutes,
            {
              kind: 'reminder',
              id: deliveryReceipt.id,
              token: deliveryReceipt.token,
            },
          ));
          await markDeliverySent(adminClient, deliveryReceipt.id);
          sent += 1;
        } catch (error) {
          await markDeliveryFailed(adminClient, deliveryReceipt.id, error);
          await disableExpiredSubscription(adminClient, subscription, error);
          failed += 1;
          console.error('[agenda-push-reminders] falha ao enviar push:', error);
        }
      }
    }

    const dailySummary = await processDailySummaries(adminClient, now);

    return jsonResponse({
      success: true,
      checked: agendamentos.length,
      sent,
      skipped,
      failed,
      dailySummaryChecked: dailySummary.checked,
      dailySummarySent: dailySummary.sent,
      dailySummarySkipped: dailySummary.skipped,
      dailySummaryFailed: dailySummary.failed,
    });
  } catch (error) {
    console.error('[agenda-push-reminders] erro:', error);

    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Erro inesperado',
    }, 400);
  }
});
