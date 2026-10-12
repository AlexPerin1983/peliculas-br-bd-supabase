// Regras puras da ponte do WhatsApp conectado (sem Deno nem Supabase), para
// serem testadas no Vitest e usadas pela função whatsapp-bridge.

export const BRIDGE_KEY_HEADER = 'x-bridge-key';

export type BridgeReportStatus = 'sent' | 'failed' | 'pending' | 'canceled';

export type BridgeCommand =
    | { action: 'hello' }
    | { action: 'pending'; limit: number }
    | { action: 'claim'; id: number }
    | { action: 'report'; id: number; status: BridgeReportStatus; error: string | null; providerMessageId: string | null };

const REPORT_STATUSES: BridgeReportStatus[] = ['sent', 'failed', 'pending', 'canceled'];

// A chave do painel é gerada com 32 bytes aleatórios (hex ou base64url).
export const isPlausibleBridgeKey = (key: unknown): key is string =>
    typeof key === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(key);

export const sha256Hex = async (value: string): Promise<string> => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

const positiveId = (value: unknown): number | null =>
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;

const optionalText = (value: unknown, max: number): string | null =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

// Recusa com o motivo. Não se chama "error" para não se confundir com o
// campo error do resultado de envio (report).
export type BridgeRejection = { invalid: string };

export const parseBridgeCommand = (payload: unknown): BridgeCommand | BridgeRejection => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { invalid: 'Pedido inválido.' };
    const body = payload as Record<string, unknown>;
    switch (body.action) {
        case 'hello':
            return { action: 'hello' };
        case 'pending': {
            const limit = typeof body.limit === 'number' && Number.isFinite(body.limit) ? Math.floor(body.limit) : 100;
            return { action: 'pending', limit: Math.min(Math.max(limit, 1), 200) };
        }
        case 'claim': {
            const id = positiveId(body.id);
            return id ? { action: 'claim', id } : { invalid: 'Pedido sem identificação.' };
        }
        case 'report': {
            const id = positiveId(body.id);
            if (!id) return { invalid: 'Pedido sem identificação.' };
            if (!REPORT_STATUSES.includes(body.status as BridgeReportStatus)) return { invalid: 'Situação inválida.' };
            return {
                action: 'report',
                id,
                status: body.status as BridgeReportStatus,
                error: optionalText(body.error, 500),
                providerMessageId: optionalText(body.providerMessageId, 200),
            };
        }
        default:
            return { invalid: 'Ação desconhecida.' };
    }
};
