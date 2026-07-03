import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowRight,
    ChevronDown,
    Copy,
    BriefcaseBusiness,
    MessageCircle,
    Pencil,
    PhoneOff,
    Save,
    Smartphone,
    SlidersHorizontal,
    Tag,
    X,
} from 'lucide-react';
import { Client, SavedPDF } from '../../types';
import {
    buildProposalWhatsAppAppUrl,
    buildProposalWhatsAppBusinessUrl,
    calculateFollowUpDiscount,
    DEFAULT_PROPOSAL_MESSAGE_TEMPLATES,
    fillProposalMessage,
    findUnsupportedProposalTags,
    FollowUpDiscountType,
    PROPOSAL_MESSAGE_TAGS,
    ProposalMessageTemplate,
    ProposalMessageValues,
} from '../../src/lib/proposalMessages';
import Modal from '../ui/Modal';

interface ProposalMessagesModalProps {
    isOpen: boolean;
    client: Client;
    pdf: SavedPDF | null;
    onClose: () => void;
}

interface MessageFields {
    firstName: string;
    discountValue: string;
    commercialNote: string;
}

const STORAGE_KEY = 'proposal-message-templates:v1';
const LEGACY_CONDITION_SPECIAL_TEXT = `{{primeiro_nome}}, consegui fazer um ajuste nessa proposta para tentar facilitar o fechamento.

O valor anterior era {{valor_final}}.

Com essa nova condição, consigo deixar por {{valor_especial}}.

Quer que eu veja uma data disponível para instalação?`;

const formatCurrencyBR = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const formatDateBR = (iso?: string) => {
    if (!iso) return '—';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
};

const getProposalTitle = (pdf: SavedPDF) =>
    pdf.proposalOptionName || (pdf.id != null ? `Orçamento #${pdf.id}` : pdf.nomeArquivo || 'Orçamento');

const getOriginalValue = (pdf: SavedPDF) =>
    pdf.subtotal ?? Math.max(pdf.totalPreco || 0, (pdf.totalPreco || 0) + (pdf.generalDiscountAmount || 0));

const STATUS_LABELS: Record<NonNullable<SavedPDF['status']>, string> = {
    pending: 'Pendente',
    approved: 'Aprovado',
    revised: 'Revisar',
};

const STATUS_CHIP_CLASSES: Record<NonNullable<SavedPDF['status']>, string> = {
    pending: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    approved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    revised: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
};

// No mobile o modal abre direto na mensagem; a personalização fica colapsada.
const isDesktopViewport = () =>
    typeof window === 'undefined' || !window.matchMedia('(max-width: 639px)').matches;

const loadTemplates = (): ProposalMessageTemplate[] => {
    if (typeof window === 'undefined') return DEFAULT_PROPOSAL_MESSAGE_TEMPLATES;
    try {
        const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, string>;
        return DEFAULT_PROPOSAL_MESSAGE_TEMPLATES.map(template => ({
            ...template,
            text: typeof stored[template.id] === 'string' && stored[template.id] !== LEGACY_CONDITION_SPECIAL_TEXT
                ? stored[template.id]
                : template.text,
        }));
    } catch {
        return DEFAULT_PROPOSAL_MESSAGE_TEMPLATES;
    }
};

