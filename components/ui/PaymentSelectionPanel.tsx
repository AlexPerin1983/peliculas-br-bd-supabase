import React from 'react';
import { Check, CreditCard, RotateCcw } from 'lucide-react';
import type { PaymentMethod, PaymentMethods, ProposalPaymentConfig } from '../../types';
import { getAvailableInstallments } from '../../src/lib/paymentConditions';

interface PaymentSelectionPanelProps {
    config: ProposalPaymentConfig;
    companyMethods: PaymentMethods;
    onChange: (config: ProposalPaymentConfig) => void;
    onReset?: () => void;
    hasOverride?: boolean;
}

const labels: Record<PaymentMethod['tipo'], string> = {
    pix: 'Pix',
    boleto: 'Boleto',
    parcelado_sem_juros: 'Cartão sem juros',
    parcelado_com_juros: 'Cartão com juros',
    adiantamento: 'Adiantamento',
    observacao: 'Observação',
};

export const PaymentSelectionPanel: React.FC<PaymentSelectionPanelProps> = ({
    config, companyMethods, onChange, onReset, hasOverride = false,
}) => {
    const configuredMethods = [
        ...companyMethods.filter(method => method.ativo),
        ...config.paymentMethods.filter(method => method.ativo && !companyMethods.some(company => company.tipo === method.tipo && company.ativo)),
    ];
    if (!configuredMethods.length) return null;

    const noInterest = config.paymentMethods.find(method => method.tipo === 'parcelado_sem_juros' && method.ativo);
    const noInterestSelected = noInterest ? getAvailableInstallments(noInterest) : [];
    const selectedInstallmentsFor = (method: PaymentMethod) => {
        const selected = getAvailableInstallments(method);
        return method.tipo === 'parcelado_com_juros' && !Array.isArray(method.selectedInstallments)
            ? selected.filter(count => !noInterestSelected.includes(count))
            : selected;
    };

    const updateMethod = (type: PaymentMethod['tipo'], update: (method: PaymentMethod) => PaymentMethod) => {
        const current = config.paymentMethods.find(method => method.tipo === type);
        const company = configuredMethods.find(method => method.tipo === type);
        if (!company) return;
        const next = update(current || { ...company });
        const exists = config.paymentMethods.some(method => method.tipo === type);
        onChange({
            ...config,
            paymentMethods: exists
                ? config.paymentMethods.map(method => method.tipo === type ? next : method)
                : [...config.paymentMethods, next],
        });
    };

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/50" aria-label="Condições de pagamento desta proposta">
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <CreditCard className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Pagamento no orçamento</h3>
                </div>
                {hasOverride && onReset && (
                    <button type="button" onClick={onReset} className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-300">
                        <RotateCcw className="h-3 w-3" aria-hidden="true" /> Padrão
                    </button>
                )}
            </div>
            <p className="mb-2 text-[10px] leading-4 text-slate-500 dark:text-slate-400">Escolha o que aparece no PDF e no link. A configuração da empresa não muda.</p>
            <div className="space-y-2">
                {configuredMethods.map(company => {
                    const method = config.paymentMethods.find(item => item.tipo === company.tipo) || company;
                    const active = !!method.ativo;
                    const isInstallment = company.tipo === 'parcelado_sem_juros' || company.tipo === 'parcelado_com_juros';
                    const available = isInstallment ? getAvailableInstallments(company) : [];
                    const selected = isInstallment && active ? selectedInstallmentsFor(method) : [];
                    return (
                        <div key={company.tipo} className="rounded-lg border border-slate-200 px-2.5 py-2 dark:border-slate-700">
                            <label className="flex min-h-7 cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={event => updateMethod(company.tipo, current => ({
                                        ...current,
                                        ativo: event.target.checked,
                                        selectedInstallments: isInstallment && event.target.checked && current.selectedInstallments?.length === 0
                                            ? undefined : current.selectedInstallments,
                                    }))}
                                    className="h-4 w-4 shrink-0 accent-blue-600"
                                    aria-label={labels[company.tipo]}
                                />
                                <span>{labels[company.tipo]}</span>
                                {isInstallment && <span className="ml-auto text-[10px] font-normal text-slate-500">{selected.length} de {available.length}x</span>}
                            </label>
                            {isInstallment && active && available.length > 0 && (
                                <div className="mt-2 grid grid-cols-6 gap-1.5" aria-label={`Parcelas ${labels[company.tipo]}`}>
                                    {available.map(count => {
                                        const checked = selected.includes(count);
                                        return (
                                            <button
                                                key={count}
                                                type="button"
                                                aria-label={`${count}x ${company.tipo === 'parcelado_sem_juros' ? 'sem juros' : 'com juros'}`}
                                                aria-pressed={checked}
                                                onClick={() => updateMethod(company.tipo, current => {
                                                    const currentSelected = selectedInstallmentsFor(current);
                                                    const nextSelected = checked
                                                        ? currentSelected.filter(value => value !== count)
                                                        : [...currentSelected, count].sort((a, b) => a - b);
                                                    return { ...current, ativo: nextSelected.length > 0, selectedInstallments: nextSelected };
                                                })}
                                                className={`flex min-h-9 items-center justify-center gap-0.5 rounded-md border text-[11px] font-bold transition-colors ${checked ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                                            >
                                                {checked && <Check className="h-3 w-3" aria-hidden="true" />}{count}x
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
};
