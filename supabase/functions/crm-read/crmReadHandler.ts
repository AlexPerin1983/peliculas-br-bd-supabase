// Atende um pedido da leitura do CRM. Separado do Deno.serve para ser testado no
// Vitest com um banco de mentira: quem chama passa as funções que leem o banco.
//
// Regras de segurança:
// - sem chave válida, nada é lido (401, sempre a mesma mensagem);
// - a empresa vem SÓ da chave; campos como company_id no pedido são recusados;
// - nada de chave, telefone ou resposta nos registros (console).
import {
    type AgendaRows, type CrmScope, type ProposalRows,
    CRM_KEY_HEADER, agendaRange, isPlausibleCrmKey, parseCrmCommand, requiredScope, sha256Hex, shapeAgenda, shapeProposals,
} from './crmReadLogic.ts';

export interface CrmKeyRecord {
    keyId: string;
    organizationId: string;
    scopes: string[];
}

export interface CrmReadDeps {
    // Recebe o SHA-256 da chave; devolve null se não existe, está desligada, revogada ou vencida.
    findKey: (tokenHash: string) => Promise<CrmKeyRecord | null>;
    loadProposals: (organizationId: string, phone: string) => Promise<ProposalRows>;
    loadAgenda: (organizationId: string, fromIso: string, toIso: string) => Promise<AgendaRows>;
    now?: () => number;
    // Só o código do erro, para diagnóstico (nunca dados do pedido).
    logError?: (code: string) => void;
}

const MAX_BODY_BYTES = 4_096;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
    },
});

const UNAUTHORIZED = () => json({ error: 'Chave de acesso ausente ou inválida.' }, 401);

export const handleCrmRead = async (request: Request, deps: CrmReadDeps): Promise<Response> => {
    const logError = deps.logError ?? (() => {});
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

    const key = request.headers.get(CRM_KEY_HEADER);
    if (!isPlausibleCrmKey(key)) return UNAUTHORIZED();

    let record: CrmKeyRecord | null;
    try {
        record = await deps.findKey(await sha256Hex(key));
    } catch {
        logError('key_lookup_failed');
        return json({ error: 'Serviço indisponível.' }, 503);
    }
    if (!record?.organizationId) return UNAUTHORIZED();

    let payload: unknown;
    try {
        const text = await request.text();
        if (text.length > MAX_BODY_BYTES) return json({ error: 'Pedido grande demais.' }, 413);
        payload = JSON.parse(text);
    } catch {
        return json({ error: 'Pedido inválido.' }, 400);
    }

    const command = parseCrmCommand(payload);
    if ('invalid' in command) return json({ error: command.invalid }, 400);

    const scope: CrmScope = requiredScope(command);
    if (!record.scopes.includes(scope)) return json({ error: 'Esta chave não pode fazer esta consulta.' }, 403);

    const now = (deps.now ?? Date.now)();
    const org = record.organizationId;
    try {
        if (command.action === 'propostas') {
            return json(shapeProposals(await deps.loadProposals(org, command.phone), now));
        }
        const { fromIso, toIso } = agendaRange(command.from, command.to);
        return json(shapeAgenda(await deps.loadAgenda(org, fromIso, toIso), command.from, command.to, now));
    } catch {
        logError(`${command.action}_failed`);
        return json({ error: 'Não foi possível consultar o CRM agora.' }, 503);
    }
};
