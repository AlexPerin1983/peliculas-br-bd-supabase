import React from 'react';
import { Drawer } from 'vaul';
import { Ban, Copy, Crown, MessageCircle, Shield, Trash2, Unlock, X } from 'lucide-react';
import ActionButton from '../ui/ActionButton';
import { UserWithSubscription, isUserAdmin } from '../../src/hooks/useAdminUsers';
import { EngagementRow } from '../../src/hooks/useAdminEngagement';
import { useAdminCompanyDetail } from '../../src/hooks/useAdminCompanyDetail';
import { useIsMobile } from '../../src/hooks/useIsMobile';
import { buildWhatsappLink, formatInt, formatMoney, monthLabel, relativeDays } from './adminFormat';
import { MiniBars } from './charts/MiniBars';
import { AdminAccessPanel } from './AdminAccessPanel';
import { CompanyStatusBadge, deriveCompanyStatus } from './companyStatus';

interface AdminCompanyDrawerProps {
    profile: UserWithSubscription | null;
    engagement?: EngagementRow;
    activatingModule: { userId: string; moduleId: string } | null;
    revokingModule: { userId: string; moduleId: string } | null;
    busyUser: { userId: string; action: 'block' | 'delete' } | null;
    feedback: { type: 'error' | 'success'; message: string } | null;
    onClose: () => void;
    activateModuleForUser: (profile: UserWithSubscription, moduleId: string, days: number) => void;
    revokeModuleForUser: (profile: UserWithSubscription, moduleId: string) => void;
    setUserBlocked: (profile: UserWithSubscription, blocked: boolean) => void;
    deleteUser: (profile: UserWithSubscription) => void;
    isModuleActive: (profile: UserWithSubscription, moduleId: string) => boolean;
}

const KpiCell: React.FC<{ label: string; value: React.ReactNode; accent?: string }> = ({ label, value, accent = 'text-slate-900 dark:text-white' }) => (
    <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className={`text-lg font-bold ${accent}`}>{value}</div>
    </div>
);

