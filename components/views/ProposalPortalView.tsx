import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    Check,
    CheckCircle2,
    ChevronRight,
    Download,
    FileText,
    HandCoins,
    LoaderCircle,
    MessageCircle,
    MessageSquareText,
    Send,
    ThumbsDown,
    X,
} from 'lucide-react';
import {
    buildProposalDecisionWhatsAppMessage,
    openPublicProposalPdf,
    loadPublicProposalPortal,
    type ProposalOfferType,
    type ProposalPortalDecision,
    type PublicProposalPortal,
    respondToPublicProposal,
    sendPublicProposalMessage,
} from '../../src/lib/proposalPortal';
import { formatConditionExpiry, getProposalCondition } from '../../src/lib/proposalCondition';
import { buildProposalPaymentOptions } from '../../src/lib/paymentConditions';
import { buildProposalWhatsAppUrl } from '../../src/lib/proposalMessages';
import type { ProposalPaymentChoice, ProposalPaymentSelection } from '../../types';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const formatRemaining = (expiresAt: string, now: number) => {
    const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
    const days = Math.floor(remaining / 86_400_000);
    const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    const seconds = Math.floor((remaining % 60_000) / 1000);
    return { remaining, days, hours, minutes, seconds };
};

const formatLongDate = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

// Texto legível sobre a cor da empresa (cores claras pedem texto escuro).
const readableInk = (hex: string) => {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) return '#ffffff';
    const value = parseInt(match[1], 16);
    const luminance = (0.2126 * ((value >> 16) & 255) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255)) / 255;
    return luminance > 0.62 ? '#111827' : '#ffffff';
};

