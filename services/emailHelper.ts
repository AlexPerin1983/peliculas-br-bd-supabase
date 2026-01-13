/**
 * Helper para enviar emails através da Edge Function do Supabase
 * 
 * Este arquivo facilita o envio de emails do frontend chamando a Edge Function
 * que se comunica com o Resend.
 */

import { supabase } from './supabaseClient'

interface EmailResponse {
    success: boolean
    messageId?: string
    error?: string
}

interface WelcomeEmailData {
    userName: string
    organizationName: string
}

interface PasswordResetEmailData {
    userName: string
    resetLink: string
    expiresIn?: string
}

interface InviteEmailData {
    inviterName: string
    organizationName: string
    inviteLink: string
}

interface CustomEmailData {
    from?: string
    subject: string
    html: string
}

/**
 * Envia email de boas-vindas
 */
export async function sendWelcomeEmail(
    to: string,
    data: WelcomeEmailData
): Promise<EmailResponse> {
    try {
        const { data: result, error } = await supabase.functions.invoke('send-email', {
            body: {
                type: 'welcome',
                to,
                data,
            },
        })

        return result
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
        }
    }
}

/**
 * Envia email de redefinição de senha
 */
export async function sendPasswordResetEmail(
    to: string,
    data: PasswordResetEmailData
): Promise<EmailResponse> {
    try {
        const { data: result, error } = await supabase.functions.invoke('send-email', {
            body: {
                type: 'password-reset',
                to,
                data,
            },
        })

        return result
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
        }
    }
}

/**
 * Envia email de convite
 */
export async function sendInviteEmail(
    to: string,
    data: InviteEmailData
): Promise<EmailResponse> {
    try {
        const { data: result, error } = await supabase.functions.invoke('send-email', {
            body: {
                type: 'invite',
                to,
                data,
            },
        })

        return result
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
        }
    }
}

/**
 * Envia email personalizado
 */
export async function sendCustomEmail(
    to: string,
    data: CustomEmailData
): Promise<EmailResponse> {
    try {
        const { data: result, error } = await supabase.functions.invoke('send-email', {
            body: {
                type: 'custom',
                to,
                data,
            },
        })

        return result
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
        }
    }
}

// Exporta todas as funções como um objeto
export const emailHelper = {
    sendWelcomeEmail,
    sendPasswordResetEmail,
    sendInviteEmail,
    sendCustomEmail,
}

export default emailHelper
