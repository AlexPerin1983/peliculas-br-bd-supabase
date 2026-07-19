import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
    ArrowLeftRight,
    Building2,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    Copy,
    FileText,
    GripVertical,
    History,
    Layers3,
    LucideIcon,
    MoveVertical,
    Pencil,
    Pointer,
    Ruler,
    Sparkles,
    Trash2,
    UserPlus,
    X
} from 'lucide-react';

type ActiveTab = 'dashboard' | 'client' | 'films' | 'settings' | 'history' | 'proposals' | 'agenda' | 'sales' | 'admin' | 'account' | 'estoque' | 'qr_code' | 'fornecedores';

interface OnboardingTourProps {
    /** Navega para a aba indicada (mesmo handler do menu). */
    onNavigate: (tab: ActiveTab) => void;
    /** Força a abertura logo após a criação de uma nova empresa. */
    forceOpen?: boolean;
}

interface TourStep {
    id: string;
    icon: LucideIcon;
    title: string;
    body: string;
    tip?: string;
    /** Aba para a qual o app deve ir ao entrar neste passo. */
    tab?: ActiveTab;
    /** data-tour do elemento real que deve ser destacado. */
    target?: string;
    /** Passo só faz sentido no celular (gestos de toque). */
    mobileOnly?: boolean;
    /** Animação ilustrativa exibida dentro do cartão. */
    demo?: 'reorder' | 'swipe';
}

const STORAGE_KEY = 'peliculas-br-onboarding-v1';
const OPEN_EVENT = 'peliculas-br-open-tour';

// Passos focados apenas nas funções gratuitas (sem Estoque, QR Code ou IA).
const ALL_STEPS: TourStep[] = [
    {
        id: 'welcome',
        icon: Sparkles,
        title: 'Crie seu primeiro orçamento real',
        body: 'Vamos focar só no essencial: cliente, medidas e PDF. Você pode conhecer agenda, estoque e configurações depois.',
        tip: 'Leva cerca de 2 minutos e você pode pular quando quiser.'
    },
    {
        id: 'cliente',
        icon: UserPlus,
        title: '1. Cadastre um cliente real',
        body: 'Toque em adicionar cliente. Para começar, basta informar o nome; telefone, documento e endereço são opcionais.',
        tip: 'Use alguém para quem você realmente possa enviar este primeiro orçamento.',
        tab: 'client',
        target: 'nav-client'
    },
    {
        id: 'orcamento',
        icon: Ruler,
        title: '2. Informe as medidas',
        body: 'Abra o cliente, digite largura, altura e quantidade e confirme cada campo pela seta. Depois escolha uma película.',
        tip: 'O valor do orçamento é calculado automaticamente.',
        tab: 'client',
        target: 'nav-client'
    },
    {
        id: 'gerar-pdf',
        icon: FileText,
        title: '3. Gere e envie o PDF',
        body: 'Revise o valor e toque em "Gerar PDF". A proposta fica salva no Histórico para consultar ou reenviar.',
        tip: 'Pronto: depois disso, explore agenda, estoque e personalização no seu ritmo.',
        tab: 'client',
        target: 'generate-pdf'
    }
];

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}

