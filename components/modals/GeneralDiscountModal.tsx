import React, { useState, useEffect, FormEvent } from 'react';
import Modal from '../ui/Modal';

interface GeneralDiscountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (discount: { value: string; type: 'percentage' | 'fixed' }) => void;
    initialValue?: string;
    initialType?: 'percentage' | 'fixed';
}

const GeneralDiscountModal: React.FC<GeneralDiscountModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialValue = '',
    initialType = 'percentage'
}) => {
    const [value, setValue] = useState(initialValue);
    const [type, setType] = useState<'percentage' | 'fixed'>(initialType);
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue);
            setType(initialType);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, initialValue, initialType]);

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (/^[0-9]*[.,]?[0-9]*$/.test(val)) {
            setValue(val);
        }
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        let finalValue = value;
        if (finalValue === ',' || finalValue === '.') {
            finalValue = '';
        }
        onSave({ value: finalValue, type });
    };

    const handleButtonMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
    };

    const footer = (
        <>
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100">
                Cancelar
            </button>
            <button
                type="submit"
                form="generalDiscountForm"
                className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-md hover:bg-slate-700"
            >
                Aplicar Desconto
            </button>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Desconto Geral do Orçamento"
            footer={footer}
            wrapperClassName="sm:items-center items-start pt-20 sm:pt-4"
        >
            <form id="generalDiscountForm" onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                        Valor do Desconto Geral
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                        Este desconto será aplicado ao valor total desta opção após os descontos individuais dos itens.
                    </p>
                    <div className="flex">
                        <input
                            ref={inputRef}
                            type="text"
                            value={value}
                            onChange={handleValueChange}
                            onClick={(e) => {
                                if (document.activeElement !== inputRef.current) {
                                    inputRef.current?.focus();
                                }
                            }}
                            className="w-full p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-600 rounded-l-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                            placeholder="0"
                            inputMode="decimal"
                        />
                        <div className="flex">
                            <button
                                type="button"
                                onClick={() => setType('percentage')}
                                onMouseDown={handleButtonMouseDown}
                                className={`px-4 py-2 text-sm font-semibold border-t border-b transition-colors ${type === 'percentage' ? 'bg-slate-800 text-white border-slate-800 z-10 dark:bg-slate-600 dark:border-slate-500' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-600'}`}
                            >
                                %
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('fixed')}
                                onMouseDown={handleButtonMouseDown}
                                className={`px-4 py-2 text-sm font-semibold border rounded-r-md transition-colors ${type === 'fixed' ? 'bg-slate-800 text-white border-slate-800 z-10 dark:bg-slate-600 dark:border-slate-500' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-600'}`}
                            >
                                R$
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default GeneralDiscountModal;