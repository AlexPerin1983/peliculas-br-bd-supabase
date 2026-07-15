import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

type ReceiptKind = 'reminder' | 'daily-summary' | 'proposal-condition';
type ReceiptStage = 'received' | 'shown' | 'show_failed' | 'clicked';

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

function isReceiptKind(value: unknown): value is ReceiptKind {
  return value === 'reminder' || value === 'daily-summary' || value === 'proposal-condition';
}

function isReceiptStage(value: unknown): value is ReceiptStage {
  return value === 'received' || value === 'shown' || value === 'show_failed' || value === 'clicked';
}

function getUpdateForStage(stage: ReceiptStage, errorMessage: string | null): Record<string, unknown> {
  const now = new Date().toISOString();

  if (stage === 'received') {
    return { push_received_at: now };
  }

  if (stage === 'shown') {
    return {
      notification_shown_at: now,
      receipt_error_message: null,
    };
  }

  if (stage === 'clicked') {
    return { notification_clicked_at: now };
  }

  return {
    receipt_error_message: errorMessage || 'Falha ao exibir notificacao no dispositivo',
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
    const kind = body.kind;
    const stage = body.stage;
    const id = typeof body.id === 'string' ? body.id : '';
    const token = typeof body.token === 'string' ? body.token : '';
    const errorMessage = typeof body.error === 'string' ? body.error.slice(0, 500) : null;

    if (!isReceiptKind(kind) || !isReceiptStage(stage) || !id || !token) {
      return jsonResponse({ success: false, error: 'Recibo invalido' }, 400);
    }

    const table = kind === 'daily-summary'
      ? 'agenda_push_daily_summaries'
      : kind === 'proposal-condition'
        ? 'proposal_condition_push_deliveries'
        : 'agenda_push_deliveries';
    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient
      .from(table)
      .update(getUpdateForStage(stage, errorMessage))
      .eq('id', id)
      .eq('receipt_token', token)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return jsonResponse({ success: false, error: 'Recibo nao encontrado' }, 404);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('[agenda-push-receipts] erro:', error);

    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Erro inesperado',
    }, 400);
  }
});
