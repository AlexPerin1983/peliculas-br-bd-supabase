import { buildProposalPortalUrl, type CompanyProposalPortal } from './proposalPortal';

// "Para acompanhar hoje": o que o cliente fez no link decide o próximo passo.
// - não abriu: a mensagem se perdeu → confirmar se recebeu (desconto não adianta);
// - abriu 3x ou mais: tem interesse, costuma ser preço ou dúvida → hora da oferta;
// - abriu 1–2x: reforçar o valor (garantia, fotos, avaliações);
// - vencendo/vencida: avisar do prazo, renovar ou encerrar como perdida.

export type FollowUpStep = 'reply' | 'expiring' | 'hot' | 'not_opened' | 'value' | 'expired' | 'close';

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

export interface FollowUpItem {
    portal: CompanyProposalPortal;
    step: FollowUpStep;
    priority: number;
    title: string;
    hint: string;
    message: string | null;
}

const DAY = 86_400_000;

const time = (value?: string | null) => (value ? new Date(value).getTime() : 0);

// Último contato da empresa: acompanhamento registrado ou mensagem na conversa do link.
export const lastFollowUpContactAt = (portal: CompanyProposalPortal) => Math.max(
    0,
    ...(portal.followUps || []).filter(event => event.kind === 'contact').map(event => time(event.created_at)),
    ...portal.messages.filter(message => message.sender_type === 'company').map(message => time(message.created_at)),
);

const whenLabel = (expiresAt: number, now: number) => {
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(expiresAt).setHours(0, 0, 0, 0) - today.getTime()) / DAY);
    return days <= 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`;
};

const timesLabel = (count: number) => (count === 1 ? '1 vez' : `${count} vezes`);

export const buildFollowUpMessage = (step: FollowUpStep, portal: CompanyProposalPortal, now = Date.now()): string | null => {
    const first = portal.clientName.trim().split(/\s+/)[0] || 'tudo bem';
    const url = buildProposalPortalUrl(portal.token, portal.clientName);
    const expires = time(portal.expiresAt);
    switch (step) {
        case 'not_opened':
            return `Oi, ${first}! Tudo bem? Te enviei a proposta das películas, conseguiu abrir? Segue o link de novo: ${url}`;
        case 'hot':
            return `Oi, ${first}! Vi que você olhou a proposta com calma. Ficou alguma dúvida sobre as películas ou a instalação? Se o valor pesou, me fala que vejo uma condição especial para você. ${url}`;
        case 'value':
            return `Oi, ${first}! Passando para saber se deu para ver a proposta. A instalação tem garantia e posso te mandar fotos de trabalhos parecidos, se ajudar na decisão. ${url}`;
        case 'expiring':
            return `Oi, ${first}! Sua proposta vence ${whenLabel(expires, now)} (${new Date(expires).toLocaleDateString('pt-BR')}). Quer que eu já reserve uma data na agenda para você? ${url}`;
        case 'expired':
            return `Oi, ${first}! Sua proposta venceu, mas consigo segurar os valores por mais alguns dias. Quer que eu atualize para você?`;
        default:
            return null;
    }
};

/** Próximo passo de um link, ou null quando não há o que fazer agora (ou nunca mais). */
export const getFollowUpItem = (portal: CompanyProposalPortal, now = Date.now()): FollowUpItem | null | 'waiting' => {
    if (['approved', 'rejected', 'revoked'].includes(portal.status) || portal.lostAt) return null;

    const make = (step: FollowUpStep, priority: number, title: string, hint: string): FollowUpItem => ({
        portal, step, priority, title, hint, message: buildFollowUpMessage(step, portal, now),
    });

    const lastMessage = portal.messages[portal.messages.length - 1];
    if (lastMessage?.sender_type === 'client' && ['message', 'negotiation'].includes(lastMessage.kind)) {
        return make('reply', 0,
            lastMessage.kind === 'negotiation' ? 'Mandou uma contraproposta' : 'Respondeu e aguarda você',
            'Responda na conversa abaixo enquanto o interesse está quente.');
    }

    const lastContact = lastFollowUpContactAt(portal);
    const lastTouch = Math.max(time(portal.createdAt), lastContact);
    const sinceTouch = now - lastTouch;
    const expires = time(portal.expiresAt);
    const views = portal.viewCount;

    if (portal.status === 'expired' || expires <= now) {
        if (lastContact < expires) {
            return make('expired', 4, 'Venceu sem resposta',
                'Ofereça renovar os valores. Se ele topar, use "Criar link" no Histórico para atualizar o mesmo link.');
        }
        if (sinceTouch >= 3 * DAY) {
            return make('close', 5, 'Sem retorno depois do vencimento',
                'Marque como perdida para tirar da lista (motivo: sem resposta).');
        }
        return 'waiting';
    }

    if (expires - now <= 2 * DAY && now - lastContact >= DAY) {
        return make('expiring', 1, `Vence ${whenLabel(expires, now)}`,
            views > 0
                ? 'Avise do prazo. Se ele estiver em dúvida pelo valor, ofereça uma condição com data para acabar.'
                : 'Avise do prazo e confirme se ele recebeu o link.');
    }

    if (views === 0) {
        if (sinceTouch >= DAY) {
            return make('not_opened', 3, 'Ainda não abriu o link',
                'Confirme se ele recebeu. Se não responder, ligue: pode ter ido para outro número.');
        }
        return 'waiting';
    }

    if (views >= 3) {
        if (time(portal.lastViewedAt) > lastContact || sinceTouch >= 2 * DAY) {
            return make('hot', 2, `Abriu ${timesLabel(views)} e não respondeu`,
                'Tem interesse. Pergunte se ficou dúvida; se for o preço, ofereça uma condição com prazo (ou mais garantia).');
        }
        return 'waiting';
    }

    if (sinceTouch >= 2 * DAY) {
        return make('value', 3, `Abriu ${timesLabel(views)} e não respondeu`,
            'Reforce o valor: garantia, fotos de trabalhos parecidos e avaliações de clientes.');
    }
    return 'waiting';
};

export const buildFollowUpQueue = (portals: CompanyProposalPortal[], now = Date.now()) => {
    const due: FollowUpItem[] = [];
    let waiting = 0;
    for (const portal of portals) {
        const item = getFollowUpItem(portal, now);
        if (item === 'waiting') waiting += 1;
        else if (item) due.push(item);
    }
    due.sort((a, b) => a.priority - b.priority || time(a.portal.expiresAt) - time(b.portal.expiresAt));
    return { due, waiting };
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
