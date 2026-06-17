import React from 'react';

export interface DonutSegment {
    label: string;
    value: number;
    /** Cor sólida (hex ou css var) usada no arco e na legenda. */
    color: string;
}

interface DonutProps {
    segments: DonutSegment[];
    size?: number;
    thickness?: number;
    /** Texto central grande (ex.: total). */
    centerValue?: string | number;
    centerLabel?: string;
}

/**
 * Rosca (donut) em SVG puro, sem dependência. Mostra a distribuição de uma base
 * (ex.: empresas ativas vs inativas vs trial) com legenda ao lado.
 */
export const Donut: React.FC<DonutProps> = ({ segments, size = 132, thickness = 16, centerValue, centerLabel }) => {
    const total = segments.reduce((acc, s) => acc + s.value, 0);
    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;

    let offset = 0;
    const arcs = segments.map((seg) => {
        const fraction = total > 0 ? seg.value / total : 0;
        const dash = fraction * circumference;
        const arc = (
            <circle
                key={seg.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
        );
        offset += dash;
        return arc;
    });

    return (
        <div className="flex items-center gap-4">
            <div className="relative shrink-0" style={{ width: size, height: size }}>
                <svg width={size} height={size}>
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        className="stroke-slate-100 dark:stroke-slate-700"
                        strokeWidth={thickness}
                    />
                    {total > 0 && arcs}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-slate-900 dark:text-white">{centerValue ?? total}</span>
                    {centerLabel && <span className="text-[10px] text-slate-400">{centerLabel}</span>}
                </div>
            </div>
            <div className="space-y-1.5">
                {segments.map((seg) => {
                    const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
                    return (
                        <div key={seg.label} className="flex items-center gap-2 text-sm">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                            <span className="text-slate-600 dark:text-slate-300">{seg.label}</span>
                            <span className="font-semibold text-slate-900 dark:text-white">{seg.value}</span>
                            <span className="text-xs text-slate-400">({pct}%)</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Donut;
