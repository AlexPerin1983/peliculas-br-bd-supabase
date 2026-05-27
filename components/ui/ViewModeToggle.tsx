import React from 'react';
import { Grid2X2, List } from 'lucide-react';
import ActionButton from './ActionButton';

interface ViewModeToggleProps {
    value: 'grid' | 'list';
    onChange: (value: 'grid' | 'list') => void;
}

const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ value, onChange }) => {
    return (
        <div className="inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-1 shadow-[var(--shadow-hairline)]">
            <ActionButton
                variant={value === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                iconOnly
                icon={<Grid2X2 className="h-4 w-4" aria-hidden="true" />}
                className={value === 'grid' ? 'bg-[var(--surface)] text-[var(--brand-primary)] shadow-sm' : 'text-[var(--text-muted)]'}
                onClick={() => onChange('grid')}
                title="Visualização em grade"
                aria-label="Visualização em grade"
            />
            <ActionButton
                variant={value === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                iconOnly
                icon={<List className="h-4 w-4" aria-hidden="true" />}
                className={value === 'list' ? 'bg-[var(--surface)] text-[var(--brand-primary)] shadow-sm' : 'text-[var(--text-muted)]'}
                onClick={() => onChange('list')}
                title="Visualização em lista"
                aria-label="Visualização em lista"
            />
        </div>
    );
};

export default ViewModeToggle;
