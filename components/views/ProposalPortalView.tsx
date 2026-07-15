import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    Check,
    CheckCircle2,
    ChevronRight,
    Clock3,
    Download,
    FileText,
    HandCoins,
    LoaderCircle,
    MessageCircle,
    MessageSquareText,
    Send,
    ShieldCheck,
    ThumbsDown,
    ThumbsUp,
    TimerReset,
    X,
} from 'lucide-react';
import {
    downloadPublicProposal,
    loadPublicProposalPortal,
    type ProposalOfferType,
    type ProposalPortalDecision,
    type PublicProposalPortal,
    respondToPublicProposal,
    sendPublicProposalMessage,
} from '../../src/lib/proposalPortal';
import { formatConditionExpiry, getProposalCondition } from '../../src/lib/proposalCondition';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const formatRemaining = (expiresAt: string, now: number) => {
    const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
    const days = Math.floor(remaining / 86_400_000);
    const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    const seconds = Math.floor((remaining % 60_000) / 1000);
    return { remaining, days, hours, minutes, seconds };
};

const statusLabel: Record<PublicProposalPortal['portal']['status'], string> = {
    active: 'Aguardando sua resposta',
    approved: 'Proposta aprovada',
    rejected: 'Proposta recusada',
    negotiating: 'Em negociação',
    expired: 'Prazo encerrado',
    revoked: 'Link encerrado',
};

const buildLocalDemoPortal = (): PublicProposalPortal => {
    const expires = new Date();
    expires.setDate(expires.getDate() + 3);
    expires.setHours(23, 59, 59, 0);
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
            { id: 101, proposalOptionName: 'Opção Premium', nomeArquivo: 'proposta-premium.pdf', totalPreco: 4850, totalM2: 36.8, date: new Date().toISOString(), status: 'pending', conditionOriginalValue: 5350, conditionFinalValue: 4850, conditionDiscountAmount: 500, conditionDiscountPercent: 9.35, conditionExpiresAt: expires.toISOString() },
            { id: 102, proposalOptionName: 'Opção Essencial', nomeArquivo: 'proposta-essencial.pdf', totalPreco: 3290, totalM2: 36.8, date: new Date().toISOString(), status: 'pending' },
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
    onClose: () => void;
    onSubmit: (payload: { body?: string; offerType?: ProposalOfferType; offerValue?: number }) => void;
}

