import React, { useState, useEffect, FormEvent } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';

interface DiscountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (discount: { value: string; type: 'percentage' | 'fixed' }) => void;
    initialValue?: string;
    initialType?: 'percentage' | 'fixed';
    basePrice?: number;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const DiscountModal: React.FC<DiscountModalProps> = ({ isOpen, onClose, onSave, initialValue, initialType = 'percentage', basePrice = 0 }) => {
    // Usando string para o estado para permitir a digitação de vírgulas e números parciais
    const [value, setValue] = useState(initialValue || '');
    const [type, setType] = useState<'percentage' | 'fixed'>(initialType);
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Sincroniza o estado local com as props iniciais ao abrir
            setValue(initialValue || '');
            setType(initialType);
            // Foca o input ao abrir o modal
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, initialValue, initialType]);

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        // Permite apenas números, vírgula e ponto
        if (/^[0-9]*[.,]?[0-9]*$/.test(val)) {
            setValue(val);
        }
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        onSave({ value, type });
    };

    const handleButtonMouseDown = (e: React.MouseEvent) => {
        // Previne que o botão roube o foco do input antes do clique ser processado
        e.preventDefault();
    };

    const calculatedDiscountValue = React.useMemo(() => {
        const numValue = parseFloat(value.replace(',', '.')) || 0;
        if (numValue <= 0) return 0;

        if (type === 'percentage') {
            return basePrice * (numValue / 100);
        } else {
            return numValue;
        }
    }, [value, type, basePrice]);

    const finalPrice = React.useMemo(() => {
        return Math.max(0, basePrice - calculatedDiscountValue);
    }, [basePrice, calculatedDiscountValue]);

    const footer = (
        <>
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100">
                Cancelar
            </button>
            <button
                type="submit"
                form="discountForm"
                className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-md hover:bg-slate-700"
            >
                Salvar Desconto
            </button>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Aplicar Desconto no Item"
            footer={footer}
            wrapperClassName="sm:items-center items-start pt-20 sm:pt-4"
        >
            <form id="discountForm" onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Valor do Desconto</label>
                        {basePrice > 0 && calculatedDiscountValue > 0 && (
                            <span className="text-sm font-bold text-green-600 dark:text-green-400">
                                - {formatCurrency(calculatedDiscountValue)}
                            </span>
                        )}
                    </div>
                    {basePrice > 0 && (
                        <div className="flex justify-between items-center mb-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Valor Final:</span>
                            <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                {formatCurrency(finalPrice)}
                            </span>
                        </div>
                    )}
                    <div className="mt-1 flex">
                        <input
                            ref={inputRef}
                            type="text"
                            value={value} // Componente controlado
                            onChange={handleValueChange}
                            onBlur={handleSubmit} // Salva ao perder o foco (Tab ou clique fora)
                            onClick={(e) => {
                                // Garante que se o usuário clicar no input, ele mantenha o foco
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
                                className={`px-4 py-2 text-sm font-semibold border rounded-r-md ${type === 'fixed' ? 'bg-slate-800 text-white border-slate-800 z-10 dark:bg-slate-600 dark:border-slate-500' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-600'}`}
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

export default DiscountModal;