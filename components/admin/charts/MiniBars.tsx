import React from 'react';

export interface MiniBar {
    label: string;
    value: number;
    /** Texto opcional mostrado no tooltip (title) da barra. */
    hint?: string;
}

interface MiniBarsProps {
    data: MiniBar[];
    /** Classe tailwind da cor da barra (ex.: "bg-blue-500"). */
    colorClass?: string;
    height?: number; // altura da área das barras em px
    className?: string;
}

/**
 * Barras verticais simples (sem dependência de lib). Cada barra é normalizada
 * pelo maior valor da série. Usado para "cadastros por mês" e "tendência por empresa".
 */
export const MiniBars: React.FC<MiniBarsProps> = ({ data, colorClass = 'bg-blue-500', height = 96, className = '' }) => {
    const max = data.reduce((acc, d) => Math.max(acc, d.value), 0);

    return (
        <div className={`flex items-end gap-1.5 ${className}`} style={{ height }}>
            {data.map((d, i) => {
                const pct = max > 0 ? (d.value / max) * 100 : 0;
                return (
                    <div key={`${d.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                        <div
                            className="flex w-full items-end justify-center"
                            style={{ height: height - 18 }}
                            title={d.hint || `${d.label}: ${d.value}`}
                        >
                            <div
                                className={`w-full max-w-[28px] rounded-t ${d.value > 0 ? colorClass : 'bg-slate-200 dark:bg-slate-700'} transition-all`}
                                style={{ height: `${Math.max(d.value > 0 ? 6 : 2, pct)}%` }}
                            />
                        </div>
                        <span className="truncate text-[10px] leading-none text-slate-400">{d.label}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default MiniBars;
