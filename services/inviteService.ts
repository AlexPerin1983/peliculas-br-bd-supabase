import { supabase } from './supabaseClient';
import { sendInviteEmail } from './emailHelper';

export interface OrganizationInvite {
    id: string;
    organization_id: string;
    invite_code: string;
    created_at: string;
    expires_at?: string;
    is_active: boolean;
    max_uses?: number;
    current_uses: number;
}

/**
 * Gera código único de convite (8 caracteres alfanuméricos)
 * Evita caracteres confusos como 0, O, I, 1
 */
function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Criar ou regenerar código de convite para a organização
 * Desativa convites anteriores e gera um novo
 */
export async function createOrganizationInvite(organizationId: string): Promise<OrganizationInvite | null> {
    try {

        // Primeiro, desativar todos os convites anteriores desta organização
        const { error: deactivateError } = await supabase
            .from('organization_invites')
            .update({ is_active: false })
            .eq('organization_id', organizationId);

        if (deactivateError) {
            console.error('[inviteService] Erro ao desativar convites anteriores:', deactivateError);
        }

        // Gerar novo código único
        let inviteCode = generateInviteCode();
        let attempts = 0;
        const maxAttempts = 10;

        // Tentar gerar código único (verificar se já existe)
        while (attempts < maxAttempts) {
            const { data: existing } = await supabase
                .from('organization_invites')
                .select('id')
                .eq('invite_code', inviteCode)
                .single();

            if (!existing) break; // Código é único

            inviteCode = generateInviteCode(); // Gerar novo
            attempts++;
        }

        // Inserir novo convite
        const { data: currentUser } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('organization_invites')
            .insert({
                organization_id: organizationId,
                invite_code: inviteCode,
                is_active: true,
                created_by: currentUser.user?.id
            })
            .select()
            .single();

        if (error) {
            console.error('[inviteService] Erro ao criar convite:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('[inviteService] Erro ao criar convite:', error);
        return null;
    }
}

/**
 * Obter convite ativo da organização
 */
export async function getActiveInvite(organizationId: string): Promise<OrganizationInvite | null> {
    try {

        const { data, error } = await supabase
            .from('organization_invites')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(); // Usa maybeSingle em vez de single para não dar erro se não encontrar

        if (error && error.code !== 'PGRST116') {
            console.error('[inviteService] Erro ao buscar convite:', error);
            throw error;
        }

    }

        return data || null;
} catch (error) {
    console.error('[inviteService] Erro ao buscar convite:', error);
    return null;
}
}

/**
 * Validar código de convite e obter dados da organização
 */
export async function validateInviteCode(inviteCode: string): Promise<{
    valid: boolean;
    organizationId?: string;
    organizationName?: string;
    error?: string;
}> {
    try {

        if (!inviteCode || inviteCode.length < 8) {
            return { valid: false, error: 'Código inválido' };
        }

        const { data: invite, error } = await supabase
            .from('organization_invites')
            .select(`
                *,
                organizations:organization_id (
                    id,
                    name
                )
            `)
            .eq('invite_code', inviteCode.toUpperCase())
            .eq('is_active', true)
            .maybeSingle();

        if (error) {
            console.error('[inviteService] Erro ao validar:', error);
            return { valid: false, error: 'Erro ao validar código' };
        }

        if (!invite) {
            return { valid: false, error: 'Código inválido ou expirado' };
        }

        // Verificar expiração
        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
            return { valid: false, error: 'Código expirado' };
        }

        // Verificar limite de usos
        if (invite.max_uses && invite.current_uses >= invite.max_uses) {
            return { valid: false, error: 'Código já atingiu o limite de usos' };
        }

        return {
            valid: true,
            organizationId: invite.organization_id,
            organizationName: invite.organizations?.name || 'Organização'
        };
    } catch (error) {
        console.error('[inviteService] Erro ao validar convite:', error);
        return { valid: false, error: 'Erro ao validar código' };
    }
}

/**
 * Incrementar contador de usos do convite
 * Chamado após cadastro bem-sucedido
 */
export async function incrementInviteUsage(inviteCode: string): Promise<void> {
    try {

        const { error } = await supabase.rpc('increment_invite_usage', {
            p_invite_code: inviteCode.toUpperCase()
        });

        if (error) {
            console.error('[inviteService] Erro ao incrementar uso:', error);
        }
    } catch (error) {
        console.error('[inviteService] Erro ao incrementar uso:', error);
    }
}

/**
 * Gerar URL completa do convite
 */
export function getInviteUrl(inviteCode: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/convite/${inviteCode}`;
}

/**
 * Enviar email de convite para um usuário
 * @param email Email do destinatário
 * @param inviteCode Código do convite
 * @param inviterName Nome de quem está convidando
 * @param organizationName Nome da organização
 */
export async function sendInviteEmailToUser(
    email: string,
    inviteCode: string,
    inviterName: string,
    organizationName: string
): Promise<{ success: boolean; error?: string }> {
    try {

        const inviteLink = getInviteUrl(inviteCode);

        const result = await sendInviteEmail(email, {
            inviterName,
            organizationName,
            inviteLink,
        });

        if (result.success) {
            return { success: true };
        } else {
            console.error('[inviteService] Erro ao enviar email:', result.error);
            return { success: false, error: result.error };
        }
    } catch (error) {
        console.error('[inviteService] Erro ao enviar email de convite:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
    }
}

