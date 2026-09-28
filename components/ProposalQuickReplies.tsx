import React, { useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Sparkles, X } from 'lucide-react';
import type { CompanyProposalPortal } from '../src/lib/proposalPortal';
import { quickReplyCatalog, type QuickReply } from '../src/lib/proposalQuickReplies';

/** Sugestões para a última mensagem do cliente, logo acima da caixa de resposta. */
export const QuickReplyChips: React.FC<{
    replies: QuickReply[];
    current: string;
    onChoose: (reply: QuickReply) => void;
}> = ({ replies, current, onChoose }) => (
    <div className="-mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3 text-xs font-medium [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Respostas rápidas">
        {replies.map(reply => {
            const active = current === reply.text;
            return (
                <button key={reply.id} type="button" aria-pressed={active} onClick={() => onChoose(reply)} title={reply.technique}
                    className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 transition-colors ${active ? 'border-blue-600 bg-blue-600 text-white' : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-body)] hover:border-blue-400'}`}>
                    {reply.label}
                </button>
            );
        })}
    </div>
);

/** Todas as respostas prontas, por assunto (inclusive quando a empresa falou por último). */
export const QuickRepliesModal: React.FC<{
    portal: CompanyProposalPortal;
    installation: Date | null;
    onChoose: (reply: QuickReply) => void;
    onClose: () => void;
}> = ({ portal, installation, onChoose, onClose }) => {
    const catalog = useMemo(() => quickReplyCatalog(portal, installation), [portal, installation]);

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10035] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Respostas prontas">
            <button type="button" className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Fechar" />
            <section className="relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[26px] bg-[var(--surface)] shadow-2xl sm:mx-4 sm:rounded-[26px]">
                <div className="flex items-start gap-3 p-5 pb-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white"><Sparkles className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-semibold text-[var(--text-strong)]">Respostas prontas</h2>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Toque para usar. Você pode editar antes de enviar.</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"><X className="h-4 w-4" /></button>
                </div>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}>
                    {catalog.map(group => (
                        <section key={group.topic} aria-label={group.label}>
                            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{group.label}</h3>
                            <div className="mt-1.5 space-y-2">
                                {group.replies.map(reply => (
                                    <button key={reply.id} type="button" onClick={() => onChoose(reply)}
                                        className="w-full rounded-2xl border border-[var(--border-subtle)] p-3.5 text-left transition hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/25">
                                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                            <span className="font-semibold text-[var(--text-strong)]">{reply.label}</span>
                                            {reply.technique ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{reply.technique}</span> : null}
                                        </span>
                                        <span className="mt-1 block whitespace-pre-line text-xs leading-5 text-[var(--text-muted)] [overflow-wrap:anywhere]">{reply.text}</span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </section>
        </div>,
        document.body,
    );
};
