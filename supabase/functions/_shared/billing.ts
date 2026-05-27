import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function createSupabaseAdminClient() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey =
        Deno.env.get('SERVICE_ROLE_KEY') ??
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
        '';

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
            'SUPABASE_URL ou SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY nao configurada'
        );
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json'
};

export interface BillingOrganizationAccess {
    role: 'owner' | 'admin' | 'member';
    status: 'pending' | 'active' | 'blocked';
}

export async function resolveBillingOrganizationAccess(
    supabaseClient: ReturnType<typeof createClient>,
    organizationId: string,
    userId: string
): Promise<BillingOrganizationAccess | null> {
    const { data: member, error: memberError } = await supabaseClient
        .from('organization_members')
        .select('role, status')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle();

    if (memberError) {
        throw new Error(memberError.message);
    }

    if (member) {
        return member as BillingOrganizationAccess;
    }

    const { data: organization, error: organizationError } = await supabaseClient
        .from('organizations')
        .select('owner_id')
        .eq('id', organizationId)
        .maybeSingle();

    if (organizationError) {
        throw new Error(organizationError.message);
    }

    if (organization?.owner_id === userId) {
        return {
            role: 'owner',
            status: 'active'
        };
    }

    return null;
}

export function getBillingCycleFromStripeInterval(
    interval?: string | null,
    intervalCount?: number | null
): 'monthly' | 'yearly' | null {
    if (!interval) return null;

    if (interval === 'year') return 'yearly';
    if (interval === 'month' && (intervalCount ?? 1) >= 12) return 'yearly';
    if (interval === 'month') return 'monthly';

    return null;
}

export function mapStripeStatusToModuleStatus(
    stripeStatus?: string | null
): 'active' | 'cancelled' | 'expired' {
    switch (stripeStatus) {
        case 'active':
        case 'trialing':
            return 'active';
        case 'past_due':
        case 'unpaid':
        case 'incomplete_expired':
            return 'expired';
        default:
            return 'cancelled';
    }
}
