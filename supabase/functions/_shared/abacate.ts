const ABACATE_V1_API_BASE = 'https://api.abacatepay.com/v1';
const ABACATE_V2_API_BASE = 'https://api.abacatepay.com/v2';
const DEFAULT_PUBLIC_HMAC_KEY =
    't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';

type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

function getAbacateApiKey(): string {
    const apiKey = Deno.env.get('ABACATE_API_KEY');
    if (!apiKey) {
        throw new Error('ABACATE_API_KEY nao configurada');
    }

    return apiKey;
}

export async function abacateRequest<T>(
    version: 'v1' | 'v2',
    path: string,
    options?: {
        method?: 'GET' | 'POST';
        body?: JsonValue;
    }
): Promise<T> {
    const apiKey = getAbacateApiKey();
    const response = await fetch(
        `${version === 'v1' ? ABACATE_V1_API_BASE : ABACATE_V2_API_BASE}${path}`,
        {
            method: options?.method || 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: options?.body ? JSON.stringify(options.body) : undefined
        }
    );

    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
        throw new Error(
            payload?.error ||
                payload?.message ||
                `Erro AbacatePay (${response.status})`
        );
    }

    if (payload?.error) {
        throw new Error(payload.error);
    }

    return payload as T;
}

function secureCompare(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;

    let mismatch = 0;
    for (let index = 0; index < a.length; index += 1) {
        mismatch |= a[index] ^ b[index];
    }

    return mismatch === 0;
}

function decodeBase64ToBytes(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

export async function verifyAbacateWebhookSignature(
    rawBody: string,
    signatureHeader: string | null
): Promise<boolean> {
    if (!signatureHeader) return false;

    const publicHmacKey =
        Deno.env.get('ABACATE_WEBHOOK_PUBLIC_KEY') || DEFAULT_PUBLIC_HMAC_KEY;

    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(publicHmacKey),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(rawBody)
    );

    const expectedBytes = new Uint8Array(signature);
    const receivedBytes = decodeBase64ToBytes(signatureHeader);

    return secureCompare(expectedBytes, receivedBytes);
}
