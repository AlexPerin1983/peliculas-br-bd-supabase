// Ações que a EQUIPE comanda pelo WhatsApp (marcar agenda, calcular, consultar e
// enviar proposta). Regras puras, testadas no Vitest.
//
// Toda ação de escrita precisa de "operador_telefone": o número de WhatsApp de
// quem deu o comando. O banco só aceita se for um número da equipe cadastrado na
// chave (crm_read_keys.operator_phones). A IA nunca decide isso sozinha.
import { type CrmScope, localIso, phoneDigits } from './crmReadLogic.ts';

const OFFSET = '-03:00';
const OFFSET_MS = 3 * 3_600_000;
const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export type TeamAction = 'agenda_criar' | 'proposta_gerar' | 'proposta_atualizar' | 'proposta_consultar' | 'proposta_enviar';
export const TEAM_ACTIONS: TeamAction[] = ['agenda_criar', 'proposta_gerar', 'proposta_atualizar', 'proposta_consultar', 'proposta_enviar'];

export interface ClientTarget {
    phone: string | null;
    clientId: number | null;
}

export type TeamCommand =
    | ({ action: 'agenda_criar'; operator: string; start: number; end: number; type: 'consulta' | 'instalacao'; notes: string | null } & ClientTarget)
    | ({ action: 'proposta_gerar' | 'proposta_atualizar'; operator: string; films: string[]; discountPercent: number } & ClientTarget)
    | ({ action: 'proposta_consultar' } & ClientTarget)
    | ({ action: 'proposta_enviar'; operator: string; optionNames: string[]; validDays: number } & ClientTarget);

export const TEAM_FIELDS: Record<TeamAction, string[]> = {
    agenda_criar: ['action', 'operador_telefone', 'cliente_telefone', 'cliente_ref', 'inicio', 'fim', 'duracao_minutos', 'tipo', 'observacoes'],
    proposta_gerar: ['action', 'operador_telefone', 'cliente_telefone', 'cliente_ref', 'peliculas', 'desconto_percentual'],
    proposta_atualizar: ['action', 'operador_telefone', 'cliente_telefone', 'cliente_ref', 'peliculas', 'desconto_percentual'],
    proposta_consultar: ['action', 'cliente_telefone', 'cliente_ref'],
    proposta_enviar: ['action', 'operador_telefone', 'cliente_telefone', 'cliente_ref', 'opcoes', 'validade_dias'],
};

export const teamScope = (action: TeamAction): CrmScope =>
    action === 'agenda_criar' ? 'agenda:create'
        : action === 'proposta_consultar' ? 'proposals:read'
            : action === 'proposta_enviar' ? 'proposals:send'
                : 'proposals:write';

// "2026-11-24 14:00", "2026-11-24T14:00" (hora de Brasília) ou ISO com fuso.
export const parseLocalDateTime = (value: unknown): number | null => {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    const local = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::00)?$/.exec(text);
    if (local) {
        const [, y, mo, d, h, mi] = local;
        if (Number(h) > 23 || Number(mi) > 59) return null;
        const check = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
        if (check.toISOString().slice(0, 10) !== `${y}-${mo}-${d}`) return null;
        return Date.parse(`${y}-${mo}-${d}T${h}:${mi}:00${OFFSET}`);
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(text)) {
        const ms = Date.parse(text);
        return Number.isFinite(ms) ? ms : null;
    }
    return null;
};

const clientTarget = (body: Record<string, unknown>): ClientTarget | { invalid: string } => {
    if (body.cliente_ref != null) {
        const id = Number(body.cliente_ref);
        if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) return { invalid: 'cliente_ref inválido.' };
        return { phone: null, clientId: id };
    }
    const phone = phoneDigits(body.cliente_telefone);
    return phone ? { phone, clientId: null } : { invalid: 'Envie cliente_telefone (só dígitos, com DDD) ou cliente_ref.' };
};

const textList = (value: unknown, field: string, max: number): string[] | { invalid: string } => {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > max || value.some(item => typeof item !== 'string' || item.length > 80)) {
        return { invalid: `"${field}" precisa ser uma lista de até ${max} nomes.` };
    }
    return Array.from(new Set(value.map(item => item.trim()).filter(Boolean)));
};

