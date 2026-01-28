import React from 'react';
import { Lock, Crown, ArrowRight, X } from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { SubscriptionModule } from '../../services/subscriptionService';

// ============================================
// COMPONENTE: FeatureGate
// Bloqueia conteúdo se o módulo não estiver ativo
// ============================================

interface FeatureGateProps {
    moduleId: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
    showUpgradePrompt?: boolean;
}

export function FeatureGate({
    moduleId,
    children,
    fallback,
    showUpgradePrompt = true
}: FeatureGateProps) {
    const { hasModule, modules, isLoading } = useSubscription();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
        );
    }

    if (hasModule(moduleId)) {
        return <>{children}</>;
    }

    if (fallback) {
        return <>{fallback}</>;
    }

    if (showUpgradePrompt) {
        const moduleInfo = modules.find(m => m.id === moduleId);
        return <UpgradePrompt module={moduleInfo} />;
    }

    return null;
}

// ============================================
// COMPONENTE: UpgradePrompt
// Exibe mensagem de upgrade com preço
// ============================================

interface UpgradePromptProps {
    module?: SubscriptionModule;
    onUpgradeClick?: () => void;
    compact?: boolean;
}

export function UpgradePrompt({ module, onUpgradeClick, compact = false }: UpgradePromptProps) {
    if (compact) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-lg text-amber-200 text-sm">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>Recurso PRO</span>
                {module && (
                    <span className="text-amber-400 font-semibold">
                        R$ {module.price_monthly.toFixed(2)}/{module.validity_months || 1}{(module.validity_months || 1) > 1 ? 'M' : 'mês'}
                    </span>
                )}
            </div>
        );
    }

    // Benefícios específicos por módulo
    const moduleBenefits: Record<string, { icon: string, benefit: string }> = {
        'qr_servicos': {
            icon: '📱',
            benefit: 'Seus clientes visualizam o serviço realizado escaneando o QR Code'
        },
        'ia_ocr': {
            icon: '⚡',
            benefit: 'Economize horas digitando: extraia dados de fotos e áudio automaticamente'
        },
        'estoque': {
            icon: '📦',
            benefit: 'Controle bobinas, retalhos e nunca mais perca dinheiro com desperdício'
        },
        'corte_inteligente': {
            icon: '✂️',
            benefit: 'Reduza até 30% o desperdício com otimização inteligente de cortes'
        },
        'colaboradores': {
            icon: '👥',
            benefit: 'Gerencie sua equipe e acompanhe o trabalho de cada colaborador'
        },
        'personalizacao': {
            icon: '🎨',
            benefit: 'Deixe suas propostas com a cara da sua empresa'
        },
        'ilimitado': {
            icon: '∞',
            benefit: 'Trabalhe sem limites: clientes, películas e propostas ilimitados'
        },
        'locais_global': {
            icon: '🏢',
            benefit: 'Adicione locais à base global e economize tempo em futuros orçamentos'
        }
    };

    const moduleId = module?.id || '';
    const customBenefit = moduleBenefits[moduleId];

    return (
        <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-800/50 to-gray-900/80 border border-gray-700 rounded-xl">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-600/20 flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-amber-400" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">
                {module?.name || 'Recurso Premium'}
            </h3>

            {/* Benefício específico do módulo */}
            {customBenefit && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg max-w-md">
                    <p className="text-blue-300 text-center text-sm flex items-center gap-2 justify-center">
                        <span className="text-xl">{customBenefit.icon}</span>
                        <span>{customBenefit.benefit}</span>
                    </p>
                </div>
            )}

            <p className="text-gray-400 text-center mb-4 max-w-md text-sm">
                {module?.description || 'Este recurso está disponível no plano PRO.'}
            </p>

            {module && (
                <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-3xl font-bold text-white">
                        R$ {module.price_monthly.toFixed(2)}
                    </span>
                    <span className="text-gray-400">
                        /{module.validity_months || 1} {(module.validity_months || 1) > 1 ? 'meses' : 'mês'}
                    </span>
                </div>
            )}

            {/* Garantia de 7 dias */}
            <div className="mb-6 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-300 text-sm font-medium flex items-center gap-2">
                    <span>🛡️</span>
                    <span>Garantia de 7 dias • Reembolso total se não gostar</span>
                </p>
            </div>

            {module?.features && module.features.length > 0 && (
                <ul className="mb-6 space-y-2 w-full max-w-sm">
                    {module.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-gray-300 text-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                            {formatFeatureName(feature)}
                        </li>
                    ))}
                </ul>
            )}

            <button
                onClick={onUpgradeClick}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-gray-900 font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/20"
            >
                <Crown className="w-5 h-5" />
                Ativar Agora
                <ArrowRight className="w-5 h-5" />
            </button>

            <p className="text-gray-500 text-xs mt-3 text-center">
                Sem risco • Cancele quando quiser
            </p>
        </div>
    );
}

