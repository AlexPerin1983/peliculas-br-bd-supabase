import React from 'react';
import type { VehicleCategory } from '../../types';

interface VehicleCategoryIconProps {
    category: VehicleCategory;
    className?: string;
}

// Carro de lado em traço único (viewBox 64×30); a cor vem do texto (currentColor).
const ICONS: Record<VehicleCategory, { body: string; detail: string; rearWheel: number }> = {
    hatch: {
        body: 'M10 24 H7 Q5 24 5 22 V19 Q5 16.5 8 16 L16 14.6 Q22 10 25 9.2 Q26 9 28 9 H43 L44.5 10 L43.5 11 L50 16.5 Q51.5 18 51.5 22 Q51.5 24 50 24 M21 24 H43',
        detail: 'M18.5 15.2 H41 L42.5 13.6 L39.5 10.2 M31 10.2 V15.2',
        rearWheel: 46.5,
    },
    sedan: {
        body: 'M10 24 H7 Q5 24 5 22 V19 Q5 16.5 8 16 L16 14.6 Q22 10 25 9.2 Q26 9 28 9 H41 Q43 9 44 10 L48 13 Q50 14.6 53 15 H57 L57.5 21 Q57.5 24 54 24 M21 24 H45',
        detail: 'M18.5 15.2 H44.5 L45 14.2 L41.5 10.3 M31 10.3 V15.2 M55 18 H57.3',
        rearWheel: 49,
    },
    suv: {
        body: 'M10 24 H7 Q5 24 5 22 V18 Q5 15.5 8 15 L16 13.8 Q21 9.5 25 7.8 Q27 7 30 7 H52 L53 8.2 L52 9 L56.5 13.5 Q58 15 58 21 Q58 24 55.5 24 M21 24 H46',
        detail: 'M18.5 14.6 H48.5 L49.5 13.4 L47.5 8.8 M33 9.2 V14.6',
        rearWheel: 50,
    },
    picape_simples: {
        body: 'M10 24 H7 Q5 24 5 22 V19 Q5 16.5 8 16 L16 14.6 Q20 11 23 9.5 Q24.5 9 26.5 9 H33.5 Q34.5 9 34.5 10 V16 H58.5 V22 Q58.5 24 56 24 M21 24 H46',
        detail: 'M19 15.4 H32 V10.5 M34.5 16 V24',
        rearWheel: 50,
    },
    picape_dupla: {
        body: 'M10 24 H7 Q5 24 5 22 V19 Q5 16.5 8 16 L16 14.6 Q20 11 24 9.5 Q25.5 9 28 9 H40 Q41 9 41 10 V16 H58.5 V22 Q58.5 24 56 24 M21 24 H46',
        detail: 'M19 15.4 H38.5 V10.5 M30 10.4 V15.4 M41 16 V24',
        rearWheel: 50,
    },
    van: {
        body: 'M10 24 H7 Q5 24 5 22 V17 Q5 15 7 14.6 L16 6.8 Q17 6 19 6 H57 Q58 6 58 7.5 L59 15 V22 Q59 24 56.5 24 M21 24 H46',
        detail: 'M10.5 14 H23 V8.2',
        rearWheel: 50,
    },
    onibus: {
        body: 'M10 24 H6 Q4 24 4 21 V8 Q4 5 7 5 H56 Q59 5 59 8 V22 Q59 24 56 24 M21 24 H46',
        detail: 'M8 10 H54 V16 H8 Z M18 10 V16 M29 10 V16 M40 10 V16 M51 10 V16',
        rearWheel: 50,
    },
    caminhao: {
        body: 'M10 24 H5 V15 L12 7 H25 V23 M21 24 H46 M27 8 H59 V23 H56 M27 24 H45',
        detail: 'M9 15 H21 V10 H14 Z M29 12 H55 M29 16 H55',
        rearWheel: 50,
    },
    maquina: {
        body: 'M10 24 H5 V16 H16 V7 H32 V19 H47 L52 9 H57 L54 24 H47 M21 24 H30',
        detail: 'M20 10 H28 V17 H20 Z M7 19 H13 M36 19 H45',
        rearWheel: 36,
    },
};

const VehicleCategoryIcon: React.FC<VehicleCategoryIconProps> = ({ category, className = 'h-8 w-[70px]' }) => {
    const icon = ICONS[category] || ICONS.hatch;
    return (
        <svg viewBox="0 0 64 30" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={icon.body} />
            <path d={icon.detail} />
            <circle cx={17} cy={23.5} r={3.4} />
            <circle cx={icon.rearWheel} cy={23.5} r={3.4} />
        </svg>
    );
};

export default VehicleCategoryIcon;
