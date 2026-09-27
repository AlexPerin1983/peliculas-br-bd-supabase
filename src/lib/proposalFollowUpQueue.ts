import { buildProposalPortalUrl, type CompanyProposalPortal } from './proposalPortal';

// "Para acompanhar hoje": o que o cliente fez no link decide o próximo passo.
// - não abriu: a mensagem se perdeu → confirmar se recebeu (desconto não adianta);
// - abriu 3x ou mais: tem interesse, costuma ser preço ou dúvida → hora da oferta;
// - abriu 1–2x: reforçar o valor (garantia, fotos, avaliações);
// - vencendo/vencida: avisar do prazo, renovar ou encerrar como perdida.

export type FollowUpStep = 'reply' | 'expiring' | 'hot' | 'not_opened' | 'value' | 'expired' | 'close';

// Situações com mensagem (e modelo editável).
export type FollowUpTemplateStep = 'not_opened' | 'hot' | 'value' | 'expiring' | 'expired';

export const FOLLOW_UP_TEMPLATE_STEPS: Array<{ step: FollowUpTemplateStep; label: string; when: string }> = [
    { step: 'not_opened', label: 'Não abriu o link', when: '1 dia depois do envio, se o cliente não abriu' },
    { step: 'hot', label: 'Abriu várias vezes', when: 'abriu 3 vezes ou mais e não respondeu' },
    { step: 'value', label: 'Reforço de valor', when: 'abriu 1 ou 2 vezes e não respondeu em 2 dias' },
    { step: 'expiring', label: 'Proposta vencendo', when: 'faltando 2 dias ou menos para vencer' },
    { step: 'expired', label: 'Proposta vencida', when: 'venceu sem resposta' },
];

export const DEFAULT_FOLLOW_UP_TEMPLATES: Record<FollowUpTemplateStep, string> = {
    not_opened: 'Oi, {{primeiro_nome}}! Tudo bem? Te enviei a proposta das películas, conseguiu abrir? Segue o link de novo: {{link}}',
    hot: 'Oi, {{primeiro_nome}}! Vi que você olhou a proposta com calma. Ficou alguma dúvida sobre as películas ou a instalação? Se o valor pesou, me fala que vejo uma condição especial para você. {{link}}',
    value: 'Oi, {{primeiro_nome}}! Passando para saber se deu para ver a proposta. A instalação tem garantia e posso te mandar fotos de trabalhos parecidos, se ajudar na decisão. {{link}}',
    expiring: 'Oi, {{primeiro_nome}}! Sua proposta vence {{quando_vence}} ({{validade}}). Quer que eu já reserve uma data na agenda para você? {{link}}',
    expired: 'Oi, {{primeiro_nome}}! Sua proposta venceu, mas consigo segurar os valores por mais alguns dias. Quer que eu atualize para você?',
};

export const FOLLOW_UP_MESSAGE_TAGS = [
    { tag: 'primeiro_nome', label: 'Primeiro nome' },
    { tag: 'nome_cliente', label: 'Nome completo' },
    { tag: 'link', label: 'Link da proposta' },
    { tag: 'valor', label: 'Valor' },
    { tag: 'validade', label: 'Data de validade' },
    { tag: 'quando_vence', label: 'Quando vence' },
    { tag: 'aberturas', label: 'Vezes que abriu' },
] as const;

export type FollowUpTemplates = Partial<Record<FollowUpTemplateStep, string>>;

const TAG_PATTERN = /{{\s*([^{}]+?)\s*}}/g;
const KNOWN_TAGS = new Set<string>(FOLLOW_UP_MESSAGE_TAGS.map(item => item.tag));

export const findUnknownFollowUpTags = (template: string) =>
    [...new Set([...template.matchAll(TAG_PATTERN)].map(match => match[1].trim()).filter(tag => !KNOWN_TAGS.has(tag)))];

export const LOST_REASONS = [
    { id: 'price', label: 'Preço' },
    { id: 'trust', label: 'Confiança' },
    { id: 'timing', label: 'Prazo ou momento' },
    { id: 'competitor', label: 'Fechou com outro' },
    { id: 'gave_up', label: 'Desistiu' },
    { id: 'no_response', label: 'Sem resposta' },
] as const;

