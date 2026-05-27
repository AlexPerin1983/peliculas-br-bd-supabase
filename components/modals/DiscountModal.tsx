import React, { useState, useEffect, FormEvent } from 'react';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';

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
            <ActionButton onClick={onClose} variant="ghost" size="sm">
                Cancelar
            </ActionButton>
            <ActionButton
                type="submit"
                form="discountForm"
                variant="primary"
                size="sm"
            >
                Salvar Desconto
            </ActionButton>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Desconto do item"
            footer={footer}
            wrapperClassName="sm:items-center items-start pt-20 sm:pt-4"
        >
            <form id="discountForm" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                        <span className="ui-kicker">Valor original</span>
                        <span className="mt-1 block text-lg font-black text-[var(--text-strong)]">{formatCurrency(basePrice)}</span>
                    </div>
                    <div className="rounded-[var(--radius-panel)] border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/20">
                        <span className="ui-kicker text-emerald-700 dark:text-emerald-300">Valor final</span>
                        <span className="mt-1 block text-lg font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(finalPrice)}</span>
                    </div>
                </div>

                <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <label htmlFor="discount-value" className="text-sm font-bold text-[var(--text-strong)]">Valor do desconto</label>
                        {basePrice > 0 && calculatedDiscountValue > 0 && (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                                - {formatCurrency(calculatedDiscountValue)}
                            </span>
                        )}
                    </div>
                    <div className="flex">
                        <input
                            id="discount-value"
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
                            className="h-12 w-full rounded-l-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-lg font-bold text-[var(--text-strong)] outline-none transition focus:border-[var(--brand-primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-blue-500/10"
                            placeholder="0"
                            inputMode="decimal"
                        />
                        <div className="flex">
                            <button
                                type="button"
                                onClick={() => setType('percentage')}
                                onMouseDown={handleButtonMouseDown}
                                className={`h-12 px-4 text-sm font-bold border-y transition-colors ${type === 'percentage' ? 'bg-slate-950 text-white border-slate-950 z-10 dark:bg-slate-100 dark:text-slate-950 dark:border-slate-100' : 'bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'}`}
                            >
                                %
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('fixed')}
                                onMouseDown={handleButtonMouseDown}
                                className={`h-12 rounded-r-[var(--radius-control)] border px-4 text-sm font-bold transition-colors ${type === 'fixed' ? 'bg-slate-950 text-white border-slate-950 z-10 dark:bg-slate-100 dark:text-slate-950 dark:border-slate-100' : 'bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'}`}
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
