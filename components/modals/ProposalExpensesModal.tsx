import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { ProposalExpense, ProposalExpenseCategory, Totals } from '../../types';
import {
    PROPOSAL_EXPENSE_CATEGORY_OPTIONS,
    calculateFuelExpenseAmount,
    normalizeCurrencyInput,
    normalizeFuelExpenseDetails,
    normalizeProposalExpenses,
    parseCurrencyInput
} from '../../src/lib/proposalExpenses';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';

interface ProposalExpensesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (expenses: ProposalExpense[]) => void;
    expenses: ProposalExpense[];
    totals: Totals;
}

type ExpenseRow = {
    id?: string;
    category: ProposalExpenseCategory;
    amount: string;
    description: string;
    fuelPricePerLiter: string;
    consumptionKmPerLiter: string;
    distanceKm: string;
};

type FuelExpenseField = 'fuelPricePerLiter' | 'consumptionKmPerLiter' | 'distanceKm';

const categoryIcons: Record<ProposalExpenseCategory, string> = {
    paid_traffic: 'fas fa-bullhorn',
    transport: 'fas fa-route',
    food: 'fas fa-utensils',
    tools: 'fas fa-screwdriver-wrench',
    material: 'fas fa-boxes-stacked',
    other: 'fas fa-receipt'
};

const formatNumberBR = (number: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(number);
};

const formatAmountInput = (amount: number) => {
    return amount > 0 ? String(amount).replace('.', ',') : '';
};

const isAutoFuelDescription = (description: string) => {
    const normalizedDescription = description.trim();
    return normalizedDescription.startsWith('Combustivel:')
        && normalizedDescription.includes(' km | ')
        && normalizedDescription.includes(' km/L | ');
};

const buildFuelDescription = (row: ExpenseRow) => [
    `Combustivel: ${row.distanceKm} km`,
    `${row.consumptionKmPerLiter} km/L`,
    `${formatNumberBR(parseCurrencyInput(row.fuelPricePerLiter))}/L`
].join(' | ');

const buildRowsFromExpenses = (expenses: ProposalExpense[]): ExpenseRow[] => {
    const normalizedExpenses = normalizeProposalExpenses(expenses);

    return PROPOSAL_EXPENSE_CATEGORY_OPTIONS.map(option => {
        const categoryExpenses = normalizedExpenses.filter(expense => expense.category === option.category);
        const total = categoryExpenses.reduce((sum, expense) => sum + parseCurrencyInput(expense.amount), 0);
        const fuelDetails = option.category === 'transport'
            ? categoryExpenses.find(expense => expense.fuelDetails)?.fuelDetails
            : undefined;
        const description = categoryExpenses
            .map(expense => expense.description)
            .filter(Boolean)
            .join(' / ');
        const shouldHideAutoDescription = option.category === 'transport'
            && Boolean(fuelDetails)
            && isAutoFuelDescription(description);

        return {
            id: categoryExpenses[0]?.id,
            category: option.category,
            amount: formatAmountInput(total),
            description: shouldHideAutoDescription ? '' : description,
            fuelPricePerLiter: String(fuelDetails?.fuelPricePerLiter || ''),
            consumptionKmPerLiter: String(fuelDetails?.consumptionKmPerLiter || ''),
            distanceKm: String(fuelDetails?.distanceKm || '')
        };
    });
};

const buildExpenseDescription = (row: ExpenseRow) => {
    const customDescription = row.description.trim();

    if (row.category !== 'transport' || calculateFuelExpenseAmount(row) <= 0) {
        return customDescription;
    }

    return customDescription && !isAutoFuelDescription(customDescription)
        ? customDescription
        : buildFuelDescription(row);
};

