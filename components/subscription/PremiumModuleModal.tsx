import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import {
    ArrowRight,
    CheckCircle2,
    CreditCard,
    Crown,
    Lock,
    Package,
    QrCode,
    Scissors,
    Sparkles,
    Users,
    X,
    MapPin,
    Palette,
    Brain,
    Infinity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { type SubscriptionModule } from '../../services/subscriptionService';
import {
    createAbacatePixCheckoutForModule,
    createAbacateSubscriptionCheckoutForModule
} from '../../services/abacateBillingService';

interface PremiumModuleModalProps {
    isOpen: boolean;
    module: SubscriptionModule | null;
    onClose: () => void;
}

type FeedbackMessage = {
    type: 'error' | 'success';
    text: string;
};

const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

const formatFeatureName = (feature: string) =>
    feature.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

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
        Lock,
        Scissors
    };

    return icons[iconName as keyof typeof icons] || Crown;
};

export const PremiumModuleModal: React.FC<PremiumModuleModalProps> = ({
    isOpen,
    module,
    onClose
}) => {
    const { isAdmin, isOwner, memberRole } = useAuth();
    const [billingAction, setBillingAction] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);

    const canManageBilling =
        isAdmin || isOwner || memberRole === 'owner' || memberRole === 'admin';

    const moduleFeatures = useMemo(() => {
        if (!module?.features?.length) {
            return [
                'Liberacao imediata apos confirmacao',
                'Acesso premium para sua equipe',
                'Checkout e cobranca organizados',
                'Suporte para evoluir depois'
            ];
        }

        return module.features.slice(0, 4).map(formatFeatureName);
    }, [module]);

    const validityMonths = module?.validity_months || 6;
    useEffect(() => {
        if (!isOpen) {
            setBillingAction(null);
            setFeedback(null);
            return;
        }

        setBillingAction(null);
        setFeedback(null);
    }, [isOpen, module?.id]);

    if (!isOpen || !module) {
        return null;
    }

    const DynamicIcon = getIconComponent(module?.icon);

    const handlePixCheckout = async () => {
        if (!canManageBilling) {
            return;
        }

        const actionKey = `pix:${module.id}`;
        setBillingAction(actionKey);
        setFeedback(null);

        try {
            const result = await createAbacatePixCheckoutForModule(module.id);

            if (!result.success) {
                setFeedback({ type: 'error', text: result.error });
                return;
            }

            window.location.assign(result.url);
        } finally {
            setBillingAction(null);
        }
    };

    const handleSubscriptionCheckout = async () => {
        if (!canManageBilling || !module.abacate_subscription_product_id) {
            return;
        }

        const actionKey = `subscription:${module.id}`;
        setBillingAction(actionKey);
        setFeedback(null);

        try {
            const result = await createAbacateSubscriptionCheckoutForModule(module.id);

            if (!result.success) {
                setFeedback({ type: 'error', text: result.error });
                return;
            }

            window.location.assign(result.url);
        } finally {
            setBillingAction(null);
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-[12000] overflow-y-auto bg-slate-950/72 p-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-sm sm:p-4">
            <div className="flex min-h-[100dvh] items-start justify-center py-3 sm:min-h-full sm:items-center sm:py-0">
                <div className="flex max-h-[calc(100dvh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900 sm:max-h-[calc(100dvh-32px)] sm:rounded-[28px]">
                <div className="shrink-0 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-4 py-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 sm:px-6 sm:py-5">
                    <div className="flex items-start gap-3 sm:gap-4">
                        <div className="flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/10 dark:bg-white dark:text-slate-900 sm:h-12 sm:w-12 sm:min-h-12 sm:min-w-12">
                            <DynamicIcon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                                <Crown className="h-3.5 w-3.5" />
                                Premium
                            </div>
                            <h3 className="text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                                Contratar {module.name}
                            </h3>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                                {module.description ||
                                    'Contrate este recurso premium para sua empresa.'}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                <div className="grid gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-5">
                    <div className="space-y-4 sm:space-y-5">
                        <div className="rounded-[22px] border border-slate-200 bg-slate-50/90 p-3.5 shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-950/60 sm:p-4">
                            <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        Plano selecionado
                                    </p>
                                    <div className="mt-2 flex items-end gap-2">
                                        <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                                            {formatCurrency(module.price_monthly)}
                                        </span>
                                        <span className="pb-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400 sm:text-sm">
                                            / {module.validity_months || 6} meses
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col">
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300 sm:px-4 sm:py-3 sm:text-sm sm:text-left">
                                        Acesso imediato
                                    </div>
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300 sm:px-4 sm:py-3 sm:text-sm sm:text-left">
                                        7 dias de garantia
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
                            <div className="mb-3 flex items-center gap-2 text-slate-900 dark:text-white sm:mb-4">
                                <Sparkles className="h-4 w-4 text-indigo-500" />
                                <h4 className="text-sm font-semibold sm:text-base">
                                    O que voce libera com este plano
                                </h4>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                                {moduleFeatures.map((feature) => (
                                    <div
                                        key={feature}
                                        className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/50 sm:gap-3 sm:py-3"
                                    >
                                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                        </div>
                                        <p className="text-sm leading-5 text-slate-600 dark:text-slate-300">
                                            {feature}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {feedback && (
                            <div
                                className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                                    feedback.type === 'success'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
                                        : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300'
                                }`}
                            >
                                {feedback.text}
                            </div>
                        )}
                    </div>

                    <div className="space-y-3 sm:space-y-4">
                        {canManageBilling ? (
                            <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,1),rgba(255,255,255,0.96))] p-4 shadow-[0_20px_60px_rgba(15,23,42,0.10)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.96))] sm:p-5">
                                <div className="mb-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        Como voce quer contratar
                                    </p>
                                    <h4 className="mt-2 text-base font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                                        Escolha e siga para o checkout
                                    </h4>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        type="button"
                                        onClick={handlePixCheckout}
                                        disabled={billingAction === `pix:${module.id}`}
                                        className="group w-full rounded-[22px] border border-emerald-200 bg-emerald-50/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:hover:border-emerald-800"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
                                                <QrCode className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <h5 className="text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
                                                            Pagar agora
                                                        </h5>
                                                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                                            Compra unica com {validityMonths} meses de acesso.
                                                        </p>
                                                    </div>
                                                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-emerald-600 transition-transform group-hover:translate-x-0.5 dark:text-emerald-300" />
                                                </div>
                                            </div>
                                        </div>
                                    </button>

                                    {module.abacate_subscription_product_id ? (
                                        <button
                                            type="button"
                                            onClick={handleSubscriptionCheckout}
                                            disabled={billingAction === `subscription:${module.id}`}
                                            className="group w-full rounded-[22px] border border-blue-200 bg-blue-50/75 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-900/40 dark:bg-blue-950/20 dark:hover:border-blue-800"
                                        >
                                            <div className="flex items-start gap-3">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                                                <CreditCard className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <h5 className="text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
                                                            Assinar
                                                        </h5>
                                                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                                            Renovacao automatica a cada {validityMonths} meses.
                                                        </p>
                                                    </div>
                                                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-blue-600 transition-transform group-hover:translate-x-0.5 dark:text-blue-300" />
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-blue-300 bg-white/80 px-4 py-3 text-sm text-slate-600 dark:border-blue-900/40 dark:bg-slate-950/30 dark:text-slate-300">
                                            Assinatura indisponivel no momento.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
                                <div className="mb-3 flex items-center gap-3 text-amber-900 dark:text-amber-100">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                                        <Lock className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold">Contratacao restrita</h4>
                                        <p className="text-sm text-amber-700 dark:text-amber-300/80">
                                            Apenas owner ou admin pode concluir a compra.
                                        </p>
                                    </div>
                                </div>

                                <p className="text-sm leading-6 text-amber-800 dark:text-amber-200">
                                    Se voce precisa deste recurso, fale com o responsavel da empresa para
                                    contratar o plano.
                                </p>
                            </div>
                        )}
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
};
