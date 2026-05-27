import React, { FormEvent, useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import { ProposalAdjustmentOperation, ProposalDiscount } from '../../types';
import {
    getProposalAdjustmentInputs,
    normalizeAdjustmentInputValue,
    parseAdjustmentNumber,
} from '../../src/lib/proposalAdjustments';

interface GeneralDiscountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (discount: ProposalDiscount) => void;
    initialDiscount?: ProposalDiscount;
    initialValue?: string;
    initialType?: 'percentage' | 'fixed';
    initialOperation?: ProposalAdjustmentOperation;
}

const GeneralDiscountModal: React.FC<GeneralDiscountModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialDiscount,
    initialValue = '',
    initialType = 'percentage',
    initialOperation = 'discount'
}) => {
    const buildInitialDiscount = (): ProposalDiscount => initialDiscount ?? {
        value: initialValue,
        type: initialType,
        operation: initialOperation
    };

    const initialInputs = getProposalAdjustmentInputs(buildInitialDiscount());
    const [discountValue, setDiscountValue] = useState(initialInputs.discount.value);
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(initialInputs.discount.type);
    const [increaseValue, setIncreaseValue] = useState(initialInputs.increase.value);
    const [increaseType, setIncreaseType] = useState<'percentage' | 'fixed'>(initialInputs.increase.type);
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const inputs = getProposalAdjustmentInputs(buildInitialDiscount());
        setDiscountValue(inputs.discount.value);
        setDiscountType(inputs.discount.type);
        setIncreaseValue(inputs.increase.value);
        setIncreaseType(inputs.increase.type);
        setTimeout(() => inputRef.current?.focus(), 100);
    }, [isOpen, initialDiscount, initialValue, initialType, initialOperation]);

    const sanitizeFinalValue = (value: string) => {
        const normalized = normalizeAdjustmentInputValue(value);
        return normalized === ',' || normalized === '.' ? '' : normalized;
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();

        const finalDiscountValue = sanitizeFinalValue(discountValue);
        const finalIncreaseValue = sanitizeFinalValue(increaseValue);
        const operation: ProposalAdjustmentOperation = parseAdjustmentNumber(finalDiscountValue) > 0
            ? 'discount'
            : parseAdjustmentNumber(finalIncreaseValue) > 0
                ? 'increase'
                : buildInitialDiscount().operation === 'increase'
                    ? 'increase'
                    : 'discount';
        const currentValue = operation === 'discount' ? finalDiscountValue : finalIncreaseValue;
        const currentType = operation === 'discount' ? discountType : increaseType;

        onSave({
            ...buildInitialDiscount(),
            value: currentValue,
            type: currentType,
            operation,
            discountValue: finalDiscountValue,
            discountType,
            increaseValue: finalIncreaseValue,
            increaseType,
        });
    };

    const handleButtonMouseDown = (event: React.MouseEvent) => {
        event.preventDefault();
    };

    const TypeButton = ({
        active,
        children,
        onClick,
        roundedClass = ''
    }: {
        active: boolean;
        children: React.ReactNode;
        onClick: () => void;
        roundedClass?: string;
    }) => (
        <button
            type="button"
            onClick={onClick}
            onMouseDown={handleButtonMouseDown}
            className={`h-12 border px-4 text-sm font-bold transition-colors ${roundedClass} ${active
                ? 'z-10 border-slate-950 bg-slate-950 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950'
                : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'
            }`}
        >
            {children}
        </button>
    );

    const footer = (
        <>
            <ActionButton onClick={onClose} variant="ghost" size="sm">
                Cancelar
            </ActionButton>
            <ActionButton
                type="submit"
                form="generalDiscountForm"
                variant="primary"
                size="sm"
            >
                Aplicar Ajuste
            </ActionButton>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Ajuste geral"
            footer={footer}
            wrapperClassName="sm:items-center items-start pt-20 sm:pt-4"
        >
            <form id="generalDiscountForm" onSubmit={handleSubmit} className="space-y-5">
                <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                    <p className="ui-kicker">Regra da proposta</p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
                        Use o acréscimo embutido para compor os valores no PDF e aplique o desconto final quando quiser negociar o fechamento.
                    </p>
                </div>

                <div className="space-y-3">
                    <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
                        <div className="mb-3">
                            <p className="text-sm font-bold text-[var(--text-strong)]">Acréscimo embutido</p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                                Inflaciona o m² no PDF sem exibir uma linha separada de acréscimo.
                            </p>
                        </div>
                        <div className="flex">
                            <input
                                ref={inputRef}
                                type="text"
                                value={increaseValue}
                                onChange={(event) => setIncreaseValue(normalizeAdjustmentInputValue(event.target.value))}
                                className="h-12 w-full rounded-l-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-lg font-bold text-[var(--text-strong)] outline-none transition focus:border-[var(--brand-primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-blue-500/10"
                                placeholder={increaseType === 'percentage' ? '0' : '0,00'}
                                inputMode="decimal"
                                aria-label="Valor do acréscimo embutido"
                            />
                            <div className="flex">
                                <TypeButton
                                    active={increaseType === 'percentage'}
                                    onClick={() => setIncreaseType('percentage')}
                                >
                                    %
                                </TypeButton>
                                <TypeButton
                                    active={increaseType === 'fixed'}
                                    onClick={() => setIncreaseType('fixed')}
                                    roundedClass="rounded-r-[var(--radius-control)]"
                                >
                                    R$
                                </TypeButton>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
                        <div className="mb-3">
                            <p className="text-sm font-bold text-[var(--text-strong)]">Desconto final</p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                                Aparece no fechamento depois do acréscimo embutido.
                            </p>
                        </div>
                        <div className="flex">
                            <input
                                type="text"
                                value={discountValue}
                                onChange={(event) => setDiscountValue(normalizeAdjustmentInputValue(event.target.value))}
                                className="h-12 w-full rounded-l-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-lg font-bold text-[var(--text-strong)] outline-none transition focus:border-[var(--brand-primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-blue-500/10"
                                placeholder={discountType === 'percentage' ? '0' : '0,00'}
                                inputMode="decimal"
                                aria-label="Valor do desconto final"
                            />
                            <div className="flex">
                                <TypeButton
                                    active={discountType === 'percentage'}
                                    onClick={() => setDiscountType('percentage')}
                                >
                                    %
                                </TypeButton>
                                <TypeButton
                                    active={discountType === 'fixed'}
                                    onClick={() => setDiscountType('fixed')}
                                    roundedClass="rounded-r-[var(--radius-control)]"
                                >
                                    R$
                                </TypeButton>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default GeneralDiscountModal;
