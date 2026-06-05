import React, { useState, useEffect, FormEvent } from 'react';
import { PaymentMethods, PaymentMethod } from '../../types';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import Input from '../ui/Input';

interface PaymentMethodsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (methods: PaymentMethods, options?: { prazoPagamento: string }) => Promise<void> | void;
    paymentMethods: PaymentMethods;
    prazoPagamento?: string;
    title?: string;
    description?: string;
    saveLabel?: string;
    onResetToDefault?: () => Promise<void> | void;
    resetLabel?: string;
    showPrazoPagamentoField?: boolean;
}

const ToggleSwitch: React.FC<{ id: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ id, checked, onChange }) => (
    <label htmlFor={id} className="relative inline-flex items-center cursor-pointer">
        <input
            type="checkbox"
            id={id}
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
        />
        <div className="peer h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-slate-950 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/10 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-slate-700 dark:peer-checked:bg-slate-100"></div>
    </label>
);

const PaymentMethodsModal: React.FC<PaymentMethodsModalProps> = ({
    isOpen,
    onClose,
    onSave,
    paymentMethods,
    prazoPagamento = '',
    title = 'Formas de Pagamento',
    description,
    saveLabel = 'Salvar Alteracoes',
    onResetToDefault,
    resetLabel = 'Usar padrão da empresa',
    showPrazoPagamentoField = false
}) => {

    const getMethod = (type: PaymentMethod['tipo']): Partial<PaymentMethod> => {
        return paymentMethods.find(m => m.tipo === type) || { ativo: false };
    };

    const [methods, setMethods] = useState({
        pix: getMethod('pix'),
        boleto: getMethod('boleto'),
        semJuros: getMethod('parcelado_sem_juros'),
        comJuros: getMethod('parcelado_com_juros'),
        adiantamento: getMethod('adiantamento'),
        observacao: getMethod('observacao')
    });
    const [prazoPagamentoValue, setPrazoPagamentoValue] = useState(prazoPagamento);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setMethods({
                pix: getMethod('pix'),
                boleto: getMethod('boleto'),
                semJuros: getMethod('parcelado_sem_juros'),
                comJuros: getMethod('parcelado_com_juros'),
                adiantamento: getMethod('adiantamento'),
                observacao: getMethod('observacao')
            });
            setPrazoPagamentoValue(prazoPagamento);
            setIsSaving(false);
            setError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, paymentMethods, prazoPagamento]);

    const handleToggleChange = (methodKey: keyof typeof methods, checked: boolean) => {
        setMethods(prev => ({ ...prev, [methodKey]: { ...prev[methodKey], ativo: checked } }));
    };

    const handleInputChange = (methodKey: keyof typeof methods, field: keyof PaymentMethod, value: any) => {
        setMethods(prev => ({ ...prev, [methodKey]: { ...prev[methodKey], [field]: value } }));
    };

    const handleNumericInputChange = (
        methodKey: keyof typeof methods,
        field: 'parcelas_max' | 'juros' | 'porcentagem',
        value: string,
        isFloat: boolean = false
    ) => {
        const sanitized = value.replace(/[^0-9,.]/g, '').replace(',', '.');
        if (sanitized === '' || sanitized === '.') {
            handleInputChange(methodKey, field, null);
            return;
        }
        const numValue = isFloat ? parseFloat(sanitized) : parseInt(sanitized, 10);
        if (!isNaN(numValue) && numValue >= 0) {
            handleInputChange(methodKey, field, numValue);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isSaving) return;

        const finalMethods: PaymentMethods = [
            { tipo: 'pix', ...methods.pix, ativo: !!methods.pix.ativo },
            { tipo: 'boleto', ...methods.boleto, ativo: !!methods.boleto.ativo },
            { tipo: 'parcelado_sem_juros', ...methods.semJuros, ativo: !!methods.semJuros.ativo },
            { tipo: 'parcelado_com_juros', ...methods.comJuros, ativo: !!methods.comJuros.ativo },
            { tipo: 'adiantamento', ...methods.adiantamento, ativo: !!methods.adiantamento.ativo },
            { tipo: 'observacao', ...methods.observacao, ativo: !!methods.observacao.ativo },
        ];

        setIsSaving(true);
        setError(null);
        try {
            await onSave(finalMethods, { prazoPagamento: prazoPagamentoValue.trim() });
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar formas de pagamento. Tente novamente.');
            setIsSaving(false);
        }
    };

    const handleResetToDefault = async () => {
        if (!onResetToDefault || isSaving) return;

        setIsSaving(true);
        setError(null);
        try {
            await onResetToDefault();
        } catch (err: any) {
            setError(err.message || 'Erro ao restaurar o padrao da empresa.');
            setIsSaving(false);
        }
    };

    const renderMethod = (
        methodKey: keyof typeof methods,
        title: string,
        children?: React.ReactNode
    ) => {
        const method = methods[methodKey];
        const isActive = !!method.ativo;

        return (
            <div className={`rounded-[var(--radius-panel)] border p-4 transition-all duration-300 ${isActive ? 'border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-hairline)]' : 'border-[var(--border-subtle)] bg-[var(--surface-muted)]'}`}>
                <div className="flex justify-between items-center">
                    <label htmlFor={`toggle-${String(methodKey)}`} className="cursor-pointer select-none font-bold text-[var(--text-strong)]">{title}</label>
                    <ToggleSwitch
                        id={`toggle-${String(methodKey)}`}
                        checked={isActive}
                        onChange={checked => handleToggleChange(methodKey, checked)}
                    />
                </div>
                {isActive && children && (
                    <div className="mt-4 space-y-3 border-t border-[var(--border-subtle)] pt-4">
                        {children}
                    </div>
                )}
            </div>
        );
    };

    const footer = (
        <>
            {onResetToDefault && (
                <ActionButton onClick={handleResetToDefault} disabled={isSaving} variant="secondary" size="sm" className="mr-auto">
                    {resetLabel}
                </ActionButton>
            )}
            <ActionButton onClick={onClose} disabled={isSaving} variant="ghost" size="sm">
                Cancelar
            </ActionButton>
            <ActionButton
                type="submit"
                form="paymentMethodsForm"
                disabled={isSaving}
                loading={isSaving}
                loadingText="Salvando..."
                variant="primary"
                size="sm"
            >
                {saveLabel}
            </ActionButton>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={isSaving ? () => {} : onClose} title={title} footer={footer} disableClose={isSaving} fullScreenOnMobile>
            <form id="paymentMethodsForm" onSubmit={handleSubmit} className="space-y-4">
                <fieldset disabled={isSaving} className="space-y-4">
                    {description && (
                        <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-relaxed text-[var(--text-muted)]">
                            {description}
                        </div>
                    )}

                    {showPrazoPagamentoField && (
                        <Input
                            id="prazo_pagamento_override"
                            label="Prazo de Pagamento:"
                            type="text"
                            value={prazoPagamentoValue}
                            onChange={e => setPrazoPagamentoValue((e.target as HTMLInputElement).value)}
                            placeholder="Ex: 50% na entrada e saldo na instalação"
                        />
                    )}

                    {renderMethod('pix', 'Pix', (
                        <div className="space-y-3">
                            <Input
                                id="chave_pix"
                                label="Chave Pix:"
                                type="text"
                                value={methods.pix.chave_pix || ''}
                                onChange={e => handleInputChange('pix', 'chave_pix', (e.target as HTMLInputElement).value)}
                                placeholder="Digite a chave Pix"
                            />
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo da Chave:</label>
                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {([
                                        { value: 'cpf', label: 'CPF' },
                                        { value: 'cnpj', label: 'CNPJ' },
                                        { value: 'telefone', label: 'Telefone' },
                                        { value: 'email', label: 'Email' },
                                        { value: 'aleatoria', label: 'Chave Aleatoria' },
                                    ] as const).map(option => (
                                        <label key={option.value} className={`flex cursor-pointer items-center rounded-[var(--radius-control)] border p-3 transition-colors hover:bg-[var(--surface-muted)] ${methods.pix.tipo_chave_pix === option.value ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]' : 'border-[var(--border-subtle)]'}`}>
                                            <input
                                                type="radio"
                                                name="tipo_chave_pix"
                                                value={option.value}
                                                checked={methods.pix.tipo_chave_pix === option.value}
                                                onChange={() => handleInputChange('pix', 'tipo_chave_pix', option.value)}
                                                className="h-4 w-4 text-slate-800 border-slate-300 focus:ring-slate-500 dark:bg-slate-600 dark:border-slate-500"
                                            />
                                            <span className="ml-3 text-sm font-semibold text-[var(--text-strong)]">{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <Input
                                id="nome_responsavel_pix"
                                label="Nome do Responsavel:"
                                type="text"
                                value={methods.pix.nome_responsavel_pix || ''}
                                onChange={e => handleInputChange('pix', 'nome_responsavel_pix', (e.target as HTMLInputElement).value)}
                                placeholder="Nome completo do titular da chave"
                            />
                        </div>
                    ))}
                    {renderMethod('boleto', 'Boleto Bancario')}

                    {renderMethod('semJuros', 'Parcelado s/ Juros', (
                        <Input
                            id="parcelas_sem_juros"
                            label="N Maximo de Parcelas:"
                            type="number"
                            min="1"
                            step="1"
                            value={String(methods.semJuros.parcelas_max || '')}
                            onChange={e => handleNumericInputChange('semJuros', 'parcelas_max', e.target.value)}
                        />
                    ))}

                    {renderMethod('comJuros', 'Parcelado c/ Juros', (
                        <div className="grid grid-cols-2 gap-3 items-end">
                            <Input
                                id="parcelas_com_juros"
                                label="N Maximo de Parcelas:"
                                type="number"
                                min="1"
                                step="1"
                                value={String(methods.comJuros.parcelas_max || '')}
                                onChange={e => handleNumericInputChange('comJuros', 'parcelas_max', e.target.value)}
                            />
                            <Input
                                id="taxa_juros"
                                label="Taxa de Juros (%):"
                                type="number"
                                step="0.01"
                                min="0"
                                value={String(methods.comJuros.juros ?? '')}
                                onChange={e => handleNumericInputChange('comJuros', 'juros', e.target.value, true)}
                            />
                        </div>
                    ))}

                    {renderMethod('adiantamento', 'Solicitar Adiantamento', (
                        <Input
                            id="porcentagem_adiantamento"
                            label="Porcentagem de Adiantamento (%):"
                            type="number"
                            min="1"
                            max="100"
                            value={String(methods.adiantamento.porcentagem ?? '')}
                            onChange={e => handleNumericInputChange('adiantamento', 'porcentagem', e.target.value, true)}
                        />
                    ))}

                    {renderMethod('observacao', 'Adicionar Observacao', (
                        <Input
                            as="textarea"
                            id="observacao_text"
                            label="Texto da Observacao:"
                            placeholder="Ex: Condicoes especiais de pagamento..."
                            value={methods.observacao.texto || ''}
                            onChange={e => handleInputChange('observacao', 'texto', (e.target as HTMLTextAreaElement).value)}
                        />
                    ))}
                </fieldset>
                {error && (
                    <div className="rounded-[var(--radius-control)] border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
                        {error}
                    </div>
                )}
            </form>
        </Modal>
    );
};

export default PaymentMethodsModal;
