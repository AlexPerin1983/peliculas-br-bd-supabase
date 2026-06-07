import React, { useState, useEffect, useRef } from 'react';
import { UserInfo } from '../../types';
import Input from '../ui/Input';
import ColorPicker from '../ui/ColorPicker';
import SignatureModal from '../modals/SignatureModal';
import TeamManagement from '../TeamManagement';
import InviteDisplay from '../InviteDisplay';
import { getActiveInvite, createOrganizationInvite } from '../../services/inviteService';
import { processLogoImage } from '../../services/imageProcessing';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useFeedback } from '../../src/contexts/FeedbackContext';
import { AlertTriangle, CheckCircle2, DollarSign, Facebook, FileSignature, Instagram, KeyRound, Loader2, MessageSquare, Moon, Palette, QrCode, Save, Settings, Share2, Shield, Smartphone, Sun, Users, Clock, Building2, Bot, Youtube, ChevronDown } from 'lucide-react';
import { FeatureGate } from '../subscription/SubscriptionComponents';
import { PremiumFeatureSection } from '../subscription/PremiumFeatureSection';

interface UserSettingsViewProps {
    userInfo: UserInfo;
    onSave: (userInfo: UserInfo) => void;
    onOpenPaymentMethods: () => void;
    onOpenApiKeyModal: (provider: 'gemini') => void;
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

const renderIcon = (icon: React.ReactNode, className: string) => {
    if (React.isValidElement<{ className?: string }>(icon)) {
        return React.cloneElement(icon, { className });
    }

    return icon;
};

const secondaryButtonClassName = 'inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text-body)] shadow-[var(--shadow-hairline)] transition-all duration-200 hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] active:scale-[0.99]';
const primaryButtonClassName = 'inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--brand-primary)] px-5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(21,94,239,0.18)] transition-all duration-200 hover:bg-[var(--brand-primary-strong)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60';

type SectionSaveState = 'idle' | 'saving' | 'saved' | 'disabled';
type SettingsSaveSection = 'company' | 'branding' | 'social' | 'proposal' | 'hours' | 'ai';

const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4, 5, 6];

const SECTION_SAVE_LABELS: Record<SettingsSaveSection, string> = {
    company: 'Dados da empresa',
    branding: 'Personalização',
    social: 'Redes sociais',
    proposal: 'Orçamento',
    hours: 'Horário de funcionamento',
    ai: 'Inteligência artificial'
};

interface SettingsSectionProps {
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
    badge?: string;
    saveState?: SectionSaveState;
    saveLabel?: string;
    onSaveSection?: () => void;
    showFooterSave?: boolean;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
    title,
    subtitle,
    icon,
    children,
    defaultOpen = false,
    badge,
    saveState = 'idle',
    saveLabel = 'Salvar seção',
    onSaveSection,
    showFooterSave = true
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const isSavingSection = saveState === 'saving';
    const isSavedSection = saveState === 'saved';
    const isSaveDisabled = isSavingSection || saveState === 'disabled';

