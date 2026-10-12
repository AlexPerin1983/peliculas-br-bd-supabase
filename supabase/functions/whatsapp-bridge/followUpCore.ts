// Núcleo do acompanhamento de propostas para o WhatsApp conectado: a mesma regra do
// "Para acompanhar hoje" do app (src/lib/proposalFollowUpQueue.ts), sem dependências
// de navegador, para rodar na função whatsapp-bridge (Deno) e nos testes (Vitest).
// O teste whatsappFollowUpCore.test.ts compara os dois: com os tempos padrão, o passo,
// a data e a mensagem precisam ser iguais aos do app.
// A diferença é que aqui os tempos são ajustáveis pela empresa (CadenceSettings).

export type FollowUpStep = 'reply' | 'expiring' | 'hot' | 'not_opened' | 'value' | 'expired' | 'close';
export type FollowUpTemplateStep = 'not_opened' | 'hot' | 'value' | 'expiring' | 'expired';
export type FollowUpTemplates = Partial<Record<FollowUpTemplateStep, string>>;

export interface CorePortalMessage { sender_type: string; kind: string; created_at: string; body?: string | null }
export interface CoreFollowUpEvent { kind: string; step?: string | null; channel?: string | null; created_at: string; remind_at?: string | null }
export interface CorePortal {
    id: string;
    token: string;
    clientId: number;
    clientName: string;
    status: string;
    expiresAt: string;
    createdAt?: string;
    viewCount: number;
    lastViewedAt?: string | null;
    lostAt?: string | null;
    messages: CorePortalMessage[];
    followUps?: CoreFollowUpEvent[];
    proposals: Array<{ id: number; name: string; total: number; conditionFinalValue?: number | null }>;
}

// Tempos em minutos. Os padrões são os do app.
export interface CadenceSettings {
    notOpenedMin: number;      // não abriu: depois do envio ou do último contato
    valueMin: number;          // abriu 1–2 vezes e não respondeu
    hotMin: number;            // abriu 3+ vezes: depois da última abertura
    expiringWindowMin: number; // aviso de vencimento: quanto antes de vencer
    closeMin: number;          // despedida: depois do último contato, já vencida
}
const DAY_MIN = 24 * 60;
export const DEFAULT_CADENCE: CadenceSettings = { notOpenedMin: DAY_MIN, valueMin: 2 * DAY_MIN, hotMin: 0, expiringWindowMin: 2 * DAY_MIN, closeMin: 3 * DAY_MIN };

const clampMinutes = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 0), 30 * DAY_MIN) : fallback;
export const normalizeCadence = (value: unknown): CadenceSettings => {
    const input = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    return {
        notOpenedMin: clampMinutes(input.notOpenedMin, DEFAULT_CADENCE.notOpenedMin),
        valueMin: clampMinutes(input.valueMin, DEFAULT_CADENCE.valueMin),
        hotMin: clampMinutes(input.hotMin, DEFAULT_CADENCE.hotMin),
        expiringWindowMin: clampMinutes(input.expiringWindowMin, DEFAULT_CADENCE.expiringWindowMin),
        closeMin: clampMinutes(input.closeMin, DEFAULT_CADENCE.closeMin),
    };
};

// Textos padrão: a primeira variação de cada situação do app (FOLLOW_UP_VARIANTS).
export const DEFAULT_FOLLOW_UP_TEMPLATES: Record<FollowUpTemplateStep, string> = {
    not_opened: 'Oi, {{primeiro_nome}}! Conseguiu ver a proposta das películas que te mandei?\nDeixo o link aqui de novo, caso a mensagem tenha se perdido:\n{{link}}',
    hot: 'Oi, {{primeiro_nome}}! Ficou alguma dúvida na proposta das películas?\nImagino que você esteja avaliando com calma, e faz todo sentido.\nMe conta: o que pesa mais pra você agora — o valor, o tipo de película ou a data da instalação?\n{{link}}',
    value: 'Oi, {{primeiro_nome}}! O que achou da proposta das películas?\nSe ajudar na decisão, te mando fotos de trabalhos parecidos com o seu 📸\n{{link}}',
    expiring: 'Oi, {{primeiro_nome}}! Passando pra lembrar que a sua proposta vence {{quando_vence}} ({{validade}}).\nDepois disso não consigo garantir os mesmos valores.\nQuer que eu já reserve a sua data na agenda?\n{{link}}',
    expired: 'Oi, {{primeiro_nome}}! Você desistiu das películas ou só ficou corrido por aí? 🙂',
};
export const FAREWELL_TEMPLATE = 'Oi, {{primeiro_nome}}! Como não tive retorno, vou entender que as películas não são prioridade agora e vou encerrar a sua proposta por aqui.\nSe mudar de ideia, é só me chamar que eu atualizo pra você 🙂';

