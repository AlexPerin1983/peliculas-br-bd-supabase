import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import type { MeasurementPriceAdjustment, ProposalAdjustmentOperation } from '../../types';
import { calculateMeasurementPriceAdjustment } from '../../src/lib/measurementPriceAdjustment';

interface DiscountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (adjustment: MeasurementPriceAdjustment) => void;
    initialValue?: string;
    initialType?: 'percentage' | 'fixed';
    initialOperation?: ProposalAdjustmentOperation;
    basePrice?: number;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const DiscountModal: React.FC<DiscountModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialValue,
    initialType = 'percentage',
    initialOperation = 'discount',
    basePrice = 0,
}) => {
    // Usando string para o estado para permitir a digitação de vírgulas e números parciais
    const [value, setValue] = useState(initialValue || '');
    const [type, setType] = useState<'percentage' | 'fixed'>(initialType);
    const [operation, setOperation] = useState<ProposalAdjustmentOperation>(initialOperation);
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Sincroniza o estado local com as props iniciais ao abrir
            setValue(initialValue || '');
            setType(initialType);
            setOperation(initialOperation);
            // Foca o input ao abrir o modal
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, initialValue, initialType, initialOperation]);

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        // Permite apenas números, vírgula e ponto
        if (/^[0-9]*[.,]?[0-9]*$/.test(val)) {
            setValue(val);
        }
    };

    const handleSubmit = (e: React.SyntheticEvent) => {
        e.preventDefault();
        onSave({ value, type, operation });
    };

    const handleButtonMouseDown = (e: React.MouseEvent) => {
        // Previne que o botão roube o foco do input antes do clique ser processado
        e.preventDefault();
    };

    const calculatedAdjustment = React.useMemo(() => (
        calculateMeasurementPriceAdjustment(basePrice, { value, type, operation })
    ), [basePrice, operation, type, value]);
    const isIncrease = operation === 'increase';

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
                Salvar ajuste
            </ActionButton>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Ajuste do grupo"
            footer={footer}
            wrapperClassName="sm:items-center items-start pt-20 sm:pt-4"
        >
            <form id="discountForm" onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <span className="mb-2 block text-sm font-bold text-[var(--text-strong)]">O que deseja aplicar?</span>
                    <div className="grid grid-cols-2 rounded-[var(--radius-control)] bg-[var(--surface-muted)] p-1">
                        <button
                            type="button"
                            onMouseDown={handleButtonMouseDown}
                            onClick={() => setOperation('discount')}
                            aria-pressed={!isIncrease}
                            className={`h-10 rounded-[10px] text-sm font-bold transition ${!isIncrease ? 'bg-[var(--surface)] text-emerald-700 shadow-sm ring-1 ring-emerald-200 dark:text-emerald-300 dark:ring-emerald-900/60' : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'}`}
                        >
                            Desconto
                        </button>
                        <button
                            type="button"
                            onMouseDown={handleButtonMouseDown}
                            onClick={() => setOperation('increase')}
                            aria-pressed={isIncrease}
                            className={`h-10 rounded-[10px] text-sm font-bold transition ${isIncrease ? 'bg-[var(--surface)] text-blue-700 shadow-sm ring-1 ring-blue-200 dark:text-blue-300 dark:ring-blue-900/60' : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'}`}
                        >
                            Acréscimo
                        </button>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                        {isIncrease
                            ? 'O valor será embutido no preço deste grupo e não aparecerá como uma linha de acréscimo no orçamento.'
                            : 'O desconto continuará identificado no orçamento do cliente.'}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                        <span className="ui-kicker">Valor original</span>
                        <span className="mt-1 block text-lg font-black text-[var(--text-strong)]">{formatCurrency(basePrice)}</span>
                    </div>
                    <div className={`rounded-[var(--radius-panel)] border p-3 ${isIncrease ? 'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/20' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20'}`}>
                        <span className={`ui-kicker ${isIncrease ? 'text-blue-700 dark:text-blue-300' : 'text-emerald-700 dark:text-emerald-300'}`}>Valor final</span>
                        <span className={`mt-1 block text-lg font-black ${isIncrease ? 'text-blue-700 dark:text-blue-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{formatCurrency(calculatedAdjustment.finalPrice)}</span>
                    </div>
                </div>

                <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <label htmlFor="discount-value" className="text-sm font-bold text-[var(--text-strong)]">Valor do {isIncrease ? 'acréscimo' : 'desconto'}</label>
                        {basePrice > 0 && calculatedAdjustment.amount > 0 && (
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isIncrease ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'}`}>
                                {isIncrease ? '+' : '-'} {formatCurrency(calculatedAdjustment.amount)}
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
