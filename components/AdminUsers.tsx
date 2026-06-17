import React from 'react';
import { Ban, Check, ChevronDown, ChevronUp, Crown, Clock, Shield, Trash2, Unlock, X, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ActionButton from './ui/ActionButton';
import ContentState from './ui/ContentState';
import { AdminUserEngagement } from './AdminUserEngagement';
import { AVAILABLE_MODULES, isTestAccount, isUserAdmin, useAdminUsers } from '../src/hooks/useAdminUsers';

export const AdminUsers: React.FC = () => {
    const { isAdmin } = useAuth();
    const {
        profiles,
        loading,
        expandedUser,
        setExpandedUser,
        activatingModule,
        grantingAll,
        busyUser,
        signupTrial,
        savingSignupTrial,
        saveSignupTrial,
        feedback,
        fetchProfiles,
        activateModuleForUser,
        grantFullAccessAll,
        setUserBlocked,
        deleteUser,
        getModuleExpiryDays,
        isModuleActive,
        usersWithModules,
        activeGrants,
    } = useAdminUsers(isAdmin);

    const [accessDays, setAccessDays] = React.useState(30);
    const [trialDays, setTrialDays] = React.useState(7);
    const [onlyTests, setOnlyTests] = React.useState(false);

    const visibleProfiles = onlyTests ? profiles.filter(isTestAccount) : profiles;

    const handleDeleteUser = (profile: typeof profiles[number]) => {
        if (!window.confirm(`EXCLUIR permanentemente ${profile.email}? Isso apaga login, dados e arquivos. NÃO pode ser desfeito.`)) return;
        const typed = window.prompt(`Para confirmar, digite o email do usuário:\n${profile.email}`);
        if (typed?.trim().toLowerCase() !== (profile.email || '').toLowerCase()) {
            if (typed !== null) window.alert('Email não confere. Exclusão cancelada.');
            return;
        }
        deleteUser(profile);
    };

    // Sincroniza o input de dias do trial quando a config carrega do banco
    React.useEffect(() => {
        if (signupTrial.days > 0) setTrialDays(signupTrial.days);
    }, [signupTrial.days]);

    const handleGrantAll = () => {
        if (window.confirm(`Liberar o Pacote Completo por ${accessDays} dia(s) para TODAS as organizações? Isso libera todos os módulos para todos os usuários.`)) {
            grantFullAccessAll(accessDays);
        }
    };

    const handleToggleTrial = () => {
        // Liga usando os dias do input; desliga mantendo o valor
        saveSignupTrial(!signupTrial.enabled, trialDays);
    };

    const handleSaveTrialDays = () => {
        saveSignupTrial(signupTrial.enabled, trialDays);
    };

    if (!isAdmin) return null;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{profiles.length}</div>
                    <div className="text-sm text-slate-500">Total Usuários</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                    <div className="text-2xl font-bold text-purple-500">{usersWithModules}</div>
                    <div className="text-sm text-slate-500">Com Módulos</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                    <div className="text-2xl font-bold text-green-500">{activeGrants.length}</div>
                    <div className="text-sm text-slate-500">Acessos liberados</div>
                </div>
            </div>

            {/* Ranking de engajamento — quem mais usa a ferramenta */}
            <AdminUserEngagement isAdmin={isAdmin} />

            {/* Liberar acesso por X dias */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
                            <Zap className="h-4 w-4 text-blue-500" /> Liberar acesso por período
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                            Define a duração em dias. Vale para os botões de ativação por usuário e para a liberação geral. A revogação é automática no vencimento.
                        </p>
                    </div>
                    <div className="flex items-end gap-3">
                        <label className="text-sm">
                            <span className="mb-1 block text-slate-500">Dias</span>
                            <input
                                type="number"
                                min={1}
                                value={accessDays}
                                onChange={(e) => setAccessDays(Math.max(1, Number(e.target.value) || 1))}
                                className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            />
                        </label>
                        <ActionButton
                            variant="primary"
                            size="sm"
                            iconClassName="fas fa-bolt"
                            loading={grantingAll}
                            loadingText="Liberando..."
                            onClick={handleGrantAll}
                        >
                            Liberar tudo para todos
                        </ActionButton>
                    </div>
                </div>
            </div>

            {/* Trial automático para novos cadastros */}
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
                            <Clock className="h-4 w-4 text-violet-500" /> Trial automático para novos cadastros
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${signupTrial.enabled
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                }`}>
                                {signupTrial.enabled ? `Ligado · ${signupTrial.days}d` : 'Desligado'}
                            </span>
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                            Quando ligado, todo novo cadastro ganha o Pacote Completo por X dias automaticamente. No vencimento, volta para o plano grátis.
                        </p>
                    </div>
                    <div className="flex items-end gap-3">
                        <label className="text-sm">
                            <span className="mb-1 block text-slate-500">Dias</span>
                            <input
                                type="number"
                                min={1}
                                value={trialDays}
                                onChange={(e) => setTrialDays(Math.max(1, Number(e.target.value) || 1))}
                                className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            />
                        </label>
                        {signupTrial.enabled && signupTrial.days !== trialDays && (
                            <ActionButton
                                variant="secondary"
                                size="sm"
                                loading={savingSignupTrial}
                                loadingText="Salvando..."
                                onClick={handleSaveTrialDays}
                            >
                                Salvar dias
                            </ActionButton>
                        )}
                        <ActionButton
                            variant={signupTrial.enabled ? 'secondary' : 'primary'}
                            size="sm"
                            iconClassName={signupTrial.enabled ? 'fas fa-toggle-off' : 'fas fa-toggle-on'}
                            loading={savingSignupTrial}
                            loadingText="Salvando..."
                            onClick={handleToggleTrial}
                        >
                            {signupTrial.enabled ? 'Desligar trial' : 'Ligar trial'}
                        </ActionButton>
                    </div>
                </div>
            </div>

            {/* Acompanhamento de acessos liberados */}
            {activeGrants.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-center gap-2 border-b border-slate-200 p-4 dark:border-slate-700">
                        <Clock className="h-4 w-4 text-slate-500" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Acessos liberados (por vencimento)</h3>
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                        {activeGrants.map(grant => {
                            const expiringSoon = grant.daysRemaining !== null && grant.daysRemaining <= 7;
                            return (
                                <div key={grant.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-slate-900 dark:text-white">{grant.email}</div>
                                        <div className="text-xs text-slate-500">
                                            {grant.hasFullPackage ? 'Pacote Completo' : `${grant.moduleCount} módulo(s)`}
                                            {grant.expiresAt && ` • expira em ${new Date(grant.expiresAt).toLocaleDateString()}`}
                                        </div>
                                    </div>
                                    {grant.daysRemaining !== null && (
                                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${expiringSoon
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            }`}>
                                            {grant.daysRemaining}d restantes
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-6 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Gerenciar Usuários</h3>
                    <div className="flex items-center gap-3">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <input
                                type="checkbox"
                                checked={onlyTests}
                                onChange={(e) => setOnlyTests(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300"
                            />
                            Só contas de teste
                        </label>
                        <ActionButton variant="secondary" size="sm" iconClassName="fas fa-rotate-right" onClick={fetchProfiles}>
                            Atualizar Lista
                        </ActionButton>
                    </div>
                </div>

                {feedback && (
                    <div className={`mx-6 mt-4 rounded-xl border px-4 py-3 text-sm ${feedback.type === 'error'
                        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300'
                        : 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-300'
                        }`}>
                        {feedback.message}
                    </div>
                )}

                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {loading ? (
                        <ContentState
                            compact
                            iconClassName="fas fa-users"
                            title="Carregando usuarios"
                            description="Buscando perfis e acessos."
                        />
                    ) : visibleProfiles.length === 0 ? (
                        <ContentState
                            compact
                            iconClassName="fas fa-users-slash"
                            title={onlyTests ? 'Nenhuma conta de teste' : 'Nenhum usuario ainda'}
                            description={onlyTests ? 'Não há contas de teste (emails com +, demo ou @example.com).' : 'Os usuarios cadastrados aparecem aqui.'}
                        />
                    ) : (
                        visibleProfiles.map(profile => {
                            const isExpanded = expandedUser === profile.id;
                            const activeModulesCount = profile.subscription?.active_modules?.length || 0;
                            const hasFullPackage = isModuleActive(profile, 'pacote_completo');
                            const isProfileAdmin = isUserAdmin(profile);

                            return (
                                <div key={profile.id}>
                                    <div
                                        className="cursor-pointer p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                        onClick={() => setExpandedUser(isExpanded ? null : profile.id)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isProfileAdmin
                                                    ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                                                    : hasFullPackage
                                                        ? 'bg-gradient-to-br from-amber-400 to-yellow-500'
                                                        : activeModulesCount > 0
                                                            ? 'bg-green-500'
                                                            : 'bg-slate-300 dark:bg-slate-600'
                                                    }`}>
                                                    {isProfileAdmin ? (
                                                        <Shield className="h-5 w-5 text-white" />
                                                    ) : hasFullPackage ? (
                                                        <Crown className="h-5 w-5 text-white" />
                                                    ) : (
                                                        <span className="text-sm font-bold text-white">{profile.email?.charAt(0).toUpperCase()}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-medium text-slate-900 dark:text-white">{profile.email}</span>
                                                        {isProfileAdmin && (
                                                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                                                Admin
                                                            </span>
                                                        )}
                                                        {hasFullPackage && !isProfileAdmin && (
                                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                                Completo
                                                            </span>
                                                        )}
                                                        {profile.blocked && (
                                                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                                Bloqueado
                                                            </span>
                                                        )}
                                                        {isTestAccount(profile) && !isProfileAdmin && (
                                                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                                                Teste
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                                                        <span>{new Date(profile.created_at).toLocaleDateString()}</span>
                                                        {isProfileAdmin ? (
                                                            <span className="text-purple-500">• Acesso Total</span>
                                                        ) : activeModulesCount > 0 && !hasFullPackage ? (
                                                            <span className="text-green-500">• {activeModulesCount} módulo(s)</span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="rounded-lg p-1 hover:bg-slate-200 dark:hover:bg-slate-600">
                                                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="bg-slate-50 px-4 pb-4 pt-0 dark:bg-slate-900/50">
                                            <div className="ml-14">
                                                {isProfileAdmin ? (
                                                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
                                                        <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                                                            <Shield className="h-5 w-5" />
                                                            <span className="font-semibold">Administrador do Sistema</span>
                                                        </div>
                                                        <p className="mt-1 text-sm text-purple-600 dark:text-purple-400">
                                                            Este usuário tem acesso total automaticamente a todos os módulos e funcionalidades.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="mb-3 text-xs text-slate-500">
                                                            Será liberado por <span className="font-semibold text-blue-500">{accessDays} dia(s)</span> (ajuste no campo "Dias" acima).
                                                        </p>
                                                        {!hasFullPackage && (
                                                            <div className="mb-4">
                                                                <ActionButton
                                                                    variant="primary"
                                                                    size="sm"
                                                                    iconClassName="fas fa-bolt"
                                                                    loading={activatingModule?.userId === profile.id && activatingModule?.moduleId === 'pacote_completo'}
                                                                    loadingText="Ativando..."
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        activateModuleForUser(profile, 'pacote_completo', accessDays);
                                                                    }}
                                                                >
                                                                    Ativar Pacote Completo · {accessDays}d
                                                                </ActionButton>
                                                            </div>
                                                        )}

                                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                            {AVAILABLE_MODULES.filter(module => module.id !== 'pacote_completo').map(module => {
                                                                const isActive = isModuleActive(profile, module.id) || hasFullPackage;
                                                                const expiryDays = getModuleExpiryDays(profile, module.id);
                                                                const isActivating = activatingModule?.userId === profile.id && activatingModule?.moduleId === module.id;

                                                                return (
                                                                    <div
                                                                        key={module.id}
                                                                        className={`rounded-lg border p-3 text-center transition-all ${isActive
                                                                            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                                                                            : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                                                                            }`}
                                                                    >
                                                                        <div className="mb-1 flex items-center justify-center gap-1">
                                                                            {isActive ? (
                                                                                <Check className="h-4 w-4 text-green-500" />
                                                                            ) : (
                                                                                <X className="h-4 w-4 text-slate-400" />
                                                                            )}
                                                                            <span className={`text-xs font-medium ${isActive ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                                                {module.name}
                                                                            </span>
                                                                        </div>
                                                                        {isActive && expiryDays !== null && (
                                                                            <div className="text-[10px] text-green-500">{expiryDays}d restantes</div>
                                                                        )}
                                                                        {!isActive && !hasFullPackage && (
                                                                            <ActionButton
                                                                                variant="secondary"
                                                                                size="sm"
                                                                                className="mt-2 w-full"
                                                                                loading={isActivating}
                                                                                loadingText="Ativando..."
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    activateModuleForUser(profile, module.id, accessDays);
                                                                                }}
                                                                            >
                                                                                Ativar
                                                                            </ActionButton>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                                                            <ActionButton
                                                                variant="secondary"
                                                                size="sm"
                                                                loading={busyUser?.userId === profile.id && busyUser?.action === 'block'}
                                                                loadingText="Salvando..."
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setUserBlocked(profile, !profile.blocked);
                                                                }}
                                                            >
                                                                {profile.blocked ? (
                                                                    <span className="flex items-center gap-1"><Unlock className="h-4 w-4" /> Reativar acesso</span>
                                                                ) : (
                                                                    <span className="flex items-center gap-1"><Ban className="h-4 w-4" /> Bloquear acesso</span>
                                                                )}
                                                            </ActionButton>
                                                            <button
                                                                type="button"
                                                                disabled={busyUser?.userId === profile.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteUser(profile);
                                                                }}
                                                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                {busyUser?.userId === profile.id && busyUser?.action === 'delete' ? 'Excluindo...' : 'Excluir usuário'}
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
