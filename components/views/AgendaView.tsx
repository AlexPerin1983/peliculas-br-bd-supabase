import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { Agendamento, AgendamentoServiceStatus, Client, SavedPDF } from '../../types';
import ActionButton from '../ui/ActionButton';
import ContentState from '../ui/ContentState';
import Modal from '../ui/Modal';
import AgendaPushReminderControl from './AgendaPushReminderControl';
import { parseCurrencyInput } from '../../src/lib/proposalExpenses';
import {
    buildReviewFollowUpMessage,
    buildShortReviewMessage,
    getReviewTokens,
    renderReviewTemplate,
    templatizeReviewMessage,
} from '../../src/lib/reviewMessage';

const formatCurrencyBR = (value: number): string =>
    (Number.isFinite(value) ? value : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface AgendaViewProps {
    agendamentos: Agendamento[];
    pdfs: SavedPDF[];
    clients: Client[];
    onEditAgendamento: (agendamento: Agendamento) => void;
    onUpdateServiceStatus: (agendamento: Agendamento, serviceStatus: AgendamentoServiceStatus) => void;
    onCompleteAgendamentoWithValue: (agendamento: Agendamento, finalValue: number) => void;
    onContinueAgendamento: (agendamento: Agendamento) => void;
    onRescheduleAgendamento: (agendamento: Agendamento) => void;
    onCreateNewAgendamento: (date: Date) => void;
    googleReviewsLink?: string;
}

type AgendamentoWithStatus = Agendamento & { status?: SavedPDF['status'] };

const SERVICE_STATUS_META: Record<AgendamentoServiceStatus, {
    text: string;
    iconClassName: string;
    badgeClasses: string;
}> = {
    scheduled: {
        text: 'Agendado',
        iconClassName: 'far fa-clock',
        badgeClasses: 'bg-blue-100 text-blue-800 dark:bg-blue-950/35 dark:text-blue-200',
    },
    completed: {
        text: 'Concluído',
        iconClassName: 'fas fa-check-circle',
        badgeClasses: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200',
    },
    partial: {
        text: 'Parcial — continua',
        iconClassName: 'fas fa-hourglass-half',
        badgeClasses: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/35 dark:text-indigo-200',
    },
    cancelled: {
        text: 'Cancelado',
        iconClassName: 'fas fa-ban',
        badgeClasses: 'bg-rose-100 text-rose-800 dark:bg-rose-950/35 dark:text-rose-200',
    },
    no_show: {
        text: 'Não compareceu',
        iconClassName: 'fas fa-user-slash',
        badgeClasses: 'bg-amber-100 text-amber-800 dark:bg-amber-950/35 dark:text-amber-200',
    },
};

const ServiceStatusBadge: React.FC<{ status: AgendamentoServiceStatus }> = ({ status }) => {
    const meta = SERVICE_STATUS_META[status];
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${meta.badgeClasses}`}>
            <i className={`${meta.iconClassName} text-[10px]`} aria-hidden="true"></i>
            {meta.text}
        </span>
    );
};

const STATUS_META: Record<NonNullable<SavedPDF['status']>, {
    text: string;
    badgeClasses: string;
    dotClasses: string;
    railClasses: string;
}> = {
    approved: {
        text: 'Aprovado',
        badgeClasses: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200',
        dotClasses: 'bg-emerald-500',
        railClasses: 'bg-emerald-500',
    },
    revised: {
        text: 'Revisar',
        badgeClasses: 'bg-amber-100 text-amber-800 dark:bg-amber-950/35 dark:text-amber-200',
        dotClasses: 'bg-amber-400',
        railClasses: 'bg-amber-400',
    },
    pending: {
        text: 'Pendente',
        badgeClasses: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
        dotClasses: 'bg-slate-400',
        railClasses: 'bg-slate-300 dark:bg-slate-600',
    },
};

const getStatusColor = (status?: SavedPDF['status']) => {
    return (STATUS_META[status || 'pending'] || STATUS_META.pending).dotClasses;
};

const SERVICE_STATUS_DOT: Record<AgendamentoServiceStatus, string> = {
    scheduled: 'bg-blue-500',
    completed: 'bg-emerald-500',
    partial: 'bg-indigo-500',
    cancelled: 'bg-rose-500',
    no_show: 'bg-amber-400',
};

const getServiceStatusColor = (serviceStatus?: AgendamentoServiceStatus) => (
    SERVICE_STATUS_DOT[serviceStatus || 'scheduled']
);

const formatFullAddress = (client?: Client): string => {
    if (!client) return '';
    const legacyAddress = (client as Client & { endereco?: string }).endereco?.trim();
    const parts = [client.logradouro, client.numero, client.complemento, client.bairro, client.cidade, client.uf, client.cep];
    const structuredAddress = parts
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(', ');

    return structuredAddress || legacyAddress || '';
};

const getMapsDirectionsUrl = (address: string) => (
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`
);

const normalizePhone = (phone?: string) => {
    const digits = phone?.replace(/\D/g, '') || '';
    if (!digits) return '';

    return digits.startsWith('55') ? digits : `55${digits}`;
};

const getWhatsappUrl = (phone?: string) => {
    const normalizedPhone = normalizePhone(phone);
    return normalizedPhone ? `https://wa.me/${normalizedPhone}` : '';
};

const isLikelyMobileDevice = () => (
    typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent)
);

const getRegularWhatsappUrl = (phone?: string, text?: string) => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return '';

    const encoded = text ? encodeURIComponent(text) : '';

    if (isLikelyMobileDevice()) {
        return `whatsapp://send?phone=${normalizedPhone}${encoded ? `&text=${encoded}` : ''}`;
    }

    return `https://wa.me/${normalizedPhone}${encoded ? `?text=${encoded}` : ''}`;
};

const getBusinessWhatsappUrl = (phone?: string, text?: string) => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return '';

    const encoded = text ? encodeURIComponent(text) : '';

    const webFallback = `https://wa.me/${normalizedPhone}${encoded ? `?text=${encoded}` : ''}`;

    if (typeof window !== 'undefined' && /Android/i.test(window.navigator.userAgent)) {
        // browser_fallback_url: se o WhatsApp Business nao estiver instalado, abre o WhatsApp Web.
        return `intent://send?phone=${normalizedPhone}${encoded ? `&text=${encoded}` : ''}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=${encodeURIComponent(webFallback)};end`;
    }

    if (typeof window !== 'undefined' && /iPhone|iPad|iPod/i.test(window.navigator.userAgent)) {
        return `whatsapp-business://send?phone=${normalizedPhone}${encoded ? `&text=${encoded}` : ''}`;
    }

    return webFallback;
};

const getTelUrl = (phone?: string) => {
    const digits = phone?.replace(/\D/g, '') || '';
    return digits ? `tel:${digits}` : '';
};

const formatTime = (value: string) => (
    new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
);

const getDurationLabel = (start: string, end: string) => {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const minutes = Math.max(0, Math.round((endTime - startTime) / 60000));
    if (minutes === 0) return '0min';
    if (minutes < 60) return `${minutes}min`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes ? `${hours}h${String(remainingMinutes).padStart(2, '0')}` : `${hours}h`;
};

const sameMonth = (date: Date, reference: Date) => (
    date.getFullYear() === reference.getFullYear()
    && date.getMonth() === reference.getMonth()
);

const getCountdownLabel = (start: string, end: string): string => {
    const now = Date.now();
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();

    if (now >= startTime && now <= endTime) return 'Em andamento';

    const diffMinutes = Math.round((startTime - now) / 60000);
    if (diffMinutes < 0) return '';
    if (diffMinutes < 60) return `Em ${diffMinutes}min`;

    if (diffMinutes < 1440) {
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        return minutes ? `Em ${hours}h${String(minutes).padStart(2, '0')}` : `Em ${hours}h`;
    }

    const days = Math.floor(diffMinutes / 1440);
    return days === 1 ? 'Amanhã' : `Em ${days} dias`;
};

const getRelativeDayLabel = (start: string): string => {
    const date = new Date(start);
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Hoje';
    if (date.toDateString() === tomorrow.toDateString()) return 'Amanhã';

    return date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
};

const AGENDA_ACTION_TONE_CLASSES = {
    neutral: 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-strong)]',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-emerald-950/25 dark:text-emerald-200 dark:hover:bg-emerald-900/35',
    blue: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800/70 dark:bg-blue-950/25 dark:text-blue-200 dark:hover:bg-blue-900/35',
} as const;

