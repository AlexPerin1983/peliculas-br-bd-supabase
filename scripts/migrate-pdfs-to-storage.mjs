// =====================================================
// Fix D — Migração única: PDFs base64 (saved_pdfs.pdf_blob) -> Supabase Storage
//
// Para cada registro com pdf_blob preenchido e pdf_path vazio:
//   1. resolve o prefixo da pasta (owner_id da org do dono do registro)
//   2. decodifica o base64 e faz upload para o bucket "pdfs"
//   3. grava pdf_path e zera pdf_blob (libera espaço no banco)
//
// Requer a SERVICE_ROLE key (ignora RLS). NUNCA comite essa chave.
//
// Como rodar (PowerShell/bash), com as variáveis de ambiente:
//   SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
// ou crie um arquivo .env.migration (já ignorado pelo git) com:
//   SUPABASE_URL=https://avlefzsipbqvollukgyt.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...   (ou sb_secret_...)
//
//   node scripts/migrate-pdfs-to-storage.mjs
//
// Use --dry-run para apenas listar o que seria migrado, sem alterar nada.
// =====================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const DRY_RUN = process.argv.includes('--dry-run');
const BUCKET = 'pdfs';

// Carrega .env.migration se existir (parser simples KEY=VALUE)
function loadEnvFile(path) {
    if (!existsSync(path)) return;
    const content = readFileSync(path, 'utf8');
    for (const rawLine of content.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
    }
}

loadEnvFile('.env.migration');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://avlefzsipbqvollukgyt.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
    console.error('ERRO: defina SUPABASE_SERVICE_ROLE_KEY (variável de ambiente ou .env.migration).');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

// Cache user_id -> prefixo (owner_id da org, ou o próprio user_id)
const prefixCache = new Map();

async function resolvePrefix(userId) {
    if (!userId) return null;
    if (prefixCache.has(userId)) return prefixCache.get(userId);

    let prefix = userId;
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .maybeSingle();

    if (profile?.organization_id) {
        const { data: org } = await supabase
            .from('organizations')
            .select('owner_id')
            .eq('id', profile.organization_id)
            .maybeSingle();
        if (org?.owner_id) prefix = org.owner_id;
    }

    prefixCache.set(userId, prefix);
    return prefix;
}

function base64ToBuffer(base64) {
    const parts = base64.split(',');
    const hasHeader = parts.length > 1 && parts[0].includes('base64');
    const payload = hasHeader ? parts[1] : base64;
    const mime = hasHeader ? (parts[0].match(/:(.*?);/)?.[1] || 'application/pdf') : 'application/pdf';
    return { buffer: Buffer.from(payload, 'base64'), mime };
}

async function main() {
    console.log(`\n=== Migração PDFs base64 -> Storage ${DRY_RUN ? '(DRY RUN)' : ''} ===`);
    console.log(`Projeto: ${SUPABASE_URL}\n`);

    // 1. Lista os IDs a migrar (sem trazer o blob pesado)
    const { data: pending, error: listError } = await supabase
        .from('saved_pdfs')
        .select('id, user_id')
        .not('pdf_blob', 'is', null)
        .is('pdf_path', null)
        .order('id', { ascending: true });

    if (listError) {
        console.error('Erro ao listar registros pendentes:', listError);
        process.exit(1);
    }

    const total = pending?.length || 0;
    console.log(`Registros a migrar: ${total}`);
    if (total === 0) {
        console.log('Nada a fazer. ✔');
        return;
    }

    let ok = 0;
    let failed = 0;

    for (let i = 0; i < total; i++) {
        const { id, user_id } = pending[i];
        const label = `[${i + 1}/${total}] PDF id=${id}`;

        try {
            // 2. Busca o blob individualmente (um por vez = baixo uso de memória)
            const { data: row, error: rowError } = await supabase
                .from('saved_pdfs')
                .select('pdf_blob')
                .eq('id', id)
                .single();

            if (rowError || !row?.pdf_blob) {
                console.warn(`${label}: sem pdf_blob, pulando.`);
                continue;
            }

            const prefix = await resolvePrefix(user_id);
            const path = `${prefix}/${randomUUID()}.pdf`;
            const { buffer, mime } = base64ToBuffer(row.pdf_blob);

            if (DRY_RUN) {
                console.log(`${label}: subiria ${(buffer.length / 1024 / 1024).toFixed(1)}MB -> ${path}`);
                ok++;
                continue;
            }

            // 3. Upload para o Storage
            const { error: upErr } = await supabase.storage
                .from(BUCKET)
                .upload(path, buffer, { contentType: mime, upsert: false });
            if (upErr) throw upErr;

            // 4. Grava pdf_path e zera pdf_blob
            const { error: updErr } = await supabase
                .from('saved_pdfs')
                .update({ pdf_path: path, pdf_blob: null })
                .eq('id', id);
            if (updErr) {
                // rollback do arquivo se não conseguiu gravar o ponteiro
                await supabase.storage.from(BUCKET).remove([path]);
                throw updErr;
            }

            ok++;
            console.log(`${label}: OK -> ${path} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
        } catch (err) {
            failed++;
            console.error(`${label}: FALHOU -`, err?.message || err);
        }
    }

    console.log(`\n=== Concluído: ${ok} migrados, ${failed} falhas (de ${total}) ===`);
    if (!DRY_RUN && failed === 0) {
        console.log('Dica: rode VACUUM (FULL) em saved_pdfs no SQL Editor para recuperar o espaço em disco.');
    }
}

main().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
});
