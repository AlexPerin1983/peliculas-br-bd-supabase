import React, { useEffect, useRef, useState } from 'react';
import { LoaderCircle, RotateCcw } from 'lucide-react';
import Modal from './ui/Modal';
import {
    DEFAULT_FOLLOW_UP_TEMPLATES,
    FOLLOW_UP_MESSAGE_TAGS,
    FOLLOW_UP_TEMPLATE_STEPS,
    findUnknownFollowUpTags,
    type FollowUpTemplateStep,
} from '../src/lib/proposalFollowUpQueue';
import {
    deleteProposalMessageTemplate,
    saveFollowUpMessageTemplate,
    type FollowUpMessageTemplateRow,
} from '../services/supabaseDb';

interface FollowUpTemplatesModalProps {
    isOpen: boolean;
    saved: FollowUpMessageTemplateRow[];
    onClose: () => void;
    onSaved: () => void;
}

type Drafts = Record<FollowUpTemplateStep, string>;

const textFor = (saved: FollowUpMessageTemplateRow[], step: FollowUpTemplateStep) =>
    saved.find(row => row.step === step)?.text || DEFAULT_FOLLOW_UP_TEMPLATES[step];

/** Mensagens do "Para acompanhar hoje": uma por situação, com marcadores. */
const FollowUpTemplatesModal: React.FC<FollowUpTemplatesModalProps> = ({ isOpen, saved, onClose, onSaved }) => {
    const [drafts, setDrafts] = useState<Drafts>(() => Object.fromEntries(FOLLOW_UP_TEMPLATE_STEPS.map(({ step }) => [step, textFor(saved, step)])) as Drafts);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const fields = useRef<Partial<Record<FollowUpTemplateStep, HTMLTextAreaElement | null>>>({});

    useEffect(() => {
        if (!isOpen) return;
        setDrafts(Object.fromEntries(FOLLOW_UP_TEMPLATE_STEPS.map(({ step }) => [step, textFor(saved, step)])) as Drafts);
        setError('');
    }, [isOpen, saved]);

    const insertTag = (step: FollowUpTemplateStep, tag: string) => {
        const field = fields.current[step];
        const value = drafts[step];
        const start = field?.selectionStart ?? value.length;
        const end = field?.selectionEnd ?? value.length;
        const next = `${value.slice(0, start)}{{${tag}}}${value.slice(end)}`;
        setDrafts(current => ({ ...current, [step]: next }));
        window.requestAnimationFrame(() => {
            field?.focus();
            const cursor = start + tag.length + 4;
            field?.setSelectionRange(cursor, cursor);
        });
    };

    const save = async () => {
        setBusy(true);
        setError('');
        try {
            for (const { step, label } of FOLLOW_UP_TEMPLATE_STEPS) {
                const text = drafts[step].trim();
                const row = saved.find(item => item.step === step);
                const isDefault = !text || text === DEFAULT_FOLLOW_UP_TEMPLATES[step];
                if (isDefault) {
                    // Igual ao padrão: não guarda cópia (acompanha melhorias futuras do texto padrão).
                    if (row) await deleteProposalMessageTemplate(row.id);
                } else if (text !== row?.text) {
                    await saveFollowUpMessageTemplate(step, label, text, row?.id);
                }
            }
            onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível salvar as mensagens.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Mensagens de acompanhamento"
            keyboardAwareFooter
            footer={(
                <div className="flex w-full gap-2 text-sm font-semibold">
                    <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-[var(--border-subtle)] text-sm font-semibold text-[var(--text-body)]">Cancelar</button>
                    <button type="button" disabled={busy} onClick={() => void save()} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white disabled:opacity-60">
                        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Salvar mensagens
                    </button>
                </div>
            )}
        >
            <div className="space-y-5">
                <p className="text-sm leading-6 text-[var(--text-muted)]">
                    Estas são as mensagens principais de cada situação. Na ficha da proposta, "Trocar mensagem" também traz outras versões prontas (como a pergunta do “não”). Toque num marcador para colocar o dado do cliente no texto.
                </p>
                {FOLLOW_UP_TEMPLATE_STEPS.map(({ step, label, when }) => {
                    const unknown = findUnknownFollowUpTags(drafts[step]);
                    const isDefault = drafts[step].trim() === DEFAULT_FOLLOW_UP_TEMPLATES[step];
                    return (
                        <section key={step} className="space-y-2" aria-label={label}>
                            <div className="flex items-baseline justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="text-sm font-semibold text-[var(--text-strong)]">{label}</h3>
                                    <p className="text-xs text-[var(--text-muted)]">Quando: {when}</p>
                                </div>
                                {!isDefault ? (
                                    <button type="button" onClick={() => setDrafts(current => ({ ...current, [step]: DEFAULT_FOLLOW_UP_TEMPLATES[step] }))}
                                        className="shrink-0 text-blue-600">
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Restaurar padrão</span>
                                    </button>
                                ) : null}
                            </div>
                            <textarea
                                ref={element => { fields.current[step] = element; }}
                                value={drafts[step]}
                                onChange={event => setDrafts(current => ({ ...current, [step]: event.target.value }))}
                                rows={4}
                                aria-label={`Mensagem: ${label}`}
                                style={{ fontSize: 16 }}
                                className="w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 leading-6 text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            />
                            <div className="flex flex-wrap gap-1.5 text-[11px]" role="group" aria-label={`Marcadores para ${label}`}>
                                {FOLLOW_UP_MESSAGE_TAGS.map(({ tag, label: tagLabel }) => (
                                    <button key={tag} type="button" onClick={() => insertTag(step, tag)}
                                        className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 font-medium text-[var(--text-body)] hover:text-[var(--text-strong)]">
                                        {tagLabel}
                                    </button>
                                ))}
                            </div>
                            {!drafts[step].includes('{{link}}') && step !== 'expired' ? (
                                <p className="text-xs text-amber-700 dark:text-amber-300">Sem o marcador "Link da proposta", o cliente não recebe o link.</p>
                            ) : null}
                            {unknown.length > 0 ? (
                                <p className="text-xs text-red-600">Marcador não reconhecido: {unknown.map(tag => `{{${tag}}}`).join(', ')}. Ele vai aparecer do jeito que está escrito.</p>
                            ) : null}
                        </section>
                    );
                })}
                {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}
            </div>
        </Modal>
    );
};

export default FollowUpTemplatesModal;