const AGENDA_ACTION_BASE_CLASSES = 'inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-[var(--radius-control)] border px-3 text-xs font-bold transition-colors';

const AgendaActionLink: React.FC<{
    href: string;
    label: string;
    ariaLabel: string;
    iconClassName: string;
    tone?: keyof typeof AGENDA_ACTION_TONE_CLASSES;
    className?: string;
}> = ({ href, label, ariaLabel, iconClassName, tone = 'neutral', className = '' }) => (
    <a
        href={href}
        target={href.startsWith('tel:') ? undefined : '_blank'}
        rel={href.startsWith('tel:') ? undefined : 'noreferrer'}
        onClick={(event) => event.stopPropagation()}
        aria-label={ariaLabel}
        className={`${AGENDA_ACTION_BASE_CLASSES} ${AGENDA_ACTION_TONE_CLASSES[tone]} ${className}`}
    >
        <i className={`${iconClassName} text-[11px]`} aria-hidden="true"></i>
        <span className="truncate">{label}</span>
    </a>
);

const AgendaActionButton: React.FC<{
    onClick: () => void;
    label: string;
    ariaLabel: string;
    iconClassName: string;
    tone?: keyof typeof AGENDA_ACTION_TONE_CLASSES;
    className?: string;
}> = ({ onClick, label, ariaLabel, iconClassName, tone = 'neutral', className = '' }) => (
    <button
        type="button"
        onClick={(event) => {
            event.stopPropagation();
            onClick();
        }}
        aria-label={ariaLabel}
        className={`${AGENDA_ACTION_BASE_CLASSES} ${AGENDA_ACTION_TONE_CLASSES[tone]} ${className}`}
    >
        <i className={`${iconClassName} text-[11px]`} aria-hidden="true"></i>
        <span className="truncate">{label}</span>
    </button>
);

const AgendaWhatsAppChooserModal: React.FC<{
    clientName: string;
    phone?: string;
    messageText?: string;
    onClose: () => void;
}> = ({ clientName, phone, messageText, onClose }) => {
    const regularUrl = getRegularWhatsappUrl(phone, messageText);
    const businessUrl = getBusinessWhatsappUrl(phone, messageText);
    // WhatsApp Business só faz sentido no mobile (deep link Android/iOS); no desktop ambos abrem o WhatsApp Web.
    const showBusiness = isLikelyMobileDevice();

    if (!regularUrl) return null;

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            wrapperClassName="backdrop-blur-sm"
            title={
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <i className="fab fa-whatsapp"></i>
                    </div>
                    <div className="min-w-0">
                        <div className="text-xl font-semibold text-slate-800 dark:text-white">
                            Abrir conversa
                        </div>
                    </div>
                </div>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Escolha qual app deseja usar para falar com <strong className="text-slate-700 dark:text-slate-200">{clientName}</strong>.
                </p>

                <div className={`grid gap-3 ${showBusiness ? 'sm:grid-cols-2' : ''}`}>
                    <a
                        href={regularUrl}
                        onClick={onClose}
                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
                    >
                        <i className="fab fa-whatsapp text-base"></i>
                        WhatsApp
                    </a>

                    {showBusiness && businessUrl && (
                        <a
                            href={businessUrl}
                            onClick={onClose}
                            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                        >
                            <i className="fas fa-briefcase text-sm"></i>
                            WhatsApp Business
                        </a>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                    Cancelar
                </button>
            </div>
        </Modal>
    );
};

type ReviewScriptMode = 'short' | 'long';

const REVIEW_SCRIPT_OPTIONS: { key: ReviewScriptMode; label: string; iconClassName: string }[] = [
    { key: 'short', label: 'Na hora, com o cliente', iconClassName: 'fas fa-user-check' },
    { key: 'long', label: 'Depois, à distância', iconClassName: 'fas fa-paper-plane' },
];

// Molde editado pelo usuario fica salvo no navegador (sem banco), por script.
const REVIEW_TEMPLATES_STORAGE_KEY = 'peliculas-br-agenda-review-templates-v1';

const readReviewTemplate = (mode: ReviewScriptMode): string | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(REVIEW_TEMPLATES_STORAGE_KEY);
        if (!raw) return null;
        const value = (JSON.parse(raw) as Record<string, unknown>)?.[mode];
        return typeof value === 'string' ? value : null;
    } catch {
        return null;
    }
};

const saveReviewTemplate = (mode: ReviewScriptMode, template: string) => {
    if (typeof window === 'undefined') return;
    try {
        const raw = window.localStorage.getItem(REVIEW_TEMPLATES_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        window.localStorage.setItem(REVIEW_TEMPLATES_STORAGE_KEY, JSON.stringify({ ...parsed, [mode]: template }));
    } catch {
        // Silencioso: localStorage indisponivel (modo privado/quota).
    }
};

const removeReviewTemplate = (mode: ReviewScriptMode) => {
    if (typeof window === 'undefined') return;
    try {
        const raw = window.localStorage.getItem(REVIEW_TEMPLATES_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        delete parsed[mode];
        window.localStorage.setItem(REVIEW_TEMPLATES_STORAGE_KEY, JSON.stringify(parsed));
    } catch {
        // Silencioso.
    }
};

// Nota da avaliacao por atendimento (0 = ainda nao avaliado). Salva no navegador.
const REVIEW_RATINGS_STORAGE_KEY = 'peliculas-br-agenda-review-ratings-v1';

const readAllReviewRatings = (): Record<number, number> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(REVIEW_RATINGS_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return Object.entries(parsed).reduce<Record<number, number>>((acc, [id, value]) => {
            const stars = Number(value);
            if (Number.isFinite(stars) && stars > 0) acc[Number(id)] = stars;
            return acc;
        }, {});
    } catch {
        return {};
    }
};

const saveAllReviewRatings = (ratings: Record<number, number>) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(REVIEW_RATINGS_STORAGE_KEY, JSON.stringify(ratings));
    } catch {
        // Silencioso: localStorage indisponivel (modo privado/quota).
    }
};