const KNOWN_TAGS = new Set(['primeiro_nome', 'nome_cliente', 'link', 'valor', 'validade', 'quando_vence', 'aberturas']);
const TAG_PATTERN = /{{\s*([^{}]+?)\s*}}/g;
const DAY = 86_400_000;
const MINUTE = 60_000;
const time = (value?: string | null) => (value ? new Date(value).getTime() : 0);

export const buildProposalClientSlug = (clientName = 'cliente') => {
    const firstName = clientName.trim().split(/\s+/)[0] || 'cliente';
    return firstName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cliente';
};
export const buildPortalUrl = (origin: string, accessKey: string, clientName?: string) => {
    const url = new URL(origin);
    if (clientName) url.pathname = `/p/${buildProposalClientSlug(clientName)}/${encodeURIComponent(accessKey)}`;
    else { url.pathname = '/proposta'; url.searchParams.set('token', accessKey); }
    return url.toString();
};

export const lastFollowUpContactAt = (portal: CorePortal) => Math.max(
    0,
    ...(portal.followUps || []).filter(event => event.kind === 'contact').map(event => time(event.created_at)),
    ...portal.messages.filter(message => message.sender_type === 'company').map(message => time(message.created_at)),
);

// Dia do calendário no fuso da empresa (no app, o fuso do navegador). A função roda
// em UTC: sem o fuso, "amanhã" e a validade mudariam de dia à noite.
const calendarDay = (at: number, timeZone?: string) => {
    if (!timeZone) return new Date(at).setHours(0, 0, 0, 0) / DAY;
    const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(at).split('-').map(Number);
    return Date.UTC(year, month - 1, day) / DAY;
};
const whenLabel = (target: number, now: number, timeZone?: string) => {
    const days = Math.round(calendarDay(target, timeZone) - calendarDay(now, timeZone));
    return days <= 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`;
};
const timesLabel = (count: number) => (count === 1 ? '1 vez' : `${count} vezes`);

export const portalTotal = (portal: CorePortal) =>
    portal.proposals.reduce((sum, proposal) => sum + (proposal.conditionFinalValue ?? proposal.total), 0);

export const followUpTagValues = (portal: CorePortal, now: number, origin: string, timeZone?: string): Record<string, string> => {
    const expires = time(portal.expiresAt);
    return {
        primeiro_nome: portal.clientName.trim().split(/\s+/)[0] || '',
        nome_cliente: portal.clientName.trim(),
        link: buildPortalUrl(origin, portal.token, portal.clientName),
        valor: portalTotal(portal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        validade: new Date(expires).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone }),
        quando_vence: whenLabel(expires, now, timeZone),
        aberturas: timesLabel(portal.viewCount),
    };
};

export const fillFollowUpMessage = (template: string, values: Record<string, string>) =>
    template.replace(TAG_PATTERN, (match, raw: string) => {
        const tag = raw.trim();
        return KNOWN_TAGS.has(tag) ? (values[tag] ?? '') : match;
    });

const TEMPLATE_STEPS: FollowUpTemplateStep[] = ['not_opened', 'hot', 'value', 'expiring', 'expired'];
export const buildFollowUpMessage = (step: FollowUpStep, portal: CorePortal, now: number, origin: string, templates: FollowUpTemplates = {}, timeZone?: string): string | null => {
    if (step === 'close') return fillFollowUpMessage(FAREWELL_TEMPLATE, followUpTagValues(portal, now, origin, timeZone));
    if (!TEMPLATE_STEPS.includes(step as FollowUpTemplateStep)) return null;
    const key = step as FollowUpTemplateStep;
    const template = templates[key]?.trim() ? templates[key]! : DEFAULT_FOLLOW_UP_TEMPLATES[key];
    return fillFollowUpMessage(template, followUpTagValues(portal, now, origin, timeZone));
};

export const activeSnoozeUntil = (portal: CorePortal, now: number): number | undefined => {
    const lastAction = (portal.followUps || [])
        .filter(event => event.kind === 'contact' || event.kind === 'snooze')
        .sort((a, b) => time(b.created_at) - time(a.created_at))[0];
    if (lastAction?.kind !== 'snooze' || !lastAction.remind_at) return undefined;
    const remindAt = time(lastAction.remind_at);
    if (remindAt <= now) return undefined;
    const clientWroteAfter = portal.messages.some(message => message.sender_type === 'client' && time(message.created_at) > time(lastAction.created_at));
    return clientWroteAfter ? undefined : remindAt;
};

export interface CoreFollowUpItem {
    step: FollowUpStep;
    priority: number;
    title: string;
    hint: string;
    message: string | null;
    dueAt: number;
    due: boolean;
    snoozedUntil?: number;
}

/** Próximo passo do link, com a data em que vale agir; null quando não há o que fazer. */
export const getFollowUpItem = (
    portal: CorePortal,
    now: number,
    options: { origin: string; templates?: FollowUpTemplates; cadence?: CadenceSettings; timeZone?: string },
): CoreFollowUpItem | null => {
    if (['approved', 'rejected', 'revoked'].includes(portal.status) || portal.lostAt) return null;
    const cadence = options.cadence ?? DEFAULT_CADENCE;
    const lastMessage = portal.messages[portal.messages.length - 1];
    const snoozedUntil = activeSnoozeUntil(portal, now);
    const make = (step: FollowUpStep, priority: number, title: string, hint: string, computedDueAt: number): CoreFollowUpItem => {
        const dueAt = snoozedUntil ? Math.max(computedDueAt, snoozedUntil) : computedDueAt;
        return { step, priority, title, hint, dueAt, due: dueAt <= now, snoozedUntil, message: buildFollowUpMessage(step, portal, now, options.origin, options.templates, options.timeZone) };
    };

    if (lastMessage?.sender_type === 'client' && ['message', 'negotiation'].includes(lastMessage.kind)) {
        return make('reply', 0,
            lastMessage.kind === 'negotiation' ? 'Mandou uma contraproposta' : 'Respondeu e aguarda você',
            'Responda na conversa enquanto o interesse está quente.', time(lastMessage.created_at));
    }

    const lastContact = lastFollowUpContactAt(portal);
    const lastTouch = Math.max(time(portal.createdAt), lastContact);
    const expires = time(portal.expiresAt);
    const views = portal.viewCount;
    const expiringWindow = cadence.expiringWindowMin * MINUTE;

    if (portal.status === 'expired' || expires <= now) {
        if (lastContact < expires) {
            return make('expired', 4, 'Venceu sem resposta',
                'Ofereça renovar os valores. Se ele topar, use "Criar link" no Histórico para atualizar o mesmo link.', expires);
        }
        return make('close', 5, 'Sem retorno depois do vencimento',
            'Mande a mensagem de despedida. Se não responder, marque como perdida (motivo: sem resposta).', lastTouch + cadence.closeMin * MINUTE);
    }

    if (expires - now <= expiringWindow) {
        return make('expiring', 1, `Vence ${whenLabel(expires, now, options.timeZone)}`,
            views > 0
                ? 'Avise do prazo. Se ele estiver em dúvida pelo valor, ofereça uma condição com data para acabar.'
                : 'Avise do prazo e confirme se ele recebeu o link.',
            Math.max(expires - expiringWindow, lastContact + DAY));
    }

    const beforeExpiry = (dueAt: number) => Math.min(dueAt, expires - expiringWindow);

    if (views === 0) {
        return make('not_opened', 3, 'Ainda não abriu o link',
            'Confirme se ele recebeu. Se não responder, ligue: pode ter ido para outro número.', beforeExpiry(lastTouch + cadence.notOpenedMin * MINUTE));
    }

    if (views >= 3) {
        const newInterest = time(portal.lastViewedAt) > lastContact;
        return make('hot', 2, `Abriu ${timesLabel(views)} e não respondeu`,
            'Tem interesse. Pergunte se ficou dúvida; se for o preço, ofereça uma condição com prazo (ou mais garantia).',
            beforeExpiry(newInterest ? time(portal.lastViewedAt) + cadence.hotMin * MINUTE : lastTouch + cadence.valueMin * MINUTE));
    }

    return make('value', 3, `Abriu ${timesLabel(views)} e não respondeu`,
        'Reforce o valor: garantia, fotos de trabalhos parecidos e avaliações de clientes.', beforeExpiry(lastTouch + cadence.valueMin * MINUTE));
};

// ---- Quadro (colunas do funil) ----

export type BoardColumn = 'sent' | 'no_reply' | 'replied' | 'deadline' | 'won';

// Aprovadas aparecem em "Fechados" por um tempo; vencidas há muito tempo saem do quadro.
const WON_VISIBLE_DAYS = 30;
const STALE_AFTER_DAYS = 30;

export const boardColumn = (portal: CorePortal, item: CoreFollowUpItem | null, now: number): BoardColumn | null => {
    if (portal.status === 'approved') {
        const approval = [...portal.messages].reverse().find(message => message.kind === 'approved');
        const at = time(approval?.created_at) || time(portal.createdAt);
        return now - at <= WON_VISIBLE_DAYS * DAY ? 'won' : null;
    }
    if (!item) return null;
    if (item.step === 'reply') return 'replied';
    if (item.step === 'expiring' || item.step === 'expired' || item.step === 'close') {
        return (item.step !== 'expiring' && now - time(portal.expiresAt) > STALE_AFTER_DAYS * DAY) ? null : 'deadline';
    }
    return item.due ? 'no_reply' : 'sent';
};

// Contatos já feitos pelo WhatsApp conectado neste link (para o limite de lembretes).
export const connectedRemindersSent = (portal: CorePortal) =>
    (portal.followUps || []).filter(event => event.kind === 'contact' && event.channel === 'whatsapp').length;