export const AdminCompanyDrawer: React.FC<AdminCompanyDrawerProps> = ({
    profile,
    engagement,
    activatingModule,
    revokingModule,
    busyUser,
    feedback,
    onClose,
    activateModuleForUser,
    revokeModuleForUser,
    setUserBlocked,
    deleteUser,
    isModuleActive,
}) => {
    const open = !!profile;
    const isMobile = useIsMobile();
    const { series, loading: loadingSeries, error: seriesError } = useAdminCompanyDetail(profile?.id ?? null);
    const [copied, setCopied] = React.useState(false);

    const isAdmin = profile ? isUserAdmin(profile) : false;
    const hasFullPackage = profile ? isModuleActive(profile, 'pacote_completo') : false;
    const wa = buildWhatsappLink(engagement?.telefone);

    const copyEmail = async () => {
        if (!profile?.email) return;
        try {
            await navigator.clipboard.writeText(profile.email);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard indisponível */ }
    };

    const handleDelete = () => {
        if (!profile) return;
        if (!window.confirm(`EXCLUIR permanentemente ${profile.email}? Isso apaga login, dados e arquivos. NÃO pode ser desfeito.`)) return;
        const typed = window.prompt(`Para confirmar, digite o email do usuário:\n${profile.email}`);
        if (typed?.trim().toLowerCase() !== (profile.email || '').toLowerCase()) {
            if (typed !== null) window.alert('Email não confere. Exclusão cancelada.');
            return;
        }
        deleteUser(profile);
        onClose();
    };

    const title = engagement?.empresa || profile?.email || 'Empresa';

    return (
        <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()} direction={isMobile ? 'bottom' : 'right'}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
                <Drawer.Content
                    className={isMobile
                        ? 'fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col rounded-t-2xl bg-white outline-none dark:bg-slate-900'
                        : 'fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col bg-white outline-none dark:bg-slate-900'}
                >
                    {isMobile && <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" />}
                    {profile && (
                        <>
                            {/* Header */}
                            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isAdmin
                                        ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                                        : hasFullPackage ? 'bg-gradient-to-br from-amber-400 to-yellow-500' : 'bg-slate-300 dark:bg-slate-600'
                                        }`}>
                                        {isAdmin ? <Shield className="h-5 w-5 text-white" /> : hasFullPackage ? <Crown className="h-5 w-5 text-white" /> : <span className="text-base font-bold text-white">{title.charAt(0).toUpperCase()}</span>}
                                    </div>
                                    <div className="min-w-0">
                                        <Drawer.Title className="truncate text-base font-bold text-slate-900 dark:text-white">{title}</Drawer.Title>
                                        <Drawer.Description className="truncate text-xs text-slate-500">{profile.email}</Drawer.Description>
                                    </div>
                                </div>
                                <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4">
                                {/* Contato + badges (fonte no contêiner: o botão herda) */}
                                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                                    <button type="button" onClick={copyEmail} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                                        <Copy className="h-3.5 w-3.5" /> {copied ? 'Copiado!' : 'Copiar email'}
                                    </button>
                                    {wa && (
                                        <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-300">
                                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                                        </a>
                                    )}
                                </div>
                                <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px]">
                                    <CompanyStatusBadge status={deriveCompanyStatus(profile)} />
                                    <span className="text-slate-400">Cadastro em {profile.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '—'}</span>
                                    <span className="text-slate-400">• {relativeDays(engagement?.ultima_atividade)}</span>
                                </div>

                                {/* Resultado da última ação (o aviso da página fica atrás do painel) */}
                                {feedback && (
                                    <div className={`mb-4 rounded-xl border px-3 py-2 text-sm ${feedback.type === 'error'
                                        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300'
                                        : 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-300'
                                        }`}>
                                        {feedback.message}
                                    </div>
                                )}

                                {/* Acesso: o que tem hoje + liberar / estender / remover */}
                                {!isAdmin && (
                                    <AdminAccessPanel
                                        profile={profile}
                                        activatingModule={activatingModule}
                                        revokingModule={revokingModule}
                                        onGrant={(moduleId, days) => activateModuleForUser(profile, moduleId, days)}
                                        onRevoke={(moduleId) => revokeModuleForUser(profile, moduleId)}
                                    />
                                )}

                                {/* KPIs da empresa */}
                                <div className="mb-4 grid grid-cols-3 gap-2">
                                    <KpiCell label="Orçamentos" value={formatInt(engagement?.orcamentos || 0)} />
                                    <KpiCell label="Clientes" value={formatInt(engagement?.clientes || 0)} />
                                    <KpiCell label="Agendamentos" value={formatInt(engagement?.agendamentos || 0)} />
                                    <KpiCell label="Serviços" value={formatInt(engagement?.servicos || 0)} />
                                    <div className="col-span-2">
                                        <KpiCell label="Faturamento gerado" value={<span className="text-rose-600 dark:text-rose-400">{formatMoney(engagement?.faturamento || 0)}</span>} />
                                    </div>
                                </div>

                                {/* Tendência */}
                                <div className="mb-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                                    <h4 className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Orçamentos por mês (12m)</h4>
                                    {loadingSeries ? (
                                        <div className="py-6 text-center text-xs text-slate-400">Carregando tendência…</div>
                                    ) : seriesError ? (
                                        <div className="py-6 text-center text-xs text-red-400">{seriesError}</div>
                                    ) : (
                                        <MiniBars
                                            colorClass="bg-blue-500"
                                            data={series.map(s => ({ label: monthLabel(s.mes), value: s.orcamentos, hint: `${monthLabel(s.mes)}: ${s.orcamentos} orç. · ${formatMoney(s.faturamento)}` }))}
                                        />
                                    )}
                                </div>

                            </div>

                            {/* Ações fixas */}
                            {!isAdmin && (
                                <div className="flex items-center gap-2 border-t border-slate-200 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-sm dark:border-slate-700">
                                    <ActionButton
                                        variant="secondary"
                                        size="sm"
                                        className="flex-1"
                                        loading={busyUser?.userId === profile.id && busyUser?.action === 'block'}
                                        loadingText="Salvando..."
                                        onClick={() => setUserBlocked(profile, !profile.blocked)}
                                    >
                                        {profile.blocked ? <span className="flex items-center justify-center gap-1"><Unlock className="h-4 w-4" /> Reativar</span> : <span className="flex items-center justify-center gap-1"><Ban className="h-4 w-4" /> Bloquear</span>}
                                    </ActionButton>
                                    <button
                                        type="button"
                                        disabled={busyUser?.userId === profile.id}
                                        onClick={handleDelete}
                                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                                    >
                                        <Trash2 className="h-4 w-4" /> {busyUser?.userId === profile.id && busyUser?.action === 'delete' ? 'Excluindo...' : 'Excluir'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
};

export default AdminCompanyDrawer;
