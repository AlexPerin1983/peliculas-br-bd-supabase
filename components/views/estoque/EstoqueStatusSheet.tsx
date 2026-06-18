import React from 'react';
import { Drawer } from 'vaul';
import { Check } from 'lucide-react';
import { EstoqueStatusOption } from './estoqueStatus';

interface EstoqueStatusSheetProps {
    isOpen: boolean;
    onClose: () => void;
    value: string;
    options: EstoqueStatusOption[];
    onChange: (value: string) => void;
}

/** Bottom sheet (mobile) para escolher o filtro de Status do Estoque. */
const EstoqueStatusSheet: React.FC<EstoqueStatusSheetProps> = ({ isOpen, onClose, value, options, onChange }) => {
    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        onClose();
    };

    return (
        <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
                <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mt-24 flex flex-col rounded-t-2xl border-t border-slate-200 bg-white outline-none dark:border-slate-700 dark:bg-slate-900">
                    <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" />
                    <div className="p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
                        <h3 className="mb-3 px-1 text-sm font-bold text-slate-800 dark:text-slate-100">Filtrar por status</h3>
                        <div className="space-y-1.5">
                            {options.map((option) => {
                                const selected = option.value === value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleSelect(option.value)}
                                        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-[15px] transition-colors ${selected
                                            ? 'bg-blue-50 font-semibold text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'
                                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                                            }`}
                                    >
                                        <span className="flex-1">{option.value === 'todos' ? 'Todos' : option.label}</span>
                                        {selected && <Check className="h-5 w-5 shrink-0" aria-hidden="true" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
};

export default EstoqueStatusSheet;
