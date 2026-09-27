import type { Agendamento, Client, SavedPDF } from '../../types';
import type { CompanyProposalPortal } from './proposalPortal';

// Visão 360 do cliente: estágio, números, próximo passo e linha do tempo,
// a partir dos orçamentos, serviços (agenda) e links de proposta dele.

const DAY = 86_400_000;
// Orçamento sem resposta há mais que isso deixa de contar como "em aberto".
export const OPEN_WINDOW_DAYS = 180;
// Sem nenhuma atividade há mais que isso: cliente inativo.
export const INACTIVE_AFTER_DAYS = 180;

const time = (value?: string | number | null) => {
    if (value == null || value === '') return 0;
    const parsed = typeof value === 'number' ? value : new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};

const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const firstName = (name: string) => name.trim().split(/\s+/)[0] || '';

export type ClientStage = 'new' | 'negotiating' | 'customer' | 'recurring' | 'inactive';

export const CLIENT_STAGE_LABELS: Record<ClientStage, string> = {
    new: 'Novo',
    negotiating: 'Em negociação',
    customer: 'Cliente',
    recurring: 'Recorrente',
    inactive: 'Inativo',
};

// ---- Orçamentos agrupados pela opção (cada versão salva é um PDF) ----

export interface ProposalOptionGroup {
    key: string;
    name: string;
    latest: SavedPDF;
    versions: SavedPDF[];
    // Versão aprovada (se alguma foi).
    approved: SavedPDF | null;
}

export const groupClientProposals = (pdfs: SavedPDF[]): ProposalOptionGroup[] => {
    const byOption = new Map<string, SavedPDF[]>();
    for (const pdf of pdfs) {
        const key = pdf.proposalOptionId != null ? `option-${pdf.proposalOptionId}` : `pdf-${pdf.id ?? pdf.nomeArquivo}`;
        byOption.set(key, [...(byOption.get(key) || []), pdf]);
    }
    return [...byOption.entries()]
        .map(([key, list]) => {
            const versions = [...list].sort((a, b) => time(b.date) - time(a.date));
            return {
                key,
                name: versions[0].proposalOptionName || 'Orçamento',
                latest: versions[0],
                versions,
                approved: versions.find(pdf => pdf.status === 'approved') || null,
            };
        })
        .sort((a, b) => time(b.latest.date) - time(a.latest.date));
};

const linkedPdfIds = (agendamento: Agendamento) => [
    ...(agendamento.pdfIds || []),
    ...(agendamento.pdfId != null ? [agendamento.pdfId] : []),
];

const isDoneService = (agendamento: Agendamento) => agendamento.serviceStatus === 'completed' || agendamento.serviceStatus === 'partial';

// ---- Resumo ----

export interface ClientSummary {
    groups: ProposalOptionGroup[];
    openGroups: ProposalOptionGroup[];
    closedValue: number;
    openValue: number;
    servicesDone: number;
    upcoming: Agendamento | null;
    lastActivityAt: number;
    since: number;
    stage: ClientStage;
}

