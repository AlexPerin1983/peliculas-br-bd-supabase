import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarPlus, MessageCircle, Phone, Plus, UserRound } from 'lucide-react';
import { Agendamento, Client, SavedPDF, SchedulingInfo } from '../../types';
import { loadCompanyProposalPortals, type CompanyProposalPortal } from '../../src/lib/proposalPortal';
import {
    buildClientTimeline,
    buildClientWhatsAppUrl,
    buildReferralMessage,
    buildReviewRequestMessage,
    clientPhoneDigits,
    getClientNextStep,
    getPostSaleState,
    summarizeClient,
    type ClientFollowUpEvent,
    type ClientFollowUpKind,
    type ClientNextStepAction,
} from '../../src/lib/clientInsights';
import { getClientFollowUps, recordClientFollowUp } from '../../services/supabaseDb';
import ActionButton from '../ui/ActionButton';
import ContentState from '../ui/ContentState';
import ProposalMessagesModal from '../modals/ProposalMessagesModal';
import ClientHero from '../client/ClientHero';
import ClientNextStepCard from '../client/ClientNextStepCard';
import ClientProposalsSection from '../client/ClientProposalsSection';
import ClientServicesSection from '../client/ClientServicesSection';
import ClientDetailsCard from '../client/ClientDetailsCard';
import ClientNotesCard from '../client/ClientNotesCard';
import ClientTimeline from '../client/ClientTimeline';
import ClientPostSaleSheet from '../client/ClientPostSaleSheet';

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
    onSchedule?: (info: SchedulingInfo) => void;
    // Abre o Propostas (na ficha do link, quando informado).
    onOpenProposals?: (portalId?: string) => void;
    onTogglePin?: (clientId: number) => void;
    // Pós-venda: link de avaliação do Google e contato da empresa (para a indicação).
    googleReviewsLink?: string;
    companyName?: string;
    companyPhone?: string;
}

type Section = 'overview' | 'proposals' | 'services' | 'details';

const FooterButton: React.FC<{ label: string; icon: React.ReactNode; onClick?: () => void; href?: string | null; external?: boolean }> = ({ label, icon, onClick, href, external }) => {
    const className = 'group flex h-14 w-16 flex-col items-center justify-center rounded-xl text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]';
    const content = (
        <>
            <span className="transition-transform duration-300 group-active:scale-90">{icon}</span>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-wider">{label}</span>
        </>
    );
    if (href !== undefined) {
        return href ? (
            <a href={href} aria-label={label} className={className} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{content}</a>
        ) : (
            <span aria-label={`${label} (sem telefone)`} aria-disabled="true" className={`${className} pointer-events-none opacity-35`}>{content}</span>
        );
    }
    return <button type="button" onClick={onClick} aria-label={label} className={className}>{content}</button>;
};

