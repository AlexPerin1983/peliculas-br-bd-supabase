import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { Bell, CalendarClock, CheckCheck, ChevronRight, MessageCircleMore, X } from 'lucide-react';
import * as db from '../services/db';
import { supabase } from '../services/supabaseClient';
import {
    loadCompanyProposalPortals,
    markCompanyProposalPortalRead,
    type CompanyProposalPortal,
    type ProposalPortalMessage,
} from '../src/lib/proposalPortal';

type NotificationTarget = 'proposals' | 'agenda';

interface GlobalNotificationBellProps {
    onNavigate: (target: NotificationTarget) => void;
}

interface NotificationItem {
    id: string;
    kind: 'proposal' | 'agenda';
    title: string;
    body: string;
    timestamp: number;
    target: NotificationTarget;
    portalId?: string;
}

const SEEN_STORAGE_KEY = 'peliculas-br-notifications-seen-v1';
const AGENDA_WINDOW_MS = 24 * 60 * 60 * 1000;

const readSeenIds = (): Set<string> => {
    try {
        const parsed = JSON.parse(localStorage.getItem(SEEN_STORAGE_KEY) || '[]');
        return new Set(Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : []);
    } catch {
        return new Set();
    }
};

const saveSeenIds = (ids: Set<string>) => {
    try {
        localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(Array.from(ids).slice(-300)));
    } catch {
        // Mantém apenas em memória quando o armazenamento estiver indisponível.
    }
};

const proposalMessageText = (message: ProposalPortalMessage) => {
    if (message.kind === 'approved') return 'Aprovou uma proposta. Abra para conferir os detalhes.';
    if (message.kind === 'rejected') return message.body ? `Recusou a proposta: ${message.body}` : 'Recusou uma proposta.';
    if (message.kind === 'negotiation') {
        if (message.offer_type === 'percentage' && message.offer_value != null) return `Pediu ${message.offer_value}% de desconto.`;
        if (message.offer_type === 'fixed' && message.offer_value != null) return `Fez uma contraproposta de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(message.offer_value)}.`;
        return 'Enviou uma contraproposta.';
    }
    return message.body || 'Enviou uma nova mensagem.';
};

const formatDateTime = (timestamp: number) => new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
}).format(timestamp);

