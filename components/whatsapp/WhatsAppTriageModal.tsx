import React, { useEffect, useMemo, useState } from 'react';
import { Check, MessageCircle, X } from 'lucide-react';
import Modal from '../ui/Modal';
import { useFeedback } from '../../src/contexts/FeedbackContext';
import {
    TRIAGE_CATEGORIES,
    TRIAGE_LABELS,
    approveLabel,
    doneLabel,
    formatTriagePhone,
    suggestionSummary,
    triageKind,
    type TriageCategory,
} from '../../src/lib/whatsappTriage';
import { decideWhatsAppTriage, type TriageDone, type TriageSuggestion } from '../../services/whatsappTriageService';

const KIND_TONE = {
    client: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200',
    supplier: 'bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200',
    ignore: 'bg-slate-100 text-slate-700 dark:bg-slate-400/10 dark:text-slate-200',
};

const timeAgo = (iso: string | null) => {
    if (!iso) return '';
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (!Number.isFinite(minutes) || minutes < 1) return 'agora';
    if (minutes < 60) return `há ${minutes} min`;
    if (minutes < 24 * 60) return `há ${Math.round(minutes / 60)} h`;
    const days = Math.round(minutes / (24 * 60));
    return days === 1 ? 'ontem' : `há ${days} dias`;
};

type Draft = { name: string; category: TriageCategory };

