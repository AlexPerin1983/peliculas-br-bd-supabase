import { supabase } from './supabaseClient';

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
}

export interface SubscriptionInfo {
    subscription_id: string;
    limits: SubscriptionLimits;
    active_modules: string[];
    usage: SubscriptionUsage;
    usage_resets_at: string;
    trial_ends_at: string | null;
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
    billing_cycle: 'monthly' | 'yearly' | null;
}

// Limites padrão do plano gratuito
export const FREE_PLAN_LIMITS: SubscriptionLimits = {
    max_clients: 10,
    max_films: 5,
    max_pdfs_month: 10,
    max_agendamentos_month: 5
};

// Cache local para evitar muitas chamadas ao banco
let cachedSubscriptionInfo: SubscriptionInfo | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos

// ============================================
// FUNÇÕES DO SERVIÇO
// ============================================

/**
 * Busca todos os módulos disponíveis para compra
 */
export async function getAvailableModules(): Promise<SubscriptionModule[]> {
    const { data, error } = await supabase
        .from('subscription_modules')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Erro ao buscar módulos:', error);
        return [];
    }

    return data.map(m => ({
        ...m,
        features: m.features || []
    }));
}

/**
 * Busca informações da assinatura da organização do usuário logado
 */
export async function getSubscriptionInfo(forceRefresh = false): Promise<SubscriptionInfo> {
    // Verificar cache
    if (!forceRefresh && cachedSubscriptionInfo && (Date.now() - cacheTimestamp < CACHE_DURATION_MS)) {
        return cachedSubscriptionInfo;
    }

    // Buscar organization_id do usuário atual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return getDefaultSubscriptionInfo();
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return getDefaultSubscriptionInfo();
    }

    // Chamar função RPC que retorna todas as infos
    const { data, error } = await supabase
        .rpc('get_subscription_info', { p_organization_id: profile.organization_id });

    if (error) {
        console.error('Erro ao buscar subscription info:', error);
        return getDefaultSubscriptionInfo();
    }

    // Atualizar cache
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
        modules_detail: null
    };
}

/**
 * Verifica se um módulo específico está ativo
 */
export async function isModuleActive(moduleId: string): Promise<boolean> {
    const info = await getSubscriptionInfo();
    return info.active_modules.includes(moduleId);
}

/**
 * Verifica se atingiu o limite de um recurso
 */
export async function hasReachedLimit(resource: 'clients' | 'films' | 'pdfs' | 'agendamentos', currentCount: number): Promise<boolean> {
    const info = await getSubscriptionInfo();

    // Se tem módulo 'ilimitado', nunca atinge limite
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

/**
 * Incrementa contador de uso (para PDFs e agendamentos)
 */
export async function incrementUsage(resource: 'pdfs' | 'agendamentos'): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) return;

    const field = resource === 'pdfs' ? 'pdfs_generated' : 'agendamentos_created';

    // Atualizar usando JSONB
    const { error } = await supabase.rpc('increment_subscription_usage', {
        p_organization_id: profile.organization_id,
        p_field: field
    });

    if (error) {
        console.error('Erro ao incrementar uso:', error);
    }

    // Invalidar cache
    cachedSubscriptionInfo = null;
}

/**
 * Solicita ativação de um módulo (cria registro pendente)
 */
export async function requestModuleActivation(
    moduleId: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
): Promise<{ success: boolean; activationId?: string; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { success: false, error: 'Usuário não autenticado' };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return { success: false, error: 'Organização não encontrada' };
    }

    // Buscar subscription
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .single();

    if (!subscription) {
        return { success: false, error: 'Assinatura não encontrada' };
    }

    // Buscar preço do módulo
    const { data: module } = await supabase
        .from('subscription_modules')
        .select('price_monthly, price_yearly')
        .eq('id', moduleId)
        .single();

    if (!module) {
        return { success: false, error: 'Módulo não encontrado' };
    }

    const price = billingCycle === 'yearly' ? (module.price_yearly || module.price_monthly * 12) : module.price_monthly;

    // Criar ativação pendente
    const { data: activation, error } = await supabase
        .from('module_activations')
        .upsert({
            subscription_id: subscription.id,
            module_id: moduleId,
            status: 'pending',
            payment_method: 'pix',
            payment_amount: price,
            billing_cycle: billingCycle
        }, {
            onConflict: 'subscription_id,module_id',
            ignoreDuplicates: false
        })
        .select('id')
        .single();

    if (error) {
        console.error('Erro ao criar ativação:', error);
        return { success: false, error: error.message };
    }

    return { success: true, activationId: activation?.id };
}

/**
 * Busca ativações pendentes (para o admin aprovar)
 */
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
        console.error('Erro ao buscar ativações pendentes:', error);
        return [];
    }

    return data || [];
}

/**
 * Confirma ativação de módulo (apenas admin)
 */
export async function confirmModuleActivation(
    subscriptionId: string,
    moduleId: string,
    months: number = 1,
    paymentReference?: string
): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc('activate_module', {
        p_subscription_id: subscriptionId,
        p_module_id: moduleId,
        p_months: months,
        p_payment_amount: null, // Usar preço padrão
        p_payment_reference: paymentReference || null
    });

    if (error) {
        console.error('Erro ao confirmar ativação:', error);
        return { success: false, error: error.message };
    }

    // Invalidar cache
    cachedSubscriptionInfo = null;

    return { success: true };
}

/**
 * Limpa o cache (usar após mudanças na assinatura)
 */
export function clearSubscriptionCache(): void {
    cachedSubscriptionInfo = null;
    cacheTimestamp = 0;
}

// ============================================
// HOOKS DE VERIFICAÇÃO RÁPIDA
// ============================================

/**
 * Verifica múltiplas permissões de uma vez
 */
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

    return {
        canAddClient: isUnlimited || true, // Precisará verificar contagem real
        canAddFilm: isUnlimited || true,
        canGeneratePdf: isUnlimited || info.usage.pdfs_generated < info.limits.max_pdfs_month,
        canUseEstoque: info.active_modules.includes('estoque'),
        canUseQrServicos: info.active_modules.includes('qr_servicos'),
        canUseColaboradores: info.active_modules.includes('colaboradores'),
        canUseIA: info.active_modules.includes('ia_ocr'),
        canCustomize: info.active_modules.includes('personalizacao'),
        canAddLocais: info.active_modules.includes('locais_global'),
        limits: info.limits,
        usage: info.usage,
        activeModules: info.active_modules
    };
}
