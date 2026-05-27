import { supabase } from './supabaseClient';
import { supabaseConfig } from './supabaseConfig';

interface OrganizationBootstrapPayload {
    companyName: string;
    ownerName?: string;
    phone?: string;
}

interface OrganizationBootstrapSuccess {
    success: true;
    organizationId: string;
    organizationName: string;
}

interface OrganizationBootstrapFailure {
    success: false;
    error: string;
}

export type OrganizationBootstrapResult =
    | OrganizationBootstrapSuccess
    | OrganizationBootstrapFailure;

async function getAuthHeaders() {
    const {
        data: { session: currentSession }
    } = await supabase.auth.getSession();

    let session = currentSession;

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
    const authHeaders = await getAuthHeaders();

    if (!authHeaders) {
        return {
            error: 'Sua sessao expirou. Entre novamente para criar a empresa.'
        };
    }

    const response = await fetch(
        `${supabaseConfig.url}/functions/v1/${functionName}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: supabaseConfig.anonKey,
                Authorization: authHeaders.Authorization
            },
            body: JSON.stringify(payload)
        }
    );

    const rawText = await response.text();
    const parsedBody = rawText ? JSON.parse(rawText) : null;

    if (!response.ok) {
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

export async function bootstrapOrganization(
    payload: OrganizationBootstrapPayload
): Promise<OrganizationBootstrapResult> {
    try {
        const { data, error } = await callEdgeFunction<OrganizationBootstrapSuccess | OrganizationBootstrapFailure>(
            'bootstrap-organization',
            payload
        );

        if (error) {
            return {
                success: false,
                error: error.message || 'Nao foi possivel criar a empresa'
            };
        }

        if (!data?.success || !data?.organizationId) {
            return {
                success: false,
                error: data?.error || 'Resposta invalida ao criar a empresa'
            };
        }

        return {
            success: true,
            organizationId: data.organizationId,
            organizationName: data.organizationName || payload.companyName
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
    }
}