export const summarizeClient = (
    client: Client,
    pdfs: SavedPDF[],
    agendamentos: Agendamento[],
    portals: CompanyProposalPortal[] = [],
    now = Date.now(),
): ClientSummary => {
    const groups = groupClientProposals(pdfs);
    const openGroups = groups.filter(group => !group.approved && now - time(group.latest.date) <= OPEN_WINDOW_DAYS * DAY);
    const doneServices = agendamentos.filter(isDoneService);
    // Serviço concluído sem orçamento vinculado entra pelo valor cobrado.
    const servicesWithoutProposal = doneServices.filter(agendamento => linkedPdfIds(agendamento).length === 0);

    const closedValue = groups.reduce((sum, group) => sum + (group.approved?.totalPreco || 0), 0)
        + servicesWithoutProposal.reduce((sum, agendamento) => sum + (agendamento.valorFinal || 0), 0);
    const openValue = openGroups.reduce((sum, group) => sum + (group.latest.totalPreco || 0), 0);

    const upcoming = [...agendamentos]
        .filter(agendamento => (agendamento.serviceStatus ?? 'scheduled') === 'scheduled' && time(agendamento.start) >= now)
        .sort((a, b) => time(a.start) - time(b.start))[0] || null;

    const activity = [
        ...pdfs.map(pdf => time(pdf.date)),
        ...agendamentos.map(agendamento => time(agendamento.start)).filter(at => at <= now),
        ...portals.map(portal => Math.max(time(portal.lastActivityAt), time(portal.lastViewedAt))),
        time(client.lastUpdated),
    ].filter(at => at > 0);
    const lastActivityAt = activity.length ? Math.max(...activity) : 0;
    const firstSeen = [
        ...pdfs.map(pdf => time(pdf.date)),
        ...agendamentos.map(agendamento => time(agendamento.start)),
        ...portals.map(portal => time(portal.createdAt)),
    ].filter(at => at > 0);
    const since = firstSeen.length ? Math.min(...firstSeen) : time(client.lastUpdated);

    const closedCount = groups.filter(group => group.approved).length + servicesWithoutProposal.length;
    const stage: ClientStage = groups.length === 0 && agendamentos.length === 0 && portals.length === 0
        ? 'new'
        : lastActivityAt && now - lastActivityAt > INACTIVE_AFTER_DAYS * DAY && !upcoming
            ? 'inactive'
            : closedCount >= 2
                ? 'recurring'
                : closedCount >= 1 || doneServices.length > 0
                    ? 'customer'
                    : 'negotiating';

    return { groups, openGroups, closedValue, openValue, servicesDone: doneServices.length, upcoming, lastActivityAt, since, stage };
};

// "Para reativar": tem telefone, nada em andamento e sem atividade há mais de 90 dias.
export const REACTIVATE_AFTER_DAYS = 90;
export const needsReactivation = (client: Client, summary: ClientSummary, now = Date.now()) =>
    Boolean(clientPhoneDigits(client))
    && summary.lastActivityAt > 0
    && now - summary.lastActivityAt > REACTIVATE_AFTER_DAYS * DAY
    && !summary.upcoming
    && summary.openGroups.length === 0;

// ---- Próximo passo ----

export type ClientNextStepAction =
    | { type: 'open_portal'; portalId: string }
    | { type: 'open_agendamento'; agendamento: Agendamento }
    | { type: 'schedule'; pdf: SavedPDF }
    | { type: 'follow_up'; pdf: SavedPDF }
    | { type: 'whatsapp'; message: string }
    | { type: 'new_proposal' };

export interface ClientNextStep {
    tone: 'blue' | 'green' | 'amber' | 'slate';
    title: string;
    detail: string;
    cta: string;
    action: ClientNextStepAction;
}

export const relativeDays = (at: number, now = Date.now()) => {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const day = new Date(at);
    day.setHours(0, 0, 0, 0);
    const days = Math.round((today.getTime() - day.getTime()) / DAY);
    if (days === 0) return 'hoje';
    if (days === 1) return 'ontem';
    if (days === -1) return 'amanhã';
    if (days < 0) return `em ${-days} dias`;
    if (days < 30) return `há ${days} dias`;
    const months = Math.round(days / 30);
    if (months < 12) return months === 1 ? 'há 1 mês' : `há ${months} meses`;
    const years = Math.floor(days / 365);
    return years === 1 ? 'há 1 ano' : `há ${years} anos`;
};

export const formatServiceDate = (value: string, now = Date.now()) => {
    const date = new Date(value);
    const when = relativeDays(date.getTime(), now);
    const hour = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const label = when === 'hoje' || when === 'amanhã'
        ? when
        : date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    return `${label} às ${hour}`;
};

const portalForPdfs = (portals: CompanyProposalPortal[], pdfs: SavedPDF[]) => {
    const ids = new Set(pdfs.map(pdf => pdf.id));
    return portals
        .filter(portal => portal.proposals.some(proposal => ids.has(proposal.id)))
        .sort((a, b) => time(b.lastActivityAt) - time(a.lastActivityAt))[0] || null;
};

