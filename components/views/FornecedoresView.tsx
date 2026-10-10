import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ClipboardCopy, Mail, MapPin, Navigation, Pencil, Phone, Plus, Search, StickyNote, Tag, Trash2, Truck, X } from 'lucide-react';
import { Fornecedor } from '../../types';
import ConfirmationModal from '../modals/ConfirmationModal';
import ActionButton from '../ui/ActionButton';
import BottomSheet from '../ui/BottomSheet';
import ContentState from '../ui/ContentState';
import Modal from '../ui/Modal';
import { ListSkeleton } from '../ui/Skeleton';
import {
    createFornecedor,
    deleteFornecedor,
    getFornecedores,
    migrateFromLocalStorage,
    saveFornecedor
} from '../../services/fornecedorService';
import { useFeedback } from '../../src/contexts/FeedbackContext';
import { clientAvatarTone } from '../../src/lib/clientInsights';
import { matchesSearch, normalizeSearchText } from '../../src/lib/textSearch';

const EMPTY_FORM = {
    empresa: '',
    contato: '',
    telefone: '',
    representacoes: '',
    email: '',
    endereco: '',
    observacao: '',
};

function getFornecedorTags(fornecedor: Fornecedor): string[] {
    return fornecedor.representacoes
        ?.split(',')
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => item.charAt(0).toLocaleUpperCase('pt-BR') + item.slice(1)) || [];
}

// "Nano cerâmica, controle solar +1"
function summarizeTags(tags: string[]): string {
    if (tags.length === 0) return '';
    const shown = tags.slice(0, 2).join(', ');
    return tags.length > 2 ? `${shown} +${tags.length - 2}` : shown;
}

function getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(word => /^[\p{L}\d]/u.test(word));
    if (words.length === 0) return '?';
    const first = words[0][0];
    const last = words.length > 1 ? words[words.length - 1][0] : (words[0][1] || '');
    return `${first}${last}`.toUpperCase();
}

function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function whatsappPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return digits.startsWith('55') ? digits : `55${digits}`;
}

const WhatsAppLogo: React.FC<{ className?: string }> = ({ className = '' }) => (
    <i className={`fab fa-whatsapp ${className}`} aria-hidden="true" />
);

function telHref(phone: string): string {
    return `tel:+${whatsappPhone(phone)}`;
}

