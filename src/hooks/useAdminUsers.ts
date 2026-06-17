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
    blocked?: boolean;
    empresa?: string | null;
    telefone?: string | null;
}

const TEST_EMAIL_PATTERNS = [/\+/, /@example\.com$/i, /demo/i];

export const isTestAccount = (profile: Profile): boolean => {
    const email = (profile.email || '').toLowerCase();
    return TEST_EMAIL_PATTERNS.some((re) => re.test(email));
};

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

export const isUserAdmin = (profile: Profile): boolean => {
    return profile.role === 'admin';
};

export const useAdminUsers = (enabled: boolean) => {
    const [profiles, setProfiles] = useState<UserWithSubscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [activatingModule, setActivatingModule] = useState<{ userId: string; moduleId: string } | null>(null);
    const [grantingAll, setGrantingAll] = useState(false);
    const [busyUser, setBusyUser] = useState<{ userId: string; action: 'block' | 'delete' } | null>(null);
    const [signupTrial, setSignupTrial] = useState<{ enabled: boolean; days: number }>({ enabled: false, days: 0 });
    const [savingSignupTrial, setSavingSignupTrial] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

    const fetchProfiles = useCallback(async () => {
        try {
            setLoading(true);
            setFeedback(null);

            // 1 chamada agregada (substitui o antigo N+1 por empresa) → baixo egress
            const { data, error } = await supabase.rpc('admin_users_overview');
            if (error) throw error;

            const mapped: UserWithSubscription[] = (data || []).map((row: any) => ({
                id: row.id,
                email: row.email,
                role: row.role,
                approved: true,
                created_at: row.created_at,
                organization_id: row.organization_id || undefined,
                organization: row.organization_id ? { id: row.organization_id, name: row.empresa || '' } : undefined,
                blocked: !!row.blocked,
                subscription: {
                    active_modules: Array.isArray(row.active_modules) ? row.active_modules : [],
                    modules_detail: Array.isArray(row.modules_detail) ? row.modules_detail : [],
                },
                empresa: row.empresa || null,
                telefone: row.telefone || null,
            }));

            setProfiles(mapped);
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

    const loadSignupTrial = useCallback(async () => {
        const { data, error } = await supabase
            .from('signup_trial_config')
            .select('enabled, trial_days')
            .eq('id', true)
            .maybeSingle();

        if (!error && data) {
            setSignupTrial({ enabled: !!data.enabled, days: data.trial_days || 0 });
        }
    }, []);

    useEffect(() => {
        if (enabled) {
            fetchProfiles();
            loadSignupTrial();
        }
    }, [enabled, fetchProfiles, loadSignupTrial]);

    const saveSignupTrial = useCallback(async (nextEnabled: boolean, days: number) => {
        setSavingSignupTrial(true);
        setFeedback(null);

        try {
            const { error } = await supabase.rpc('set_signup_trial_config', {
                p_enabled: nextEnabled,
                p_days: days,
            });

            if (error) throw error;

            setSignupTrial({ enabled: nextEnabled, days });
            setFeedback({
                type: 'success',
                message: nextEnabled
                    ? `Trial automático ligado: ${days} dia(s) para novos cadastros.`
                    : 'Trial automático para novos cadastros desligado.',
            });
        } catch (error: any) {
            console.error('Erro ao salvar trial de cadastro:', error);
            setFeedback({
                type: 'error',
                message: `Erro ao salvar trial de cadastro: ${error.message}`,
            });
        } finally {
            setSavingSignupTrial(false);
        }
    }, []);

    const activateModuleForUser = useCallback(async (profile: UserWithSubscription, moduleId: string, days: number = 30) => {
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
                .maybeSingle();

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
                p_payment_amount: 0,
                p_payment_reference: 'ADMIN-TRIAL',
                p_days: days,
            });

            if (activateError) throw activateError;

            setFeedback({
                type: 'success',
                message: `Acesso liberado por ${days} dia(s) para ${profile.email}.`,
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

    const grantFullAccessAll = useCallback(async (days: number = 30) => {
        setGrantingAll(true);
        setFeedback(null);

        try {
            const { data, error } = await supabase.rpc('admin_grant_full_access_all', {
                p_days: days,
                p_payment_reference: 'ADMIN-PROMO',
            });

            if (error) throw error;

            setFeedback({
                type: 'success',
                message: `Pacote Completo liberado por ${days} dia(s) para ${data ?? 0} organização(ões).`,
            });
            await fetchProfiles();
        } catch (error: any) {
            console.error('Erro ao liberar acesso em massa:', error);
            setFeedback({
                type: 'error',
                message: `Erro ao liberar acesso para todos: ${error.message}`,
            });
        } finally {
            setGrantingAll(false);
        }
    }, [fetchProfiles]);

    const setUserBlocked = useCallback(async (profile: UserWithSubscription, blocked: boolean) => {
        setBusyUser({ userId: profile.id, action: 'block' });
        setFeedback(null);

        try {
            const { error } = await supabase.rpc('admin_set_user_blocked', {
                p_user_id: profile.id,
                p_blocked: blocked,
            });

            if (error) throw error;

            setFeedback({
                type: 'success',
                message: blocked
                    ? `Acesso de ${profile.email} bloqueado.`
                    : `Acesso de ${profile.email} reativado.`,
            });
            await fetchProfiles();
        } catch (error: any) {
            console.error('Erro ao bloquear/reativar usuário:', error);
            setFeedback({
                type: 'error',
                message: `Erro ao alterar acesso: ${error.message}`,
            });
        } finally {
            setBusyUser(null);
        }
    }, [fetchProfiles]);

    const deleteUser = useCallback(async (profile: UserWithSubscription) => {
        setBusyUser({ userId: profile.id, action: 'delete' });
        setFeedback(null);

        try {
            const { data, error } = await supabase.functions.invoke('admin-delete-user', {
                body: { userId: profile.id, confirmEmail: profile.email },
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error || 'Falha ao excluir usuário');

            setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
            setExpandedUser(null);
            setFeedback({
                type: 'success',
                message: `Usuário ${profile.email} excluído.${data?.warnings?.length ? ' (avisos no console)' : ''}`,
            });
            if (data?.warnings?.length) console.warn('admin-delete-user warnings:', data.warnings);
        } catch (error: any) {
            console.error('Erro ao excluir usuário:', error);
            setFeedback({
                type: 'error',
                message: `Erro ao excluir usuário: ${error.message}`,
            });
        } finally {
            setBusyUser(null);
        }
    }, []);

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

    // Acompanhamento: usuários com acesso liberado, ordenados pelo vencimento mais próximo
    const activeGrants = useMemo(() => {
        return profiles
            .filter(p => !isUserAdmin(p) && (p.subscription?.active_modules?.length || 0) > 0)
            .map(p => {
                const details = p.subscription?.modules_detail || [];
                const soonest = details
                    .filter(d => d.expires_at)
                    .map(d => new Date(d.expires_at).getTime())
                    .sort((a, b) => a - b)[0];
                const daysRemaining = soonest
                    ? Math.ceil((soonest - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;
                return {
                    id: p.id,
                    email: p.email,
                    moduleCount: p.subscription?.active_modules?.length || 0,
                    hasFullPackage: p.subscription?.active_modules?.includes('pacote_completo') || false,
                    expiresAt: soonest ? new Date(soonest).toISOString() : null,
                    daysRemaining,
                };
            })
            .sort((a, b) => {
                if (a.daysRemaining === null) return 1;
                if (b.daysRemaining === null) return -1;
                return a.daysRemaining - b.daysRemaining;
            });
    }, [profiles]);

    return {
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
    };
};