export const getClientNextStep = (
    client: Client,
    summary: ClientSummary,
    agendamentos: Agendamento[],
    portals: CompanyProposalPortal[] = [],
    now = Date.now(),
): ClientNextStep | null => {
    // 1) Respondeu no link: responder enquanto está quente.
    const replied = portals
        .filter(portal => !['approved', 'rejected', 'revoked'].includes(portal.status) && !portal.lostAt)
        .map(portal => ({ portal, last: portal.messages[portal.messages.length - 1] }))
        .find(({ last }) => last?.sender_type === 'client' && ['message', 'negotiation'].includes(last.kind));
    if (replied) {
        return {
            tone: 'blue',
            title: replied.last.kind === 'negotiation' ? 'Mandou uma contraproposta' : 'Respondeu no link da proposta',
            detail: replied.last.body?.trim() ? `“${replied.last.body.trim()}”` : 'Responda enquanto o interesse está quente.',
            cta: 'Responder',
            action: { type: 'open_portal', portalId: replied.portal.id },
        };
    }

    // 2) Instalação marcada nos próximos 14 dias.
    if (summary.upcoming && time(summary.upcoming.start) - now <= 14 * DAY) {
        return {
            tone: 'green',
            title: 'Instalação marcada',
            detail: formatServiceDate(summary.upcoming.start, now),
            cta: 'Ver agendamento',
            action: { type: 'open_agendamento', agendamento: summary.upcoming },
        };
    }

    // 3) Aprovou e ainda não tem serviço marcado.
    const scheduledPdfIds = new Set(agendamentos.flatMap(linkedPdfIds));
    const toSchedule = summary.groups.find(group => group.approved
        && !group.versions.some(pdf => pdf.id != null && scheduledPdfIds.has(pdf.id))
        && !group.approved.agendamentoId
        && now - time(group.approved.date) <= 90 * DAY);
    if (toSchedule?.approved) {
        return {
            tone: 'green',
            title: 'Aprovou, falta agendar',
            detail: `${toSchedule.name} · ${currency(toSchedule.approved.totalPreco || 0)}`,
            cta: 'Agendar instalação',
            action: { type: 'schedule', pdf: toSchedule.approved },
        };
    }

    // 4) Orçamento esperando resposta.
    const open = summary.openGroups[0];
    if (open) {
        const portal = portalForPdfs(portals, open.versions);
        if (portal && !['approved', 'rejected', 'revoked'].includes(portal.status) && !portal.lostAt) {
            return {
                tone: 'amber',
                title: portal.viewCount > 0 ? `Abriu o link ${portal.viewCount === 1 ? '1 vez' : `${portal.viewCount} vezes`}` : 'Ainda não abriu o link',
                detail: `${open.name} · ${currency(open.latest.totalPreco || 0)} · enviado ${relativeDays(time(portal.createdAt), now)}`,
                cta: 'Acompanhar',
                action: { type: 'open_portal', portalId: portal.id },
            };
        }
        return {
            tone: 'amber',
            title: 'Orçamento esperando resposta',
            detail: `${open.name} · ${currency(open.latest.totalPreco || 0)} · ${relativeDays(time(open.latest.date), now)}`,
            cta: 'Mandar mensagem',
            action: { type: 'follow_up', pdf: open.latest },
        };
    }

    // 5) Cliente antigo: oferecer revisão ou outro ambiente.
    const lastService = agendamentos.filter(isDoneService).sort((a, b) => time(b.start) - time(a.start))[0];
    if (lastService && now - time(lastService.start) > INACTIVE_AFTER_DAYS * DAY) {
        return {
            tone: 'slate',
            title: 'Hora de reativar',
            detail: `Último serviço ${relativeDays(time(lastService.start), now)}.`,
            cta: 'Chamar no WhatsApp',
            action: {
                type: 'whatsapp',
                message: `Oi, ${firstName(client.nome)}! Tudo bem? Passando para saber como estão as películas. Se quiser revisar algum vidro ou fazer outro ambiente, faço uma condição especial para você.`,
            },
        };
    }

    // 6) Ainda sem orçamento.
    if (summary.groups.length === 0) {
        return {
            tone: 'blue',
            title: 'Comece pelo orçamento',
            detail: 'Nenhum orçamento para este cliente ainda.',
            cta: 'Novo orçamento',
            action: { type: 'new_proposal' },
        };
    }
    return null;
};

// ---- Linha do tempo ----

export interface ClientTimelineEntry {
    at: number;
    tone: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
    title: string;
    detail?: string;
}

