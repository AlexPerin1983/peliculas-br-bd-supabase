#!/usr/bin/env node
// Chave de leitura do CRM para o atendimento (Conversa Bridge Ai).
//
// A chave NUNCA aparece na tela: vai direto para a área de transferência, para
// colar nos segredos do servidor do atendimento. O banco guarda só o SHA-256.
// O script não acessa o banco: ele imprime o SQL para rodar no Supabase.
//
// Uso:
//   node scripts/crm-read-key.mjs criar --empresa <uuid> [--rotulo "Conversa Bridge Ai"] [--validade-dias 365] [--somente propostas|agenda]
//   node scripts/crm-read-key.mjs revogar --id <uuid-da-chave>
//   node scripts/crm-read-key.mjs listar --empresa <uuid>
//
// Ver docs/integracoes/conversa-bridge-leitura.md.
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCOPES = { propostas: 'proposals:read', agenda: 'agenda:read' };

const fail = (message) => {
    console.error(`Erro: ${message}`);
    process.exit(1);
};

const readArgs = (argv) => {
    const args = {};
    for (let index = 0; index < argv.length; index += 1) {
        const name = argv[index];
        if (!name.startsWith('--')) fail(`argumento inesperado: ${name}`);
        const value = argv[index + 1];
        if (value == null || value.startsWith('--')) fail(`faltou o valor de ${name}`);
        args[name.slice(2)] = value;
        index += 1;
    }
    return args;
};

const sqlText = (value) => `'${String(value).replace(/'/g, "''")}'`;

const copyToClipboard = (text) => {
    const attempts = process.platform === 'win32'
        ? [['clip', []]]
        : process.platform === 'darwin'
            ? [['pbcopy', []]]
            : [['wl-copy', []], ['xclip', ['-selection', 'clipboard']], ['xsel', ['--clipboard', '--input']]];
    return attempts.some(([command, args]) => spawnSync(command, args, { input: text, stdio: ['pipe', 'ignore', 'ignore'] }).status === 0);
};

const [command, ...rest] = process.argv.slice(2);
const args = readArgs(rest);

if (command === 'criar') {
    if (!UUID.test(args.empresa ?? '')) fail('informe --empresa com o id (uuid) da empresa.');
    const label = (args.rotulo ?? 'Conversa Bridge Ai').trim().slice(0, 80);
    if (!label) fail('o rótulo não pode ficar vazio.');
    const days = args['validade-dias'] == null ? 365 : Number(args['validade-dias']);
    if (!Number.isInteger(days) || days < 1 || days > 730) fail('--validade-dias precisa ser um número entre 1 e 730.');
    const scopes = args.somente == null ? Object.values(SCOPES) : [SCOPES[args.somente]];
    if (scopes.some((scope) => !scope)) fail('--somente aceita "propostas" ou "agenda".');

    const key = `pbr_ro_${randomBytes(32).toString('base64url')}`;
    const hash = createHash('sha256').update(key).digest('hex');
    if (!copyToClipboard(key)) fail('não consegui copiar a chave para a área de transferência. Nada foi criado.');

    console.log('Chave copiada para a área de transferência (ela não aparece aqui).');
    console.log('1) Cole a chave AGORA nos segredos do servidor do atendimento, com o nome PELICULASBR_CRM_KEY.');
    console.log('2) Rode este SQL no Supabase (só grava o SHA-256 da chave):');
    console.log('');
    console.log([
        'INSERT INTO public.crm_read_keys (organization_id, token_hash, label, scopes, expires_at)',
        `SELECT o.id, ${sqlText(hash)}, ${sqlText(label)}, ARRAY[${scopes.map(sqlText).join(', ')}]::text[], now() + interval '${days} days'`,
        `FROM public.organizations o WHERE o.id = ${sqlText(args.empresa.toLowerCase())}`,
        'RETURNING id, label, scopes, expires_at;',
    ].join('\n'));
    console.log('');
    console.log('Se o SQL não devolver nenhuma linha, o id da empresa está errado e a chave não vale nada.');
    console.log('Depois de colar, copie qualquer outro texto para limpar a área de transferência.');
} else if (command === 'revogar') {
    if (!UUID.test(args.id ?? '')) fail('informe --id com o id (uuid) da chave. Use "listar" para ver os ids.');
    console.log('Rode este SQL no Supabase. A chave para de funcionar na hora, sem publicar nada:');
    console.log('');
    console.log([
        'UPDATE public.crm_read_keys',
        '   SET enabled = false, revoked_at = coalesce(revoked_at, now())',
        ` WHERE id = ${sqlText(args.id.toLowerCase())}`,
        'RETURNING id, label, revoked_at;',
    ].join('\n'));
} else if (command === 'listar') {
    if (!UUID.test(args.empresa ?? '')) fail('informe --empresa com o id (uuid) da empresa.');
    console.log('Rode este SQL no Supabase (somente leitura, não mostra a chave):');
    console.log('');
    console.log([
        'SELECT id, label, scopes, enabled, created_at, expires_at, revoked_at, last_used_at',
        '  FROM public.crm_read_keys',
        ` WHERE organization_id = ${sqlText(args.empresa.toLowerCase())}`,
        ' ORDER BY created_at DESC;',
    ].join('\n'));
} else {
    console.log('Uso:');
    console.log('  node scripts/crm-read-key.mjs criar --empresa <uuid> [--rotulo "Conversa Bridge Ai"] [--validade-dias 365] [--somente propostas|agenda]');
    console.log('  node scripts/crm-read-key.mjs revogar --id <uuid-da-chave>');
    console.log('  node scripts/crm-read-key.mjs listar --empresa <uuid>');
    process.exit(command ? 1 : 0);
}
