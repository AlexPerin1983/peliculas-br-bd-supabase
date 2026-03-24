import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Profile } from '../../types';

export interface UserWithSubscription extends Profile {
    subscription?: {
        id?: string;
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

export const AVAILABLE_MODULES = [
    { id: 'estoque', name: 'Controle de Estoque', price: 39 },
    { id: 'qr_servicos', name: 'QR Code de Serviços', price: 39 },
    { id: 'colaboradores', name: 'Gestão de Equipe', price: 39 },
    { id: 'ia_ocr', name: 'Extração com IA', price: 39 },
    { id: 'personalizacao', name: 'Marca Própria', price: 39 },
    { id: 'locais_global', name: 'Locais Globais PRO', price: 39 },
    { id: 'corte_inteligente', name: 'Corte Inteligente', price: 39 },
    { id: 'ilimitado', name: 'Sem Limites', price: 39 },
    { id: 'pacote_completo', name: 'Pacote Completo (todos)', price: 149 },
];

const ADMIN_EMAILS = ['windowfilm.br@gmail.com', 'windowfilm.app@gmail.com'];

export const isUserAdmin = (profile: Profile): boolean => {
    const isAdminByEmail = profile.email && ADMIN_EMAILS.includes(profile.email.toLowerCase());
    return isAdminByEmail || profile.role === 'admin';
};

export const useAdminUsers = (enabled: boolean) => {
    const [profiles, setProfiles] = useState<UserWithSubscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [activatingModule, setActivatingModule] = useState<{ userId: string; moduleId: string } | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

    const fetchProfiles = useCallback(async () => {
        try {
            setLoading(true);
            setFeedback(null);

            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (profilesError) throw profilesError;

            const profilesWithSubs = await Promise.all(
                (profilesData || []).map(async (profile) => {
                    try {
                        let targetOrgId = profile.organization_id;
                        let orgData = null;

                        if (targetOrgId) {
                            const { data } = await supabase
                                .from('organizations')
                                .select('id, name')
                                .eq('id', targetOrgId)
                                .single();
                            orgData = data;
                        } else {
                            const { data } = await supabase
                                .from('organizations')
                                .select('id, name')
                                .eq('owner_id', profile.id)
                                .single();
                            orgData = data;
                        }

                        if (orgData) {
                            const { data: subData } = await supabase
                                .from('subscriptions')
                                .select('id, active_modules')
                                .eq('organization_id', orgData.id)
                                .single();

                            const { data: activationsData } = await supabase
                                .from('module_activations')
                                .select('module_id, expires_at, status')
                                .eq('subscription_id', subData?.id)
                                .eq('status', 'active');

                            return {
                                ...profile,
                                organization: orgData,
                                subscription: subData
                                    ? {
                                        ...subData,
                                        modules_detail: activationsData || [],
                                    }
                                    : undefined,
                            };
                        }
                    } catch {
                        return profile;
                    }

                    return profile;
                })
            );

            setProfiles(profilesWithSubs);
        } catch (error) {
            console.error('Error fetching profiles:', error);
            setFeedback({
                type: 'error',
                message: 'Não foi possível carregar os usuários agora.',
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (enabled) {
            fetchProfiles();
        }
    }, [enabled, fetchProfiles]);

    const activateModuleForUser = useCallback(async (profile: UserWithSubscription, moduleId: string, months: number = 6) => {
        setActivatingModule({ userId: profile.id, moduleId });
        setFeedback(null);

        try {
            let orgId = profile.organization_id || profile.organization?.id;

            if (!orgId) {
                const orgName = profile.email?.split('@')[0] || 'Organização';
                const { data: newOrg, error: orgError } = await supabase
                    .from('organizations')
                    .insert({
                        name: orgName,
                        owner_id: profile.id,
                    })
                    .select('id')
                    .single();

                if (orgError) throw new Error(`Erro ao criar organização: ${orgError.message}`);
                orgId = newOrg.id;

                await supabase
                    .from('profiles')
                    .update({ organization_id: orgId })
                    .eq('id', profile.id);

                await supabase
                    .from('organization_members')
                    .insert({
                        organization_id: orgId,
                        user_id: profile.id,
                        email: profile.email,
                        role: 'owner',
                        status: 'active',
                    });
            }

            let subId: string;
            const { data: subData, error: subError } = await supabase
                .from('subscriptions')
                .select('id')
                .eq('organization_id', orgId)
                .single();

            if (subError || !subData) {
                const { data: newSub, error: createError } = await supabase
                    .from('subscriptions')
                    .insert({ organization_id: orgId })
                    .select('id')
                    .single();

                if (createError) throw new Error(`Erro ao criar subscription: ${createError.message}`);
                subId = newSub.id;
            } else {
                subId = subData.id;
            }

            const { error: activateError } = await supabase.rpc('activate_module', {
                p_subscription_id: subId,
                p_module_id: moduleId,
                p_months: months,
                p_payment_amount: moduleId === 'pacote_completo' ? 149 : 39,
                p_payment_reference: 'ADMIN-MANUAL',
            });

            if (activateError) throw activateError;

            setFeedback({
                type: 'success',
                message: `Módulo ativado com sucesso para ${profile.email}.`,
            });
            await fetchProfiles();
        } catch (error: any) {
            console.error('Erro ao ativar módulo:', error);
            setFeedback({
                type: 'error',
                message: `Erro ao ativar módulo: ${error.message}`,
            });
        } finally {
            setActivatingModule(null);
        }
    }, [fetchProfiles]);

    const getModuleExpiryDays = useCallback((profile: UserWithSubscription, moduleId: string): number | null => {
        const detail = profile.subscription?.modules_detail?.find(m => m.module_id === moduleId);
        if (detail?.expires_at) {
            return Math.ceil((new Date(detail.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        }
        return null;
    }, []);

    const isModuleActive = useCallback((profile: UserWithSubscription, moduleId: string): boolean => {
        return profile.subscription?.active_modules?.includes(moduleId) || false;
    }, []);

    const usersWithModules = useMemo(
        () => profiles.filter(p => (p.subscription?.active_modules?.length || 0) > 0).length,
        [profiles]
    );

    return {
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
    };
};
