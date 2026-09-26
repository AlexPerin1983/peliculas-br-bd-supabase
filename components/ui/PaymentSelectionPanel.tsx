import React from 'react';
import { Check, CreditCard, RotateCcw } from 'lucide-react';
import type { PaymentMethod, PaymentMethods, ProposalPaymentConfig } from '../../types';
import { buildProposalPaymentOptions, getAvailableInstallments } from '../../src/lib/paymentConditions';

interface PaymentSelectionPanelProps {
    config: ProposalPaymentConfig;
    companyMethods: PaymentMethods;
    onChange: (config: ProposalPaymentConfig) => void;
    onReset?: () => void;
    hasOverride?: boolean;
    // Total do orçamento: mostra os valores que o cliente vai ver.
    total?: number;
}

const labels: Record<PaymentMethod['tipo'], string> = {
    pix: 'Pix',
    boleto: 'Boleto',
    parcelado_sem_juros: 'Cartão sem juros',
    parcelado_com_juros: 'Cartão com juros',
    adiantamento: 'Entrada',
    observacao: 'Observação',
};

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const isInstallmentType = (tipo: PaymentMethod['tipo']) => tipo === 'parcelado_sem_juros' || tipo === 'parcelado_com_juros';

// Última parcela sem juros oferecida (0 quando não há sem juros).
export const getNoInterestTop = (methods: PaymentMethods): number => {
    const noInterest = methods.find(method => method.tipo === 'parcelado_sem_juros' && method.ativo);
    const selected = noInterest ? getAvailableInstallments(noInterest) : [];
    return selected.length ? Math.max(...selected) : 0;
};

/**
 * Parcelas em faixa ("até"): tocar num número oferece da primeira parcela permitida até ele;
 * tocar de novo na última tira só ela. Com juros sempre começa depois do sem juros.
 */
export const pickInstallmentRange = (allowed: number[], current: number[], count: number): number[] => {
    const top = current.length ? Math.max(...current) : 0;
    const end = count === top ? count - 1 : count;
    return allowed.filter(value => value <= end);
};

