import { supabase } from './supabaseClient';
import { getCurrentUserId, getEffectiveOrganizationId } from './sessionScope';

// ============================================
// TIPOS PARA SISTEMA DE ASSINATURAS
// ============================================

export interface SubscriptionModule {
    id: string;
    name: string;
    description: string;
    price_monthly: number;
    price_yearly: number | null;
    icon: string;
    features: string[];
    is_active: boolean;
    sort_order: number;
    validity_months?: number;
    abacate_subscription_product_id?: string | null;
}

export interface SubscriptionLimits {
    max_clients: number;
    max_films: number;
    max_pdfs_month: number;
    max_agendamentos_month: number;
}

export interface SubscriptionUsage {
    pdfs_generated: number;
    agendamentos_created: number;
}

export interface ModuleDetail {
    module_id: string;
    status: 'pending' | 'active' | 'expired' | 'cancelled';
    expires_at: string | null;
    days_remaining: number | null;
    cancel_at_period_end?: boolean;
    payment_provider?: string | null;
    billing_cycle?: 'monthly' | 'semiannual' | 'yearly' | null;
    is_recurring?: boolean;
}

export interface SubscriptionInfo {
    subscription_id: string;
    limits: SubscriptionLimits;
    active_modules: string[];
    usage: SubscriptionUsage;
    usage_resets_at: string;
    trial_ends_at: string | null;
    abacate_customer_id?: string | null;
    modules_detail: ModuleDetail[] | null;
}

export interface ModuleActivation {
    id: string;
    subscription_id: string;
    module_id: string;
    status: 'pending' | 'active' | 'expired' | 'cancelled';
    activated_at: string | null;
    expires_at: string | null;
    payment_method: string;
    payment_amount: number;
    payment_reference: string | null;
    payment_confirmed_at: string | null;
    billing_cycle: 'monthly' | 'semiannual' | 'yearly' | null;
    cancel_at_period_end?: boolean;
    cancellation_requested_at?: string | null;
    payment_provider?: string | null;
    external_subscription_id?: string | null;
    is_recurring?: boolean;
}

export const FREE_PLAN_LIMITS: SubscriptionLimits = {
    max_clients: 10,
    max_films: 5,
    max_pdfs_month: 10,
    max_agendamentos_month: 5
};

let cachedSubscriptionInfo: SubscriptionInfo | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000;

export async function getAvailableModules(): Promise<SubscriptionModule[]> {
    const { data, error } = await supabase
        .from('subscription_modules')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Erro ao buscar modulos:', error);
        return [];
    }

    return data.map((module) => ({
        ...module,
        features: module.features || []
    }));
}

export async function getSubscriptionInfo(forceRefresh = false): Promise<SubscriptionInfo> {
    if (
        !forceRefresh &&
        cachedSubscriptionInfo &&
        Date.now() - cacheTimestamp < CACHE_DURATION_MS
    ) {
        return cachedSubscriptionInfo;
    }

    const organizationId = await getEffectiveOrganizationId();
    if (!organizationId) {
        return getDefaultSubscriptionInfo();
    }

    const { data, error } = await supabase.rpc('get_subscription_info', {
        p_organization_id: organizationId
    });

    if (error) {
        console.error('Erro ao buscar subscription info:', error);
        return getDefaultSubscriptionInfo();
    }

    cachedSubscriptionInfo = data as SubscriptionInfo;
    cacheTimestamp = Date.now();

    return cachedSubscriptionInfo;
}

function getDefaultSubscriptionInfo(): SubscriptionInfo {
    return {
        subscription_id: '',
        limits: FREE_PLAN_LIMITS,
        active_modules: [],
        usage: { pdfs_generated: 0, agendamentos_created: 0 },
        usage_resets_at: new Date().toISOString(),
        trial_ends_at: null,
        abacate_customer_id: null,
        modules_detail: null
    };
}

export async function isModuleActive(moduleId: string): Promise<boolean> {
    const info = await getSubscriptionInfo();
    return info.active_modules.includes(moduleId);
}

export async function hasReachedLimit(
    resource: 'clients' | 'films' | 'pdfs' | 'agendamentos',
    currentCount: number
): Promise<boolean> {
    const info = await getSubscriptionInfo();

    if (info.active_modules.includes('ilimitado')) {
        return false;
    }

    switch (resource) {
        case 'clients':
            return currentCount >= info.limits.max_clients;
        case 'films':
            return currentCount >= info.limits.max_films;
        case 'pdfs':
            return info.usage.pdfs_generated >= info.limits.max_pdfs_month;
        case 'agendamentos':
            return info.usage.agendamentos_created >= info.limits.max_agendamentos_month;
        default:
            return false;
    }
}

