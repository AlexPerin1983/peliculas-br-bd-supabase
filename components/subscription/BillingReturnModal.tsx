import React from 'react';
import ReactDOM from 'react-dom';
import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    CreditCard,
    QrCode,
    RefreshCw,
    ShieldCheck,
    X
} from 'lucide-react';

export type BillingReturnStatus = 'waiting' | 'confirmed' | 'timeout' | 'cancelled';
export type BillingReturnMode = 'pix' | 'subscription';

interface BillingReturnModalProps {
    isOpen: boolean;
    status: BillingReturnStatus;
    mode: BillingReturnMode;
    moduleName: string;
    attempts?: number;
    onClose: () => void;
}

const modeCopy: Record<BillingReturnMode, { badge: string; summary: string }> = {
    pix: {
        badge: 'Compra avulsa',
        summary: 'Pagamento unico para liberar o modulo por 6 meses.'
    },
    subscription: {
        badge: 'Assinatura semestral',
        summary: 'Renovacao automatica a cada 6 meses no cartao.'
    }
};

function getStatusConfig(
    status: BillingReturnStatus,
    moduleName: string,
    attempts: number
) {
    switch (status) {
        case 'confirmed':
            return {
                icon: CheckCircle2,
                iconClassName:
                    'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
                title: 'Acesso liberado',
                description: `O modulo ${moduleName} ja foi confirmado e esta ativo na sua conta.`,
                detail:
                    'Voce pode fechar esta mensagem e continuar usando o app normalmente.',
                detailTone: 'text-emerald-700 dark:text-emerald-300',
                actionLabel: 'Continuar'
            };
        case 'timeout':
            return {
                icon: AlertTriangle,
                iconClassName:
                    'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
                title: 'Pagamento recebido, aguardando confirmacao',
                description: `Recebemos o retorno do checkout de ${moduleName}, mas a confirmacao ainda esta chegando no sistema.`,
                detail:
                    'Isso costuma se resolver em instantes. Se preferir, feche esta mensagem e volte em Minha Conta.',
                detailTone: 'text-amber-700 dark:text-amber-300',
                actionLabel: 'Entendi'
            };
        case 'cancelled':
            return {
                icon: X,
                iconClassName:
                    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                title: 'Checkout cancelado',
                description:
                    'Nenhuma cobranca foi concluida. Quando quiser, voce pode tentar novamente.',
                detail:
                    'Se voce fechou a janela por engano, basta voltar ao modulo e iniciar a compra de novo.',
                detailTone: 'text-slate-600 dark:text-slate-300',
                actionLabel: 'Voltar'
            };
        case 'waiting':
        default:
            return {
                icon: Clock3,
                iconClassName:
                    'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
                title: 'Pagamento em verificacao',
                description: `Estamos validando a liberacao do modulo ${moduleName}. Isso normalmente leva poucos segundos.`,
                detail:
                    attempts > 0
                        ? `Revalidando automaticamente o acesso. Tentativa ${attempts} de 8.`
                        : 'Assim que a AbacatePay confirmar o pagamento, o modulo sera liberado automaticamente.',
                detailTone: 'text-blue-700 dark:text-blue-300',
                actionLabel: 'Continuar usando o app'
            };
    }
}

export const BillingReturnModal: React.FC<BillingReturnModalProps> = ({
    isOpen,
    status,
    mode,
    moduleName,
    attempts = 0,
    onClose
}) => {
    if (!isOpen) {
        return null;
    }

    const config = getStatusConfig(status, moduleName, attempts);
    const StatusIcon = config.icon;
    const isWaiting = status === 'waiting';

    const modalContent = (
        <div className="fixed inset-0 z-[13000] flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.28)] dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 sm:px-6 sm:py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                                {mode === 'pix' ? (
                                    <QrCode className="h-3.5 w-3.5" />
                                ) : (
                                    <CreditCard className="h-3.5 w-3.5" />
                                )}
                                {modeCopy[mode].badge}
                            </div>
                            <h3 className="mt-3 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                                {config.title}
                            </h3>
                            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                {modeCopy[mode].summary}
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

                <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
                    <div className="flex items-start gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                        <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${config.iconClassName}`}
                        >
                            {isWaiting ? (
                                <RefreshCw className="h-5 w-5 animate-spin" />
                            ) : (
                                <StatusIcon className="h-5 w-5" />
                            )}
                        </div>

                        <div className="min-w-0">
                            <p className="text-base font-semibold text-slate-900 dark:text-white">
                                {config.description}
                            </p>
                            <p className={`mt-2 text-sm leading-6 ${config.detailTone}`}>
                                {config.detail}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-3 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                                <ShieldCheck className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {moduleName}
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {modeCopy[mode].summary}
                                </p>
                            </div>
                        </div>

                        {isWaiting && (
                            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
                                Se voce ja concluiu o pagamento, pode deixar esta tela aberta que nos fazemos a revalidacao automaticamente.
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-[20px] bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                    >
                        {config.actionLabel}
                    </button>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') {
        return modalContent;
    }

    return ReactDOM.createPortal(modalContent, document.body);
};
