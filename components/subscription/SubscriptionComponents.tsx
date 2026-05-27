import React from 'react';
import ReactDOM from 'react-dom';
import {
    Lock,
    Crown,
    ArrowRight,
    X,
    CreditCard,
    Sparkles,
    CheckCircle2,
    QrCode
} from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { SubscriptionModule } from '../../services/subscriptionService';
import {
    createAbacatePixCheckoutForModule,
    createAbacateSubscriptionCheckoutForModule
} from '../../services/abacateBillingService';

// ============================================
// COMPONENTE: FeatureGate
// Bloqueia conteÃºdo se o mÃ³dulo nÃ£o estiver ativo
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
// Exibe mensagem de upgrade com preÃ§o
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
                        R$ {module.price_monthly.toFixed(2)}/{module.validity_months || 1}{(module.validity_months || 1) > 1 ? 'M' : 'mÃªs'}
                    </span>
                )}
            </div>
        );
    }

    // BenefÃ­cios especÃ­ficos por mÃ³dulo
    const moduleBenefits: Record<string, { icon: string, benefit: string }> = {
        'qr_servicos': {
            icon: 'ðŸ“±',
            benefit: 'Seus clientes visualizam o serviÃ§o realizado escaneando o QR Code'
        },
        'ia_ocr': {
            icon: 'âš¡',
            benefit: 'Economize horas digitando: extraia dados de fotos e Ã¡udio automaticamente'
        },
        'estoque': {
            icon: 'ðŸ“¦',
            benefit: 'Controle bobinas, retalhos e nunca mais perca dinheiro com desperdÃ­cio'
        },
        'corte_inteligente': {
            icon: 'âœ‚ï¸',
            benefit: 'Reduza atÃ© 30% o desperdÃ­cio com otimizaÃ§Ã£o inteligente de cortes'
        },
        'colaboradores': {
            icon: 'ðŸ‘¥',
            benefit: 'Gerencie sua equipe e acompanhe o trabalho de cada colaborador'
        },
        'personalizacao': {
            icon: 'ðŸŽ¨',
            benefit: 'Deixe suas propostas com a cara da sua empresa'
        },
        'ilimitado': {
            icon: 'âˆž',
            benefit: 'Trabalhe sem limites: clientes, pelÃ­culas e propostas ilimitados'
        },
        'locais_global': {
            icon: 'ðŸ¢',
            benefit: 'Adicione locais Ã  base global e economize tempo em futuros orÃ§amentos'
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

            {/* BenefÃ­cio especÃ­fico do mÃ³dulo */}
            {customBenefit && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg max-w-md">
                    <p className="text-blue-300 text-center text-sm flex items-center gap-2 justify-center">
                        <span className="text-xl">{customBenefit.icon}</span>
                        <span>{customBenefit.benefit}</span>
                    </p>
                </div>
            )}

            <p className="text-gray-400 text-center mb-4 max-w-md text-sm">
                {module?.description || 'Este recurso estÃ¡ disponÃ­vel no plano PRO.'}
            </p>

            {module && (
                <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-3xl font-bold text-white">
                        R$ {module.price_monthly.toFixed(2)}
                    </span>
                    <span className="text-gray-400">
                        /{module.validity_months || 1} {(module.validity_months || 1) > 1 ? 'meses' : 'mÃªs'}
                    </span>
                </div>
            )}

            {/* Garantia de 7 dias */}
            <div className="mb-6 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-300 text-sm font-medium flex items-center gap-2">
                    <span>ðŸ›¡ï¸</span>
                    <span>Garantia de 7 dias â€¢ Reembolso total se nÃ£o gostar</span>
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
                Sem risco â€¢ Cancele quando quiser
            </p>
        </div>
    );
}

// ============================================
// COMPONENTE: LimitWarning
// Aviso quando estÃ¡ perto do limite
// ============================================

interface LimitWarningProps {
    resource: 'clients' | 'films' | 'pdfs' | 'agendamentos';
    currentCount: number;
    onUpgradeClick?: () => void;
}

const resourceNames: Record<string, string> = {
    clients: 'clientes',
    films: 'pelÃ­culas',
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
                        Ative o mÃ³dulo "Sem Limites" para adicionar mais.
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

    // Aviso quando estÃ¡ chegando perto
    return (
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-sm">
                VocÃª tem <span className="font-bold">{remaining}</span> {resourceName} restantes no plano gratuito.
            </p>
        </div>
    );
}

