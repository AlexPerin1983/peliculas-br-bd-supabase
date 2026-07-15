import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { CalendarClock, Check, Clock3, LoaderCircle, PencilLine, X } from 'lucide-react';
import { getProposalCondition } from '../../src/lib/proposalCondition';
import { updateProposalPortalCondition, type CompanyProposalPortal } from '../../src/lib/proposalPortal';

type CompanyProposal = CompanyProposalPortal['proposals'][number];

interface ProposalConditionModalProps {
    isOpen: boolean;
    mode: 'extend' | 'edit';
    portal: CompanyProposalPortal;
    proposal: CompanyProposal;
    onClose: () => void;
    onSaved: () => void | Promise<void>;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const toLocalInputValue = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
};

const ProposalConditionModal: React.FC<ProposalConditionModalProps> = ({ isOpen, mode, portal, proposal, onClose, onSaved }) => {
    const condition = useMemo(() => getProposalCondition(proposal), [proposal]);
    const originalValue = condition?.originalValue || Math.max(proposal.total, proposal.conditionOriginalValue || 0);
    const currentFinalValue = condition?.finalValue || proposal.total;
    const [expiresAt, setExpiresAt] = useState('');
    const [finalValue, setFinalValue] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const currentExpiry = condition?.expiresAt ? new Date(condition.expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);
        setExpiresAt(toLocalInputValue(currentExpiry.getTime() > Date.now() ? currentExpiry : new Date(Date.now() + 24 * 60 * 60 * 1000)));
        setFinalValue(currentFinalValue.toFixed(2).replace('.', ','));
        setError('');
    }, [condition?.expiresAt, currentFinalValue, isOpen]);

    if (!isOpen) return null;

    const chooseExtension = (hours: number) => {
        const base = Math.max(Date.now(), condition?.expiresAt ? new Date(condition.expiresAt).getTime() : 0);
        setExpiresAt(toLocalInputValue(new Date(base + hours * 60 * 60 * 1000)));
        setError('');
    };

    const save = async () => {
        const expiry = new Date(expiresAt);
        if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
            setError('Escolha uma data e hora futuras.');
            return;
        }

        const parsedFinal = Number(finalValue.replace(/\./g, '').replace(',', '.'));
        if (mode === 'edit' && (!Number.isFinite(parsedFinal) || parsedFinal < 0 || parsedFinal > originalValue)) {
            setError(`O valor final precisa ficar entre R$ 0,00 e ${currency.format(originalValue)}.`);
            return;
        }

        setBusy(true);
        setError('');
        try {
            await updateProposalPortalCondition(
                portal.id,
                proposal.id,
                expiry.toISOString(),
                mode === 'edit' ? parsedFinal : undefined
            );
            await onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível atualizar a condição.');
        } finally {
            setBusy(false);
        }
    };

    const parsedPreview = Number(finalValue.replace(/\./g, '').replace(',', '.'));
    const savingsPreview = Number.isFinite(parsedPreview) ? Math.max(0, originalValue - parsedPreview) : 0;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10030] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={mode === 'extend' ? 'Prorrogar desconto' : 'Alterar condição'}>
            <button type="button" className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Fechar" />
            <section className="relative w-full max-w-lg overflow-hidden rounded-t-[26px] bg-white shadow-2xl dark:bg-slate-900 sm:mx-4 sm:rounded-[26px]">
                <header className="flex items-start gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">{mode === 'extend' ? <CalendarClock className="h-5 w-5" /> : <PencilLine className="h-5 w-5" />}</span>
                    <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.14em] text-blue-600">{portal.clientName}</p><h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{mode === 'extend' ? 'Prorrogar desconto' : 'Alterar condição'}</h2><p className="mt-1 truncate text-xs text-slate-500">{proposal.name}</p></div>
                    <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar"><X className="h-4 w-4" /></button>
                </header>

                <div className="space-y-5 p-5">
                    <div>
                        <p className="mb-2 text-xs font-black text-slate-700 dark:text-slate-200">Atalhos de prazo</p>
                        <div className="grid grid-cols-3 gap-2">
                            <button type="button" onClick={() => chooseExtension(24)} className="rounded-xl border border-slate-200 px-2 py-3 text-xs font-black text-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-200">+24 horas</button>
                            <button type="button" onClick={() => chooseExtension(48)} className="rounded-xl border border-slate-200 px-2 py-3 text-xs font-black text-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-200">+48 horas</button>
                            <button type="button" onClick={() => chooseExtension(72)} className="rounded-xl border border-slate-200 px-2 py-3 text-xs font-black text-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-200">+3 dias</button>
                        </div>
                    </div>

                    <label className="block"><span className="mb-1.5 flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-200"><Clock3 className="h-4 w-4 text-blue-600" /> Data e hora do vencimento</span><input type="datetime-local" value={expiresAt} min={toLocalInputValue(new Date())} onChange={event => setExpiresAt(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>

                    {mode === 'edit' ? <div className="space-y-3"><label className="block"><span className="mb-1.5 block text-xs font-black text-slate-700 dark:text-slate-200">Novo valor final</span><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">R$</span><input type="text" inputMode="decimal" value={finalValue} onChange={event => setFinalValue(event.target.value.replace(/[^\d.,]/g, ''))} className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-lg font-black text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></div><span className="mt-2 flex justify-between text-[11px] font-semibold text-slate-500"><span>Original: {currency.format(originalValue)}</span><span className="text-emerald-600">Economia: {currency.format(savingsPreview)}</span></span></label><p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-800 dark:bg-amber-950/25 dark:text-amber-200">O PDF permanece como registro da proposta original. A nova condição fica registrada neste link e no momento da aprovação.</p></div> : <div className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/25"><p className="text-[10px] font-black uppercase tracking-[.12em] text-blue-600 dark:text-blue-300">Condição mantida</p><p className="mt-1 text-xl font-black text-slate-950 dark:text-white">{currency.format(currentFinalValue)}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Somente o prazo será alterado.</p></div>}

                    {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}
                </div>

                <footer className="border-t border-slate-100 p-4 dark:border-slate-800"><button type="button" disabled={busy} onClick={() => void save()} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black text-white disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {busy ? 'Salvando…' : mode === 'extend' ? 'Prorrogar condição' : 'Salvar nova condição'}</button></footer>
            </section>
        </div>,
        document.body
    );
};

export default ProposalConditionModal;