export const lostReasonLabel = (reason?: string | null) =>
    LOST_REASONS.find(item => item.id === reason)?.label ?? 'Outro motivo';

const STEP_LABELS: Record<FollowUpStep, string> = {
    reply: 'responder o cliente',
    expiring: 'aviso de vencimento',
    hot: 'dúvida ou condição',
    not_opened: 'confirmar se recebeu',
    value: 'reforço de valor',
    expired: 'renovar proposta',
    close: 'encerramento',
};
export const followUpStepLabel = (step?: string | null) => STEP_LABELS[step as FollowUpStep] ?? 'contato';

// Filtros da lista, na ordem de prioridade.
export const FOLLOW_UP_FILTERS: Array<{ step: FollowUpStep; label: string }> = [
    { step: 'reply', label: 'Responderam' },
    { step: 'expiring', label: 'Vencendo' },
    { step: 'hot', label: 'Interessados' },
    { step: 'not_opened', label: 'Não abriram' },
    { step: 'value', label: 'Reforço' },
    { step: 'expired', label: 'Vencidas' },
    { step: 'close', label: 'Sem retorno' },
];

// Vencidas há mais de 30 dias saem de "Hoje": viram uma limpeza (encerrar como perdidas).
export const STALE_AFTER_DAYS = 30;

export interface FollowUpItem {
    portal: CompanyProposalPortal;
    step: FollowUpStep;
    priority: number;
    title: string;
    hint: string;
    message: string | null;
    // Quando vale a pena agir (antes disso a proposta fica em "Aguardando").
    dueAt: number;
    due: boolean;
}

const DAY = 86_400_000;

const time = (value?: string | null) => (value ? new Date(value).getTime() : 0);

// Último contato da empresa: acompanhamento registrado ou mensagem na conversa do link.
export const lastFollowUpContactAt = (portal: CompanyProposalPortal) => Math.max(
    0,
    ...(portal.followUps || []).filter(event => event.kind === 'contact').map(event => time(event.created_at)),
    ...portal.messages.filter(message => message.sender_type === 'company').map(message => time(message.created_at)),
);