const SuggestionCard: React.FC<{
    item: TriageSuggestion;
    draft: Draft;
    busy: boolean;
    error: string;
    onDraft: (draft: Draft) => void;
    onApprove: () => void;
    onDiscard: () => void;
}> = ({ item, draft, busy, error, onDraft, onApprove, onDiscard }) => {
    const kind = triageKind(draft.category);
    const needsPhone = kind !== 'ignore' && !item.phone;
    const lowConfidence = typeof item.confidence === 'number' && item.confidence < 0.6;
    return (
        <article className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3" aria-label={`Contato ${item.name || formatTriagePhone(item.phone)}`}>
            <div className="flex items-start justify-between gap-2">
                <input
                    value={draft.name}
                    onChange={event => onDraft({ ...draft, name: event.target.value })}
                    maxLength={120}
                    placeholder="Nome do contato"
                    aria-label="Nome do contato"
                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm font-bold text-[var(--text-strong)] hover:border-[var(--border-subtle)] focus:border-blue-400 focus:outline-none"
                />
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_TONE[triageKind(item.category)]}`}>
                    {suggestionSummary(item.category, item.confidence, item.source)}
                </span>
            </div>
            <p className="mt-1 px-1 text-xs text-[var(--text-muted)]">
                {formatTriagePhone(item.phone)}{item.lastMessageAt ? ` · ${timeAgo(item.lastMessageAt)}` : ''}
            </p>
            {item.snippet ? (
                <p className="mt-2 line-clamp-3 rounded-lg bg-[var(--surface-muted)] px-2.5 py-2 text-xs leading-5 text-[var(--text-body)]">“{item.snippet}”</p>
            ) : null}
            {lowConfidence ? <p className="mt-2 px-1 text-xs font-medium text-amber-700 dark:text-amber-300">A IA ficou em dúvida: confira o tipo.</p> : null}
            <label className="mt-2 flex items-center gap-2 px-1 text-xs font-semibold text-[var(--text-muted)]">
                Tipo
                <select
                    value={draft.category}
                    onChange={event => onDraft({ ...draft, category: event.target.value as TriageCategory })}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2 text-sm font-medium text-[var(--text-body)]"
                >
                    {TRIAGE_CATEGORIES.map(category => <option key={category} value={category}>{TRIAGE_LABELS[category]}</option>)}
                </select>
            </label>
            {needsPhone ? <p className="mt-2 px-1 text-xs text-amber-700 dark:text-amber-300">O WhatsApp escondeu o número. Salve o contato no celular para poder cadastrar.</p> : null}
            {error ? <p role="alert" className="mt-2 px-1 text-xs text-red-700 dark:text-red-300">{error}</p> : null}
            <div className="mt-3 flex gap-2 text-sm font-semibold">
                <button type="button" onClick={onDiscard} disabled={busy}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 text-[var(--text-body)] disabled:opacity-60">
                    <X className="h-4 w-4" aria-hidden="true" /> Descartar
                </button>
                <button type="button" onClick={onApprove} disabled={busy || needsPhone}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-white disabled:opacity-60">
                    <Check className="h-4 w-4" aria-hidden="true" /> {busy ? 'Salvando…' : approveLabel(draft.category)}
                </button>
            </div>
        </article>
    );
};

/** Triagem do WhatsApp conectado: aprovar, editar, mudar o tipo ou descartar o que a IA separou. */
const WhatsAppTriageModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    pending: TriageSuggestion[];
    recent: TriageDone[];
    onChanged: () => void;
}> = ({ isOpen, onClose, pending, recent, onChanged }) => {
    const { showToast } = useFeedback();
    const [tab, setTab] = useState<'pending' | 'done'>('pending');
    const [drafts, setDrafts] = useState<Record<number, Draft>>({});
    const [busyId, setBusyId] = useState<number | null>(null);
    const [errors, setErrors] = useState<Record<number, string>>({});
    // Some da lista assim que decidido, sem esperar a lista nova chegar.
    const [decided, setDecided] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (!isOpen) return;
        setTab('pending');
        setDecided(new Set());
        setErrors({});
    }, [isOpen]);

    const visible = useMemo(() => pending.filter(item => !decided.has(item.id)), [pending, decided]);
    const draftOf = (item: TriageSuggestion): Draft => drafts[item.id] ?? { name: item.name || '', category: item.category };

    const decide = async (item: TriageSuggestion, action: 'approve' | 'discard') => {
        const draft = draftOf(item);
        if (action === 'approve' && triageKind(draft.category) !== 'ignore' && draft.name.trim().length < 2) {
            setErrors(current => ({ ...current, [item.id]: 'Escreva o nome antes de salvar.' }));
            return;
        }
        setBusyId(item.id);
        setErrors(current => ({ ...current, [item.id]: '' }));
        try {
            const result = await decideWhatsAppTriage(item.id, action, draft.category, draft.name);
            setDecided(current => new Set(current).add(item.id));
            const name = draft.name.trim() || 'Contato';
            const kind = triageKind(draft.category);
            showToast(action === 'discard' ? 'Contato descartado.'
                : kind === 'client' ? (result.created ? `${name} foi salvo como cliente.` : `Este número já é do cliente ${result.name || name}.`)
                : kind === 'supplier' ? (result.created ? `${name} foi salvo em Fornecedores.` : `Este número já é do fornecedor ${result.name || name}.`)
                : `Marcado como ${TRIAGE_LABELS[draft.category].toLowerCase()}.`,
            { tone: 'success', duration: 2400 });
            onChanged();
        } catch (error) {
            setErrors(current => ({ ...current, [item.id]: error instanceof Error ? error.message : 'Não foi possível salvar.' }));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={<span className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-emerald-600" aria-hidden="true" /> Triagem do WhatsApp</span>}
            footer={<button type="button" onClick={onClose} className="h-11 w-full rounded-xl border border-[var(--border-subtle)] text-sm font-semibold text-[var(--text-body)]">Fechar</button>}
        >
            <div className="space-y-3 text-sm">
                <p className="text-[13px] leading-5 text-[var(--text-muted)]">
                    A IA do painel separou quem chamou no WhatsApp. Aprove para salvar no app, mude o tipo se ela errou ou descarte. Cada correção ensina a IA.
                </p>
                <div className="flex gap-1 rounded-xl bg-[var(--surface-muted)] p-1 text-xs font-semibold" role="tablist" aria-label="Triagem">
                    <button type="button" role="tab" aria-selected={tab === 'pending'} onClick={() => setTab('pending')}
                        className={`h-8 flex-1 rounded-lg ${tab === 'pending' ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
                        Para revisar ({visible.length})
                    </button>
                    <button type="button" role="tab" aria-selected={tab === 'done'} onClick={() => setTab('done')}
                        className={`h-8 flex-1 rounded-lg ${tab === 'done' ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
                        Feitos ({recent.length})
                    </button>
                </div>
                {tab === 'pending' ? (
                    visible.length ? (
                        <div className="space-y-2">
                            {visible.map(item => (
                                <SuggestionCard
                                    key={item.id}
                                    item={item}
                                    draft={draftOf(item)}
                                    busy={busyId === item.id}
                                    error={errors[item.id] || ''}
                                    onDraft={draft => setDrafts(current => ({ ...current, [item.id]: draft }))}
                                    onApprove={() => void decide(item, 'approve')}
                                    onDiscard={() => void decide(item, 'discard')}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="rounded-xl bg-[var(--surface-muted)] px-3 py-6 text-center text-[13px] text-[var(--text-muted)]">
                            Nada para revisar agora. Os contatos novos do WhatsApp aparecem aqui.
                        </p>
                    )
                ) : recent.length ? (
                    <ul className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)]">
                        {recent.map(item => (
                            <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold text-[var(--text-strong)]">{item.name || formatTriagePhone(item.phone)}</span>
                                    <span className="block text-xs text-[var(--text-muted)]">{doneLabel(item.status, item.category)}{item.decidedAt ? ` · ${timeAgo(item.decidedAt)}` : ''}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="rounded-xl bg-[var(--surface-muted)] px-3 py-6 text-center text-[13px] text-[var(--text-muted)]">Nenhum contato revisado nos últimos 7 dias.</p>
                )}
            </div>
        </Modal>
    );
};

export default WhatsAppTriageModal;
