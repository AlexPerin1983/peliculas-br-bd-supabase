// Atende um pedido da leitura do CRM. Separado do Deno.serve para ser testado no
// Vitest com um banco de mentira: quem chama passa as funções que leem o banco.
//
// Regras de segurança:
// - sem chave válida, nada é lido (401, sempre a mesma mensagem);
// - a empresa vem SÓ da chave; campos como company_id no pedido são recusados;
// - nada de chave, telefone ou resposta nos registros (console);
// - salvar cliente: só com a permissão clients:create; nunca altera cliente existente.
import {
    type AgendaRows, type CrmScope, type DraftMeasurement, type ProposalRows,
    CRM_KEY_HEADER, agendaRange, clientNotes, isPlausibleCrmKey, parseCrmCommand, provisionalClientName, requiredScope,
    saveClientPush, sha256Hex, shapeAgenda, shapeProposals,
} from './crmReadLogic.ts';
import {
    type TeamAction, type TeamCommand, TEAM_ACTIONS, TEAM_FIELDS, TEAM_REASONS,
    addDays, describeWhen, localDay, localIso, parseTeamCommand, proposalPortalUrl, teamScope,
} from './crmTeamLogic.ts';

// Chama uma função do banco (RPC) com os argumentos dados. Erros do banco chegam
// como Error com a mensagem original (ex.: "CRM:operador").
export type RunTeamRpc = (name: string, args: Record<string, unknown>) => Promise<any>;

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
    // Cria o cliente se o telefone ainda não existir na empresa (nunca altera o existente).
    saveClient?: (keyId: string, organizationId: string, input: {
        phone: string; name: string; bairro: string | null; cidade: string | null; notes: string;
        measurements: DraftMeasurement[]; film: string | null;
    }) => Promise<SaveClientOutcome>;
    // Aviso no celular da empresa. Falhar aqui não desfaz o cadastro.
    notifyCompany?: (organizationId: string, push: { title: string; body: string; tag?: string; url?: string }) => Promise<void>;
    // Ações da equipe (agenda_criar, proposta_*). Sem isto, respondem 403.
    runTeamRpc?: RunTeamRpc;
    now?: () => number;
    // Só o código do erro, para diagnóstico (nunca dados do pedido).
    logError?: (code: string) => void;
}

export type SaveClientOutcome =
    | { ok: true; clientId: number; name: string; created: boolean; draft?: 'criado' | 'ja_existia' | 'sem_medidas' }
    | { ok: false; reason: 'limit' | 'forbidden' };

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

    const teamAction = payload && typeof payload === 'object' && !Array.isArray(payload)
        && TEAM_ACTIONS.includes((payload as Record<string, unknown>).action as TeamAction)
        ? (payload as Record<string, unknown>).action as TeamAction
        : null;
    if (teamAction) return handleTeamAction(teamAction, payload as Record<string, unknown>, record, deps);

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
        if (command.action === 'cliente_salvar') {
            if (!deps.saveClient) return json({ error: 'Esta chave não pode fazer esta consulta.' }, 403);
            const outcome = await deps.saveClient(record.keyId, org, {
                phone: command.phone,
                name: command.name ?? provisionalClientName(command.phone),
                bairro: command.bairro,
                cidade: command.cidade,
                notes: clientNotes(command.summary, now),
                measurements: command.measurements,
                film: command.film,
            });
            if (outcome.ok === false) {
                return outcome.reason === 'limit'
                    ? json({ error: 'Limite de cadastros por hora atingido. Tente mais tarde.' }, 429)
                    : json({ error: 'Esta chave não pode fazer esta consulta.' }, 403);
            }
            if (deps.notifyCompany) {
                try {
                    await deps.notifyCompany(org, saveClientPush(outcome, command.bairro));
                } catch {
                    logError('notify_failed');
                }
            }
            return json({
                cliente_ref: outcome.clientId,
                criado: outcome.created,
                // Só quando foi criado agora: o nome de um cliente que já existia não volta.
                nome_salvo: outcome.created ? outcome.name : null,
                nome_provisorio: outcome.created && command.name == null,
                rascunho_medidas: outcome.draft ?? 'sem_medidas',
            });
        }
        const { fromIso, toIso } = agendaRange(command.from, command.to);
        return json(shapeAgenda(await deps.loadAgenda(org, fromIso, toIso), command.from, command.to, now));
    } catch {
        logError(`${command.action}_failed`);
        return json({ error: 'Não foi possível consultar o CRM agora.' }, 503);
    }
};

const COMPANY_FIELD = /^(company|organization|organisation|empresa|org|tenant)(_?id)?$/i;

const target = (command: TeamCommand) => ({ p_phone: command.phone, p_client_id: command.clientId });

const refused = (motivo: string, extra: Record<string, unknown> = {}) =>
    json({ sucesso: false, motivo, mensagem: TEAM_REASONS[motivo] ?? 'Não foi possível concluir.', ...extra });

