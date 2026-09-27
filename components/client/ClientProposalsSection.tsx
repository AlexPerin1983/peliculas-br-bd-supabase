import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Download, Eye, FileText, Layers, Link2, LoaderCircle, MessageCircle, Plus } from 'lucide-react';
import type { SavedPDF } from '../../types';
import type { CompanyProposalPortal } from '../../src/lib/proposalPortal';
import { OPEN_WINDOW_DAYS, relativeDays, type ProposalOptionGroup } from '../../src/lib/clientInsights';
import ContentState from '../ui/ContentState';

type PdfStatus = NonNullable<SavedPDF['status']>;
type Filter = 'all' | 'open' | 'approved';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const DAY = 86_400_000;

const STATUS_META: Record<PdfStatus, { label: string; chip: string; accent: string }> = {
    pending: { label: 'Pendente', chip: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200', accent: 'bg-amber-400' },
    approved: { label: 'Aprovado', chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', accent: 'bg-emerald-500' },
    revised: { label: 'Revisar', chip: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300', accent: 'bg-blue-400' },
};
const STATUS_ORDER: PdfStatus[] = ['pending', 'approved', 'revised'];

const linkLabel = (portal: CompanyProposalPortal) => {
    if (portal.status === 'approved') return 'Aprovou pelo link';
    if (portal.status === 'rejected') return 'Recusou pelo link';
    if (portal.unreadCount > 0) return `${portal.unreadCount} resposta${portal.unreadCount > 1 ? 's' : ''} nova${portal.unreadCount > 1 ? 's' : ''}`;
    if (portal.viewCount === 0) return 'Link enviado, não abriu';
    return `Abriu o link ${portal.viewCount === 1 ? '1 vez' : `${portal.viewCount} vezes`}`;
};

interface ClientProposalsSectionProps {
    groups: ProposalOptionGroup[];
    portals: CompanyProposalPortal[];
    now?: number;
    onOpenOption: (pdf: SavedPDF) => void;
    onDownload: (pdf: SavedPDF) => Promise<boolean> | boolean;
    onChangeStatus: (pdf: SavedPDF, status: PdfStatus) => void;
    onMessage: (pdf: SavedPDF) => void;
    onOpenPortal: (portalId: string) => void;
    onNewProposal: () => void;
}

/** Orçamentos do cliente, uma linha por opção (as versões antigas ficam recolhidas). */
const ClientProposalsSection: React.FC<ClientProposalsSectionProps> = ({
    groups, portals, now = Date.now(), onOpenOption, onDownload, onChangeStatus, onMessage, onOpenPortal, onNewProposal,
}) => {
    const [filter, setFilter] = useState<Filter>('all');
    const [statusMenuFor, setStatusMenuFor] = useState<string | null>(null);
    const [versionsFor, setVersionsFor] = useState<string | null>(null);
    const [download, setDownload] = useState<{ pdfId: number; status: 'loading' | 'success' | 'error' } | null>(null);

    const isOpen = (group: ProposalOptionGroup) => !group.approved && now - new Date(group.latest.date).getTime() <= OPEN_WINDOW_DAYS * DAY;
    const counts = {
        all: groups.length,
        open: groups.filter(isOpen).length,
        approved: groups.filter(group => group.approved).length,
    };
    const visible = filter === 'open' ? groups.filter(isOpen) : filter === 'approved' ? groups.filter(group => group.approved) : groups;

    const portalFor = (group: ProposalOptionGroup) => {
        const ids = new Set(group.versions.map(pdf => pdf.id));
        return portals.find(portal => portal.proposals.some(proposal => ids.has(proposal.id))) || null;
    };

    const startDownload = async (pdf: SavedPDF) => {
        if (pdf.id == null || download?.status === 'loading') return;
        setDownload({ pdfId: pdf.id, status: 'loading' });
        try {
            const started = await onDownload(pdf);
            setDownload({ pdfId: pdf.id, status: started ? 'success' : 'error' });
        } catch (error) {
            console.error('[PDF] Erro inesperado ao baixar pela ficha do cliente:', error);
            setDownload({ pdfId: pdf.id, status: 'error' });
        }
    };

    if (groups.length === 0) {
        return (
            <ContentState
                icon={<FileText className="h-7 w-7" aria-hidden="true" />}
                title="Nenhum orçamento ainda"
                description="Crie o primeiro orçamento para este cliente."
                actionLabel="Criar primeiro orçamento"
                onAction={onNewProposal}
                compact
            />
        );
    }

    const chips: Array<{ id: Filter; label: string }> = [
        { id: 'all', label: 'Todos' },
        { id: 'open', label: 'Em aberto' },
        { id: 'approved', label: 'Aprovados' },
    ];

    return (
        <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 text-xs font-semibold [scrollbar-width:none]" role="group" aria-label="Filtrar orçamentos">
                    {chips.map(chip => (
                        <button key={chip.id} type="button" aria-pressed={filter === chip.id} onClick={() => setFilter(chip.id)}
                            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 transition-colors ${filter === chip.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]'}`}>
                            {chip.label} <span className={filter === chip.id ? 'text-white/80' : 'opacity-70'}>{counts[chip.id]}</span>
                        </button>
                    ))}
                </div>
                <div className="hidden shrink-0 text-xs font-semibold sm:block">
                    <button type="button" onClick={onNewProposal} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]">
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Novo orçamento
                    </button>
                </div>
            </div>

            {visible.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-[var(--text-muted)]">
                    {filter === 'open' ? 'Nenhum orçamento em aberto.' : 'Nenhum orçamento aprovado ainda.'}
                </p>
            ) : visible.map(group => {
                const pdf = group.approved || group.latest;
                const status: PdfStatus = group.approved ? 'approved' : group.latest.status ?? 'pending';
                const meta = STATUS_META[status];
                const portal = portalFor(group);
                const menuOpen = statusMenuFor === group.key;
                const showVersions = versionsFor === group.key;
                const canOpen = pdf.proposalOptionId != null;

                return (
                    <article key={group.key} className={`relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] ${menuOpen ? 'z-20' : ''}`}>
                        <span className={`absolute inset-y-3 left-0 w-[3px] rounded-r ${meta.accent}`} aria-hidden="true" />
                        <div className="flex items-start gap-2 p-3 pl-4">
                            <button type="button" onClick={() => canOpen && onOpenOption(pdf)} disabled={!canOpen} aria-label={canOpen ? `Abrir ${group.name}` : group.name}
                                className="min-w-0 flex-1 text-left disabled:cursor-default">
                                <span className="block truncate font-semibold text-[var(--text-strong)]">{group.name}</span>
                                <span className="mt-0.5 block text-base font-semibold tabular-nums tracking-[-0.01em] text-[var(--text-strong)]">{currency.format(pdf.totalPreco || 0)}</span>
                                <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{relativeDays(new Date(pdf.date).getTime(), now)} · {new Date(pdf.date).toLocaleDateString('pt-BR')}</span>
                            </button>
                            <div className="relative shrink-0">
                                <button type="button" onClick={() => setStatusMenuFor(menuOpen ? null : group.key)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`Situação: ${meta.label}`}
                                    className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 ${meta.chip}`}>
                                    <span className="text-[11px] font-semibold">{meta.label}</span>
                                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                                </button>
                                {menuOpen ? (
                                    <>
                                        <button type="button" aria-label="Fechar" className="fixed inset-0 z-[60] cursor-default bg-transparent" onClick={() => setStatusMenuFor(null)} />
                                        <div role="menu" className="absolute right-0 top-full z-[61] mt-1 w-40 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1 text-sm font-medium shadow-[var(--shadow-elevated)]">
                                            {STATUS_ORDER.map(option => (
                                                <button key={option} type="button" role="menuitem" onClick={() => { onChangeStatus(group.latest, option); setStatusMenuFor(null); }}
                                                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[var(--text-body)] hover:bg-[var(--surface-muted)]">
                                                    {STATUS_META[option].label}
                                                    {option === status ? <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" /> : null}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border-subtle)] px-3 py-2 text-xs font-medium">
                            <button type="button" onClick={() => onMessage(pdf)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" title="Mensagem de acompanhamento no WhatsApp">
                                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Mensagem
                            </button>
                            {pdf.id != null ? (
                                <button type="button" onClick={() => void startDownload(pdf)} disabled={download?.status === 'loading'}
                                    aria-label={download?.pdfId === pdf.id && download.status === 'loading' ? 'Preparando PDF' : 'Baixar PDF'}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 text-[var(--text-body)] disabled:cursor-wait disabled:opacity-60">
                                    {download?.pdfId === pdf.id && download.status === 'loading' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />} PDF
                                </button>
                            ) : null}
                            {portal ? (
                                <button type="button" onClick={() => onOpenPortal(portal.id)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 text-[var(--text-body)]" title="Ver no Propostas">
                                    {portal.viewCount > 0 ? <Eye className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" /> : <Link2 className="h-3.5 w-3.5" aria-hidden="true" />} {linkLabel(portal)}
                                </button>
                            ) : null}
                            {group.versions.length > 1 ? (
                                <button type="button" onClick={() => setVersionsFor(showVersions ? null : group.key)} aria-expanded={showVersions}
                                    className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[var(--text-muted)]">
                                    <Layers className="h-3.5 w-3.5" aria-hidden="true" /> {group.versions.length} versões
                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showVersions ? 'rotate-180' : ''}`} aria-hidden="true" />
                                </button>
                            ) : null}
                        </div>

                        {showVersions ? (
                            <ul className="space-y-1 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 px-4 py-2 text-xs" aria-label={`Versões de ${group.name}`}>
                                {group.versions.map((version, index) => (
                                    <li key={version.id ?? version.nomeArquivo} className="flex items-center justify-between gap-3 py-1">
                                        <span className="min-w-0 truncate text-[var(--text-body)]">
                                            {index === 0 ? 'Atual' : `Versão ${group.versions.length - index}`} · {new Date(version.date).toLocaleDateString('pt-BR')} · <span className="font-semibold tabular-nums">{currency.format(version.totalPreco || 0)}</span>
                                            {version.status === 'approved' ? <span className="ml-1 text-emerald-700 dark:text-emerald-300">· aprovada</span> : null}
                                        </span>
                                        {version.id != null ? (
                                            <button type="button" onClick={() => void startDownload(version)} aria-label={`Baixar PDF da versão de ${new Date(version.date).toLocaleDateString('pt-BR')}`} className="shrink-0 text-[var(--brand-primary)]">
                                                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                                            </button>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        ) : null}

                        {download && group.versions.some(version => version.id === download.pdfId) ? (
                            <div role="status" aria-live="polite"
                                className={`flex items-center gap-2 border-t px-3 py-2 text-xs font-semibold ${download.status === 'loading'
                                    ? 'border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/25 dark:text-blue-300'
                                    : download.status === 'success'
                                        ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-300'
                                        : 'border-red-100 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-300'}`}>
                                {download.status === 'loading' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : download.status === 'success' ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <AlertCircle className="h-4 w-4" aria-hidden="true" />}
                                {download.status === 'loading' ? 'Preparando PDF…' : download.status === 'success' ? 'Download iniciado' : 'Não foi possível baixar'}
                            </div>
                        ) : null}
                    </article>
                );
            })}
        </div>
    );
};

export default ClientProposalsSection;
