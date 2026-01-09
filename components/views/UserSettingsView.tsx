import React, { useState, useEffect, FormEvent } from 'react';
import { UserInfo } from '../../types';
import Input from '../ui/Input';
import ColorPicker from '../ui/ColorPicker';
import SignatureModal from '../modals/SignatureModal';
import TeamManagement from '../TeamManagement';


interface UserSettingsViewProps {
    userInfo: UserInfo;
    onSave: (userInfo: UserInfo) => void;
    onOpenPaymentMethods: () => void;
    onOpenApiKeyModal: (provider: 'gemini' | 'openai' | 'local_ocr') => void;
    isPwaInstalled: boolean;
    onPromptPwaInstall: () => void;
}

const applyPhoneMask = (value: string) => {
    if (!value) return "";

    let digitsOnly = value.replace(/\D/g, "");

    if (digitsOnly.length > 11) {
        digitsOnly = digitsOnly.slice(0, 11);
    }

    if (digitsOnly.length > 10) {
        return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 7)}-${digitsOnly.slice(7)}`;
    }
    if (digitsOnly.length > 6) {
        return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 6)}-${digitsOnly.slice(6)}`;
    }
    if (digitsOnly.length > 2) {
        return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2)}`;
    }
    if (digitsOnly.length > 0) {
        return `(${digitsOnly}`;
    }
    return "";
};

const applyCpfCnpjMask = (value: string) => {
    if (!value) return "";
    const digitsOnly = value.replace(/\D/g, "");
    if (digitsOnly.length <= 11) {
        return digitsOnly.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').slice(0, 14);
    } else {
        return digitsOnly.slice(0, 14).replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})/, '$1-$2');
    }
};

import { useTheme } from '../../src/contexts/ThemeContext';

const UserSettingsView: React.FC<UserSettingsViewProps> = ({ userInfo, onSave, onOpenPaymentMethods, onOpenApiKeyModal, isPwaInstalled, onPromptPwaInstall }) => {
    const { theme, toggleTheme } = useTheme();
    const [formData, setFormData] = useState<UserInfo>(userInfo);
    const [logoPreview, setLogoPreview] = useState<string | undefined>(userInfo.logo);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [newEmployeeName, setNewEmployeeName] = useState('');
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [showDiagnostics, setShowDiagnostics] = useState(false);
    const [isInIframe, setIsInIframe] = useState(false);


    useEffect(() => {
        // Check if running in iframe
        setIsInIframe(window.self !== window.top);

        setFormData(prev => ({
            ...userInfo,
            cpfCnpj: applyCpfCnpjMask(userInfo.cpfCnpj || '') // Aplica máscara ao carregar
        }));
        setLogoPreview(userInfo.logo);
    }, [userInfo]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        if (id === 'telefone') {
            setFormData(prev => ({ ...prev, [id]: applyPhoneMask(value) }));
        } else if (id === 'cpfCnpj') {
            setFormData(prev => ({ ...prev, [id]: applyCpfCnpjMask(value) }));
        } else if (id === 'proposalValidityDays') {
            const numValue = parseInt(value, 10);
            setFormData(prev => ({ ...prev, [id]: isNaN(numValue) || numValue < 1 ? undefined : numValue }));
        } else {
            setFormData(prev => ({ ...prev, [id]: value }));
        }
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
                const base64String = reader.result as string;
                setFormData(prev => ({ ...prev, logo: base64String }));
                setLogoPreview(base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveLogo = () => {
        setFormData(prev => ({ ...prev, logo: '' }));
        setLogoPreview('');
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await (onSave(formData) || Promise.resolve());
        setIsSaving(false);
        setShowSuccess(true);
        setTimeout(() => {
            setShowSuccess(false);
        }, 3000);
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
        if (newEmployeeName.trim()) {
            setFormData(prev => ({
                ...prev,
                employees: [
                    ...(prev.employees || []),
                    { id: Date.now(), nome: newEmployeeName.trim() }
                ]
            }));
            setNewEmployeeName('');
        }
    };

    const handleRemoveEmployee = (id: number) => {
        setFormData(prev => ({
            ...prev,
            employees: (prev.employees || []).filter(emp => emp.id !== id)
        }));
    };

    const handleSaveSignature = (signatureDataUrl: string) => {
        setFormData(prev => ({ ...prev, assinatura: signatureDataUrl }));
        setIsSignatureModalOpen(false);
    };

    const handleProviderChange = (provider: 'gemini' | 'openai' | 'local_ocr') => {
        setFormData(prev => ({
            ...prev,
            aiConfig: {
                ...(prev.aiConfig || { apiKey: '' }),
                provider: provider,
            }
        }));
    };

    const handleOpenInNewWindow = () => {
        window.open(window.location.href, '_blank');
    };

    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";
    const sectionTitleClass = "text-lg font-semibold text-slate-800 dark:text-slate-200";
    const sectionClass = "pt-6 mt-6 border-t border-slate-200 dark:border-slate-700";

    return (
        <form id="userForm" onSubmit={handleSubmit} className="space-y-6 p-1">
            <div className="space-y-4">
                <Input id="cpfCnpj" label="CPF/CNPJ" type="text" value={formData.cpfCnpj} onChange={handleChange} required inputMode="numeric" />
                <Input id="site" label="Site" type="text" value={formData.site || ''} onChange={handleChange} placeholder="www.suaempresa.com.br" />
            </div>

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
                        <div className="mt-1 flex flex-col justify-center items-center p-6 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-lg h-full min-h-[200px] dark:bg-slate-800">
                            {logoPreview ? (
                                <>
                                    <img src={logoPreview} alt="Preview do logotipo" className="mx-auto max-h-24 w-auto rounded" />
                                    <div className="flex text-sm justify-center gap-4 pt-4 mt-2">
                                        <label htmlFor="logo-upload-input" className="relative cursor-pointer bg-white dark:bg-slate-700 rounded-md font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-slate-500">
                                            <span>Alterar</span>
                                            <input id="logo-upload-input" name="logo-upload-input" type="file" className="sr-only" accept="image/*" onChange={handleLogoChange} />
                                        </label>
                                        <button type="button" onClick={handleRemoveLogo} className="font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
                                            Remover
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-1 text-center">
                                    <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <div className="flex text-sm text-slate-600 dark:text-slate-400 justify-center">
                                        <label htmlFor="logo-upload-input" className="relative cursor-pointer bg-white dark:bg-slate-700 rounded-md font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-slate-500">
                                            <span>Envie um arquivo</span>
                                            <input id="logo-upload-input" name="logo-upload-input" type="file" className="sr-only" accept="image/*" onChange={handleLogoChange} />
                                        </label>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPG até 2MB</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className={labelClass}>Cores</label>
                        <div className="mt-1 space-y-2">
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <ColorPicker
                                        color={formData.cores?.primaria || '#918B45'}
                                        onChange={(value) => handleColorChange('primaria', value)}
                                    />
                                    <div>
                                        <p className="font-medium text-slate-800 dark:text-slate-200">Primária</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 uppercase font-mono">{formData.cores?.primaria || '#918B45'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <ColorPicker
                                        color={formData.cores?.secundaria || '#4E6441'}
                                        onChange={(value) => handleColorChange('secundaria', value)}
                                    />
                                    <div>
                                        <p className="font-medium text-slate-800 dark:text-slate-200">Secundária</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 uppercase font-mono">{formData.cores?.secundaria || '#4E6441'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {/* Redes Sociais e Avaliações */}
            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Redes Sociais e Avaliações</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Adicione seus links para facilitar o compartilhamento e pedir avaliações.
                </p>
                <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                        </div>
                        <input type="url" placeholder="https://facebook.com/sua-pagina" value={formData.socialLinks?.facebook || ''} onChange={(e) => setFormData(prev => ({ ...prev, socialLinks: { ...prev.socialLinks, facebook: e.target.value } }))} className="flex-1 p-3 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                        </div>
                        <input type="url" placeholder="https://instagram.com/seu-perfil" value={formData.socialLinks?.instagram || ''} onChange={(e) => setFormData(prev => ({ ...prev, socialLinks: { ...prev.socialLinks, instagram: e.target.value } }))} className="flex-1 p-3 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg>
                        </div>
                        <input type="url" placeholder="https://tiktok.com/@seu-usuario" value={formData.socialLinks?.tiktok || ''} onChange={(e) => setFormData(prev => ({ ...prev, socialLinks: { ...prev.socialLinks, tiktok: e.target.value } }))} className="flex-1 p-3 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                        </div>
                        <input type="url" placeholder="https://youtube.com/@seu-canal" value={formData.socialLinks?.youtube || ''} onChange={(e) => setFormData(prev => ({ ...prev, socialLinks: { ...prev.socialLinks, youtube: e.target.value } }))} className="flex-1 p-3 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                        </div>
                        <input type="url" placeholder="Link do Google Reviews" value={formData.socialLinks?.googleReviews || ''} onChange={(e) => setFormData(prev => ({ ...prev, socialLinks: { ...prev.socialLinks, googleReviews: e.target.value } }))} className="flex-1 p-3 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                </div>
            </div>

            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Aparência</h3>
                <div className="mt-4 flex items-center justify-between">
                    <div>
                        <p className="font-medium text-slate-800 dark:text-slate-200">Modo Escuro</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Alternar entre tema claro e escuro</p>
                    </div>
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 ${theme === 'dark' ? 'bg-slate-700 ring-1 ring-inset ring-slate-500' : 'bg-slate-200'}`}
                    >
                        <span className="sr-only">Ativar modo escuro</span>
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`}
                        />
                    </button>
                </div>
            </div>

            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Configurações</h3>
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
                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                        aria-label="Configurar Formas de Pagamento"
                    >
                        <i className="fas fa-dollar-sign"></i>
                        Configurar Formas de Pagamento
                    </button>
                </div>
            </div>

            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Assinatura Digital</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Crie uma assinatura para ser incluída automaticamente nos seus orçamentos em PDF.
                </p>
                <div className="mt-4 p-4 border-2 border-slate-200 dark:border-slate-600 border-dashed rounded-lg flex flex-col items-center justify-center min-h-[120px] dark:bg-slate-800">
                    {formData.assinatura ? (
                        <>
                            <img src={formData.assinatura} alt="Assinatura salva" className="max-h-20 max-w-full dark:invert" />
                            <div className="mt-4 flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setIsSignatureModalOpen(true)}
                                    className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
                                >
                                    Alterar Assinatura
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, assinatura: '' }))}
                                    className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                >
                                    Remover
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-slate-500 dark:text-slate-400 mb-4">Nenhuma assinatura salva.</p>
                            <button
                                type="button"
                                onClick={() => setIsSignatureModalOpen(true)}
                                className="px-5 py-2.5 bg-slate-800 dark:bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition duration-300 shadow-sm flex items-center justify-center gap-2"
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
                                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 focus:ring-slate-500 dark:bg-slate-700"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300">{dayName}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Colaboradores</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Convide colaboradores para acessar o sistema. Você pode ativar ou bloquear o acesso a qualquer momento.
                </p>
                <div className="mt-4">
                    <TeamManagement />
                </div>
            </div>


            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Inteligência Artificial (IA)</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Escolha o provedor de IA e configure sua chave de API para habilitar funcionalidades como o preenchimento automático de medidas.
                </p>
                <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium">
                        ⚠️ Aviso de Privacidade: Se você configurar uma chave de API, os dados de medidas ou clientes serão enviados ao provedor de IA escolhido para processamento. A responsabilidade e o custo do uso da API são inteiramente do usuário. Não controlamos as políticas de privacidade de serviços de terceiros.
                    </p>
                </div>
                <div className="mt-4">
                    <label className={labelClass}>Provedor de IA</label>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mt-1">
                        <button
                            type="button"
                            onClick={() => handleProviderChange('local_ocr')}
                            className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${formData.aiConfig?.provider === 'local_ocr' ? 'bg-green-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            🆓 OCR Local (Gratuito)
                        </button>
                        <button
                            type="button"
                            onClick={() => handleProviderChange('gemini')}
                            className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${formData.aiConfig?.provider === 'gemini' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            Google Gemini
                        </button>
                        <button
                            type="button"
                            onClick={() => handleProviderChange('openai')}
                            className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${formData.aiConfig?.provider === 'openai' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            OpenAI
                        </button>
                    </div>
                    {formData.aiConfig?.provider === 'local_ocr' && (
                        <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                            ✅ 100% gratuito • Roda no navegador • Sem API key necessária</p>
                    )}
                </div>
                {formData.aiConfig?.provider !== 'local_ocr' && (
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={() => onOpenApiKeyModal(formData.aiConfig?.provider || 'gemini')}
                            className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <i className="fas fa-key"></i>
                            {userInfo.aiConfig?.apiKey ? 'Alterar Chave de API' : 'Configurar Chave de API'}
                        </button>
                    </div>
                )}
            </div>

            {/* Bloco PWA Removido */}
            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Política de Privacidade</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Consulte a política de privacidade para entender como seus dados são armazenados localmente.
                </p>
                <div className="mt-4 space-y-3">
                    <a
                        href="/privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                        <i className="fas fa-shield-alt"></i>
                        Ver Política de Privacidade
                    </a>
                </div>
            </div>

            <div className="pb-24"></div>

            <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 p-4 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <div className="container mx-auto max-w-2xl flex justify-end items-center gap-4">
                    <div className={`text-green-600 dark:text-green-400 font-bold text-sm flex items-center gap-2 transition-all duration-300 ${showSuccess ? 'opacity-100 translate-y-0 animate-pop-in' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                        <i className="fas fa-check-circle text-lg"></i>
                        <span>Alterações salvas com sucesso!</span>
                    </div>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className={`px-8 py-3 bg-slate-900 dark:bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:bg-slate-500 disabled:cursor-wait min-w-[200px] text-center shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${isSaving ? 'animate-pulse-subtle' : ''}`}
                    >
                        {isSaving ? (
                            <>
                                <div className="loader-sm"></div>
                                <span>Salvando...</span>
                            </>
                        ) : (
                            <>
                                <i className="fas fa-save"></i>
                                <span>Salvar Alterações</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
            {isSignatureModalOpen && (
                <SignatureModal
                    isOpen={isSignatureModalOpen}
                    onClose={() => setIsSignatureModalOpen(false)}
                    onSave={handleSaveSignature}
                />
            )}
        </form>
    );
};

export default UserSettingsView;