// Ações da equipe. Recusas de regra (horário ocupado, película errada...) voltam
// com 200 e sucesso=false, para a IA explicar; falta de permissão volta 403.
const handleTeamAction = async (
    action: TeamAction, body: Record<string, unknown>, record: CrmKeyRecord, deps: CrmReadDeps,
): Promise<Response> => {
    const logError = deps.logError ?? (() => {});
    const keys = Object.keys(body);
    const companyField = keys.find(key => COMPANY_FIELD.test(key));
    if (companyField) return json({ error: `A empresa vem da chave de acesso; não envie "${companyField}".` }, 400);
    const extra = keys.find(key => !TEAM_FIELDS[action].includes(key));
    if (extra) return json({ error: `Campo não aceito: "${extra.slice(0, 40)}".` }, 400);

    const command = parseTeamCommand(action, body);
    if ('invalid' in command) return json({ error: command.invalid }, 400);
    if (!record.scopes.includes(teamScope(action)) || !deps.runTeamRpc) {
        return json({ error: 'Esta chave não pode fazer esta ação.' }, 403);
    }

    const org = record.organizationId;
    const rpc = deps.runTeamRpc;
    const now = (deps.now ?? Date.now)();
    const notify = async (push: { title: string; body: string; tag?: string; url?: string }) => {
        if (!deps.notifyCompany) return;
        try { await deps.notifyCompany(org, push); } catch { logError('notify_failed'); }
    };

    try {
        if (command.action === 'proposta_consultar') {
            const data = await rpc('crm_proposal_status', { p_organization_id: org, ...target(command) });
            if (!data?.ok) return refused(String(data?.motivo ?? 'cliente_nao_encontrado'));
            return json({
                sucesso: true,
                cliente_ref: data.client_id,
                opcoes: data.opcoes ?? [],
                links: (data.links ?? []).map((link: any) => ({
                    link_proposta: proposalPortalUrl(String(link.token), data.client_name),
                    status: link.status,
                    expira_em: link.expira_em,
                    criado_em: link.criado_em,
                    visualizacoes: Number(link.visualizacoes ?? 0),
                    ultima_visualizacao: link.ultima_visualizacao ?? null,
                })),
            });
        }

        if (command.action === 'agenda_criar') {
            const data = await rpc('crm_agenda_create', {
                p_key_id: record.keyId, p_organization_id: org, p_operator: command.operator, ...target(command),
                p_start: new Date(command.start).toISOString(), p_end: new Date(command.end).toISOString(),
                p_type: command.type, p_notes: command.notes,
            });
            if (!data?.ok) {
                const motivo = String(data?.motivo ?? 'horario_invalido');
                if (motivo !== 'conflito') return refused(motivo);
                // Horários livres de 30 min ou mais, do dia pedido até 3 dias depois.
                const from = localDay(command.start);
                const to = addDays(from, 3);
                const { fromIso, toIso } = agendaRange(from, to);
                let livres: unknown = null;
                try {
                    livres = shapeAgenda(await deps.loadAgenda(org, fromIso, toIso), from, to, now).livres;
                } catch {
                    logError('agenda_free_failed');
                }
                return refused('conflito', { livres });
            }
            const when = describeWhen(command.start);
            const kind = data.tipo === 'instalacao' ? 'Instalação' : 'Visita de medição';
            await notify({
                title: `${kind} marcada pelo WhatsApp`,
                body: `${String(data.client_name ?? 'Cliente').slice(0, 80)}: ${when}.`,
                tag: `crm-agenda-${data.agenda_id}`,
                url: '/?tab=agenda',
            });
            return json({
                sucesso: true,
                agenda_id: data.agenda_id,
                cliente_ref: data.client_id,
                tipo: data.tipo === 'instalacao' ? 'instalacao' : 'visita_medicao',
                inicio: localIso(command.start),
                fim: localIso(command.end),
                mensagem: `Agendado para ${when}.`,
            });
        }

        if (command.action === 'proposta_enviar') {
            const data = await rpc('crm_proposal_send', {
                p_key_id: record.keyId, p_organization_id: org, p_operator: command.operator, ...target(command),
                p_option_names: command.optionNames.length ? command.optionNames : null, p_valid_days: command.validDays,
            });
            if (!data?.ok) return refused(String(data?.motivo ?? 'nenhuma_opcao_para_enviar'), data?.opcao ? { opcao: data.opcao } : {});
            return json({
                sucesso: true,
                cliente_ref: data.client_id,
                link_proposta: proposalPortalUrl(String(data.token), data.client_name),
                expira_em: data.expira_em,
                opcoes: data.opcoes ?? [],
            });
        }

        const data = await rpc('crm_proposal_generate', {
            p_key_id: record.keyId, p_organization_id: org, p_operator: command.operator, ...target(command),
            p_films: command.films.length ? command.films : null, p_discount_percent: command.discountPercent,
        });
        if (!data?.ok) {
            const motivo = String(data?.motivo ?? 'sem_medidas');
            const details: Record<string, unknown> = {};
            if (data?.disponiveis) details.peliculas_disponiveis = data.disponiveis;
            if (data?.desconhecidas) details.peliculas_desconhecidas = data.desconhecidas;
            if (data?.limite != null) details.desconto_maximo = Number(data.limite);
            return refused(motivo, details);
        }
        return json({
            sucesso: true,
            cliente_ref: data.client_id,
            opcoes: data.opcoes ?? [],
            enviado_ao_cliente: false,
            mensagem: 'Calculado e salvo no CRM. Nada foi enviado ao cliente: mande o resumo para a equipe aprovar.',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? '');
        if (message.includes('CRM:operador')) {
            return json({ sucesso: false, motivo: 'operador_nao_autorizado', mensagem: 'Este número não é da equipe. Ação recusada.' }, 403);
        }
        if (message.includes('CRM:permissao')) return json({ error: 'Esta chave não pode fazer esta ação.' }, 403);
        if (message.includes('CRM:limite')) return json({ error: 'Limite de ações por hora atingido. Tente mais tarde.' }, 429);
        logError(`${action}_failed`);
        return json({ error: 'Não foi possível concluir no CRM agora.' }, 503);
    }
};
