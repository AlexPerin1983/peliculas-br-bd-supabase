import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Client, Measurement, UserInfo, Film, SavedPDF, Agendamento, ProposalOption } from '../../types';
import { useProposalOptions } from '../hooks/useProposalOptions';
import { useMeasurements } from '../hooks/useMeasurements';
import { useNumpad } from '../hooks/useNumpad';
import MeasurementGroup from '../components/MeasurementGroup';
import ActionsBar from '../components/ActionsBar';
import SummaryBar from '../components/SummaryBar';
import Tooltip from '../components/ui/Tooltip';
import ColorPicker from '../components/ui/ColorPicker';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import DiscountModal from '../components/modals/DiscountModal';
import GeneralDiscountModal from '../components/modals/GeneralDiscountModal';
import PaymentMethodsModal from '../components/modals/PaymentMethodsModal';
import PdfHistoryModal from '../components/modals/PdfHistoryModal';
import SignatureModal from '../components/modals/SignatureModal';
import FilmSelectionModal from '../components/modals/FilmSelectionModal';
import FilmModal from '../components/modals/FilmModal';
import { useFilms } from '../hooks/useFilms';
import { usePDFs } from '../hooks/usePDFs';
import { useAgendamentos } from '../hooks/useAgendamentos';
import { useUserInfo } from '../hooks/useUserInfo';
import { usePWAInstallPrompt } from '../src/hooks/usePwaInstallPrompt';
import PwaDiagnostics from '../components/PwaDiagnostics';
import PwaQrCode from '../components/PwaQrCode';
import ApiKeyModal from '../components/modals/ApiKeyModal';
import { FormEvent } from 'react';

interface UserSettingsViewProps {
    userInfo: UserInfo;
    onSave: (info: UserInfo) => void;
    onOpenPaymentMethods: () => void;
    onOpenApiKeyModal: (provider: 'gemini' | 'openai') => void;
    isPwaInstalled: boolean;
    onPromptPwaInstall: () => void;
}

