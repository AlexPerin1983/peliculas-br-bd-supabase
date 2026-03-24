import React from 'react';
import ActionButton from './ActionButton';

interface ViewModeToggleProps {
    value: 'grid' | 'list';
    onChange: (value: 'grid' | 'list') => void;
}

const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ value, onChange }) => {
    return (
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <ActionButton
                variant={value === 'grid' ? 'secondary' : 'ghost'}
                size="md"
                iconOnly
                iconClassName="fas fa-th-large"
                className={value === 'grid' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}
                onClick={() => onChange('grid')}
                title="Visualização em grade"
                aria-label="Visualização em grade"
            />
            <ActionButton
                variant={value === 'list' ? 'secondary' : 'ghost'}
                size="md"
                iconOnly
                iconClassName="fas fa-list"
                className={value === 'list' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}
                onClick={() => onChange('list')}
                title="Visualização em lista"
                aria-label="Visualização em lista"
            />
        </div>
    );
};

export default ViewModeToggle;
