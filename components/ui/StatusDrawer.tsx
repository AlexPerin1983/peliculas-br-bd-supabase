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
                <Drawer.Content className="bg-white dark:bg-slate-900 flex flex-col rounded-t-[10px] h-auto mt-24 fixed bottom-0 left-0 right-0 z-50 outline-none border-t border-slate-200 dark:border-slate-700">
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-t-[10px] flex-1">
                        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-slate-300 dark:bg-slate-700 mb-6" />

                        <div className="max-w-md mx-auto space-y-6">
                            {/* Header */}
                            <div className="text-center">
                                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-3xl">⚙️</span>
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                    Alterar Status
                                </h2>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    {item.filmId}
                                </p>
                            </div>

                            {/* Current Status Badge */}
                            <div className="flex items-center justify-center">
                                <div
                                    className="px-4 py-2 rounded-full text-sm font-semibold text-white shadow-lg"
                                    style={{ backgroundColor: getStatusColor(currentStatus) }}
                                >
                                    {getStatusLabel(currentStatus).toUpperCase()}
                                </div>
                            </div>

                            {/* Status Options */}
                            <div className="space-y-2">
                                {statusOptions.map((option) => {
                                    const isActive = currentStatus === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            onClick={() => handleStatusSelect(option.value)}
                                            disabled={isActive}
                                            className={`
                                                w-full flex items-center gap-4 p-4 rounded-xl transition-all
                                                ${isActive
                                                    ? 'bg-slate-100 dark:bg-slate-800 border-2 cursor-default'
                                                    : 'bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600 active:scale-[0.98]'
                                                }
                                            `}
                                            style={
                                                isActive
                                                    ? { borderColor: option.color }
                                                    : undefined
                                            }
                                        >
                                            <div
                                                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-sm"
                                                style={{
                                                    backgroundColor: `${option.color}20`,
                                                    color: option.color
                                                }}
                                            >
                                                {option.emoji}
                                            </div>
                                            <span className="flex-1 text-left font-semibold text-slate-900 dark:text-white">
                                                {option.label}
                                            </span>
                                            {isActive && (
                                                <svg
                                                    className="w-6 h-6"
                                                    style={{ color: option.color }}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={3}
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M5 13l4 4L19 7"
                                                    />
                                                </svg>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Delete Button */}
                            <button
                                onClick={handleDelete}
                                className="w-full py-3.5 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-xl font-semibold text-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                </svg>
                                Excluir {type === 'bobina' ? 'Bobina' : 'Retalho'}
                            </button>

                            {/* Cancel Button */}
                            <button
                                onClick={onClose}
                                className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-lg hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
};
