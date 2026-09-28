import React, { useEffect, useMemo, useState } from 'react';
import { BadgePercent, Check, Copy, Gift, LoaderCircle, MessageCircle } from 'lucide-react';
import Modal from './ui/Modal';
import type { Client, SavedPDF } from '../types';
import { recordProposalFollowUp, sendCompanyProposalMessage, setProposalOfferDeadline, type CompanyProposalPortal } from '../src/lib/proposalPortal';
import { buildBonusOfferMessage, buildOfferMessage, formatDeadline, OFFER_BONUS_PRESETS, OFFER_DEADLINE_PRESETS, offerDeadline } from '../src/lib/proposalFollowUpQueue';
import { getFollowUpBase, previewProposalFollowUp } from '../src/lib/proposalFollowUp';
import { buildProposalWhatsAppUrl, type FollowUpDiscountType } from '../src/lib/proposalMessages';
import { getClientById, getSavedPdfById } from '../services/supabaseDb';
import { applyProposalFollowUp } from '../services/proposalFollowUp';

interface ProposalOfferSheetProps {
    isOpen: boolean;
    portal: CompanyProposalPortal;
    // Passo do acompanhamento em que a oferta foi feita (vai para o histórico do contato).
    step: string;
    onClose: () => void;
    onApplied: () => Promise<void> | void;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const todayInput = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const area = document.createElement('textarea');
    area.value = value;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
};

