/**
 * Conector local de WhatsApp (Fase 1) — cliente HTTP do serviço `wa-connector/`.
 *
 * Tudo aqui só faz sentido em desenvolvimento local: o serviço roda em
 * http://localhost:3001 e a tela fica atrás da flag VITE_WA_CONNECTOR.
 * Em produção a flag não existe, então a aba/rota nem aparecem.
 */

export const WA_BASE = (import.meta.env.VITE_WA_CONNECTOR_URL as string) || 'http://localhost:3003';

/** A tela do conector só é exposta quando VITE_WA_CONNECTOR === '1' (definido no .env.local). */
export function isWaConnectorEnabled(): boolean {
    return import.meta.env.VITE_WA_CONNECTOR === '1';
}

export type WaStatus = 'disconnected' | 'connecting' | 'qr' | 'connected' | 'reconnecting';

export interface WaStatusResponse {
    status: WaStatus;
    qr: string | null;
    phone: string | null;
}

export interface WaRecebido {
    telefone: string;
    nome: string;
    nomeValido: boolean;
    texto: string;
    ts: number;
}

export interface WaMidia {
    tipo: 'image' | 'audio';
    mimetype: string;
    base64?: string; // pode faltar se a mídia já saiu da memória do conector
}

export interface WaMensagem {
    fromMe: boolean;
    texto: string;
    ts: number;
    midia?: WaMidia;
}

export interface WaGatilho {
    telefone: string;
    ts: number;
    nome?: string;
}

/** Nome válido = depois de remover emoji/símbolos, sobram ≥2 letras (inclui acentos). */
export function nomeEhValido(s: string | undefined | null): boolean {
    if (!s) return false;
    const letras = (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    return letras >= 2;
}

/** Normaliza o telefone para só dígitos, para comparar com clientes existentes. */
export function soDigitos(s: string | undefined | null): string {
    return (s || '').replace(/\D/g, '');
}

async function req<T>(pathname: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${WA_BASE}${pathname}`, init);
    if (!res.ok) throw new Error(`wa-connector ${pathname} → HTTP ${res.status}`);
    return res.json() as Promise<T>;
}

export function conectar(): Promise<WaStatusResponse> {
    return req<WaStatusResponse>('/conectar', { method: 'POST' });
}

export function desconectar(): Promise<{ status: WaStatus }> {
    return req<{ status: WaStatus }>('/desconectar', { method: 'POST' });
}

export function getStatus(): Promise<WaStatusResponse> {
    return req<WaStatusResponse>('/status');
}

export function getRecebidos(since = 0): Promise<WaRecebido[]> {
    return req<WaRecebido[]>(`/recebidos?since=${since}`);
}

export function getConversa(telefone: string): Promise<WaMensagem[]> {
    return req<WaMensagem[]>(`/conversa/${soDigitos(telefone)}`);
}

export function getGatilhos(since = 0): Promise<WaGatilho[]> {
    return req<WaGatilho[]>(`/gatilhos?since=${since}`);
}

export function getGatilhosEnvio(since = 0): Promise<WaGatilho[]> {
    return req<WaGatilho[]>(`/gatilhos-envio?since=${since}`);
}

export function enviarDocumento(
    telefone: string,
    base64: string,
    filename: string,
    caption = ''
): Promise<{ ok: boolean }> {
    return req<{ ok: boolean }>('/enviar-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: soDigitos(telefone), base64, filename, caption })
    });
}