function mapsHref(address: string): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function isLikelyMobileDevice(): boolean {
    return typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function whatsappBusinessUrl(phone: string): string {
    const num = whatsappPhone(phone);
    if (typeof window !== 'undefined' && /Android/i.test(window.navigator.userAgent)) {
        // browser_fallback_url: se o WhatsApp Business não estiver instalado, abre o WhatsApp Web.
        const fallback = encodeURIComponent(`https://wa.me/${num}`);
        return `intent://send?phone=${num}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=${fallback};end`;
    }

    if (typeof window !== 'undefined' && /iPhone|iPad|iPod/i.test(window.navigator.userAgent)) {
        return `whatsapp-business://send?phone=${num}`;
    }

    return `https://wa.me/${num}`;
}

const FornecedorAvatar: React.FC<{ fornecedor: Fornecedor; size?: 'md' | 'lg' }> = ({ fornecedor, size = 'md' }) => (
    <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center font-semibold ${clientAvatarTone(fornecedor.id || fornecedor.empresa)} ${size === 'lg' ? 'h-14 w-14 rounded-2xl text-lg' : 'h-11 w-11 rounded-xl text-sm'}`}
    >
        {getInitials(fornecedor.empresa)}
    </span>
);

/** Linha da lista no mesmo formato da tela de Clientes: toque abre a ficha, WhatsApp direto ao lado. */
const FornecedorRow: React.FC<{
    fornecedor: Fornecedor;
    onOpen: (fornecedor: Fornecedor) => void;
    onWhatsApp: (fornecedor: Fornecedor) => void;
}> = ({ fornecedor, onOpen, onWhatsApp }) => {
    const subtitle = [fornecedor.contato?.trim(), summarizeTags(getFornecedorTags(fornecedor))].filter(Boolean).join(' · ')
        || formatPhone(fornecedor.telefone);

    return (
        <li className="flex items-center gap-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] pr-1.5 shadow-[var(--shadow-hairline)] transition-colors hover:border-[var(--border-strong)]">
            <button
                type="button"
                onClick={() => onOpen(fornecedor)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-l-2xl py-3 pl-3 text-left transition-opacity active:opacity-60"
            >
                <FornecedorAvatar fornecedor={fornecedor} />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-[var(--text-strong)]">{fornecedor.empresa}</span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{subtitle}</span>
                </span>
            </button>
            {fornecedor.telefone ? (
                <button
                    type="button"
                    onClick={() => onWhatsApp(fornecedor)}
                    aria-label={`WhatsApp de ${fornecedor.empresa}`}
                    title="WhatsApp"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-emerald-600 transition hover:bg-emerald-50 active:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                >
                    <WhatsAppLogo className="text-[20px]" />
                </button>
            ) : null}
        </li>
    );
};

const QuickAction: React.FC<{
    icon: React.ReactNode;
    label: string;
    href?: string;
    onClick?: () => void;
    tone?: 'default' | 'whatsapp';
}> = ({ icon, label, href, onClick, tone = 'default' }) => {
    const className = `flex h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl font-semibold transition-colors ${
        tone === 'whatsapp'
            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50'
            : 'bg-[var(--surface-muted)] text-[var(--text-body)] hover:bg-[var(--border-subtle)]'
    }`;
    const content = (
        <>
            {icon}
            {/* Tamanho no texto (não no botão): uma regra global faz botões herdarem a fonte do pai. */}
            <span className="max-w-full truncate px-1 text-xs">{label}</span>
        </>
    );

    return href ? (
        <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className={className}>{content}</a>
    ) : (
        <button type="button" onClick={onClick} className={className}>{content}</button>
    );
};

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode; action?: React.ReactNode }> = ({ icon, label, children, action }) => (
    <div className="flex items-start gap-3 px-3.5 py-3">
        <span className="mt-0.5 shrink-0 text-[var(--text-soft)]">{icon}</span>
        <div className="min-w-0 flex-1">
            <p className="text-xs text-[var(--text-muted)]">{label}</p>
            <div className="mt-0.5 break-words text-sm text-[var(--text-strong)]">{children}</div>
        </div>
        {action}
    </div>
);

/** Ficha do fornecedor: atalhos de contato em cima, dados no meio, editar/excluir embaixo. */
const FornecedorDetailSheet: React.FC<{
    fornecedor: Fornecedor | null;
    onClose: () => void;
    onWhatsApp: (fornecedor: Fornecedor) => void;
    onEdit: (fornecedor: Fornecedor) => void;
    onDelete: (fornecedor: Fornecedor) => void;
}> = ({ fornecedor, onClose, onWhatsApp, onEdit, onDelete }) => {
    const [copied, setCopied] = useState(false);

    useEffect(() => setCopied(false), [fornecedor?.id]);

    if (!fornecedor) return null;

    const tags = getFornecedorTags(fornecedor);
    const quickActions = [
        fornecedor.telefone && <QuickAction key="wa" tone="whatsapp" label="WhatsApp" icon={<WhatsAppLogo className="text-[20px] leading-5" />} onClick={() => onWhatsApp(fornecedor)} />,
        fornecedor.telefone && <QuickAction key="tel" label="Ligar" icon={<Phone className="h-5 w-5" aria-hidden="true" />} href={telHref(fornecedor.telefone)} />,
        fornecedor.endereco && <QuickAction key="map" label="Rota" icon={<Navigation className="h-5 w-5" aria-hidden="true" />} href={mapsHref(fornecedor.endereco)} />,
        fornecedor.email && <QuickAction key="mail" label="E-mail" icon={<Mail className="h-5 w-5" aria-hidden="true" />} href={`mailto:${fornecedor.email}`} />,
    ].filter(Boolean);

    const handleCopyAddress = async () => {
        if (!fornecedor.endereco) return;
        try {
            await navigator.clipboard.writeText(fornecedor.endereco);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            // Sem permissão de área de transferência: o endereço continua visível para copiar à mão.
        }
    };

    return (
        <BottomSheet
            isOpen
            onClose={onClose}
            title={fornecedor.empresa}
            width="md"
            bodyClassName="mt-3 space-y-4 px-2"
            footer={(
                <div className="flex w-full gap-2">
                    <ActionButton onClick={() => onEdit(fornecedor)} variant="secondary" size="md" icon={<Pencil className="h-4 w-4" aria-hidden="true" />} className="flex-1">
                        Editar
                    </ActionButton>
                    <button
                        type="button"
                        onClick={() => onDelete(fornecedor)}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Excluir
                    </button>
                </div>
            )}
        >
            <>
                <div className="flex items-center gap-3">
                    <FornecedorAvatar fornecedor={fornecedor} size="lg" />
                    <div className="min-w-0">
                        <p className="truncate text-sm text-[var(--text-muted)]">{fornecedor.contato?.trim() || 'Sem contato cadastrado'}</p>
                        {fornecedor.telefone ? (
                            <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--text-strong)]">{formatPhone(fornecedor.telefone)}</p>
                        ) : null}
                    </div>
                </div>

                {quickActions.length > 0 ? (
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${quickActions.length}, minmax(0, 1fr))` }}>
                        {quickActions}
                    </div>
                ) : null}

                {tags.length > 0 || fornecedor.endereco || fornecedor.email || fornecedor.observacao ? (
                    <div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
                        {tags.length > 0 ? (
                            <DetailRow icon={<Tag className="h-4 w-4" aria-hidden="true" />} label="Marcas e produtos">
                                <span className="mt-1 flex flex-wrap gap-1.5">
                                    {tags.map(tag => (
                                        <span key={tag} className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-body)]">{tag}</span>
                                    ))}
                                </span>
                            </DetailRow>
                        ) : null}
                        {fornecedor.endereco ? (
                            <DetailRow
                                icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                                label="Endereço"
                                action={(
                                    <button
                                        type="button"
                                        onClick={handleCopyAddress}
                                        aria-label={copied ? 'Endereço copiado' : 'Copiar endereço'}
                                        title={copied ? 'Endereço copiado' : 'Copiar endereço'}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                    >
                                        {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <ClipboardCopy className="h-4 w-4" aria-hidden="true" />}
                                    </button>
                                )}
                            >
                                {fornecedor.endereco}
                            </DetailRow>
                        ) : null}
                        {fornecedor.email ? (
                            <DetailRow icon={<Mail className="h-4 w-4" aria-hidden="true" />} label="E-mail">
                                {fornecedor.email}
                            </DetailRow>
                        ) : null}
                        {fornecedor.observacao ? (
                            <DetailRow icon={<StickyNote className="h-4 w-4" aria-hidden="true" />} label="Observação">
                                <span className="whitespace-pre-line">{fornecedor.observacao}</span>
                            </DetailRow>
                        ) : null}
                    </div>
                ) : null}
            </>
        </BottomSheet>
    );
};