export const parseTeamCommand = (action: TeamAction, body: Record<string, unknown>): TeamCommand | { invalid: string } => {
    const target = clientTarget(body);
    if ('invalid' in target) return target;
    if (action === 'proposta_consultar') return { action, ...target };

    const operator = phoneDigits(body.operador_telefone);
    if (!operator) return { invalid: 'Envie operador_telefone: o WhatsApp de quem da equipe deu o comando.' };

    if (action === 'agenda_criar') {
        const start = parseLocalDateTime(body.inicio);
        if (start == null) return { invalid: 'inicio inválido. Use "AAAA-MM-DD HH:mm" (hora de Brasília).' };
        let end: number | null;
        if (body.fim != null) {
            end = parseLocalDateTime(body.fim);
            if (end == null) return { invalid: 'fim inválido. Use "AAAA-MM-DD HH:mm".' };
        } else {
            const minutes = body.duracao_minutos == null ? 60 : Number(body.duracao_minutos);
            if (!Number.isInteger(minutes) || minutes < 15 || minutes > 720) return { invalid: 'duracao_minutos precisa ser de 15 a 720.' };
            end = start + minutes * 60_000;
        }
        if (end <= start) return { invalid: 'O fim precisa ser depois do início.' };
        if (body.tipo != null && body.tipo !== 'visita_medicao' && body.tipo !== 'instalacao') {
            return { invalid: 'tipo precisa ser "visita_medicao" ou "instalacao".' };
        }
        if (body.observacoes != null && (typeof body.observacoes !== 'string' || body.observacoes.length > 500)) {
            return { invalid: 'observacoes precisa ser texto de até 500 caracteres.' };
        }
        const notes = typeof body.observacoes === 'string' ? body.observacoes.replace(/\s+/g, ' ').trim() || null : null;
        return { action, ...target, operator, start, end, type: body.tipo === 'instalacao' ? 'instalacao' : 'consulta', notes };
    }

    if (action === 'proposta_enviar') {
        const optionNames = textList(body.opcoes, 'opcoes', 6);
        if (!Array.isArray(optionNames)) return optionNames;
        const days = body.validade_dias == null ? 7 : Number(body.validade_dias);
        if (!Number.isInteger(days) || days < 1 || days > 30) return { invalid: 'validade_dias precisa ser de 1 a 30.' };
        return { action, ...target, operator, optionNames, validDays: days };
    }

    const films = textList(body.peliculas, 'peliculas', 4);
    if (!Array.isArray(films)) return films;
    const discount = body.desconto_percentual == null ? 0 : Number(body.desconto_percentual);
    if (!Number.isFinite(discount) || discount < 0 || discount > 90) return { invalid: 'desconto_percentual precisa ser de 0 a 90.' };
    return { action, ...target, operator, films, discountPercent: Math.round(discount * 100) / 100 };
};

// "segunda-feira (24/11) às 14:00"
export const describeWhen = (ms: number) => {
    const local = new Date(ms - OFFSET_MS);
    const day = String(local.getUTCDate()).padStart(2, '0');
    const month = String(local.getUTCMonth() + 1).padStart(2, '0');
    const time = local.toISOString().slice(11, 16);
    return `${WEEKDAYS[local.getUTCDay()]} (${day}/${month}) às ${time}`;
};

export const localDay = (ms: number) => new Date(ms - OFFSET_MS).toISOString().slice(0, 10);
export const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export { localIso };

// Endereço que o cliente abre (o mesmo formato do app: /p/<primeiro-nome>/<token>).
export const APP_ORIGIN = 'https://app.filmstec.shop';
export const proposalClientSlug = (clientName: string | null | undefined) => {
    const first = String(clientName ?? '').trim().split(/\s+/)[0] || 'cliente';
    return first.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cliente';
};
export const proposalPortalUrl = (token: string, clientName: string | null | undefined) =>
    `${APP_ORIGIN}/p/${proposalClientSlug(clientName)}/${encodeURIComponent(token)}`;

// Mensagens para a IA repassar à equipe quando o CRM recusa.
export const TEAM_REASONS: Record<string, string> = {
    cliente_nao_encontrado: 'Não achei esse cliente no CRM. Salve o cliente primeiro.',
    horario_invalido: 'Horário inválido.',
    data_fora_do_prazo: 'A data precisa ser de hoje até 180 dias para a frente.',
    conflito: 'Esse horário já está ocupado na agenda.',
    sem_medidas: 'Esse cliente ainda não tem medidas no CRM.',
    escolha_peliculas: 'Diga quais películas usar nas opções.',
    no_maximo_4_peliculas: 'No máximo 4 películas por vez.',
    pelicula_desconhecida: 'Película não encontrada no catálogo da empresa.',
    desconto_acima_do_limite: 'Desconto acima do limite permitido.',
    opcao_sem_preco: 'Uma das opções está sem preço no catálogo. Confira a película no app.',
    nenhuma_opcao_para_enviar: 'Não há opção calculada para enviar. Use proposta_gerar primeiro.',
};
