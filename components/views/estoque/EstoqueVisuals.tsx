import React from 'react';

// Visuais compactos do estoque no celular: quanto sobra da bobina (anel) e o formato do retalho.

const RING_RADIUS = 18;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export const stockLevelTone = (ratio: number, active = true) =>
    !active ? 'text-slate-400 dark:text-slate-500'
        : ratio > 0.5 ? 'text-emerald-500'
            : ratio > 0.2 ? 'text-amber-500'
                : 'text-rose-500';

/** Anel com o percentual que ainda resta na bobina. */
export const StockRing: React.FC<{ ratio: number; active?: boolean; size?: number }> = ({ ratio, active = true, size = 44 }) => {
    const safe = Math.max(0, Math.min(1, ratio));
    return (
        <span className={`relative flex shrink-0 items-center justify-center ${stockLevelTone(safe, active)}`} style={{ width: size, height: size }}>
            <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="22" cy="22" r={RING_RADIUS} fill="none" stroke="currentColor" strokeOpacity={0.16} strokeWidth={4} />
                <circle cx="22" cy="22" r={RING_RADIUS} fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round"
                    strokeDasharray={RING_LENGTH} strokeDashoffset={RING_LENGTH * (1 - safe)} />
            </svg>
            <span className="relative text-[10px] font-bold tabular-nums text-[var(--text-strong)]">{Math.round(safe * 100)}%</span>
        </span>
    );
};

/**
 * A bobina vista pela ponta: o tubo de papelão no meio e a película enrolada em
 * volta. A espessura da película acompanha o que resta (pela área, como na
 * bobina de verdade), então dá para ler o estoque de longe, como na prateleira.
 */
export const RollEnd: React.FC<{ ratio: number; active?: boolean; size?: number }> = ({ ratio, active = true, size = 72 }) => {
    const safe = Math.max(0, Math.min(1, ratio));
    const core = 9;
    const full = 30;
    const outer = Math.sqrt(core * core + safe * (full * full - core * core));
    const wraps = Math.max(0, Math.floor((outer - core) / 2.4));
    const uid = React.useId().replace(/:/g, '');
    return (
        <span className="relative shrink-0" style={{ width: size, height: size }} aria-hidden="true">
            <svg viewBox="0 0 64 64" className="h-full w-full">
                <defs>
                    {/* Película fumê: leve variação de tom, como o rolo refletindo a luz. */}
                    <radialGradient id={`film-${uid}`} cx="40%" cy="35%" r="70%">
                        <stop offset="0%" stopColor={active ? '#5b6b80' : '#7c8594'} />
                        <stop offset="100%" stopColor={active ? '#26303d' : '#4a515c'} />
                    </radialGradient>
                    <radialGradient id={`core-${uid}`} cx="45%" cy="40%" r="60%">
                        <stop offset="0%" stopColor="#d9c3a0" />
                        <stop offset="100%" stopColor="#a8875c" />
                    </radialGradient>
                </defs>
                {/* Onde a bobina cheia chegaria: contorno bem discreto. */}
                <circle cx="32" cy="32" r={full} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeDasharray="2 3" className="text-[var(--text-muted)]" />
                <circle cx="32" cy="32" r={outer} fill={`url(#film-${uid})`} />
                {Array.from({ length: wraps }, (_, index) => (
                    <circle key={index} cx="32" cy="32" r={core + 1.2 + index * 2.4} fill="none" stroke="#ffffff" strokeOpacity={0.07} strokeWidth={0.6} />
                ))}
                <circle cx="32" cy="32" r={core} fill={`url(#core-${uid})`} />
                <circle cx="32" cy="32" r={core - 3.2} fill="var(--surface, #0f172a)" />
            </svg>
        </span>
    );
};

const PIECE_TONES: Record<string, string> = {
    disponivel: 'border-blue-500 bg-blue-500/15 dark:border-blue-400 dark:bg-blue-400/20',
    reservado: 'border-amber-500 bg-amber-500/15',
    usado: 'border-slate-400 bg-slate-400/15',
    descartado: 'border-rose-400 bg-rose-400/15',
};

/** Retalho desenhado na proporção (largura na horizontal, comprimento na vertical). */
export const PieceShape: React.FC<{ larguraCm: number; comprimentoCm: number; status: string; size?: number }> = ({ larguraCm, comprimentoCm, status, size = 44 }) => {
    const box = size - 14;
    const largura = Math.max(larguraCm, 1);
    const comprimento = Math.max(comprimentoCm, 1);
    const width = largura >= comprimento ? box : Math.max(6, (box * largura) / comprimento);
    const height = comprimento >= largura ? box : Math.max(6, (box * comprimento) / largura);
    return (
        <span className="flex shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)]" style={{ width: size, height: size }} aria-hidden="true">
            <span className={`rounded-[3px] border-2 ${PIECE_TONES[status] || PIECE_TONES.usado}`} style={{ width, height }} />
        </span>
    );
};

/** Selo discreto para o que foge do normal (acabando, finalizada, reservado...). */
export const StockBadge: React.FC<{ tone: 'warn' | 'muted' | 'danger' | 'good'; children: React.ReactNode }> = ({ tone, children }) => {
    const tones = {
        warn: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
        muted: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        danger: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200',
        good: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200',
    };
    return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
};
