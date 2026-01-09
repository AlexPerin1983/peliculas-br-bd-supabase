import React, { useState, useEffect, FormEvent } from 'react';
import { UserInfo } from '../../types';
import Input from '../ui/Input';
import ColorPicker from '../ui/ColorPicker';
import SignatureModal from '../modals/SignatureModal';
import TeamManagement from '../TeamManagement';
import InviteDisplay from '../InviteDisplay';
import { getActiveInvite, createOrganizationInvite } from '../../services/inviteService';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Facebook, Instagram, Youtube, MessageSquare, Moon, Sun, Share2 } from 'lucide-react';

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
    if (digitsOnly.length > 11) digitsOnly = digitsOnly.slice(0, 11);
    if (digitsOnly.length > 10) return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 7)}-${digitsOnly.slice(7)}`;
    if (digitsOnly.length > 6) return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 6)}-${digitsOnly.slice(6)}`;
    if (digitsOnly.length > 2) return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2)}`;
    if (digitsOnly.length > 0) return `(${digitsOnly}`;
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

const UserSettingsView: React.FC<UserSettingsViewProps> = ({
    userInfo,
    onSave,
    onOpenPaymentMethods,
    onOpenApiKeyModal,
    isPwaInstalled,
    onPromptPwaInstall
}) => {
    const { theme, toggleTheme } = useTheme();
    const [formData, setFormData] = useState<UserInfo>(userInfo);
    const [logoPreview, setLogoPreview] = useState<string | undefined>(userInfo.logo);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [loadingInvite, setLoadingInvite] = useState(false);

    useEffect(() => {
        setFormData(prev => ({
            ...userInfo,
            cpfCnpj: applyCpfCnpjMask(userInfo.cpfCnpj || '')
        }));
        setLogoPreview(userInfo.logo);
    }, [userInfo]);

    useEffect(() => {
        if (userInfo.organizationId && userInfo.isOwner) {
            loadActiveInviteCode();
        }
    }, [userInfo.organizationId, userInfo.isOwner]);

    const loadActiveInviteCode = async () => {
        if (!userInfo.organizationId) return;
        const invite = await getActiveInvite(userInfo.organizationId);
        setInviteCode(invite?.invite_code || null);
    };

    const handleGenerateInvite = async () => {
        if (!userInfo.organizationId) return;
        setLoadingInvite(true);
        const invite = await createOrganizationInvite(userInfo.organizationId);
        if (invite) {
            setInviteCode(invite.invite_code);
        }
        setLoadingInvite(false);
    };

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

    const handleSocialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({
            ...prev,
            socialLinks: {
                ...(prev.socialLinks || {}),
                [id]: value
            }
        }));
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
        setTimeout(() => setShowSuccess(false), 3000);
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

    const handleSaveSignature = (signatureDataUrl: string) => {
        setFormData(prev => ({ ...prev, assinatura: signatureDataUrl }));
        setIsSignatureModalOpen(false);
    };

    const handleShareApp = async () => {
        const shareData = {
            title: 'Películas Brasil',
            text: 'Acesse o aplicativo da Películas Brasil para orçamentos e gestão.',
            url: window.location.origin
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.error('Erro ao compartilhar:', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(window.location.origin);
                alert('Link copiado para a área de transferência!');
            } catch (err) {
                console.error('Erro ao copiar:', err);
            }
        }
    };

    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";
    const sectionTitleClass = "text-lg font-semibold text-slate-800 dark:text-slate-200";
    const sectionClass = "pt-6 mt-6 border-t border-slate-200 dark:border-slate-700";

    return (
        <form id="userForm" onSubmit={handleSubmit} className="space-y-6 p-1">
            {/* Cabeçalho de Instalação PWA */}
            {!isPwaInstalled && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex-1">
                        <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">Instale o app para usar offline!</p>
                    </div>
                    <button type="button" onClick={onPromptPwaInstall} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm">
                        Instalar
                    </button>
                </div>
            )}

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
                                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <div className="flex text-sm text-slate-600 dark:text-slate-400">
                                        <label htmlFor="logo-upload-input" className="relative cursor-pointer bg-white dark:bg-slate-800 rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                            <span>Fazer upload do logotipo</span>
                                            <input id="logo-upload-input" name="logo-upload-input" type="file" className="sr-only" accept="image/*" onChange={handleLogoChange} />
                                        </label>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPG, GIF até 2MB</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="md:col-span-2 space-y-4">
                        <div className="space-y-1">
                            <label className={labelClass}>Cor Primária</label>
                            <ColorPicker color={formData.cores?.primaria || '#918B45'} onChange={(val) => handleColorChange('primaria', val)} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>Cor Secundária</label>
                            <ColorPicker color={formData.cores?.secundaria || '#4E6441'} onChange={(val) => handleColorChange('secundaria', val)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Redes Sociais e Avaliações */}
            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Redes Sociais e Avaliações</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Adicione seus links para facilitar o acompanhamento e pedir avaliações.</p>
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                            <Facebook className="w-5 h-5 text-white" />
                        </div>
                        <input id="facebook" type="text" value={formData.socialLinks?.facebook || ''} onChange={handleSocialChange} placeholder="https://facebook.com/suapagina" className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
                            <Instagram className="w-5 h-5 text-white" />
                        </div>
                        <input id="instagram" type="text" value={formData.socialLinks?.instagram || ''} onChange={handleSocialChange} placeholder="https://instagram.com/seu-perfil" className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center shrink-0">
                            <Share2 className="w-5 h-5 text-white" />
                        </div>
                        <input id="tiktok" type="text" value={formData.socialLinks?.tiktok || ''} onChange={handleSocialChange} placeholder="https://tiktok.com/@seu-usuario" className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-500" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shrink-0">
                            <Youtube className="w-5 h-5 text-white" />
                        </div>
                        <input id="youtube" type="text" value={formData.socialLinks?.youtube || ''} onChange={handleSocialChange} placeholder="https://youtube.com/c/seu-canal" className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
                            <MessageSquare className="w-5 h-5 text-white" />
                        </div>
                        <input id="googleReviews" type="text" value={formData.socialLinks?.googleReviews || ''} onChange={handleSocialChange} placeholder="https://g.page/r/seu-link-de-avaliacao" className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                </div>
            </div>

            {/* Aparência */}
            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Aparência</h3>
                <div className="mt-4 flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                            {theme === 'dark' ? <Moon className="w-5 h-5 text-blue-400" /> : <Sun className="w-5 h-5 text-orange-500" />}
                        </div>
                        <div>
                            <p className="font-medium text-slate-800 dark:text-slate-200">Modo Escuro</p>
                            <p className="text-xs text-slate-500">Alternar entre tema claro e escuro</p>
                        </div>
                    </div>
                    <button type="button" onClick={toggleTheme} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${theme === 'dark' ? 'bg-blue-600' : 'bg-slate-300'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>

            {/* Compartilhar Aplicativo */}
            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Compartilhar Aplicativo</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Compartilhe o link do aplicativo com seus clientes ou outros colaboradores.</p>
                <button
                    type="button"
                    onClick={handleShareApp}
                    className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                    <Share2 className="w-5 h-5" />
                    Compartilhar Link do App
                </button>
            </div>

            {/* Configurações de Orçamento */}
            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Configurações</h3>
                <div className="mt-4 space-y-4">
                    <Input id="proposalValidityDays" label="Validade da Proposta (dias)" type="number" value={formData.proposalValidityDays || 15} onChange={handleChange} min={1} />
                    <Input id="prazoPagamento" label="Prazo de Pagamento" type="text" value={formData.prazoPagamento || ''} onChange={handleChange} placeholder="Ex: Pagamento imediato após a instalação" />
                    <button type="button" onClick={onOpenPaymentMethods} className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                        <i className="fas fa-dollar-sign"></i>
                        Configurar Formas de Pagamento
                    </button>
                </div>
            </div>

            {/* Assinatura Digital */}
            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Assinatura Digital</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Crie uma assinatura para ser incluída automaticamente nos seus orçamentos em PDF.</p>
                <div className="mt-4 p-6 border-2 border-slate-200 dark:border-slate-700 border-dashed rounded-xl flex flex-col items-center justify-center min-h-[160px] bg-slate-50/50 dark:bg-slate-900/50">
                    {formData.assinatura ? (
                        <>
                            <img src={formData.assinatura} alt="Assinatura" className="max-h-24 border rounded bg-white p-2 shadow-sm" />
                            <div className="mt-4 flex gap-3">
                                <button type="button" onClick={() => setIsSignatureModalOpen(true)} className="px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                    Alterar Assinatura
                                </button>
                                <button type="button" onClick={() => setFormData(prev => ({ ...prev, assinatura: '' }))} className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                                    Remover
                                </button>
                            </div>
                        </>
                    ) : (
                        <button type="button" onClick={() => setIsSignatureModalOpen(true)} className="px-6 py-3 bg-slate-800 dark:bg-slate-700 text-white font-bold rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors shadow-sm flex items-center gap-2">
                            <i className="fas fa-signature"></i>
                            Criar Assinatura
                        </button>
                    )}
                </div>
            </div>

            {/* Horário de Funcionamento */}
            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Horário de Funcionamento</h3>
                <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input id="working-start" label="Início do Expediente" type="time" value={formData.workingHours?.start || '08:00'} onChange={handleWorkingTimeChange} />
                        <Input id="working-end" label="Fim do Expediente" type="time" value={formData.workingHours?.end || '18:00'} onChange={handleWorkingTimeChange} />
                    </div>
                    <div>
                        <label className={labelClass}>Dias da Semana</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => (
                                <label key={day} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer">
                                    <input type="checkbox" checked={formData.workingHours?.days?.includes(index)} onChange={(e) => handleWorkingDayChange(index, e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{day}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Colaboradores (Gestão Real) */}
            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Colaboradores</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Gerencie colaboradores para acessar o sistema. Você pode ativar ou bloquear o acesso a qualquer momento.</p>
                <TeamManagement />
            </div>

            {/* Inteligência Artificial (IA) */}
            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Inteligência Artificial (IA)</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Escolha o provedor de IA e configure sua chave de API para habilitar funcionalidades como o preenchimento automático de medidas.</p>
                <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-xs text-yellow-800 dark:text-yellow-300 font-medium flex items-start gap-2">
                        <i className="fas fa-exclamation-triangle mt-0.5"></i>
                        <span>Aviso de Privacidade: Se você configurar uma chave de API, os dados de medidas ou clientes serão enviados ao provedor de IA escolhido. A responsabilidade e o custo são do usuário.</span>
                    </p>
                </div>
                <div className="mt-4">
                    <label className={labelClass}>Provedor de IA</label>
                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg mt-1">
                        {['gemini', 'google-gemini', 'openai'].map((p) => (
                            <button key={p} type="button" onClick={() => setFormData(prev => ({ ...prev, aiConfig: { ...(prev.aiConfig || { apiKey: '' }), provider: p as any } }))} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${formData.aiConfig?.provider === p ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                                {p === 'gemini' || p === 'google-gemini' ? 'Google Gemini' : 'OpenAI'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="mt-4">
                    <button type="button" onClick={() => onOpenApiKeyModal(formData.aiConfig?.provider || 'gemini')} className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 shadow-sm">
                        <i className="fas fa-key"></i>
                        {formData.aiConfig?.apiKey ? 'Alterar Chave de API' : 'Configurar Chave de API'}
                    </button>
                </div>
            </div>

            {/* Convite para Colaboradores (Nova Funcionalidade) */}
            {userInfo.isOwner && (
                <div className={sectionClass}>
                    <h3 className={sectionTitleClass}>Convite para Colaboradores</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-4">Gere um QR Code para que seus colaboradores se cadastrem automaticamente em sua empresa.</p>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
                        {!inviteCode ? (
                            <button type="button" onClick={handleGenerateInvite} disabled={loadingInvite} className="w-full px-4 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg transform active:scale-95">
                                {loadingInvite ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><i className="fas fa-qrcode text-xl"></i><span>Gerar Código de Convite</span></>}
                            </button>
                        ) : (
                            <InviteDisplay inviteCode={inviteCode} onRegenerate={handleGenerateInvite} />
                        )}
                    </div>
                </div>
            )}

            {/* Política de Privacidade */}
            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Política de Privacidade</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Consulte a política de privacidade para entender como seus dados são armazenados localmente.</p>
                <button type="button" className="mt-4 w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 text-sm">
                    <i className="fas fa-shield-alt"></i>
                    Ver Política de Privacidade
                </button>
            </div>

            {/* Botão Salvar Fixo */}
            <div className="pt-10 pb-20 sm:pb-10">
                <button type="submit" disabled={isSaving} className={`w-full py-4 px-6 rounded-2xl font-bold text-lg shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-3 ${showSuccess ? 'bg-green-500 text-white' : 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white'}`}>
                    {isSaving ? <><div className="w-6 h-6 border-3 border-white dark:border-slate-900 border-t-transparent rounded-full animate-spin"></div><span>Salvando...</span></> : showSuccess ? <><i className="fas fa-check-circle text-xl"></i><span>Salvo com Sucesso!</span></> : <><i className="fas fa-save text-xl"></i><span>Salvar Alterações</span></>}
                </button>
            </div>

            {isSignatureModalOpen && (
                <SignatureModal isOpen={isSignatureModalOpen} onClose={() => setIsSignatureModalOpen(false)} onSave={handleSaveSignature} initialSignature={formData.assinatura} />
            )}
        </form>
    );
};

export default UserSettingsView;