const ProposalWhatsAppChooser: React.FC<{
    clientName: string;
    appUrl: string;
    businessUrl: string;
    onClose: () => void;
}> = ({ clientName, appUrl, businessUrl, onClose }) => (
    <Modal
        isOpen={true}
        onClose={onClose}
        wrapperClassName="backdrop-blur-sm"
        title={(
            <span className="inline-flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-emerald-500 text-white shadow-[0_8px_18px_rgba(5,150,105,0.24)]">
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>Escolher WhatsApp</span>
            </span>
        )}
    >
        <div className="space-y-4">
            <div className="rounded-[14px] border border-emerald-100 bg-emerald-50/70 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/25">
                <p className="text-sm font-bold text-[var(--text-strong)]">Mensagem pronta para {clientName}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">Escolha onde deseja abrir a conversa. A mensagem não será enviada automaticamente.</p>
            </div>

            <div className="grid gap-3">
                <a
                    href={appUrl}
                    onClick={onClose}
                    className="flex min-h-14 items-center gap-3 rounded-[14px] bg-emerald-600 px-4 py-3 text-white shadow-[0_10px_22px_rgba(5,150,105,0.22)] transition-all duration-200 hover:bg-emerald-700 active:scale-[0.99]"
                >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-white/16">
                        <Smartphone className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 text-left">
                        <span className="block text-sm font-black">WhatsApp do celular</span>
                        <span className="block text-[11px] font-medium text-white/72">Abrir o aplicativo instalado</span>
                    </span>
                </a>

                <a
                    href={businessUrl}
                    onClick={onClose}
                    className="flex min-h-14 items-center gap-3 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-[var(--text-strong)] transition-all duration-200 hover:border-blue-200 hover:bg-blue-50 active:scale-[0.99] dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20"
                >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-blue-50 text-[var(--brand-primary)] dark:bg-blue-950/40">
                        <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 text-left">
                        <span className="block text-sm font-black">WhatsApp Business</span>
                        <span className="block text-[11px] font-medium text-[var(--text-muted)]">Abrir o aplicativo Business</span>
                    </span>
                </a>
            </div>

            <button type="button" onClick={onClose} className="h-11 w-full rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface)] text-sm font-bold text-[var(--text-body)] transition-colors duration-200 hover:bg-[var(--surface-muted)]">
                Cancelar
            </button>
        </div>
    </Modal>
);

