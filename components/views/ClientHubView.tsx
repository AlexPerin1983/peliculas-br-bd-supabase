import React, { useMemo, useState } from 'react';
import {
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

interface ClientHubViewProps {
    client: Client | null;
    pdfs: SavedPDF[];
    agendamentos: Agendamento[];
    onNavigateToOption: (clientId: number, optionId: number) => void;
    onDownloadPdf: (pdfId: number) => Promise<void> | void;
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

const PDF_STATUS_META: Record<PdfStatus, { label: string; className: string }> = {
    pending: {
        label: 'Pendente',
        className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    },
    approved: {
        label: 'Aprovado',
        className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    },
    revised: {
        label: 'Revisar',
        className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
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

const buildWhatsAppUrl = (client: Client): string | null => {
    if (!client.telefone) return null;
    let phone = client.telefone.replace(/\D/g, '');
    if (!phone) return null;
    if (!phone.startsWith('55')) phone = `55${phone}`;
    const message = `Olá ${client.nome}, estou entrando em contato sobre o orçamento de películas.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; count?: number }> = ({ icon, title, count }) => (
    <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
            {icon}
        </span>
        <h3 className="text-base font-bold text-[var(--text-strong)]">{title}</h3>
        {typeof count === 'number' && (
            <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-bold text-[var(--text-muted)]">{count}</span>
        )}
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

    return (
        <div className="space-y-5 animate-fade-in">
            <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
            >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar
            </button>

            {/* Cabeçalho do cliente */}
            <section className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-panel)] bg-[var(--brand-primary)] text-lg font-black text-white shadow-[0_12px_24px_rgba(21,94,239,0.22)]">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <p className="ui-kicker">Ficha do cliente</p>
                            <h2 className="truncate text-xl font-bold leading-tight text-[var(--text-strong)] sm:text-2xl">{client.nome}</h2>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--text-muted)]">
                                {client.telefone && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                                        {client.telefone}
                                    </span>
                                )}
                                {location && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                                        {location}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {whatsAppUrl && (
                            <a
                                href={whatsAppUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-emerald-100 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                            >
                                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                                WhatsApp
                            </a>
                        )}
                        <button
                            type="button"
                            onClick={onEditClient}
                            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                        >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Editar
                        </button>
                        <button
                            type="button"
                            onClick={onNewProposal}
                            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--brand-primary)] px-3.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(21,94,239,0.2)] transition-colors hover:bg-[var(--brand-primary-strong)]"
                        >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Novo orçamento
                        </button>
                    </div>
                </div>

                {/* Resumo */}
                <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-3">
                    <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                        <div className="flex items-center gap-2 text-[var(--text-muted)]">
                            <FileText className="h-4 w-4" aria-hidden="true" />
                            <span className="text-xs font-bold uppercase tracking-[0.12em]">Orçamentos</span>
                        </div>
                        <p className="mt-1 text-2xl font-black text-[var(--text-strong)]">{clientPdfs.length}</p>
                    </div>
                    <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                        <div className="flex items-center gap-2 text-[var(--text-muted)]">
                            <TrendingUp className="h-4 w-4" aria-hidden="true" />
                            <span className="text-xs font-bold uppercase tracking-[0.12em]">Aprovado</span>
                        </div>
                        <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrencyBR(approvedTotal)}</p>
                    </div>
                    <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                        <div className="flex items-center gap-2 text-[var(--text-muted)]">
                            <CalendarDays className="h-4 w-4" aria-hidden="true" />
                            <span className="text-xs font-bold uppercase tracking-[0.12em]">Próximo agendamento</span>
                        </div>
                        <p className="mt-1 truncate text-sm font-bold text-[var(--text-strong)]">
                            {nextAgendamento ? formatDateTimeBR(nextAgendamento.start) : 'Nenhum'}
                        </p>
                    </div>
                </div>
            </section>

            {/* Orçamentos */}
            <section className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
                <SectionTitle icon={<ReceiptText className="h-4 w-4" aria-hidden="true" />} title="Orçamentos" count={clientPdfs.length} />

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
                                <div
                                    key={pdf.id ?? pdf.nomeArquivo}
                                    className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 transition-shadow hover:shadow-[var(--shadow-hairline)]"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate text-sm font-bold text-[var(--text-strong)]">
                                                    {pdf.proposalOptionName || 'Orçamento'}
                                                </p>
                                                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                                                    <Clock className="h-3 w-3" aria-hidden="true" />
                                                    {formatDateBR(pdf.date)}
                                                </span>
                                            </div>
                                            <p className="mt-0.5 text-lg font-black tracking-tight text-[var(--text-strong)]">
                                                {formatCurrencyBR(pdf.totalPreco)}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Status (clicável para alterar) */}
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenStatusFor(isStatusOpen ? null : (pdf.id ?? null))}
                                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${statusMeta.className}`}
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

                                            {canOpen && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenPdf(pdf)}
                                                    className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                                    Abrir
                                                </button>
                                            )}
                                            {pdf.id != null && (
                                                <button
                                                    type="button"
                                                    onClick={() => { void onDownloadPdf(pdf.id as number); }}
                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                                    aria-label="Baixar PDF"
                                                    title="Baixar PDF"
                                                >
                                                    <Download className="h-4 w-4" aria-hidden="true" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Agendamentos */}
            <section className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
                <SectionTitle icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />} title="Agendamentos" count={clientAgendamentos.length} />

                {clientAgendamentos.length === 0 ? (
                    <p className="py-4 text-center text-sm text-[var(--text-muted)]">Nenhum agendamento para este cliente.</p>
                ) : (
                    <div className="space-y-2.5">
                        {clientAgendamentos.map(ag => {
                            const statusMeta = SERVICE_STATUS_META[ag.serviceStatus ?? 'scheduled'];
                            return (
                                <button
                                    key={ag.id ?? `${ag.clienteId}-${ag.start}`}
                                    type="button"
                                    onClick={() => onEditAgendamento(ag)}
                                    className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 text-left transition-colors hover:bg-[var(--surface-muted)]"
                                >
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
                                            <CalendarDays className="h-4 w-4" aria-hidden="true" />
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-[var(--text-strong)]">{formatDateTimeBR(ag.start)}</p>
                                            {ag.notes && <p className="truncate text-xs text-[var(--text-muted)]">{ag.notes}</p>}
                                        </div>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusMeta.className}`}>{statusMeta.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

        </div>
    );
};

export default ClientHubView;
