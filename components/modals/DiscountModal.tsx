import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import type { MeasurementPriceAdjustment } from '../../types';
import { calculateMeasurementPriceAdjustment, getMeasurementAdjustmentInputs } from '../../src/lib/measurementPriceAdjustment';

interface DiscountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (adjustment: MeasurementPriceAdjustment) => void;
    initialAdjustment?: MeasurementPriceAdjustment;
    basePrice?: number;
}

type AdjustmentType = 'percentage' | 'fixed';
const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const isValidValue = (value: string) => /^[0-9]*[.,]?[0-9]*$/.test(value);

const DiscountModal: React.FC<DiscountModalProps> = ({ isOpen, onClose, onSave, initialAdjustment, basePrice = 0 }) => {
    const initialInputs = getMeasurementAdjustmentInputs(initialAdjustment);
    const [increaseValue, setIncreaseValue] = useState(initialInputs.increase.value);
    const [increaseType, setIncreaseType] = useState<AdjustmentType>(initialInputs.increase.type);
    const [discountValue, setDiscountValue] = useState(initialInputs.discount.value);
    const [discountType, setDiscountType] = useState<AdjustmentType>(initialInputs.discount.type);

    useEffect(() => {
        if (!isOpen) return;
        const inputs = getMeasurementAdjustmentInputs(initialAdjustment);
        setIncreaseValue(inputs.increase.value);
        setIncreaseType(inputs.increase.type);
        setDiscountValue(inputs.discount.value);
        setDiscountType(inputs.discount.type);
    }, [isOpen, initialAdjustment]);

    const adjustment: MeasurementPriceAdjustment = {
        value: discountValue || increaseValue,
        type: discountValue ? discountType : increaseType,
        operation: discountValue ? 'discount' : 'increase',
        discountValue, discountType, increaseValue, increaseType,
    };
    const calculated = calculateMeasurementPriceAdjustment(basePrice, adjustment);
    const handleSubmit = (event: React.FormEvent) => { event.preventDefault(); onSave(adjustment); };

    const field = (
        id: string, label: string, value: string, setValue: (value: string) => void,
        type: AdjustmentType, setType: (type: AdjustmentType) => void, amount: number, tone: 'blue' | 'emerald',
    ) => (
        <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor={id} className="text-sm font-bold text-[var(--text-strong)]">{label}</label>
                {amount > 0 && <span className={`text-xs font-bold ${tone === 'blue' ? 'text-blue-700 dark:text-blue-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{tone === 'blue' ? '+' : '−'} {formatCurrency(amount)}</span>}
            </div>
            <div className="flex">
                <input id={id} type="text" value={value} onChange={event => { if (isValidValue(event.target.value)) setValue(event.target.value); }} className="h-12 min-w-0 flex-1 rounded-l-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-lg font-bold text-[var(--text-strong)] outline-none focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-blue-500/10" placeholder="0" inputMode="decimal" />
                <button type="button" onClick={() => setType('percentage')} aria-label={`${label} em porcentagem`} aria-pressed={type === 'percentage'} className={`h-12 min-w-11 border-y px-3 text-sm font-bold ${type === 'percentage' ? 'border-slate-950 bg-slate-950 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950' : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)]'}`}>%</button>
                <button type="button" onClick={() => setType('fixed')} aria-label={`${label} em reais`} aria-pressed={type === 'fixed'} className={`h-12 min-w-11 rounded-r-[var(--radius-control)] border px-3 text-sm font-bold ${type === 'fixed' ? 'border-slate-950 bg-slate-950 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950' : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)]'}`}>R$</button>
            </div>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ajuste do grupo" wrapperClassName="sm:items-center items-start pt-20 sm:pt-4" footer={<><ActionButton onClick={onClose} variant="ghost" size="sm">Cancelar</ActionButton><ActionButton type="submit" form="discountForm" variant="primary" size="sm">Salvar ajuste</ActionButton></>}>
            <form id="discountForm" onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"><span className="ui-kicker">Valor original</span><span className="mt-1 block text-lg font-black text-[var(--text-strong)]">{formatCurrency(basePrice)}</span></div>
                    <div className="rounded-[var(--radius-panel)] border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-900/20"><span className="ui-kicker text-blue-700 dark:text-blue-300">Valor final</span><span className="mt-1 block text-lg font-black text-blue-700 dark:text-blue-300">{formatCurrency(calculated.finalPrice)}</span></div>
                </div>
                {field('increase-value', 'Acréscimo', increaseValue, setIncreaseValue, increaseType, setIncreaseType, calculated.increaseAmount, 'blue')}
                {field('discount-value', 'Desconto', discountValue, setDiscountValue, discountType, setDiscountType, calculated.discountAmount, 'emerald')}
                <p className="text-xs leading-5 text-[var(--text-muted)]">O acréscimo entra no preço; o desconto aparece no orçamento.</p>
            </form>
        </Modal>
    );
};

export default DiscountModal;