    return (
        <section className="ui-surface overflow-hidden transition-shadow duration-200 hover:shadow-[var(--shadow-elevated)]">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-4 text-left transition-colors duration-200 hover:bg-[var(--surface-muted)] sm:px-5"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="ui-icon-frame h-10 w-10 shrink-0 text-[var(--brand-primary)]">
                        {renderIcon(icon, 'h-5 w-5')}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-[var(--text-strong)]">{title}</h3>
                            {badge ? (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300">
                                    {badge}
                                </span>
                            ) : null}
                        </div>
                        {subtitle ? (
                            <p className="mt-0.5 line-clamp-1 text-sm text-[var(--text-muted)]">{subtitle}</p>
                        ) : null}
                    </div>

                    <span className={`ui-icon-frame h-8 w-8 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[var(--brand-primary)]' : ''}`}>
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </span>
                </div>
            </button>

            <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
            >
                <div className="overflow-hidden">
                    <div className="border-t border-[var(--border-subtle)] px-4 pb-5 pt-4 sm:px-5">
                        {children}

                        {showFooterSave && onSaveSection ? (
                            <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs font-medium text-[var(--text-muted)]">
                                    Confirma as alterações deste bloco sem precisar ir ao fim da página.
                                </p>
                                <button
                                    type="button"
                                    onClick={onSaveSection}
                                    disabled={isSaveDisabled}
                                    className={[
                                        'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] border px-3.5 text-sm font-semibold shadow-[var(--shadow-hairline)] transition-all duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60',
                                        isSavedSection
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                                            : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'
                                    ].join(' ')}
                                >
                                    {isSavingSection ? (
                                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    ) : isSavedSection ? (
                                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                    ) : (
                                        <Save className="h-4 w-4" aria-hidden="true" />
                                    )}
                                    <span>{isSavingSection ? 'Salvando...' : isSavedSection ? 'Seção salva' : saveLabel}</span>
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </section>
    );
};

interface SocialInputProps {
    id: string;
    icon: React.ReactNode;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string;
}

const SocialInput: React.FC<SocialInputProps> = ({ id, icon, value, onChange, placeholder }) => (
    <div className="grid grid-cols-[40px_1fr] items-center gap-3">
        <div className="ui-icon-frame h-10 w-10 shrink-0 text-[var(--brand-primary)]">
            {renderIcon(icon, 'h-4 w-4')}
        </div>
        <input
            id={id}
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="ui-field h-11 w-full px-3.5 text-sm placeholder:text-[var(--text-soft)]"
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
    const { showToast } = useFeedback();
    const [formData, setFormData] = useState<UserInfo>(userInfo);
    const [logoPreview, setLogoPreview] = useState<string | undefined>(userInfo.logo);
    const logoUploadAreaRef = useRef<HTMLDivElement>(null);
    const shouldScrollLogoPreviewRef = useRef(false);
    const [savingSection, setSavingSection] = useState<SettingsSaveSection | null>(null);
    const [savedSection, setSavedSection] = useState<SettingsSaveSection | null>(null);
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
        if (!shouldScrollLogoPreviewRef.current || !logoPreview || typeof window === 'undefined') return;

        shouldScrollLogoPreviewRef.current = false;
        if (!window.matchMedia('(max-width: 767px)').matches) return;

        window.requestAnimationFrame(() => {
            logoUploadAreaRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        });
    }, [logoPreview]);

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

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Permite reescolher o mesmo arquivo depois.
        e.target.value = '';
        try {
            const optimized = await processLogoImage(file);
            shouldScrollLogoPreviewRef.current = true;
            setFormData(prev => ({ ...prev, logo: optimized }));
            setLogoPreview(optimized);
        } catch (error) {
            showToast(
                error instanceof Error ? error.message : 'Não foi possível usar essa imagem.',
                { tone: 'error', duration: 3200 }
            );
        }
    };

    const handleRemoveLogo = () => {
        setFormData(prev => ({ ...prev, logo: '' }));
        setLogoPreview('');
    };

    const getSectionSaveState = (section: SettingsSaveSection): SectionSaveState => {
        if (savingSection === section) return 'saving';
        if (savingSection) return 'disabled';
        if (savedSection === section) return 'saved';
        return 'idle';
    };

    const handleSaveSection = async (section: SettingsSaveSection) => {
        if (savingSection) return;

        setSavingSection(section);
        setSavedSection(null);

        try {
            await Promise.resolve(onSave(formData));
            setSavedSection(section);
            showToast(`${SECTION_SAVE_LABELS[section]} salvo.`, { tone: 'success' });
            setTimeout(() => {
                setSavedSection(current => current === section ? null : current);
            }, 2600);
        } catch (error) {
            console.error('Erro ao salvar configuração:', error);
            showToast('Não foi possível salvar esta seção agora.', { tone: 'error' });
        } finally {
            setSavingSection(null);
        }
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
                ...(prev.workingHours || { start: '08:00', end: '18:00', days: DEFAULT_WORKING_DAYS }),
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
                showToast('Link copiado para a área de transferência!', { tone: 'success' });
            } catch (err) {
                console.error('Erro ao copiar:', err);
            }
        }
    };

    const labelClass = "ui-label mb-1.5 block";
    const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const renderBrandingSaveButton = (label: string) => {
        const saveState = getSectionSaveState('branding');
        const isSaving = saveState === 'saving';
        const isSaved = saveState === 'saved';
        const isDisabled = isSaving || saveState === 'disabled';

        return (
            <button
                type="button"
                onClick={() => handleSaveSection('branding')}
                disabled={isDisabled}
                className={[
                    'inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border px-3.5 text-sm font-semibold shadow-[var(--shadow-hairline)] transition-all duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto',
                    isSaved
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                        : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'
                ].join(' ')}
            >
                {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : isSaved ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                    <Save className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isSaving ? 'Salvando...' : isSaved ? 'Salvo' : label}</span>
            </button>
        );
    };

    return (
        <form id="userForm" onSubmit={(event) => event.preventDefault()} className="space-y-4 pb-10 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0">
            <div className="lg:col-span-2">
                <div className="ui-surface relative overflow-hidden p-4 sm:p-5">
                    <div className="absolute inset-x-0 top-0 h-1 bg-[var(--brand-primary)]" aria-hidden="true" />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="ui-icon-frame h-11 w-11 shrink-0 text-[var(--brand-primary)]">
                                <Settings className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div>
                                <h2 className="font-display text-xl font-semibold text-[var(--text-strong)]">Configurações</h2>
                                <p className="text-sm text-[var(--text-muted)]">Gerencie sua conta e preferências</p>
                            </div>
                        </div>
                        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
                            <span className="h-2 w-2 rounded-full bg-[var(--brand-primary)]" aria-hidden="true" />
                            Perfil da empresa
                        </span>
                    </div>
                </div>
            </div>

            {/* ===== SECAO: DADOS DA EMPRESA ===== */}
            <SettingsSection
                title="Dados da Empresa"
                subtitle="Informações básicas do seu negócio"
                icon={<Building2 className="w-5 h-5" />}
                defaultOpen={true}
                saveState={getSectionSaveState('company')}
                onSaveSection={() => handleSaveSection('company')}
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
                        <Input id="telefone" label="Telefone" type="tel" value={formData.telefone} onChange={handleChange} required placeholder="(11) 11111-1111" maxLength={15} />
                        <Input id="email" label="Email" type="email" value={formData.email} onChange={handleChange} required />
                    </div>
                    <Input id="endereco" label="Endereço" type="text" value={formData.endereco} onChange={handleChange} required />
                </div>
            </SettingsSection>

            {/* ===== SECAO: LOGOTIPO (gratuito) ===== */}
            <SettingsSection
                title="Logotipo da Empresa"
                subtitle="Aparece no topo dos seus orçamentos"
                icon={<Building2 className="w-5 h-5" />}
                showFooterSave={false}
            >
                <div className="max-w-md">
                    <div ref={logoUploadAreaRef} className="mt-1 flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-[var(--radius-panel)] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-muted)] p-6 transition-colors hover:border-[var(--brand-primary)] group">
                        {logoPreview ? (
                            <div className="text-center">
                                <img src={logoPreview} alt="Logo" className="mx-auto mb-4 max-h-20 w-auto rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] p-2 shadow-[var(--shadow-hairline)]" />
                                <div className="flex gap-3 justify-center">
                                    <label htmlFor="logo-upload-input" className={`${secondaryButtonClassName} cursor-pointer`}>
                                        Alterar
                                        <input id="logo-upload-input" type="file" className="sr-only" accept="image/*" onChange={handleLogoChange} />
                                    </label>
                                    <button type="button" onClick={handleRemoveLogo} className="inline-flex h-11 items-center justify-center rounded-[var(--radius-control)] px-4 text-sm font-semibold text-[var(--danger)] transition-colors hover:bg-red-50 dark:hover:bg-red-950/25">
                                        Remover
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <label htmlFor="logo-upload-input" className="text-center cursor-pointer">
                                <div className="ui-icon-frame mx-auto mb-3 h-14 w-14 text-[var(--brand-primary)] transition-colors group-hover:bg-[var(--surface)]">
                                    <Building2 className="h-6 w-6" aria-hidden="true" />
                                </div>
                                <p className="text-sm font-semibold text-[var(--text-strong)]">Clique para fazer upload</p>
                                <p className="mt-1 text-xs text-[var(--text-soft)]">PNG ou JPG — otimizamos automaticamente</p>
                                <input id="logo-upload-input" type="file" className="sr-only" accept="image/*" onChange={handleLogoChange} />
                            </label>
                        )}
                    </div>
                    <div className="mt-3 flex justify-end">
                        {renderBrandingSaveButton('Salvar logo')}
                    </div>
                </div>
            </SettingsSection>

            {/* ===== SECAO: CORES E ASSINATURA (premium) ===== */}
            <FeatureGate
                moduleId="personalizacao"
                fallback={
                    <PremiumFeatureSection
                        moduleId="personalizacao"
                        title="Cores e Assinatura"
                        description="Cores da marca e assinatura digital premium para deixar seus documentos mais profissionais."
                        variant="inline"
                    />
                }
            >
                <SettingsSection
                    title="Cores e Assinatura"
                    subtitle="Paleta da marca e assinatura digital"
                    icon={<Palette className="w-5 h-5" />}
                    saveState={getSectionSaveState('branding')}
                    onSaveSection={() => handleSaveSection('branding')}
                    showFooterSave={false}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Branding / Cores */}
                        <div className="flex flex-col space-y-4">
                            <div className="space-y-5 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="h-4 w-1.5 rounded-full bg-[var(--brand-primary)]" />
                                    <h4 className="ui-kicker">Paleta da Marca</h4>
                                </div>

                                <div className="grid grid-cols-1 gap-5">
                                    <div className="group">
                                        <label className={labelClass}>Cor Primária</label>
                                        <ColorPicker color={formData.cores?.primaria || '#918B45'} onChange={(val) => handleColorChange('primaria', val)} />
                                    </div>
                                    <div className="group">
                                        <label className={labelClass}>Cor Secundária</label>
                                        <ColorPicker color={formData.cores?.secundaria || '#4E6441'} onChange={(val) => handleColorChange('secundaria', val)} />
                                    </div>
                                </div>

                                {/* Preview Card */}
                                <div className="mt-2 space-y-3">
                                    <p className="ui-kicker text-center">Visualização no Orçamento</p>
                                    <div className="relative flex h-20 overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)]">
                                        <div
                                            className="w-1/3 h-full flex items-center justify-center transition-colors duration-500"
                                            style={{ backgroundColor: formData.cores?.primaria || '#918B45' }}
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm" />
                                        </div>
                                        <div className="h-full flex-1 space-y-2 bg-[var(--surface)] p-3">
                                            <div className="h-2 w-2/3 rounded-full bg-[var(--surface-muted)]" />
                                            <div className="h-2 w-full rounded-full bg-[var(--surface-muted)]" />
                                            <div className="h-6 w-1/2 rounded-lg mt-1 transition-colors duration-500" style={{ backgroundColor: formData.cores?.secundaria || '#4E6441' }} />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end border-t border-[var(--border-subtle)] pt-4">
                                    {renderBrandingSaveButton('Salvar cores')}
                                </div>
                            </div>
                        </div>
                        <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5 lg:col-span-2">
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="h-4 w-1.5 rounded-full bg-[var(--brand-primary)]" />
                                        <h4 className="ui-kicker">Assinatura Digital</h4>
                                    </div>
                                    <p className="text-sm text-[var(--text-muted)]">
                                        Gerencie a assinatura no mesmo bloco premium da sua identidade visual, sem repetir a mesma oferta.
                                    </p>
                                </div>
                                <div className="ui-icon-frame hidden h-11 w-11 text-[var(--brand-primary)] sm:inline-flex">
                                    <FileSignature className="h-5 w-5" aria-hidden="true" />
                                </div>
                            </div>

                            <div className="flex min-h-[150px] flex-col items-center justify-center rounded-[var(--radius-panel)] border border-dashed border-[var(--border-subtle)] bg-[var(--surface)] p-6">
                                {formData.assinatura ? (
                                    <div className="text-center">
                                        <img src={formData.assinatura} alt="Assinatura" className="mx-auto mb-4 max-h-20 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-white p-2 shadow-[var(--shadow-hairline)]" />
                                        <div className="flex flex-wrap gap-3 justify-center">
                                            <button type="button" onClick={() => setIsSignatureModalOpen(true)} className={secondaryButtonClassName}>
                                                Alterar
                                            </button>
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, assinatura: '' }))} className="inline-flex h-11 items-center justify-center rounded-[var(--radius-control)] px-4 text-sm font-semibold text-[var(--danger)] transition-colors hover:bg-red-50 dark:hover:bg-red-950/25">
                                                Remover
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => setIsSignatureModalOpen(true)} className={primaryButtonClassName}>
                                        <FileSignature className="h-4 w-4" aria-hidden="true" />
                                        Criar Assinatura
                                    </button>
                                )}
                            </div>
                            <div className="mt-4 flex justify-end">
                                {renderBrandingSaveButton('Salvar assinatura')}
                            </div>
                        </div>
                    </div>
                </SettingsSection>
            </FeatureGate>

            {/* ===== SECAO: REDES SOCIAIS ===== */}
            <SettingsSection
                title="Redes Sociais"
                subtitle="Links para suas redes e avaliações"
                icon={<Share2 className="w-5 h-5" />}
                saveState={getSectionSaveState('social')}
                onSaveSection={() => handleSaveSection('social')}
            >
                <div className="space-y-3">
                    <SocialInput
                        id="facebook"
                        icon={<Facebook className="w-5 h-5 text-white" />}
                        value={formData.socialLinks?.facebook || ''}
                        onChange={handleSocialChange}
                        placeholder="https://facebook.com/suapagina"
                    />
                    <SocialInput
                        id="instagram"
                        icon={<Instagram className="w-5 h-5 text-white" />}
                        value={formData.socialLinks?.instagram || ''}
                        onChange={handleSocialChange}
                        placeholder="https://instagram.com/seu-perfil"
                    />
                    <SocialInput
                        id="tiktok"
                        icon={<Share2 className="w-5 h-5 text-white" />}
                        value={formData.socialLinks?.tiktok || ''}
                        onChange={handleSocialChange}
                        placeholder="https://tiktok.com/@seu-usuario"
                    />
                    <SocialInput
                        id="youtube"
                        icon={<Youtube className="w-5 h-5 text-white" />}
                        value={formData.socialLinks?.youtube || ''}
                        onChange={handleSocialChange}
                        placeholder="https://youtube.com/c/seu-canal"
                    />
                    <SocialInput
                        id="googleReviews"
                        icon={<MessageSquare className="w-5 h-5 text-white" />}
                        value={formData.socialLinks?.googleReviews || ''}
                        onChange={handleSocialChange}
                        placeholder="https://g.page/r/seu-link-de-avaliacao"
                    />
                </div>
            </SettingsSection>

            {/* ===== SECAO: APARENCIA ===== */}
            <SettingsSection
                title="Aparência"
                subtitle="Tema e preferências visuais"
                icon={theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            >
                <div className="flex items-center justify-between gap-4 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                    <div className="flex items-center gap-4">
                        <div className="ui-icon-frame h-12 w-12 text-[var(--brand-primary)]">
                            {theme === 'dark' ? <Moon className="h-5 w-5" aria-hidden="true" /> : <Sun className="h-5 w-5" aria-hidden="true" />}
                        </div>
                        <div>
                            <p className="font-semibold text-[var(--text-strong)]">Modo {theme === 'dark' ? 'Escuro' : 'Claro'}</p>
                            <p className="text-sm text-[var(--text-muted)]">Tema atual do aplicativo</p>
                            <span className="mt-2 inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
                                Aplicado automaticamente
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className={`relative h-8 w-14 rounded-full border transition-all duration-300 ${theme === 'dark' ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]' : 'border-[var(--border-subtle)] bg-[var(--surface)]'}`}
                        aria-label="Alternar tema"
                        aria-pressed={theme === 'dark'}
                    >
                        <span className={`absolute left-0 top-[3px] h-6 w-6 rounded-full bg-white shadow-[var(--shadow-soft)] transition-transform duration-300 ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </SettingsSection>

            {/* ===== SECAO: COMPARTILHAR ===== */}
            <SettingsSection
                title="Compartilhar Aplicativo"
                subtitle="Envie o app para clientes e colaboradores"
                icon={<Smartphone className="w-5 h-5" />}
            >
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <button
                        type="button"
                        onClick={handleShareApp}
                        className={`${primaryButtonClassName} w-full`}
                    >
                        <Share2 className="h-4 w-4" aria-hidden="true" />
                        Compartilhar Link do App
                    </button>
                    {isPwaInstalled ? (
                        <div className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 text-sm font-semibold text-[var(--text-muted)]">
                            <CheckCircle2 className="h-4 w-4 text-[var(--success)]" aria-hidden="true" />
                            App instalado
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={onPromptPwaInstall}
                            className={`${secondaryButtonClassName} h-12`}
                        >
                            <Smartphone className="h-4 w-4" aria-hidden="true" />
                            Instalar app
                        </button>
                    )}
                </div>
            </SettingsSection>

            {/* ===== SECAO: CONFIGURACOES DE ORCAMENTO ===== */}
            <SettingsSection
                title="Configurações de Orçamento"
                subtitle="Validade, pagamento e condições"
                icon={<Settings className="w-5 h-5" />}
                saveState={getSectionSaveState('proposal')}
                onSaveSection={() => handleSaveSection('proposal')}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input id="proposalValidityDays" label="Validade da Proposta (dias)" type="number" value={formData.proposalValidityDays || 15} onChange={handleChange} min={1} />
                        <Input id="prazoPagamento" label="Prazo de Pagamento" type="text" value={formData.prazoPagamento || ''} onChange={handleChange} placeholder="Ex: à vista ou parcelado" />
                    </div>
                    <button
                        type="button"
                        onClick={onOpenPaymentMethods}
                        className={`${secondaryButtonClassName} w-full`}
                    >
                        <DollarSign className="h-4 w-4" aria-hidden="true" />
                        Configurar Formas de Pagamento
                    </button>
                </div>
            </SettingsSection>

            {/* ===== SECAO: HORARIO DE FUNCIONAMENTO ===== */}
            <SettingsSection
                title="Horário de Funcionamento"
                subtitle="Dias e horários de atendimento"
                icon={<Clock className="w-5 h-5" />}
                saveState={getSectionSaveState('hours')}
                onSaveSection={() => handleSaveSection('hours')}
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
                                        className={`cursor-pointer rounded-[var(--radius-control)] border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${isSelected
                                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[0_10px_20px_rgba(21,94,239,0.16)]'
                                            : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-strong)]'
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

            {/* ===== SECAO: COLABORADORES ===== */}
            <FeatureGate
                moduleId="colaboradores"
                fallback={
                    <PremiumFeatureSection
                        moduleId="colaboradores"
                        title="Colaboradores"
                        description="Gerencie equipe, permissões e convites em uma área premium mais organizada."
                        variant="inline"
                    />
                }
            >
                <SettingsSection
                    title="Colaboradores"
                    subtitle="Gerencie sua equipe"
                    icon={<Users className="w-5 h-5" />}
                >
                    <TeamManagement />
                </SettingsSection>
            </FeatureGate>

            {/* ===== SECAO: INTELIGENCIA ARTIFICIAL ===== */}
            <FeatureGate
                moduleId="ia_ocr"
                fallback={
                    <PremiumFeatureSection
                        moduleId="ia_ocr"
                        title="Inteligencia Artificial"
                        description="Ative a IA por um modal de plano mais claro e mantenha a configuracao organizada."
                        variant="inline"
                    />
                }
            >
                <SettingsSection
                    title="Inteligência Artificial"
                    subtitle="Configure o provedor de IA"
                    icon={<Bot className="w-5 h-5" />}
                    badge="Beta"
                    saveState={getSectionSaveState('ai')}
                    onSaveSection={() => handleSaveSection('ai')}
                >
                    <div className="space-y-4">
                        <div className="rounded-[var(--radius-panel)] border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-800/50 dark:bg-amber-900/20">
                            <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                <span><strong>Privacidade:</strong> Ao configurar a IA, dados serão enviados ao provedor escolhido. A responsabilidade e os custos são do usuário.</span>
                            </p>
                        </div>

                        <div>
                            <label className={labelClass}>Provedor de IA</label>
                            <div className="mt-2 flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(21,94,239,0.16)]">
                                <Bot className="h-4 w-4" aria-hidden="true" />
                                Google Gemini
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => onOpenApiKeyModal('gemini')}
                            className={`${primaryButtonClassName} w-full`}
                        >
                            <KeyRound className="h-4 w-4" aria-hidden="true" />
                            {formData.aiConfig?.apiKey ? 'Alterar Chave de API' : 'Configurar Chave de API'}
                        </button>
                    </div>
                </SettingsSection>
            </FeatureGate>

            {/* ===== SECAO: CONVITE (APENAS OWNER) =====
                Mesmo modulo "colaboradores" da secao acima: quando bloqueado,
                nao mostramos um segundo card premium (evita duplicar a oferta).
                A secao so aparece quando o modulo ja esta liberado. */}
            {userInfo.isOwner && (
                <FeatureGate moduleId="colaboradores" showUpgradePrompt={false}>
                    <SettingsSection
                        title="Convite para Colaboradores"
                        subtitle="Gere um QR Code de acesso"
                        icon={<QrCode className="w-5 h-5" />}
                    >
                        <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5">
                            {!inviteCode ? (
                                <button
                                    type="button"
                                    onClick={handleGenerateInvite}
                                    disabled={loadingInvite}
                                    className={`${primaryButtonClassName} w-full`}
                                >
                                    {loadingInvite ? (
                                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                                    ) : (
                                        <>
                                            <QrCode className="h-4 w-4" aria-hidden="true" />
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

            {/* ===== SECAO: POLITICA DE PRIVACIDADE ===== */}
            <SettingsSection
                title="Política de Privacidade"
                subtitle="Termos e condições de uso"
                icon={<Shield className="w-5 h-5" />}
            >
                <button
                    type="button"
                    className={`${secondaryButtonClassName} w-full`}
                >
                    <Shield className="h-4 w-4" aria-hidden="true" />
                    Ver Política de Privacidade
                </button>
            </SettingsSection>

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