const ReviewStars: React.FC<{ stars: number; className?: string }> = ({ stars, className = '' }) => (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${stars} de 5 estrelas`}>
        {[1, 2, 3, 4, 5].map((value) => (
            <i
                key={value}
                className={`fas fa-star ${value <= stars ? 'text-amber-400' : 'text-emerald-300/40 dark:text-emerald-700/50'}`}
                aria-hidden="true"
            />
        ))}
    </span>
);

const ReviewRequestModal: React.FC<{
    agendamento: Agendamento;
    client?: Client;
    linkedPdf?: SavedPDF;
    googleReviewsLink?: string;
    stars: number;
    onRate: (stars: number) => void;
    onClose: () => void;
}> = ({ agendamento, client, linkedPdf, googleReviewsLink, stars, onRate, onClose }) => {
    // useMemo mantem identidade estavel para nao resetar a edicao da textarea a
    // cada render (o objeto de fallback seria recriado sempre, senao).
    const reviewClient = useMemo(
        () => client || ({ nome: agendamento.clienteNome } as Client),
        [client, agendamento.clienteNome],
    );
    const source = useMemo(
        () => linkedPdf || { clientName: agendamento.clienteNome },
        [linkedPdf, agendamento.clienteNome],
    );

    const shortMessage = useMemo(
        () => buildShortReviewMessage(source, reviewClient, googleReviewsLink),
        [source, reviewClient, googleReviewsLink],
    );
    const longMessage = useMemo(
        () => buildReviewFollowUpMessage(source, reviewClient, googleReviewsLink),
        [source, reviewClient, googleReviewsLink],
    );

    const tokens = useMemo(
        () => getReviewTokens(source, reviewClient, googleReviewsLink),
        [source, reviewClient, googleReviewsLink],
    );

    // Texto de cada script: se houver molde salvo no navegador, reidrata com os
    // dados deste atendimento; senao, usa o texto padrao gerado.
    const computeMessageForMode = useCallback((nextMode: ReviewScriptMode) => {
        const savedTemplate = readReviewTemplate(nextMode);
        if (savedTemplate !== null) return renderReviewTemplate(savedTemplate, tokens);
        return nextMode === 'short' ? shortMessage : longMessage;
    }, [tokens, shortMessage, longMessage]);

    const [mode, setMode] = useState<ReviewScriptMode>('short');
    const [message, setMessage] = useState(() => computeMessageForMode('short'));
    const [hasOverride, setHasOverride] = useState(() => readReviewTemplate('short') !== null);
    const [copied, setCopied] = useState(false);
    const [isChoosingWhatsapp, setIsChoosingWhatsapp] = useState(false);

    // Recarrega o texto ao trocar de script (ou quando os dados mudam).
    useEffect(() => {
        setMessage(computeMessageForMode(mode));
        setHasOverride(readReviewTemplate(mode) !== null);
    }, [mode, computeMessageForMode]);

    // Salva a edicao como molde (com marcadores) no navegador, a cada alteracao.
    const handleMessageChange = (value: string) => {
        setMessage(value);
        saveReviewTemplate(mode, templatizeReviewMessage(value, tokens));
        setHasOverride(true);
    };

    const handleResetTemplate = () => {
        removeReviewTemplate(mode);
        setMessage(mode === 'short' ? shortMessage : longMessage);
        setHasOverride(false);
    };

    const hasLink = Boolean(googleReviewsLink?.trim());
    const phone = client?.telefone;
    const hasPhone = Boolean(getWhatsappUrl(phone));

    const handleCopy = async () => {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                await navigator.clipboard.writeText(message);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
            }
        } catch {
            // Silencioso: alguns navegadores bloqueiam o clipboard sem gesto direto.
        }
    };

    const swipeStartXRef = useRef<number | null>(null);

    const goToAdjacentScript = (direction: 1 | -1) => {
        const order = REVIEW_SCRIPT_OPTIONS.map((option) => option.key);
        const currentIndex = order.indexOf(mode);
        const nextIndex = Math.min(order.length - 1, Math.max(0, currentIndex + direction));
        if (nextIndex !== currentIndex) setMode(order[nextIndex]);
    };

    const handleSwipeStart = (event: React.TouchEvent) => {
        // Ignora gestos iniciados na textarea para nao atrapalhar a edicao do texto.
        if ((event.target as HTMLElement).closest('textarea')) {
            swipeStartXRef.current = null;
            return;
        }
        swipeStartXRef.current = event.touches[0].clientX;
    };

    const handleSwipeEnd = (event: React.TouchEvent) => {
        const startX = swipeStartXRef.current;
        swipeStartXRef.current = null;
        if (startX === null) return;
        const deltaX = event.changedTouches[0].clientX - startX;
        if (Math.abs(deltaX) < 50) return;
        // Arrasta para a esquerda avanca; para a direita volta.
        goToAdjacentScript(deltaX < 0 ? 1 : -1);
    };

    return (
        <Drawer.Root open={true} onOpenChange={(open) => !open && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[9999] bg-slate-950/68 backdrop-blur-sm" />
                <Drawer.Content className="fixed inset-x-0 bottom-0 z-[10000] mx-auto flex h-[100dvh] max-h-[100dvh] flex-col rounded-t-[var(--radius-panel)] border-t border-[var(--border-subtle)] bg-[var(--surface)] outline-none sm:max-w-xl">
                    <div className="mx-auto mt-3 h-1.5 w-12 flex-shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden="true" />

                    <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
                                <i className="fas fa-star"></i>
                            </div>
                            <div className="min-w-0">
                                <div className="text-xl font-semibold text-slate-800 dark:text-white">Pedir avaliação</div>
                                <div className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                                    {agendamento.clienteNome}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Fechar"
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                        >
                            <i className="fas fa-times" aria-hidden="true"></i>
                        </button>
                    </div>

                    <div
                        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-2"
                        onTouchStart={handleSwipeStart}
                        onTouchEnd={handleSwipeEnd}
                    >
                        <div className="flex items-center justify-center gap-2 pt-1">
                            {REVIEW_SCRIPT_OPTIONS.map((option) => {
                                const isActive = mode === option.key;
                                return (
                                    <button
                                        key={option.key}
                                        type="button"
                                        onClick={() => setMode(option.key)}
                                        aria-pressed={isActive}
                                        aria-label={option.label}
                                        title={option.label}
                                        className={`h-2.5 rounded-full transition-all ${isActive ? 'w-6 bg-[var(--brand-primary)]' : 'w-2.5 bg-slate-300 dark:bg-slate-600'}`}
                                    />
                                );
                            })}
                        </div>

                        {!hasLink ? (
                            <div className="rounded-[var(--radius-control)] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/25 dark:text-amber-200">
                                <p className="flex items-start gap-2">
                                    <i className="fas fa-circle-info mt-0.5 text-[12px]" aria-hidden="true"></i>
                                    <span>
                                        Cadastre o <strong>link de avaliação do Google</strong> em
                                        {' '}Configurações → Redes sociais para que a mensagem inclua o link automaticamente.
                                    </span>
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                                {mode === 'short'
                                    ? 'Mensagem curta para avaliar junto com o cliente, na hora. Puxa só o modelo da película e o bairro vinculados ao serviço.'
                                    : 'Mensagem completa de pós-venda para enviar depois que você já saiu, com link do Google e dicas de SEO.'}
                            </p>
                        )}

                        <div className={`rounded-[var(--radius-control)] border p-3 transition-colors ${stars > 0 ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800/70 dark:bg-emerald-950/25' : 'border-amber-300 bg-amber-50 dark:border-amber-800/70 dark:bg-amber-950/25'}`}>
                            <div className="flex items-center justify-between gap-2">
                                <span className={`text-xs font-bold uppercase tracking-wide ${stars > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                                    Avaliação do cliente
                                </span>
                                {stars > 0 ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                        <i className="fas fa-circle-check text-[11px]" aria-hidden="true"></i>
                                        Avaliado
                                    </span>
                                ) : (
                                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Toque para marcar</span>
                                )}
                            </div>
                            <div className="mt-2 flex items-center justify-center gap-2">
                                {[1, 2, 3, 4, 5].map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => onRate(value === stars ? 0 : value)}
                                        aria-label={`${value} estrela${value > 1 ? 's' : ''}`}
                                        className="p-1 transition-transform active:scale-90"
                                    >
                                        <i className={`fas fa-star text-3xl ${value <= stars ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} aria-hidden="true"></i>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col">
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Mensagem de avaliação
                                </label>
                                {hasOverride ? (
                                    <button
                                        type="button"
                                        onClick={handleResetTemplate}
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 transition-colors hover:text-[var(--brand-primary)] dark:text-slate-400"
                                    >
                                        <i className="fas fa-rotate-left text-[10px]" aria-hidden="true"></i>
                                        Restaurar padrão
                                    </button>
                                ) : null}
                            </div>
                            <textarea
                                value={message}
                                onChange={(event) => handleMessageChange(event.target.value)}
                                className="w-full flex-1 min-h-[180px] resize-none rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-sm leading-relaxed text-[var(--text-strong)] outline-none focus:border-[var(--brand-primary)]"
                                placeholder="Escreva a mensagem de avaliação..."
                            />
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                {!hasPhone
                                    ? 'Cliente sem telefone cadastrado — use "Copiar texto" para enviar manualmente.'
                                    : 'Suas edições ficam salvas neste navegador e já vêm prontas no próximo atendimento.'}
                            </p>
                        </div>
                    </div>

                    <div
                        className="flex flex-shrink-0 flex-col gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 sm:flex-row sm:justify-end"
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
                    >
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        >
                            <i className={`fas ${copied ? 'fa-check' : 'fa-copy'} text-[13px]`} aria-hidden="true"></i>
                            {copied ? 'Copiado!' : 'Copiar texto'}
                        </button>
                        <button
                            type="button"
                            disabled={!hasPhone}
                            onClick={() => setIsChoosingWhatsapp(true)}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-emerald-500 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <i className="fab fa-whatsapp text-base" aria-hidden="true"></i>
                            Enviar no WhatsApp
                        </button>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>

            {isChoosingWhatsapp ? (
                <AgendaWhatsAppChooserModal
                    clientName={agendamento.clienteNome}
                    phone={phone}
                    messageText={message}
                    onClose={() => {
                        setIsChoosingWhatsapp(false);
                        onClose();
                    }}
                />
            ) : null}
        </Drawer.Root>
    );
};

const RouteActionLink: React.FC<{
    address: string;
    clientName: string;
}> = ({ address, clientName }) => (
    <AgendaActionLink
        href={getMapsDirectionsUrl(address)}
        label="Navegar até endereço"
        ariaLabel={`Navegar até endereço de ${clientName}`}
        iconClassName="fas fa-location-arrow"
        tone="green"
        className="col-span-2 sm:col-span-1"
    />
);

const AppointmentCard: React.FC<{
    agendamento: AgendamentoWithStatus;
    client?: Client;
    linkedPdf?: SavedPDF;
    onEdit: (agendamento: Agendamento) => void;
    onUpdateServiceStatus: (agendamento: Agendamento, serviceStatus: AgendamentoServiceStatus) => void;
    onCompleteWithValue: (agendamento: Agendamento, finalValue: number) => void;
    onContinueAgendamento: (agendamento: Agendamento) => void;
    onReschedule: (agendamento: Agendamento) => void;
    googleReviewsLink?: string;
    reviewStars: number;
    onUpdateReviewRating: (agendamentoId: number, stars: number) => void;
}> = ({ agendamento, client, linkedPdf, onEdit, onUpdateServiceStatus, onCompleteWithValue, onContinueAgendamento, onReschedule, googleReviewsLink, reviewStars, onUpdateReviewRating }) => {
    const status = agendamento.status || 'pending';
    const meta = STATUS_META[status] || STATUS_META.pending;
    const serviceStatus = agendamento.serviceStatus || 'scheduled';
    const hasEnded = new Date(agendamento.end).getTime() < Date.now();
    const showEndedPrompt = serviceStatus === 'scheduled' && hasEnded;
    const [isConfirmingValue, setIsConfirmingValue] = useState(false);
    const [finalValueInput, setFinalValueInput] = useState('');
    const [isChoosingWhatsapp, setIsChoosingWhatsapp] = useState(false);
    const [isRequestingReview, setIsRequestingReview] = useState(false);

    // Valor exibido/editado: vem do orcamento vinculado ou, sem orcamento, do
    // valor avulso guardado no proprio agendamento.
    const currentValue = linkedPdf ? linkedPdf.totalPreco : agendamento.valorFinal;
    const hasCurrentValue = typeof currentValue === 'number' && Number.isFinite(currentValue);

    const openValuePanel = () => {
        setFinalValueInput(hasCurrentValue ? formatCurrencyBR(currentValue!) : '');
        setIsConfirmingValue(true);
    };

    const handleCompleteClick = () => {
        openValuePanel();
    };

    const handleConfirmValue = () => {
        const parsed = parseCurrencyInput(finalValueInput);
        onCompleteWithValue(agendamento, parsed);
        setIsConfirmingValue(false);
    };

    const handleEditValueClick = () => {
        openValuePanel();
    };

    const isCompleted = serviceStatus === 'completed';
    const isReviewed = reviewStars > 0;

    const valueConfirmationPanel = (
        <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                <i className="fas fa-circle-check text-[11px]" aria-hidden="true"></i>
                Valor final do serviço
            </p>
            <p className="mb-2 text-[11px] leading-4 text-[var(--text-muted)]">
                {linkedPdf
                    ? 'Confirme ou ajuste o valor cobrado (acréscimos ou descontos feitos na hora). Ele substituirá o valor do orçamento.'
                    : 'Informe o valor cobrado neste atendimento. Ele entra no seu resultado financeiro.'}
            </p>
            <div className="flex items-center gap-2">
                <div className="flex h-10 flex-1 items-center gap-1.5 rounded-[var(--radius-control)] border border-emerald-300 bg-white px-3 dark:border-emerald-800/70 dark:bg-slate-800">
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400">R$</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={finalValueInput}
                        autoFocus
                        onChange={(e) => setFinalValueInput(e.target.value)}
                        className="w-full bg-transparent text-base font-bold text-[var(--text-strong)] outline-none"
                        placeholder="0,00"
                    />
                </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => setIsConfirmingValue(false)}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                    <span className="truncate">Cancelar</span>
                </button>
                <button
                    type="button"
                    onClick={handleConfirmValue}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-emerald-300 bg-emerald-100 px-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-200 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-200"
                >
                    <i className="fas fa-check text-[11px]" aria-hidden="true"></i>
                    <span className="truncate">{isCompleted ? 'Salvar valor' : 'Confirmar conclusão'}</span>
                </button>
            </div>
        </div>
    );

    const bairro = client?.bairro;
    const clientAddress = formatFullAddress(client);
    const telUrl = getTelUrl(client?.telefone);
    const whatsappUrl = getWhatsappUrl(client?.telefone);
    const startTime = formatTime(agendamento.start);
    const endTime = formatTime(agendamento.end);
    const duration = getDurationLabel(agendamento.start, agendamento.end);
    const hasActions = Boolean(telUrl || whatsappUrl || clientAddress);

    return (
        <article className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] text-left shadow-[var(--shadow-hairline)] transition-all duration-200 hover:shadow-[var(--shadow-soft)]">
            <button
                type="button"
                onClick={() => onEdit(agendamento)}
                className="group w-full p-3 text-left transition-colors hover:bg-[var(--surface-muted)] sm:p-4"
            >
                <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-start gap-3">
                    <div className="flex min-h-[74px] flex-col items-center justify-between rounded-[var(--radius-control)] bg-[var(--surface-muted)] px-2 py-2 text-center">
                        <span className="text-sm font-black leading-none text-[var(--text-strong)]">{startTime}</span>
                        <span className={`my-1 h-5 w-0.5 rounded-full ${meta.railClasses}`} aria-hidden="true"></span>
                        <span className="text-sm font-black leading-none text-[var(--text-strong)]">{endTime}</span>
                    </div>

                    <div className="min-w-0">
                        <div className="flex min-w-0 items-start gap-2">
                            <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dotClasses}`} aria-hidden="true"></div>
                            <div className="min-w-0">
                                <p className="truncate text-base font-black leading-tight text-[var(--text-strong)] sm:text-lg">
                                    {agendamento.clienteNome}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {serviceStatus !== 'scheduled' ? <ServiceStatusBadge status={serviceStatus} /> : null}
                                    {isReviewed ? (
                                        <span
                                            onClick={(event) => { event.stopPropagation(); setIsRequestingReview(true); }}
                                            title="Ver / editar avaliação"
                                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-200 dark:bg-emerald-950/35 dark:text-emerald-200 dark:hover:bg-emerald-900/45"
                                        >
                                            <i className="fas fa-circle-check text-[10px]" aria-hidden="true"></i>
                                            Avaliado
                                            <ReviewStars stars={reviewStars} className="text-[8px]" />
                                        </span>
                                    ) : null}
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-muted)] px-2 py-1 text-xs font-bold text-[var(--text-muted)]">
                                        <i className="far fa-clock text-[10px]" aria-hidden="true"></i>
                                        {duration}
                                    </span>
                                    {bairro ? (
                                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--surface-muted)] px-2 py-1 text-xs font-bold text-[var(--text-muted)]" title={clientAddress}>
                                            <i className="fas fa-map-marker-alt text-[10px]" aria-hidden="true"></i>
                                            <span className="truncate">{bairro}</span>
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {agendamento.notes ? (
                            <p className="mt-3 line-clamp-2 rounded-[var(--radius-control)] bg-[var(--surface-muted)] px-3 py-2 text-sm leading-5 text-[var(--text-muted)] whitespace-pre-wrap">
                                {agendamento.notes}
                            </p>
                        ) : null}
                    </div>

                    <i className="fas fa-chevron-right mt-1 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"></i>
                </div>
            </button>

            {showEndedPrompt ? (
                <div className="border-t border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                    {isConfirmingValue ? (
                        valueConfirmationPanel
                    ) : (
                        <>
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-200">
                                <i className="fas fa-circle-exclamation text-[11px]" aria-hidden="true"></i>
                                Horário encerrado — como foi o atendimento?
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={handleCompleteClick}
                                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-emerald-300 bg-emerald-100 px-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-200 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-200"
                                >
                                    <i className="fas fa-check text-[11px]" aria-hidden="true"></i>
                                    <span className="truncate">Concluído</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onUpdateServiceStatus(agendamento, 'no_show')}
                                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-amber-300 bg-white px-2 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800/70 dark:bg-slate-800 dark:text-amber-200"
                                >
                                    <i className="fas fa-user-slash text-[11px]" aria-hidden="true"></i>
                                    <span className="truncate">Faltou</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onUpdateServiceStatus(agendamento, 'cancelled')}
                                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-rose-300 bg-white px-2 text-xs font-bold text-rose-800 transition-colors hover:bg-rose-100 dark:border-rose-800/70 dark:bg-slate-800 dark:text-rose-200"
                                >
                                    <i className="fas fa-ban text-[11px]" aria-hidden="true"></i>
                                    <span className="truncate">Cancelado</span>
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => onContinueAgendamento(agendamento)}
                                className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-indigo-300 bg-indigo-100 px-2 text-xs font-bold text-indigo-800 transition-colors hover:bg-indigo-200 dark:border-indigo-800/70 dark:bg-indigo-950/40 dark:text-indigo-200"
                            >
                                <i className="fas fa-hourglass-half text-[11px]" aria-hidden="true"></i>
                                <span className="truncate">Não terminou? Continuar outro dia</span>
                            </button>
                        </>
                    )}
                </div>
            ) : null}

            {isCompleted ? (
                <div className="border-t border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/15">
                    {isConfirmingValue ? (
                        valueConfirmationPanel
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <span className="block text-[10px] font-bold uppercase text-emerald-700/70 dark:text-emerald-300/60">Valor final</span>
                                    <span className="block text-sm font-black text-emerald-800 dark:text-emerald-200">
                                        {hasCurrentValue ? `R$ ${formatCurrencyBR(currentValue!)}` : 'Sem valor'}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleEditValueClick}
                                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border border-emerald-300 bg-white px-3 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-slate-800 dark:text-emerald-200"
                                >
                                    <i className={`fas ${hasCurrentValue ? 'fa-pen' : 'fa-plus'} text-[10px]`} aria-hidden="true"></i>
                                    <span>{hasCurrentValue ? 'Editar valor' : 'Adicionar valor'}</span>
                                </button>
                            </div>
                            {!isReviewed ? (
                                <button
                                    type="button"
                                    onClick={() => setIsRequestingReview(true)}
                                    className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-amber-300 bg-amber-100 px-2 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-200 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-200"
                                >
                                    <i className="fas fa-star text-[11px]" aria-hidden="true"></i>
                                    <span className="truncate">Pedir avaliação no Google</span>
                                </button>
                            ) : null}
                        </>
                    )}
                </div>
            ) : null}

            {isRequestingReview ? (
                <ReviewRequestModal
                    agendamento={agendamento}
                    client={client}
                    linkedPdf={linkedPdf}
                    googleReviewsLink={googleReviewsLink}
                    stars={reviewStars}
                    onRate={(value) => { if (agendamento.id != null) onUpdateReviewRating(agendamento.id, value); }}
                    onClose={() => setIsRequestingReview(false)}
                />
            ) : null}

            {serviceStatus === 'cancelled' || serviceStatus === 'no_show' ? (
                <div className="border-t border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-muted)_60%,transparent)] p-2">
                    <button
                        type="button"
                        onClick={() => onReschedule(agendamento)}
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-indigo-300 bg-indigo-100 px-2 text-xs font-bold text-indigo-800 transition-colors hover:bg-indigo-200 dark:border-indigo-800/70 dark:bg-indigo-950/40 dark:text-indigo-200"
                    >
                        <i className="fas fa-rotate-right text-[11px]" aria-hidden="true"></i>
                        <span className="truncate">Reagendar para outra data</span>
                    </button>
                </div>
            ) : null}

            {hasActions ? (
                <div className="grid grid-cols-2 gap-2 border-t border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-muted)_60%,transparent)] p-2 sm:grid-cols-3">
                    {telUrl ? (
                        <AgendaActionLink
                            href={telUrl}
                            label="Ligar"
                            ariaLabel={`Ligar para ${agendamento.clienteNome}`}
                            iconClassName="fas fa-phone"
                        />
                    ) : null}
                    {whatsappUrl ? (
                        <AgendaActionButton
                            onClick={() => setIsChoosingWhatsapp(true)}
                            label="WhatsApp"
                            ariaLabel={`Abrir WhatsApp de ${agendamento.clienteNome}`}
                            iconClassName="fab fa-whatsapp"
                            tone="blue"
                        />
                    ) : null}
                    {clientAddress ? (
                        <RouteActionLink address={clientAddress} clientName={agendamento.clienteNome} />
                    ) : null}
                </div>
            ) : null}

            {isChoosingWhatsapp ? (
                <AgendaWhatsAppChooserModal
                    clientName={agendamento.clienteNome}
                    phone={client?.telefone}
                    onClose={() => setIsChoosingWhatsapp(false)}
                />
            ) : null}
        </article>
    );
};

const NextAppointmentCard: React.FC<{
    agendamento: AgendamentoWithStatus;
    client?: Client;
    onOpen: (agendamento: Agendamento) => void;
}> = ({ agendamento, client, onOpen }) => {
    const [isChoosingWhatsapp, setIsChoosingWhatsapp] = useState(false);

    const clientAddress = formatFullAddress(client);
    const telUrl = getTelUrl(client?.telefone);
    const whatsappUrl = getWhatsappUrl(client?.telefone);
    const bairro = client?.bairro;
    const countdown = getCountdownLabel(agendamento.start, agendamento.end);
    const relativeDay = getRelativeDayLabel(agendamento.start);
    const startTime = formatTime(agendamento.start);
    const endTime = formatTime(agendamento.end);
    const hasActions = Boolean(telUrl || whatsappUrl || clientAddress);

    return (
        <article className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--brand-primary)]/30 bg-gradient-to-br from-[color-mix(in_srgb,var(--brand-primary)_10%,var(--surface))] to-[var(--surface)] shadow-[var(--shadow-soft)]">
            <button
                type="button"
                onClick={() => onOpen(agendamento)}
                className="w-full p-4 text-left"
            >
                <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[var(--brand-primary)]">
                        <i className="fas fa-bolt text-[10px]" aria-hidden="true"></i>
                        Próximo atendimento
                    </span>
                    {countdown ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-primary)] px-2.5 py-1 text-[11px] font-black text-white">
                            <i className="far fa-clock text-[10px]" aria-hidden="true"></i>
                            {countdown}
                        </span>
                    ) : null}
                </div>

                <p className="mt-2 truncate text-lg font-black leading-tight text-[var(--text-strong)]">
                    {agendamento.clienteNome}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-muted)] px-2 py-1 text-xs font-bold text-[var(--text-muted)]">
                        <i className="far fa-calendar text-[10px]" aria-hidden="true"></i>
                        {relativeDay}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-muted)] px-2 py-1 text-xs font-bold text-[var(--text-muted)]">
                        <i className="far fa-clock text-[10px]" aria-hidden="true"></i>
                        {startTime}-{endTime}
                    </span>
                    {bairro ? (
                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--surface-muted)] px-2 py-1 text-xs font-bold text-[var(--text-muted)]" title={clientAddress}>
                            <i className="fas fa-map-marker-alt text-[10px]" aria-hidden="true"></i>
                            <span className="truncate">{bairro}</span>
                        </span>
                    ) : null}
                </div>
            </button>

            {hasActions ? (
                <div className="grid grid-cols-2 gap-2 border-t border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-muted)_60%,transparent)] p-2 sm:grid-cols-3">
                    {telUrl ? (
                        <AgendaActionLink
                            href={telUrl}
                            label="Ligar"
                            ariaLabel={`Ligar para ${agendamento.clienteNome}`}
                            iconClassName="fas fa-phone"
                        />
                    ) : null}
                    {whatsappUrl ? (
                        <AgendaActionButton
                            onClick={() => setIsChoosingWhatsapp(true)}
                            label="WhatsApp"
                            ariaLabel={`Abrir WhatsApp de ${agendamento.clienteNome}`}
                            iconClassName="fab fa-whatsapp"
                            tone="blue"
                        />
                    ) : null}
                    {clientAddress ? (
                        <RouteActionLink address={clientAddress} clientName={agendamento.clienteNome} />
                    ) : null}
                </div>
            ) : null}

            {isChoosingWhatsapp ? (
                <AgendaWhatsAppChooserModal
                    clientName={agendamento.clienteNome}
                    phone={client?.telefone}
                    onClose={() => setIsChoosingWhatsapp(false)}
                />
            ) : null}
        </article>
    );
};

const DayAgendaSummary: React.FC<{
    agendamentos: AgendamentoWithStatus[];
}> = ({ agendamentos }) => {
    if (agendamentos.length === 0) return null;

    const first = agendamentos[0];
    const last = agendamentos[agendamentos.length - 1];
    const completedCount = agendamentos.filter((item) => item.serviceStatus === 'completed').length;
    const scheduledCount = agendamentos.filter((item) => (item.serviceStatus || 'scheduled') === 'scheduled').length;
    const missedCount = agendamentos.filter((item) => item.serviceStatus === 'cancelled' || item.serviceStatus === 'no_show').length;

    return (
        <div className="mb-3 grid grid-cols-3 gap-2">
            <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-hairline)]">
                <span className="block text-[10px] font-bold uppercase text-[var(--text-soft)]">Agenda</span>
                <span className="mt-0.5 block text-sm font-black text-[var(--text-strong)]">{agendamentos.length}</span>
            </div>
            <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-hairline)]">
                <span className="block text-[10px] font-bold uppercase text-[var(--text-soft)]">Janela</span>
                <span className="mt-0.5 block truncate text-sm font-black text-[var(--text-strong)]">
                    {formatTime(first.start)}-{formatTime(last.end)}
                </span>
            </div>
            <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-hairline)]">
                <span className="block text-[10px] font-bold uppercase text-[var(--text-soft)]">Status</span>
                <span className="mt-1 flex items-center gap-1.5">
                    <span title="Concluídos" className="inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    <span className="text-xs font-black text-[var(--text-strong)]">{completedCount}</span>
                    <span title="Agendados" className="inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
                    <span className="text-xs font-black text-[var(--text-strong)]">{scheduledCount}</span>
                    <span title="Cancelados / Faltou" className="inline-flex h-2 w-2 rounded-full bg-rose-500"></span>
                    <span className="text-xs font-black text-[var(--text-strong)]">{missedCount}</span>
                </span>
            </div>
        </div>
    );
};

const CalendarMonthStats: React.FC<{
    total: number;
    completed: number;
    scheduled: number;
    missed: number;
}> = ({ total, completed, scheduled, missed }) => (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-bold text-[var(--text-muted)]">
        <span className="inline-flex h-7 items-center rounded-full bg-[var(--surface-muted)] px-2.5">{total} no mês</span>
        <span className="hidden h-7 items-center gap-1 rounded-full bg-emerald-50 px-2 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            {completed}
        </span>
        <span className="hidden h-7 items-center gap-1 rounded-full bg-blue-50 px-2 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
            {scheduled}
        </span>
        <span className="hidden h-7 items-center gap-1 rounded-full bg-rose-50 px-2 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
            {missed}
        </span>
    </div>
);

const CalendarStatusLegend: React.FC = () => (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-bold text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
            Agendado
        </span>
        <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            Concluído
        </span>
        <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400"></span>
            Faltou
        </span>
        <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500"></span>
            Cancelado
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[var(--text-soft)]">
            <i className="fas fa-hand-pointer text-[10px]" aria-hidden="true"></i>
            Segure um dia para agendar
        </span>
    </div>
);

const AgendaViewToggle: React.FC<{
    viewMode: 'grid' | 'list';
    onChange: (mode: 'grid' | 'list') => void;
}> = ({ viewMode, onChange }) => (
    <div className="inline-flex shrink-0 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-0.5">
        {(['grid', 'list'] as const).map((mode) => {
            const isActive = viewMode === mode;
            return (
                <button
                    key={mode}
                    type="button"
                    onClick={() => onChange(mode)}
                    aria-pressed={isActive}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-3 text-xs font-black transition-colors ${isActive ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-[var(--shadow-hairline)]' : 'text-[var(--text-muted)]'}`}
                >
                    <i className={`fas ${mode === 'grid' ? 'fa-calendar-days' : 'fa-list-ul'} text-[11px]`} aria-hidden="true"></i>
                    {mode === 'grid' ? 'Mês' : 'Lista'}
                </button>
            );
        })}
    </div>
);

