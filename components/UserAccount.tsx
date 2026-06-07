import React, { useEffect, useState } from 'react';
import {
    ArrowRight,
    Brain,
    CalendarClock,
    Check,
    Crown,
    Infinity,
    LogOut,
    MapPin,
    Palette,
    Package,
    QrCode,
    Scissors,
    Sparkles,
    Users,
    Zap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { supabase } from '../services/supabaseClient';
import { type SubscriptionModule } from '../services/subscriptionService';
import { cancelAbacateSubscriptionForModule } from '../services/abacateBillingService';
import { PremiumModuleModal } from './subscription/PremiumModuleModal';

type FeedbackMessage = {
    type: 'error' | 'success';
    text: string;
};

const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;
const formatDate = (value?: string | null) =>
    value
        ? new Date(value).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
          })
        : null;

const buildFallbackPackageModule = (): SubscriptionModule => ({
    id: 'pacote_completo',
    name: 'Pacote Completo',
    description: 'Libera todos os modulos premium em uma unica assinatura.',
    price_monthly: 149,
    price_yearly: null,
    icon: 'Crown',
    features: [],
    is_active: true,
    sort_order: 0,
    validity_months: 6,
    abacate_subscription_product_id: null
});

const getIconComponent = (iconName?: string) => {
    const icons = {
        Package,
        QrCode,
        Users,
        Brain,
        Palette,
        Infinity,
        MapPin,
        Crown,
        Scissors
    };

    return icons[iconName as keyof typeof icons] || Package;
};

