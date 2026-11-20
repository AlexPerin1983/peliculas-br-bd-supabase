#!/usr/bin/env node
// Conferência da leitura do CRM DEPOIS de publicar a função crm-read.
// Só leitura. Mostra apenas "passou/falhou" e códigos HTTP: nunca imprime a
// chave nem o conteúdo das respostas.
//
// Variáveis (definir no terminal, sem salvar em arquivo):
//   CRM_READ_URL                  ex.: https://<projeto>.supabase.co/functions/v1/crm-read
//   CRM_READ_KEY                  chave de leitura da empresa
//   CRM_READ_PHONE                (opcional) telefone de um cliente desta empresa com proposta
//   CRM_READ_PHONE_OTHER_COMPANY  (opcional) telefone de um cliente que só existe em OUTRA empresa
//   CRM_READ_REVOKED_KEY          (opcional) uma chave já revogada
//
//   node scripts/crm-read-smoke.mjs
import process from 'node:process';

const url = process.env.CRM_READ_URL;
const key = process.env.CRM_READ_KEY;
if (!url || !key) {
    console.error('Defina CRM_READ_URL e CRM_READ_KEY antes de rodar.');
    process.exit(1);
}

const post = async (body, headerKey) => {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(headerKey ? { 'x-crm-key': headerKey } : {}) },
        body: JSON.stringify(body),
    });
    let json = null;
    try { json = await response.json(); } catch { /* resposta sem JSON */ }
    return { status: response.status, json };
};

const today = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
const inAWeek = new Date(Date.now() - 3 * 3_600_000 + 6 * 86_400_000).toISOString().slice(0, 10);
const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail });

const noKey = await post({ action: 'agenda', de: today, ate: today }, null);
check('sem chave é recusado (401)', noKey.status === 401, `HTTP ${noKey.status}`);

const wrongKey = await post({ action: 'agenda', de: today, ate: today }, `pbr_ro_${'x'.repeat(43)}`);
check('chave inexistente é recusada (401)', wrongKey.status === 401, `HTTP ${wrongKey.status}`);

if (process.env.CRM_READ_REVOKED_KEY) {
    const revoked = await post({ action: 'agenda', de: today, ate: today }, process.env.CRM_READ_REVOKED_KEY);
    check('chave revogada é recusada (401)', revoked.status === 401, `HTTP ${revoked.status}`);
}

const otherCompanyField = await post({ action: 'agenda', de: today, ate: today, company_id: '00000000-0000-4000-8000-000000000000' }, key);
check('pedido com company_id é recusado (400)', otherCompanyField.status === 400, `HTTP ${otherCompanyField.status}`);

const writeAttempt = await post({ action: 'client_create', name: 'Teste', phone: '21900000000' }, key);
check('ação de escrita é recusada (400)', writeAttempt.status === 400, `HTTP ${writeAttempt.status}`);

const agenda = await post({ action: 'agenda', de: today, ate: inAWeek }, key);
check('agenda da semana responde (200)', agenda.status === 200 && Array.isArray(agenda.json?.ocupados), `HTTP ${agenda.status}`);

if (process.env.CRM_READ_PHONE) {
    const own = await post({ action: 'propostas', telefone: process.env.CRM_READ_PHONE }, key);
    check('cliente desta empresa é encontrado', own.status === 200 && own.json?.encontrado === true,
        `HTTP ${own.status}, ${own.json?.propostas?.length ?? 0} proposta(s)`);
}

if (process.env.CRM_READ_PHONE_OTHER_COMPANY) {
    const other = await post({ action: 'propostas', telefone: process.env.CRM_READ_PHONE_OTHER_COMPANY }, key);
    check('cliente de OUTRA empresa não aparece', other.status === 200 && other.json?.encontrado === false
        && (other.json?.propostas?.length ?? 0) === 0, `HTTP ${other.status}`);
}

for (const result of results) console.log(`${result.ok ? 'passou' : 'FALHOU'}  ${result.name}  (${result.detail})`);
const failed = results.filter((result) => !result.ok).length;
console.log(failed ? `\n${failed} conferência(s) falharam.` : '\nTudo certo.');
process.exit(failed ? 1 : 0);
