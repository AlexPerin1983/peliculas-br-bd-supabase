import React, { useState, useEffect, FormEvent } from 'react';
import { UserInfo } from '../../types';
import Input from '../ui/Input';
import ColorPicker from '../ui/ColorPicker';
import SignatureModal from '../modals/SignatureModal';
import TeamManagement from '../TeamManagement';
import InviteDisplay from '../InviteDisplay';
import { getActiveInvite, createOrganizationInvite } from '../../services/inviteService';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Facebook, Instagram, Youtube, MessageSquare, Moon, Sun, Share2, Building2, Palette, Users, Clock, Shield, Bot, QrCode, Settings, FileSignature, Smartphone, ChevronDown } from 'lucide-react';
import { FeatureGate } from '../subscription/SubscriptionComponents';

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

// Componente de Seção Premium
interface SettingsSectionProps {
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    iconBg?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    badge?: string;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
    title,
    subtitle,
    icon,
    iconBg = 'from-slate-600 to-slate-700',
    children,
    defaultOpen = false,
    badge
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="group relative">
            {/* Efeito de brilho sutil no hover */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-slate-200/50 via-transparent to-slate-200/50 dark:from-slate-700/30 dark:to-slate-700/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />

            <div className="relative bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden backdrop-blur-sm">
                {/* Header da seção */}
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors duration-200"
                >
                    {/* Ícone com gradiente */}
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center shadow-lg shadow-slate-900/10 dark:shadow-black/20 transform group-hover:scale-105 transition-transform duration-300`}>
                        <div className="text-white">
                            {icon}
                        </div>
                    </div>

                    {/* Título e subtítulo */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100 tracking-tight">{title}</h3>
                            {badge && (
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full">
                                    {badge}
                                </span>
                            )}
                        </div>
                        {subtitle && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{subtitle}</p>
                        )}
                    </div>

                    {/* Indicador de expansão */}
                    <div className={`w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center transition-all duration-300 ${isOpen ? 'rotate-180 bg-slate-200 dark:bg-slate-600' : ''}`}>
                        <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    </div>
                </button>

                {/* Conteúdo expansível com animação */}
                <div
                    className={`overflow-hidden transition-all duration-300 ease-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
                >
                    <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Componente de Input Social Premium
interface SocialInputProps {
    id: string;
    icon: React.ReactNode;
    gradient: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string;
}

const SocialInput: React.FC<SocialInputProps> = ({ id, icon, gradient, value, onChange, placeholder }) => (
    <div className="flex items-center gap-3 group/social">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-md transition-transform duration-200 group-hover/social:scale-110`}>
            {icon}
        </div>
        <input
            id={id}
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-slate-400/50 dark:focus:ring-slate-500/50 focus:border-transparent transition-all duration-200"
        />
    </div>
);

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

    const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5";
    const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
        <form id="userForm" onSubmit={handleSubmit} className="space-y-4 pb-32">
            {/* Header da página */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-600 dark:to-slate-800 flex items-center justify-center">
                        <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Configurações</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie sua conta e preferências</p>
                    </div>
                </div>
            </div>

            {/* ===== SEÇÃO: DADOS DA EMPRESA ===== */}
            <SettingsSection
                title="Dados da Empresa"
                subtitle="Informações básicas do seu negócio"
                icon={<Building2 className="w-5 h-5" />}
                iconBg="from-blue-500 to-blue-600"
                defaultOpen={true}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input id="cpfCnpj" label="CPF/CNPJ" type="text" value={formData.cpfCnpj} onChange={handleChange} required inputMode="numeric" />
                        <Input id="site" label="Site" type="text" value={formData.site || ''} onChange={handleChange} placeholder="www.suaempresa.com.br" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input id="empresa" label="Nome da Empresa" type="text" value={formData.empresa} onChange={handleChange} required />
                        <Input id="nome" label="Seu Nome" type="text" value={formData.nome} onChange={handleChange} required />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input id="telefone" label="Telefone" type="tel" value={formData.telefone} onChange={handleChange} required placeholder="(XX) XXXXX-XXXX" maxLength={15} />
                        <Input id="email" label="Email" type="email" value={formData.email} onChange={handleChange} required />
                    </div>
                    <Input id="endereco" label="Endereço" type="text" value={formData.endereco} onChange={handleChange} required />
                </div>
            </SettingsSection>

            {/* ===== SEÇÃO: PERSONALIZAÇÃO ===== */}
            <FeatureGate moduleId="personalizacao">
                <SettingsSection
                    title="Personalização do Orçamento"
                    subtitle="Logo, cores e identidade visual"
                    icon={<Palette className="w-5 h-5" />}
                    iconBg="from-violet-500 to-purple-600"
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Upload de Logo */}
                        <div>
                            <label className={labelClass}>Logotipo da Empresa</label>
                            <div className="mt-1 flex flex-col justify-center items-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl min-h-[180px] bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-400 dark:hover:border-slate-500 transition-colors cursor-pointer group/logo">
                                {logoPreview ? (
                                    <div className="text-center">
                                        <img src={logoPreview} alt="Logo" className="mx-auto max-h-20 w-auto rounded-lg shadow-md mb-4" />
                                        <div className="flex gap-3 justify-center">
                                            <label htmlFor="logo-upload-input" className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                                                Alterar
                                                <input id="logo-upload-input" type="file" className="sr-only" accept="image/*" onChange={handleLogoChange} />
                                            </label>
                                            <button type="button" onClick={handleRemoveLogo} className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                                Remover
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <label htmlFor="logo-upload-input" className="text-center cursor-pointer">
                                        <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center group-hover/logo:bg-slate-300 dark:group-hover/logo:bg-slate-600 transition-colors">
                                            <Palette className="w-7 h-7 text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Clique para fazer upload</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">PNG, JPG até 2MB</p>
                                        <input id="logo-upload-input" type="file" className="sr-only" accept="image/*" onChange={handleLogoChange} />
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* Cores */}
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>Cor Primária</label>
                                <ColorPicker color={formData.cores?.primaria || '#918B45'} onChange={(val) => handleColorChange('primaria', val)} />
                            </div>
                            <div>
                                <label className={labelClass}>Cor Secundária</label>
                                <ColorPicker color={formData.cores?.secundaria || '#4E6441'} onChange={(val) => handleColorChange('secundaria', val)} />
                            </div>
                        </div>
                    </div>
                </SettingsSection>
            </FeatureGate>

            {/* ===== SEÇÃO: REDES SOCIAIS ===== */}
            <SettingsSection
                title="Redes Sociais"
                subtitle="Links para suas redes e avaliações"
                icon={<Share2 className="w-5 h-5" />}
                iconBg="from-pink-500 to-rose-500"
            >
                <div className="space-y-3">
                    <SocialInput
                        id="facebook"
                        icon={<Facebook className="w-5 h-5 text-white" />}
                        gradient="from-blue-500 to-blue-600"
                        value={formData.socialLinks?.facebook || ''}
                        onChange={handleSocialChange}
                        placeholder="https://facebook.com/suapagina"
                    />
                    <SocialInput
                        id="instagram"
                        icon={<Instagram className="w-5 h-5 text-white" />}
                        gradient="from-pink-500 via-red-500 to-yellow-500"
                        value={formData.socialLinks?.instagram || ''}
                        onChange={handleSocialChange}
                        placeholder="https://instagram.com/seu-perfil"
                    />
                    <SocialInput
                        id="tiktok"
                        icon={<Share2 className="w-5 h-5 text-white" />}
                        gradient="from-slate-800 to-slate-900"
                        value={formData.socialLinks?.tiktok || ''}
                        onChange={handleSocialChange}
                        placeholder="https://tiktok.com/@seu-usuario"
                    />
                    <SocialInput
                        id="youtube"
                        icon={<Youtube className="w-5 h-5 text-white" />}
                        gradient="from-red-500 to-red-600"
                        value={formData.socialLinks?.youtube || ''}
                        onChange={handleSocialChange}
                        placeholder="https://youtube.com/c/seu-canal"
                    />
                    <SocialInput
                        id="googleReviews"
                        icon={<MessageSquare className="w-5 h-5 text-white" />}
                        gradient="from-orange-500 to-amber-500"
                        value={formData.socialLinks?.googleReviews || ''}
                        onChange={handleSocialChange}
                        placeholder="https://g.page/r/seu-link-de-avaliacao"
                    />
                </div>
            </SettingsSection>

            {/* ===== SEÇÃO: APARÊNCIA ===== */}
            <SettingsSection
                title="Aparência"
                subtitle="Tema e preferências visuais"
                icon={theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                iconBg={theme === 'dark' ? "from-indigo-500 to-indigo-600" : "from-amber-400 to-orange-500"}
            >
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-700/30">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-amber-500/20 text-amber-500'}`}>
                            {theme === 'dark' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
                        </div>
                        <div>
                            <p className="font-medium text-slate-700 dark:text-slate-200">Modo {theme === 'dark' ? 'Escuro' : 'Claro'}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Tema atual do aplicativo</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className={`relative w-14 h-7 rounded-full transition-all duration-300 ${theme === 'dark' ? 'bg-indigo-500' : 'bg-slate-300'}`}
                    >
                        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${theme === 'dark' ? 'left-8' : 'left-1'}`} />
                    </button>
                </div>
            </SettingsSection>

            {/* ===== SEÇÃO: COMPARTILHAR ===== */}
            <SettingsSection
                title="Compartilhar Aplicativo"
                subtitle="Envie o app para clientes e colaboradores"
                icon={<Smartphone className="w-5 h-5" />}
                iconBg="from-emerald-500 to-teal-600"
            >
                <button
                    type="button"
                    onClick={handleShareApp}
                    className="w-full px-5 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 transform hover:-translate-y-0.5"
                >
                    <Share2 className="w-5 h-5" />
                    Compartilhar Link do App
                </button>
            </SettingsSection>

            {/* ===== SEÇÃO: CONFIGURAÇÕES DE ORÇAMENTO ===== */}
            <SettingsSection
                title="Configurações de Orçamento"
                subtitle="Validade, pagamento e condições"
                icon={<Settings className="w-5 h-5" />}
                iconBg="from-slate-600 to-slate-700"
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input id="proposalValidityDays" label="Validade da Proposta (dias)" type="number" value={formData.proposalValidityDays || 15} onChange={handleChange} min={1} />
                        <Input id="prazoPagamento" label="Prazo de Pagamento" type="text" value={formData.prazoPagamento || ''} onChange={handleChange} placeholder="Ex: À vista ou parcelado" />
                    </div>
                    <button
                        type="button"
                        onClick={onOpenPaymentMethods}
                        className="w-full px-4 py-3.5 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700/50"
                    >
                        <i className="fas fa-dollar-sign text-slate-500"></i>
                        Configurar Formas de Pagamento
                    </button>
                </div>
            </SettingsSection>

            {/* ===== SEÇÃO: ASSINATURA DIGITAL ===== */}
            <FeatureGate moduleId="personalizacao">
                <SettingsSection
                    title="Assinatura Digital"
                    subtitle="Sua assinatura nos orçamentos"
                    icon={<FileSignature className="w-5 h-5" />}
                    iconBg="from-amber-500 to-orange-500"
                >
                    <div className="p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center min-h-[150px] bg-slate-50/50 dark:bg-slate-900/30">
                        {formData.assinatura ? (
                            <div className="text-center">
                                <img src={formData.assinatura} alt="Assinatura" className="mx-auto max-h-20 rounded-lg shadow-md border bg-white p-2 mb-4" />
                                <div className="flex gap-3 justify-center">
                                    <button type="button" onClick={() => setIsSignatureModalOpen(true)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                        Alterar
                                    </button>
                                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, assinatura: '' }))} className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                        Remover
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button type="button" onClick={() => setIsSignatureModalOpen(true)} className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all duration-300 flex items-center gap-2 shadow-lg shadow-amber-500/20">
                                <FileSignature className="w-5 h-5" />
                                Criar Assinatura
                            </button>
                        )}
                    </div>
                </SettingsSection>
            </FeatureGate>

            {/* ===== SEÇÃO: HORÁRIO DE FUNCIONAMENTO ===== */}
            <SettingsSection
                title="Horário de Funcionamento"
                subtitle="Dias e horários de atendimento"
                icon={<Clock className="w-5 h-5" />}
                iconBg="from-cyan-500 to-blue-500"
            >
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <Input id="working-start" label="Início do Expediente" type="time" value={formData.workingHours?.start || '08:00'} onChange={handleWorkingTimeChange} />
                        <Input id="working-end" label="Fim do Expediente" type="time" value={formData.workingHours?.end || '18:00'} onChange={handleWorkingTimeChange} />
                    </div>
                    <div>
                        <label className={labelClass}>Dias da Semana</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {dayLabels.map((day, index) => {
                                const isSelected = formData.workingHours?.days?.includes(index);
                                return (
                                    <label
                                        key={day}
                                        className={`px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 border-2 font-medium text-sm ${isSelected
                                            ? 'bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-500/30'
                                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => handleWorkingDayChange(index, e.target.checked)}
                                            className="sr-only"
                                        />
                                        {day}
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </SettingsSection>

            {/* ===== SEÇÃO: COLABORADORES ===== */}
            <FeatureGate moduleId="colaboradores">
                <SettingsSection
                    title="Colaboradores"
                    subtitle="Gerencie sua equipe"
                    icon={<Users className="w-5 h-5" />}
                    iconBg="from-fuchsia-500 to-pink-500"
                >
                    <TeamManagement />
                </SettingsSection>
            </FeatureGate>

            {/* ===== SEÇÃO: INTELIGÊNCIA ARTIFICIAL ===== */}
            <FeatureGate moduleId="ia_ocr">
                <SettingsSection
                    title="Inteligência Artificial"
                    subtitle="Configure o provedor de IA"
                    icon={<Bot className="w-5 h-5" />}
                    iconBg="from-violet-500 to-indigo-600"
                    badge="Beta"
                >
                    <div className="space-y-4">
                        <div className="p-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                                <i className="fas fa-exclamation-triangle mt-0.5"></i>
                                <span><strong>Privacidade:</strong> Ao configurar a IA, dados serão enviados ao provedor escolhido. A responsabilidade e custos são do usuário.</span>
                            </p>
                        </div>

                        <div>
                            <label className={labelClass}>Provedor de IA</label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {[
                                    { id: 'gemini', label: 'Google Gemini' },
                                    { id: 'openai', label: 'OpenAI' }
                                ].map((provider) => {
                                    const isSelected = formData.aiConfig?.provider === provider.id || formData.aiConfig?.provider === 'google-gemini' && provider.id === 'gemini';
                                    return (
                                        <button
                                            key={provider.id}
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, aiConfig: { ...(prev.aiConfig || { apiKey: '' }), provider: provider.id as any } }))}
                                            className={`py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 border-2 ${isSelected
                                                ? 'bg-violet-500 border-violet-500 text-white shadow-md shadow-violet-500/30'
                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                                                }`}
                                        >
                                            {provider.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => onOpenApiKeyModal(formData.aiConfig?.provider || 'gemini')}
                            className="w-full px-4 py-3.5 bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-medium rounded-xl hover:from-violet-600 hover:to-indigo-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
                        >
                            <i className="fas fa-key"></i>
                            {formData.aiConfig?.apiKey ? 'Alterar Chave de API' : 'Configurar Chave de API'}
                        </button>
                    </div>
                </SettingsSection>
            </FeatureGate>

            {/* ===== SEÇÃO: CONVITE (APENAS OWNER) ===== */}
            {userInfo.isOwner && (
                <FeatureGate moduleId="colaboradores">
                    <SettingsSection
                        title="Convite para Colaboradores"
                        subtitle="Gere um QR Code de acesso"
                        icon={<QrCode className="w-5 h-5" />}
                        iconBg="from-emerald-500 to-green-600"
                    >
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200/50 dark:border-slate-700/30 rounded-xl p-5">
                            {!inviteCode ? (
                                <button
                                    type="button"
                                    onClick={handleGenerateInvite}
                                    disabled={loadingInvite}
                                    className="w-full px-4 py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-emerald-400 disabled:to-green-500 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20"
                                >
                                    {loadingInvite ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <QrCode className="w-5 h-5" />
                                            Gerar Código de Convite
                                        </>
                                    )}
                                </button>
                            ) : (
                                <InviteDisplay inviteCode={inviteCode} onRegenerate={handleGenerateInvite} />
                            )}
                        </div>
                    </SettingsSection>
                </FeatureGate>
            )}

            {/* ===== SEÇÃO: POLÍTICA DE PRIVACIDADE ===== */}
            <SettingsSection
                title="Política de Privacidade"
                subtitle="Termos e condições de uso"
                icon={<Shield className="w-5 h-5" />}
                iconBg="from-slate-500 to-slate-600"
            >
                <button
                    type="button"
                    className="w-full px-4 py-3.5 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700/50"
                >
                    <Shield className="w-4 h-4" />
                    Ver Política de Privacidade
                </button>
            </SettingsSection>

            {/* ===== BOTÃO SALVAR FIXO ===== */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-100 via-slate-100 to-transparent dark:from-slate-900 dark:via-slate-900 z-40 sm:relative sm:bg-transparent sm:dark:bg-transparent sm:p-0 sm:pt-6">
                <button
                    type="submit"
                    disabled={isSaving}
                    className={`w-full py-4 px-6 rounded-2xl font-bold text-lg shadow-xl transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-3 ${showSuccess
                        ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-emerald-500/30'
                        : 'bg-gradient-to-r from-slate-800 to-slate-900 dark:from-white dark:to-slate-100 text-white dark:text-slate-900 shadow-slate-900/20 dark:shadow-white/10 hover:shadow-2xl hover:-translate-y-0.5'
                        }`}
                >
                    {isSaving ? (
                        <>
                            <div className="w-6 h-6 border-3 border-white dark:border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                            <span>Salvando...</span>
                        </>
                    ) : showSuccess ? (
                        <>
                            <i className="fas fa-check-circle text-xl"></i>
                            <span>Salvo com Sucesso!</span>
                        </>
                    ) : (
                        <>
                            <i className="fas fa-save text-xl"></i>
                            <span>Salvar Alterações</span>
                        </>
                    )}
                </button>
            </div>

            {/* Modal de Assinatura */}
            {isSignatureModalOpen && (
                <SignatureModal
                    isOpen={isSignatureModalOpen}
                    onClose={() => setIsSignatureModalOpen(false)}
                    onSave={handleSaveSignature}
                    initialSignature={formData.assinatura}
                />
            )}
        </form>
    );
};

export default UserSettingsView;