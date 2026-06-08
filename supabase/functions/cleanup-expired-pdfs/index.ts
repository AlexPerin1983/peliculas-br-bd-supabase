// Supabase Edge Function: remove do Storage os arquivos de orçamentos vencidos
// há mais de GRACE_DAYS dias, mantendo a linha em saved_pdfs (metadados/histórico).
// O app regenera o PDF sob demanda a partir dos dados salvos quando necessário.
//
// Requer secrets: CLEANUP_PDFS_CRON_SECRET e SUPABASE_SERVICE_ROLE_KEY.
// Opcional: CLEANUP_PDFS_GRACE_DAYS (padrão 30).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const PDF_BUCKET = 'pdfs';
const DEFAULT_GRACE_DAYS = 30;
const BATCH_SIZE = 200;

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
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function assertCronSecret(req: Request): void {
  const expectedSecret = Deno.env.get('CLEANUP_PDFS_CRON_SECRET') ?? '';
  const receivedSecret = req.headers.get('x-cron-secret') ?? '';

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    throw new Error('Execucao nao autorizada');
  }
}

interface ExpiredPdfRow {
  id: number;
  pdf_path: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Metodo nao permitido' }, 405);
  }

  try {
    assertCronSecret(req);

    const graceDays = Number(Deno.env.get('CLEANUP_PDFS_GRACE_DAYS') ?? DEFAULT_GRACE_DAYS);
    const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000).toISOString();

    const admin = createSupabaseAdminClient();

    let processedRows = 0;
    let removedFiles = 0;
    let failedFiles = 0;

    // Processa em lotes até não restarem orçamentos vencidos com arquivo.
    // Como cada lote marca os registros (pdf_path = null), o filtro
    // "pdf_path not null" garante avanço e evita reprocessar.
    // deno-lint-ignore no-constant-condition
    while (true) {
      const { data, error } = await admin
        .from('saved_pdfs')
        .select('id, pdf_path')
        .lt('expiration_date', cutoff)
        .not('pdf_path', 'is', null)
        .limit(BATCH_SIZE);

      if (error) {
        throw new Error(`Erro ao buscar orcamentos vencidos: ${error.message}`);
      }

      const rows = (data ?? []) as ExpiredPdfRow[];
      if (rows.length === 0) break;

      const paths = rows
        .map((row) => row.pdf_path)
        .filter((path): path is string => Boolean(path));

      if (paths.length > 0) {
        const { error: removeError } = await admin.storage.from(PDF_BUCKET).remove(paths);
        if (removeError) {
          // Não aborta: marca os registros mesmo assim para não travar o lote,
          // mas contabiliza a falha para observabilidade.
          failedFiles += paths.length;
          console.error('Erro ao remover arquivos do Storage:', removeError.message);
        } else {
          removedFiles += paths.length;
        }
      }

      const ids = rows.map((row) => row.id);
      const { error: updateError } = await admin
        .from('saved_pdfs')
        .update({ pdf_path: null, archived_at: new Date().toISOString() })
        .in('id', ids);

      if (updateError) {
        throw new Error(`Erro ao marcar orcamentos como arquivados: ${updateError.message}`);
      }

      processedRows += rows.length;

      // Lote menor que o limite => acabou.
      if (rows.length < BATCH_SIZE) break;
    }

    return jsonResponse({
      success: true,
      grace_days: graceDays,
      cutoff,
      processed_rows: processedRows,
      removed_files: removedFiles,
      failed_files: failedFiles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'Execucao nao autorizada' ? 401 : 500;
    console.error('cleanup-expired-pdfs falhou:', message);
    return jsonResponse({ success: false, error: message }, status);
  }
});