const Radio: React.FC<{ active: boolean }> = ({ active }) => (
    <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${active ? 'border-[var(--portal-brand)]' : 'border-slate-300'}`} aria-hidden="true">
        {active ? <span className="h-2 w-2 rounded-full bg-[var(--portal-brand)]" /> : null}
    </span>
);

const buildLocalDemoPortal = (): PublicProposalPortal => {
    const expires = new Date();
    expires.setDate(expires.getDate() + 3);
    expires.setHours(23, 59, 59, 0);
    const paymentConfig = {
        prazoPagamento: '',
        paymentMethods: [
            { tipo: 'pix' as const, ativo: true, porcentagem: 5 },
            { tipo: 'boleto' as const, ativo: true },
            { tipo: 'parcelado_sem_juros' as const, ativo: true, parcelas_max: 4 },
            { tipo: 'parcelado_com_juros' as const, ativo: true, parcelas_max: 12, calculation_mode: 'operator_fee' as const, operator_fee_rates: { '5': 6, '6': 7, '7': 8, '8': 9, '9': 10, '10': 11, '11': 12, '12': 13 } },
        ],
    };
    return {
        portal: {
            id: 'demo',
            token: 'demo',
            expires_at: expires.toISOString(),
            status: 'active',
            expired: false,
        },
        clientName: 'Marcos Oliveira',
        company: {
            name: 'Películas Brasil',
            phone: '(85) 99999-0000',
            colors: { primaria: '#155eef', secundaria: '#0f172a' },
        },
        proposals: [
            { id: 101, proposalOptionName: 'Opção Premium', nomeArquivo: 'proposta-premium.pdf', totalPreco: 4850, totalM2: 36.8, date: new Date().toISOString(), status: 'pending', conditionOriginalValue: 5350, conditionFinalValue: 4850, conditionDiscountAmount: 500, conditionDiscountPercent: 9.35, conditionExpiresAt: expires.toISOString(), paymentConfig },
            { id: 102, proposalOptionName: 'Opção Essencial', nomeArquivo: 'proposta-essencial.pdf', totalPreco: 3290, totalM2: 36.8, date: new Date().toISOString(), status: 'pending', paymentConfig },
        ],
        messages: [
            { id: 1, sender_type: 'company', kind: 'message', body: 'Olá, Marcos! Se tiver qualquer dúvida sobre as opções, pode falar comigo por aqui.', created_at: new Date(Date.now() - 3_600_000).toISOString() },
        ],
    };
};

const Confetti: React.FC = () => (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">
        {Array.from({ length: 72 }, (_, index) => (
            <i
                key={index}
                className="absolute -top-5 h-3 w-2 animate-[portal-confetti_2.8s_ease-out_forwards] rounded-[2px]"
                style={{
                    left: `${(index * 37) % 100}%`,
                    background: ['#2563eb', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'][index % 5],
                    animationDelay: `${(index % 12) * 45}ms`,
                    transform: `rotate(${index * 31}deg)`,
                }}
            />
        ))}
    </div>
);

interface ResponseModalProps {
    kind: ProposalPortalDecision;
    proposalName: string;
    proposalValue: number;
    busy: boolean;
    initialBody?: string;
    paymentOptions?: ProposalPaymentSelection[];
    initialPaymentKey?: string;
    onClose: () => void;
    onSubmit: (payload: { body?: string; offerType?: ProposalOfferType; offerValue?: number; paymentChoice?: ProposalPaymentChoice }) => void;
}

const ResponseModal: React.FC<ResponseModalProps> = ({ kind, proposalName, proposalValue, busy, initialBody = '', paymentOptions = [], initialPaymentKey = '', onClose, onSubmit }) => {
    const [body, setBody] = useState(initialBody);
    const [offerType, setOfferType] = useState<ProposalOfferType>('fixed');
    const [offerValue, setOfferValue] = useState('');
    const [error, setError] = useState('');
    const [paymentKey, setPaymentKey] = useState(initialPaymentKey);
    const [changingPayment, setChangingPayment] = useState(false);
    const chosenPayment = paymentOptions.find(option => `${option.methodType}:${option.installments}` === paymentKey);

    const submit = () => {
        if (kind === 'rejected' && !body.trim()) {
            setError('Conte o principal motivo para a empresa entender sua decisão.');
            return;
        }
        if (kind === 'negotiation') {
            const parsed = Number(offerValue.replace(',', '.'));
            if (!Number.isFinite(parsed) || parsed < 0 || (offerType === 'percentage' && parsed > 100)) {
                setError(offerType === 'percentage' ? 'Informe um percentual entre 0 e 100.' : 'Informe o valor que deseja pagar.');
                return;
            }
            onSubmit({ body: body.trim(), offerType, offerValue: parsed });
            return;
        }
        if (kind === 'approved' && paymentOptions.length > 0) {
            const selectedPayment = paymentOptions.find(option => `${option.methodType}:${option.installments}` === paymentKey);
            if (!selectedPayment) {
                setError('Escolha como deseja pagar para continuar.');
                return;
            }
            onSubmit({
                body: body.trim(),
                paymentChoice: {
                    methodType: selectedPayment.methodType,
                    installments: selectedPayment.installments,
                },
            });
            return;
        }
        onSubmit({ body: body.trim() });
    };

    const title = kind === 'approved' ? 'Aprovar proposta' : kind === 'rejected' ? 'Recusar proposta' : 'Fazer uma contraproposta';

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true">
            <button className="absolute inset-0" onClick={onClose} aria-label="Fechar janela" />
            <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm text-slate-500">{proposalName}</p>
                        <h2 className="mt-0.5 text-xl font-semibold tracking-[-0.01em] text-slate-950">{title}</h2>
                    </div>
                    <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-label="Fechar">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {kind === 'approved' ? (
                    <>
                        <p className="mt-3 text-sm leading-6 text-slate-500">
                            Ao confirmar, a empresa é avisada na hora para combinar a instalação com você.
                        </p>
                        {chosenPayment && !changingPayment ? (
                            // Já escolhido na página: mostra o resumo, com opção de trocar.
                            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-black/[0.08] px-4 py-3">
                                <span className="min-w-0">
                                    <span className="block text-xs text-slate-500">Forma de pagamento</span>
                                    <span className="block text-[15px] font-medium text-slate-900">{chosenPayment.installments > 1 ? `${chosenPayment.installments}x de ${currency.format(chosenPayment.installmentValue)}${chosenPayment.methodType === 'parcelado_sem_juros' ? ' sem juros' : ''}` : chosenPayment.label}</span>
                                    <span className="block text-xs tabular-nums text-slate-500">Total {currency.format(chosenPayment.customerTotal)}{chosenPayment.lastInstallmentValue != null ? ` · última ${currency.format(chosenPayment.lastInstallmentValue)}` : ''}</span>
                                </span>
                                <button type="button" onClick={() => setChangingPayment(true)} className="shrink-0 text-sm font-medium text-[var(--portal-brand)]">Alterar</button>
                            </div>
                        ) : paymentOptions.length > 0 ? (
                            <div className="mt-5">
                                <p className="text-sm font-semibold text-slate-900">Forma de pagamento</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">Escolha uma condição para ver e registrar o valor final.</p>
                                <div className="mt-3 max-h-[260px] space-y-2 overflow-y-auto pr-1">
                                    {paymentOptions.map(option => {
                                        const key = `${option.methodType}:${option.installments}`;
                                        const selected = paymentKey === key;
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => { setPaymentKey(key); setError(''); }}
                                                className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${selected ? 'border-[var(--portal-brand)] bg-[var(--portal-brand)]/[0.05]' : 'border-black/[0.08] bg-white hover:border-black/20'}`}
                                            >
                                                <span>
                                                    <span className="block text-sm font-medium text-slate-900">{option.label}</span>
                                                    {option.discountPercent > 0 ? <span className="mt-0.5 block text-xs text-emerald-700">Você economiza {currency.format(option.baseTotal - option.customerTotal)}</span> : null}
                                                </span>
                                                <span className="shrink-0 text-right">
                                                    <span className="block text-sm font-semibold tabular-nums text-slate-950">{option.installments > 1 ? `${option.installments}x de ${currency.format(option.installmentValue)}` : currency.format(option.customerTotal)}</span>
                                                    {option.installments > 1 ? <span className="text-[11px] tabular-nums text-slate-500">total {currency.format(option.customerTotal)}{option.lastInstallmentValue != null ? ` · última ${currency.format(option.lastInstallmentValue)}` : ''}</span> : null}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}
                    </>
                ) : null}

                {kind === 'negotiation' ? (
                    <div className="mt-6 space-y-4">
                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                            <p className="text-xs text-slate-500">Valor atual</p>
                            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{currency.format(proposalValue)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                            <button type="button" onClick={() => setOfferType('fixed')} className={`h-10 rounded-lg text-sm font-medium ${offerType === 'fixed' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Valor que pagaria</button>
                            <button type="button" onClick={() => setOfferType('percentage')} className={`h-10 rounded-lg text-sm font-medium ${offerType === 'percentage' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Desconto em %</button>
                        </div>
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-slate-700">{offerType === 'fixed' ? 'Quanto deseja pagar?' : 'Qual desconto deseja?'}</span>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-slate-400">{offerType === 'fixed' ? 'R$' : '%'}</span>
                                <input autoFocus type="number" inputMode="decimal" min="0" max={offerType === 'percentage' ? 100 : undefined} value={offerValue} onChange={event => setOfferValue(event.target.value)} className="h-14 w-full rounded-xl border border-black/[0.1] bg-white pl-12 pr-4 text-lg font-semibold tabular-nums text-slate-950 outline-none focus:border-[var(--portal-brand)] focus:ring-4 focus:ring-[var(--portal-brand)]/10" placeholder="0,00" />
                            </div>
                        </label>
                    </div>
                ) : null}

                {kind !== 'approved' ? (
                    <label className="mt-4 block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">{kind === 'rejected' ? 'Por que esta proposta não funcionou para você?' : 'Observação para a empresa (opcional)'}</span>
                        <textarea value={body} onChange={event => setBody(event.target.value)} rows={4} className="w-full resize-none rounded-xl border border-black/[0.1] p-3 text-[15px] text-slate-900 outline-none focus:border-[var(--portal-brand)] focus:ring-4 focus:ring-[var(--portal-brand)]/10" placeholder={kind === 'rejected' ? 'Ex.: o prazo não atende, escolhi outra solução, valor acima do esperado…' : 'Explique sua condição ou tire uma dúvida.'} />
                    </label>
                ) : null}

                {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
                <button type="button" disabled={busy} onClick={submit} className={`mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-medium disabled:opacity-60 ${kind === 'rejected' ? 'bg-red-600 text-white' : 'bg-[var(--portal-brand)] text-[var(--portal-brand-ink)]'}`}>
                    {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : kind === 'approved' ? <Check className="h-5 w-5" /> : kind === 'rejected' ? <ThumbsDown className="h-5 w-5" /> : <HandCoins className="h-5 w-5" />}
                    {busy ? 'Enviando…' : kind === 'approved' ? 'Confirmar aprovação' : kind === 'rejected' ? 'Enviar recusa' : 'Enviar contraproposta'}
                </button>
            </div>
        </div>
    );
};

type ConversationReason = 'negotiate' | 'question' | 'later' | 'decline';

const CONVERSATION_REASONS: Array<{ id: ConversationReason; label: string; hint: string }> = [
    { id: 'negotiate', label: 'Quero ajustar a proposta', hint: 'Valor, pagamento, prazo ou algum detalhe.' },
    { id: 'question', label: 'Tenho uma dúvida', hint: 'Fale diretamente com a empresa.' },
    { id: 'later', label: 'Prefiro falar mais tarde', hint: 'Escolha quando deseja retomar.' },
    { id: 'decline', label: 'Não vou seguir agora', hint: 'Encerre este acompanhamento sem complicação.' },
];

const FOLLOW_UP_OPTIONS = ['Em 7 dias', 'Em 15 dias', 'Em 30 dias'];

const DecisionAssistantModal: React.FC<{
    busy: boolean;
    onClose: () => void;
    onMessage: (body: string) => void;
    onNegotiate: (body: string) => void;
    onReject: (body: string) => void;
}> = ({ busy, onClose, onMessage, onNegotiate, onReject }) => {
    const [selectedId, setSelectedId] = useState<ConversationReason | ''>('');
    const [choice, setChoice] = useState('');
    const [detail, setDetail] = useState('');
    const selected = CONVERSATION_REASONS.find(reason => reason.id === selectedId);

    const selectReason = (id: ConversationReason | '') => {
        setSelectedId(id);
        setChoice('');
        setDetail('');
    };

    const canSubmit = Boolean(selected)
        && (selectedId !== 'later' || Boolean(choice))
        && (!['negotiate', 'question'].includes(selectedId) || Boolean(detail.trim()));

    const submit = () => {
        if (!selected || !canSubmit) return;
        if (selectedId === 'negotiate') onNegotiate(`Quero ajustar a proposta: ${detail.trim()}`);
        else if (selectedId === 'question') onMessage(`Tenho uma dúvida sobre a proposta: ${detail.trim()}`);
        else if (selectedId === 'later') onMessage(`Prefiro falar mais tarde: ${choice}.`);
        else onReject(detail.trim() ? `Não vou seguir agora: ${detail.trim()}` : 'Não vou seguir com esta proposta neste momento.');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="Conversar com a empresa">
            <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Fechar janela" />
            <section className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}>
                <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h2 className="text-xl font-semibold tracking-[-0.01em] text-slate-950">{selected ? selected.label : 'Como podemos ajudar?'}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{selected ? 'Só mais uma informação rápida.' : 'Escolha a opção que melhor representa seu momento.'}</p></div><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-label="Fechar"><X className="h-4 w-4" /></button></div>

                {!selected ? <div className="mt-5 space-y-2">{CONVERSATION_REASONS.map(reason => <button key={reason.id} type="button" disabled={busy} onClick={() => selectReason(reason.id)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-black/[0.08] px-4 py-3 text-left transition hover:border-black/20 hover:bg-slate-50 disabled:opacity-50"><span><span className="block text-[15px] font-medium text-slate-900">{reason.label}</span><span className="mt-0.5 block text-[13px] text-slate-500">{reason.hint}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-slate-400" /></button>)}</div> : <div className="mt-5">
                    {selectedId === 'later' ? <div className="grid gap-2">{FOLLOW_UP_OPTIONS.map(item => <button key={item} type="button" onClick={() => setChoice(item)} className={`min-h-11 rounded-xl border px-3 text-left text-[15px] font-medium ${choice === item ? 'border-[var(--portal-brand)] bg-[var(--portal-brand)]/[0.05] text-slate-900' : 'border-black/[0.08] text-slate-700'}`}>{item}</button>)}</div> : null}
                    {selectedId !== 'later' ? <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">{selectedId === 'decline' ? 'Quer contar o motivo? (opcional)' : selectedId === 'question' ? 'Qual é a sua dúvida?' : 'O que gostaria de ajustar?'}</span><textarea autoFocus value={detail} onChange={event => setDetail(event.target.value)} rows={3} placeholder={selectedId === 'decline' ? 'Sua observação ajuda a empresa a melhorar.' : selectedId === 'question' ? 'Escreva sua dúvida.' : 'Ex.: valor, forma de pagamento ou prazo.'} className="w-full resize-none rounded-xl border border-black/[0.1] p-3 text-[15px] outline-none focus:border-[var(--portal-brand)] focus:ring-4 focus:ring-[var(--portal-brand)]/10" /></label> : null}

                    <div className="mt-5 flex gap-2"><button type="button" onClick={() => selectReason('')} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-black/[0.1] text-slate-600" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></button><button type="button" disabled={busy || !canSubmit} onClick={submit} className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-[15px] font-medium disabled:opacity-50 ${selectedId === 'decline' ? 'bg-slate-800 text-white' : 'bg-[var(--portal-brand)] text-[var(--portal-brand-ink)]'}`}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : selectedId === 'decline' ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />} {selectedId === 'decline' ? 'Enviar retorno e encerrar' : 'Enviar para a empresa'}</button></div>
                </div>}
            </section>
        </div>
    );
};

const ProposalPortalView: React.FC = () => {
    const token = useMemo(() => {
        const queryToken = new URLSearchParams(window.location.search).get('token');
        if (queryToken) return queryToken;
        const friendlyMatch = window.location.pathname.match(/^\/p\/[^/]+\/([^/]+)\/?$/);
        return friendlyMatch ? decodeURIComponent(friendlyMatch[1]) : '';
    }, []);
    const [data, setData] = useState<PublicProposalPortal | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [now, setNow] = useState(Date.now());
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [modal, setModal] = useState<ProposalPortalDecision | null>(null);
    const [busy, setBusy] = useState(false);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [message, setMessage] = useState('');
    const [confetti, setConfetti] = useState(false);
    const [decisionAssistant, setDecisionAssistant] = useState(false);
    const [responseInitialBody, setResponseInitialBody] = useState('');
    const [selectedPaymentKey, setSelectedPaymentKey] = useState('');
    const portalActivityRef = useRef<string | undefined>(undefined);

    const reload = useCallback(async (trackView = false) => {
        if (import.meta.env.DEV && token === 'demo') {
            const demo = buildLocalDemoPortal();
            setData(demo);
            setSelectedId(current => current ?? demo.proposals[0]?.id ?? null);
            setLoading(false);
            return;
        }
        if (!token) {
            setError('O endereço desta proposta está incompleto.');
            setLoading(false);
            return;
        }
        try {
            const next = await loadPublicProposalPortal(token, trackView, trackView ? undefined : portalActivityRef.current);
            if ('unchanged' in next) {
                portalActivityRef.current = next.lastActivityAt;
                setError('');
                return;
            }
            portalActivityRef.current = next.portal.last_activity_at;
            setData(next);
            setSelectedId(current => current ?? next.proposals[0]?.id ?? null);
            setError('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível abrir esta proposta.');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { void reload(true); }, [reload]);
    useEffect(() => {
        const interval = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(interval);
    }, []);
    useEffect(() => {
        if (import.meta.env.DEV && token === 'demo') return;
        const interval = window.setInterval(() => {
            if (document.visibilityState === 'visible') void reload(false);
        }, 30_000);
        const handleVisibility = () => { if (document.visibilityState === 'visible') void reload(false); };
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', handleVisibility);
        window.addEventListener('online', handleVisibility);
        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('focus', handleVisibility);
            window.removeEventListener('online', handleVisibility);
        };
    }, [reload, token]);

    const selected = data?.proposals.find(proposal => proposal.id === selectedId) || data?.proposals[0];
    const remaining = data ? formatRemaining(data.portal.expires_at, now) : null;
    const selectedCondition = getProposalCondition(selected, now);
    const conditionRemaining = selectedCondition ? formatRemaining(selectedCondition.expiresAt, now) : null;
    const isDownloadBlocked = !data || data.portal.expired || remaining?.remaining === 0 || data.portal.status === 'revoked';
    const isClosed = isDownloadBlocked || ['approved', 'rejected'].includes(data.portal.status);
    const isApprovalBlocked = isClosed || Boolean(selectedCondition?.expired);
    const hasFinalDecision = Boolean(data && ['approved', 'rejected', 'revoked'].includes(data.portal.status));
    const brand = data?.company.colors?.primaria || '#155eef';

    const paymentOptions = useMemo(
        () => buildProposalPaymentOptions(selectedCondition?.finalValue ?? selected?.totalPreco ?? 0, selected?.paymentConfig?.paymentMethods || []),
        [selected, selectedCondition?.finalValue],
    );
    const selectedPayment = paymentOptions.find(option => `${option.methodType}:${option.installments}` === selectedPaymentKey);

    const latestDecision = useMemo(() => (
        [...(data?.messages || [])].reverse().find(message => (
            message.sender_type === 'client'
            && ['approved', 'rejected', 'negotiation'].includes(message.kind)
        ))
    ), [data?.messages]);
    const decisionProposal = latestDecision
        ? data?.proposals.find(proposal => proposal.id === latestDecision.saved_pdf_id)
        : undefined;
    const decisionWhatsAppUrl = useMemo(() => {
        if (!data || !latestDecision || !decisionProposal) return null;
        const proposalCondition = getProposalCondition(decisionProposal, now);
        const message = buildProposalDecisionWhatsAppMessage({
            clientName: data.clientName,
            companyName: data.company.name,
            proposalName: decisionProposal.proposalOptionName || decisionProposal.nomeArquivo || 'Proposta',
            proposalValue: latestDecision.condition_value ?? proposalCondition?.finalValue ?? decisionProposal.totalPreco ?? 0,
            decision: latestDecision,
            portalUrl: window.location.href,
        });
        return buildProposalWhatsAppUrl(data.company.phone || undefined, message);
    }, [data, decisionProposal, latestDecision, now]);

    useEffect(() => {
        setSelectedPaymentKey(current => paymentOptions.some(option => `${option.methodType}:${option.installments}` === current) ? current : '');
    }, [paymentOptions]);

    useEffect(() => {
        setSelectedPaymentKey('');
    }, [selected?.id]);

    const startApproval = () => {
        if (paymentOptions.length > 0 && !selectedPayment) {
            document.getElementById('formas-pagamento')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        setModal('approved');
    };

    const performResponse = async (kind: ProposalPortalDecision, payload: { body?: string; offerType?: ProposalOfferType; offerValue?: number; paymentChoice?: ProposalPaymentChoice }) => {
        if (!selected?.id) return;
        setBusy(true);
        try {
            if (import.meta.env.DEV && token === 'demo') {
                const createdAt = new Date().toISOString();
                setData(current => current ? {
                    ...current,
                    portal: { ...current.portal, status: kind === 'approved' ? 'approved' : kind === 'rejected' ? 'rejected' : 'negotiating' },
                    messages: [...current.messages, { id: Date.now(), saved_pdf_id: selected.id, sender_type: 'client', kind, body: payload.body, offer_type: payload.offerType, offer_value: payload.offerValue, created_at: createdAt }],
                } : current);
                if (kind === 'approved') {
                    setConfetti(true);
                    window.setTimeout(() => setConfetti(false), 3200);
                }
                setModal(null);
                setDecisionAssistant(false);
                setResponseInitialBody('');
                return;
            }
            await respondToPublicProposal(token, selected.id, kind, payload);
            if (kind === 'approved') {
                setConfetti(true);
                window.setTimeout(() => setConfetti(false), 3200);
            }
            setModal(null);
            setDecisionAssistant(false);
            setResponseInitialBody('');
            await reload();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível enviar sua resposta.');
        } finally {
            setBusy(false);
        }
    };

    const submitResponse = (payload: { body?: string; offerType?: ProposalOfferType; offerValue?: number; paymentChoice?: ProposalPaymentChoice }) => {
        if (modal) void performResponse(modal, payload);
    };

    const sendMessage = async () => {
        if (!message.trim()) return;
        setBusy(true);
        try {
            if (import.meta.env.DEV && token === 'demo') {
                const body = message.trim();
                setData(current => current ? { ...current, messages: [...current.messages, { id: Date.now(), sender_type: 'client', kind: 'message', body, created_at: new Date().toISOString() }] } : current);
                setMessage('');
                return;
            }
            await sendPublicProposalMessage(token, message);
            setMessage('');
            await reload();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível enviar a mensagem.');
        } finally {
            setBusy(false);
        }
    };

    const sendGuidedMessage = async (body: string) => {
        setBusy(true);
        try {
            if (import.meta.env.DEV && token === 'demo') {
                setData(current => current ? { ...current, messages: [...current.messages, { id: Date.now(), sender_type: 'client', kind: 'message', body, created_at: new Date().toISOString() }] } : current);
            } else {
                await sendPublicProposalMessage(token, body);
                await reload();
            }
            setDecisionAssistant(false);
            window.setTimeout(() => document.getElementById('conversa')?.scrollIntoView({ behavior: 'smooth' }), 50);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível enviar sua resposta.');
        } finally {
            setBusy(false);
        }
    };

    const download = async (proposalId: number) => {
        setDownloadingId(proposalId);
        try {
            if (import.meta.env.DEV && token === 'demo') return;
            await openPublicProposalPdf(token, proposalId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível abrir o PDF.');
        } finally {
            setDownloadingId(null);
        }
    };

    if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#f6f6f3]"><LoaderCircle className="h-7 w-7 animate-spin text-slate-400" /></div>;
    if (!data) return <div className="flex min-h-screen items-center justify-center bg-[#f6f6f3] p-6"><div className="max-w-sm text-center"><FileText className="mx-auto h-8 w-8 text-slate-300" /><h1 className="mt-4 text-xl font-semibold text-slate-900">Proposta indisponível</h1><p className="mt-2 text-sm leading-6 text-slate-500">{error}</p></div></div>;

    const firstName = data.clientName.split(/\s+/)[0];
    const validUntil = formatLongDate(data.portal.expires_at);
    const sentOn = selected?.date ? formatLongDate(selected.date) : null;
    const daysLeft = remaining?.remaining
        ? remaining.days > 1 ? `faltam ${remaining.days} dias` : remaining.days === 1 ? 'falta 1 dia' : `faltam ${Math.max(1, remaining.hours)}h`
        : null;
    const singleProposal = data.proposals.length === 1;
    const cashOptions = paymentOptions.filter(option => option.methodType === 'pix' || option.methodType === 'boleto');
    const cardOptions = paymentOptions.filter(option => option.methodType === 'parcelado_sem_juros' || option.methodType === 'parcelado_com_juros');
    const noInterestTop = cardOptions.filter(option => option.methodType === 'parcelado_sem_juros').at(-1)?.installments ?? 0;
    const selectedCard = selectedPayment && cardOptions.includes(selectedPayment) ? selectedPayment : null;
    const payTotal = selectedCondition?.finalValue ?? selected?.totalPreco ?? 0;
    const optionKey = (option: ProposalPaymentSelection) => `${option.methodType}:${option.installments}`;
    const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const showActionBar = !hasFinalDecision;
    const heading = data.portal.status === 'approved'
        ? `Obrigado, ${firstName}. Proposta aprovada.`
        : data.portal.status === 'rejected' || data.portal.status === 'negotiating'
            ? `${firstName}, recebemos sua resposta.`
            : data.portal.status === 'revoked' || data.portal.status === 'expired' || !remaining?.remaining
                ? `${firstName}, esta proposta foi encerrada.`
                : `${firstName}, sua proposta está pronta.`;

    return (
        <div className="min-h-screen bg-[#f6f6f3] text-slate-900 antialiased" style={{ '--portal-brand': brand, '--portal-brand-ink': readableInk(brand) } as React.CSSProperties}>
            {confetti ? <Confetti /> : null}
            <style>{`@keyframes portal-confetti { 0% { transform: translateY(-5vh) rotate(0); opacity: 1; } 100% { transform: translateY(110vh) rotate(760deg); opacity: .1; } }`}</style>

            <header className="border-b border-black/[0.06] bg-white">
                <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                        {data.company.logo
                            ? <img src={data.company.logo} alt={data.company.name} className="h-9 w-9 rounded-lg object-contain" />
                            : <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--portal-brand)] text-sm font-semibold text-[var(--portal-brand-ink)]">{data.company.name.charAt(0)}</div>}
                        <p className="truncate text-[15px] font-semibold text-slate-900">{data.company.name}</p>
                    </div>
                    {!remaining?.remaining ? <p className="shrink-0 text-xs font-medium text-red-600">Prazo encerrado</p> : null}
                </div>
            </header>

            <main className={`mx-auto max-w-2xl px-5 ${showActionBar ? 'pb-32' : 'pb-12'}`}>
                <section className="pt-8">
                    <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-slate-950">{heading}</h1>
                    <p className="mt-2.5 text-[15px] leading-6 text-slate-500">
                        {sentOn ? `Preparada por ${data.company.name} em ${sentOn}. ` : ''}
                        {hasFinalDecision ? null : remaining?.remaining ? <>Válida até {validUntil} <span className="text-slate-400">({daysLeft})</span>.</> : 'O prazo desta proposta terminou.'}
                    </p>
                </section>

                {error ? <div className="mt-6 flex items-start justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Fechar aviso"><X className="h-4 w-4" /></button></div> : null}

                {/* Próximo passo depois da decisão */}
                {latestDecision && decisionWhatsAppUrl ? (
                    <section className="mt-6 rounded-2xl border border-black/[0.07] bg-white px-5 py-5">
                        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {latestDecision.kind === 'approved' ? 'Próximo passo' : 'Resposta enviada'}</p>
                        <h2 className="mt-2 text-lg font-semibold text-slate-950">{latestDecision.kind === 'approved' ? 'Agora é só combinar a instalação.' : `Continue a conversa com ${data.company.name}.`}</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                            {latestDecision.kind === 'approved'
                                ? `A ${data.company.name} já foi avisada. Chame no WhatsApp para agendar o serviço.`
                                : 'Sua resposta foi registrada. Se preferir, continue pelo WhatsApp.'}
                        </p>
                        <a href={decisionWhatsAppUrl} target="_blank" rel="noreferrer" className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--portal-brand)] px-4 text-[15px] font-medium text-[var(--portal-brand-ink)] transition hover:opacity-90">
                            <MessageCircle className="h-4 w-4" /> {latestDecision.kind === 'approved' ? 'Agendar pelo WhatsApp' : 'Continuar no WhatsApp'}
                        </a>
                    </section>
                ) : null}

                {/* Opções da proposta */}
                <section className="mt-8" aria-label="Opções da proposta">
                    {!singleProposal ? <h2 className="mb-3 text-sm font-medium text-slate-500">{hasFinalDecision ? 'Opções da proposta' : `${data.proposals.length} opções para você comparar`}</h2> : null}
                    <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white">
                        {data.proposals.map((proposal, index) => {
                            const active = proposal.id === selected?.id;
                            const proposalCondition = getProposalCondition(proposal, now);
                            const name = proposal.proposalOptionName || proposal.nomeArquivo || `Proposta ${index + 1}`;
                            const price = proposalCondition?.finalValue ?? proposal.totalPreco ?? 0;
                            return (
                                <div key={proposal.id} className={`relative ${index > 0 ? 'border-t border-black/[0.06]' : ''}`}>
                                    {!singleProposal && active ? <span className="absolute inset-y-0 left-0 w-[3px] bg-[var(--portal-brand)]" aria-hidden="true" /> : null}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedId(proposal.id!)}
                                        aria-pressed={singleProposal ? undefined : active}
                                        className="flex w-full items-start gap-3 px-5 pt-5 text-left disabled:cursor-default"
                                    >
                                        {!singleProposal ? <span className={`mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${active ? 'border-[var(--portal-brand)]' : 'border-slate-300'}`}>{active ? <span className="h-2 w-2 rounded-full bg-[var(--portal-brand)]" /> : null}</span> : null}
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[17px] font-semibold text-slate-900">{name}</span>
                                            <span className="mt-0.5 block text-sm text-slate-500">{proposal.totalM2 ? `${proposal.totalM2.toFixed(2).replace('.', ',')} m² de película` : 'Detalhes completos no PDF'}</span>
                                        </span>
                                        <span className="shrink-0 text-right">
                                            {proposalCondition ? <span className="block text-xs tabular-nums text-slate-400 line-through">{currency.format(proposalCondition.originalValue)}</span> : null}
                                            <span className="block text-[19px] font-semibold tabular-nums tracking-[-0.01em] text-slate-950">{currency.format(price)}</span>
                                        </span>
                                    </button>
                                    <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-3">
                                        {proposalCondition ? <span className={`text-xs font-medium ${proposalCondition.expired ? 'text-slate-400' : 'text-emerald-700'}`}>{proposalCondition.expired ? 'Condição especial expirada' : `Você economiza ${currency.format(proposalCondition.discountAmount)}`}</span> : <span />}
                                        <button type="button" disabled={isDownloadBlocked || downloadingId === proposal.id} onClick={() => void download(proposal.id!)} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--portal-brand)] disabled:text-slate-300">
                                            {downloadingId === proposal.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Ver PDF
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Condição especial */}
                {selectedCondition ? (
                    <section className={`mt-4 rounded-2xl border px-5 py-4 ${selectedCondition.expired ? 'border-black/[0.07] bg-white' : 'border-emerald-900/10 bg-emerald-50/60'}`} aria-label="Condição especial">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className={`text-sm font-semibold ${selectedCondition.expired ? 'text-slate-700' : 'text-emerald-900'}`}>{selectedCondition.expired ? 'A condição especial expirou' : 'Condição especial para você'}</p>
                                <p className={`mt-1 text-sm leading-5 ${selectedCondition.expired ? 'text-slate-500' : 'text-emerald-900/70'}`}>
                                    {selectedCondition.expired
                                        ? `O valor ficou reservado até ${formatConditionExpiry(selectedCondition.expiresAt)}. Converse com a empresa para reativar.`
                                        : `De ${currency.format(selectedCondition.originalValue)} por ${currency.format(selectedCondition.finalValue)}${selectedCondition.discountPercent ? ` (${selectedCondition.discountPercent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% de desconto)` : ''}, reservado até ${formatConditionExpiry(selectedCondition.expiresAt)}.`}
                                </p>
                            </div>
                            {!selectedCondition.expired && !hasFinalDecision && conditionRemaining ? <span className="shrink-0 rounded-md bg-white/80 px-2 py-1 text-xs font-medium tabular-nums text-emerald-900">{conditionRemaining.days > 0 ? `${conditionRemaining.days}d ` : ''}{String(conditionRemaining.hours).padStart(2, '0')}h{String(conditionRemaining.minutes).padStart(2, '0')}</span> : null}
                        </div>
                    </section>
                ) : null}

                {/* Forma de pagamento */}
                {paymentOptions.length > 0 && !hasFinalDecision ? (
                    <section id="formas-pagamento" className="mt-10 scroll-mt-6" aria-label="Forma de pagamento">
                        <h2 className="text-lg font-semibold tracking-[-0.01em] text-slate-950">Forma de pagamento</h2>
                        <p className="mt-1 text-sm text-slate-500">Escolha antes de aprovar. Valores para {currency.format(payTotal)}.</p>
                        <div className="mt-4 overflow-hidden rounded-2xl border border-black/[0.07] bg-white" role="radiogroup" aria-label="Formas de pagamento">
                            {cashOptions.map((option, index) => {
                                const active = selectedPaymentKey === optionKey(option);
                                return (
                                    <button
                                        key={optionKey(option)}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => setSelectedPaymentKey(optionKey(option))}
                                        className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors ${index > 0 ? 'border-t border-black/[0.06]' : ''} ${active ? 'bg-[var(--portal-brand)]/[0.05]' : 'hover:bg-slate-50'}`}
                                    >
                                        <Radio active={active} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[15px] font-medium text-slate-900">{option.methodType === 'pix' ? 'Pix' : 'Boleto'}</span>
                                            <span className={`block text-[13px] ${option.discountPercent > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{option.discountPercent > 0 ? `${option.discountPercent.toLocaleString('pt-BR')}% de desconto à vista` : 'À vista'}</span>
                                        </span>
                                        <span className="shrink-0 text-right text-[15px] font-semibold tabular-nums text-slate-900">{currency.format(option.customerTotal)}</span>
                                    </button>
                                );
                            })}
                            {cardOptions.length > 0 ? (
                                <div className={`px-5 py-4 ${cashOptions.length > 0 ? 'border-t border-black/[0.06]' : ''} ${selectedCard ? 'bg-[var(--portal-brand)]/[0.05]' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        <Radio active={Boolean(selectedCard)} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[15px] font-medium text-slate-900">Cartão de crédito</span>
                                            <span className="block text-[13px] text-slate-500">{noInterestTop > 1 ? `Até ${noInterestTop}x sem juros` : 'Parcelado'}{cardOptions.at(-1)!.installments > noInterestTop ? ` · até ${cardOptions.at(-1)!.installments}x no cartão` : ''}</span>
                                        </span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-6 gap-1.5 pl-[30px]" role="radiogroup" aria-label="Parcelas no cartão">
                                        {cardOptions.map(option => {
                                            const active = selectedPaymentKey === optionKey(option);
                                            const noInterest = option.methodType === 'parcelado_sem_juros';
                                            return (
                                                <button
                                                    key={optionKey(option)}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={active}
                                                    aria-label={`${option.installments}x ${noInterest ? 'sem juros' : 'no cartão'}`}
                                                    onClick={() => setSelectedPaymentKey(optionKey(option))}
                                                    className={`relative h-10 rounded-lg border text-sm tabular-nums transition-colors ${active
                                                        ? 'border-[var(--portal-brand)] bg-[var(--portal-brand)] font-semibold text-[var(--portal-brand-ink)]'
                                                        : 'border-black/[0.08] bg-white font-medium text-slate-700 hover:border-black/20'}`}
                                                >
                                                    {option.installments}x
                                                    {noInterest && !active ? <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-emerald-500" aria-hidden="true" /> : null}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-3 min-h-10 pl-[30px] text-[13px] leading-5 text-slate-600">
                                        {selectedCard ? <>
                                            <span className="font-semibold tabular-nums text-slate-900">{selectedCard.installments}x de {currency.format(selectedCard.installmentValue)}</span>
                                            {selectedCard.methodType === 'parcelado_sem_juros' ? <span className="text-emerald-700"> sem juros</span> : null}
                                            <span className="block tabular-nums text-slate-500">
                                                Total {currency.format(selectedCard.customerTotal)}
                                                {selectedCard.lastInstallmentValue != null ? ` · última parcela ${currency.format(selectedCard.lastInstallmentValue)}` : ''}
                                            </span>
                                        </> : <span className="text-slate-400">{noInterestTop > 1 ? <><span className="mr-1 inline-block h-1 w-1 rounded-full bg-emerald-500 align-middle" />sem juros · </> : null}escolha em quantas vezes</span>}
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    </section>
                ) : null}


                {/* Mensagens */}
                <section id="conversa" className="mt-10 scroll-mt-6" aria-label="Mensagens">
                    <h2 className="text-lg font-semibold tracking-[-0.01em] text-slate-950">Mensagens</h2>
                    <p className="mt-1 text-sm text-slate-500">Fale direto com {data.company.name}.</p>
                    <div className="mt-4 overflow-hidden rounded-2xl border border-black/[0.07] bg-white">
                        <div className="max-h-[320px] space-y-2.5 overflow-y-auto px-4 py-4">
                            {data.messages.length === 0
                                ? <p className="py-4 text-center text-sm text-slate-400">Nenhuma mensagem ainda.</p>
                                : data.messages.map(item => {
                                    const mine = item.sender_type === 'client';
                                    return (
                                        <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${mine ? 'rounded-br-md bg-[var(--portal-brand)] text-[var(--portal-brand-ink)]' : 'rounded-bl-md bg-slate-100 text-slate-800'}`}>
                                                {item.kind !== 'message' ? <p className="text-xs font-semibold opacity-80">{item.kind === 'approved' ? 'Proposta aprovada' : item.kind === 'rejected' ? 'Proposta recusada' : item.kind === 'negotiation' ? 'Contraproposta' : item.kind === 'condition_extended' ? 'Condição prorrogada' : 'Condição atualizada'}</p> : null}
                                                {item.offer_value != null ? <p className="font-medium">{item.offer_type === 'percentage' ? `${item.offer_value}% de desconto` : `Valor desejado: ${currency.format(item.offer_value)}`}</p> : null}
                                                {item.condition_value != null ? <p className="font-medium">Valor da condição: {currency.format(item.condition_value)}</p> : null}
                                                {item.payment_selection ? <p className="font-medium">{item.payment_selection.installments > 1 ? `${item.payment_selection.installments}x de ${currency.format(item.payment_selection.installmentValue)}${item.payment_selection.lastInstallmentValue != null ? ` (última ${currency.format(item.payment_selection.lastInstallmentValue)})` : ''} · total ${currency.format(item.payment_selection.customerTotal)}` : `${item.payment_selection.label}: ${currency.format(item.payment_selection.customerTotal)}`}</p> : null}
                                                {item.body ? <p>{item.body}</p> : null}
                                                <p className="mt-0.5 text-[11px] opacity-60">{new Date(item.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                        <div className="flex items-end gap-2 border-t border-black/[0.06] p-3">
                            <textarea value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={1} placeholder="Escreva uma mensagem" aria-label="Mensagem para a empresa" className="min-h-11 flex-1 resize-none rounded-xl bg-slate-100 px-3.5 py-2.5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[var(--portal-brand)]/25" />
                            <button type="button" disabled={busy || !message.trim()} onClick={() => void sendMessage()} aria-label="Enviar mensagem" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--portal-brand)] text-[var(--portal-brand-ink)] transition disabled:bg-slate-200 disabled:text-slate-400"><Send className="h-4 w-4" /></button>
                        </div>
                    </div>
                </section>

                <footer className="mt-10 text-center text-xs leading-5 text-slate-400">
                    Proposta de {data.company.name}{data.company.phone ? ` · ${data.company.phone}` : ''}
                </footer>
            </main>

            {/* Barra de decisão: sempre à mão, com o pagamento escolhido */}
            {showActionBar ? (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.07] bg-white/95 backdrop-blur-md" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                    <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-slate-500">{isApprovalBlocked ? (selectedCondition?.expired ? 'Condição expirada' : 'Prazo encerrado') : selectedPayment ? selectedPayment.methodType === 'pix' ? 'Pix à vista' : selectedPayment.methodType === 'boleto' ? 'Boleto à vista' : selectedPayment.methodType === 'parcelado_sem_juros' ? 'Cartão sem juros' : 'Cartão de crédito' : 'Total'}</p>
                            <p className="truncate text-base font-semibold tabular-nums tracking-[-0.01em] text-slate-950">{selectedPayment && selectedPayment.installments > 1 ? `${selectedPayment.installments}x de ${currency.format(selectedPayment.installmentValue)}` : currency.format(selectedPayment?.customerTotal ?? payTotal)}</p>
                        </div>
                        <button type="button" onClick={() => setDecisionAssistant(true)} aria-label="Conversar com a empresa" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-black/[0.1] text-slate-700 transition hover:bg-slate-50"><MessageSquareText className="h-5 w-5" /></button>
                        <button
                            type="button"
                            disabled={isApprovalBlocked}
                            onClick={() => { if (paymentOptions.length > 0 && !selectedPayment) scrollTo('formas-pagamento'); else startApproval(); }}
                            className="flex h-12 shrink-0 items-center justify-center rounded-xl bg-[var(--portal-brand)] px-5 text-[15px] font-medium text-[var(--portal-brand-ink)] transition hover:opacity-90 disabled:bg-slate-200 disabled:text-slate-400"
                        >
                            {paymentOptions.length > 0 && !selectedPayment ? 'Continuar' : 'Aprovar'}
                        </button>
                    </div>
                </div>
            ) : null}

            {modal && selected ? <ResponseModal kind={modal} proposalName={selected.proposalOptionName || selected.nomeArquivo || 'Proposta'} proposalValue={selectedCondition?.finalValue ?? selected.totalPreco ?? 0} paymentOptions={paymentOptions} initialPaymentKey={selectedPaymentKey} busy={busy} initialBody={responseInitialBody} onClose={() => { setModal(null); setResponseInitialBody(''); }} onSubmit={submitResponse} /> : null}
            {decisionAssistant ? <DecisionAssistantModal busy={busy} onClose={() => setDecisionAssistant(false)} onMessage={body => void sendGuidedMessage(body)} onNegotiate={body => { if (isDownloadBlocked) void sendGuidedMessage(body); else void performResponse('negotiation', { body }); }} onReject={body => { if (isDownloadBlocked) void sendGuidedMessage(body); else void performResponse('rejected', { body }); }} /> : null}
        </div>
    );
};

export default ProposalPortalView;
