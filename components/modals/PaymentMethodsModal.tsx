import React, { useState, useEffect, FormEvent } from 'react';
import { PaymentMethods, PaymentMethod } from '../../types';
import Modal from '../ui/Modal';
import Input from '../ui/Input';

interface PaymentMethodsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (methods: PaymentMethods) => Promise<void>;
    paymentMethods: PaymentMethods;
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
        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-300 dark:peer-focus:ring-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-800 dark:peer-checked:bg-slate-500"></div>
    </label>
);

const PaymentMethodsModal: React.FC<PaymentMethodsModalProps> = ({ isOpen, onClose, onSave, paymentMethods }) => {

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
            setIsSaving(false);
            setError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, paymentMethods]);

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
            await onSave(finalMethods);
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar formas de pagamento. Tente novamente.');
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
            <div className={`p-4 rounded-lg border transition-all duration-300 ${isActive ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 shadow-sm' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
                <div className="flex justify-between items-center">
                    <label htmlFor={`toggle-${String(methodKey)}`} className="font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none">{title}</label>
                    <ToggleSwitch
                        id={`toggle-${String(methodKey)}`}
                        checked={isActive}
                        onChange={checked => handleToggleChange(methodKey, checked)}
                    />
                </div>
                {isActive && children && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                        {children}
                    </div>
                )}
            </div>
        );
    };

    const footer = (
        <>
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
                Cancelar
            </button>
            <button
                type="submit"
                form="paymentMethodsForm"
                disabled={isSaving}
                className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-md hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2 min-w-[120px]"
            >
                {isSaving ? (
                    <>
                        <i className="fas fa-spinner fa-spin"></i>
                        <span>Salvando...</span>
                    </>
                ) : (
                    'Salvar Alterações'
                )}
            </button>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Formas de Pagamento" footer={footer}>
            <form id="paymentMethodsForm" onSubmit={handleSubmit} className="space-y-4">
                <fieldset disabled={isSaving} className="space-y-4">
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
                                        { value: 'aleatoria', label: 'Chave Aleatória' },
                                    ] as const).map(option => (
                                        <label key={option.value} className={`flex items-center p-3 rounded-md border hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer ${methods.pix.tipo_chave_pix === option.value ? 'bg-slate-100 dark:bg-slate-700 border-slate-400 dark:border-slate-500' : 'border-slate-200 dark:border-slate-600'}`}>
                                            <input
                                                type="radio"
                                                name="tipo_chave_pix"
                                                value={option.value}
                                                checked={methods.pix.tipo_chave_pix === option.value}
                                                onChange={() => handleInputChange('pix', 'tipo_chave_pix', option.value)}
                                                className="h-4 w-4 text-slate-800 border-slate-300 focus:ring-slate-500 dark:bg-slate-600 dark:border-slate-500"
                                            />
                                            <span className="ml-3 text-sm font-medium text-slate-800 dark:text-slate-200">{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <Input
                                id="nome_responsavel_pix"
                                label="Nome do Responsável:"
                                type="text"
                                value={methods.pix.nome_responsavel_pix || ''}
                                onChange={e => handleInputChange('pix', 'nome_responsavel_pix', (e.target as HTMLInputElement).value)}
                                placeholder="Nome completo do titular da chave"
                            />
                        </div>
                    ))}
                    {renderMethod('boleto', 'Boleto Bancário')}

                    {renderMethod('semJuros', 'Parcelado s/ Juros', (
                        <Input
                            id="parcelas_sem_juros"
                            label="Nº Máximo de Parcelas:"
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
                                label="Nº Máximo de Parcelas:"
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

                    {renderMethod('observacao', 'Adicionar Observação', (
                        <Input
                            as="textarea"
                            id="observacao_text"
                            label="Texto da Observação:"
                            placeholder="Ex: Condições especiais de pagamento..."
                            value={methods.observacao.texto || ''}
                            onChange={e => handleInputChange('observacao', 'texto', (e.target as HTMLTextAreaElement).value)}
                        />
                    ))}
                </fieldset>
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-md" role="alert">
                        {error}
                    </div>
                )}
            </form>
        </Modal>
    );
};

export default PaymentMethodsModal;