// Supabase Edge Function: Meta Conversions API (CAPI)
// Envia eventos server-side para a Meta, complementando o Pixel do browser.
// O evento e deduplicado com o browser pelo mesmo `event_id`.
//
// Deploy:  supabase functions deploy meta-capi-event --no-verify-jwt
//          (ou colar este arquivo no editor de Edge Functions do dashboard)
// Secret:  supabase secrets set META_CAPI_TOKEN=<token>   (nunca vai para o git)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const PIXEL_ID = '847876754650924';
const GRAPH_URL = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Meta exige PII normalizada (trim + lowercase) e com hash SHA-256 (hex).
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getClientIp(req: Request): string | undefined {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? undefined;
}

interface CapiRequest {
  email?: string;
  externalId?: string;
  eventId?: string;
  eventName?: string;
  eventSourceUrl?: string;
  testEventCode?: string;
  fbp?: string;
  fbc?: string;
  customData?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);

  const token = Deno.env.get('META_CAPI_TOKEN');
  if (!token) return jsonResponse({ ok: false, skipped: 'META_CAPI_TOKEN ausente' });

  let body: CapiRequest = {};
  try {
    body = (await req.json()) as CapiRequest;
  } catch {
    return jsonResponse({ ok: false, error: 'JSON invalido' }, 400);
  }

  const {
    email,
    externalId,
    eventId,
    eventName = 'CompleteRegistration',
    eventSourceUrl,
    testEventCode,
    fbp,
    fbc,
    customData,
  } = body;

  try {
    // user_data: quanto mais sinais de match, maior o EMQ (Event Match Quality).
    const userData: Record<string, unknown> = {};
    if (email) userData.em = [await sha256Hex(email.trim().toLowerCase())];
    if (externalId) userData.external_id = [await sha256Hex(String(externalId).trim().toLowerCase())];
    const ip = getClientIp(req);
    if (ip) userData.client_ip_address = ip;
    const ua = req.headers.get('user-agent');
    if (ua) userData.client_user_agent = ua;
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;

    const event: Record<string, unknown> = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: eventSourceUrl,
      action_source: 'website',
      user_data: userData,
    };
    if (customData) event.custom_data = customData;

    const payload: Record<string, unknown> = { data: [event] };
    if (testEventCode) payload.test_event_code = testEventCode;

    const res = await fetch(`${GRAPH_URL}?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('[meta-capi-event] Meta respondeu erro:', JSON.stringify(result));
      // 200 de proposito: o cadastro do usuario nunca deve falhar por causa do CAPI.
      return jsonResponse({ ok: false, error: result });
    }

    return jsonResponse({ ok: true, result });
  } catch (err) {
    console.error('[meta-capi-event] erro inesperado:', err);
    return jsonResponse({ ok: false, error: String(err) });
  }
});