// ============================================
// COMPONENTE: LimitWarning
// Aviso quando está perto do limite
// ============================================

interface LimitWarningProps {
    resource: 'clients' | 'films' | 'pdfs' | 'agendamentos';
    currentCount: number;
    onUpgradeClick?: () => void;
}

const resourceNames: Record<string, string> = {
    clients: 'clientes',
    films: 'películas',
    pdfs: 'propostas',
    agendamentos: 'agendamentos'
};

export function LimitWarning({ resource, currentCount, onUpgradeClick }: LimitWarningProps) {
    const { isLimitReached, getRemainingQuota, info, isUnlimited } = useSubscription();

    if (isUnlimited) return null;

    const remaining = getRemainingQuota(resource, currentCount);
    const isReached = isLimitReached(resource, currentCount);
    const resourceName = resourceNames[resource] || resource;

    if (remaining > 3 && !isReached) return null;

    if (isReached) {
        return (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <Lock className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div className="flex-1">
                    <p className="text-red-300 font-medium">
                        Limite de {resourceName} atingido
                    </p>
                    <p className="text-red-400/70 text-sm">
                        Ative o módulo "Sem Limites" para adicionar mais.
                    </p>
                </div>
                {onUpgradeClick && (
                    <button
                        onClick={onUpgradeClick}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
                    >
                        Expandir
                    </button>
                )}
            </div>
        );
    }

    // Aviso quando está chegando perto
    return (
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-sm">
                Você tem <span className="font-bold">{remaining}</span> {resourceName} restantes no plano gratuito.
            </p>
        </div>
    );
}

// ============================================
// COMPONENTE: ModuleCard
// Card para exibir um módulo na lista
// ============================================

interface ModuleCardProps {
    module: SubscriptionModule;
    isActive?: boolean;
    expiresAt?: string | null;
    onActivate?: () => void;
}