const WhatsAppChooserSheet: React.FC<{
    fornecedor: Fornecedor | null;
    onClose: () => void;
}> = ({ fornecedor, onClose }) => {
    if (!fornecedor) return null;

    return (
        <BottomSheet isOpen onClose={onClose} title="Conversar no WhatsApp" subtitle={fornecedor.empresa} bodyClassName="mt-3 space-y-2 px-2">
            <a
                href={`whatsapp://send?phone=${whatsappPhone(fornecedor.telefone)}`}
                onClick={onClose}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
            >
                <WhatsAppLogo className="text-lg" />
                WhatsApp
            </a>
            <a
                href={whatsappBusinessUrl(fornecedor.telefone)}
                onClick={onClose}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
                <i className="fas fa-briefcase text-sm" aria-hidden="true"></i>
                WhatsApp Business
            </a>
        </BottomSheet>
    );
};

const FieldLabel: React.FC<{ htmlFor: string; children: React.ReactNode; hint?: string }> = ({ htmlFor, children, hint }) => (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="ui-label">{children}</span>
        {hint ? <span className="text-xs text-[var(--text-soft)]">{hint}</span> : null}
    </label>
);

const fieldClassName = 'ui-field h-11 w-full px-3 text-base sm:text-sm';

const FornecedorFormModal: React.FC<{
    editing: Fornecedor | null;
    onSave: (data: Fornecedor) => Promise<void>;
    onClose: () => void;
}> = ({ editing, onSave, onClose }) => {
    const [form, setForm] = useState<Fornecedor>(editing || createFornecedor());
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isEditing = Boolean(editing && !editing.id?.startsWith('temp-'));

    useEffect(() => {
        setForm(editing || createFornecedor());
        setIsSaving(false);
        setError(null);
    }, [editing]);

    const setField = (key: keyof typeof EMPTY_FORM) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (error) setError(null);
        const value = key === 'telefone' ? formatPhone(event.target.value) : event.target.value;
        setForm(previous => ({ ...previous, [key]: value }));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isSaving) return;

        if (!form.empresa.trim() || !form.contato.trim() || !form.telefone.trim()) {
            setError('Preencha empresa, contato e telefone para continuar.');
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            await onSave(form);
        } catch (err: any) {
            setError(err?.message || 'Não foi possível salvar o fornecedor. Tente novamente.');
            setIsSaving(false);
        }
    };

    const footer = (
        <button
            type="submit"
            form="fornecedorForm"
            disabled={isSaving}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] text-[15px] font-semibold text-white transition-colors hover:bg-[var(--brand-primary-strong)] disabled:cursor-wait disabled:opacity-70 sm:ml-auto sm:w-auto sm:min-w-[200px] sm:px-6"
        >
            {isSaving ? (
                <>
                    <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                    Salvando...
                </>
            ) : isEditing ? 'Salvar alterações' : 'Adicionar fornecedor'}
        </button>
    );

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            disableClose={isSaving}
            keyboardAwareFooter
            title={isEditing ? 'Editar fornecedor' : 'Novo fornecedor'}
            footer={footer}
        >
            <form id="fornecedorForm" onSubmit={handleSubmit} className="space-y-4">
                {error ? (
                    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                        {error}
                    </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <FieldLabel htmlFor="forn-empresa">Empresa *</FieldLabel>
                        <input id="forn-empresa" type="text" value={form.empresa || ''} onChange={setField('empresa')}
                            placeholder="Nome da empresa" autoComplete="organization" className={fieldClassName} />
                    </div>

                    <div>
                        <FieldLabel htmlFor="forn-telefone">Telefone / WhatsApp *</FieldLabel>
                        <input id="forn-telefone" type="tel" inputMode="tel" value={form.telefone || ''} onChange={setField('telefone')}
                            placeholder="(85) 99999-9999" autoComplete="tel" className={`${fieldClassName} tabular-nums`} />
                    </div>

                    <div>
                        <FieldLabel htmlFor="forn-contato">Contato *</FieldLabel>
                        <input id="forn-contato" type="text" value={form.contato || ''} onChange={setField('contato')}
                            placeholder="Ex.: João Silva" autoComplete="name" className={fieldClassName} />
                    </div>

                    <div className="sm:col-span-2">
                        <FieldLabel htmlFor="forn-marcas" hint="Separe por vírgula">Marcas e produtos</FieldLabel>
                        <input id="forn-marcas" type="text" value={form.representacoes || ''} onChange={setField('representacoes')}
                            placeholder="Ex.: 3M, SunTek, Llumar" className={fieldClassName} />
                    </div>

                    <div>
                        <FieldLabel htmlFor="forn-email">E-mail</FieldLabel>
                        <input id="forn-email" type="email" inputMode="email" value={form.email || ''} onChange={setField('email')}
                            placeholder="contato@empresa.com" autoComplete="email" className={fieldClassName} />
                    </div>

                    <div>
                        <FieldLabel htmlFor="forn-endereco">Endereço</FieldLabel>
                        <input id="forn-endereco" type="text" value={form.endereco || ''} onChange={setField('endereco')}
                            placeholder="Rua, número, bairro, cidade" autoComplete="street-address" className={fieldClassName} />
                    </div>
                </div>

                <div>
                    <FieldLabel htmlFor="forn-observacao">Observação</FieldLabel>
                    <textarea id="forn-observacao" value={form.observacao || ''} onChange={setField('observacao')}
                        placeholder="Prazo de entrega, condições, horário de retirada..." rows={3}
                        className="ui-field w-full resize-none px-3 py-2.5 text-base sm:text-sm" />
                </div>
            </form>
        </Modal>
    );
};

