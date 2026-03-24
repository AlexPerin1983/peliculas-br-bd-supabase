import React from 'react';
import { Check, ChevronDown, ChevronUp, Crown, Shield, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ActionButton from './ui/ActionButton';
import ContentState from './ui/ContentState';
import { AVAILABLE_MODULES, isUserAdmin, useAdminUsers } from '../src/hooks/useAdminUsers';

export const AdminUsers: React.FC = () => {
    const { isAdmin } = useAuth();
    const {
        profiles,
        loading,
        expandedUser,
        setExpandedUser,
        activatingModule,
        feedback,
        fetchProfiles,
        activateModuleForUser,
        getModuleExpiryDays,
        isModuleActive,
        usersWithModules,
    } = useAdminUsers(isAdmin);

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
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Gerenciar Usuários</h3>
                    <ActionButton variant="secondary" size="sm" iconClassName="fas fa-rotate-right" onClick={fetchProfiles}>
                        Atualizar Lista
                    </ActionButton>
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
                            title="Carregando usuários"
                            description="Buscando perfis, organizações e módulos ativos."
                        />
                    ) : profiles.length === 0 ? (
                        <ContentState
                            compact
                            iconClassName="fas fa-users-slash"
                            title="Nenhum usuário encontrado"
                            description="Quando novos usuários forem criados, eles aparecerão aqui para gestão administrativa."
                        />
                    ) : (
                        profiles.map(profile => {
                            const isExpanded = expandedUser === profile.id;
                            const activeModulesCount = profile.subscription?.active_modules?.length || 0;
                            const hasFullPackage = isModuleActive(profile, 'ilimitado');
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
                                                                        activateModuleForUser(profile, 'pacote_completo', 6);
                                                                    }}
                                                                >
                                                                    Ativar Pacote Completo
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
                                                                                    activateModuleForUser(profile, module.id, 6);
                                                                                }}
                                                                            >
                                                                                Ativar
                                                                            </ActionButton>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
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
