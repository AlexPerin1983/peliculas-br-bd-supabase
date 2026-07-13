import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createSupabaseAdminClient } from '../_shared/billing.ts';

interface BootstrapRequest {
    companyName?: string;
    ownerName?: string;
    phone?: string;
}

interface BootstrapResponse {
    success: boolean;
    organizationId?: string;
    organizationName?: string;
    error?: string;
}

const DEFAULT_PAYMENT_METHODS = [
    {
        tipo: 'pix',
        ativo: true,
        chave_pix: '',
        tipo_chave_pix: 'email',
        nome_responsavel_pix: ''
    },
    { tipo: 'boleto', ativo: false },
    { tipo: 'parcelado_sem_juros', ativo: true, parcelas_max: 1 },
    { tipo: 'adiantamento', ativo: false, porcentagem: 30 },
    { tipo: 'observacao', ativo: false, texto: '' }
];

const DEFAULT_WORKING_HOURS = {
    start: '08:00',
    end: '18:00',
    days: [1, 2, 3, 4, 5]
};

const DEFAULT_COLORS = {
    primaria: '#364562',
    secundaria: '#937e44'
};

function jsonResponse(body: BootstrapResponse, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: corsHeaders
    });
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (req.method !== 'POST') {
            return jsonResponse({ success: false, error: 'Metodo nao permitido' }, 405);
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return jsonResponse({ success: false, error: 'Nao autorizado' }, 401);
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: authHeader }
                },
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        const supabaseAdmin = createSupabaseAdminClient();

        const {
            data: { user }
        } = await supabaseClient.auth.getUser();

        if (!user) {
            return jsonResponse({ success: false, error: 'Usuario nao autenticado' }, 401);
        }

        const body = (await req.json()) as BootstrapRequest;
        const companyName = body.companyName?.trim();
        const ownerName =
            body.ownerName?.trim() ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'Responsavel';
        const phone = body.phone?.trim() || '';
        const phoneDigits = phone.replace(/\D/g, '');
        const normalizedEmail = user.email?.trim().toLowerCase();

        if (!companyName || companyName.length < 2) {
            return jsonResponse(
                { success: false, error: 'Informe um nome de empresa valido' },
                400
            );
        }

        if (!/^[1-9]{2}\d{8,9}$/.test(phoneDigits)) {
            return jsonResponse(
                { success: false, error: 'Informe um telefone valido com DDD' },
                400
            );
        }

        let { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, approved, organization_id')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) {
            throw profileError;
        }

        if (!profile) {
            const { data: createdProfile, error: createProfileError } = await supabaseAdmin
                .from('profiles')
                .insert({
                    id: user.id,
                    email: normalizedEmail || user.email || '',
                    role: 'user',
                    approved: true
                })
                .select('id, email, approved, organization_id')
                .single();

            if (createProfileError || !createdProfile) {
                throw new Error(createProfileError?.message || 'Nao foi possivel criar o perfil');
            }

            profile = createdProfile;
        }

        if (profile.organization_id) {
            const { data: existingOrg } = await supabaseAdmin
                .from('organizations')
                .select('id, name')
                .eq('id', profile.organization_id)
                .maybeSingle();

            return jsonResponse({
                success: true,
                organizationId: existingOrg?.id || profile.organization_id,
                organizationName: existingOrg?.name || companyName
            });
        }

        let organizationId: string | null = null;
        let organizationName = companyName;

        const { data: existingOwnedOrg, error: existingOrgError } = await supabaseAdmin
            .from('organizations')
            .select('id, name')
            .eq('owner_id', user.id)
            .maybeSingle();

        if (existingOrgError) {
            throw existingOrgError;
        }

        if (existingOwnedOrg) {
            organizationId = existingOwnedOrg.id;
            organizationName = existingOwnedOrg.name || companyName;
        } else {
            const { data: createdOrg, error: createOrgError } = await supabaseAdmin
                .from('organizations')
                .insert({
                    name: companyName,
                    owner_id: user.id
                })
                .select('id, name')
                .single();

            if (createOrgError || !createdOrg) {
                throw new Error(
                    createOrgError?.message || 'Nao foi possivel criar a organizacao'
                );
            }

            organizationId = createdOrg.id;
            organizationName = createdOrg.name;
        }

        const { error: memberError } = await supabaseAdmin
            .from('organization_members')
            .upsert(
                {
                    organization_id: organizationId,
                    user_id: user.id,
                    email: normalizedEmail || user.email || '',
                    role: 'owner',
                    status: 'active',
                    joined_at: new Date().toISOString()
                },
                {
                    onConflict: 'organization_id,email',
                    ignoreDuplicates: false
                }
            );

        if (memberError) {
            throw new Error(memberError.message);
        }

        const { error: updateProfileError } = await supabaseAdmin
            .from('profiles')
            .update({
                organization_id: organizationId,
                approved: true,
                email: normalizedEmail || user.email || profile.email || ''
            })
            .eq('id', user.id);

        if (updateProfileError) {
            throw new Error(updateProfileError.message);
        }

        const { error: subscriptionError } = await supabaseAdmin
            .from('subscriptions')
            .upsert(
                {
                    organization_id: organizationId
                },
                {
                    onConflict: 'organization_id',
                    ignoreDuplicates: false
                }
            );

        if (subscriptionError) {
            throw new Error(subscriptionError.message);
        }

        const { data: existingUserInfo, error: userInfoLookupError } = await supabaseAdmin
            .from('user_info')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();

        if (userInfoLookupError) {
            throw userInfoLookupError;
        }

        if (!existingUserInfo) {
            const { error: userInfoError } = await supabaseAdmin.from('user_info').insert({
                id: user.id,
                user_id: user.id,
                nome: ownerName,
                empresa: companyName,
                telefone: phone,
                email: normalizedEmail || user.email || '',
                endereco: '',
                cpf_cnpj: '',
                cores: DEFAULT_COLORS,
                payment_methods: DEFAULT_PAYMENT_METHODS,
                proposal_validity_days: 7,
                prazo_pagamento: 'Pagamento devido na conclusao do servico.',
                working_hours: DEFAULT_WORKING_HOURS,
                employees: [{ id: 1, nome: ownerName }],
                ai_config: { provider: 'gemini', apiKey: '' },
                social_links: {}
            });

            if (userInfoError) {
                throw new Error(userInfoError.message);
            }
        }

        return jsonResponse({
            success: true,
            organizationId,
            organizationName
        });
    } catch (error) {
        console.error('[bootstrap-organization] Error:', error);

        return jsonResponse(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Erro desconhecido'
            },
            500
        );
    }
});
