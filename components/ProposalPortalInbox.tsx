import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, CheckCircle2, ChevronDown, ExternalLink, HandCoins, LoaderCircle, MessageCircle, Send, ThumbsDown, X } from 'lucide-react';
import {
    buildProposalPortalUrl,
    loadCompanyProposalPortals,
    markCompanyProposalPortalRead,
    sendCompanyProposalMessage,
    type CompanyProposalPortal,
    type ProposalPortalMessage,
} from '../src/lib/proposalPortal';
import { supabase } from '../services/supabaseClient';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const actionMeta = (message: ProposalPortalMessage) => {
    if (message.kind === 'approved') return { label: 'Aprovou a proposta', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' };
    if (message.kind === 'rejected') return { label: 'Recusou a proposta', icon: ThumbsDown, color: 'text-red-600 bg-red-50' };
    if (message.kind === 'negotiation') return { label: 'Enviou uma contraproposta', icon: HandCoins, color: 'text-blue-600 bg-blue-50' };
    return null;
};

interface ProposalPortalInboxProps {
    defaultOpen?: boolean;
}

const ProposalPortalInbox: React.FC<ProposalPortalInboxProps> = ({ defaultOpen = false }) => {
    const requestedPortalId = useMemo(() => new URLSearchParams(window.location.search).get('proposalPortal'), []);
    const [portals, setPortals] = useState<CompanyProposalPortal[]>([]);
    const [available, setAvailable] = useState(true);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(defaultOpen || Boolean(requestedPortalId));
    const [selectedId, setSelectedId] = useState<string | null>(requestedPortalId);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const next = await loadCompanyProposalPortals();
            setPortals(next);
            setAvailable(true);
            setSelectedId(current => current && next.some(item => item.id === current) ? current : next[0]?.id || null);
        } catch (error: any) {
            // Enquanto a migration ainda nao foi aplicada, nao polui o historico com erro.
            if (String(error?.message || '').includes('proposal_portals')) setAvailable(false);
            else console.error('[proposalPortalInbox] Falha ao carregar:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
        const interval = window.setInterval(() => void refresh(), 30_000);
        const channel = supabase.channel('proposal-portal-inbox')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'proposal_portal_messages' }, () => void refresh())
            .subscribe();
        return () => { window.clearInterval(interval); void supabase.removeChannel(channel); };
    }, [refresh]);

    const unread = useMemo(() => portals.reduce((sum, portal) => sum + portal.unreadCount, 0), [portals]);
    const selected = portals.find(portal => portal.id === selectedId) || null;

    const select = async (portal: CompanyProposalPortal) => {
        setSelectedId(portal.id);
        if (portal.unreadCount > 0) {
            try { await markCompanyProposalPortalRead(portal.id); await refresh(); } catch (error) { console.error(error); }
        }
    };

    const send = async () => {
        if (!selected || !reply.trim()) return;
        setSending(true);
        try {
            await sendCompanyProposalMessage(selected.id, reply);
            setReply('');
            await refresh();
        } catch (error) {
            console.error('[proposalPortalInbox] Falha ao responder:', error);
        } finally {
            setSending(false);
        }
    };

    if (!available || (!loading && portals.length === 0)) return null;

    return (
        <section id="proposal-responses" className={`overflow-hidden rounded-[var(--radius-panel)] border shadow-[var(--shadow-hairline)] ${unread > 0 ? 'border-blue-300 bg-blue-50/70 dark:border-blue-800 dark:bg-blue-950/20' : 'border-[var(--border-subtle)] bg-[var(--surface)]'}`}>
            <button type="button" onClick={() => setOpen(current => !current)} className="flex w-full items-center gap-3 p-4 text-left">
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><BellRing className="h-4 w-4" />{unread > 0 ? <i className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-black not-italic text-white">{unread > 9 ? '9+' : unread}</i> : null}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-black text-[var(--text-strong)]">Respostas das propostas</span><span className="block truncate text-xs text-[var(--text-muted)]">{loading ? 'Buscando respostas…' : unread > 0 ? `${unread} nova${unread > 1 ? 's' : ''} interação${unread > 1 ? 'ões' : ''} de cliente` : `${portals.length} conversa${portals.length > 1 ? 's' : ''} acompanhada${portals.length > 1 ? 's' : ''}`}</span></span>
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin text-blue-600" /> : <ChevronDown className={`h-5 w-5 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />}
            </button>

            {open ? <div className="grid min-h-[420px] border-t border-[var(--border-subtle)] lg:grid-cols-[300px_minmax(0,1fr)]">
                <div className="max-h-[300px] overflow-y-auto border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2 sm:max-h-[380px] lg:max-h-[520px] lg:border-b-0 lg:border-r">
                    {portals.map(portal => <button key={portal.id} type="button" onClick={() => void select(portal)} className={`mb-1 w-full rounded-xl p-3 text-left transition ${selectedId === portal.id ? 'bg-white shadow-sm ring-1 ring-blue-200 dark:bg-slate-800 dark:ring-blue-800' : 'hover:bg-white/70 dark:hover:bg-slate-800/70'}`}>
                        <div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-black text-[var(--text-strong)]">{portal.clientName}</span>{portal.unreadCount > 0 ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-black text-white">{portal.unreadCount}</span> : null}</div>
                        <p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">{portal.proposals.map(item => item.name).join(', ')}</p>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-semibold text-[var(--text-soft)]"><span>{new Date(portal.lastActivityAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span><span className={portal.viewCount > 0 ? 'text-emerald-600' : 'text-amber-600'}>{portal.viewCount > 0 ? `Visualizou ${portal.viewCount}x` : 'Ainda não abriu'}</span></div>
                    </button>)}
                </div>
                {selected ? <div className="flex min-h-0 flex-col bg-[var(--surface)]">
                    <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] p-3 sm:p-4"><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-black text-[var(--text-strong)]">{selected.clientName}</h3><p className="truncate text-[11px] text-[var(--text-muted)]">{selected.proposals.map(item => `${item.name} · ${currency.format(item.total)}`).join(' | ')}</p></div><a href={buildProposalPortalUrl(selected.token)} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3 text-[11px] font-bold text-[var(--text-body)]"><ExternalLink className="h-3.5 w-3.5" /> Abrir</a><button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] lg:hidden"><X className="h-4 w-4" /></button></div>
                    <div className="max-h-[360px] min-h-[270px] flex-1 space-y-3 overflow-y-auto bg-[var(--surface-muted)]/55 p-3 sm:p-4">
                        {selected.messages.length === 0 ? <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center text-xs text-[var(--text-muted)]"><MessageCircle className="mb-2 h-7 w-7 opacity-40" />O cliente abriu o link, mas ainda não enviou uma resposta.</div> : selected.messages.map(message => { const meta = actionMeta(message); const Icon = meta?.icon; return <div key={message.id} className={`flex ${message.sender_type === 'company' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-5 ${message.sender_type === 'company' ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md bg-white text-[var(--text-body)] shadow-sm dark:bg-slate-800'}`}>{meta && Icon ? <p className={`mb-1 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-black ${meta.color}`}><Icon className="h-3.5 w-3.5" /> {meta.label}</p> : null}{message.offer_value != null ? <p className="font-black">{message.offer_type === 'percentage' ? `${message.offer_value}% de desconto` : `Quer pagar ${currency.format(message.offer_value)}`}</p> : null}{message.body ? <p>{message.body}</p> : null}<p className="mt-1 text-[9px] opacity-55">{new Date(message.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p></div></div>; })}
                    </div>
                    <div className="flex gap-2 border-t border-[var(--border-subtle)] p-3"><textarea value={reply} onChange={event => setReply(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={1} placeholder="Responder ao cliente…" className="min-h-11 flex-1 resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text-strong)] outline-none focus:border-blue-500" /><button disabled={sending || !reply.trim()} onClick={() => void send()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-50">{sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></div>
                </div> : null}
            </div> : null}
        </section>
    );
};

export default ProposalPortalInbox;