function getVisibleTargetRect(target?: string): Rect | null {
    if (!target) return null;
    // Pode haver mais de um elemento com o mesmo data-tour (ex.: botão de PDF
    // no desktop e no rodapé mobile). Escolhe o primeiro realmente visível.
    const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`));
    for (const el of els) {
        // Em telas menores o menu lateral fica oculto (display:none) -> sem offsetParent.
        if (el.offsetParent === null) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        return { top: r.top, left: r.left, width: r.width, height: r.height };
    }
    return null;
}

// Gestos de arrastar/deslizar só existem no celular (abaixo do breakpoint sm).
const MOBILE_QUERY = '(max-width: 639px)';

// Animações ilustrativas (estilo GIF) feitas em CSS para demonstrar os gestos.
// Os cartões imitam os grupos de medida reais do app.
const DEMO_STYLES = `
@keyframes tourSwapActive {
    0% { transform: translateY(0) scale(1); box-shadow: none; }
    14% { transform: translateY(0) scale(1.04); box-shadow: 0 12px 24px rgba(15,23,42,.24); }
    50% { transform: translateY(32px) scale(1.04); box-shadow: 0 12px 24px rgba(15,23,42,.24); }
    86% { transform: translateY(64px) scale(1.04); box-shadow: 0 12px 24px rgba(15,23,42,.24); }
    100% { transform: translateY(64px) scale(1); box-shadow: none; }
}
@keyframes tourSwapOther {
    0%, 14% { transform: translateY(64px); }
    86%, 100% { transform: translateY(0px); }
}
@keyframes tourSwipeCard {
    0%, 6% { transform: translateX(0); }
    18%, 32% { transform: translateX(64px); }
    44%, 56% { transform: translateX(0); }
    68%, 84% { transform: translateX(-64px); }
    95%, 100% { transform: translateX(0); }
}
@keyframes tourPulse {
    0%, 100% { opacity: .5; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.12); }
}
@media (prefers-reduced-motion: reduce) {
    .tour-demo [style*="animation"] { animation: none !important; }
}
`;

const InputPill: React.FC<{ value: string; className?: string }> = ({ value, className = '' }) => (
    <span className={`flex h-3.5 items-center justify-center rounded-[3px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-1 text-[6px] font-semibold text-[var(--text-soft)] ${className}`}>
        {value}
    </span>
);

// Cartão compacto que reproduz um grupo de medida (Película, preço, medidas).
const MiniMeasureCard: React.FC<{
    name: string;
    price: string;
    dims: [string, string, string];
    active?: boolean;
}> = ({ name, price, dims, active }) => (
    <div
        className={`flex h-full w-full flex-col justify-center gap-1 rounded-[10px] border bg-[var(--surface)] px-2.5 py-1.5 ${active ? 'border-[var(--brand-primary)]' : 'border-[var(--border-subtle)]'}`}
    >
        <div className="flex items-center justify-between">
            <span className="text-[7px] font-bold uppercase tracking-wider text-[var(--text-soft)]">Película</span>
            <span className="text-[8px] font-bold text-[var(--text-strong)]">{price}</span>
        </div>
        <div className="flex items-center gap-1">
            {active ? <GripVertical className="h-3 w-3 shrink-0 text-[var(--brand-primary)]" /> : null}
            <p className="truncate text-[9px] font-semibold leading-tight text-[var(--text-strong)]">{name}</p>
        </div>
        <div className="flex items-center gap-1">
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] bg-[var(--brand-primary)] text-white">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            <InputPill value={dims[0]} className="flex-1" />
            <InputPill value={dims[1]} className="flex-1" />
            <InputPill value={dims[2]} className="w-5" />
        </div>
    </div>
);

const ReorderDemo: React.FC = () => (
    <div className="tour-demo relative h-[136px] w-full overflow-hidden rounded-[12px] bg-[var(--surface-muted)] p-0" aria-hidden="true">
        {/* Grupo que cede espaço (sobe ao trocar). */}
        <div
            className="absolute left-2 right-2 h-[56px]"
            style={{ top: 8, animation: 'tourSwapOther 2.8s ease-in-out infinite alternate' }}
        >
            <MiniMeasureCard name="Película Jateada — Exemplo" price="R$ 201,60" dims={['0.80', '2.10', '1']} />
        </div>
        {/* Grupo arrastado (levanta e desce). */}
        <div
            className="absolute left-2 right-2 z-10 h-[56px]"
            style={{ top: 8, animation: 'tourSwapActive 2.8s ease-in-out infinite alternate' }}
        >
            <MiniMeasureCard name="Película G20 — Exemplo" price="R$ 192,00" dims={['1.20', '1.00', '2']} active />
            <Pointer className="absolute -bottom-1 right-3 h-4 w-4 text-[var(--brand-primary)] drop-shadow" />
        </div>
    </div>
);

const SwipeChip: React.FC<{ icon: LucideIcon; label: string; className: string }> = ({ icon: ChipIcon, label, className }) => (
    <div className={`flex h-[44px] w-[30px] flex-col items-center justify-center gap-0.5 rounded-[8px] ${className}`}>
        <ChipIcon className="h-3.5 w-3.5" />
        <span className="text-[5px] font-bold uppercase tracking-wide">{label}</span>
    </div>
);

const SwipeDemo: React.FC = () => (
    <div className="tour-demo relative h-[60px] w-full overflow-hidden rounded-[12px] bg-[var(--surface-muted)]" aria-hidden="true">
        {/* Ações reveladas ao deslizar para a DIREITA (ficam à esquerda). */}
        <div className="absolute inset-y-2 left-2 flex items-center gap-1">
            <SwipeChip icon={Copy} label="Dup" className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" />
            <SwipeChip icon={Pencil} label="Edit" className="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" />
        </div>
        {/* Ação revelada ao deslizar para a ESQUERDA (fica à direita). */}
        <div className="absolute inset-y-2 right-2 flex items-center">
            <SwipeChip icon={Trash2} label="Excl" className="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300" />
        </div>
        {/* Cartão da medida que desliza. */}
        <div
            className="absolute inset-y-2 left-2 right-2 z-10"
            style={{ animation: 'tourSwipeCard 4.6s ease-in-out infinite' }}
        >
            <MiniMeasureCard name="Película G20 — Exemplo" price="R$ 192,00" dims={['1.20', '1.00', '2']} />
            <Pointer
                className="absolute bottom-1 right-2 h-4 w-4 text-[var(--brand-primary)] drop-shadow"
                style={{ animation: 'tourPulse 1.4s ease-in-out infinite' }}
            />
        </div>
    </div>
);

const TourDemo: React.FC<{ kind: 'reorder' | 'swipe' }> = ({ kind }) => (
    <div className="mt-3">
        <style>{DEMO_STYLES}</style>
        {kind === 'reorder' ? <ReorderDemo /> : <SwipeDemo />}
    </div>
);

const OnboardingTour: React.FC<OnboardingTourProps> = ({ onNavigate, forceOpen = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
    );

    // Mantém o conjunto de passos coerente com o tamanho da tela: no desktop os
    // passos de gestos de toque não aparecem.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mql = window.matchMedia(MOBILE_QUERY);
        const update = () => setIsMobile(mql.matches);
        update();
        mql.addEventListener('change', update);
        return () => mql.removeEventListener('change', update);
    }, []);

    const STEPS = isMobile ? ALL_STEPS : ALL_STEPS.filter(s => !s.mobileOnly);

    // Se a tela mudar de tamanho e reduzir o número de passos, evita índice inválido.
    useEffect(() => {
        setStepIndex(current => Math.min(current, STEPS.length - 1));
    }, [STEPS.length]);

    // Primeiro acesso: abre automaticamente se ainda não concluiu o tour.
    useEffect(() => {
        let done = false;
        try {
            done = localStorage.getItem(STORAGE_KEY) === 'done';
        } catch {
            done = false;
        }
        if (forceOpen || !done) {
            // Pequeno atraso para a interface estabilizar antes de destacar elementos.
            const timer = window.setTimeout(() => setIsOpen(true), 600);
            return () => window.clearTimeout(timer);
        }
    }, [forceOpen]);

    // Permite reabrir o tour de qualquer lugar: window.dispatchEvent(new Event('peliculas-br-open-tour')).
    useEffect(() => {
        const reopen = () => {
            setStepIndex(0);
            setIsOpen(true);
        };
        window.addEventListener(OPEN_EVENT, reopen);
        return () => window.removeEventListener(OPEN_EVENT, reopen);
    }, []);

    const step = STEPS[stepIndex];

    // Ao entrar num passo, navega para a aba correspondente.
    useEffect(() => {
        if (!isOpen || !step?.tab) return;
        onNavigate(step.tab);
    }, [isOpen, step?.tab, stepIndex, onNavigate]);

    // Recalcula a posição do destaque (após navegação, scroll e resize).
    const recompute = useCallback(() => {
        setRect(getVisibleTargetRect(step?.target));
    }, [step?.target]);

    useLayoutEffect(() => {
        if (!isOpen) return;
        recompute();
        // A navegação pode renderizar de forma assíncrona; tenta novamente.
        const t1 = window.setTimeout(recompute, 80);
        const t2 = window.setTimeout(recompute, 280);
        window.addEventListener('resize', recompute);
        window.addEventListener('scroll', recompute, true);
        return () => {
            window.clearTimeout(t1);
            window.clearTimeout(t2);
            window.removeEventListener('resize', recompute);
            window.removeEventListener('scroll', recompute, true);
        };
    }, [isOpen, recompute]);

    const finish = useCallback(() => {
        try {
            localStorage.setItem(STORAGE_KEY, 'done');
        } catch {
            // Ignora se o navegador bloquear o storage.
        }
        setIsOpen(false);
    }, []);

    const goNext = useCallback(() => {
        setStepIndex(current => {
            if (current >= STEPS.length - 1) {
                finish();
                return current;
            }
            return current + 1;
        });
    }, [finish]);

    const goPrev = useCallback(() => {
        setStepIndex(current => Math.max(0, current - 1));
    }, []);

    // Atalhos de teclado.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') finish();
            else if (e.key === 'ArrowRight') goNext();
            else if (e.key === 'ArrowLeft') goPrev();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, finish, goNext, goPrev]);

    if (!isOpen || !step) return null;

    const Icon = step.icon;
    const isFirst = stepIndex === 0;
    const isLast = stepIndex === STEPS.length - 1;
    const pad = 8;

    // Posição do cartão: ancorado ao elemento destacado, sem cobri-lo.
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    const cardWidth = Math.min(360, vw - 24);
    const gap = 14;
    // Altura estimada do cartão (com dica é mais alto). Usada só para decidir o
    // lado de ancoragem; o cartão real ajusta sozinho ao conteúdo.
    const estCardHeight = (step.tip ? 300 : 230) + (step.demo ? 130 : 0);
    const clamp = (value: number, min: number, max: number) =>
        Math.min(Math.max(value, min), Math.max(min, max));

    let cardStyle: React.CSSProperties;
    if (rect) {
        const spaceRight = vw - (rect.left + rect.width);
        const spaceBelow = vh - (rect.top + rect.height);
        const spaceAbove = rect.top;
        const maxTop = vh - estCardHeight - 12;

        if (spaceRight > cardWidth + 24) {
            // Espaço à direita (ex.: itens do menu lateral no desktop).
            const top = clamp(rect.top, 12, maxTop);
            cardStyle = { position: 'fixed', top, left: rect.left + rect.width + gap, width: cardWidth };
        } else {
            // Sem espaço lateral: ancora acima ou abaixo do alvo (mobile).
            const left = clamp(rect.left, 12, vw - cardWidth - 12);
            let top: number;
            if (spaceBelow > estCardHeight + gap) {
                top = rect.top + rect.height + gap;
            } else if (spaceAbove > estCardHeight + gap) {
                top = rect.top - estCardHeight - gap;
            } else {
                // Pouco espaço dos dois lados: usa o maior e evita sobrepor.
                top = spaceAbove > spaceBelow
                    ? rect.top - estCardHeight - gap
                    : rect.top + rect.height + gap;
            }
            cardStyle = { position: 'fixed', top: clamp(top, 12, maxTop), left, width: cardWidth };
        }
    } else {
        cardStyle = {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: cardWidth
        };
    }

    return (
        <div className="fixed inset-0 z-[10050] font-sans" role="dialog" aria-modal="true" aria-label="Guia de primeiros passos">
            {/* Camada escura: com recorte (spotlight) quando há um elemento destacado, senão fundo cheio. */}
            {rect ? (
                <div
                    aria-hidden="true"
                    style={{
                        position: 'fixed',
                        top: rect.top - pad,
                        left: rect.left - pad,
                        width: rect.width + pad * 2,
                        height: rect.height + pad * 2,
                        borderRadius: 14,
                        boxShadow: '0 0 0 9999px rgba(8, 17, 31, 0.72)',
                        outline: '2px solid rgba(59, 130, 246, 0.9)',
                        outlineOffset: 2,
                        transition: 'all 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                        pointerEvents: 'none'
                    }}
                />
            ) : (
                <div aria-hidden="true" className="fixed inset-0 bg-[rgba(8,17,31,0.72)]" />
            )}

            {/* Cartão do passo. */}
            <div
                style={cardStyle}
                className="rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-[var(--shadow-elevated)] dark:border-white/10"
            >
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="ui-kicker text-[var(--text-soft)]">
                            Passo {stepIndex + 1} de {STEPS.length}
                        </p>
                        <h3 className="mt-0.5 text-lg font-bold leading-tight text-[var(--text-strong)]">
                            {step.title}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={finish}
                        aria-label="Fechar guia"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-soft)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
                    {step.body}
                </p>

                {step.demo ? <TourDemo kind={step.demo} /> : null}

                {step.tip ? (
                    <p className="mt-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-xs leading-relaxed text-[var(--text-body)]">
                        💡 {step.tip}
                    </p>
                ) : null}

                {/* Indicadores de progresso. */}
                <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
                    {STEPS.map((s, i) => (
                        <span
                            key={s.id}
                            className={[
                                'h-1.5 rounded-full transition-all duration-200',
                                i === stepIndex
                                    ? 'w-5 bg-[var(--brand-primary)]'
                                    : 'w-1.5 bg-[var(--border-strong)]'
                            ].join(' ')}
                        />
                    ))}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={finish}
                        className="text-xs font-semibold text-[var(--text-soft)] transition-colors hover:text-[var(--text-strong)]"
                    >
                        Pular tour
                    </button>

                    <div className="flex items-center gap-2">
                        {!isFirst ? (
                            <button
                                type="button"
                                onClick={goPrev}
                                className="flex h-9 items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-3 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)]"
                            >
                                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                                Voltar
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={goNext}
                            className="flex h-9 items-center gap-1 rounded-[var(--radius-control)] bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--brand-primary-strong)]"
                        >
                            {isLast ? 'Concluir' : 'Próximo'}
                            {!isLast ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : null}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingTour;