const UserSettingsView: React.FC<UserSettingsViewProps> = ({ 
    userInfo, 
    onSave, 
    onOpenPaymentMethods, 
    onOpenApiKeyModal,
    isPwaInstalled,
    onPromptPwaInstall
}) => {
    const [formData, setFormData] = useState<UserInfo>(userInfo);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [isClientSelectionModalOpen, setIsClientSelectionModalOpen] = useState(false);
    const [isGeneralDiscountModalOpen, setIsGeneralDiscountModalOpen] = useState(false);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [apiKeyProvider, setApiKeyProvider] = useState<'gemini' | 'openai'>('gemini');
    const [isPwaDiagnosticsOpen, setIsPwaDiagnosticsOpen] = useState(false);

    useEffect(() => {
        setFormData(userInfo);
    }, [userInfo]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };
    
    const handleColorChange = (colorType: 'primaria' | 'secundaria', value: string) => {
        setFormData(prev => ({
            ...prev,
            cores: {
                ...(prev.cores || { primaria: '#918B45', secundaria: '#4E6441' }),
                [colorType]: value
            }
        }));
    };
    
    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, logo: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveLogo = () => {
        setFormData(prev => ({ ...prev, logo: '' }));
    };

    const handleSaveSignature = (signatureDataUrl: string) => {
        setFormData(prev => ({ ...prev, assinatura: signatureDataUrl }));
        setIsSignatureModalOpen(false);
    };
    
    const handleSaveGeneralDiscount = (discount: { value: string; type: 'percentage' | 'fixed' }) => {
        setFormData(prev => ({
            ...prev,
            generalDiscount: discount
        }));
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        onSave(formData);
        setShowSuccess(true);
        setTimeout(() => {
            setShowSuccess(false);
            setIsSaving(false);
        }, 2000);
    };
    
    const handleWorkingDayChange = (dayIndex: number, checked: boolean) => {
        setFormData(prev => {
            const currentDays = prev.workingHours?.days || [];
            const newDays = checked
                ? [...currentDays, dayIndex]
                : currentDays.filter(d => d !== dayIndex);
            newDays.sort((a, b) => a - b);
            return {
                ...prev,
                workingHours: {
                    ...(prev.workingHours || { start: '08:00', end: '18:00', days: [] }),
                    days: newDays,
                }
            };
        });
    };

    const handleWorkingTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        const field = id.split('-')[1] as 'start' | 'end';

        setFormData(prev => ({
            ...prev,
            workingHours: {
                ...(prev.workingHours || { start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] }),
                [field]: value,
            }
        }));
    };
    
    const handleAddEmployee = () => {
        const newEmployeeName = (document.getElementById('newEmployeeName') as HTMLInputElement).value;
        if (newEmployeeName.trim()) {
            setFormData(prev => ({
                ...prev,
                employees: [
                    ...(prev.employees || []),
                    { id: Date.now(), nome: newEmployeeName.trim() }
                ]
            }));
            (document.getElementById('newEmployeeName') as HTMLInputElement).value = '';
        }
    };

    const handleRemoveEmployee = (id: number) => {
        setFormData(prev => ({
            ...prev,
            employees: (prev.employees || []).filter(emp => emp.id !== id)
        }));
    };
    
    const handleSaveApiKey = (apiKey: string) => {
        setFormData(prev => ({
            ...prev,
            aiConfig: {
                ...(prev.aiConfig || { provider: 'gemini' }),
                apiKey: apiKey,
            }
        }));
        setIsApiKeyModalOpen(false);
    };
    
    const handleProviderChange = (provider: 'gemini' | 'openai') => {
        setFormData(prev => ({
            ...prev,
            aiConfig: {
                ...(prev.aiConfig || { apiKey: '' }),
                provider: provider,
            }
        }));
    };

    const labelClass = "block text-sm font-medium text-slate-700 mb-1";
    const sectionTitleClass = "text-lg font-semibold text-slate-800";
    const sectionClass = "pt-6 mt-6 border-t border-slate-200";

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <form id="userSettingsForm" onSubmit={handleSubmit} className="space-y-6">
                <div className={sectionClass}>
                    <h3 className={sectionTitleClass}>Dados da Empresa</h3>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input id="empresa" label="Nome da Empresa" type="text" value={formData.empresa} onChange={handleChange} required />
                        <Input id="nome" label="Seu Nome" type="text" value={formData.nome} onChange={handleChange} required />
                        <Input id="telefone" label="Telefone" type="tel" value={formData.telefone} onChange={handleChange} required placeholder="(XX) XXXXX-XXXX" maxLength={15} />
                        <Input id="email" label="Email" type="email" value={formData.email} onChange={handleChange} required />
                    </div>
                    <div className="mt-4">
                        <Input id="endereco" label="Endereço" type="text" value={formData.endereco} onChange={handleChange} required />
                    </div>
                </div>

                <div className={sectionClass}>
                    <h3 className={sectionTitleClass}>Personalização do Orçamento</h3>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
                        <div className="md:col-span-3">
                            <label className={labelClass}>Logotipo</label>
                            <div className="mt-1 flex flex-col justify-center items-center p-6 border-2 border-slate-300 border-dashed rounded-lg h-full min-h-[150px]">
                                {formData.logo ? (
                                    <>
                                        <img src={formData.logo} alt="Preview do logotipo" className="mx-auto max-h-24 w-auto rounded" />
                                        <div className="flex text-sm justify-center gap-4 pt-4 mt-2">
                                            <label htmlFor="logo-upload-input" className="relative cursor-pointer bg-white rounded-md font-medium text-slate-700 hover:text-slate-900 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-slate-500">
                                                <span>Alterar</span>
                                                <input id="logo-upload-input" name="logo-upload-input" type="file" className="sr-only" accept="image/*" onChange={handleLogoChange} />
                                            </label>
                                            <button type="button" onClick={handleRemoveLogo} className="font-medium text-red-600 hover:text-red-800">
                                                Remover
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                     <div className="space-y-1 text-center">
                                        <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <div className="flex text-sm text-slate-600 justify-center">
                                            <label htmlFor="logo-upload-input" className="relative cursor-pointer bg-white rounded-md font-medium text-slate-700 hover:text-slate-900 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-slate-500">
                                                <span>Envie um arquivo</span>
                                                <input id="logo-upload-input" name="logo-upload-input" type="file" className="sr-only" accept="image/*" onChange={handleLogoChange} />
                                            </label>
                                        </div>
                                        <p className="text-xs text-slate-500">PNG, JPG até 2MB</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className={labelClass}>Cores</label>
                            <div className="mt-1 space-y-2">
                                <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <ColorPicker 
                                            color={formData.cores?.primaria || '#918B45'} 
                                            onChange={(value) => handleColorChange('primaria', value)} 
                                        />
                                        <div>
                                            <p className="font-medium text-slate-800">Primária</p>
                                            <p className="text-sm text-slate-500 uppercase font-mono">{formData.cores?.primaria || '#918B45'}</p>
                                        </div>
                                    </div>
                                </div>
                                 <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-3">
                                         <ColorPicker 
                                            color={formData.cores?.secundaria || '#4E6441'} 
                                            onChange={(value) => handleColorChange('secundaria', value)} 
                                        />
                                        <div>
                                            <p className="font-medium text-slate-800">Secundária</p>
                                            <p className="text-sm text-slate-500 uppercase font-mono">{formData.cores?.secundaria || '#4E6441'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={sectionClass}>
                    <h3 className={sectionTitleClass}>Configurações Gerais</h3>
                     <div className="mt-4 space-y-4">
                        <Input
                            id="proposalValidityDays"
                            label="Validade da Proposta (dias)"
                            type="number"
                            value={formData.proposalValidityDays ?? ''}
                            onChange={handleChange}
                            placeholder="Ex: 60"
                            min="1"
                        />
                        <Input
                            id="prazoPagamento"
                            label="Prazo de Pagamento"
                            type="text"
                            value={formData.prazoPagamento || ''}
                            onChange={handleChange}
                            placeholder="Ex: Pagamento imediato após a instalação"
                        />
                         <button
                            type="button"
                            onClick={onOpenPaymentMethods}
                            className="w-full px-4 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                            aria-label="Configurar Formas de Pagamento"
                        >
                            <i className="fas fa-dollar-sign"></i>
                            Configurar Formas de Pagamento
                        </button>
                     </div>
                </div>

                <div className={sectionClass}>
                    <h3 className={sectionTitleClass}>Assinatura Digital</h3>
                    <p className="text-sm text-slate-500 mt-2">
                        Crie uma assinatura para ser incluída automaticamente nos seus orçamentos em PDF.
                    </p>
                    <div className="mt-4 p-4 border-2 border-slate-200 border-dashed rounded-lg flex flex-col items-center justify-center min-h-[120px]">
                        {formData.assinatura ? (
                            <>
                                <img src={formData.assinatura} alt="Assinatura salva" className="max-h-20 max-w-full" />
                                <div className="mt-4 flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsSignatureModalOpen(true)}
                                        className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
                                    >
                                        Alterar Assinatura
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({...prev, assinatura: ''}))}
                                        className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                        Remover
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-slate-500 mb-4">Nenhuma assinatura salva.</p>
                                 <button
                                    type="button"
                                    onClick={() => setIsSignatureModalOpen(true)}
                                    className="px-5 py-2.5 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition duration-300 shadow-sm flex items-center justify-center gap-2"
                                >
                                    <i className="fas fa-signature"></i>
                                    Criar Assinatura
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className={sectionClass}>
                    <h3 className={sectionTitleClass}>Horário de Funcionamento</h3>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input id="workingHours-start" label="Início do Expediente" type="time" value={formData.workingHours?.start || '08:00'} onChange={handleWorkingTimeChange} />
                        <Input id="workingHours-end" label="Fim do Expediente" type="time" value={formData.workingHours?.end || '18:00'} onChange={handleWorkingTimeChange} />
                    </div>
                    <div className="mt-4">
                        <label className={labelClass}>Dias da Semana</label>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                            {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((dayName, index) => (
                                <label key={index} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.workingHours?.days?.includes(index) || false}
                                        onChange={(e) => handleWorkingDayChange(index, e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-slate-600 focus:ring-slate-500"
                                    />
                                    <span className="text-sm text-slate-700">{dayName}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className={sectionClass}>
                    <h3 className={sectionTitleClass}>Equipe ({formData.employees?.length || 0})</h3>
                    <p className="text-sm text-slate-500 mt-2">
                        A quantidade de colaboradores define quantos agendamentos podem ser feitos no mesmo horário.
                    </p>
                    <div className="mt-4 space-y-3">
                        {(formData.employees || []).map(employee => (
                            <div key={employee.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                <span className="text-slate-800 font-medium">{employee.nome}</span>
                                <button type="button" onClick={() => handleRemoveEmployee(employee.id)} className="text-red-500 hover:text-red-700 h-8 w-8 rounded-full flex items-center justify-center hover:bg-red-50">
                                    <i className="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        ))}
                        <div className="flex items-center gap-2 pt-2">
                            <Input
                                id="newEmployeeName"
                                label=""
                                type="text"
                                placeholder="Nome do colaborador"
                            />
                            <button
                                type="button"
                                onClick={handleAddEmployee}
                                className="px-4 py-2.5 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors"
                            >
                                Adicionar
                            </button>
                        </div>
                    </div>
                </div>

                <div className={sectionClass}>
                    <h3 className={sectionTitleClass}>Inteligência Artificial (IA)</h3>
                    <p className="text-sm text-slate-500 mt-2">
                        Escolha o provedor de IA e configure sua chave de API para habilitar funcionalidades como o preenchimento automático de medidas.
                    </p>
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-xs text-yellow-800 font-medium">
                            ⚠️ <strong>Aviso de Responsabilidade:</strong> Se você configurar uma chave de API, os dados de medidas ou clientes serão enviados ao provedor de IA escolhido para processamento. O custo e a responsabilidade pelo uso da API são inteiramente do usuário. Não controlamos as políticas de privacidade de serviços de terceiros.
                        </p>
                    </div>
                    <div className="mt-4">
                        <label className={labelClass}>Provedor de IA</label>
                        <div className="flex space-x-2 p-1 bg-slate-100 rounded-lg mt-1">
                            <button
                                type="button"
                                onClick={() => handleProviderChange('gemini')}
                                className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${formData.aiConfig?.provider === 'gemini' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                            >
                                Google Gemini
                            </button>
                            <button
                                type="button"
                                onClick={() => handleProviderChange('openai')}
                                className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${formData.aiConfig?.provider === 'openai' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                            >
                                OpenAI
                            </button>
                        </div>
                    </div>
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={() => onOpenApiKeyModal(formData.aiConfig?.provider || 'gemini')}
                            className="w-full px-4 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                        >
                            <i className="fas fa-key"></i>
                            {formData.aiConfig?.apiKey ? 'Alterar Chave de API' : 'Configurar Chave de API'}
                        </button>
                    </div>
                </div>

                <div className={sectionClass}>
                    <h3 className={sectionTitleClass}>PWA (Instalação)</h3>
                    <p className="text-sm text-slate-500 mt-2">
                        Instale o aplicativo no seu dispositivo para acesso rápido e uso offline.
                    </p>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* PwaQrCode Component Placeholder */}
                        <div className="text-center p-4 bg-white rounded-lg border border-slate-200">QR Code Placeholder</div>
                        <div className="space-y-4">
                            {/* Iframe warning placeholder */}
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <i className="fas fa-exclamation-triangle text-yellow-600 mt-0.5"></i>
                                    <div className="flex-1">
                                        <p className="text-sm text-yellow-800 font-medium">App rodando em iframe</p>
                                        <p className="text-xs text-yellow-700 mt-1">
                                            PWAs não podem ser instalados de dentro de iframes. Abra em nova janela para instalar.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => { /* Implementar abrir em nova janela */ }}
                                            className="mt-2 px-3 py-1.5 bg-yellow-600 text-white text-xs font-semibold rounded-md hover:bg-yellow-700 transition-colors flex items-center gap-1"
                                        >
                                            <i className="fas fa-external-link-alt"></i>
                                            Abrir em Nova Janela
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            {/* PWA Install Button Placeholder */}
                            <button
                                type="button"
                                onClick={onPromptPwaInstall}
                                disabled={isPwaInstalled || !deferredPrompt}
                                className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-md disabled:bg-blue-400 disabled:cursor-not-allowed"
                            >
                                <i className="fas fa-download"></i>
                                Instalar Aplicativo
                            </button>
                            
                            {/* Privacy Policy Link Placeholder */}
                            <a
                                href="/privacy-policy"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full px-4 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-sm"
                            >
                                <i className="fas fa-shield-alt"></i>
                                Ver Política de Privacidade
                            </a>
                        </div>
                    </div>
                    
                    {/* PwaDiagnostics Placeholder */}
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <i className="fas fa-stethoscope"></i>
                            Diagnóstico PWA
                        </h4>
                        <div className="text-xs text-slate-500">Diagnóstico oculto.</div>
                    </div>
                </div>
            </form>

            <div className={`${sectionClass} flex justify-end items-center`}>
                <div className="flex items-center gap-4">
                    <div className="text-green-600 font-medium text-sm flex items-center gap-2 transition-opacity duration-300">
                        <i className="fas fa-check-circle"></i>
                        <span>{isSaving ? 'Salvando...' : 'Pronto'}</span>
                    </div>
                    <button
                        type="submit"
                        form="userSettingsForm"
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:bg-slate-500 disabled:cursor-wait min-w-[170px] text-center"
                    >
                         {isSaving ? <div className="loader-sm mx-auto"></div> : 'Salvar Configurações'}
                    </button>
                </div>
            </div>
            
            {showSuccess && (
                <div className="fixed bottom-4 right-4 p-3 bg-green-500 text-white rounded-lg shadow-lg z-50 animate-fade-in-up">
                    Configurações salvas com sucesso!
                </div>
            )}

            <style jsx>{`
                .loader-sm {
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #fff;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default UserSettingsView;