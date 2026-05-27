import { supabase } from './supabaseClient';
import { supabaseConfig } from './supabaseConfig';

interface BillingActionSuccess {
    success: true;
    sessionId?: string;
    url?: string;
    brCode?: string;
    brCodeBase64?: string;
    status?: string;
    amount?: number;
    expiresAt?: string | null;
    devMode?: boolean;
    reusedPending?: boolean;
}

interface BillingActionFailure {
    success: false;
    error: string;
}

export type BillingActionResult = BillingActionSuccess | BillingActionFailure;

export interface PixStatusResult {
    success: boolean;
    status?: string;
    paidAmount?: number | null;
    amount?: number | null;
    expiresAt?: string | null;
    devMode?: boolean;
    error?: string;
}

export interface CancelSubscriptionResult {
    success: boolean;
    cancelAtPeriodEnd?: boolean;
    expiresAt?: string | null;
    error?: string;
}

async function getAuthHeaders() {
    const {
        data: { session: currentSession }
    } = await supabase.auth.getSession();

    let session = currentSession;

    if (session?.access_token) {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser(session.access_token);

        if (userError || !user) {
            const {
                data: { session: refreshedSession }
            } = await supabase.auth.refreshSession();

            session = refreshedSession;
        }
    }

    if (!session?.access_token) {
        const {
            data: { session: refreshedSession }
        } = await supabase.auth.refreshSession();

        session = refreshedSession;
    }

    if (!session?.access_token) {
        return null;
    }

    return {
        Authorization: `Bearer ${session.access_token}`
    };
}

async function callEdgeFunction<TResponse>(
    functionName: string,
    payload: Record<string, unknown>
): Promise<{ data?: TResponse; error?: string }> {
    const sendRequest = async (authorization: string) => {
        const response = await fetch(`${supabaseConfig.url}/functions/v1/${functionName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: supabaseConfig.anonKey,
                Authorization: authorization
            },
            body: JSON.stringify(payload)
        });

        const rawText = await response.text();
        const parsedBody = rawText ? JSON.parse(rawText) : null;

        return { response, parsedBody };
    };

    const authHeaders = await getAuthHeaders();

    if (!authHeaders) {
        return {
            error: 'Sua sessao expirou. Entre novamente para continuar.'
        };
    }

    let { response, parsedBody } = await sendRequest(authHeaders.Authorization);

    if (
        response.status === 401 &&
        (parsedBody?.error === 'Invalid JWT' || parsedBody?.message === 'Invalid JWT')
    ) {
        const {
            data: { session: refreshedSession }
        } = await supabase.auth.refreshSession();

        if (refreshedSession?.access_token) {
            const retryResult = await sendRequest(`Bearer ${refreshedSession.access_token}`);
            response = retryResult.response;
            parsedBody = retryResult.parsedBody;
        }
    }

    if (!response.ok) {
        if (
            response.status === 401 &&
            (parsedBody?.error === 'Invalid JWT' || parsedBody?.message === 'Invalid JWT')
        ) {
            return {
                error: 'Sua sessao expirou ou ficou inconsistente. Atualize a pagina e entre novamente para continuar.'
            };
        }

        return {
            error:
                parsedBody?.error ||
                parsedBody?.message ||
                `Falha ao chamar ${functionName} (${response.status})`
        };
    }

    return {
        data: parsedBody as TResponse
    };
}

function buildBillingUrls(mode: 'pix' | 'subscription', moduleId: string) {
    return {
        successUrl: `${window.location.origin}${window.location.pathname}?billing=abacate-success&mode=${mode}&module_id=${encodeURIComponent(moduleId)}`,
        cancelUrl: `${window.location.origin}${window.location.pathname}?billing=abacate-cancelled&mode=${mode}&module_id=${encodeURIComponent(moduleId)}`
    };
}

export async function createAbacatePixCheckoutForModule(
    moduleId: string
): Promise<BillingActionResult> {
    try {
        const { successUrl, cancelUrl } = buildBillingUrls('pix', moduleId);
        const { data, error } = await callEdgeFunction<{
            success?: boolean;
            sessionId?: string;
            url?: string;
            status?: string;
            amount?: number;
            expiresAt?: string | null;
            devMode?: boolean;
            reusedPending?: boolean;
            error?: string;
        }>('abacate-create-pix-checkout', {
            moduleId,
            successUrl,
            cancelUrl
        });

        if (error) {
            return {
                success: false,
                error: error || 'Nao foi possivel criar o checkout avulso'
            };
        }

        if (!data?.success || !data?.sessionId || !data?.url) {
            return {
                success: false,
                error: data?.error || 'Checkout avulso nao retornou uma URL valida'
            };
        }

        if (Boolean(data.devMode)) {
            return {
                success: false,
                error: 'O checkout retornou em modo de teste. Atualize a pagina e tente novamente.'
            };
        }

        return {
            success: true,
            sessionId: data.sessionId,
            url: data.url,
            status: data.status,
            amount: data.amount,
            expiresAt: data.expiresAt || null,
            devMode: Boolean(data.devMode),
            reusedPending: Boolean(data.reusedPending)
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
    }
}

export async function checkAbacatePixStatus(sessionId: string): Promise<PixStatusResult> {
    try {
        const { data, error } = await callEdgeFunction<PixStatusResult>(
            'abacate-check-pix-status',
            { sessionId }
        );

        if (error) {
            return { success: false, error };
        }

        return data || { success: false, error: 'Resposta invalida ao consultar o Pix' };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
    }
}

export async function simulateAbacatePixPayment(sessionId: string): Promise<PixStatusResult> {
    try {
        const { data, error } = await callEdgeFunction<PixStatusResult>(
            'abacate-simulate-pix-payment',
            { sessionId }
        );

        if (error) {
            return { success: false, error };
        }

        return data || { success: false, error: 'Resposta invalida ao simular o pagamento' };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
    }
}

export async function createAbacateSubscriptionCheckoutForModule(
    moduleId: string
): Promise<BillingActionResult> {
    try {
        const { successUrl, cancelUrl } = buildBillingUrls('subscription', moduleId);
        const { data, error } = await callEdgeFunction<{
            success?: boolean;
            url?: string;
            sessionId?: string;
            devMode?: boolean;
            reusedPending?: boolean;
            error?: string;
        }>('abacate-create-subscription-checkout', {
            moduleId,
            successUrl,
            cancelUrl
        });

        if (error) {
            return {
                success: false,
                error: error || 'Nao foi possivel criar a assinatura recorrente'
            };
        }

        if (!data?.success || !data?.url) {
            return {
                success: false,
                error: data?.error || 'Assinatura nao retornou uma URL valida'
            };
        }

        if (Boolean(data.devMode)) {
            return {
                success: false,
                error: 'O checkout de assinatura retornou em modo de teste. Atualize a pagina e tente novamente.'
            };
        }

        return {
            success: true,
            url: data.url,
            sessionId: data.sessionId,
            reusedPending: Boolean(data.reusedPending)
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
    }
}

export async function cancelAbacateSubscriptionForModule(
    moduleId: string
): Promise<CancelSubscriptionResult> {
    try {
        const { data, error } = await callEdgeFunction<CancelSubscriptionResult>(
            'abacate-cancel-subscription',
            { moduleId }
        );

        if (error) {
            return { success: false, error };
        }

        return data || { success: false, error: 'Resposta invalida ao cancelar assinatura' };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
    }
}