/** Ficha do cliente: quem é, o que está em andamento e tudo o que já aconteceu com ele. */
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
    onSchedule,
    onOpenProposals,
    onTogglePin,
    googleReviewsLink,
    companyName,
    companyPhone,
}) => {
    const [section, setSection] = useState<Section>('overview');
    const [portals, setPortals] = useState<CompanyProposalPortal[]>([]);
    const [messagePdf, setMessagePdf] = useState<SavedPDF | null>(null);
    const [postSale, setPostSale] = useState<ClientFollowUpEvent[]>([]);
    const [postSaleSheet, setPostSaleSheet] = useState<{ kind: ClientFollowUpKind; agendamento: Agendamento } | null>(null);
    const clientId = client?.id ?? null;

    const loadPostSale = useCallback(() => {
        if (clientId == null) return;
        getClientFollowUps(clientId)
            .then(setPostSale)
            .catch(error => { console.warn('[ClientHubView] Pós-venda indisponível:', error); setPostSale([]); });
    }, [clientId]);
    useEffect(() => { setPostSale([]); loadPostSale(); }, [loadPostSale]);

    // Links de proposta do cliente (status de abertura, respostas). Sem eles a ficha continua completa.
    useEffect(() => {
        if (clientId == null) return;
        let active = true;
        loadCompanyProposalPortals({ clientId })
            .then(list => { if (active) setPortals(list); })
            .catch(error => { console.warn('[ClientHubView] Links de proposta indisponíveis:', error); if (active) setPortals([]); });
        return () => { active = false; };
    }, [clientId]);

    useEffect(() => { setSection('overview'); }, [clientId]);

    const clientPdfs = useMemo(
        () => pdfs.filter(pdf => clientId != null && pdf.clienteId === clientId),
        [pdfs, clientId],
    );
    const clientAgendamentos = useMemo(
        () => agendamentos.filter(item => clientId != null && item.clienteId === clientId),
        [agendamentos, clientId],
    );
    const now = Date.now();
    const summary = useMemo(
        () => (client ? summarizeClient(client, clientPdfs, clientAgendamentos, portals) : null),
        [client, clientPdfs, clientAgendamentos, portals],
    );
    const nextStep = useMemo(
        () => (client && summary ? getClientNextStep(client, summary, clientAgendamentos, portals, Date.now(), postSale) : null),
        [client, summary, clientAgendamentos, portals, postSale],
    );
    const timeline = useMemo(() => buildClientTimeline(clientPdfs, clientAgendamentos, portals, Date.now(), postSale), [clientPdfs, clientAgendamentos, portals, postSale]);
    const postSaleState = useMemo(() => getPostSaleState(clientAgendamentos, postSale), [clientAgendamentos, postSale]);

    if (!client || clientId == null || !summary) {
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

    const phone = clientPhoneDigits(client);
    const scheduleNew = () => onSchedule?.({ agendamento: { clienteId: clientId, clienteNome: client.nome } });
    const openPortal = (portalId: string) => onOpenProposals?.(portalId);

    const handleAction = (action: ClientNextStepAction) => {
        if (action.type === 'open_portal') openPortal(action.portalId);
        else if (action.type === 'open_agendamento') onEditAgendamento(action.agendamento);
        else if (action.type === 'schedule') onSchedule?.({ pdf: action.pdf });
        else if (action.type === 'follow_up') setMessagePdf(action.pdf);
        else if (action.type === 'new_proposal') onNewProposal();
        else if (action.type === 'review') setPostSaleSheet({ kind: 'review_request', agendamento: action.agendamento });
        else if (action.type === 'referral') setPostSaleSheet({ kind: 'referral_request', agendamento: action.agendamento });
    };

    const openPostSale = (kind: ClientFollowUpKind) => {
        if (postSaleState) setPostSaleSheet({ kind, agendamento: postSaleState.lastDone });
    };
    const postSaleSource = postSaleSheet
        ? clientPdfs.find(pdf => pdf.id != null && (pdf.id === postSaleSheet.agendamento.pdfId || postSaleSheet.agendamento.pdfIds?.includes(pdf.id)))
        : undefined;
    const postSaleMessage = postSaleSheet?.kind === 'review_request'
        ? buildReviewRequestMessage(client, googleReviewsLink, postSaleSource ? { clientName: client.nome, measurements: postSaleSource.measurements } : undefined, companyName)
        : buildReferralMessage(client, companyPhone);
    const markPostSaleSent = (channel: 'whatsapp' | 'other') => {
        if (!postSaleSheet) return;
        recordClientFollowUp(clientId, postSaleSheet.kind, { agendamentoId: postSaleSheet.agendamento.id ?? null, channel })
            .then(loadPostSale)
            .catch(error => console.error('[ClientHubView] Falha ao registrar o pós-venda:', error));
    };

    const tabs: Array<{ id: Section; label: string; count?: number; mobileOnly?: boolean }> = [
        { id: 'overview', label: 'Resumo' },
        { id: 'proposals', label: 'Orçamentos', count: summary.groups.length },
        { id: 'services', label: 'Serviços', count: clientAgendamentos.length },
        { id: 'details', label: 'Dados', mobileOnly: true },
    ];

    const overview = (
        <>
            <ClientNotesCard clientId={clientId} />
            <ClientTimeline entries={timeline} now={now} />
        </>
    );
    const details = <ClientDetailsCard client={client} onEditClient={onEditClient} onTogglePin={onTogglePin ? () => onTogglePin(clientId) : undefined} />;

    return (
        <div className="animate-fade-in pb-28 sm:pb-0">
            <div className="mb-3 hidden items-center justify-between gap-3 sm:flex">
                <div className="text-sm font-semibold">
                    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]">
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Clientes
                    </button>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                    {onSchedule ? (
                        <button type="button" onClick={scheduleNew} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-body)] transition hover:text-[var(--text-strong)]">
                            <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Agendar
                        </button>
                    ) : null}
                    <button type="button" onClick={onNewProposal} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-3.5 text-white shadow-[0_10px_22px_rgba(21,94,239,0.22)] transition hover:bg-[var(--brand-primary-strong)]">
                        <Plus className="h-4 w-4" aria-hidden="true" /> Novo orçamento
                    </button>
                </div>
            </div>

            <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start lg:gap-5 lg:space-y-0">
                <aside className="space-y-4 lg:sticky lg:top-24">
                    <ClientHero client={client} summary={summary} onEditClient={onEditClient} now={now} />
                    <div className="hidden lg:block">{details}</div>
                </aside>

                <div className="min-w-0 space-y-4">
                    {nextStep ? <ClientNextStepCard client={client} step={nextStep} onAction={handleAction} /> : null}

                    <div className="grid grid-cols-4 rounded-xl bg-[var(--surface-muted)] p-1 text-[13px] font-semibold lg:grid-cols-3" role="tablist" aria-label="Ficha do cliente">
                        {tabs.map(tab => (
                            <button key={tab.id} type="button" role="tab" aria-selected={section === tab.id} onClick={() => setSection(tab.id)}
                                className={`flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg px-1 transition-colors ${tab.mobileOnly ? 'lg:hidden' : ''} ${section === tab.id ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
                                <span className="truncate">{tab.label}</span>
                                {tab.count ? <span className="hidden text-[11px] tabular-nums opacity-70 min-[400px]:inline">{tab.count}</span> : null}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-4" role="tabpanel" aria-label={tabs.find(tab => tab.id === section)?.label}>
                        {section === 'overview' ? overview : null}
                        {section === 'proposals' ? (
                            <ClientProposalsSection
                                groups={summary.groups}
                                portals={portals}
                                now={now}
                                onOpenOption={pdf => pdf.proposalOptionId != null && onNavigateToOption(clientId, pdf.proposalOptionId)}
                                onDownload={pdf => onDownloadPdf(pdf, pdf.nomeArquivo || `orcamento-${pdf.id}.pdf`)}
                                onChangeStatus={(pdf, status) => { if (pdf.id != null) void onUpdatePdfStatus(pdf.id, status); }}
                                onMessage={setMessagePdf}
                                onOpenPortal={openPortal}
                                onNewProposal={onNewProposal}
                            />
                        ) : null}
                        {section === 'services' ? (
                            <ClientServicesSection agendamentos={clientAgendamentos} now={now} postSale={postSaleState} onOpen={onEditAgendamento} onSchedule={scheduleNew} onPostSale={openPostSale} />
                        ) : null}
                        {section === 'details' ? (
                            <>
                                <div className="lg:hidden">{details}</div>
                                {/* No computador os dados já ficam na coluna da esquerda. */}
                                <div className="hidden space-y-4 lg:block">{overview}</div>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="fixed left-4 right-4 z-40 sm:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
                <nav aria-label="Ações do cliente" className="rounded-2xl border border-white/20 bg-white/95 px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/95 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                    <div className="relative flex items-center justify-between">
                        <div className="flex gap-1">
                            <FooterButton label="Voltar" icon={<ArrowLeft className="h-5 w-5" aria-hidden="true" />} onClick={onBack} />
                            <FooterButton label="Agendar" icon={<CalendarPlus className="h-5 w-5" aria-hidden="true" />} onClick={scheduleNew} />
                        </div>
                        <div className="absolute left-1/2 -top-12 -translate-x-1/2">
                            <button type="button" onClick={onNewProposal} aria-label="Novo orçamento"
                                className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_8px_20px_rgba(21,94,239,0.4)] transition-all duration-300 hover:-translate-y-1 active:scale-95 dark:border-slate-900">
                                <Plus className="h-7 w-7" aria-hidden="true" />
                            </button>
                        </div>
                        <div className="flex gap-1">
                            <FooterButton label="WhatsApp" icon={<MessageCircle className="h-5 w-5" aria-hidden="true" />} href={buildClientWhatsAppUrl(client)} external />
                            <FooterButton label="Ligar" icon={<Phone className="h-5 w-5" aria-hidden="true" />} href={phone ? `tel:+${phone}` : null} />
                        </div>
                    </div>
                </nav>
            </div>

            <ProposalMessagesModal isOpen={messagePdf != null} client={client} pdf={messagePdf} onClose={() => setMessagePdf(null)} />
            {postSaleSheet ? (
                <ClientPostSaleSheet
                    isOpen
                    kind={postSaleSheet.kind}
                    client={client}
                    message={postSaleMessage}
                    missingReviewLink={!googleReviewsLink?.trim()}
                    onClose={() => setPostSaleSheet(null)}
                    onSent={markPostSaleSent}
                />
            ) : null}
        </div>
    );
};

export default ClientHubView;