export const UserAccount: React.FC = () => {
    const { user, signOut, isAdmin, isOwner, memberRole } = useAuth();
    const { info, modules, isLoading: subscriptionLoading, hasModule, refresh } = useSubscription();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<FeedbackMessage | null>(null);
    const [billingMessage, setBillingMessage] = useState<FeedbackMessage | null>(null);
    const [cancelLoading, setCancelLoading] = useState<string | null>(null);
    const [showActivateModal, setShowActivateModal] = useState<string | null>(null);

    const packageModule =
        modules.find((module) => module.id === 'pacote_completo') || buildFallbackPackageModule();
    const regularModules = modules
        .filter((module) => module.id !== 'pacote_completo')
        .sort((left, right) => (left.sort_order || 99) - (right.sort_order || 99));

    const activeModulesCount = info?.active_modules?.length || 0;
    const hasFullPackage = hasModule('pacote_completo') || hasModule('ilimitado');
    const totalRegularPrice = regularModules.reduce(
        (total, module) => total + (module.price_monthly || 0),
        0
    );
    const packageDiscount = Math.max(totalRegularPrice - packageModule.price_monthly, 0);
    const packageDiscountPercent =
        totalRegularPrice > 0
            ? Math.round((packageDiscount / totalRegularPrice) * 100)
            : 0;
    const canManageBilling =
        isAdmin || isOwner || memberRole === 'owner' || memberRole === 'admin';

    const selectedModule =
        showActivateModal === 'pacote_completo'
            ? packageModule
            : modules.find((module) => module.id === showActivateModal) || null;

    useEffect(() => {
        if (subscriptionLoading) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const upgradeParam = params.get('upgrade');

        if (!upgradeParam) {
            return;
        }

        const moduleExists =
            upgradeParam === 'pacote_completo' ||
            modules.some((module) => module.id === upgradeParam);

        if (!moduleExists) {
            return;
        }

        setShowActivateModal(upgradeParam);

        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete('upgrade');
        window.history.replaceState(
            {},
            '',
            `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
        );
    }, [modules, subscriptionLoading]);

    const getModuleDetail = (moduleId: string) =>
        info?.modules_detail?.find((module) => module.module_id === moduleId) || null;

    const fullPackageDetail =
        getModuleDetail('pacote_completo') || getModuleDetail('ilimitado');

    const fullPackageModuleId = fullPackageDetail?.module_id || 'pacote_completo';
    const activeCoverageCount = hasFullPackage ? regularModules.length : activeModulesCount;
    const packageMonthlyEquivalent = packageModule.price_monthly / (packageModule.validity_months || 6);

    const getEffectiveModuleDetail = (moduleId: string) => {
        if (hasFullPackage && fullPackageDetail && moduleId !== 'pacote_completo') {
            return {
                ...fullPackageDetail,
                module_id: moduleId
            };
        }

        return getModuleDetail(moduleId);
    };

    const getModuleExpiry = (moduleId: string) => {
        const detail = getEffectiveModuleDetail(moduleId);
        if (!detail?.expires_at) {
            return null;
        }

        const expiry = new Date(detail.expires_at);
        const now = new Date();
        const daysLeft = Math.ceil(
            (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        return { expiry, daysLeft };
    };

    const handleCancelRecurring = async (moduleId: string) => {
        setCancelLoading(moduleId);
        setBillingMessage(null);

        try {
            const result = await cancelAbacateSubscriptionForModule(moduleId);

            if (!result.success) {
                setBillingMessage({
                    type: 'error',
                    text: result.error || 'Não foi possível cancelar a renovação.'
                });
                return;
            }

            await refresh();
            setBillingMessage({
                type: 'success',
                text: result.expiresAt
                    ? `Renovacao cancelada. O acesso segue ativo ate ${formatDate(result.expiresAt)}.`
                    : 'Renovacao cancelada com sucesso.'
            });
        } finally {
            setCancelLoading(null);
        }
    };

    const handleUpdatePassword = async (event: React.FormEvent) => {
        event.preventDefault();

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'As senhas não coincidem.' });
            return;
        }

        if (newPassword.length < 6) {
            setPasswordMessage({
                type: 'error',
                text: 'A senha deve ter pelo menos 6 caracteres.'
            });
            return;
        }

        setPasswordLoading(true);
        setPasswordMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });

            if (error) {
                throw error;
            }

            setPasswordMessage({
                type: 'success',
                text: 'Senha atualizada com sucesso.'
            });
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            setPasswordMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Erro ao atualizar senha.'
            });
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <>
            <div className="space-y-5 pb-10 xl:grid xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.55fr)] xl:items-start xl:gap-5 xl:space-y-0">
                <section className="ui-surface overflow-hidden">
                    <header className="border-b border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="ui-icon-frame h-11 w-11 shrink-0 text-[var(--brand-primary)]">
                                    <Crown className="h-5 w-5" aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="ui-kicker">Assinatura</p>
                                    <h3 className="text-lg font-bold text-[var(--text-strong)]">
                                        Meu Plano
                                    </h3>
                                    <p className="text-sm text-[var(--text-muted)]">
                                        Gerencie modulos, cobranca e upgrades.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 sm:min-w-[340px]">
                                <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2">
                                    <p className="ui-kicker">Status</p>
                                    <p className="mt-1 text-sm font-bold text-[var(--text-strong)]">
                                        {hasFullPackage ? 'Completo' : activeModulesCount > 0 ? 'Ativo' : 'Free'}
                                    </p>
                                </div>
                                <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2">
                                    <p className="ui-kicker">Cobertura</p>
                                    <p className="mt-1 text-sm font-bold text-[var(--text-strong)]">
                                        {activeCoverageCount}
                                    </p>
                                </div>
                                <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2">
                                    <p className="ui-kicker">Gestao</p>
                                    <p className="mt-1 text-sm font-bold text-[var(--text-strong)]">
                                        {canManageBilling ? 'Admin' : 'Leitura'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </header>

                    <div className="space-y-5 p-4 sm:p-5">
                        {subscriptionLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--brand-primary)]" />
                            </div>
                        ) : (
                            <>
                                {billingMessage && (
                                    <div
                                        className={`rounded-[var(--radius-panel)] border p-3 text-sm font-semibold sm:p-4 ${
                                            billingMessage.type === 'error'
                                                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
                                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                                        }`}
                                    >
                                        {billingMessage.text}
                                    </div>
                                )}

                                {hasFullPackage ? (
                                    <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 shadow-[var(--shadow-hairline)] sm:p-5">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="flex min-w-0 items-start gap-3">
                                                <div className="ui-icon-frame h-12 w-12 shrink-0 text-[var(--brand-primary)]">
                                                    <Crown className="h-5 w-5" aria-hidden="true" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h4 className="text-lg font-bold text-[var(--text-strong)]">
                                                            Pacote Completo ativo
                                                        </h4>
                                                        <span className="rounded-full border border-[color-mix(in_srgb,var(--success)_28%,var(--border-subtle))] bg-[color-mix(in_srgb,var(--success)_10%,var(--surface))] px-2.5 py-1 text-[11px] font-bold text-[var(--success)]">
                                                            Em dia
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-[var(--text-muted)]">
                                                        Todos os modulos premium liberados.
                                                    </p>
                                                    {fullPackageDetail?.expires_at && (
                                                        <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">
                                                            Valido ate {formatDate(fullPackageDetail.expires_at)}
                                                        </p>
                                                    )}

                                                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                                                        <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2">
                                                            <p className="ui-kicker">Cobertura</p>
                                                            <p className="mt-1 text-sm font-bold text-[var(--text-strong)]">
                                                                {regularModules.length} modulos
                                                            </p>
                                                        </div>
                                                        <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2">
                                                            <p className="ui-kicker">Ciclo</p>
                                                            <p className="mt-1 text-sm font-bold text-[var(--text-strong)]">
                                                                6 meses
                                                            </p>
                                                        </div>
                                                        <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2">
                                                            <p className="ui-kicker">Status</p>
                                                            <p className="mt-1 text-sm font-bold text-[var(--text-strong)]">
                                                                {fullPackageDetail?.cancel_at_period_end ? 'Encerrando' : 'Em dia'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {fullPackageDetail?.is_recurring && (
                                                <div className="space-y-2 lg:min-w-[260px]">
                                                    <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-center text-xs font-semibold text-[var(--text-muted)] sm:px-4 sm:py-3 sm:text-sm">
                                                        {fullPackageDetail.cancel_at_period_end
                                                            ? 'Renovacao desativada para o proximo ciclo.'
                                                            : 'Renovacao automatica ativa a cada 6 meses.'}
                                                    </div>
                                                    {canManageBilling &&
                                                        !fullPackageDetail.cancel_at_period_end && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCancelRecurring(fullPackageModuleId)}
                                                                disabled={cancelLoading === fullPackageModuleId}
                                                                className="inline-flex w-full items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:py-3 sm:text-sm"
                                                            >
                                                                {cancelLoading === fullPackageModuleId
                                                                    ? 'Cancelando renovacao...'
                                                                    : 'Cancelar renovacao'}
                                                            </button>
                                                        )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : activeModulesCount > 0 ? (
                                    <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                                        <div className="flex items-center gap-2 text-[var(--success)]">
                                            <Check className="h-5 w-5" aria-hidden="true" />
                                            <span className="font-semibold">
                                                {activeModulesCount} modulo(s) ativo(s)
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                                        <p className="text-center text-sm text-[var(--text-muted)]">
                                            Você está no plano gratuito com recursos limitados.
                                        </p>
                                    </div>
                                )}

                                {!canManageBilling && (
                                    <div className="rounded-[var(--radius-panel)] border border-[color-mix(in_srgb,var(--warning)_28%,var(--border-subtle))] bg-[color-mix(in_srgb,var(--warning)_8%,var(--surface))] p-4 text-sm font-semibold text-[var(--text-body)]">
                                        Você pode consultar o plano da empresa, mas a contratação e a
                                        gestao da cobranca ficam restritas ao owner ou administrador.
                                    </div>
                                )}

                                {!hasFullPackage && (
                                    <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 shadow-[var(--shadow-hairline)] sm:p-5">
                                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
                                            <div className="min-w-0">
                                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1 text-[11px] font-bold uppercase text-[var(--brand-primary)]">
                                                        {packageDiscountPercent}% off
                                                    </span>
                                                    {totalRegularPrice > 0 && (
                                                        <span className="text-sm font-semibold text-[var(--text-soft)] line-through">
                                                            {formatCurrency(totalRegularPrice)}
                                                        </span>
                                                    )}
                                                </div>

                                                <h4 className="text-xl font-bold text-[var(--text-strong)]">
                                                    {packageModule.name}
                                                </h4>
                                                <p className="mt-1 text-sm text-[var(--text-muted)]">
                                                    Libera todos os {regularModules.length} modulos premium
                                                    por {packageModule.validity_months || 6} meses.
                                                </p>

                                                <div className="mt-4 flex flex-wrap items-baseline gap-2">
                                                    <span className="text-3xl font-bold text-[var(--text-strong)]">
                                                        {formatCurrency(packageModule.price_monthly)}
                                                    </span>
                                                    <span className="text-sm font-semibold text-[var(--text-muted)]">
                                                        / {packageModule.validity_months || 6} meses
                                                    </span>
                                                </div>

                                                <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-[var(--text-body)] sm:grid-cols-2">
                                                    {regularModules.slice(0, 8).map((module) => (
                                                        <div key={module.id} className="flex items-center gap-2">
                                                            <Check className="h-4 w-4 text-[var(--success)]" aria-hidden="true" />
                                                            <span>{module.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="grid gap-2">
                                                    <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2">
                                                        <p className="ui-kicker">Valor medio</p>
                                                        <p className="mt-1 text-sm font-bold text-[var(--text-strong)]">
                                                            {formatCurrency(packageMonthlyEquivalent)}/mês
                                                        </p>
                                                    </div>
                                                    <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2">
                                                        <p className="ui-kicker">Garantia</p>
                                                        <p className="mt-1 text-sm font-bold text-[var(--text-strong)]">
                                                            7 dias
                                                        </p>
                                                    </div>
                                                </div>

                                                {canManageBilling ? (
                                                    <button
                                                        onClick={() => setShowActivateModal(packageModule.id)}
                                                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--brand-primary)] px-4 text-sm font-bold text-white shadow-[0_12px_24px_rgba(21,94,239,0.18)] transition-colors hover:bg-[var(--brand-primary-strong)]"
                                                    >
                                                        <Zap className="h-4 w-4" aria-hidden="true" />
                                                        Ver pagamento
                                                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                                    </button>
                                                ) : (
                                                    <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-center text-sm font-semibold text-[var(--text-muted)]">
                                                        Contratacao apenas para owner ou admin.
                                                    </div>
                                                )}

                                                {fullPackageDetail?.cancel_at_period_end && (
                                                    <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5 text-center text-xs font-semibold text-[var(--text-muted)]">
                                                        Cancelamento agendado. Acesso ate{' '}
                                                        {formatDate(fullPackageDetail.expires_at)}.
                                                    </div>
                                                )}

                                                {packageDiscount > 0 && (
                                                    <p className="text-center text-xs text-[var(--text-muted)]">
                                                        Economia de {formatCurrency(packageDiscount)} contra compra avulsa.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h4 className="ui-kicker mb-3">Modulos disponiveis</h4>

                                    <div className="grid gap-3 lg:grid-cols-2">
                                        {regularModules.map((module) => {
                                            const DynamicIcon = getIconComponent(module.icon);
                                            const isActive = hasModule(module.id) || hasFullPackage;
                                            const moduleDetail = getEffectiveModuleDetail(module.id);
                                            const expiryInfo = getModuleExpiry(module.id);
                                            const moduleStatus = moduleDetail?.status || null;
                                            const inheritedFromPackage =
                                                hasFullPackage &&
                                                Boolean(fullPackageDetail) &&
                                                module.id !== fullPackageModuleId;

                                            return (
                                                <div
                                                    key={module.id}
                                                    className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-[var(--shadow-hairline)] transition-colors hover:border-[var(--border-strong)] sm:p-4"
                                                >
                                                    <div className="flex h-full flex-col gap-4">
                                                        <div className="flex min-w-0 items-start gap-3">
                                                            <div className={`ui-icon-frame h-10 w-10 shrink-0 ${isActive ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
                                                                <DynamicIcon className="h-5 w-5" aria-hidden="true" />
                                                            </div>

                                                            <div className="min-w-0">
                                                                <h5 className="text-base font-bold leading-tight text-[var(--text-strong)]">
                                                                    {module.name}
                                                                </h5>

                                                                {isActive ? (
                                                                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                                                                        <span className="font-bold text-[var(--success)]">
                                                                            Ativo
                                                                        </span>
                                                                        {expiryInfo && (
                                                                            <span className="text-[var(--text-muted)]">
                                                                                {expiryInfo.daysLeft} dias restantes
                                                                            </span>
                                                                        )}
                                                                        {!inheritedFromPackage &&
                                                                            moduleDetail?.cancel_at_period_end && (
                                                                                <span className="rounded-full border border-[color-mix(in_srgb,var(--warning)_28%,var(--border-subtle))] bg-[color-mix(in_srgb,var(--warning)_8%,var(--surface))] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning)]">
                                                                                    Cancelado ao fim do periodo
                                                                                </span>
                                                                            )}
                                                                        {!inheritedFromPackage &&
                                                                            moduleDetail?.is_recurring &&
                                                                            !moduleDetail?.cancel_at_period_end && (
                                                                                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--brand-primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand-primary)]">
                                                                                    Renovacao automatica
                                                                                </span>
                                                                            )}
                                                                        {inheritedFromPackage && (
                                                                            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-muted)]">
                                                                                Coberto pelo pacote completo
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="mt-1 space-y-1.5">
                                                                        <p className="text-sm leading-snug text-[var(--text-muted)]">
                                                                            {module.description}
                                                                        </p>
                                                                        {moduleStatus === 'expired' && (
                                                                            <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                                                                                Assinatura vencida
                                                                            </span>
                                                                        )}
                                                                        {moduleStatus === 'pending' &&
                                                                            moduleDetail?.payment_provider === 'abacatepay' && (
                                                                                <span className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--warning)_28%,var(--border-subtle))] bg-[color-mix(in_srgb,var(--warning)_8%,var(--surface))] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning)]">
                                                                                    Pagamento pendente
                                                                                </span>
                                                                            )}
                                                                        {moduleStatus === 'cancelled' &&
                                                                            moduleDetail?.payment_provider === 'abacatepay' && (
                                                                                <span className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-muted)]">
                                                                                    Assinatura encerrada
                                                                                </span>
                                                                            )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="mt-auto border-t border-[var(--border-subtle)] pt-3">
                                                            {isActive ? (
                                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                                    <div className="space-y-1">
                                                                        {moduleDetail?.expires_at && (
                                                                            <div className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                                                                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                                                                                Valido ate {formatDate(moduleDetail.expires_at)}
                                                                            </div>
                                                                        )}
                                                                        {!inheritedFromPackage && moduleDetail?.is_recurring && (
                                                                            <div className="text-xs font-semibold text-[var(--brand-primary)]">
                                                                                Cobranca recorrente semestral
                                                                            </div>
                                                                        )}
                                                                        {!inheritedFromPackage && moduleDetail?.cancel_at_period_end && (
                                                                            <div className="text-xs font-semibold text-[var(--warning)]">
                                                                                Renovacao desativada
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {!inheritedFromPackage &&
                                                                        canManageBilling &&
                                                                        moduleDetail?.is_recurring &&
                                                                        !moduleDetail?.cancel_at_period_end && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleCancelRecurring(module.id)}
                                                                                disabled={cancelLoading === module.id}
                                                                                className="inline-flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-60"
                                                                            >
                                                                                {cancelLoading === module.id
                                                                                    ? 'Cancelando...'
                                                                                    : 'Cancelar renovacao'}
                                                                            </button>
                                                                        )}
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                                                    <div>
                                                                        <div className="text-lg font-bold leading-none text-[var(--text-strong)]">
                                                                            {formatCurrency(module.price_monthly)}
                                                                        </div>
                                                                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                                                                            / {module.validity_months || 6} meses
                                                                        </div>
                                                                        <div className="text-xs font-semibold text-[var(--text-soft)]">
                                                                            {formatCurrency(module.price_monthly / (module.validity_months || 6))}/mês
                                                                        </div>
                                                                    </div>

                                                                    {canManageBilling ? (
                                                                        <button
                                                                            onClick={() => setShowActivateModal(module.id)}
                                                                            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary-strong)]"
                                                                        >
                                                                            Ativar
                                                                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                                                                        </button>
                                                                    ) : (
                                                                        <div className="text-xs font-semibold text-[var(--text-muted)]">
                                                                            Solicite ao responsavel da empresa
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </section>

                <section className="ui-surface overflow-hidden xl:sticky xl:top-24">
                    <header className="border-b border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5">
                        <div className="flex items-center gap-3">
                            <div className="ui-icon-frame h-11 w-11 shrink-0 text-[var(--brand-primary)]">
                                <Users className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div>
                                <p className="ui-kicker">Acesso</p>
                                <h3 className="text-lg font-bold text-[var(--text-strong)]">
                                    Minha Conta
                                </h3>
                                <p className="text-sm text-[var(--text-muted)]">
                                    Credenciais e saida do sistema.
                                </p>
                            </div>
                        </div>
                    </header>

                    <div className="space-y-6 p-4 sm:p-5">
                        <div>
                            <h4 className="ui-kicker mb-3">Informacoes pessoais</h4>
                            <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                                <p className="text-xs font-semibold text-[var(--text-muted)]">Email</p>
                                <p className="mt-1 break-words font-semibold text-[var(--text-strong)]">
                                    {user?.email}
                                </p>
                            </div>
                        </div>

                        <div>
                            <h4 className="ui-kicker mb-3">Alterar senha</h4>

                            {passwordMessage && (
                                <div
                                    className={`mb-4 rounded-[var(--radius-control)] border p-4 text-sm font-semibold ${
                                        passwordMessage.type === 'error'
                                            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
                                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                                    }`}
                                >
                                    {passwordMessage.text}
                                </div>
                            )}

                            <form onSubmit={handleUpdatePassword} className="space-y-4">
                                <div>
                                    <label className="ui-label mb-1 block">Nova senha</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(event) => setNewPassword(event.target.value)}
                                        className="ui-field h-11 w-full px-4"
                                        placeholder="Digite a nova senha"
                                    />
                                </div>

                                <div>
                                    <label className="ui-label mb-1 block">Confirmar nova senha</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        className="ui-field h-11 w-full px-4"
                                        placeholder="Repita a nova senha"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={passwordLoading || !newPassword}
                                    className="inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-control)] bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {passwordLoading ? 'Atualizando...' : 'Atualizar senha'}
                                </button>
                            </form>
                        </div>

                        <div className="border-t border-[var(--border-subtle)] pt-5">
                            <h4 className="ui-kicker mb-3">Ajuda</h4>
                            <button
                                type="button"
                                onClick={() => window.dispatchEvent(new Event('peliculas-br-open-tour'))}
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface)]"
                            >
                                <Sparkles className="h-4 w-4 text-[var(--brand-primary)]" aria-hidden="true" />
                                Rever guia de primeiros passos
                            </button>
                        </div>

                        <div className="border-t border-[var(--border-subtle)] pt-5">
                            <button
                                onClick={signOut}
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/15"
                            >
                                <LogOut className="h-4 w-4" aria-hidden="true" />
                                Sair da conta
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            <PremiumModuleModal
                isOpen={Boolean(showActivateModal && selectedModule)}
                module={selectedModule}
                onClose={() => setShowActivateModal(null)}
            />
        </>
    );
};