// ============================================
// COMPONENTE: ModuleCard
// Card para exibir um mÃ³dulo na lista
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
                            VÃ¡lido atÃ© {new Date(expiresAt).toLocaleDateString('pt-BR')}
                        </p>
                    )}
                </div>

                <div className="text-right">
                    <div className="text-xl font-bold text-white">
                        R$ {module.price_monthly.toFixed(2)}
                    </div>
                    <div className="text-gray-500 text-xs">
                        /{module.validity_months || 1} {(module.validity_months || 1) > 1 ? 'meses' : 'mÃªs'}
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
                        <span className="text-green-400">âˆž Ilimitado</span>
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
// Tela de bloqueio para abas/pÃ¡ginas inteiras
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

    // BenefÃ­cios visuais por mÃ³dulo
    const moduleVisuals: Record<string, {
        emoji: string;
        benefits: string[];
        gradient: string;
    }> = {
        'estoque': {
            emoji: 'ðŸ“¦',
            benefits: [
                'Cadastre e controle suas bobinas',
                'Gerencie retalhos e sobras',
                'QR Code para rastreamento',
                'EstatÃ­sticas de consumo'
            ],
            gradient: 'from-blue-600 to-cyan-600'
        },
        'qr_servicos': {
            emoji: 'ðŸ”—',
            benefits: [
                'Crie QR Codes Ãºnicos por serviÃ§o',
                'PÃ¡gina pÃºblica de garantia',
                'Cliente escaneia e vÃª detalhes',
                'Marketing passivo automÃ¡tico'
            ],
            gradient: 'from-purple-600 to-pink-600'
        },
        'colaboradores': {
            emoji: 'ðŸ‘¥',
            benefits: [
                'Convide colaboradores por e-mail',
                'Defina nÃ­veis de acesso',
                'Gerencie permissÃµes',
                'Veja atividades da equipe'
            ],
            gradient: 'from-teal-600 to-green-600'
        },
        'ia_ocr': {
            emoji: 'ðŸ§ ',
            benefits: [
                'Cadastre clientes por foto/voz',
                'Extraia medidas de imagens',
                'Economize horas de digitaÃ§Ã£o',
                'PrecisÃ£o de 95%+'
            ],
            gradient: 'from-violet-600 to-purple-600'
        },
        'personalizacao': {
            emoji: 'ðŸŽ¨',
            benefits: [
                'Logo da sua empresa nos PDFs',
                'Cores personalizadas',
                'Assinatura digital',
                'Redes sociais nas propostas'
            ],
            gradient: 'from-orange-600 to-red-600'
        },
        'ilimitado': {
            emoji: 'â™¾ï¸',
            benefits: [
                'Clientes ilimitados',
                'PelÃ­culas ilimitadas',
                'PDFs ilimitados por mÃªs',
                'Agendamentos ilimitados'
            ],
            gradient: 'from-amber-600 to-yellow-500'
        },
        'locais_global': {
            emoji: 'ðŸ“',
            benefits: [
                'Adicione novos locais Ã  base',
                'Edite medidas existentes',
                'Compartilhe com a comunidade',
                'Economize tempo em futuros orÃ§amentos'
            ],
            gradient: 'from-green-600 to-lime-600'
        },
        'corte_inteligente': {
            emoji: 'âœ‚ï¸',
            benefits: [
                'OtimizaÃ§Ã£o profunda de cortes',
                'Reduza atÃ© 30% o desperdÃ­cio',
                'HistÃ³rico de versÃµes',
                'CÃ¡lculo de custo automÃ¡tico'
            ],
            gradient: 'from-rose-600 to-pink-600'
        }
    };

    const visuals = moduleVisuals[moduleId] || {
        emoji: 'ðŸ”’',
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

            {/* TÃ­tulo */}
            <h2 className="text-2xl font-bold text-white mb-2 text-center">
                {title || module?.name || 'Recurso PRO'}
            </h2>

            {/* DescriÃ§Ã£o */}
            <p className="text-gray-400 text-center max-w-md mb-6">
                {description || module?.description || 'Esta funcionalidade estÃ¡ disponÃ­vel no plano PRO.'}
            </p>

            {/* BenefÃ­cios */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 mb-6 max-w-md w-full">
                <h3 className="text-white font-semibold mb-4 text-center">O que vocÃª ganha:</h3>
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

            {/* PreÃ§o e CTA */}
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
                    <span>ðŸ›¡ï¸</span>
                    <span>Garantia de 7 dias ou seu dinheiro de volta</span>
                </p>
            </div>

            {/* BotÃ£o de ativar */}
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
                    ðŸ’Ž <strong>Dica:</strong> Ative o <strong>Plano Completo</strong> por R$ 199,00 e ganhe todos os 8 mÃ³dulos com 36% de desconto!
                </p>
            </div>
        </div>
    );
}

// ============================================
// COMPONENTE: ProBadge
// Badge "PRO" para marcar botÃµes/features
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
// BotÃ£o que mostra badge PRO se nÃ£o tiver acesso
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
// UTILITÃRIOS
// ============================================

