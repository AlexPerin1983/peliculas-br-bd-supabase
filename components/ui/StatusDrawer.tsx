import React from 'react';
import { Drawer } from 'vaul';
import { Bobina, Retalho } from '../../types';

interface StatusOption {
    value: string;
    label: string;
    emoji: string;
    color: string;
}

interface StatusDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'bobina' | 'retalho';
    item: Bobina | Retalho;
    currentStatus: string;
    statusOptions: StatusOption[];
    onStatusChange: (newStatus: string) => void;
    onDelete: (type: 'bobina' | 'retalho', id: number) => void;
    getStatusLabel: (status: string) => string;
    getStatusColor: (status: string) => string;
}

export const StatusDrawer: React.FC<StatusDrawerProps> = ({
    isOpen,
    onClose,
    type,
    item,
    currentStatus,
    statusOptions,
    onStatusChange,
    onDelete,
    getStatusLabel,
    getStatusColor
}) => {
    const handleStatusSelect = (newStatus: string) => {
        onStatusChange(newStatus);
        onClose();
    };

    const handleDelete = () => {
        if (item.id) {
            onDelete(type, item.id);
            onClose();
        }
    };

    return (
        <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
                <Drawer.Content className="bg-white dark:bg-slate-900 flex flex-col rounded-t-2xl h-auto mt-24 fixed bottom-0 left-0 right-0 z-50 outline-none border-t border-slate-200 dark:border-slate-700">
                    <div
                        className="px-4 pt-2.5 bg-white dark:bg-slate-900 rounded-t-2xl"
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
                    >
                        <div className="mx-auto w-10 h-1.5 flex-shrink-0 rounded-full bg-slate-300 dark:bg-slate-700 mb-4" />

                        <div className="max-w-md mx-auto">
                            {/* Header compacto */}
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Alterar status</h2>
                                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                        {item.filmId}{item.id ? ` · #${item.id}` : ''}
                                    </p>
                                </div>
                                <span
                                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white"
                                    style={{ backgroundColor: getStatusColor(currentStatus) }}
                                >
                                    {getStatusLabel(currentStatus)}
                                </span>
                            </div>

                            {/* Opções */}
                            <div className="space-y-1.5">
                                {statusOptions.map((option) => {
                                    const isActive = currentStatus === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            onClick={() => handleStatusSelect(option.value)}
                                            disabled={isActive}
                                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${isActive
                                                ? 'cursor-default border-2 bg-slate-50 dark:bg-slate-800'
                                                : 'border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.99] dark:border-slate-700/60 dark:bg-slate-800/40 dark:hover:bg-slate-800'
                                                }`}
                                            style={isActive ? { borderColor: option.color } : undefined}
                                        >
                                            <span
                                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                                                style={{ backgroundColor: `${option.color}20`, color: option.color }}
                                            >
                                                {option.emoji}
                                            </span>
                                            <span className="flex-1 text-sm font-semibold text-slate-900 dark:text-white">
                                                {option.label}
                                            </span>
                                            {isActive && (
                                                <svg className="h-5 w-5 shrink-0" style={{ color: option.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Ações */}
                            <div className="mt-4 flex gap-2">
                                <button
                                    onClick={onClose}
                                    className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-200 active:scale-[0.98] dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white transition-all hover:bg-red-600 active:scale-[0.98] dark:bg-red-600 dark:hover:bg-red-700"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18" />
                                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                    </svg>
                                    Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
};
