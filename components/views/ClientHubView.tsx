import React, { useMemo, useState } from 'react';
import {
    AlertCircle,
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    Clock,
    Download,
    ExternalLink,
    FileText,
    MapPin,
    MessageCircle,
    LoaderCircle,
    Pencil,
    Phone,
    Plus,
    ReceiptText,
    TrendingUp,
    UserRound,
} from 'lucide-react';
import { Agendamento, AgendamentoServiceStatus, Client, SavedPDF } from '../../types';
import ActionButton from '../ui/ActionButton';
import ContentState from '../ui/ContentState';
import ProposalMessagesModal from '../modals/ProposalMessagesModal';

interface ClientHubViewProps {
    client: Client | null;
    pdfs: SavedPDF[];
    agendamentos: Agendamento[];
    onNavigateToOption: (clientId: number, optionId: number) => void;
    onDownloadPdf: (pdf: SavedPDF, filename: string) => Promise<boolean> | boolean;
    onUpdatePdfStatus: (pdfId: number, status: SavedPDF['status']) => Promise<void> | void;
    onEditAgendamento: (agendamento: Agendamento) => void;
    onEditClient: () => void;
    onNewProposal: () => void;
    onBack: () => void;
}

type PdfStatus = NonNullable<SavedPDF['status']>;