export async function incrementUsage(resource: 'pdfs' | 'agendamentos'): Promise<void> {
    const organizationId = await getEffectiveOrganizationId();
    if (!organizationId) return;

    const field = resource === 'pdfs' ? 'pdfs_generated' : 'agendamentos_created';

    const { error } = await supabase.rpc('increment_subscription_usage', {
        p_organization_id: organizationId,
        p_field: field
    });

    if (error) {
        console.error('Erro ao incrementar uso:', error);
    }

    cachedSubscriptionInfo = null;
}

export async function requestModuleActivation(
    moduleId: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
): Promise<{ success: boolean; activationId?: string; error?: string }> {
    const userId = await getCurrentUserId();
    if (!userId) {
        return { success: false, error: 'Usuario nao autenticado' };
    }

    const organizationId = await getEffectiveOrganizationId();
    if (!organizationId) {
        return { success: false, error: 'Organizacao nao encontrada' };
    }

    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('organization_id', organizationId)
        .single();

    if (!subscription) {
        return { success: false, error: 'Assinatura nao encontrada' };
    }

    const { data: module } = await supabase
        .from('subscription_modules')
        .select('price_monthly, price_yearly')
        .eq('id', moduleId)
        .single();

    if (!module) {
        return { success: false, error: 'Modulo nao encontrado' };
    }

    const price =
        billingCycle === 'yearly'
            ? module.price_yearly || module.price_monthly * 12
            : module.price_monthly;

    const { data: existingPendingActivation, error: pendingError } = await supabase
        .from('module_activations')
        .select('id')
        .eq('subscription_id', subscription.id)
        .eq('module_id', moduleId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (pendingError) {
        console.error('Erro ao buscar ativacao pendente:', pendingError);
        return { success: false, error: pendingError.message };
    }

    if (existingPendingActivation?.id) {
        return { success: true, activationId: existingPendingActivation.id };
    }

    const { data: activation, error } = await supabase
        .from('module_activations')
        .insert({
            subscription_id: subscription.id,
            module_id: moduleId,
            status: 'pending',
            payment_method: 'pix',
            payment_amount: price,
            payment_provider: 'manual',
            billing_cycle: billingCycle
        })
        .select('id')
        .single();

    if (error) {
        console.error('Erro ao criar ativacao:', error);
        return { success: false, error: error.message };
    }

    return { success: true, activationId: activation?.id };
}

export async function getPendingActivations(): Promise<ModuleActivation[]> {
    const { data, error } = await supabase
        .from('module_activations')
        .select(`
            *,
            subscriptions!inner(
                organization_id,
                organizations!inner(name, owner_id)
            ),
            subscription_modules(name, icon)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao buscar ativacoes pendentes:', error);
        return [];
    }

    return data || [];
}

export async function confirmModuleActivation(
    subscriptionId: string,
    moduleId: string,
    months = 1,
    paymentReference?: string
): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.rpc('activate_module', {
        p_subscription_id: subscriptionId,
        p_module_id: moduleId,
        p_months: months,
        p_payment_amount: null,
        p_payment_reference: paymentReference || null
    });

    if (error) {
        console.error('Erro ao confirmar ativacao:', error);
        return { success: false, error: error.message };
    }

    cachedSubscriptionInfo = null;
    return { success: true };
}

export function clearSubscriptionCache(): void {
    cachedSubscriptionInfo = null;
    cacheTimestamp = 0;
}

export async function checkPermissions(): Promise<{
    canAddClient: boolean;
    canAddFilm: boolean;
    canGeneratePdf: boolean;
    canUseEstoque: boolean;
    canUseQrServicos: boolean;
    canUseColaboradores: boolean;
    canUseIA: boolean;
    canCustomize: boolean;
    canAddLocais: boolean;
    limits: SubscriptionLimits;
    usage: SubscriptionUsage;
    activeModules: string[];
}> {
    const info = await getSubscriptionInfo();
    const isUnlimited = info.active_modules.includes('ilimitado');
    const hasFullPack = info.active_modules.includes('pacote_completo');

    return {
        canAddClient: isUnlimited || hasFullPack || true,
        canAddFilm: isUnlimited || hasFullPack || true,
        canGeneratePdf:
            isUnlimited ||
            hasFullPack ||
            info.usage.pdfs_generated < info.limits.max_pdfs_month,
        canUseEstoque: hasFullPack || info.active_modules.includes('estoque'),
        canUseQrServicos: hasFullPack || info.active_modules.includes('qr_servicos'),
        canUseColaboradores: hasFullPack || info.active_modules.includes('colaboradores'),
        canUseIA: hasFullPack || info.active_modules.includes('ia_ocr'),
        canCustomize: hasFullPack || info.active_modules.includes('personalizacao'),
        canAddLocais: hasFullPack || info.active_modules.includes('locais_global'),
        limits: info.limits,
        usage: info.usage,
        activeModules: info.active_modules
    };
}
