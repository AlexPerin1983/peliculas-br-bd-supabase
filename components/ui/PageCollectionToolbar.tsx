import React from 'react';
import { Plus, Search, XCircle } from 'lucide-react';
import ActionButton from './ActionButton';
import ViewModeToggle from './ViewModeToggle';

interface PageCollectionToolbarProps {
    search: string;
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
    searchPlaceholder: string;
    primaryActionLabel?: string;
    primaryActionIconClassName?: string;
    onPrimaryAction?: () => void;
    viewMode?: 'grid' | 'list';
    onViewModeChange?: (value: 'grid' | 'list') => void;
    secondaryActions?: React.ReactNode;
}

const PageCollectionToolbar: React.FC<PageCollectionToolbarProps> = ({
    search,
    onSearchChange,
    onClearSearch,
    searchPlaceholder,
    primaryActionLabel,
    primaryActionIconClassName = 'fas fa-plus',
    onPrimaryAction,
    viewMode,
    onViewModeChange,
    secondaryActions,
}) => {
    return (
        <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
            <div className="relative w-full sm:flex-grow">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Search className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                </div>
                <input
                    type="text"
                    placeholder={searchPlaceholder}
                    className="h-12 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] pl-11 pr-10 text-sm font-medium text-[var(--text-strong)] shadow-[var(--shadow-hairline)] outline-none transition-all placeholder:text-[var(--text-soft)] focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-blue-500/10"
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                />
                {search && (
                    <button
                        type="button"
                        onClick={onClearSearch}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
                        aria-label="Limpar busca"
                    >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                    </button>
                )}
            </div>

            <div className="flex items-center gap-3">
                {secondaryActions}

                {primaryActionLabel && onPrimaryAction ? (
                    <ActionButton
                        variant="primary"
                        size="lg"
                        icon={primaryActionIconClassName === 'fas fa-plus' ? <Plus className="h-4 w-4" aria-hidden="true" /> : undefined}
                        iconClassName={primaryActionIconClassName === 'fas fa-plus' ? undefined : primaryActionIconClassName}
                        className="min-w-[180px] sm:min-w-0"
                        onClick={onPrimaryAction}
                    >
                        {primaryActionLabel}
                    </ActionButton>
                ) : null}

                {viewMode && onViewModeChange && (
                    <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
                )}
            </div>
        </div>
    );
};

export default PageCollectionToolbar;
