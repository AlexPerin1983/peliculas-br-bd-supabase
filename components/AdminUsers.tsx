import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Profile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Package, Crown, ChevronDown, ChevronUp, Check, X, Zap } from 'lucide-react';

interface UserWithSubscription extends Profile {
    subscription?: {
        active_modules: string[];
        modules_detail?: Array<{
            module_id: string;
            expires_at: string;
            status: string;
        }>;
    };
    organization?: {
        id: string;
        name: string;
    };
}

const AVAILABLE_MODULES = [
    { id: 'estoque', name: 'Estoque', price: 29 },
    { id: 'qr_servicos', name: 'QR Serviços', price: 29 },
    { id: 'colaboradores', name: 'Colaboradores', price: 29 },
    { id: 'ia_ocr', name: 'IA/OCR', price: 29 },
    { id: 'personalizacao', name: 'Personalização', price: 29 },
    { id: 'locais_global', name: 'Locais PRO', price: 29 },
    { id: 'corte_inteligente', name: 'Corte Inteligente', price: 29 },
    { id: 'ilimitado', name: 'Pacote Completo', price: 99 },
];

export const AdminUsers: React.FC = () => {
    const { isAdmin } = useAuth();
    const [profiles, setProfiles] = useState<UserWithSubscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [activatingModule, setActivatingModule] = useState<{ userId: string; moduleId: string } | null>(null);

    useEffect(() => {
        if (isAdmin) {
            fetchProfiles();
        }
    }, [isAdmin]);

    const fetchProfiles = async () => {
        try {
            setLoading(true);

            // Buscar profiles
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (profilesError) throw profilesError;

            // Buscar subscriptions com join
            const profilesWithSubs = await Promise.all(
                (profilesData || []).map(async (profile) => {
                    try {
                        // Buscar organização do usuário
                        const { data: orgData } = await supabase
                            .from('organizations')
                            .select('id, name')
                            .eq('owner_id', profile.id)
                            .single();

                        // Buscar subscription da organização
                        if (orgData) {
                            const { data: subData } = await supabase
                                .from('subscriptions')
                                .select('active_modules')
                                .eq('organization_id', orgData.id)
                                .single();

                            // Buscar detalhes dos módulos ativos
                            const { data: activationsData } = await supabase
                                .from('module_activations')
                                .select('module_id, expires_at, status')
                                .eq('subscription_id', subData?.id)
                                .eq('status', 'active');

                            return {
                                ...profile,
                                organization: orgData,
                                subscription: subData ? {
                                    ...subData,
                                    modules_detail: activationsData || []
                                } : undefined
                            };
                        }
                    } catch {
                        // Ignora erros individuais
                    }
                    return profile;
                })
            );

            setProfiles(profilesWithSubs);
        } catch (error) {
            console.error('Error fetching profiles:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleApproval = async (profile: Profile) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ approved: !profile.approved })
                .eq('id', profile.id);

            if (error) throw error;

            setProfiles(profiles.map(p =>
                p.id === profile.id ? { ...p, approved: !p.approved } : p
            ));
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Erro ao atualizar usuário');
        }
    };

    const activateModuleForUser = async (profile: UserWithSubscription, moduleId: string, months: number = 6) => {
        if (!profile.organization?.id) {
            alert('Usuário não tem organização configurada');
            return;
        }

        setActivatingModule({ userId: profile.id, moduleId });

        try {
            // Buscar subscription ID
            const { data: subData, error: subError } = await supabase
                .from('subscriptions')
                .select('id')
                .eq('organization_id', profile.organization.id)
                .single();

            if (subError || !subData) {
                // Criar subscription se não existir
                const { data: newSub, error: createError } = await supabase
                    .from('subscriptions')
                    .insert({ organization_id: profile.organization.id })
                    .select('id')
                    .single();

                if (createError) throw createError;
                subData.id = newSub.id;
            }

            // Chamar função de ativação
            const { error: activateError } = await supabase.rpc('activate_module', {
                p_subscription_id: subData.id,
                p_module_id: moduleId,
                p_months: months,
                p_payment_amount: moduleId === 'ilimitado' ? 99 : 29,
                p_payment_reference: 'ADMIN-MANUAL'
            });

            if (activateError) throw activateError;

            alert(`Módulo "${moduleId}" ativado com sucesso para ${profile.email}!`);
            fetchProfiles(); // Recarregar lista
        } catch (error: any) {
            console.error('Erro ao ativar módulo:', error);
            alert(`Erro ao ativar módulo: ${error.message}`);
        } finally {
            setActivatingModule(null);
        }
    };

    const getModuleExpiryDays = (profile: UserWithSubscription, moduleId: string): number | null => {
        const detail = profile.subscription?.modules_detail?.find(m => m.module_id === moduleId);
        if (detail?.expires_at) {
            const daysLeft = Math.ceil((new Date(detail.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return daysLeft;
        }
        return null;
    };

    const isModuleActive = (profile: UserWithSubscription, moduleId: string): boolean => {
        return profile.subscription?.active_modules?.includes(moduleId) || false;
    };

    if (!isAdmin) return null;

    return (
        <div className="space-y-6">
            {/* Header com estatísticas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{profiles.length}</div>
                    <div className="text-sm text-slate-500">Total Usuários</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="text-2xl font-bold text-green-500">{profiles.filter(p => p.approved).length}</div>
                    <div className="text-sm text-slate-500">Aprovados</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="text-2xl font-bold text-yellow-500">{profiles.filter(p => !p.approved).length}</div>
                    <div className="text-sm text-slate-500">Pendentes</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="text-2xl font-bold text-purple-500">
                        {profiles.filter(p => (p.subscription?.active_modules?.length || 0) > 0).length}
                    </div>
                    <div className="text-sm text-slate-500">Com Módulos</div>
                </div>
            </div>

            {/* Tabela de usuários */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        Gerenciar Usuários
                    </h3>
                    <button
                        onClick={fetchProfiles}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        Atualizar Lista
                    </button>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {loading ? (
                        <div className="px-6 py-8 text-center text-slate-500">
                            Carregando usuários...
                        </div>
                    ) : profiles.length === 0 ? (
                        <div className="px-6 py-8 text-center text-slate-500">
                            Nenhum usuário encontrado.
                        </div>
                    ) : (
                        profiles.map(profile => {
                            const isExpanded = expandedUser === profile.id;
                            const activeModulesCount = profile.subscription?.active_modules?.length || 0;
                            const hasFullPackage = isModuleActive(profile, 'ilimitado');

                            return (
                                <div key={profile.id}>
                                    {/* Linha principal */}
                                    <div
                                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                                        onClick={() => setExpandedUser(isExpanded ? null : profile.id)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasFullPackage
                                                        ? 'bg-gradient-to-br from-amber-400 to-yellow-500'
                                                        : activeModulesCount > 0
                                                            ? 'bg-green-500'
                                                            : 'bg-slate-300 dark:bg-slate-600'
                                                    }`}>
                                                    {hasFullPackage ? (
                                                        <Crown className="w-5 h-5 text-white" />
                                                    ) : (
                                                        <span className="text-white font-bold text-sm">
                                                            {profile.email?.charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-slate-900 dark:text-white">
                                                            {profile.email}
                                                        </span>
                                                        {profile.role === 'admin' && (
                                                            <span className="px-2 py-0.5 text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full font-bold uppercase">
                                                                Admin
                                                            </span>
                                                        )}
                                                        {hasFullPackage && (
                                                            <span className="px-2 py-0.5 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full font-bold uppercase">
                                                                Completo
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-sm text-slate-500">
                                                        <span>{new Date(profile.created_at).toLocaleDateString()}</span>
                                                        {activeModulesCount > 0 && !hasFullPackage && (
                                                            <span className="text-green-500">• {activeModulesCount} módulo(s)</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {/* Status */}
                                                {profile.approved ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                        Aprovado
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                                                        Pendente
                                                    </span>
                                                )}
                                                {/* Botão expandir */}
                                                <button className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded">
                                                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Área expandida - Módulos */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-0 bg-slate-50 dark:bg-slate-900/50">
                                            <div className="ml-14">
                                                {/* Ações rápidas */}
                                                <div className="flex items-center gap-2 mb-4">
                                                    {profile.role !== 'admin' && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleApproval(profile);
                                                            }}
                                                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${profile.approved
                                                                ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                                                                : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                                                                }`}
                                                        >
                                                            {profile.approved ? 'Bloquear Acesso' : 'Aprovar Acesso'}
                                                        </button>
                                                    )}
                                                    {!hasFullPackage && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm('Ativar PACOTE COMPLETO (R$ 99 / 6 meses)?')) {
                                                                    activateModuleForUser(profile, 'ilimitado', 6);
                                                                }
                                                            }}
                                                            disabled={activatingModule?.userId === profile.id}
                                                            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-400 hover:to-yellow-400 transition-colors disabled:opacity-50"
                                                        >
                                                            <Zap className="w-3 h-3" />
                                                            Ativar Pacote Completo
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Grid de módulos */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                    {AVAILABLE_MODULES.filter(m => m.id !== 'ilimitado').map(module => {
                                                        const isActive = isModuleActive(profile, module.id) || hasFullPackage;
                                                        const expiryDays = getModuleExpiryDays(profile, module.id);
                                                        const isActivating = activatingModule?.userId === profile.id && activatingModule?.moduleId === module.id;

                                                        return (
                                                            <div
                                                                key={module.id}
                                                                className={`p-3 rounded-lg border text-center transition-all ${isActive
                                                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center justify-center gap-1 mb-1">
                                                                    {isActive ? (
                                                                        <Check className="w-4 h-4 text-green-500" />
                                                                    ) : (
                                                                        <X className="w-4 h-4 text-slate-400" />
                                                                    )}
                                                                    <span className={`text-xs font-medium ${isActive ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                                        {module.name}
                                                                    </span>
                                                                </div>
                                                                {isActive && expiryDays !== null && (
                                                                    <div className="text-[10px] text-green-500">{expiryDays}d restantes</div>
                                                                )}
                                                                {!isActive && !hasFullPackage && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (confirm(`Ativar ${module.name} (R$ ${module.price} / 6 meses)?`)) {
                                                                                activateModuleForUser(profile, module.id, 6);
                                                                            }
                                                                        }}
                                                                        disabled={isActivating}
                                                                        className="mt-1 text-[10px] px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                                                                    >
                                                                        {isActivating ? '...' : 'Ativar'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
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