const ResponseModal: React.FC<ResponseModalProps> = ({ kind, proposalName, proposalValue, busy, initialBody = '', onClose, onSubmit }) => {
    const [body, setBody] = useState(initialBody);
    const [offerType, setOfferType] = useState<ProposalOfferType>('fixed');
    const [offerValue, setOfferValue] = useState('');
    const [error, setError] = useState('');

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
        onSubmit({ body: body.trim() });
    };

    const title = kind === 'approved' ? 'Aprovar proposta' : kind === 'rejected' ? 'Recusar proposta' : 'Fazer uma contraproposta';

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true">
            <button className="absolute inset-0" onClick={onClose} aria-label="Fechar janela" />
            <div className="relative w-full max-w-lg rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[24px] sm:p-7">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600">{proposalName}</p>
                        <h2 className="mt-1 text-2xl font-bold text-slate-950">{title}</h2>
                    </div>
                    <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-label="Fechar">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {kind === 'approved' ? (
                    <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
                        Ao confirmar, a empresa será avisada imediatamente e esta proposta ficará marcada como aprovada no sistema.
                    </div>
                ) : null}

                {kind === 'negotiation' ? (
                    <div className="mt-6 space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-bold text-slate-500">Valor atual</p>
                            <p className="mt-1 text-xl font-extrabold text-slate-950">{currency.format(proposalValue)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                            <button type="button" onClick={() => setOfferType('fixed')} className={`h-10 rounded-lg text-xs font-bold ${offerType === 'fixed' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>Valor que pagaria</button>
                            <button type="button" onClick={() => setOfferType('percentage')} className={`h-10 rounded-lg text-xs font-bold ${offerType === 'percentage' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>Desconto em %</button>
                        </div>
                        <label className="block">
                            <span className="mb-1.5 block text-xs font-bold text-slate-600">{offerType === 'fixed' ? 'Quanto deseja pagar?' : 'Qual desconto deseja?'}</span>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-extrabold text-slate-500">{offerType === 'fixed' ? 'R$' : '%'}</span>
                                <input autoFocus type="number" inputMode="decimal" min="0" max={offerType === 'percentage' ? 100 : undefined} value={offerValue} onChange={event => setOfferValue(event.target.value)} className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-lg font-extrabold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" placeholder="0,00" />
                            </div>
                        </label>
                    </div>
                ) : null}

                {kind !== 'approved' ? (
                    <label className="mt-4 block">
                        <span className="mb-1.5 block text-xs font-bold text-slate-600">{kind === 'rejected' ? 'Por que esta proposta não funcionou para você?' : 'Observação para a empresa (opcional)'}</span>
                        <textarea value={body} onChange={event => setBody(event.target.value)} rows={4} className="w-full resize-none rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" placeholder={kind === 'rejected' ? 'Ex.: o prazo não atende, escolhi outra solução, valor acima do esperado…' : 'Explique sua condição ou tire uma dúvida.'} />
                    </label>
                ) : null}

                {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
                <button type="button" disabled={busy} onClick={submit} className={`mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold text-white disabled:opacity-60 ${kind === 'approved' ? 'bg-emerald-600' : kind === 'rejected' ? 'bg-red-600' : 'bg-blue-600'}`}>
                    {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : kind === 'approved' ? <Check className="h-5 w-5" /> : kind === 'rejected' ? <ThumbsDown className="h-5 w-5" /> : <HandCoins className="h-5 w-5" />}
                    {busy ? 'Enviando…' : 'Confirmar resposta'}
                </button>
            </div>
        </div>
    );
};

type DecisionAssistantMode = 'adjust' | 'return';

const ADJUST_REASONS = [
    { id: 'price', label: 'O valor ficou acima do esperado', hint: 'Informe quanto faria sentido para você.' },
    { id: 'payment', label: 'Preciso de uma condição de pagamento', hint: 'Parcelamento, entrada ou forma de pagamento.' },
    { id: 'date', label: 'Preciso realizar em outra data', hint: 'Conte quando seria um bom momento.' },
    { id: 'comparing', label: 'Estou comparando outras propostas', hint: 'Diga o que mais pesa na comparação.' },
    { id: 'decision', label: 'Preciso decidir com outra pessoa', hint: 'Combine quando podemos voltar a conversar.' },
    { id: 'technical', label: 'Tenho dúvida sobre a película', hint: 'Envie sua dúvida diretamente para a empresa.' },
    { id: 'priority', label: 'Ainda não é prioridade', hint: 'Escolha quando prefere receber um novo contato.' },
    { id: 'other', label: 'Outro motivo', hint: 'Conte brevemente o que precisa mudar.' },
] as const;

const RETURN_REASONS = [
    { id: 'price', label: 'O preço não cabe no momento' },
    { id: 'competitor', label: 'Escolhi outra empresa' },
    { id: 'postponed', label: 'Adiei o serviço' },
    { id: 'condition', label: 'A condição não funcionou para mim' },
    { id: 'confidence', label: 'Ainda não me senti seguro para decidir' },
    { id: 'other', label: 'Outro motivo' },
] as const;

const PAYMENT_CHOICES = ['Preciso parcelar mais', 'Preciso reduzir a entrada', 'Prefiro pagar no Pix', 'Quero outra condição'];
const COMPARISON_CHOICES = ['Preço', 'Garantia', 'Tipo de película', 'Prazo de execução'];
const PRIORITY_CHOICES = ['Falar comigo em 7 dias', 'Falar comigo em 15 dias', 'Falar comigo em 30 dias'];

const DecisionAssistantModal: React.FC<{
    mode: DecisionAssistantMode;
    busy: boolean;
    onClose: () => void;
    onMessage: (body: string) => void;
    onNegotiate: (body: string) => void;
    onReject: (body: string) => void;
}> = ({ mode, busy, onClose, onMessage, onNegotiate, onReject }) => {
    const [selectedId, setSelectedId] = useState('');
    const [choice, setChoice] = useState('');
    const [detail, setDetail] = useState('');
    const reasons = mode === 'adjust' ? ADJUST_REASONS : RETURN_REASONS;
    const selected = reasons.find(reason => reason.id === selectedId);

    const selectReason = (id: string) => {
        setSelectedId(id);
        setChoice('');
        setDetail('');
    };

    const requiresChoice = mode === 'adjust' && ['payment', 'comparing', 'priority'].includes(selectedId);
    const requiresDetail = selectedId === 'other' || (mode === 'adjust' && ['technical', 'date', 'decision'].includes(selectedId));
    const canSubmit = Boolean(selected) && (!requiresChoice || Boolean(choice)) && (!requiresDetail || Boolean(detail.trim()));

    const submit = () => {
        if (!selected || !canSubmit) return;
        if (mode === 'adjust' && selectedId === 'price') {
            onNegotiate(`Motivo informado: ${selected.label}.`);
            return;
        }

        let complement = choice;
        if (selectedId === 'date' && detail) complement = `Data desejada: ${new Date(`${detail}T12:00:00`).toLocaleDateString('pt-BR')}`;
        else if (selectedId === 'decision' && detail) complement = `Podemos voltar a conversar em ${new Date(`${detail}T12:00:00`).toLocaleDateString('pt-BR')}`;
        else if (detail.trim()) complement = detail.trim();

        const body = `${mode === 'adjust' ? 'Preciso ajustar a proposta' : 'Não vou seguir agora'}: ${selected.label}${complement ? `. ${complement}` : ''}`;
        if (mode === 'adjust') onMessage(body);
        else onReject(body);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={mode === 'adjust' ? 'Solicitar ajuste' : 'Dar um retorno'}>
            <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Fechar janela" />
            <section className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[24px] sm:p-7">
                <div className="flex items-start gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white ${mode === 'adjust' ? 'bg-blue-600' : 'bg-slate-700'}`}><MessageSquareText className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className={`text-xs font-black uppercase tracking-[.14em] ${mode === 'adjust' ? 'text-blue-600' : 'text-slate-500'}`}>Seu próximo passo</p><h2 className="mt-1 text-2xl font-black text-slate-950">{selected ? selected.label : mode === 'adjust' ? 'O que está impedindo sua decisão?' : 'Qual foi o principal motivo?'}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{selected ? 'Só mais uma informação rápida.' : mode === 'adjust' ? 'Escolha a opção que mais combina com o seu momento.' : 'Sua resposta encerra este acompanhamento e evita mensagens desnecessárias.'}</p></div><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-label="Fechar"><X className="h-4 w-4" /></button></div>

                {!selected ? <div className="mt-5 space-y-2">{reasons.map(reason => <button key={reason.id} type="button" disabled={busy} onClick={() => selectReason(reason.id)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"><span><strong className="block text-sm text-slate-800">{reason.label}</strong>{'hint' in reason ? <small className="mt-0.5 block text-[11px] font-medium text-slate-500">{reason.hint}</small> : null}</span><ChevronRight className="h-4 w-4 shrink-0 text-blue-500" /></button>)}</div> : <div className="mt-5">
                    {mode === 'adjust' && selectedId === 'price' ? <div className="rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">Você poderá informar o valor que gostaria de pagar ou o percentual de desconto desejado.</div> : null}
                    {mode === 'adjust' && selectedId === 'payment' ? <div className="grid gap-2">{PAYMENT_CHOICES.map(item => <button key={item} type="button" onClick={() => setChoice(item)} className={`min-h-11 rounded-xl border px-3 text-left text-sm font-bold ${choice === item ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700'}`}>{item}</button>)}</div> : null}
                    {mode === 'adjust' && selectedId === 'comparing' ? <div><p className="mb-2 text-xs font-bold text-slate-600">O que mais pesa na sua comparação?</p><div className="grid grid-cols-2 gap-2">{COMPARISON_CHOICES.map(item => <button key={item} type="button" onClick={() => setChoice(item)} className={`min-h-11 rounded-xl border px-2 text-xs font-bold ${choice === item ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700'}`}>{item}</button>)}</div></div> : null}
                    {mode === 'adjust' && selectedId === 'priority' ? <div className="grid gap-2">{PRIORITY_CHOICES.map(item => <button key={item} type="button" onClick={() => setChoice(item)} className={`min-h-11 rounded-xl border px-3 text-left text-sm font-bold ${choice === item ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700'}`}>{item}</button>)}</div> : null}
                    {mode === 'adjust' && ['date', 'decision'].includes(selectedId) ? <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{selectedId === 'date' ? 'Quando gostaria de realizar?' : 'Quando podemos voltar a conversar?'}</span><input type="date" value={detail} min={new Date().toISOString().slice(0, 10)} onChange={event => setDetail(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-500" /></label> : null}
                    {(mode === 'return' || (mode === 'adjust' && ['technical', 'other'].includes(selectedId))) ? <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{mode === 'return' && selectedId !== 'other' ? 'Quer acrescentar algo? (opcional)' : 'Conte brevemente'}</span><textarea autoFocus value={detail} onChange={event => setDetail(event.target.value)} rows={3} placeholder={mode === 'return' ? 'Sua observação ajuda a empresa a melhorar.' : 'Escreva sua dúvida ou explique o que precisa mudar.'} className="w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /></label> : null}

                    <div className="mt-5 flex gap-2"><button type="button" onClick={() => selectReason('')} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></button><button type="button" disabled={busy || !canSubmit} onClick={submit} className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-black text-white disabled:opacity-50 ${mode === 'adjust' ? 'bg-blue-600' : 'bg-slate-800'}`}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : mode === 'adjust' && selectedId === 'price' ? <HandCoins className="h-4 w-4" /> : <Send className="h-4 w-4" />} {mode === 'adjust' && selectedId === 'price' ? 'Informar minha condição' : mode === 'adjust' ? 'Enviar para a empresa' : 'Enviar retorno e encerrar'}</button></div>
                </div>}
            </section>
        </div>
    );
};

const ProposalPortalView: React.FC = () => {
    const token = useMemo(() => new URLSearchParams(window.location.search).get('token') || '', []);
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
    const [decisionAssistant, setDecisionAssistant] = useState<DecisionAssistantMode | null>(null);
    const [responseInitialBody, setResponseInitialBody] = useState('');

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
            const next = await loadPublicProposalPortal(token, trackView);
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
        const interval = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(interval);
    }, []);
    useEffect(() => {
        if (import.meta.env.DEV && token === 'demo') return;
        const interval = window.setInterval(() => {
            if (document.visibilityState === 'visible') void reload(false);
        }, 5_000);
        const handleVisibility = () => { if (document.visibilityState === 'visible') void reload(false); };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
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

    const performResponse = async (kind: ProposalPortalDecision, payload: { body?: string; offerType?: ProposalOfferType; offerValue?: number }) => {
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
                setDecisionAssistant(null);
                setResponseInitialBody('');
                return;
            }
            await respondToPublicProposal(token, selected.id, kind, payload);
            if (kind === 'approved') {
                setConfetti(true);
                window.setTimeout(() => setConfetti(false), 3200);
            }
            setModal(null);
            setDecisionAssistant(null);
            setResponseInitialBody('');
            await reload();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível enviar sua resposta.');
        } finally {
            setBusy(false);
        }
    };

    const submitResponse = (payload: { body?: string; offerType?: ProposalOfferType; offerValue?: number }) => {
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
            setDecisionAssistant(null);
            window.setTimeout(() => document.getElementById('conversa')?.scrollIntoView({ behavior: 'smooth' }), 50);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível enviar sua resposta.');
        } finally {
            setBusy(false);
        }
    };

    const openNegotiationFromAssistant = (body: string) => {
        setDecisionAssistant(null);
        setResponseInitialBody(body);
        setModal('negotiation');
    };

    const download = async (proposalId: number) => {
        setDownloadingId(proposalId);
        try {
            if (import.meta.env.DEV && token === 'demo') return;
            await downloadPublicProposal(token, proposalId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível baixar o PDF.');
        } finally {
            setDownloadingId(null);
        }
    };

    if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><LoaderCircle className="h-8 w-8 animate-spin text-blue-600" /></div>;
    if (!data) return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl"><FileText className="mx-auto h-10 w-10 text-slate-400" /><h1 className="mt-4 text-2xl font-bold text-slate-950">Proposta indisponível</h1><p className="mt-2 text-sm leading-6 text-slate-500">{error}</p></div></div>;

    return (
        <div className="min-h-screen bg-[#f4f7fb] pb-28 text-slate-900 sm:pb-10" style={{ '--portal-brand': brand } as React.CSSProperties}>
            {confetti ? <Confetti /> : null}
            <style>{`@keyframes portal-confetti { 0% { transform: translateY(-5vh) rotate(0); opacity: 1; } 100% { transform: translateY(110vh) rotate(760deg); opacity: .1; } }`}</style>

            <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        {data.company.logo ? <img src={data.company.logo} alt={data.company.name} className="h-10 w-10 rounded-xl object-contain" /> : <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--portal-brand)] text-lg font-black text-white">{data.company.name.charAt(0)}</div>}
                        <div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-950">{data.company.name}</p><p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> Proposta segura</p></div>
                    </div>
                    <div className={`rounded-xl px-3 py-2 text-right ${remaining?.remaining ? 'bg-blue-50 text-blue-900' : 'bg-red-50 text-red-800'}`}>
                        <p className="flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-[0.12em]"><Clock3 className="h-3.5 w-3.5" /> {remaining?.remaining ? 'Prazo restante' : 'Prazo encerrado'}</p>
                        {remaining?.remaining ? <p className="mt-0.5 font-mono text-sm font-black tabular-nums sm:text-base">{remaining.days}d {String(remaining.hours).padStart(2, '0')}:{String(remaining.minutes).padStart(2, '0')}:{String(remaining.seconds).padStart(2, '0')}</p> : null}
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
                <section className="overflow-hidden rounded-[28px] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-300/50 sm:p-9">
                    <div className="max-w-3xl">
                        <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">{statusLabel[data.portal.status]}</span>
                        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Olá, {data.clientName.split(/\s+/)[0]}.</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Preparamos {data.proposals.length === 1 ? 'uma proposta' : `${data.proposals.length} opções`} para você analisar com calma. Compare os valores, baixe o PDF e responda por aqui.</p>
                    </div>
                </section>

                {error ? <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><span>{error}</span><button onClick={() => setError('')}><X className="h-4 w-4" /></button></div> : null}

                {selectedCondition ? <section className={`mt-6 overflow-hidden rounded-[24px] border bg-white shadow-lg ${selectedCondition.expired ? 'border-slate-300 shadow-slate-200/50' : 'border-blue-200 shadow-blue-200/40'}`}>
                    <div className={`p-5 sm:p-6 ${selectedCondition.expired ? 'bg-slate-50' : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50'}`}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div><p className={`text-xs font-black uppercase tracking-[.16em] ${selectedCondition.expired ? 'text-slate-500' : 'text-blue-600'}`}>{selectedCondition.expired ? 'Esta condição expirou' : 'Condição especial para você'}</p><h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{selected?.proposalOptionName || 'Sua proposta'}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{selectedCondition.expired ? `O valor ficou reservado até ${formatConditionExpiry(selectedCondition.expiresAt)}. Converse com a empresa para reativar esta condição.` : `Seu desconto está reservado até ${formatConditionExpiry(selectedCondition.expiresAt)}.`}</p></div>
                            <div className={`shrink-0 rounded-2xl border px-4 py-3 text-center ${selectedCondition.expired ? 'border-slate-200 bg-white text-slate-600' : 'border-blue-200 bg-white text-blue-900'}`}><p className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[.12em]"><TimerReset className="h-3.5 w-3.5" /> {selectedCondition.expired ? 'Prazo encerrado' : 'Condição reservada'}</p>{!selectedCondition.expired && conditionRemaining ? <p className="mt-1 font-mono text-lg font-black tabular-nums">{conditionRemaining.days}d {String(conditionRemaining.hours).padStart(2, '0')}:{String(conditionRemaining.minutes).padStart(2, '0')}:{String(conditionRemaining.seconds).padStart(2, '0')}</p> : <p className="mt-1 text-sm font-black">Expirada</p>}</div>
                        </div>

                        <div className="mt-5 grid gap-3 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm sm:grid-cols-3">
                            <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Valor original</p><p className="mt-1 text-base font-bold text-slate-500 line-through decoration-slate-400">{currency.format(selectedCondition.originalValue)}</p></div>
                            <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Você economiza</p><p className="mt-1 text-base font-black text-blue-700">{currency.format(selectedCondition.discountAmount)}{selectedCondition.discountPercent ? <span className="ml-1 text-xs">({selectedCondition.discountPercent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)</span> : null}</p></div>
                            <div className="sm:text-right"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Valor final</p><p className="mt-1 text-2xl font-black text-slate-950">{currency.format(selectedCondition.finalValue)}</p></div>
                        </div>

                        <button type="button" disabled={isApprovalBlocked} onClick={() => setModal('approved')} className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:bg-slate-300 disabled:shadow-none"><ThumbsUp className="h-4 w-4" /> {selectedCondition.expired ? 'Condição expirada' : `Aprovar por ${currency.format(selectedCondition.finalValue)}`}</button>
                        <p className="mt-3 text-center text-xs font-semibold leading-5 text-slate-500">{selectedCondition.expired ? 'A empresa pode reativar ou criar uma nova condição sem apagar este histórico.' : 'Ao aprovar dentro do prazo, o valor com desconto fica garantido para você.'}</p>
                    </div>
                </section> : null}

                {!hasFinalDecision ? <section className="mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                    <div className="p-5 sm:p-6">
                        <p className="text-xs font-black uppercase tracking-[.15em] text-blue-600">Seu próximo passo</p>
                        <h2 className="mt-1 text-2xl font-black text-slate-950">Podemos avançar com esta proposta?</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Esta proposta foi preparada para o seu projeto. Escolha a opção que melhor representa seu momento para a empresa saber como ajudar.</p>
                        <div className="mt-5 grid gap-2 sm:grid-cols-3">
                            <button type="button" disabled={isApprovalBlocked} onClick={() => setModal('approved')} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-500"><ThumbsUp className="h-4 w-4" /> Quero aprovar</button>
                            <button type="button" onClick={() => setDecisionAssistant('adjust')} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"><MessageSquareText className="h-4 w-4" /> Preciso ajustar algo</button>
                            <button type="button" onClick={() => setDecisionAssistant('return')} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"><CheckCircle2 className="h-4 w-4" /> Dar um retorno</button>
                        </div>
                        <p className="mt-3 text-center text-xs font-semibold text-slate-500">Leva menos de 20 segundos. Sua resposta ajuda a empresa a respeitar o seu momento.</p>
                    </div>
                </section> : null}

                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,.75fr)]">
                    <section>
                        <div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-blue-600">Suas opções</p><h2 className="mt-1 text-2xl font-bold text-slate-950">Escolha a melhor proposta</h2></div><span className="hidden text-xs font-bold text-slate-400 sm:inline">{data.proposals.length} {data.proposals.length === 1 ? 'opção' : 'opções'}</span></div>
                        <div className="space-y-3">
                            {data.proposals.map((proposal, index) => {
                                const active = proposal.id === selected?.id;
                                const proposalCondition = getProposalCondition(proposal, now);
                                return <article key={proposal.id} className={`rounded-2xl border bg-white p-4 shadow-sm transition sm:p-5 ${active ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-200'}`}>
                                    <button type="button" onClick={() => setSelectedId(proposal.id!)} className="w-full text-left">
                                        <div className="flex items-start gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span><div className="min-w-0 flex-1"><h3 className="truncate text-base font-extrabold text-slate-950">{proposal.proposalOptionName || proposal.nomeArquivo || `Proposta ${index + 1}`}</h3><p className="mt-0.5 text-xs text-slate-500">{proposal.totalM2 ? `${proposal.totalM2.toFixed(2).replace('.', ',')} m²` : 'Detalhes completos no PDF'}</p></div><div className="shrink-0 text-right">{proposalCondition ? <p className="text-[10px] font-bold text-slate-400 line-through">{currency.format(proposalCondition.originalValue)}</p> : null}<p className="text-lg font-black text-slate-950">{currency.format(proposalCondition?.finalValue || proposal.totalPreco || 0)}</p>{proposalCondition?.expired ? <p className="text-[9px] font-black uppercase text-red-500">Expirou</p> : null}</div></div>
                                    </button>
                                    <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3"><button type="button" disabled={isDownloadBlocked || downloadingId === proposal.id} onClick={() => void download(proposal.id!)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 text-xs font-extrabold text-slate-700 disabled:opacity-50">{downloadingId === proposal.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar PDF</button><button type="button" onClick={() => { setSelectedId(proposal.id!); document.getElementById('conversa')?.scrollIntoView({ behavior: 'smooth' }); }} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600"><MessageCircle className="h-4 w-4" /> Dúvida</button></div>
                                </article>;
                            })}
                        </div>
                    </section>

                    <aside className="hidden lg:block">
                        <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">Sua decisão</p><h2 className="mt-1 text-xl font-bold text-slate-950">{selected?.proposalOptionName || 'Proposta selecionada'}</h2>{selectedCondition ? <p className="mt-2 text-xs font-bold text-slate-400 line-through">{currency.format(selectedCondition.originalValue)}</p> : null}<p className="mt-1 text-2xl font-black text-slate-950">{currency.format(selectedCondition?.finalValue || selected?.totalPreco || 0)}</p>
                            <div className="mt-5 grid gap-2"><button disabled={isApprovalBlocked} onClick={() => setModal('approved')} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-extrabold text-white disabled:opacity-50"><ThumbsUp className="h-4 w-4" /> {selectedCondition && !selectedCondition.expired ? `Aprovar por ${currency.format(selectedCondition.finalValue)}` : selectedCondition?.expired ? 'Condição expirada' : 'Quero aprovar'}</button><button disabled={hasFinalDecision} onClick={() => setDecisionAssistant('adjust')} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-extrabold text-white disabled:opacity-50"><MessageSquareText className="h-4 w-4" /> Solicitar ajuste</button><button disabled={hasFinalDecision} onClick={() => setDecisionAssistant('return')} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 text-sm font-extrabold text-slate-700 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Dar um retorno</button></div>
                        </div>
                    </aside>
                </div>

                <section id="conversa" className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 p-5"><h2 className="text-xl font-bold text-slate-950">Conversa com a empresa</h2><p className="mt-1 text-xs text-slate-500">Suas mensagens e respostas ficam registradas junto com a proposta.</p></div>
                    <div className="max-h-[420px] space-y-3 overflow-y-auto bg-slate-50/70 p-4 sm:p-5">
                        {data.messages.length === 0 ? <div className="py-8 text-center text-sm text-slate-400"><MessageCircle className="mx-auto mb-2 h-7 w-7" /> Ainda não há mensagens. Se precisar, fale com a empresa por aqui.</div> : data.messages.map(item => <div key={item.id} className={`flex ${item.sender_type === 'client' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 ${item.sender_type === 'client' ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md bg-white text-slate-700 shadow-sm'}`}>
                            {item.kind !== 'message' ? <p className="mb-1 text-[10px] font-black uppercase tracking-[0.12em] opacity-75">{item.kind === 'approved' ? 'Proposta aprovada' : item.kind === 'rejected' ? 'Proposta recusada' : item.kind === 'negotiation' ? 'Contraproposta enviada' : item.kind === 'condition_extended' ? 'Condição prorrogada' : 'Condição atualizada'}</p> : null}
                            {item.offer_value != null ? <p className="font-extrabold">{item.offer_type === 'percentage' ? `${item.offer_value}% de desconto` : `Valor desejado: ${currency.format(item.offer_value)}`}</p> : null}
                            {item.condition_value != null ? <p className="font-extrabold">Valor da condição: {currency.format(item.condition_value)}</p> : null}
                            {item.body ? <p>{item.body}</p> : null}<p className="mt-1 text-[10px] opacity-60">{new Date(item.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p></div></div>)}
                    </div>
                    <div className="flex gap-2 border-t border-slate-100 p-3 sm:p-4"><textarea value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={1} placeholder="Digite sua mensagem…" className="min-h-11 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /><button type="button" disabled={busy || !message.trim()} onClick={() => void sendMessage()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button></div>
                </section>
            </main>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 pb-[calc(env(safe-area-inset-bottom,0px)+.75rem)] backdrop-blur-xl lg:hidden">
                {hasFinalDecision ? <div className="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-bold text-slate-600"><CheckCircle2 className="h-5 w-5" /> {statusLabel[data.portal.status]}</div> : <div className="mx-auto grid max-w-xl grid-cols-3 gap-2"><button disabled={isApprovalBlocked} onClick={() => setModal('approved')} className="flex h-12 flex-col items-center justify-center rounded-xl bg-emerald-600 px-1 text-[10px] font-extrabold text-white disabled:bg-slate-300"><ThumbsUp className="h-4 w-4" /> {selectedCondition ? selectedCondition.expired ? 'Expirou' : `Aprovar ${currency.format(selectedCondition.finalValue)}` : 'Aprovar'}</button><button onClick={() => setDecisionAssistant('adjust')} className="flex h-12 flex-col items-center justify-center rounded-xl bg-blue-600 text-[10px] font-extrabold text-white"><MessageSquareText className="h-4 w-4" /> Pedir ajuste</button><button onClick={() => setDecisionAssistant('return')} className="flex h-12 flex-col items-center justify-center rounded-xl bg-slate-100 text-[10px] font-extrabold text-slate-700"><CheckCircle2 className="h-4 w-4" /> Dar retorno</button></div>}
            </div>

            {modal && selected ? <ResponseModal kind={modal} proposalName={selected.proposalOptionName || selected.nomeArquivo || 'Proposta'} proposalValue={selectedCondition?.finalValue || selected.totalPreco || 0} busy={busy} initialBody={responseInitialBody} onClose={() => { setModal(null); setResponseInitialBody(''); }} onSubmit={submitResponse} /> : null}
            {decisionAssistant ? <DecisionAssistantModal mode={decisionAssistant} busy={busy} onClose={() => setDecisionAssistant(null)} onMessage={body => void sendGuidedMessage(body)} onNegotiate={openNegotiationFromAssistant} onReject={body => { if (isDownloadBlocked) void sendGuidedMessage(body); else void performResponse('rejected', { body }); }} /> : null}
        </div>
    );
};

export default ProposalPortalView;