const ProposalExpensesModal: React.FC<ProposalExpensesModalProps> = ({
    isOpen,
    onClose,
    onSave,
    expenses,
    totals
}) => {
    const [rows, setRows] = useState<ExpenseRow[]>(() => buildRowsFromExpenses(expenses));

    useEffect(() => {
        if (isOpen) {
            setRows(buildRowsFromExpenses(expenses));
        }
    }, [expenses, isOpen]);

    const preview = useMemo(() => {
        const operationalExpenses = rows.reduce((sum, row) => sum + parseCurrencyInput(row.amount), 0);
        const estimatedMaterialCost = totals.pricingMode === 'labor_only' ? 0 : totals.linearMeterCost;
        const estimatedTotalCost = estimatedMaterialCost + operationalExpenses;
        const estimatedProfit = totals.finalTotal - estimatedTotalCost;
        const estimatedMarginPercentage = totals.finalTotal > 0 ? (estimatedProfit / totals.finalTotal) * 100 : 0;

        return {
            operationalExpenses,
            estimatedMaterialCost,
            estimatedTotalCost,
            estimatedProfit,
            estimatedMarginPercentage
        };
    }, [rows, totals.finalTotal, totals.linearMeterCost, totals.pricingMode]);

    const handleAmountChange = (category: ProposalExpenseCategory, value: string) => {
        const nextValue = normalizeCurrencyInput(value);
        setRows(currentRows => currentRows.map(row =>
            row.category === category ? { ...row, amount: nextValue } : row
        ));
    };

    const handleDescriptionChange = (category: ProposalExpenseCategory, description: string) => {
        setRows(currentRows => currentRows.map(row =>
            row.category === category ? { ...row, description } : row
        ));
    };

    const handleFuelFieldChange = (field: FuelExpenseField, value: string) => {
        const nextValue = normalizeCurrencyInput(value);

        setRows(currentRows => currentRows.map(row => {
            if (row.category !== 'transport') {
                return row;
            }

            const nextRow = { ...row, [field]: nextValue };
            const fuelAmount = calculateFuelExpenseAmount(nextRow);

            return {
                ...nextRow,
                amount: formatAmountInput(fuelAmount)
            };
        }));
    };

    const handleClear = () => {
        setRows(currentRows => currentRows.map(row => ({
            ...row,
            amount: '',
            description: '',
            fuelPricePerLiter: '',
            consumptionKmPerLiter: '',
            distanceKm: ''
        })));
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();

        const nextExpenses = rows
            .map(row => {
                const fuelDetails = row.category === 'transport'
                    ? normalizeFuelExpenseDetails(row)
                    : undefined;
                const fuelAmount = calculateFuelExpenseAmount(fuelDetails);
                const amount = parseCurrencyInput(row.amount) > 0
                    ? row.amount
                    : fuelAmount > 0
                        ? String(fuelAmount)
                        : row.amount;
                const description = buildExpenseDescription(row);

                return {
                    id: row.id || `${row.category}-${Date.now()}`,
                    category: row.category,
                    amount,
                    ...(description ? { description } : {}),
                    ...(fuelDetails ? { fuelDetails } : {})
                };
            })
            .filter(row => parseCurrencyInput(row.amount) > 0);

        onSave(normalizeProposalExpenses(nextExpenses));
    };

    const footer = (
        <>
            <ActionButton onClick={onClose} variant="ghost" size="sm">
                Cancelar
            </ActionButton>
            <ActionButton onClick={handleClear} variant="secondary" size="sm">
                Limpar
            </ActionButton>
            <ActionButton type="submit" form="proposalExpensesForm" variant="primary" size="sm">
                Salvar gastos
            </ActionButton>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Gastos da proposta"
            footer={footer}
            wrapperClassName="sm:items-center items-start pt-16 sm:pt-4"
        >
            <form id="proposalExpensesForm" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                        <span className="ui-kicker">Gastos</span>
                        <span className="mt-1 block text-base font-black text-[var(--text-strong)]">{formatNumberBR(preview.operationalExpenses)}</span>
                    </div>
                    <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                        <span className="ui-kicker">Resultado</span>
                        <span className={`mt-1 block text-base font-black ${preview.estimatedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
                            {formatNumberBR(preview.estimatedProfit)}
                        </span>
                    </div>
                </div>

                <div className="space-y-3">
                    {PROPOSAL_EXPENSE_CATEGORY_OPTIONS.map(option => {
                        const row = rows.find(item => item.category === option.category);
                        const fuelAmount = row ? calculateFuelExpenseAmount(row) : 0;
                        const fuelPricePerLiter = row ? parseCurrencyInput(row.fuelPricePerLiter) : 0;
                        const consumptionKmPerLiter = row ? parseCurrencyInput(row.consumptionKmPerLiter) : 0;
                        const costPerKm = fuelPricePerLiter > 0 && consumptionKmPerLiter > 0
                            ? fuelPricePerLiter / consumptionKmPerLiter
                            : 0;

                        return (
                            <div key={option.category} className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-[var(--shadow-hairline)]">
                                <div className="grid grid-cols-[auto_1fr_120px] items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
                                        <i className={categoryIcons[option.category]} aria-hidden="true"></i>
                                    </div>
                                    <label htmlFor={`expense-${option.category}`} className="min-w-0 text-sm font-bold text-[var(--text-strong)]">
                                        {option.label}
                                    </label>
                                    <input
                                        id={`expense-${option.category}`}
                                        type="text"
                                        inputMode="decimal"
                                        value={row?.amount || ''}
                                        onChange={(event) => handleAmountChange(option.category, event.target.value)}
                                        placeholder="0,00"
                                        className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-right text-sm font-bold text-[var(--text-strong)] outline-none transition focus:border-[var(--brand-primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-blue-500/10"
                                    />
                                </div>
                                <input
                                    type="text"
                                    value={row?.description || ''}
                                    onChange={(event) => handleDescriptionChange(option.category, event.target.value)}
                                    placeholder="Observacao interna"
                                    className="mt-2 h-9 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-xs text-[var(--text-body)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[var(--brand-primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-blue-500/10"
                                />
                                {option.category === 'transport' && row && (
                                    <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="ui-kicker">Combustivel por km</span>
                                            <span className="text-sm font-black text-[var(--text-strong)]">{formatNumberBR(fuelAmount)}</span>
                                        </div>
                                        <div className="mt-3 grid grid-cols-3 gap-2">
                                            <label htmlFor="expense-fuel-price" className="block">
                                                <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] sm:text-[11px]">Preco/L</span>
                                                <input
                                                    id="expense-fuel-price"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={row.fuelPricePerLiter}
                                                    onChange={(event) => handleFuelFieldChange('fuelPricePerLiter', event.target.value)}
                                                    placeholder="6,00"
                                                    className="mt-1 h-9 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 text-sm font-bold text-[var(--text-strong)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[var(--brand-primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-blue-500/10 sm:px-3"
                                                />
                                            </label>
                                            <label htmlFor="expense-fuel-consumption" className="block">
                                                <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] sm:text-[11px]">Km/L</span>
                                                <input
                                                    id="expense-fuel-consumption"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={row.consumptionKmPerLiter}
                                                    onChange={(event) => handleFuelFieldChange('consumptionKmPerLiter', event.target.value)}
                                                    placeholder="10"
                                                    className="mt-1 h-9 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 text-sm font-bold text-[var(--text-strong)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[var(--brand-primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-blue-500/10 sm:px-3"
                                                />
                                            </label>
                                            <label htmlFor="expense-fuel-distance" className="block">
                                                <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] sm:text-[11px]">Km rodados</span>
                                                <input
                                                    id="expense-fuel-distance"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={row.distanceKm}
                                                    onChange={(event) => handleFuelFieldChange('distanceKm', event.target.value)}
                                                    placeholder="25"
                                                    className="mt-1 h-9 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 text-sm font-bold text-[var(--text-strong)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[var(--brand-primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-blue-500/10 sm:px-3"
                                                />
                                            </label>
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                                            <span>Custo/km: <strong className="text-[var(--text-strong)]">{formatNumberBR(costPerKm)}</strong></span>
                                            <span>Litros estimados: <strong className="text-[var(--text-strong)]">{consumptionKmPerLiter > 0 ? (parseCurrencyInput(row.distanceKm) / consumptionKmPerLiter).toFixed(1).replace('.', ',') : '0,0'}</strong></span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {preview.estimatedTotalCost > 0 && (
                    <div className="rounded-[var(--radius-panel)] bg-slate-950 p-4 text-white shadow-[0_16px_32px_rgba(15,23,42,0.16)]">
                        <div className="flex justify-between text-xs text-slate-300">
                            <span>Custo estimado</span>
                            <span>{formatNumberBR(preview.estimatedTotalCost)}</span>
                        </div>
                        <div className="mt-2 flex justify-between text-xs text-slate-300">
                            <span>Margem estimada</span>
                            <span>{preview.estimatedMarginPercentage.toFixed(1)}%</span>
                        </div>
                    </div>
                )}
            </form>
        </Modal>
    );
};

export default ProposalExpensesModal;