const GlobalNotificationBell: React.FC<GlobalNotificationBellProps> = ({ onNavigate }) => {
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [seenIds, setSeenIds] = useState<Set<string>>(() => readSeenIds());
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const [portalsResult, agendaResult] = await Promise.allSettled([
                loadCompanyProposalPortals(),
                db.getAllAgendamentos(),
            ]);

            const portals = portalsResult.status === 'fulfilled' ? portalsResult.value : [];
            const agendamentos = agendaResult.status === 'fulfilled' ? agendaResult.value : [];
            const now = Date.now();

            const proposalItems = portals.flatMap((portal: CompanyProposalPortal) => {
                const readAt = portal.lastReadByCompanyAt ? new Date(portal.lastReadByCompanyAt).getTime() : 0;
                const unreadMessages = portal.messages.filter(message => (
                    message.sender_type === 'client'
                    && new Date(message.created_at).getTime() > readAt
                ));
                const latest = unreadMessages[unreadMessages.length - 1];
                if (!latest) return [];

                return [{
                    id: `proposal:${latest.id}`,
                    kind: 'proposal' as const,
                    title: unreadMessages.length > 1
                        ? `${portal.clientName} enviou ${unreadMessages.length} atualizações`
                        : `${portal.clientName} respondeu`,
                    body: proposalMessageText(latest),
                    timestamp: new Date(latest.created_at).getTime(),
                    target: 'proposals' as const,
                    portalId: portal.id,
                }];
            });

            const agendaItems = agendamentos
                .filter(agendamento => {
                    const start = new Date(agendamento.start).getTime();
                    const end = new Date(agendamento.end || agendamento.start).getTime();
                    const inactive = ['completed', 'cancelled', 'no_show'].includes(agendamento.serviceStatus || 'scheduled');
                    return !inactive && end >= now && start <= now + AGENDA_WINDOW_MS;
                })
                .map(agendamento => {
                    const start = new Date(agendamento.start).getTime();
                    return {
                        id: `agenda:${agendamento.id || agendamento.clienteId}:${agendamento.start}`,
                        kind: 'agenda' as const,
                        title: start <= now ? `Atendimento de ${agendamento.clienteNome} em andamento` : `Próximo: ${agendamento.clienteNome}`,
                        body: `${formatDateTime(start)}${agendamento.notes ? ` · ${agendamento.notes}` : ''}`,
                        timestamp: start,
                        target: 'agenda' as const,
                    };
                });

            setItems([...proposalItems, ...agendaItems].sort((a, b) => {
                const aUnread = seenIds.has(a.id) ? 0 : 1;
                const bUnread = seenIds.has(b.id) ? 0 : 1;
                if (aUnread !== bUnread) return bUnread - aUnread;
                if (a.kind === 'agenda' && b.kind === 'agenda') return a.timestamp - b.timestamp;
                return b.timestamp - a.timestamp;
            }));
        } catch (error) {
            console.error('[GlobalNotificationBell] Falha ao atualizar:', error);
        } finally {
            setLoading(false);
        }
    }, [seenIds]);

    useEffect(() => {
        void refresh();
        const interval = window.setInterval(() => void refresh(), 30_000);
        const handleVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
        document.addEventListener('visibilitychange', handleVisibility);
        const channel = supabase.channel('global-notification-center')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'proposal_portal_messages' }, () => void refresh())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => void refresh())
            .subscribe();

        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
            void supabase.removeChannel(channel);
        };
    }, [refresh]);

    const unreadCount = useMemo(() => items.filter(item => !seenIds.has(item.id)).length, [items, seenIds]);

    const markSeen = useCallback((ids: string[]) => {
        setSeenIds(current => {
            const next = new Set(current);
            ids.forEach(id => next.add(id));
            saveSeenIds(next);
            return next;
        });
    }, []);

    const handleItem = async (item: NotificationItem) => {
        markSeen([item.id]);
        if (item.portalId) {
            try { await markCompanyProposalPortalRead(item.portalId); } catch (error) { console.error(error); }
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set('proposalPortal', item.portalId);
            window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
            window.dispatchEvent(new CustomEvent('proposal-portal-open', { detail: { portalId: item.portalId } }));
        }
        setOpen(false);
        onNavigate(item.target);
    };

    const handleMarkAll = async () => {
        markSeen(items.map(item => item.id));
        const portalIds = Array.from(new Set(items.map(item => item.portalId).filter((id): id is string => Boolean(id))));
        await Promise.allSettled(portalIds.map(portalId => markCompanyProposalPortalRead(portalId)));
        void refresh();
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={unreadCount > 0 ? `Notificações: ${unreadCount} não vistas` : 'Notificações'}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
                <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
                {unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[var(--app-bg)] bg-red-500 px-1 text-[9px] font-black leading-none text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                ) : null}
            </button>

            {open ? ReactDOM.createPortal(
                <div className="fixed inset-0 z-[10020]" role="dialog" aria-modal="true" aria-label="Central de notificações">
                    <button type="button" aria-label="Fechar notificações" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]" />
                    <section className="absolute inset-x-3 top-[max(4.25rem,env(safe-area-inset-top))] mx-auto flex max-h-[min(72dvh,620px)] max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:right-4 sm:left-auto sm:mx-0 sm:w-[390px]">
                        <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white"><Bell className="h-4 w-4" /></span>
                            <div className="min-w-0 flex-1">
                                <h2 className="text-sm font-black text-slate-900 dark:text-white">Notificações</h2>
                                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{unreadCount > 0 ? `${unreadCount} precisando de atenção` : 'Tudo acompanhado'}</p>
                            </div>
                            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
                        </header>

                        {items.length > 0 ? (
                            <button type="button" onClick={() => void handleMarkAll()} className="flex items-center justify-center gap-2 border-b border-slate-100 px-4 py-2.5 text-xs font-black text-blue-600 hover:bg-blue-50 dark:border-slate-800 dark:text-blue-300 dark:hover:bg-blue-950/25">
                                <CheckCheck className="h-4 w-4" /> Marcar todas como vistas
                            </button>
                        ) : null}

                        <div className="min-h-0 flex-1 overflow-y-auto p-2">
                            {loading ? (
                                <div className="space-y-2 p-2">{[1, 2, 3].map(item => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>
                            ) : items.length === 0 ? (
                                <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
                                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300"><CheckCheck className="h-5 w-5" /></span>
                                    <p className="mt-3 text-sm font-black text-slate-900 dark:text-white">Nada pendente agora</p>
                                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Novas respostas e compromissos próximos aparecerão aqui.</p>
                                </div>
                            ) : items.map(item => {
                                const unread = !seenIds.has(item.id);
                                const Icon = item.kind === 'proposal' ? MessageCircleMore : CalendarClock;
                                return (
                                    <button key={item.id} type="button" onClick={() => void handleItem(item)} className={`mb-1 flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${unread ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/25 dark:hover:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'}`}>
                                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.kind === 'proposal' ? 'bg-blue-600 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}><Icon className="h-4 w-4" /></span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2"><strong className="truncate text-xs font-black text-slate-900 dark:text-white">{item.title}</strong>{unread ? <i className="h-2 w-2 shrink-0 rounded-full bg-blue-600" /> : null}</span>
                                            <span className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-600 dark:text-slate-300">{item.body}</span>
                                            <span className="mt-1 block text-[10px] font-semibold text-slate-400">{formatDateTime(item.timestamp)} · {item.kind === 'proposal' ? 'Proposta' : 'Agenda'}</span>
                                        </span>
                                        <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-slate-400" />
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                </div>,
                document.body
            ) : null}
        </>
    );
};

export default GlobalNotificationBell;