const FornecedoresView: React.FC = () => {
    const { showAlert, showToast } = useFeedback();
    const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
    const [openFornecedorId, setOpenFornecedorId] = useState<string | null>(null);
    const [fornecedorToDelete, setFornecedorToDelete] = useState<Fornecedor | null>(null);
    const [fornecedorForWhatsApp, setFornecedorForWhatsApp] = useState<Fornecedor | null>(null);
    const [isDeletingFornecedor, setIsDeletingFornecedor] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const deferredSearch = useDeferredValue(search);

    const loadData = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            await migrateFromLocalStorage();
            const data = await getFornecedores();
            setFornecedores(data);
        } catch (error) {
            console.error('Erro ao carregar fornecedores:', error);
            setLoadError('Não foi possível carregar os fornecedores agora.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Lista de contatos: sempre em ordem alfabética, inclusive logo depois de cadastrar.
    const sorted = useMemo(() => (
        [...fornecedores].sort((a, b) => a.empresa.localeCompare(b.empresa, 'pt-BR', { sensitivity: 'base' }))
    ), [fornecedores]);

    const filtered = useMemo(() => {
        const lowerTerm = normalizeSearchText(deferredSearch);
        const phoneTerm = deferredSearch.replace(/\D/g, '');

        if (!lowerTerm && !phoneTerm) return sorted;

        return sorted.filter(fornecedor => {
            const tags = getFornecedorTags(fornecedor).join(' ');
            const normalizedPhone = fornecedor.telefone.replace(/\D/g, '');

            return (
                matchesSearch(fornecedor.empresa, lowerTerm) ||
                matchesSearch(fornecedor.contato, lowerTerm) ||
                matchesSearch(fornecedor.email || '', lowerTerm) ||
                matchesSearch(fornecedor.endereco || '', lowerTerm) ||
                matchesSearch(tags, lowerTerm) ||
                (phoneTerm ? normalizedPhone.includes(phoneTerm) : false)
            );
        });
    }, [deferredSearch, sorted]);

    const openFornecedor = fornecedores.find(item => item.id === openFornecedorId) || null;

    const handleWhatsApp = (fornecedor: Fornecedor) => {
        if (isLikelyMobileDevice()) {
            setFornecedorForWhatsApp(fornecedor);
            return;
        }
        window.open(`https://wa.me/${whatsappPhone(fornecedor.telefone)}`, '_blank', 'noopener,noreferrer');
    };
    const isSearching = Boolean(search.trim());

    const handleOpenCreate = () => {
        setEditingFornecedor(null);
        setShowForm(true);
    };

    const handleEdit = (fornecedor: Fornecedor) => {
        setOpenFornecedorId(null);
        setEditingFornecedor(fornecedor);
        setShowForm(true);
    };

    const handleSave = async (fornecedor: Fornecedor) => {
        const saved = await saveFornecedor(fornecedor);
        const isNew = !fornecedor.id || fornecedor.id.startsWith('temp-');
        if (isNew) {
            setFornecedores(previous => [saved, ...previous]);
        } else {
            setFornecedores(previous => previous.map(item => item.id === saved.id ? saved : item));
        }
        showToast(isNew ? 'Fornecedor adicionado.' : 'Alterações salvas.', { tone: 'success', duration: 2200 });
        setShowForm(false);
        setEditingFornecedor(null);
    };

    const handleRequestDelete = (fornecedor: Fornecedor) => {
        setOpenFornecedorId(null);
        setFornecedorToDelete(fornecedor);
    };

    const handleConfirmDelete = useCallback(async () => {
        if (!fornecedorToDelete) return;

        try {
            setIsDeletingFornecedor(true);
            await deleteFornecedor(fornecedorToDelete.id);
            setFornecedores(previous => previous.filter(item => item.id !== fornecedorToDelete.id));
            setFornecedorToDelete(null);
            showToast('Fornecedor excluído.', { tone: 'success', duration: 2200 });
        } catch (error) {
            console.error('Erro ao excluir:', error);
            showAlert({
                title: 'Erro ao excluir fornecedor',
                message: 'Não foi possível excluir o fornecedor. Tente novamente.',
                tone: 'error'
            });
        } finally {
            setIsDeletingFornecedor(false);
        }
    }, [fornecedorToDelete, showAlert, showToast]);

    const subtitle = loading
        ? 'Carregando…'
        : fornecedores.length === 0
            ? 'Distribuidores e fabricantes que você usa'
            : `${fornecedores.length} ${fornecedores.length === 1 ? 'fornecedor' : 'fornecedores'}`;

    return (
        <div className="mx-auto w-full max-w-3xl space-y-4 pb-28 animate-fade-in sm:pb-0">
            <header className="flex items-end justify-between gap-3 px-1 pt-1">
                <div className="min-w-0">
                    <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">Fornecedores</h1>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>
                </div>
                <ActionButton onClick={handleOpenCreate} variant="primary" size="md" icon={<Plus className="h-4 w-4" aria-hidden="true" />} className="shrink-0">
                    Novo<span className="hidden sm:inline"> fornecedor</span>
                </ActionButton>
            </header>

            {fornecedores.length > 0 ? (
                <div className="space-y-2">
                    <label className="relative block">
                        <span className="sr-only">Buscar fornecedor</span>
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)]" aria-hidden="true" />
                        <input
                            ref={searchRef}
                            type="search"
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                            placeholder="Buscar empresa, contato, telefone ou marca"
                            aria-label="Buscar fornecedor"
                            autoComplete="off"
                            style={{ fontSize: 16 }}
                            className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] pl-10 pr-10 text-[var(--text-strong)] shadow-[var(--shadow-hairline)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-blue-500/10 [&::-webkit-search-cancel-button]:hidden"
                        />
                        {search ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch('');
                                    searchRef.current?.focus();
                                }}
                                aria-label="Limpar busca"
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-soft)] transition-colors hover:text-[var(--text-strong)]"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        ) : null}
                    </label>
                    {isSearching ? (
                        <p className="px-1 text-xs text-[var(--text-muted)]" aria-live="polite">
                            {filtered.length === 1 ? '1 encontrado' : `${filtered.length} encontrados`}
                        </p>
                    ) : null}
                </div>
            ) : null}

            {loading ? (
                <ListSkeleton count={4} />
            ) : loadError ? (
                <ContentState
                    iconClassName="fas fa-exclamation-triangle"
                    title="Erro ao carregar fornecedores"
                    description={loadError}
                    actionLabel="Tentar novamente"
                    actionIconClassName="fas fa-rotate-right"
                    onAction={loadData}
                />
            ) : filtered.length > 0 ? (
                <ul className="space-y-2">
                    {filtered.map(fornecedor => (
                        <FornecedorRow
                            key={fornecedor.id}
                            fornecedor={fornecedor}
                            onOpen={item => setOpenFornecedorId(item.id)}
                            onWhatsApp={handleWhatsApp}
                        />
                    ))}
                </ul>
            ) : isSearching ? (
                <ContentState
                    compact
                    icon={<Search className="h-7 w-7" aria-hidden="true" />}
                    title="Nenhum fornecedor encontrado"
                    description="Tente outro nome, contato, telefone ou marca."
                />
            ) : (
                <ContentState
                    icon={<Truck className="h-7 w-7" aria-hidden="true" />}
                    title="Cadastre seu primeiro fornecedor"
                    description="Guarde distribuidores e fabricantes para chamar no WhatsApp, ligar ou ver a rota quando precisar."
                    actionLabel="Adicionar fornecedor"
                    actionIconClassName="fas fa-plus"
                    onAction={handleOpenCreate}
                />
            )}

            <FornecedorDetailSheet
                fornecedor={openFornecedor}
                onClose={() => setOpenFornecedorId(null)}
                onWhatsApp={handleWhatsApp}
                onEdit={handleEdit}
                onDelete={handleRequestDelete}
            />

            {showForm ? (
                <FornecedorFormModal
                    editing={editingFornecedor}
                    onSave={handleSave}
                    onClose={() => {
                        setShowForm(false);
                        setEditingFornecedor(null);
                    }}
                />
            ) : null}

            <WhatsAppChooserSheet
                fornecedor={fornecedorForWhatsApp}
                onClose={() => setFornecedorForWhatsApp(null)}
            />

            <ConfirmationModal
                isOpen={!!fornecedorToDelete}
                onClose={() => {
                    if (isDeletingFornecedor) return;
                    setFornecedorToDelete(null);
                }}
                onConfirm={handleConfirmDelete}
                title="Excluir fornecedor?"
                message={
                    <>
                        <strong>{fornecedorToDelete?.empresa || ''}</strong> será apagado da sua lista de fornecedores.
                        <br />
                        Esta ação não pode ser desfeita.
                    </>
                }
                confirmButtonText="Sim, excluir"
                confirmButtonVariant="danger"
                isProcessing={isDeletingFornecedor}
                processingText="Excluindo..."
            />
        </div>
    );
};

export default FornecedoresView;