function formatFeatureName(feature: string): string {
    return feature
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

// Map de Ã­cones - adicione mais conforme necessÃ¡rio
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
// MODAL: ActivateModuleModal
// Modal para solicitar ativacao de modulo
// ============================================

interface ActivateModuleModalProps {
    isOpen: boolean;
    onClose: () => void;
    module: SubscriptionModule;
    onConfirm?: (billingCycle: 'monthly' | 'semiannual' | 'yearly') => void;
    pixKey?: string;
}

export function ActivateModuleModal({
    isOpen,
    onClose,
    module
}: ActivateModuleModalProps) {
    const [billingAction, setBillingAction] = React.useState<string | null>(null);

    if (!isOpen) return null;

    const price = module.price_monthly;

    const handlePixCheckout = async () => {
        setBillingAction('pix');

        try {
            const result = await createAbacatePixCheckoutForModule(module.id);
            if (!result.success) {
                throw new Error(result.error);
            }

            window.location.assign(result.url);
        } catch (error) {
            console.error('Erro ao abrir checkout Pix:', error);
            setBillingAction(null);
        }
    };

    const handleSubscriptionCheckout = async () => {
        if (!module.abacate_subscription_product_id) {
            return;
        }

        setBillingAction('subscription');

        try {
            const result = await createAbacateSubscriptionCheckoutForModule(module.id);
            if (!result.success) {
                throw new Error(result.error);
            }

            window.location.assign(result.url);
        } catch (error) {
            console.error('Erro ao abrir assinatura recorrente:', error);
            setBillingAction(null);
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-[12000] overflow-y-auto bg-slate-950/70 p-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-sm sm:p-4">
            <div className="flex min-h-[100dvh] items-start justify-center py-3 sm:min-h-full sm:items-center sm:py-0">
                <div className="flex max-h-[calc(100dvh-24px)] w-full max-w-lg flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_100px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900 sm:max-h-[calc(100dvh-32px)] sm:rounded-[28px]">
                    <div className="shrink-0 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-4 py-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 sm:px-6 sm:py-5">
                        <div className="flex items-start gap-3 sm:gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/10 dark:bg-white dark:text-slate-900 sm:h-11 sm:w-11">
                                <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                                    <Crown className="h-3.5 w-3.5" />
                                    Premium
                                </div>
                                <h2 className="text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                                    Ativar {module.name}
                                </h2>
                                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                                    {module.description}
                                </p>
                            </div>

                            <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Fechar modal">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
                        <div className="space-y-4">
                            <div className="rounded-[22px] border border-slate-200 bg-slate-50/90 p-3.5 shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-950/60 sm:p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                            Plano selecionado
                                        </p>
                                        <div className="mt-2 flex items-end gap-2">
                                            <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                                                R$ {price.toFixed(2).replace('.', ',')}
                                            </span>
                                            <span className="pb-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400 sm:text-sm">
                                                / 6 meses
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300 sm:px-4 sm:py-3 sm:text-sm">
                                            Acesso liberado na hora
                                        </div>
                                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300 sm:px-4 sm:py-3 sm:text-sm">
                                            7 dias de garantia
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
                                <div className="mb-3 flex items-center gap-2 text-slate-900 dark:text-white sm:mb-4">
                                    <Sparkles className="h-4 w-4 text-indigo-500" />
                                    <h3 className="text-sm font-semibold sm:text-base">
                                        O que voce libera com este plano
                                    </h3>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                                    {(module.features?.slice(0, 4) || [
                                        'Liberacao imediata apos confirmacao',
                                        'Acesso premium para sua equipe',
                                        'Checkout e cobranca organizados',
                                        'Suporte para evoluir depois'
                                    ]).map((feature) => (
                                        <div
                                            key={feature}
                                            className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/50 sm:gap-3 sm:py-3"
                                        >
                                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                            </div>
                                            <p className="text-sm leading-5 text-slate-600 dark:text-slate-300">
                                                {feature.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-[24px] border border-blue-200 bg-blue-50/85 p-3.5 shadow-sm shadow-blue-950/5 dark:border-blue-900/40 dark:bg-blue-950/20 sm:p-4">
                                <div className="space-y-3">
                                    <button
                                        onClick={handlePixCheckout}
                                        disabled={billingAction === 'pix'}
                                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
                                    >
                                        <QrCode className="h-4 w-4" />
                                        {billingAction === 'pix'
                                            ? 'Abrindo Pix...'
                                            : 'Comprar 6 meses no Pix'}
                                    </button>

                                    {module.abacate_subscription_product_id ? (
                                        <button
                                            onClick={handleSubscriptionCheckout}
                                            disabled={billingAction === 'subscription'}
                                            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900 sm:text-base"
                                        >
                                            <CreditCard className="h-4 w-4" />
                                            {billingAction === 'subscription'
                                                ? 'Abrindo assinatura...'
                                                : 'Assinar com renovacao a cada 6 meses'}
                                        </button>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-blue-300 bg-white/80 px-4 py-3 text-sm text-slate-600 dark:border-blue-900/40 dark:bg-slate-950/30 dark:text-slate-300">
                                            Assinatura recorrente indisponivel ate configurar o produto de 6 meses no AbacatePay.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') {
        return modalContent;
    }

    return ReactDOM.createPortal(modalContent, document.body);
}