export function ModuleCard({ module, isActive = false, expiresAt, onActivate }: ModuleCardProps) {
    const DynamicIcon = getIconComponent(module.icon);

    return (
        <div className={`relative p-5 border rounded-xl transition-all ${isActive
            ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30'
            : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
            }`}>
            {isActive && (
                <div className="absolute -top-2 -right-2 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                    ATIVO
                </div>
            )}

            <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-gray-700 text-gray-400'
                    }`}>
                    <DynamicIcon className="w-6 h-6" />
                </div>

                <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">{module.name}</h3>
                    <p className="text-gray-400 text-sm mb-3">{module.description}</p>

                    {module.features && module.features.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {module.features.slice(0, 3).map((feature, idx) => (
                                <span key={idx} className="px-2 py-1 bg-gray-700/50 text-gray-300 text-xs rounded">
                                    {formatFeatureName(feature)}
                                </span>
                            ))}
                        </div>
                    )}

                    {expiresAt && isActive && (
                        <p className="text-green-400/70 text-xs mb-3">
                            Válido até {new Date(expiresAt).toLocaleDateString('pt-BR')}
                        </p>
                    )}
                </div>

                <div className="text-right">
                    <div className="text-xl font-bold text-white">
                        R$ {module.price_monthly.toFixed(2)}
                    </div>
                    <div className="text-gray-500 text-xs">
                        /{module.validity_months || 1} {(module.validity_months || 1) > 1 ? 'meses' : 'mês'}
                    </div>

                    {!isActive && onActivate && (
                        <button
                            onClick={onActivate}
                            className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            Ativar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================
// COMPONENTE: UsageBar
// Barra de progresso de uso
// ============================================

interface UsageBarProps {
    label: string;
    current: number;
    max: number;
    color?: 'blue' | 'green' | 'amber' | 'red';
}

export function UsageBar({ label, current, max, color = 'blue' }: UsageBarProps) {
    const percentage = max === -1 ? 0 : Math.min(100, (current / max) * 100);
    const isUnlimited = max === -1;

    const colors = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        amber: 'bg-amber-500',
        red: 'bg-red-500'
    };

    const getColor = () => {
        if (isUnlimited) return colors.green;
        if (percentage >= 100) return colors.red;
        if (percentage >= 80) return colors.amber;
        return colors[color];
    };

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-gray-400">{label}</span>
                <span className="text-gray-300">
                    {isUnlimited ? (
                        <span className="text-green-400">∞ Ilimitado</span>
                    ) : (
                        <>{current} / {max}</>
                    )}
                </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                    className={`h-full ${getColor()} transition-all rounded-full`}
                    style={{ width: isUnlimited ? '100%' : `${percentage}%` }}
                />
            </div>
        </div>
    );
}

// ============================================
// COMPONENTE: LockedScreen
// Tela de bloqueio para abas/páginas inteiras
// ============================================

interface LockedScreenProps {
    moduleId: string;
    title?: string;
    description?: string;
    onUpgradeClick?: () => void;
    showBackButton?: boolean;
    onBackClick?: () => void;
}

export function LockedScreen({
    moduleId,
    title,
    description,
    onUpgradeClick,
    showBackButton = false,
    onBackClick
}: LockedScreenProps) {
    const { modules } = useSubscription();
    const module = modules.find(m => m.id === moduleId);

    // Benefícios visuais por módulo
    const moduleVisuals: Record<string, {
        emoji: string;
        benefits: string[];
        gradient: string;
    }> = {
        'estoque': {
            emoji: '📦',
            benefits: [
                'Cadastre e controle suas bobinas',
                'Gerencie retalhos e sobras',
                'QR Code para rastreamento',
                'Estatísticas de consumo'
            ],
            gradient: 'from-blue-600 to-cyan-600'
        },
        'qr_servicos': {
            emoji: '🔗',
            benefits: [
                'Crie QR Codes únicos por serviço',
                'Página pública de garantia',
                'Cliente escaneia e vê detalhes',
                'Marketing passivo automático'
            ],
            gradient: 'from-purple-600 to-pink-600'
        },
        'colaboradores': {
            emoji: '👥',
            benefits: [
                'Convide colaboradores por e-mail',
                'Defina níveis de acesso',
                'Gerencie permissões',
                'Veja atividades da equipe'
            ],
            gradient: 'from-teal-600 to-green-600'
        },
        'ia_ocr': {
            emoji: '🧠',
            benefits: [
                'Cadastre clientes por foto/voz',
                'Extraia medidas de imagens',
                'Economize horas de digitação',
                'Precisão de 95%+'
            ],
            gradient: 'from-violet-600 to-purple-600'
        },
        'personalizacao': {
            emoji: '🎨',
            benefits: [
                'Logo da sua empresa nos PDFs',
                'Cores personalizadas',
                'Assinatura digital',
                'Redes sociais nas propostas'
            ],
            gradient: 'from-orange-600 to-red-600'
        },
        'ilimitado': {
            emoji: '♾️',
            benefits: [
                'Clientes ilimitados',
                'Películas ilimitadas',
                'PDFs ilimitados por mês',
                'Agendamentos ilimitados'
            ],
            gradient: 'from-amber-600 to-yellow-500'
        },
        'locais_global': {
            emoji: '📍',
            benefits: [
                'Adicione novos locais à base',
                'Edite medidas existentes',
                'Compartilhe com a comunidade',
                'Economize tempo em futuros orçamentos'
            ],
            gradient: 'from-green-600 to-lime-600'
        },
        'corte_inteligente': {
            emoji: '✂️',
            benefits: [
                'Otimização profunda de cortes',
                'Reduza até 30% o desperdício',
                'Histórico de versões',
                'Cálculo de custo automático'
            ],
            gradient: 'from-rose-600 to-pink-600'
        }
    };

    const visuals = moduleVisuals[moduleId] || {
        emoji: '🔒',
        benefits: ['Funcionalidade premium'],
        gradient: 'from-gray-600 to-gray-700'
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 animate-fadeIn">
            {/* Back button */}
            {showBackButton && onBackClick && (
                <button
                    onClick={onBackClick}
                    className="self-start mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                    <Icons.ArrowLeft className="w-5 h-5" />
                    <span>Voltar</span>
                </button>
            )}

            {/* Emoji grande */}
            <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${visuals.gradient} flex items-center justify-center mb-6 shadow-lg`}>
                <span className="text-5xl">{visuals.emoji}</span>
            </div>

            {/* Título */}
            <h2 className="text-2xl font-bold text-white mb-2 text-center">
                {title || module?.name || 'Recurso PRO'}
            </h2>

            {/* Descrição */}
            <p className="text-gray-400 text-center max-w-md mb-6">
                {description || module?.description || 'Esta funcionalidade está disponível no plano PRO.'}
            </p>

            {/* Benefícios */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 mb-6 max-w-md w-full">
                <h3 className="text-white font-semibold mb-4 text-center">O que você ganha:</h3>
                <ul className="space-y-3">
                    {visuals.benefits.map((benefit, idx) => (
                        <li key={idx} className="flex items-center gap-3 text-gray-300">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                <Icons.Check className="w-4 h-4 text-green-400" />
                            </div>
                            {benefit}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Preço e CTA */}
            <div className="text-center mb-6">
                <div className="flex items-baseline justify-center gap-2 mb-2">
                    <span className="text-4xl font-bold text-white">
                        R$ {module?.price_monthly?.toFixed(2) || '39,00'}
                    </span>
                    <span className="text-gray-400">
                        / {module?.validity_months || 6} meses
                    </span>
                </div>
                <p className="text-green-400 text-sm flex items-center justify-center gap-1">
                    <span>🛡️</span>
                    <span>Garantia de 7 dias ou seu dinheiro de volta</span>
                </p>
            </div>

            {/* Botão de ativar */}
            <button
                onClick={onUpgradeClick}
                className={`w-full max-w-md flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r ${visuals.gradient} hover:opacity-90 text-white font-bold rounded-xl transition-all shadow-lg text-lg`}
            >
                <Crown className="w-6 h-6" />
                Ativar Agora
                <ArrowRight className="w-6 h-6" />
            </button>

            {/* Plano completo */}
            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg max-w-md w-full">
                <p className="text-amber-300 text-center text-sm">
                    💎 <strong>Dica:</strong> Ative o <strong>Plano Completo</strong> por R$ 199,00 e ganhe todos os 8 módulos com 36% de desconto!
                </p>
            </div>
        </div>
    );
}

// ============================================
// COMPONENTE: ProBadge
// Badge "PRO" para marcar botões/features
// ============================================

interface ProBadgeProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function ProBadge({ size = 'sm', className = '' }: ProBadgeProps) {
    const sizes = {
        sm: 'text-[10px] px-1.5 py-0.5',
        md: 'text-xs px-2 py-0.5',
        lg: 'text-sm px-2.5 py-1'
    };

    return (
        <span className={`inline-flex items-center gap-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 font-bold rounded ${sizes[size]} ${className}`}>
            <Crown className={size === 'sm' ? 'w-2.5 h-2.5' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'} />
            PRO
        </span>
    );
}

// ============================================
// COMPONENTE: ProButton
// Botão que mostra badge PRO se não tiver acesso
// ============================================

interface ProButtonProps {
    moduleId: string;
    children: React.ReactNode;
    onUpgradeClick?: () => void;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
}

export function ProButton({ moduleId, children, onUpgradeClick, onClick, className = '', disabled, type = 'button' }: ProButtonProps) {
    const { hasModule } = useSubscription();
    const hasAccess = hasModule(moduleId);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (hasAccess) {
            onClick?.(e);
        } else {
            onUpgradeClick?.();
        }
    };

    return (
        <button
            type={type}
            disabled={disabled}
            onClick={handleClick}
            className={`relative ${className} ${!hasAccess ? 'opacity-90' : ''}`}
        >
            {children}
            {!hasAccess && (
                <ProBadge size="sm" className="absolute -top-2 -right-2" />
            )}
        </button>
    );
}

// ============================================
// COMPONENTE: LimitCounter
// Contador de limite inline (ex: "3/10")
// ============================================

interface LimitCounterProps {
    resource: 'clients' | 'films' | 'pdfs' | 'agendamentos';
    currentCount: number;
    showLabel?: boolean;
}

export function LimitCounter({ resource, currentCount, showLabel = true }: LimitCounterProps) {
    const { info, isUnlimited } = useSubscription();

    if (isUnlimited) {
        return (
            <span className="text-green-400 text-sm flex items-center gap-1">
                <Icons.Infinity className="w-4 h-4" />
                {showLabel && resourceNames[resource]}
            </span>
        );
    }

    const limits = info?.limits || { max_clients: 10, max_films: 5, max_pdfs_month: 10, max_agendamentos_month: 5 };
    const maxMap: Record<string, number> = {
        clients: limits.max_clients,
        films: limits.max_films,
        pdfs: limits.max_pdfs_month,
        agendamentos: limits.max_agendamentos_month
    };

    const max = maxMap[resource] || 10;
    const percentage = (currentCount / max) * 100;

    let colorClass = 'text-gray-400';
    if (percentage >= 100) colorClass = 'text-red-400';
    else if (percentage >= 80) colorClass = 'text-amber-400';
    else if (percentage >= 50) colorClass = 'text-yellow-400';

    return (
        <span className={`text-sm font-medium ${colorClass}`}>
            {currentCount}/{max}
            {showLabel && ` ${resourceNames[resource]}`}
        </span>
    );
}

// ============================================
// UTILITÁRIOS
// ============================================

function formatFeatureName(feature: string): string {
    return feature
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

// Map de ícones - adicione mais conforme necessário
import * as Icons from 'lucide-react';

function getIconComponent(iconName: string): React.ComponentType<{ className?: string }> {
    const icons: Record<string, React.ComponentType<{ className?: string }>> = {
        Package: Icons.Package,
        QrCode: Icons.QrCode,
        Users: Icons.Users,
        Brain: Icons.Brain,
        Palette: Icons.Palette,
        Infinity: Icons.Infinity,
        MapPin: Icons.MapPin,
        Crown: Icons.Crown,
        Lock: Icons.Lock,
        Scissors: Icons.Scissors
    };

    return icons[iconName] || Icons.Package;
}

// ============================================
// MODAL: ActivateModuleModal
// Modal para solicitar ativação de módulo
// ============================================

interface ActivateModuleModalProps {
    isOpen: boolean;
    onClose: () => void;
    module: SubscriptionModule;
    onConfirm: (billingCycle: 'monthly' | 'yearly') => void;
    pixKey?: string;
}

export function ActivateModuleModal({
    isOpen,
    onClose,
    module,
    onConfirm,
    pixKey = 'sua-chave-pix@email.com'
}: ActivateModuleModalProps) {
    const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'yearly'>('monthly');
    const [copied, setCopied] = React.useState(false);

    if (!isOpen) return null;

    const price = billingCycle === 'yearly'
        ? (module.price_yearly || module.price_monthly * 10)
        : module.price_monthly;

    const discount = billingCycle === 'yearly'
        ? Math.round((1 - (module.price_yearly || 0) / (module.price_monthly * 12)) * 100)
        : 0;

    const handleCopyPix = () => {
        navigator.clipboard.writeText(pixKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white">Ativar {module.name}</h2>
                        <p className="text-gray-400 text-sm mt-1">{module.description}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Preço do módulo */}
                <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-white mb-2">
                            R$ {module.price_monthly.toFixed(2)}
                        </div>
                        <div className="text-gray-400">
                            por {module.validity_months || 6} meses
                        </div>
                        <div className="mt-3 text-sm text-green-400 flex items-center justify-center gap-1">
                            <span>🛡️</span>
                            <span>Garantia de 7 dias</span>
                        </div>
                    </div>
                </div>

                {/* Total */}
                <div className="bg-gray-800 rounded-lg p-4 mb-6">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400">Total a pagar:</span>
                        <span className="text-2xl font-bold text-white">R$ {price.toFixed(2)}</span>
                    </div>
                </div>

                {/* Instruções PIX */}
                <div className="bg-gradient-to-br from-gray-800 to-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <span className="text-2xl">💳</span> Pagamento via PIX
                    </h3>

                    <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                            <div className="flex-1 font-mono text-sm text-gray-300 break-all">
                                {pixKey}
                            </div>
                            <button
                                onClick={handleCopyPix}
                                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${copied
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                    }`}
                            >
                                {copied ? '✓ Copiado!' : 'Copiar'}
                            </button>
                        </div>

                        <ol className="text-sm text-gray-400 space-y-1">
                            <li>1. Copie a chave PIX acima</li>
                            <li>2. Faça o pagamento no seu banco</li>
                            <li>3. Clique em "Confirmar Pagamento"</li>
                            <li>4. Aguarde a ativação (até 24h úteis)</li>
                        </ol>
                    </div>
                </div>

                {/* Botões */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => onConfirm(billingCycle)}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold rounded-lg transition-all"
                    >
                        Confirmar Pagamento
                    </button>
                </div>
            </div>
        </div>
    );
}
