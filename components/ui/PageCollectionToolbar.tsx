import React from 'react';
import ActionButton from './ActionButton';
import ViewModeToggle from './ViewModeToggle';

interface PageCollectionToolbarProps {
    search: string;
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
    searchPlaceholder: string;
    primaryActionLabel: string;
    primaryActionIconClassName?: string;
    onPrimaryAction: () => void;
    viewMode?: 'grid' | 'list';
    onViewModeChange?: (value: 'grid' | 'list') => void;
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
}) => {
    return (
        <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
            <div className="relative w-full sm:flex-grow">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <i className="fas fa-search text-lg text-slate-400"></i>
                </div>
                <input
                    type="text"
                    placeholder={searchPlaceholder}
                    className="w-full rounded-xl border-none bg-white py-4 pl-12 pr-10 text-base text-slate-800 shadow-lg shadow-slate-200/50 transition-all focus:ring-2 focus:ring-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:shadow-slate-900/50"
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                />
                {search && (
                    <button
                        type="button"
                        onClick={onClearSearch}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                        aria-label="Limpar busca"
                    >
                        <i className="fas fa-times-circle text-lg"></i>
                    </button>
                )}
            </div>

            <div className="flex items-center gap-3">
                <ActionButton
                    variant="primary"
                    size="lg"
                    iconClassName={primaryActionIconClassName}
                    className="min-w-[180px] sm:min-w-0"
                    onClick={onPrimaryAction}
                >
                    {primaryActionLabel}
                </ActionButton>

                {viewMode && onViewModeChange && (
                    <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
                )}
            </div>
        </div>
    );
};

export default PageCollectionToolbar;