/** Condição especial com prazo: desconto na proposta (PDF novo) ou brinde sem baixar o preço, com o prazo no link. */
const ProposalOfferSheet: React.FC<ProposalOfferSheetProps> = ({ isOpen, portal, step, onClose, onApplied }) => {
    const [proposalId, setProposalId] = useState<number>(portal.proposals[0]?.id);
    const [pdf, setPdf] = useState<SavedPDF | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(false);
    // Brinde em vez de desconto: mantém o valor e acrescenta algo (garantia, remoção, prioridade…).
    const [mode, setMode] = useState<'discount' | 'bonus'>('discount');
    const [bonusPick, setBonusPick] = useState(OFFER_BONUS_PRESETS[0].phrase);
    const [bonusCustom, setBonusCustom] = useState('');
    const [type, setType] = useState<FollowUpDiscountType>('percentage');
    const [raw, setRaw] = useState('10');
    const [preset, setPreset] = useState<string>('48h');
    const [customDate, setCustomDate] = useState(todayInput);
    const [stage, setStage] = useState<'form' | 'saving' | 'done'>('form');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setStage('form');
        setError('');
        setMessage('');
    }, [isOpen]);

    // A proposta e o cliente completos (para gerar o PDF novo com o desconto).
    useEffect(() => {
        if (!isOpen || proposalId == null) return;
        let active = true;
        setLoading(true);
        setPdf(null);
        Promise.all([getSavedPdfById(proposalId), getClientById(portal.clientId)])
            .then(([nextPdf, nextClient]) => {
                if (!active) return;
                setPdf(nextPdf);
                setClient(nextClient);
                if (!nextPdf || !nextClient) setError('Não foi possível carregar a proposta.');
            })
            .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar a proposta.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [isOpen, proposalId, portal.clientId]);

    const deadline = useMemo(() => offerDeadline(preset === 'custom' ? customDate : preset), [preset, customDate]);
    const preview = useMemo(() => (pdf ? previewProposalFollowUp(pdf, raw, type) : null), [pdf, raw, type]);
    const base = pdf ? getFollowUpBase(pdf) : 0;
    const discountLabel = type === 'percentage'
        ? `${(preview?.followUpDiscountPercent ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
        : currency.format(preview?.followUpDiscountAmount ?? 0);
    const bonus = (bonusPick === 'custom' ? bonusCustom : bonusPick).trim();
    const invalid = mode === 'bonus'
        ? !bonus ? 'Escolha ou escreva o brinde.' : !(deadline.getTime() > Date.now()) ? 'Escolha um prazo futuro.' : ''
        : !preview || (preview.followUpDiscountAmount ?? 0) <= 0
            ? 'Informe um desconto maior que zero.'
            : !(deadline.getTime() > Date.now())
                ? 'Escolha um prazo futuro.'
                : '';

    const apply = async () => {
        if (invalid) return;
        if (mode === 'bonus') {
            setStage('saving');
            setError('');
            try {
                await setProposalOfferDeadline(portal.id, deadline, `Brinde: ${bonus} até ${deadline.toLocaleDateString('pt-BR')}`);
                // Aparece na conversa da página do cliente, junto da contagem regressiva.
                await sendCompanyProposalMessage(portal.id, `Condição especial até ${formatDeadline(deadline)}: mantendo o valor da proposta, incluímos ${bonus} sem custo.`);
                setMessage(buildBonusOfferMessage(portal, { bonus, deadline }));
                setStage('done');
                await onApplied();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Não foi possível aplicar a condição. Tente novamente.');
                setStage('form');
            }
            return;
        }
        if (!pdf || !client || !preview) return;
        setStage('saving');
        setError('');
        try {
            await applyProposalFollowUp(pdf, client, raw, type);
            await setProposalOfferDeadline(portal.id, deadline, `${discountLabel} · de ${currency.format(base)} por ${currency.format(preview.totalPreco)} até ${deadline.toLocaleDateString('pt-BR')}`);
            setMessage(buildOfferMessage(portal, { from: base, to: preview.totalPreco, discountLabel, deadline }));
            setStage('done');
            await onApplied();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível aplicar a condição. Tente novamente.');
            setStage('form');
        }
    };

    const whatsappUrl = message ? buildProposalWhatsAppUrl(portal.clientPhone || undefined, message) : null;

    const footer = stage === 'done' ? (
        <div className="flex w-full gap-2 text-sm font-semibold">
            <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-[var(--border-subtle)] text-[var(--text-body)]">Fechar</button>
            {whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => { void recordProposalFollowUp(portal.id, step, 'whatsapp').then(() => onApplied()).catch(() => undefined); }}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white">
                    <MessageCircle className="h-4 w-4" aria-hidden="true" /> Enviar no WhatsApp
                </a>
            ) : (
                <button type="button" onClick={() => { void copyText(message).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }); }}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 text-white">
                    {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />} {copied ? 'Mensagem copiada' : 'Copiar mensagem'}
                </button>
            )}
        </div>
    ) : (
        <div className="flex w-full gap-2 text-sm font-semibold">
            <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-[var(--border-subtle)] text-[var(--text-body)]">Cancelar</button>
            <button type="button" onClick={() => void apply()} disabled={Boolean(invalid) || (mode === 'discount' && loading) || stage === 'saving'}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 text-white disabled:opacity-50">
                {stage === 'saving' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : mode === 'bonus' ? <Gift className="h-4 w-4" aria-hidden="true" /> : <BadgePercent className="h-4 w-4" aria-hidden="true" />}
                {stage === 'saving' ? 'Aplicando…' : 'Aplicar condição'}
            </button>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Condição especial" footer={footer} keyboardAwareFooter>
            {stage === 'done' ? (
                <div className="space-y-4 text-sm">
                    <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                        <p className="font-semibold">Condição aplicada</p>
                        <p className="mt-1 text-[13px] leading-5">
                            {mode === 'bonus'
                                ? `O valor continua o mesmo. O brinde aparece na conversa da página do cliente, com a contagem regressiva até ${formatDeadline(deadline)}.`
                                : `O PDF e o valor da proposta foram atualizados. O link mostra a contagem regressiva até ${formatDeadline(deadline)}.`}
                        </p>
                    </div>
                    <label className="block">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">Mensagem para {portal.clientName}</span>
                        <textarea value={message} onChange={event => setMessage(event.target.value)} rows={6} aria-label="Mensagem da condição especial" style={{ fontSize: 16 }}
                            className="mt-1 w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 leading-6 text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    </label>
                </div>
            ) : (
                <div className="space-y-5 text-sm">
                    <div className="grid grid-cols-2 rounded-xl bg-[var(--surface-muted)] p-1 text-[13px] font-semibold" role="group" aria-label="Tipo de condição">
                        <button type="button" aria-pressed={mode === 'discount'} onClick={() => setMode('discount')} className={`flex h-9 items-center justify-center gap-1.5 rounded-lg ${mode === 'discount' ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
                            <BadgePercent className="h-4 w-4" aria-hidden="true" /> Desconto
                        </button>
                        <button type="button" aria-pressed={mode === 'bonus'} onClick={() => setMode('bonus')} className={`flex h-9 items-center justify-center gap-1.5 rounded-lg ${mode === 'bonus' ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
                            <Gift className="h-4 w-4" aria-hidden="true" /> Brinde
                        </button>
                    </div>

                    <p className="text-[13px] leading-5 text-[var(--text-muted)]">
                        {mode === 'bonus'
                            ? 'Mantém o preço e acrescenta valor, sem baixar o seu ganho. O prazo vira a validade do link e o brinde aparece na conversa da página do cliente.'
                            : 'O desconto entra na proposta (com PDF novo) e o prazo vira a validade do link: o cliente vê a contagem regressiva. Depois do prazo, o link vence.'}
                    </p>

                    {mode === 'bonus' ? (
                        <div>
                            <span className="text-xs font-semibold text-[var(--text-muted)]">Brinde</span>
                            <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold" role="group" aria-label="Escolha o brinde">
                                {[...OFFER_BONUS_PRESETS, { label: 'Outro', phrase: 'custom' }].map(option => (
                                    <button key={option.phrase} type="button" aria-pressed={bonusPick === option.phrase} onClick={() => setBonusPick(option.phrase)}
                                        className={`h-8 rounded-full border px-3 ${bonusPick === option.phrase ? 'border-blue-600 bg-blue-600 text-white' : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]'}`}>
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                            {bonusPick === 'custom' ? (
                                <input value={bonusCustom} onChange={event => setBonusCustom(event.target.value)} placeholder="Ex.: a película da porta de entrada" aria-label="Qual brinde"
                                    style={{ fontSize: 16 }} className="mt-2 h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-strong)]" />
                            ) : null}
                        </div>
                    ) : null}

                    {mode === 'discount' && portal.proposals.length > 1 ? (
                        <label className="block">
                            <span className="text-xs font-semibold text-[var(--text-muted)]">Opção</span>
                            <select value={proposalId} onChange={event => setProposalId(Number(event.target.value))} aria-label="Opção da proposta" style={{ fontSize: 16 }}
                                className="mt-1 h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-strong)]">
                                {portal.proposals.map(proposal => <option key={proposal.id} value={proposal.id}>{proposal.name}</option>)}
                            </select>
                        </label>
                    ) : null}

                    {mode === 'discount' ? <div>
                        <span className="text-xs font-semibold text-[var(--text-muted)]">Desconto</span>
                        <div className="mt-1 flex gap-2">
                            <div className="grid shrink-0 grid-cols-2 rounded-xl bg-[var(--surface-muted)] p-1 text-[13px] font-semibold" role="group" aria-label="Tipo de desconto">
                                <button type="button" aria-pressed={type === 'percentage'} onClick={() => setType('percentage')} className={`h-9 rounded-lg px-3 ${type === 'percentage' ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-sm' : 'text-[var(--text-muted)]'}`}>%</button>
                                <button type="button" aria-pressed={type === 'fixed'} onClick={() => setType('fixed')} className={`h-9 rounded-lg px-3 ${type === 'fixed' ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-sm' : 'text-[var(--text-muted)]'}`}>R$</button>
                            </div>
                            <input value={raw} onChange={event => setRaw(event.target.value)} inputMode="decimal" aria-label={type === 'percentage' ? 'Desconto em porcentagem' : 'Desconto em reais'} style={{ fontSize: 16 }}
                                className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 font-semibold tabular-nums text-[var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                        </div>
                        <div className="mt-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5" aria-live="polite">
                            {loading ? (
                                <p className="flex items-center gap-2 text-[var(--text-muted)]"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando a proposta…</p>
                            ) : preview ? (
                                <p className="text-[var(--text-body)]">
                                    De <span className="tabular-nums line-through opacity-70">{currency.format(base)}</span> por{' '}
                                    <span className="text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{currency.format(preview.totalPreco)}</span>
                                    {(preview.followUpDiscountAmount ?? 0) > 0 ? <span className="text-[var(--text-muted)]"> · economia de {currency.format(preview.followUpDiscountAmount ?? 0)}</span> : null}
                                </p>
                            ) : null}
                        </div>
                    </div> : null}

                    <div>
                        <span className="text-xs font-semibold text-[var(--text-muted)]">Vale por</span>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold" role="group" aria-label="Prazo da condição">
                            {[...OFFER_DEADLINE_PRESETS, { id: 'custom', label: 'Outra data' }].map(option => (
                                <button key={option.id} type="button" aria-pressed={preset === option.id} onClick={() => setPreset(option.id)}
                                    className={`h-8 rounded-full border px-3 ${preset === option.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]'}`}>
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        {preset === 'custom' ? (
                            <input type="date" value={customDate} min={todayInput()} onChange={event => setCustomDate(event.target.value)} aria-label="Data final da condição" style={{ fontSize: 16 }}
                                className="mt-2 h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-strong)]" />
                        ) : null}
                        <p className="mt-2 text-xs text-[var(--text-muted)]">Até {formatDeadline(deadline)}.</p>
                    </div>

                    {error || (invalid && (preview || mode === 'bonus')) ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error || invalid}</p> : null}
                </div>
            )}
        </Modal>
    );
};

export default ProposalOfferSheet;
