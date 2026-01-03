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
                        R$ {module.price_monthly.toFixed(2)}/mês
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-800/50 to-gray-900/80 border border-gray-700 rounded-xl">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-600/20 flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-amber-400" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">
                {module?.name || 'Recurso Premium'}
            </h3>

            <p className="text-gray-400 text-center mb-4 max-w-md">
                {module?.description || 'Este recurso está disponível no plano PRO.'}
            </p>

            {module && (
                <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-3xl font-bold text-white">
                        R$ {module.price_monthly.toFixed(2)}
                    </span>
                    <span className="text-gray-400">/mês</span>
                </div>
            )}

            {module?.features && module.features.length > 0 && (
                <ul className="mb-6 space-y-2">
                    {module.features.slice(0, 4).map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-gray-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            {formatFeatureName(feature)}
                        </li>
                    ))}
                </ul>
            )}

            <button
                onClick={onUpgradeClick}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-gray-900 font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/20"
            >
                <Crown className="w-5 h-5" />
                Ativar Agora
                <ArrowRight className="w-5 h-5" />
            </button>
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
                    <div className="text-gray-500 text-xs">/mês</div>

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

                {/* Seletor de período */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setBillingCycle('monthly')}
                        className={`flex-1 py-3 px-4 rounded-lg border transition-all ${billingCycle === 'monthly'
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <div className="font-semibold">Mensal</div>
                        <div className="text-sm opacity-70">R$ {module.price_monthly.toFixed(2)}/mês</div>
                    </button>

                    <button
                        onClick={() => setBillingCycle('yearly')}
                        className={`flex-1 py-3 px-4 rounded-lg border transition-all relative ${billingCycle === 'yearly'
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        {discount > 0 && (
                            <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                                -{discount}%
                            </span>
                        )}
                        <div className="font-semibold">Anual</div>
                        <div className="text-sm opacity-70">
                            R$ {(module.price_yearly || module.price_monthly * 10).toFixed(2)}/ano
                        </div>
                    </button>
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