const formatCurrencyBR = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const formatDateBR = (iso?: string) => {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTimeBR = (iso?: string) => {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const PDF_STATUS_META: Record<PdfStatus, { label: string; className: string; accentClassName: string }> = {
    pending: {
        label: 'Pendente',
        className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
        accentClassName: 'bg-amber-400',
    },
    approved: {
        label: 'Aprovado',
        className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
        accentClassName: 'bg-emerald-500',
    },
    revised: {
        label: 'Revisar',
        className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
        accentClassName: 'bg-blue-400',
    },
};

const PDF_STATUS_ORDER: PdfStatus[] = ['pending', 'approved', 'revised'];

const SERVICE_STATUS_META: Record<AgendamentoServiceStatus, { label: string; className: string }> = {
    scheduled: { label: 'Agendado', className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' },
    completed: { label: 'Concluído', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' },
    partial: { label: 'Parcial', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' },
    cancelled: { label: 'Cancelado', className: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' },
    no_show: { label: 'Não compareceu', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

const formatClientLocation = (client: Client): string => {
    const parts = [client.bairro, client.cidade, client.uf].filter(Boolean);
    return parts.join(', ');
};

const getClientPhoneDigits = (client: Client): string => {
    let phone = (client.telefone || '').replace(/\D/g, '');
    if (!phone) return '';
    if (!phone.startsWith('55')) phone = `55${phone}`;
    return phone;
};

const buildWhatsAppUrl = (client: Client): string | null => {
    const phone = getClientPhoneDigits(client);
    if (!phone) return null;
    const message = `Olá ${client.nome}, estou entrando em contato sobre o orçamento de películas.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

const buildTelUrl = (client: Client): string | null => {
    const phone = getClientPhoneDigits(client);
    return phone ? `tel:+${phone}` : null;
};

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; count?: number }> = ({ icon, title, count }) => (
    <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
            {icon}
        </span>
        <h3 className="text-sm font-black tracking-[-0.01em] text-[var(--text-strong)] sm:text-base">{title}</h3>
        {typeof count === 'number' && (
            <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)] sm:text-xs">{count}</span>
        )}
    </div>
);

const HubFooterButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    onClick?: () => void;
    href?: string;
    external?: boolean;
    disabled?: boolean;
}> = ({ label, icon, onClick, href, external, disabled }) => {
    const className = `group flex h-14 w-16 flex-col items-center justify-center rounded-xl text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] ${disabled ? 'pointer-events-none opacity-35' : ''}`;
    const content = (
        <>
            <span className="transition-transform duration-300 group-active:scale-90">{icon}</span>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-wider">{label}</span>
        </>
    );
    if (href && !disabled) {
        return (
            <a
                href={href}
                aria-label={label}
                className={className}
                {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
            >
                {content}
            </a>
        );
    }
    return (
        <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className={className}>
            {content}
        </button>
    );
};

/** Footer flutuante de ações rápidas da ficha do cliente (somente mobile). */
const ClientHubMobileFooter: React.FC<{
    whatsAppUrl: string | null;
    telUrl: string | null;
    onBack: () => void;
    onEditClient: () => void;
    onNewProposal: () => void;
}> = ({ whatsAppUrl, telUrl, onBack, onEditClient, onNewProposal }) => (
    <div
        className="fixed left-4 right-4 z-40 sm:hidden"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
    >
        <div className="rounded-2xl border border-white/20 bg-white/95 px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/95 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="relative flex items-center justify-between">
                <div className="flex gap-1">
                    <HubFooterButton label="Voltar" icon={<ArrowLeft className="h-5 w-5" aria-hidden="true" />} onClick={onBack} />
                    <HubFooterButton label="Editar" icon={<Pencil className="h-5 w-5" aria-hidden="true" />} onClick={onEditClient} />
                </div>

                <div className="absolute left-1/2 -top-12 -translate-x-1/2">
                    <button
                        type="button"
                        onClick={onNewProposal}
                        aria-label="Novo orçamento"
                        className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_8px_20px_rgba(21,94,239,0.4)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(21,94,239,0.5)] active:scale-95 dark:border-slate-900"
                    >
                        <Plus className="h-7 w-7" aria-hidden="true" />
                    </button>
                </div>

                <div className="flex gap-1">
                    <HubFooterButton
                        label="WhatsApp"
                        icon={<MessageCircle className="h-5 w-5" aria-hidden="true" />}
                        href={whatsAppUrl ?? undefined}
                        external
                        disabled={!whatsAppUrl}
                    />
                    <HubFooterButton
                        label="Ligar"
                        icon={<Phone className="h-5 w-5" aria-hidden="true" />}
                        href={telUrl ?? undefined}
                        disabled={!telUrl}
                    />
                </div>
            </div>
        </div>
    </div>
);

const ClientHubView: React.FC<ClientHubViewProps> = ({
    client,
    pdfs,
    agendamentos,
    onNavigateToOption,
    onDownloadPdf,
    onUpdatePdfStatus,
    onEditAgendamento,
    onEditClient,
    onNewProposal,
    onBack,
}) => {
    const [openStatusFor, setOpenStatusFor] = useState<number | null>(null);
    const [messagePdf, setMessagePdf] = useState<SavedPDF | null>(null);
    const [downloadingPdfId, setDownloadingPdfId] = useState<number | null>(null);
    const [downloadFeedback, setDownloadFeedback] = useState<{
        pdfId: number;
        status: 'loading' | 'success' | 'error';
    } | null>(null);

    const clientId = client?.id ?? null;

    const clientPdfs = useMemo(
        () =>
            pdfs
                .filter(pdf => clientId != null && pdf.clienteId === clientId)
                .slice()
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        [pdfs, clientId]
    );

    const clientAgendamentos = useMemo(
        () =>
            agendamentos
                .filter(ag => clientId != null && ag.clienteId === clientId)
                .slice()
                .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
        [agendamentos, clientId]
    );

    const approvedTotal = useMemo(
        () => clientPdfs.filter(pdf => pdf.status === 'approved').reduce((sum, pdf) => sum + (pdf.totalPreco || 0), 0),
        [clientPdfs]
    );

    const nextAgendamento = useMemo(() => {
        const now = Date.now();
        const upcoming = clientAgendamentos.find(ag => new Date(ag.start).getTime() >= now);
        return upcoming ?? clientAgendamentos[clientAgendamentos.length - 1] ?? null;
    }, [clientAgendamentos]);

    if (!client || clientId == null) {
        return (
            <div className="space-y-4">
                <ContentState
                    icon={<UserRound className="h-7 w-7" aria-hidden="true" />}
                    title="Nenhum cliente selecionado"
                    description="Selecione um cliente para ver a ficha completa com orçamentos e agendamentos."
                />
                <div className="flex justify-center">
                    <ActionButton onClick={onBack} variant="secondary" size="md" icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
                        Voltar
                    </ActionButton>
                </div>
            </div>
        );
    }

    const initials = client.nome.trim().slice(0, 2).toUpperCase() || 'CL';
    const location = formatClientLocation(client);
    const whatsAppUrl = buildWhatsAppUrl(client);
    const telUrl = buildTelUrl(client);

    const handleOpenPdf = (pdf: SavedPDF) => {
        if (pdf.proposalOptionId != null) {
            onNavigateToOption(clientId, pdf.proposalOptionId);
        }
    };

    const handleChangeStatus = (pdf: SavedPDF, status: PdfStatus) => {
        if (pdf.id != null) {
            void onUpdatePdfStatus(pdf.id, status);
        }
        setOpenStatusFor(null);
    };

    const handleDownload = async (pdf: SavedPDF) => {
        if (pdf.id == null || downloadingPdfId != null) return;

        setDownloadingPdfId(pdf.id);
        setDownloadFeedback({ pdfId: pdf.id, status: 'loading' });

        try {
            const started = await onDownloadPdf(pdf, pdf.nomeArquivo || `orcamento-${pdf.id}.pdf`);
            setDownloadFeedback({ pdfId: pdf.id, status: started ? 'success' : 'error' });
        } catch (error) {
            console.error('[PDF] Erro inesperado ao baixar pela ficha do cliente:', error);
            setDownloadFeedback({ pdfId: pdf.id, status: 'error' });
        } finally {
            setDownloadingPdfId(null);
        }
    };

    return (
        <div className="space-y-4 pb-28 animate-fade-in sm:space-y-5 sm:pb-0">
            {/* No mobile o voltar fica dentro do cabeçalho e no rodapé fixo. */}
            <button
                type="button"
                onClick={onBack}
                className="hidden items-center gap-1.5 text-sm font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)] sm:inline-flex"
            >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar
            </button>

            {/* Cabeçalho do cliente */}
            <section className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3.5 shadow-[var(--shadow-soft)] sm:p-5">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Voltar"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] active:scale-95 sm:hidden"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <p className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-soft)]">Ficha do cliente</p>
                    <div className="flex shrink-0 items-center gap-1.5 sm:hidden">
                        {whatsAppUrl && (
                            <a
                                href={whatsAppUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Chamar no WhatsApp"
                                className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-emerald-200/70 bg-emerald-50 text-emerald-600 transition-all duration-200 hover:bg-emerald-100 active:scale-95 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                            >
                                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                            </a>
                        )}
                        <button
                            type="button"
                            onClick={onEditClient}
                            aria-label="Editar cliente"
                            className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] active:scale-95"
                        >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                </div>

                <div className="mt-2.5 flex flex-col gap-4 sm:mt-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[var(--brand-primary-soft)] text-sm font-black text-[var(--brand-primary)] sm:h-14 sm:w-14 sm:rounded-[16px] sm:text-lg">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <h2 className="truncate text-lg font-black leading-tight tracking-[-0.02em] text-[var(--text-strong)] sm:text-2xl sm:tracking-[-0.03em]">{client.nome}</h2>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-medium text-[var(--text-muted)] sm:mt-1 sm:gap-y-1 sm:text-xs">
                                {client.telefone && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                                        {client.telefone}
                                    </span>
                                )}
                                {location && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                                        {location}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Ações — no mobile ficam no rodapé fixo. */}
                    <div className="hidden flex-wrap gap-2 sm:flex">
                        {whatsAppUrl && (
                            <a
                                href={whatsAppUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-[11px] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--text-body)] transition-all duration-200 hover:bg-[var(--surface-muted)] active:scale-[0.98]"
                            >
                                <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                                WhatsApp
                            </a>
                        )}
                        <button
                            type="button"
                            onClick={onEditClient}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-[11px] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--text-body)] transition-all duration-200 hover:bg-[var(--surface-muted)] active:scale-[0.98]"
                        >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Editar
                        </button>
                        <button
                            type="button"
                            onClick={onNewProposal}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-[11px] bg-[var(--brand-primary)] px-3.5 text-sm font-black text-white shadow-[0_10px_22px_rgba(21,94,239,0.22)] transition-all duration-200 hover:bg-[var(--brand-primary-strong)] active:scale-[0.98]"
                        >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Novo orçamento
                        </button>
                    </div>
                </div>

                {/* Resumo */}
                <div className="mt-3 grid grid-cols-3 divide-x divide-[var(--border-subtle)] overflow-hidden rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-muted)]/55 sm:mt-4">
                    <div className="min-w-0 p-2 sm:p-3">
                        <div className="flex items-center gap-1 text-[var(--text-soft)] sm:gap-1.5">
                            <FileText className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                            <span className="truncate text-[8px] font-bold uppercase tracking-[0.1em] sm:text-[9px]">Orçamentos</span>
                        </div>
                        <p className="mt-0.5 text-base font-black tracking-[-0.02em] text-[var(--text-strong)] sm:mt-1 sm:text-xl">{clientPdfs.length}</p>
                    </div>
                    <div className="min-w-0 p-2 sm:p-3">
                        <div className="flex items-center gap-1 text-[var(--text-soft)] sm:gap-1.5">
                            <TrendingUp className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                            <span className="truncate text-[8px] font-bold uppercase tracking-[0.1em] sm:text-[9px]">Aprovado</span>
                        </div>
                        <p className="mt-1 truncate text-xs font-black tracking-[-0.02em] text-emerald-600 dark:text-emerald-400 sm:text-lg">{formatCurrencyBR(approvedTotal)}</p>
                    </div>
                    <div className="min-w-0 p-2 sm:p-3">
                        <div className="flex items-center gap-1 text-[var(--text-soft)] sm:gap-1.5">
                            <CalendarDays className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                            <span className="truncate text-[8px] font-bold uppercase tracking-[0.1em] sm:text-[9px]">Próximo</span>
                        </div>
                        <p className="mt-1 truncate text-[10px] font-black text-[var(--text-strong)] sm:text-sm">
                            {nextAgendamento ? formatDateTimeBR(nextAgendamento.start) : 'Nenhum'}
                        </p>
                    </div>
                </div>
            </section>

            {/* Orçamentos */}
            <section className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3.5 shadow-[var(--shadow-soft)] sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
                    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-blue-50 text-[var(--brand-primary)] dark:bg-blue-950/40 sm:h-10 sm:w-10 sm:rounded-[12px]">
                            <ReceiptText className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <h3 className="text-sm font-black tracking-[-0.02em] text-[var(--text-strong)] sm:text-base">Orçamentos</h3>
                            <p className="hidden text-[11px] font-medium text-[var(--text-muted)] sm:block">Histórico de propostas do cliente</p>
                        </div>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-[var(--brand-primary)] dark:bg-blue-950/40">{clientPdfs.length}</span>
                </div>

                {clientPdfs.length === 0 ? (
                    <ContentState
                        icon={<FileText className="h-7 w-7" aria-hidden="true" />}
                        title="Nenhum orçamento ainda"
                        description="Crie o primeiro orçamento para este cliente."
                        actionLabel="Criar primeiro orçamento"
                        onAction={onNewProposal}
                        compact
                    />
                ) : (
                    <div className="space-y-2.5">
                        {clientPdfs.map(pdf => {
                            const statusKey: PdfStatus = pdf.status ?? 'pending';
                            const statusMeta = PDF_STATUS_META[statusKey];
                            const canOpen = pdf.proposalOptionId != null;
                            const isStatusOpen = openStatusFor === pdf.id;
                            return (
                                <article
                                    key={pdf.id ?? pdf.nomeArquivo}
                                    className="relative overflow-hidden rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface)] transition-[border-color,box-shadow] duration-200 hover:border-blue-200 hover:shadow-[var(--shadow-soft)] dark:hover:border-blue-900/60"
                                >
                                    <span className={`absolute inset-y-0 left-0 z-10 w-[3px] ${statusMeta.accentClassName}`} aria-hidden="true" />
                                    <div className="p-3 pl-4 sm:p-3.5 sm:pl-[18px]">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="min-w-0 truncate text-[13px] font-bold tracking-[-0.01em] text-[var(--text-strong)] sm:text-sm">
                                                {pdf.proposalOptionName || 'Orçamento'}
                                            </p>
                                            {/* Status (clicável para alterar) */}
                                            <div className="relative shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenStatusFor(isStatusOpen ? null : (pdf.id ?? null))}
                                                    className={`inline-flex min-h-7 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-transform duration-200 active:scale-[0.97] sm:px-2.5 sm:text-[11px] ${statusMeta.className}`}
                                                    aria-haspopup="menu"
                                                    aria-expanded={isStatusOpen}
                                                >
                                                    {statusMeta.label}
                                                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                                                </button>
                                                {isStatusOpen && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            aria-label="Fechar"
                                                            className="fixed inset-0 z-[60] cursor-default bg-transparent"
                                                            onClick={() => setOpenStatusFor(null)}
                                                        />
                                                        <div
                                                            role="menu"
                                                            className="absolute right-0 top-full z-[61] mt-1 w-40 overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] p-1 shadow-[var(--shadow-elevated)]"
                                                        >
                                                            {PDF_STATUS_ORDER.map(option => (
                                                                <button
                                                                    key={option}
                                                                    type="button"
                                                                    onClick={() => handleChangeStatus(pdf, option)}
                                                                    className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-control)] px-2.5 py-2 text-left text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                                                >
                                                                    {PDF_STATUS_META[option].label}
                                                                    {option === statusKey && <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-1.5 flex items-end justify-between gap-2 sm:mt-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-[15px] font-black tracking-[-0.02em] text-[var(--text-strong)] sm:text-lg">
                                                    {formatCurrencyBR(pdf.totalPreco)}
                                                </p>
                                                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)]">
                                                    <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                    {formatDateBR(pdf.date)}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setMessagePdf(pdf)}
                                                    aria-label="Mensagem"
                                                    title="Mensagem de follow-up no WhatsApp"
                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-emerald-200/70 bg-emerald-50 text-emerald-600 transition-all duration-200 hover:bg-emerald-100 active:scale-95 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                >
                                                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                                                </button>
                                                {canOpen && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenPdf(pdf)}
                                                        aria-label="Abrir orçamento"
                                                        title="Abrir orçamento"
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-[var(--brand-primary)] dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20"
                                                    >
                                                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                                    </button>
                                                )}
                                                {pdf.id != null && (
                                                    <button
                                                        type="button"
                                                        onClick={() => { void handleDownload(pdf); }}
                                                        disabled={downloadingPdfId != null}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-[var(--brand-primary)] disabled:cursor-wait disabled:opacity-60 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20"
                                                        aria-label={downloadingPdfId === pdf.id ? 'Preparando PDF' : 'Baixar PDF'}
                                                        title={downloadingPdfId === pdf.id ? 'Preparando PDF' : 'Baixar PDF'}
                                                    >
                                                        {downloadingPdfId === pdf.id
                                                            ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                                                            : <Download className="h-4 w-4" aria-hidden="true" />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {downloadFeedback?.pdfId === pdf.id && (
                                        <div
                                            className={`flex items-center gap-2.5 border-t px-3 py-2 text-xs font-semibold ${downloadFeedback.status === 'loading'
                                                ? 'border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/25 dark:text-blue-300'
                                                : downloadFeedback.status === 'success'
                                                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-300'
                                                    : 'border-red-100 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-300'
                                            }`}
                                            role="status"
                                            aria-live="polite"
                                        >
                                            {downloadFeedback.status === 'loading' && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
                                            {downloadFeedback.status === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
                                            {downloadFeedback.status === 'error' && <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
                                            <div className="min-w-0">
                                                <p>{downloadFeedback.status === 'loading' ? 'Preparando PDF…' : downloadFeedback.status === 'success' ? 'Download iniciado' : 'Não foi possível baixar'}</p>
                                                <p className="truncate text-[10px] font-medium opacity-75">{pdf.nomeArquivo}</p>
                                            </div>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Agendamentos */}
            <section className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3.5 shadow-[var(--shadow-soft)] sm:p-5">
                <SectionTitle icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />} title="Agendamentos" count={clientAgendamentos.length} />

                {clientAgendamentos.length === 0 ? (
                    <p className="py-3 text-center text-[13px] text-[var(--text-muted)] sm:py-4 sm:text-sm">Nenhum agendamento para este cliente.</p>
                ) : (
                    <div className="space-y-2">
                        {clientAgendamentos.map(ag => {
                            const statusMeta = SERVICE_STATUS_META[ag.serviceStatus ?? 'scheduled'];
                            return (
                                <button
                                    key={ag.id ?? `${ag.clienteId}-${ag.start}`}
                                    type="button"
                                    onClick={() => onEditAgendamento(ag)}
                                    className="flex w-full items-center justify-between gap-2.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5 text-left transition-colors hover:bg-[var(--surface-muted)] sm:gap-3 sm:p-3"
                                >
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface-muted)] text-[var(--text-muted)] sm:h-9 sm:w-9">
                                            <CalendarDays className="h-4 w-4" aria-hidden="true" />
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate text-[13px] font-bold text-[var(--text-strong)] sm:text-sm">{formatDateTimeBR(ag.start)}</p>
                                            {ag.notes && <p className="truncate text-[11px] text-[var(--text-muted)] sm:text-xs">{ag.notes}</p>}
                                        </div>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold sm:px-2.5 sm:py-1 sm:text-xs ${statusMeta.className}`}>{statusMeta.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            <ClientHubMobileFooter
                whatsAppUrl={whatsAppUrl}
                telUrl={telUrl}
                onBack={onBack}
                onEditClient={onEditClient}
                onNewProposal={onNewProposal}
            />

            <ProposalMessagesModal
                isOpen={messagePdf != null}
                client={client}
                pdf={messagePdf}
                onClose={() => setMessagePdf(null)}
            />

        </div>
    );
};

export default ClientHubView;
