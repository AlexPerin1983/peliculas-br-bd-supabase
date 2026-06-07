import React, { useMemo, useState } from 'react';
import {
    ArrowRight,
    Brain,
    CheckCircle2,
    Crown,
    Infinity,
    Lock,
    MapPin,
    Package,
    Palette,
    QrCode,
    Scissors,
    Sparkles,
    Users
} from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PremiumModuleModal } from './PremiumModuleModal';

interface PremiumFeatureSectionProps {
    moduleId: string;
    title?: string;
    description?: string;
    variant?: 'hero' | 'inline';
}

const premiumHighlights: Record<string, string[]> = {
    qr_servicos: [
        'QR unico por servico',
        'Historico publico para o cliente',
        'Mais valor percebido no pos-venda'
    ],
    ia_ocr: [
        'Cadastro por imagem e audio',
        'Menos digitacao manual',
        'Fluxo mais rapido para a equipe'
    ],
    estoque: [
        'Controle de bobinas e sobras',
        'Menos desperdicio operacional',
        'Base mais organizada para crescer'
    ],
    corte_inteligente: [
        'Plano de corte mais inteligente',
        'Historico de versoes',
        'Economia real de material'
    ],
    colaboradores: [
        'Gestao de acessos e equipe',
        'Convites mais organizados',
        'Operacao centralizada'
    ],
    personalizacao: [
        'Cores da empresa',
        'Assinatura digital',
        'Propostas com mais autoridade'
    ],
    ilimitado: [
        'Clientes sem limite',
        'Propostas sem gargalo',
        'Base pronta para escalar'
    ],
    locais_global: [
        'Locais reaproveitaveis',
        'Mais velocidade nas propostas',
        'Menos trabalho repetitivo'
    ]
};

const resolveIcon = (iconName?: string) => {
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

const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

const formatFeatureName = (feature: string) =>
    feature.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export const PremiumFeatureSection: React.FC<PremiumFeatureSectionProps> = ({
    moduleId,
    title,
    description,
    variant = 'hero'
}) => {
    const { modules } = useSubscription();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const module = modules.find((item) => item.id === moduleId) || null;
    const DynamicIcon = resolveIcon(module?.icon);
    const features = useMemo(() => {
        if (module?.features?.length) {
            return module.features.slice(0, 3).map(formatFeatureName);
        }

        return premiumHighlights[moduleId] || [
            'Fluxo premium com mais controle',
            'Experiencia mais profissional',
            'Contratacao simples e organizada'
        ];
    }, [module, moduleId]);

    const resolvedTitle = title || module?.name || 'Recurso premium';
    const resolvedDescription =
        description ||
        module?.description ||
        'Ative este recurso premium para liberar a funcionalidade completa no seu fluxo.';

    if (variant === 'inline') {
        return (
            <>
                <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900 sm:px-5">
                        <div className="flex items-start gap-3 sm:gap-4">
                            <div className="flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/10 dark:bg-white dark:text-slate-900">
                                <DynamicIcon className="h-[18px] w-[18px]" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                                    <Crown className="h-3.5 w-3.5" />
                                    Premium
                                </div>
                                <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                                    {resolvedTitle}
                                </h3>
                                <p className="mt-1 text-sm leading-7 text-slate-500 dark:text-slate-400 sm:leading-6">
                                    {resolvedDescription}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
                        <div className="grid gap-3 sm:grid-cols-3">
                            {features.map((feature) => (
                                <div
                                    key={feature}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300"
                                >
                                    {feature}
                                </div>
                            ))}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                            <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                    Plano premium
                                </p>
                                <div className="mt-2 flex items-end gap-2">
                                    <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                                        {formatCurrency(module?.price_monthly || 39)}
                                    </span>
                                    <span className="pb-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                                        / {module?.validity_months || 6} meses
                                    </span>
                                </div>
                            </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 sm:mt-4"
                            >
                                <Sparkles className="h-4 w-4" />
                                Ver plano
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <PremiumModuleModal
                    isOpen={isModalOpen}
                    module={module}
                    onClose={() => setIsModalOpen(false)}
                />
            </>
        );
    }

    return (
        <>
            <div className="flex items-start justify-center px-3 py-3 sm:min-h-[56vh] sm:items-center sm:p-8">
                <div className="w-full max-w-4xl overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_20px_56px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 sm:rounded-[28px] sm:shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
                    <div className="grid gap-4 px-4 py-4 sm:px-8 sm:py-8 lg:grid-cols-[1.15fr,0.85fr] lg:gap-8">
                        <div className="space-y-4 sm:space-y-5">
                            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300 sm:text-[11px]">
                                <Crown className="h-3.5 w-3.5" />
                                Premium
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div className="flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl shadow-slate-900/10 dark:bg-white dark:text-slate-900 sm:h-14 sm:w-14 sm:min-h-14 sm:min-w-14">
                                        <DynamicIcon className="h-[18px] w-[18px] sm:h-6 sm:w-6" />
                                    </div>
                                    <h2 className="text-[1.1rem] font-black leading-[1.08] tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                                        {resolvedTitle}
                                    </h2>
                                </div>
                                <p className="max-w-2xl text-[15px] leading-7 text-slate-500 dark:text-slate-400 sm:text-base">
                                    {resolvedDescription}
                                </p>
                            </div>

                            <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
                                {features.map((feature) => (
                                    <div
                                        key={feature}
                                        className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-3.5 py-3 dark:border-slate-800 dark:bg-slate-950/50 sm:block sm:rounded-[22px] sm:px-4 sm:py-4"
                                    >
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 sm:mb-3 sm:h-9 sm:w-9 sm:rounded-2xl">
                                            <CheckCircle2 className="h-4 w-4" />
                                        </div>
                                        <p className="text-sm font-medium leading-5 text-slate-700 dark:text-slate-300 sm:leading-6">
                                            {feature}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 sm:space-y-4 sm:rounded-[28px] sm:p-5">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                    Plano premium
                                </p>
                                <div className="mt-2 flex items-end justify-between gap-3 sm:mt-3 sm:justify-start sm:gap-2">
                                    <span className="whitespace-nowrap text-[2.15rem] font-black leading-none tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                                        {formatCurrency(module?.price_monthly || 39)}
                                    </span>
                                    <span className="pb-1 text-right text-sm font-medium leading-5 text-slate-500 dark:text-slate-400 sm:text-left">
                                        / {module?.validity_months || 6} meses
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 sm:px-5 sm:py-3.5"
                            >
                                <Sparkles className="h-4 w-4" />
                                Contratar plano
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <PremiumModuleModal
                isOpen={isModalOpen}
                module={module}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    );
};
