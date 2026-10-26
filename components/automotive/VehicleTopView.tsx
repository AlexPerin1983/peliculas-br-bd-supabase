import React from 'react';
import type { VehicleGlassGroup, VehicleGlassShade } from '../../types';

interface VehicleTopViewProps {
    groups: VehicleGlassGroup[];
    vidros?: Partial<Record<VehicleGlassGroup, VehicleGlassShade>>;
    selectedGroup?: VehicleGlassGroup | null;
    className?: string;
}

// Quanto menor o percentual, mais escuro o vidro no desenho.
const SHADE_FILL: Record<VehicleGlassShade, string> = {
    sem: '#e0f2fe',
    faixa: '#93c5fd',
    '5': '#1e293b',
    '20': '#334155',
    '35': '#475569',
    '50': '#64748b',
    '70': '#94a3b8',
    '75': '#a5b4c8',
    '80': '#b8c4d6',
};
const UNSET_FILL = '#cbd5e1';

// Vidros desenhados como peças separadas (cada lado tem o seu).
const GLASS_SHAPES: { group: VehicleGlassGroup; shapes: React.ReactElement[] }[] = [
    { group: 'parabrisa', shapes: [<path key="ws" d="M52 108 Q100 92 148 108 L138 152 Q100 144 62 152 Z" />] },
    { group: 'dianteiras', shapes: [<rect key="fl" x="39" y="160" width="15" height="64" rx="5" />, <rect key="fr" x="146" y="160" width="15" height="64" rx="5" />] },
    { group: 'traseiras', shapes: [<rect key="rl" x="39" y="230" width="15" height="54" rx="5" />, <rect key="rr" x="146" y="230" width="15" height="54" rx="5" />] },
    { group: 'vigias', shapes: [<rect key="ql" x="41" y="290" width="13" height="24" rx="5" />, <rect key="qr" x="146" y="290" width="13" height="24" rx="5" />] },
    { group: 'traseiro', shapes: [<path key="bk" d="M60 318 Q100 326 140 318 L148 350 Q100 362 52 350 Z" />] },
];

// Carro visto de cima, com cada vidro pintado pelo percentual escolhido.
const VehicleTopView: React.FC<VehicleTopViewProps> = ({ groups, vidros, selectedGroup, className = 'h-64 w-32' }) => (
    <svg viewBox="0 0 200 400" className={className} aria-hidden="true">
        <ellipse cx="24" cy="150" rx="10" ry="6" className="fill-white stroke-slate-700 dark:fill-slate-900 dark:stroke-slate-300" strokeWidth={3} />
        <ellipse cx="176" cy="150" rx="10" ry="6" className="fill-white stroke-slate-700 dark:fill-slate-900 dark:stroke-slate-300" strokeWidth={3} />
        <rect x="30" y="10" width="140" height="380" rx="58" className="fill-white stroke-slate-700 dark:fill-slate-900 dark:stroke-slate-300" strokeWidth={3} />
        <rect x="64" y="158" width="72" height="146" rx="10" className="fill-slate-100 stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600" strokeWidth={2} />
        {GLASS_SHAPES.filter(item => groups.includes(item.group)).map(item => {
            const shade = vidros?.[item.group];
            const isSelected = selectedGroup === item.group;
            return (
                <g
                    key={item.group}
                    fill={shade ? SHADE_FILL[shade] : UNSET_FILL}
                    stroke={isSelected ? '#2563eb' : '#334155'}
                    strokeWidth={isSelected ? 6 : 2}
                >
                    {item.shapes}
                </g>
            );
        })}
    </svg>
);

export default VehicleTopView;