const AgendaQuickButton: React.FC<{
    onClick: () => void;
    iconClassName: string;
    label: string;
}> = ({ onClick, iconClassName, label }) => (
    <button
        type="button"
        onClick={onClick}
        className="inline-flex h-8 shrink-0 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-xs font-black text-[var(--text-strong)] shadow-[var(--shadow-hairline)] transition-colors hover:bg-[var(--surface-muted)]"
    >
        <i className={`${iconClassName} text-[11px] text-[var(--text-muted)]`} aria-hidden="true"></i>
        {label}
    </button>
);

const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const AgendaView: React.FC<AgendaViewProps> = ({ agendamentos, pdfs, clients, onEditAgendamento, onUpdateServiceStatus, onCompleteAgendamentoWithValue, onContinueAgendamento, onRescheduleAgendamento, onCreateNewAgendamento, googleReviewsLink }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [reviewRatings, setReviewRatings] = useState<Record<number, number>>(() => readAllReviewRatings());

    const handleUpdateReviewRating = useCallback((agendamentoId: number, stars: number) => {
        setReviewRatings((prev) => {
            const next = { ...prev };
            if (stars > 0) next[agendamentoId] = stars; else delete next[agendamentoId];
            saveAllReviewRatings(next);
            return next;
        });
    }, []);

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDayOfWeek = startOfMonth.getDay();

    const daysInMonth = useMemo(() => {
        const days: (Date | null)[] = [];
        for (let i = 0; i < startDayOfWeek; i += 1) {
            days.push(null);
        }
        for (let day = 1; day <= endOfMonth.getDate(); day += 1) {
            days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
        }
        return days;
    }, [currentDate, startDayOfWeek, endOfMonth]);

    const pdfStatusMap = useMemo(() => {
        const map = new Map<number, SavedPDF['status']>();
        pdfs.forEach((pdf) => {
            if (pdf.id && pdf.status) {
                map.set(pdf.id, pdf.status);
            }
        });
        return map;
    }, [pdfs]);

    const pdfById = useMemo(() => {
        const map = new Map<number, SavedPDF>();
        pdfs.forEach((pdf) => {
            if (pdf.id) {
                map.set(pdf.id, pdf);
            }
        });
        return map;
    }, [pdfs]);

    const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);

    const agendamentosWithStatus = useMemo<AgendamentoWithStatus[]>(() => (
        agendamentos
            .map((agendamento) => ({
                ...agendamento,
                status: agendamento.pdfId ? (pdfStatusMap.get(agendamento.pdfId) || 'pending') : 'pending',
            }))
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    ), [agendamentos, pdfStatusMap]);

    const agendamentosByDate = useMemo(() => {
        const map = new Map<string, AgendamentoWithStatus[]>();
        agendamentosWithStatus.forEach((agendamento) => {
            const dateKey = new Date(agendamento.start).toDateString();
            if (!map.has(dateKey)) {
                map.set(dateKey, []);
            }
            map.get(dateKey)!.push(agendamento);
        });

        return map;
    }, [agendamentosWithStatus]);

    const monthAgendamentos = useMemo(() => (
        agendamentosWithStatus.filter((agendamento) => sameMonth(new Date(agendamento.start), currentDate))
    ), [agendamentosWithStatus, currentDate]);

    const monthStats = useMemo(() => ({
        total: monthAgendamentos.length,
        completed: monthAgendamentos.filter((item) => item.serviceStatus === 'completed').length,
        scheduled: monthAgendamentos.filter((item) => (item.serviceStatus || 'scheduled') === 'scheduled').length,
        missed: monthAgendamentos.filter((item) => item.serviceStatus === 'cancelled' || item.serviceStatus === 'no_show').length,
    }), [monthAgendamentos]);

    const nextAppointment = useMemo(() => {
        const now = new Date().getTime();
        return agendamentosWithStatus.find((agendamento) => new Date(agendamento.end).getTime() >= now) || null;
    }, [agendamentosWithStatus]);

    const selectedDayAgendamentos = useMemo(() => {
        return agendamentosByDate.get(selectedDate.toDateString()) || [];
    }, [agendamentosByDate, selectedDate]);

    const changeMonth = (amount: number) => {
        setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
    };

    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const justSwipedRef = useRef(false);

    const handleGridTouchStart = (event: React.TouchEvent) => {
        justSwipedRef.current = false;
        const touch = event.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleGridTouchEnd = (event: React.TouchEvent) => {
        const start = touchStartRef.current;
        touchStartRef.current = null;
        if (!start) return;

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - start.x;
        const deltaY = touch.clientY - start.y;

        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            justSwipedRef.current = true;
            changeMonth(deltaX < 0 ? 1 : -1);
        }
    };

    const selectDate = (date: Date) => {
        setSelectedDate(date);
        setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
    };

    const handleDayClick = (day: Date | null) => {
        if (!day) return;
        if (justSwipedRef.current) {
            justSwipedRef.current = false;
            return;
        }
        selectDate(day);
    };

    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearLongPress = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleCellTouchStart = (day: Date | null) => {
        clearLongPress();
        if (!day) return;
        longPressTimerRef.current = setTimeout(() => {
            justSwipedRef.current = true;
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                navigator.vibrate(15);
            }
            setSelectedDate(day);
            onCreateNewAgendamento(day);
        }, 500);
    };

    const handleGoToday = () => {
        selectDate(new Date());
    };

    const handleGoNextAppointment = () => {
        if (!nextAppointment) return;
        selectDate(new Date(nextAppointment.start));
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const isSelected = (date: Date) => {
        return date.toDateString() === selectedDate.toDateString();
    };

    const getDayNumberClasses = (day: Date) => {
        const classes = ['flex', 'items-center', 'justify-center', 'h-6', 'w-6', 'text-sm', 'font-semibold', 'rounded-full', 'transition-colors'];
        if (isSelected(day)) {
            classes.push('bg-slate-800', 'dark:bg-slate-700', 'text-white');
        } else if (isToday(day)) {
            classes.push('bg-slate-200', 'dark:bg-slate-700', 'text-slate-800', 'dark:text-slate-200');
        } else {
            classes.push('text-slate-700', 'dark:text-slate-300');
        }
        return classes.join(' ');
    };

    const getDayCellClasses = (day: Date) => {
        const classes = [
            'relative',
            'pt-[100%]',
            'rounded-[var(--radius-card)]',
            'border',
            'bg-[var(--surface)]',
            'shadow-[var(--shadow-hairline)]',
            'cursor-pointer',
            'transition-all',
            'duration-200',
            'hover:bg-[var(--surface-muted)]',
        ];

        if (isSelected(day)) {
            classes.push('border-blue-500', 'ring-2', 'ring-blue-500/20');
        } else if (isToday(day)) {
            classes.push('border-slate-300', 'dark:border-slate-600');
        } else {
            classes.push('border-[var(--border-subtle)]');
        }

        return classes.join(' ');
    };

    const selectedDateString = useMemo(() => {
        const dateString = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
        const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
        const parts = dateString.split(', ');
        const weekday = parts[0].split('-').map(capitalize).join('-');
        const dayAndMonthParts = parts[1].split(' de ');
        const day = dayAndMonthParts[0];
        const month = capitalize(dayAndMonthParts[1]);
        return `${weekday}, ${day} De ${month}`;
    }, [selectedDate]);

    const currentMonthLabel = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showAlertsPanel, setShowAlertsPanel] = useState(false);

    const upcomingGroups = useMemo<[string, AgendamentoWithStatus[]][]>(() => {
        const now = Date.now();
        const groups = new Map<string, AgendamentoWithStatus[]>();
        agendamentosWithStatus
            .filter((agendamento) => new Date(agendamento.end).getTime() >= now)
            .forEach((agendamento) => {
                const key = new Date(agendamento.start).toDateString();
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(agendamento);
            });
        return Array.from(groups.entries());
    }, [agendamentosWithStatus]);

    const upcomingCount = useMemo(() => (
        upcomingGroups.reduce((total, [, items]) => total + items.length, 0)
    ), [upcomingGroups]);

    return (
        <div className="space-y-5">
            <div className="space-y-5 lg:hidden">
                {nextAppointment ? (
                    <NextAppointmentCard
                        agendamento={nextAppointment}
                        client={clientsById.get(nextAppointment.clienteId)}
                        onOpen={onEditAgendamento}
                    />
                ) : null}

                <section>
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <AgendaQuickButton onClick={handleGoToday} iconClassName="far fa-calendar-check" label="Hoje" />
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowAlertsPanel((prev) => !prev)}
                                aria-label="Configurar alertas"
                                aria-expanded={showAlertsPanel}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] border transition-colors ${showAlertsPanel ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-strong)]'}`}
                            >
                                <i className="far fa-bell text-sm" aria-hidden="true"></i>
                            </button>
                            <AgendaViewToggle viewMode={viewMode} onChange={setViewMode} />
                        </div>
                    </div>

                    {showAlertsPanel ? <AgendaPushReminderControl /> : null}

                    {viewMode === 'grid' ? (
                      <>
                        <header className="mb-3 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1">
                                <button onClick={() => changeMonth(-1)} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
                                    <i className="fas fa-chevron-left"></i>
                                </button>
                                <h2 className="truncate text-lg font-bold text-slate-800 dark:text-slate-200 capitalize">
                                    {currentMonthLabel}
                                </h2>
                                <button onClick={() => changeMonth(1)} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
                                    <i className="fas fa-chevron-right"></i>
                                </button>
                            </div>
                            <CalendarMonthStats {...monthStats} />
                        </header>

                        <div className="grid grid-cols-7 gap-1 mb-2 text-center text-sm font-semibold text-slate-500">
                            {weekDays.map((day) => <div key={day}>{day}</div>)}
                        </div>

                        <div
                            className="grid grid-cols-7 gap-1 touch-pan-y"
                            onTouchStart={handleGridTouchStart}
                            onTouchEnd={handleGridTouchEnd}
                        >
                        {daysInMonth.map((day, index) => {
                            const dayAgendamentos = day ? agendamentosByDate.get(day.toDateString()) || [] : [];
                            return (
                                <div
                                    key={day ? day.toISOString() : `mobile-empty-${index}`}
                                    onClick={() => handleDayClick(day)}
                                    onTouchStart={() => handleCellTouchStart(day)}
                                    onTouchMove={clearLongPress}
                                    onTouchEnd={clearLongPress}
                                    className={day ? getDayCellClasses(day) : 'relative pt-[100%] bg-transparent'}
                                >
                                    {day && (
                                        <div className="absolute inset-0 p-1.5 flex flex-col items-center overflow-hidden">
                                            {dayAgendamentos.length > 0 ? (
                                                <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-[9px] font-black text-white">
                                                    {dayAgendamentos.length}
                                                </span>
                                            ) : null}
                                            <span className={getDayNumberClasses(day)}>
                                                {day.getDate()}
                                            </span>
                                            {dayAgendamentos.length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap justify-center items-center gap-1">
                                                    {dayAgendamentos.slice(0, 3).map((agendamento) => (
                                                        <div key={agendamento.id} className={`w-2 h-2 rounded-full ${getServiceStatusColor(agendamento.serviceStatus)}`} title={agendamento.clienteNome}></div>
                                                    ))}
                                                    {dayAgendamentos.length > 3 && (
                                                        <div className="w-2 h-2 rounded-full bg-slate-300" title={`${dayAgendamentos.length - 3} mais`}></div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                        <CalendarStatusLegend />
                      </>
                    ) : null}
                </section>

                {viewMode === 'grid' ? (
                <section>
                    <div className="mb-4 flex items-end justify-between gap-4 border-b border-slate-200 pb-3 dark:border-slate-700">
                        <div>
                            <span className="text-sm font-semibold text-slate-500">Agenda:</span>
                            <h3 className="text-lg font-bold leading-tight text-slate-800 dark:text-slate-200">
                                {selectedDateString}
                            </h3>
                        </div>
                        <ActionButton
                            onClick={() => onCreateNewAgendamento(selectedDate)}
                            variant="primary"
                            size="md"
                            iconOnly
                            iconClassName="fas fa-plus"
                            aria-label="Criar novo agendamento para o dia selecionado"
                            className="shadow-lg shadow-blue-900/20"
                        />
                    </div>

                    <DayAgendaSummary agendamentos={selectedDayAgendamentos} />

                    {selectedDayAgendamentos.length > 0 ? (
                        <div className="space-y-3">
                            {selectedDayAgendamentos.map((agendamento) => {
                                const client = clientsById.get(agendamento.clienteId);
                                return <AppointmentCard key={agendamento.id} agendamento={agendamento} client={client} linkedPdf={agendamento.pdfId ? pdfById.get(agendamento.pdfId) : undefined} onEdit={onEditAgendamento} onUpdateServiceStatus={onUpdateServiceStatus} onCompleteWithValue={onCompleteAgendamentoWithValue} onContinueAgendamento={onContinueAgendamento} onReschedule={onRescheduleAgendamento} googleReviewsLink={googleReviewsLink} reviewStars={agendamento.id != null ? (reviewRatings[agendamento.id] || 0) : 0} onUpdateReviewRating={handleUpdateReviewRating} />;
                            })}
                        </div>
                    ) : (
                        <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)]">
                            <ContentState
                                compact
                                iconClassName="fas fa-calendar-check"
                                title="Nada agendado neste dia"
                                description="Crie um agendamento para organizar seu atendimento."
                                actionLabel="Novo agendamento"
                                actionIconClassName="fas fa-plus"
                                onAction={() => onCreateNewAgendamento(selectedDate)}
                            />
                        </div>
                    )}
                </section>
                ) : (
                <section>
                    <div className="mb-4 flex items-end justify-between gap-4 border-b border-slate-200 pb-3 dark:border-slate-700">
                        <div>
                            <span className="text-sm font-semibold text-slate-500">Próximos atendimentos</span>
                            <h3 className="text-lg font-bold leading-tight text-slate-800 dark:text-slate-200">
                                {upcomingCount > 0 ? `${upcomingCount} agendamento${upcomingCount > 1 ? 's' : ''}` : 'Nada à vista'}
                            </h3>
                        </div>
                        <ActionButton
                            onClick={() => onCreateNewAgendamento(new Date())}
                            variant="primary"
                            size="md"
                            iconOnly
                            iconClassName="fas fa-plus"
                            aria-label="Criar novo agendamento"
                            className="shadow-lg shadow-blue-900/20"
                        />
                    </div>

                    {upcomingGroups.length > 0 ? (
                        <div className="space-y-5">
                            {upcomingGroups.map(([dateKey, items]) => (
                                <div key={dateKey} className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">
                                            {getRelativeDayLabel(items[0].start)}
                                        </span>
                                        <span className="h-px flex-1 bg-[var(--border-subtle)]"></span>
                                        <span className="text-xs font-bold text-[var(--text-soft)]">{items.length}</span>
                                    </div>
                                    {items.map((agendamento) => {
                                        const client = clientsById.get(agendamento.clienteId);
                                        return <AppointmentCard key={agendamento.id} agendamento={agendamento} client={client} linkedPdf={agendamento.pdfId ? pdfById.get(agendamento.pdfId) : undefined} onEdit={onEditAgendamento} onUpdateServiceStatus={onUpdateServiceStatus} onCompleteWithValue={onCompleteAgendamentoWithValue} onContinueAgendamento={onContinueAgendamento} onReschedule={onRescheduleAgendamento} googleReviewsLink={googleReviewsLink} reviewStars={agendamento.id != null ? (reviewRatings[agendamento.id] || 0) : 0} onUpdateReviewRating={handleUpdateReviewRating} />;
                                    })}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)]">
                            <ContentState
                                compact
                                iconClassName="fas fa-calendar-check"
                                title="Nenhum atendimento futuro"
                                description="Crie um agendamento para organizar sua agenda."
                                actionLabel="Novo agendamento"
                                actionIconClassName="fas fa-plus"
                                onAction={() => onCreateNewAgendamento(new Date())}
                            />
                        </div>
                    )}
                </section>
                )}
            </div>

            <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-5 lg:items-start">
                <section className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-soft)]">
                    <header className="flex items-center justify-between mb-4">
                        <button onClick={() => changeMonth(-1)} className="h-10 w-10 flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-strong)]">
                            <i className="fas fa-chevron-left"></i>
                        </button>
                        <h2 className="text-xl font-bold text-[var(--text-strong)] capitalize">
                            {currentMonthLabel}
                        </h2>
                        <button onClick={() => changeMonth(1)} className="h-10 w-10 flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-strong)]">
                            <i className="fas fa-chevron-right"></i>
                        </button>
                    </header>

                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <AgendaQuickButton onClick={handleGoToday} iconClassName="far fa-calendar-check" label="Hoje" />
                            {nextAppointment ? (
                                <AgendaQuickButton onClick={handleGoNextAppointment} iconClassName="fas fa-map-pin" label="Próximo" />
                            ) : null}
                        </div>
                        <CalendarMonthStats {...monthStats} />
                    </div>

                    <AgendaPushReminderControl />

                    <div className="grid grid-cols-7 gap-1 text-center text-sm font-semibold text-[var(--text-muted)] mb-2">
                        {weekDays.map((day) => <div key={day}>{day}</div>)}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {daysInMonth.map((day, index) => {
                            const dayAgendamentos = day ? agendamentosByDate.get(day.toDateString()) || [] : [];
                            return (
                                <div
                                    key={day ? day.toISOString() : `desktop-empty-${index}`}
                                    onClick={() => day && selectDate(day)}
                                    className={day ? getDayCellClasses(day) : 'relative pt-[100%] bg-transparent'}
                                >
                                    {day && (
                                        <div className="absolute inset-0 p-1.5 flex flex-col items-center overflow-hidden">
                                            {dayAgendamentos.length > 0 ? (
                                                <span className="absolute right-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-[10px] font-black text-white">
                                                    {dayAgendamentos.length}
                                                </span>
                                            ) : null}
                                            <span className={getDayNumberClasses(day)}>
                                                {day.getDate()}
                                            </span>
                                            {dayAgendamentos.length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap justify-center items-center gap-1">
                                                    {dayAgendamentos.slice(0, 3).map((agendamento) => (
                                                        <div key={agendamento.id} className={`w-2 h-2 rounded-full ${getServiceStatusColor(agendamento.serviceStatus)}`} title={agendamento.clienteNome}></div>
                                                    ))}
                                                    {dayAgendamentos.length > 3 && (
                                                        <div className="w-2 h-2 rounded-full bg-slate-300" title={`${dayAgendamentos.length - 3} mais`}></div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                <aside className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)] lg:sticky lg:top-4">
                    <div className="flex justify-between items-center pb-3 mb-4 border-b border-[var(--border-subtle)]">
                        <div>
                            <span className="text-sm font-semibold text-[var(--text-muted)]">Agenda:</span>
                            <h3 className="text-lg font-bold text-[var(--text-strong)] leading-tight">
                                {selectedDateString}
                            </h3>
                        </div>
                        <ActionButton
                            onClick={() => onCreateNewAgendamento(selectedDate)}
                            variant="primary"
                            size="md"
                            iconOnly
                            iconClassName="fas fa-plus"
                            aria-label="Criar novo agendamento para o dia selecionado"
                        />
                    </div>

                    <DayAgendaSummary agendamentos={selectedDayAgendamentos} />

                    {selectedDayAgendamentos.length > 0 ? (
                        <div className="space-y-3">
                            {selectedDayAgendamentos.map((agendamento) => {
                                const client = clientsById.get(agendamento.clienteId);
                                return <AppointmentCard key={agendamento.id} agendamento={agendamento} client={client} linkedPdf={agendamento.pdfId ? pdfById.get(agendamento.pdfId) : undefined} onEdit={onEditAgendamento} onUpdateServiceStatus={onUpdateServiceStatus} onCompleteWithValue={onCompleteAgendamentoWithValue} onContinueAgendamento={onContinueAgendamento} onReschedule={onRescheduleAgendamento} googleReviewsLink={googleReviewsLink} reviewStars={agendamento.id != null ? (reviewRatings[agendamento.id] || 0) : 0} onUpdateReviewRating={handleUpdateReviewRating} />;
                            })}
                        </div>
                    ) : (
                        <div className="mt-4 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)]">
                            <ContentState
                                compact
                                iconClassName="fas fa-calendar-check"
                                title="Nada agendado neste dia"
                                description="Crie um agendamento para organizar seu atendimento."
                                actionLabel="Novo agendamento"
                                actionIconClassName="fas fa-plus"
                                onAction={() => onCreateNewAgendamento(selectedDate)}
                            />
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
};

export default AgendaView;