const ProposalMessagesModal: React.FC<ProposalMessagesModalProps> = ({ isOpen, client, pdf, onClose }) => {
    const [fields, setFields] = useState<MessageFields>({
        firstName: '',
        discountValue: '',
        commercialNote: '',
    });
    const [discountType, setDiscountType] = useState<FollowUpDiscountType>('percentage');
    const [templates, setTemplates] = useState<ProposalMessageTemplate[]>(loadTemplates);
    const [activeTemplateId, setActiveTemplateId] = useState(DEFAULT_PROPOSAL_MESSAGE_TEMPLATES[0].id);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftText, setDraftText] = useState('');
    const [feedback, setFeedback] = useState<{ id: string; message: string; type: 'success' | 'error' } | null>(null);
    const [isWhatsAppChooserOpen, setIsWhatsAppChooserOpen] = useState(false);
    const [showPersonalize, setShowPersonalize] = useState(isDesktopViewport);

    useEffect(() => {
        if (!isOpen || !pdf) return;
        const firstName = client.nome.trim().split(/\s+/)[0] || '';
        setFields({
            firstName,
            discountValue: '',
            commercialNote: '',
        });
        setDiscountType('percentage');
        setActiveTemplateId(DEFAULT_PROPOSAL_MESSAGE_TEMPLATES[0].id);
        setEditingId(null);
        setDraftText('');
        setFeedback(null);
        setIsWhatsAppChooserOpen(false);
        setShowPersonalize(isDesktopViewport());
    }, [client.nome, isOpen, pdf]);

    const originalValue = pdf ? Math.max(0, getOriginalValue(pdf) || 0) : 0;
    const followUpDiscount = useMemo(
        () => calculateFollowUpDiscount(originalValue, fields.discountValue, discountType),
        [discountType, fields.discountValue, originalValue]
    );

    const values = useMemo<ProposalMessageValues>(() => ({
        primeiro_nome: fields.firstName,
        nome_cliente: client.nome || '',
        titulo_orcamento: pdf ? getProposalTitle(pdf) : '',
        valor_final: formatCurrencyBR(originalValue),
        desconto_extra: followUpDiscount.formattedDiscount,
        valor_especial: formatCurrencyBR(followUpDiscount.specialValue),
        observacao_comercial: fields.commercialNote,
    }), [client.nome, fields.commercialNote, fields.firstName, followUpDiscount, originalValue, pdf]);

    if (!pdf) return null;

    const proposalTitle = getProposalTitle(pdf);
    const currentDiscount = pdf.generalDiscountAmount ?? Math.max(0, originalValue - (pdf.totalPreco || 0));
    const status = STATUS_LABELS[pdf.status ?? 'pending'];
    const statusChipClass = STATUS_CHIP_CLASSES[pdf.status ?? 'pending'];
    const hasFollowUpDiscount = followUpDiscount.discountAmount > 0;

    const updateField = (field: keyof MessageFields, value: string) => {
        setFields(current => ({ ...current, [field]: value }));
    };

    const updateDiscountValue = (value: string) => {
        if (value === '') {
            updateField('discountValue', '');
            return;
        }
        const parsedValue = Number(value);
        if (!Number.isFinite(parsedValue)) return;
        const maximumValue = discountType === 'percentage' ? 100 : originalValue;
        updateField('discountValue', String(Math.min(Math.max(parsedValue, 0), maximumValue)));
    };

    const toggleDiscountType = () => {
        const nextType: FollowUpDiscountType = discountType === 'percentage' ? 'fixed' : 'percentage';
        setDiscountType(nextType);
        setFields(current => {
            if (current.discountValue === '') return current;
            const nextDiscount = calculateFollowUpDiscount(originalValue, current.discountValue, nextType);
            return { ...current, discountValue: String(nextDiscount.discountValue) };
        });
    };

    const startEditing = (template: ProposalMessageTemplate) => {
        setEditingId(template.id);
        setDraftText(template.text);
        setFeedback(null);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setDraftText('');
        setFeedback(null);
    };

    const selectTemplate = (templateId: string) => {
        setActiveTemplateId(templateId);
        setEditingId(null);
        setDraftText('');
        setFeedback(null);
        setIsWhatsAppChooserOpen(false);
    };

    const saveTemplate = (templateId: string) => {
        const unsupportedTags = findUnsupportedProposalTags(draftText);
        if (unsupportedTags.length > 0) {
            setFeedback({
                id: templateId,
                message: `Use apenas as tags fixas. Tag inválida: {{${unsupportedTags[0]}}}`,
                type: 'error',
            });
            return;
        }

        const updatedTemplates = templates.map(template =>
            template.id === templateId ? { ...template, text: draftText } : template
        );
        setTemplates(updatedTemplates);
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(Object.fromEntries(updatedTemplates.map(template => [template.id, template.text])))
        );
        setEditingId(null);
        setDraftText('');
        setFeedback({ id: templateId, message: 'Texto salvo neste navegador.', type: 'success' });
    };

    const copyMessage = async (templateId: string, message: string) => {
        try {
            await navigator.clipboard.writeText(message);
            setFeedback({ id: templateId, message: 'Mensagem copiada.', type: 'success' });
        } catch {
            setFeedback({ id: templateId, message: 'Não foi possível copiar. Selecione o texto manualmente.', type: 'error' });
        }
    };

    const activeTemplate = templates.find(template => template.id === activeTemplateId) ?? templates[0];
    const activeTemplateIndex = templates.findIndex(template => template.id === activeTemplate.id);
    const isEditingActiveTemplate = editingId === activeTemplate.id;
    const activeSourceText = isEditingActiveTemplate ? draftText : activeTemplate.text;
    const activeRenderedMessage = fillProposalMessage(activeSourceText, values);
    const activeWhatsAppAppUrl = buildProposalWhatsAppAppUrl(client.telefone, activeRenderedMessage);
    const activeWhatsAppBusinessUrl = buildProposalWhatsAppBusinessUrl(client.telefone, activeRenderedMessage);
    const activeFeedback = feedback?.id === activeTemplate.id ? feedback : null;

    // Ações principais sempre visíveis no rodapé do modal (fixo no mobile).
    const footer = (
        <div className="w-full space-y-2">
            {activeFeedback && (
                <p className={`text-xs font-semibold ${activeFeedback.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`} role="status">
                    {activeFeedback.message}
                </p>
            )}
            <div className="flex items-center gap-2">
                {isEditingActiveTemplate ? (
                    <>
                        <button
                            type="button"
                            onClick={cancelEditing}
                            aria-label="Cancelar edição"
                            title="Cancelar edição"
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            onClick={() => saveTemplate(activeTemplate.id)}
                            className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-[12px] bg-[var(--brand-primary)] px-4 text-sm font-bold text-white shadow-[0_10px_22px_rgba(21,94,239,0.22)] transition-all duration-200 hover:bg-[var(--brand-primary-strong)] active:scale-[0.99]"
                        >
                            <Save className="h-4 w-4" aria-hidden="true" />
                            Salvar texto
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => void copyMessage(activeTemplate.id, activeRenderedMessage)}
                            aria-label="Copiar mensagem"
                            title="Copiar mensagem"
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                        >
                            <Copy className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            onClick={() => startEditing(activeTemplate)}
                            aria-label="Editar texto"
                            title="Editar texto"
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                        >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        {activeWhatsAppAppUrl && activeWhatsAppBusinessUrl ? (
                            <button
                                type="button"
                                onClick={() => setIsWhatsAppChooserOpen(true)}
                                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-[12px] bg-emerald-600 px-3 text-sm font-bold text-white shadow-[0_10px_22px_rgba(5,150,105,0.22)] transition-all duration-200 hover:bg-emerald-700 active:scale-[0.99]"
                            >
                                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                                <span className="truncate">Enviar no WhatsApp</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled
                                title="Cadastre um telefone para o cliente"
                                className="inline-flex h-11 min-w-0 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-[12px] bg-slate-300 px-3 text-sm font-bold text-slate-600 opacity-70 dark:bg-slate-700 dark:text-slate-300"
                            >
                                <PhoneOff className="h-4 w-4 shrink-0" aria-hidden="true" />
                                <span className="truncate">Cliente sem telefone</span>
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );

    return (
        <>
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={(
                <span className="inline-flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--brand-primary)] text-white shadow-[0_8px_20px_rgba(21,94,239,0.28)]">
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span>Mensagens da proposta</span>
                </span>
            )}
            footer={footer}
        >
            <div className="space-y-3 sm:space-y-4">
                {/* Resumo compacto da proposta */}
                <section className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-hairline)] sm:p-4">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="min-w-0 truncate text-sm font-black tracking-[-0.01em] text-[var(--text-strong)] sm:text-base">{proposalTitle}</h3>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold sm:px-2.5 ${statusChipClass}`}>
                            {status}
                        </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--text-muted)]">
                        {client.nome} · {client.telefone || 'Sem telefone'} · {formatDateBR(pdf.date)}
                    </p>
                    <dl className="mt-2.5 grid grid-cols-3 divide-x divide-[var(--border-subtle)] overflow-hidden rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface-muted)]/55">
                        <div className="min-w-0 p-1.5 sm:p-2.5">
                            <dt className="truncate text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--text-soft)] sm:text-[9px]">Original</dt>
                            <dd className="mt-0.5 truncate text-[11px] font-black text-[var(--text-strong)] sm:text-sm">{formatCurrencyBR(originalValue)}</dd>
                        </div>
                        <div className="min-w-0 p-1.5 sm:p-2.5">
                            <dt className="truncate text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--text-soft)] sm:text-[9px]">Desconto</dt>
                            <dd className="mt-0.5 truncate text-[11px] font-black text-[var(--text-strong)] sm:text-sm">{formatCurrencyBR(currentDiscount)}</dd>
                        </div>
                        <div className="min-w-0 p-1.5 sm:p-2.5">
                            <dt className="truncate text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--text-soft)] sm:text-[9px]">Valor atual</dt>
                            <dd className="mt-0.5 truncate text-[11px] font-black text-[var(--brand-primary)] sm:text-sm">{formatCurrencyBR(pdf.totalPreco)}</dd>
                        </div>
                    </dl>
                </section>

                {/* Modelos prontos */}
                <section className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Modelo da mensagem</p>
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Modelos de mensagem">
                        {templates.map((template, index) => {
                            const isActive = template.id === activeTemplate.id;
                            return (
                                <button
                                    key={template.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() => selectTemplate(template.id)}
                                    className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold transition-all duration-200 sm:h-10 sm:gap-2 sm:px-3 sm:text-xs ${isActive
                                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[0_8px_18px_rgba(21,94,239,0.22)]'
                                        : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] hover:border-blue-200 hover:bg-blue-50 dark:hover:border-blue-900/50 dark:hover:bg-blue-950/20'
                                    }`}
                                >
                                    <span className={`flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full text-[9px] sm:min-h-[20px] sm:min-w-[20px] sm:text-[10px] ${isActive ? 'bg-white/18' : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'}`}>{index + 1}</span>
                                    {template.title}
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Prévia / edição da mensagem */}
                <article className="overflow-hidden rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]">
                    <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-2 sm:px-4 sm:py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-blue-50 text-[10px] font-black text-[var(--brand-primary)] dark:bg-blue-950/40">{activeTemplateIndex + 1}</span>
                            <h3 className="truncate text-xs font-black text-[var(--text-strong)] sm:text-sm">{activeTemplate.title}</h3>
                        </div>
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-soft)]">
                            {isEditingActiveTemplate ? 'Editando' : 'Prévia'}
                        </span>
                    </div>

                    <div className="p-3 sm:p-4">
                        {isEditingActiveTemplate && (
                            <div className="mb-3 space-y-2">
                                <textarea
                                    value={draftText}
                                    onChange={event => setDraftText(event.target.value)}
                                    rows={7}
                                    aria-label="Editar texto do modelo"
                                    className="w-full resize-y rounded-[12px] border border-[var(--brand-primary)] bg-[var(--surface)] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--text-strong)] outline-none shadow-[0_0_0_3px_rgba(21,94,239,0.08)] sm:px-3.5 sm:py-3 sm:text-sm"
                                />
                                <div className="flex flex-wrap items-center gap-1">
                                    <span className="mr-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-[var(--text-muted)]">
                                        <Tag className="h-3 w-3" aria-hidden="true" />
                                        Tags:
                                    </span>
                                    {PROPOSAL_MESSAGE_TAGS.map(tag => (
                                        <code key={tag} className="rounded-full border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">{`{{${tag}}}`}</code>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="relative overflow-hidden rounded-[12px] border border-blue-100 bg-[linear-gradient(145deg,rgba(239,246,255,0.92),rgba(248,250,252,0.96))] p-3 pl-4 text-[13px] leading-[1.65] text-slate-700 dark:border-blue-900/40 dark:bg-[linear-gradient(145deg,rgba(30,58,138,0.16),rgba(15,23,42,0.42))] dark:text-slate-200 sm:p-4 sm:pl-5 sm:text-sm sm:leading-[1.7]">
                            <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[var(--brand-primary)]" aria-hidden="true" />
                            <p className="whitespace-pre-wrap">{activeRenderedMessage}</p>
                        </div>
                    </div>
                </article>

                {/* Personalização (colapsável) */}
                <section className="overflow-hidden rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface)]">
                    <button
                        type="button"
                        onClick={() => setShowPersonalize(current => !current)}
                        aria-expanded={showPersonalize}
                        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-[var(--surface-muted)]/60"
                    >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-blue-50 text-[var(--brand-primary)] dark:bg-blue-950/40">
                            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-black tracking-[-0.01em] text-[var(--text-strong)] sm:text-sm">Personalizar conversa</span>
                            <span className="block truncate text-[10px] font-medium text-[var(--text-muted)] sm:text-[11px]">Nome, desconto e observação · não altera o orçamento</span>
                        </span>
                        {hasFollowUpDiscount && (
                            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                                −{followUpDiscount.formattedDiscount}
                            </span>
                        )}
                        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${showPersonalize ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>

                    {showPersonalize && (
                        <div className="space-y-3 border-t border-[var(--border-subtle)] px-3.5 pb-3.5 pt-3">
                            <label className="block space-y-1.5">
                                <span className="text-[11px] font-bold text-[var(--text-body)]">Nome usado na mensagem</span>
                                <input value={fields.firstName} onChange={event => updateField('firstName', event.target.value)} className="h-10 w-full rounded-[11px] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--text-strong)] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[var(--brand-primary)] focus:shadow-[0_0_0_3px_rgba(21,94,239,0.10)]" />
                            </label>

                            <div className="rounded-[12px] border border-blue-100 bg-blue-50/55 p-2.5 dark:border-blue-900/50 dark:bg-blue-950/20 sm:p-3">
                                <div className="flex items-center justify-center gap-2">
                                    <span className={`min-w-0 truncate text-xs font-bold text-[var(--text-muted)] ${hasFollowUpDiscount ? 'line-through' : ''}`}>{formatCurrencyBR(originalValue)}</span>
                                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />
                                    <span className="min-w-0 truncate text-sm font-black text-[var(--brand-primary)]">{formatCurrencyBR(followUpDiscount.specialValue)}</span>
                                </div>

                                <label className="mt-2.5 block space-y-1.5">
                                    <span className="flex items-center justify-between gap-2 text-[11px] font-bold text-[var(--text-body)]">
                                        <span>Desconto para follow-up</span>
                                        <span className="font-medium text-[var(--text-muted)]">Máx. {discountType === 'percentage' ? '100%' : formatCurrencyBR(originalValue)}</span>
                                    </span>
                                    <span className="relative block">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            min="0"
                                            max={discountType === 'percentage' ? 100 : originalValue}
                                            step="0.01"
                                            value={fields.discountValue}
                                            onChange={event => updateDiscountValue(event.target.value)}
                                            placeholder="0"
                                            className="h-10 w-full rounded-[11px] border border-blue-200 bg-[var(--surface)] pl-3 pr-16 text-sm font-bold text-[var(--text-strong)] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:shadow-[0_0_0_3px_rgba(21,94,239,0.10)] dark:border-blue-900/60"
                                        />
                                        <button
                                            type="button"
                                            onClick={toggleDiscountType}
                                            aria-label={discountType === 'percentage' ? 'Alterar desconto para reais' : 'Alterar desconto para percentual'}
                                            title={discountType === 'percentage' ? 'Usar desconto em reais' : 'Usar desconto percentual'}
                                            className="absolute inset-y-1 right-1 inline-flex min-w-12 items-center justify-center rounded-[8px] bg-[var(--brand-primary)] px-2.5 text-xs font-black text-white shadow-[0_6px_14px_rgba(21,94,239,0.22)] transition-all duration-200 hover:bg-[var(--brand-primary-strong)] active:scale-[0.97]"
                                        >
                                            {discountType === 'percentage' ? '%' : 'R$'}
                                        </button>
                                    </span>
                                </label>
                            </div>

                            <label className="block space-y-1.5">
                                <span className="text-[11px] font-bold text-[var(--text-body)]">Observação comercial</span>
                                <textarea value={fields.commercialNote} onChange={event => updateField('commercialNote', event.target.value)} rows={2} placeholder="Ex.: Condição válida até sexta-feira" className="w-full resize-y rounded-[11px] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:shadow-[0_0_0_3px_rgba(21,94,239,0.10)]" />
                            </label>
                        </div>
                    )}
                </section>
            </div>
        </Modal>
        {isWhatsAppChooserOpen && activeWhatsAppAppUrl && activeWhatsAppBusinessUrl && (
            <ProposalWhatsAppChooser
                clientName={client.nome}
                appUrl={activeWhatsAppAppUrl}
                businessUrl={activeWhatsAppBusinessUrl}
                onClose={() => setIsWhatsAppChooserOpen(false)}
            />
        )}
        </>
    );
};

export default ProposalMessagesModal;
