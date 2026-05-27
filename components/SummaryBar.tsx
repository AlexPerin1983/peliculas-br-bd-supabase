import React from 'react';
import { Percent } from 'lucide-react';
import { ProposalDiscount } from '../types';

interface Totals {
    totalM2: number;
    subtotal: number;
    totalItemDiscount: number;
    generalDiscountAmount: number;
    generalIncreaseAmount?: number;
    generalFinalDiscountAmount?: number;
    finalTotal: number;
    operationalExpenses?: number;
    estimatedTotalCost?: number;
    estimatedProfit?: number;
    estimatedMarginPercentage?: number;
}

interface SummaryBarProps {
    totals: Totals;
    generalDiscount: ProposalDiscount;
    onOpenGeneralDiscountModal: () => void;
    isDesktop?: boolean;
}

const formatNumberBR = (number: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(number);
};

const SummaryBar: React.FC<SummaryBarProps> = ({ totals, generalDiscount, onOpenGeneralDiscountModal, isDesktop = false }) => {

    const generalIncreaseAmount = totals.generalIncreaseAmount || 0;
    const generalFinalDiscountAmount = totals.generalFinalDiscountAmount || 0;
    const legacyAdjustmentAmount = generalIncreaseAmount <= 0 && generalFinalDiscountAmount <= 0
        ? totals.generalDiscountAmount
        : 0;
    const hasGeneralDiscount = generalIncreaseAmount > 0 || generalFinalDiscountAmount > 0 || legacyAdjustmentAmount > 0;

    const SummaryRow: React.FC<{ label: string; value: string, className?: string }> = ({ label, value, className }) => (
        <div className={`flex justify-between items-center gap-4 text-sm ${className}`}>
            <span className="text-[var(--text-muted)]">{label}</span>
            <span className="font-semibold text-[var(--text-strong)]">{value}</span>
        </div>
    );

    const TotalsBlock = ({ isMobile }: { isMobile?: boolean }) => (
        <div className={`space-y-1.5 ${isMobile ? 'rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3' : 'rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-[var(--shadow-hairline)]'}`}>
            <SummaryRow label={`Subtotal (${totals.totalM2.toFixed(2)} m²)`} value={formatNumberBR(totals.subtotal)} />
            {totals.totalItemDiscount > 0 && <SummaryRow label="Descontos (itens)" value={`-${formatNumberBR(totals.totalItemDiscount)}`} />}
            {generalIncreaseAmount > 0 && <SummaryRow label="Acréscimo embutido" value={`+${formatNumberBR(generalIncreaseAmount)}`} />}
            {generalFinalDiscountAmount > 0 && <SummaryRow label="Desconto final" value={`-${formatNumberBR(generalFinalDiscountAmount)}`} />}
            {legacyAdjustmentAmount > 0 && (
                <SummaryRow
                    label={generalDiscount.operation === 'increase' ? 'Acréscimo Geral' : 'Desconto Geral'}
                    value={`${generalDiscount.operation === 'increase' ? '+' : '-'}${formatNumberBR(legacyAdjustmentAmount)}`}
                />
            )}
            {(totals.operationalExpenses || 0) > 0 && <SummaryRow label="Gastos" value={formatNumberBR(totals.operationalExpenses || 0)} />}
            <div className="pt-1.5 mt-1.5 border-t border-[var(--border-subtle)]">
                <SummaryRow label="Total" value={formatNumberBR(totals.finalTotal)} className={isMobile ? 'text-base' : 'text-lg'} />
                {(totals.estimatedTotalCost || 0) > 0 && (
                    <SummaryRow
                        label="Resultado est."
                        value={`${formatNumberBR(totals.estimatedProfit || 0)} (${(totals.estimatedMarginPercentage || 0).toFixed(1)}%)`}
                        className={`mt-1 ${isMobile ? 'text-xs' : 'text-sm'} ${(totals.estimatedProfit || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                    />
                )}
            </div>
        </div>
    );

    if (isDesktop) {
        return (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] items-start mb-4">
                <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-[var(--shadow-hairline)]">
                    <p className="ui-kicker">Fechamento da proposta</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                        Ajuste desconto, medidas e PDF sem sair do atendimento.
                    </p>
                    <button
                        onClick={onOpenGeneralDiscountModal}
                        className="mt-3 inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm font-semibold text-[var(--text-body)] transition-colors duration-200 hover:bg-[var(--surface)] hover:text-[var(--text-strong)]"
                    >
                        <Percent className="h-4 w-4" aria-hidden="true" />
                        {hasGeneralDiscount ? 'Editar Ajuste Geral' : 'Adicionar Ajuste Geral'}
                    </button>
                </div>
                <TotalsBlock />
            </div>
        );
    }

    // Mobile layout
    return (
        <div className="space-y-3">
            <TotalsBlock isMobile />
            <button
                onClick={onOpenGeneralDiscountModal}
                className="w-full text-sm font-medium text-[var(--text-body)] bg-[var(--surface-muted)] hover:bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-control)] py-2 transition-colors duration-200 flex items-center justify-center gap-2"
            >
                <Percent className="h-4 w-4" aria-hidden="true" />
                {hasGeneralDiscount ? 'Editar Ajuste Geral' : 'Adicionar Ajuste Geral'}
            </button>
        </div>
    );
};

export default React.memo(SummaryBar);