export const PaymentSelectionPanel: React.FC<PaymentSelectionPanelProps> = ({
    config, companyMethods, onChange, onReset, hasOverride = false, total,
}) => {
    const configuredMethods = [
        ...companyMethods.filter(method => method.ativo),
        ...config.paymentMethods.filter(method => method.ativo && !companyMethods.some(company => company.tipo === method.tipo && company.ativo)),
    ];
    if (!configuredMethods.length) return null;

    const noInterestTop = getNoInterestTop(config.paymentMethods);
    // Mesma conta do PDF e do link.
    const options = total && total > 0 ? buildProposalPaymentOptions(total, config.paymentMethods) : [];
    const optionsFor = (tipo: PaymentMethod['tipo']) => options.filter(option => option.methodType === tipo);

    const allowedFor = (company: PaymentMethod) => {
        const available = getAvailableInstallments({ ...company, selectedInstallments: undefined });
        return company.tipo === 'parcelado_com_juros' ? available.filter(count => count > noInterestTop) : available;
    };
    const selectedFor = (method: PaymentMethod, company: PaymentMethod) => {
        const allowed = allowedFor(company);
        return getAvailableInstallments(method).filter(count => allowed.includes(count));
    };

    // Com juros acompanha o sem juros: de (fim do sem juros + 1) até a última escolhida.
    const alignWithInterest = (methods: PaymentMethods): PaymentMethods => {
        const top = getNoInterestTop(methods);
        return methods.map(method => {
            if (method.tipo !== 'parcelado_com_juros' || !Array.isArray(method.selectedInstallments)) return method;
            const company = configuredMethods.find(item => item.tipo === method.tipo) || method;
            const end = method.selectedInstallments.length ? Math.max(...method.selectedInstallments) : 0;
            const next = getAvailableInstallments({ ...company, selectedInstallments: undefined })
                .filter(count => count > top && count <= end);
            return { ...method, selectedInstallments: next, ativo: method.ativo && next.length > 0 };
        });
    };

    const updateMethod = (type: PaymentMethod['tipo'], update: (method: PaymentMethod) => PaymentMethod) => {
        const current = config.paymentMethods.find(method => method.tipo === type);
        const company = configuredMethods.find(method => method.tipo === type);
        if (!company) return;
        const next = update(current || { ...company });
        const exists = config.paymentMethods.some(method => method.tipo === type);
        const paymentMethods = exists
            ? config.paymentMethods.map(method => method.tipo === type ? next : method)
            : [...config.paymentMethods, next];
        onChange({ ...config, paymentMethods: alignWithInterest(paymentMethods) });
    };

    const simpleMethods = configuredMethods.filter(method => !isInstallmentType(method.tipo));
    const installmentMethods = configuredMethods.filter(method => isInstallmentType(method.tipo));

    const simpleValue = (method: PaymentMethod) => {
        if (method.tipo === 'pix' || method.tipo === 'boleto') {
            const option = optionsFor(method.tipo)[0];
            if (!option) return null;
            return option.discountPercent > 0 ? `${money(option.customerTotal)} (−${option.discountPercent}%)` : money(option.customerTotal);
        }
        if (method.tipo === 'adiantamento' && method.porcentagem) {
            return total && total > 0 ? `${method.porcentagem}% · ${money((total * Number(method.porcentagem)) / 100)}` : `${method.porcentagem}%`;
        }
        return null;
    };

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/50" aria-label="Condições de pagamento desta proposta">
            <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <CreditCard className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Pagamento no orçamento</h3>
                </div>
                {hasOverride && onReset && (
                    // Tamanho no contêiner: o `font: inherit` global ignora classes de texto nos botões.
                    <span className="shrink-0 text-[11px] font-semibold">
                        <button type="button" onClick={onReset} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/30">
                            <RotateCcw className="h-3 w-3" aria-hidden="true" /> Padrão
                        </button>
                    </span>
                )}
            </div>
            <p className="mb-2.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">Escolha o que aparece no PDF e no link. A configuração da empresa não muda.</p>

            {simpleMethods.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5 text-[12px] font-semibold" role="group" aria-label="Formas à vista">
                    {simpleMethods.map(company => {
                        const method = config.paymentMethods.find(item => item.tipo === company.tipo) || company;
                        const active = !!method.ativo;
                        const value = simpleValue(method);
                        return (
                            <button
                                key={company.tipo}
                                type="button"
                                aria-pressed={active}
                                aria-label={labels[company.tipo]}
                                onClick={() => updateMethod(company.tipo, current => ({ ...current, ativo: !active }))}
                                className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 transition-colors ${active
                                    ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-100'
                                    : 'border-slate-200 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}
                            >
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${active ? 'bg-blue-600 text-white' : 'border border-slate-300 dark:border-slate-500'}`}>
                                    {active && <Check className="h-3 w-3" aria-hidden="true" />}
                                </span>
                                {labels[company.tipo]}
                                {value && <span className={`font-medium tabular-nums ${active ? 'text-blue-700/80 dark:text-blue-200/80' : ''}`}>{value}</span>}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="space-y-2">
                {installmentMethods.map(company => {
                    const method = config.paymentMethods.find(item => item.tipo === company.tipo) || company;
                    const active = !!method.ativo;
                    const isNoInterest = company.tipo === 'parcelado_sem_juros';
                    const available = getAvailableInstallments({ ...company, selectedInstallments: undefined });
                    const allowed = allowedFor(company);
                    const selected = active ? selectedFor(method, company) : [];
                    const methodOptions = optionsFor(company.tipo);
                    const topOption = methodOptions.at(-1);
                    const blockedCount = available.length - allowed.length;
                    const summary = !active
                        ? 'fora do orçamento'
                        : selected.length === 0
                            ? isNoInterest ? 'escolha até quantas vezes' : blockedCount === available.length ? 'todas já são sem juros' : 'escolha até quantas vezes'
                            : isNoInterest
                                ? `até ${Math.max(...selected)}x${topOption ? ` de ${money(topOption.installmentValue)}` : ''}`
                                : selected.length === 1
                                    ? `${selected[0]}x`
                                    : `${selected[0]}x a ${Math.max(...selected)}x`;

                    return (
                        <div key={company.tipo} className="rounded-lg border border-slate-200 px-2.5 py-2 dark:border-slate-700">
                            <label className="flex min-h-7 cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={event => updateMethod(company.tipo, current => ({
                                        ...current,
                                        ativo: event.target.checked,
                                        selectedInstallments: event.target.checked && current.selectedInstallments?.length === 0
                                            ? undefined : current.selectedInstallments,
                                    }))}
                                    className="h-4 w-4 shrink-0 accent-blue-600"
                                    aria-label={labels[company.tipo]}
                                />
                                <span>{labels[company.tipo]}</span>
                                <span className={`ml-auto truncate text-right text-[11px] tabular-nums ${active && selected.length ? 'font-bold text-blue-700 dark:text-blue-300' : 'font-normal text-slate-400'}`}>
                                    {summary}
                                </span>
                            </label>

                            {active && available.length > 0 && (
                                <>
                                    <div className="mt-2 grid grid-cols-6 gap-1.5 text-[12px] font-bold" aria-label={`Parcelas ${labels[company.tipo]}`}>
                                        {available.map(count => {
                                            const blocked = !allowed.includes(count);
                                            const checked = selected.includes(count);
                                            return (
                                                <button
                                                    key={count}
                                                    type="button"
                                                    aria-label={`${count}x ${isNoInterest ? 'sem juros' : 'com juros'}${blocked ? ' (já é sem juros)' : ''}`}
                                                    aria-pressed={checked}
                                                    disabled={blocked}
                                                    onClick={() => updateMethod(company.tipo, current => {
                                                        const nextSelected = pickInstallmentRange(allowed, selectedFor(current, company), count);
                                                        return { ...current, ativo: nextSelected.length > 0, selectedInstallments: nextSelected };
                                                    })}
                                                    className={`flex h-8 items-center justify-center rounded-md border tabular-nums transition-colors ${blocked
                                                        ? 'cursor-not-allowed border-dashed border-slate-200 bg-transparent text-slate-300 dark:border-slate-700 dark:text-slate-600'
                                                        : checked
                                                            ? 'border-blue-500 bg-blue-600 text-white'
                                                            : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                                                >
                                                    {count}x
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {!isNoInterest && blockedCount > 0 && blockedCount < available.length && (
                                        <p className="mt-1.5 text-[10px] text-slate-400">Até {noInterestTop}x já é sem juros; com juros começa em {allowed[0]}x.</p>
                                    )}
                                    {!isNoInterest && methodOptions.length > 0 && (
                                        <p className="mt-1.5 text-[10px] leading-4 text-slate-600 dark:text-slate-300">
                                            {methodOptions.map(option => `${option.installments}x de ${money(option.installmentValue)}`).join(' · ')}
                                            {topOption && <span className="text-slate-400"> · total em {topOption.installments}x: {money(topOption.customerTotal)}</span>}
                                        </p>
                                    )}
                                    {isNoInterest && (
                                        <p className="mt-1.5 text-[10px] text-slate-400">Toque no número para oferecer até ele.</p>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
};