export const buildClientTimeline = (
    pdfs: SavedPDF[],
    agendamentos: Agendamento[],
    portals: CompanyProposalPortal[] = [],
    now = Date.now(),
): ClientTimelineEntry[] => {
    const entries: ClientTimelineEntry[] = [];
    for (const pdf of pdfs) {
        entries.push({
            at: time(pdf.date),
            tone: pdf.status === 'approved' ? 'good' : 'neutral',
            title: `Orçamento ${pdf.proposalOptionName || ''}`.trim(),
            detail: `${currency(pdf.totalPreco || 0)}${pdf.status === 'approved' ? ' · aprovado' : ''}`,
        });
    }
    for (const portal of portals) {
        if (portal.createdAt) entries.push({ at: time(portal.createdAt), tone: 'info', title: 'Link da proposta enviado' });
        if (portal.firstViewedAt) entries.push({ at: time(portal.firstViewedAt), tone: 'info', title: 'Abriu o link da proposta' });
        for (const message of portal.messages) {
            if (message.sender_type !== 'client') continue;
            const title = message.kind === 'approved' ? 'Aprovou pelo link'
                : message.kind === 'rejected' ? 'Recusou pelo link'
                    : message.kind === 'negotiation' ? 'Mandou uma contraproposta'
                        : 'Mandou mensagem no link';
            const tone = message.kind === 'approved' ? 'good' : message.kind === 'rejected' ? 'bad' : message.kind === 'negotiation' ? 'warn' : 'info';
            entries.push({ at: time(message.created_at), tone, title, detail: message.body?.trim() || undefined });
        }
    }
    for (const agendamento of agendamentos) {
        const status = agendamento.serviceStatus ?? 'scheduled';
        const future = time(agendamento.start) > now;
        const title = status === 'completed' ? 'Serviço concluído'
            : status === 'partial' ? 'Serviço concluído em parte'
                : status === 'cancelled' ? 'Serviço cancelado'
                    : status === 'no_show' ? 'Cliente não estava no local'
                        : future ? 'Instalação agendada' : 'Instalação';
        const tone = status === 'completed' || status === 'partial' ? 'good' : status === 'cancelled' || status === 'no_show' ? 'bad' : 'info';
        entries.push({
            at: time(agendamento.start),
            tone,
            title,
            detail: agendamento.valorFinal ? currency(agendamento.valorFinal) : agendamento.notes?.trim() || undefined,
        });
    }
    return entries.filter(entry => entry.at > 0).sort((a, b) => b.at - a.at);
};

// Valor curto para cartões estreitos: "R$ 149,30", "R$ 4,2 mil", "R$ 155 mil".
const fullMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const shortMoney = [0, 1].map(digits => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: digits }));
export const formatMoneyShort = (value: number) => (Math.abs(value) < 1000
    ? fullMoney.format(value)
    : shortMoney[Math.abs(value) >= 10_000 ? 0 : 1].format(value));

// ---- Contato e aparência ----

export const clientInitials = (name: string) => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'CL';
    const letters = words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[words.length - 1][0]}`;
    return letters.toUpperCase();
};

const AVATAR_TONES = [
    'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
    'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300',
];

// Mesma cor para o mesmo cliente, em qualquer tela.
export const clientAvatarTone = (seed: string | number | undefined) => {
    const text = String(seed ?? '');
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    return AVATAR_TONES[hash % AVATAR_TONES.length];
};

export const formatClientAddress = (client: Client) => {
    const street = [client.logradouro, client.numero].filter(value => value?.trim()).join(', ');
    return [street, client.complemento, client.bairro, [client.cidade, client.uf].filter(value => value?.trim()).join(' - '), client.cep]
        .map(value => value?.trim())
        .filter(Boolean)
        .join(', ');
};

export const buildClientMapsUrl = (client: Client) => {
    const address = formatClientAddress(client);
    return address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving` : null;
};

export const clientPhoneDigits = (client: Client) => {
    const digits = (client.telefone || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.startsWith('55') ? digits : `55${digits}`;
};

export const buildClientWhatsAppUrl = (client: Client, message?: string) => {
    const phone = clientPhoneDigits(client);
    if (!phone) return null;
    return `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
};