const whenLabel = (target: number, now: number) => {
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(target).setHours(0, 0, 0, 0) - today.getTime()) / DAY);
    return days <= 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`;
};

const timesLabel = (count: number) => (count === 1 ? '1 vez' : `${count} vezes`);

export const portalTotal = (portal: CompanyProposalPortal) =>
    portal.proposals.reduce((sum, proposal) => sum + (proposal.conditionFinalValue ?? proposal.total), 0);

export const followUpTagValues = (portal: CompanyProposalPortal, now = Date.now()): Record<string, string> => {
    const expires = time(portal.expiresAt);
    return {
        primeiro_nome: portal.clientName.trim().split(/\s+/)[0] || '',
        nome_cliente: portal.clientName.trim(),
        link: buildProposalPortalUrl(portal.token, portal.clientName),
        valor: portalTotal(portal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        validade: new Date(expires).toLocaleDateString('pt-BR'),
        quando_vence: whenLabel(expires, now),
        aberturas: timesLabel(portal.viewCount),
    };
};

export const fillFollowUpMessage = (template: string, values: Record<string, string>) =>
    template.replace(TAG_PATTERN, (match, raw: string) => {
        const tag = raw.trim();
        return KNOWN_TAGS.has(tag) ? (values[tag] ?? '') : match;
    });

const isTemplateStep = (step: FollowUpStep): step is FollowUpTemplateStep =>
    FOLLOW_UP_TEMPLATE_STEPS.some(item => item.step === step);

export const buildFollowUpMessage = (
    step: FollowUpStep,
    portal: CompanyProposalPortal,
    now = Date.now(),
    templates: FollowUpTemplates = {},
): string | null => {
    if (!isTemplateStep(step)) return null;
    const template = templates[step]?.trim() ? templates[step]! : DEFAULT_FOLLOW_UP_TEMPLATES[step];
    return fillFollowUpMessage(template, followUpTagValues(portal, now));
};

/** Próximo passo do link (com a data em que vale agir), ou null quando não há mais o que fazer. */
export const getFollowUpItem = (portal: CompanyProposalPortal, now = Date.now(), templates: FollowUpTemplates = {}): FollowUpItem | null => {
    if (['approved', 'rejected', 'revoked'].includes(portal.status) || portal.lostAt) return null;

    const make = (step: FollowUpStep, priority: number, title: string, hint: string, dueAt: number): FollowUpItem => ({
        portal, step, priority, title, hint, dueAt, due: dueAt <= now,
        message: buildFollowUpMessage(step, portal, now, templates),
    });

    const lastMessage = portal.messages[portal.messages.length - 1];
    if (lastMessage?.sender_type === 'client' && ['message', 'negotiation'].includes(lastMessage.kind)) {
        return make('reply', 0,
            lastMessage.kind === 'negotiation' ? 'Mandou uma contraproposta' : 'Respondeu e aguarda você',
            'Responda na conversa enquanto o interesse está quente.', time(lastMessage.created_at));
    }

    const lastContact = lastFollowUpContactAt(portal);
    const lastTouch = Math.max(time(portal.createdAt), lastContact);
    const expires = time(portal.expiresAt);
    const views = portal.viewCount;

    if (portal.status === 'expired' || expires <= now) {
        if (lastContact < expires) {
            return make('expired', 4, 'Venceu sem resposta',
                'Ofereça renovar os valores. Se ele topar, use "Criar link" no Histórico para atualizar o mesmo link.', expires);
        }
        return make('close', 5, 'Sem retorno depois do vencimento',
            'Marque como perdida para tirar da lista (motivo: sem resposta).', lastTouch + 3 * DAY);
    }

    if (expires - now <= 2 * DAY) {
        return make('expiring', 1, `Vence ${whenLabel(expires, now)}`,
            views > 0
                ? 'Avise do prazo. Se ele estiver em dúvida pelo valor, ofereça uma condição com data para acabar.'
                : 'Avise do prazo e confirme se ele recebeu o link.',
            Math.max(expires - 2 * DAY, lastContact + DAY));
    }

    // Os outros passos também são antecipados pelo aviso de vencimento.
    const beforeExpiry = (dueAt: number) => Math.min(dueAt, expires - 2 * DAY);

    if (views === 0) {
        return make('not_opened', 3, 'Ainda não abriu o link',
            'Confirme se ele recebeu. Se não responder, ligue: pode ter ido para outro número.', beforeExpiry(lastTouch + DAY));
    }

    if (views >= 3) {
        const newInterest = time(portal.lastViewedAt) > lastContact;
        return make('hot', 2, `Abriu ${timesLabel(views)} e não respondeu`,
            'Tem interesse. Pergunte se ficou dúvida; se for o preço, ofereça uma condição com prazo (ou mais garantia).',
            beforeExpiry(newInterest ? time(portal.lastViewedAt) : lastTouch + 2 * DAY));
    }

    return make('value', 3, `Abriu ${timesLabel(views)} e não respondeu`,
        'Reforce o valor: garantia, fotos de trabalhos parecidos e avaliações de clientes.', beforeExpiry(lastTouch + 2 * DAY));
};

// "Abriu agora": o link foi aberto nos últimos minutos.
export const OPENED_RECENTLY_MINUTES = 10;
export const openedRecently = (portal: CompanyProposalPortal, now = Date.now()) => {
    const elapsed = now - time(portal.lastViewedAt);
    return Boolean(portal.lastViewedAt) && elapsed >= 0 && elapsed <= OPENED_RECENTLY_MINUTES * 60_000;
};

const isStale = (item: FollowUpItem, now: number) =>
    (item.step === 'expired' || item.step === 'close') && now - time(item.portal.expiresAt) > STALE_AFTER_DAYS * DAY;

export const buildFollowUpQueue = (portals: CompanyProposalPortal[], now = Date.now(), templates: FollowUpTemplates = {}) => {
    const due: FollowUpItem[] = [];
    const waiting: FollowUpItem[] = [];
    const stale: FollowUpItem[] = [];
    for (const portal of portals) {
        const item = getFollowUpItem(portal, now, templates);
        if (!item) continue;
        (!item.due ? waiting : isStale(item, now) ? stale : due).push(item);
    }
    // Quem acabou de abrir o link vem logo depois de quem respondeu: é a melhor hora de chamar.
    const rank = (item: FollowUpItem) => (item.step !== 'reply' && openedRecently(item.portal, now) ? 0.5 : item.priority);
    // Mesma prioridade: o mais perto de vencer (ou o que venceu por último) primeiro.
    due.sort((a, b) => rank(a) - rank(b) || Math.abs(time(a.portal.expiresAt) - now) - Math.abs(time(b.portal.expiresAt) - now));
    waiting.sort((a, b) => a.dueAt - b.dueAt);
    stale.sort((a, b) => time(b.portal.expiresAt) - time(a.portal.expiresAt));
    return { due, waiting, stale };
};

// ---- Lista única por cliente ----

export interface ClientProposalGroup {
    clientId: number;
    // Link principal: o de atividade mais recente (é por ele que o cliente está falando).
    primary: CompanyProposalPortal;
    // Links anteriores do mesmo cliente (criados antes de reaproveitar o mesmo link).
    others: CompanyProposalPortal[];
    unreadCount: number;
}

const portalActivityAt = (portal: CompanyProposalPortal) =>
    Math.max(time(portal.lastActivityAt), time(portal.createdAt), time(portal.lastViewedAt));

export const groupPortalsByClient = (portals: CompanyProposalPortal[]): ClientProposalGroup[] => {
    const byClient = new Map<number, CompanyProposalPortal[]>();
    for (const portal of portals) byClient.set(portal.clientId, [...(byClient.get(portal.clientId) || []), portal]);
    return [...byClient.values()]
        .map(list => {
            const [primary, ...others] = [...list].sort((a, b) => portalActivityAt(b) - portalActivityAt(a));
            return { clientId: primary.clientId, primary, others, unreadCount: list.reduce((sum, portal) => sum + portal.unreadCount, 0) };
        })
        .sort((a, b) => portalActivityAt(b.primary) - portalActivityAt(a.primary));
};

export type ClosedKind = 'approved' | 'rejected' | 'lost';

// Aprovada vale mais que "perdida": o cliente pode aprovar depois de marcada como perdida.
export const closedKind = (portal: CompanyProposalPortal): ClosedKind | null =>
    portal.status === 'approved' ? 'approved' : portal.lostAt ? 'lost' : portal.status === 'rejected' ? 'rejected' : null;

export const CLOSED_FILTERS: Array<{ kind: ClosedKind; label: string }> = [
    { kind: 'approved', label: 'Aprovadas' },
    { kind: 'rejected', label: 'Recusadas' },
    { kind: 'lost', label: 'Perdidas' },
];

const decisionAt = (portal: CompanyProposalPortal, kind: ClosedKind) => {
    if (kind === 'lost') return portal.lostAt || portal.lastActivityAt;
    const decision = [...portal.messages].reverse().find(message => message.kind === kind);
    return decision?.created_at || portal.lastActivityAt;
};

export const describeClosed = (portal: CompanyProposalPortal) => {
    const kind = closedKind(portal);
    if (!kind) return null;
    const when = new Date(decisionAt(portal, kind)).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    if (kind === 'approved') return { kind, label: `Aprovada em ${when}` };
    if (kind === 'rejected') return { kind, label: `Recusada em ${when}` };
    return { kind, label: `Perdida: ${lostReasonLabel(portal.lostReason).toLowerCase()} · ${when}` };
};

// Resumo em reais do topo da Central.
export const summarizeProposalResults = (portals: CompanyProposalPortal[], now = Date.now(), decidedDays = 90) => {
    const groups = groupPortalsByClient(portals);
    const { due, waiting } = buildFollowUpQueue(groups.map(group => group.primary), now);
    const open = [...due, ...waiting];

    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    let approvedValue = 0;
    let approvedCount = 0;
    for (const portal of portals) {
        if (portal.status !== 'approved') continue;
        const approval = [...portal.messages].reverse().find(message => message.kind === 'approved');
        if (time(approval?.created_at || portal.lastActivityAt) < monthStart.getTime()) continue;
        const chosen = portal.proposals.find(proposal => proposal.id === approval?.saved_pdf_id);
        approvedValue += chosen ? (chosen.conditionFinalValue ?? chosen.total) : portalTotal(portal);
        approvedCount += 1;
    }

    // Fechamento: dos clientes decididos no período (aprovou, recusou ou perdida), quantos aprovaram.
    const decided = groups.filter(group => {
        const kind = closedKind(group.primary);
        return kind !== null && now - time(decisionAt(group.primary, kind)) <= decidedDays * DAY;
    });
    const won = decided.filter(group => closedKind(group.primary) === 'approved').length;

    return {
        openValue: open.reduce((sum, item) => sum + portalTotal(item.portal), 0),
        openCount: open.length,
        approvedValue,
        approvedCount,
        decidedCount: decided.length,
        wonCount: won,
        closeRate: decided.length > 0 ? won / decided.length : null,
    };
};

export const lastClientMessage = (portal: CompanyProposalPortal) =>
    [...portal.messages].reverse().find(message => message.sender_type === 'client' && message.body?.trim()) || null;

export const describeNextContact = (dueAt: number, now = Date.now()) => {
    const label = whenLabel(dueAt, now);
    return label === 'hoje' ? 'mais tarde hoje' : label === 'amanhã' ? 'amanhã' : `${label} (${new Date(dueAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`;
};

export interface FollowUpTimelineEntry {
    at: string;
    label: string;
    tone: 'neutral' | 'good' | 'warn' | 'bad';
}

/** Linha do tempo do link: envio, aberturas, respostas, contatos e fechamento. */
export const buildFollowUpTimeline = (portal: CompanyProposalPortal, now = Date.now()): FollowUpTimelineEntry[] => {
    const entries: FollowUpTimelineEntry[] = [];
    if (portal.createdAt) entries.push({ at: portal.createdAt, label: 'Link enviado', tone: 'neutral' });
    if (portal.firstViewedAt) entries.push({ at: portal.firstViewedAt, label: 'Abriu pela primeira vez', tone: 'good' });
    if (portal.lastViewedAt && portal.viewCount > 1 && portal.lastViewedAt !== portal.firstViewedAt) {
        entries.push({ at: portal.lastViewedAt, label: `Última abertura (${timesLabel(portal.viewCount)} no total)`, tone: 'good' });
    }
    for (const message of portal.messages) {
        const client = message.sender_type === 'client';
        const label = message.kind === 'approved' ? 'Aprovou a proposta'
            : message.kind === 'rejected' ? 'Recusou a proposta'
                : message.kind === 'negotiation' ? 'Mandou uma contraproposta'
                    : message.kind === 'condition_extended' ? 'Condição prorrogada'
                        : message.kind === 'condition_updated' ? 'Condição atualizada'
                            : client ? 'Cliente mandou mensagem' : 'Você respondeu';
        const tone = message.kind === 'approved' ? 'good' : message.kind === 'rejected' ? 'bad' : message.kind === 'negotiation' ? 'warn' : 'neutral';
        entries.push({ at: message.created_at, label, tone });
    }
    for (const event of portal.followUps || []) {
        if (event.kind === 'contact') {
            entries.push({ at: event.created_at, label: `${event.channel === 'call' ? 'Você ligou' : event.channel === 'whatsapp' ? 'Você mandou mensagem' : 'Você falou com o cliente'} (${followUpStepLabel(event.step)})`, tone: 'neutral' });
        } else if (event.kind === 'lost') {
            entries.push({ at: event.created_at, label: `Marcada como perdida: ${lostReasonLabel(event.reason)}`, tone: 'bad' });
        } else {
            entries.push({ at: event.created_at, label: 'Reaberta', tone: 'neutral' });
        }
    }
    if (time(portal.expiresAt) <= now) entries.push({ at: portal.expiresAt, label: 'Prazo venceu', tone: 'warn' });
    return entries.sort((a, b) => time(a.at) - time(b.at));
};

/** Perdidas nos últimos dias e o motivo mais comum (para aprender com elas). */
export const summarizeLostProposals = (portals: CompanyProposalPortal[], now = Date.now(), days = 30) => {
    const recent = portals.filter(portal => portal.lostAt && now - time(portal.lostAt) <= days * DAY);
    const counts = new Map<string, number>();
    recent.forEach(portal => counts.set(portal.lostReason || 'other', (counts.get(portal.lostReason || 'other') || 0) + 1));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return { count: recent.length, topReason: top ? lostReasonLabel(top[0]) : null };
};
