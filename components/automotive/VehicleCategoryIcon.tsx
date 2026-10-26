import React from 'react';
import type { VehicleCategory } from '../../types';
import { getVehicleCategoryInfo } from '../../src/lib/automotive';

interface VehicleCategoryIconProps {
    category: VehicleCategory;
    selected?: boolean;
    className?: string;
}

// Silhueta lateral simples de cada categoria (no lugar de fotos de modelos).
const VehicleCategoryIcon: React.FC<VehicleCategoryIconProps> = ({ category, selected = false, className = 'h-7 w-14' }) => (
    <svg viewBox="0 0 48 24" className={className} aria-hidden="true">
        <path
            d={getVehicleCategoryInfo(category).silhouette}
            className={selected ? 'fill-blue-200 stroke-blue-700 dark:fill-blue-900/60 dark:stroke-blue-300' : 'fill-slate-100 stroke-slate-500 dark:fill-slate-800 dark:stroke-slate-400'}
            strokeWidth={1.4}
            strokeLinejoin="round"
        />
        {[12, 36].map(cx => (
            <circle
                key={cx}
                cx={cx}
                cy={18}
                r={3.2}
                className={selected ? 'fill-white stroke-blue-700 dark:fill-slate-900 dark:stroke-blue-300' : 'fill-white stroke-slate-500 dark:fill-slate-900 dark:stroke-slate-400'}
                strokeWidth={1.4}
            />
        ))}
    </svg>
);

export default VehicleCategoryIcon;
