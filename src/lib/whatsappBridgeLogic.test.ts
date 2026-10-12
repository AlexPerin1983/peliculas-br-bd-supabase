// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isPlausibleBridgeKey, parseBridgeCommand, sha256Hex } from '../../supabase/functions/whatsapp-bridge/bridgeLogic';

describe('ponte do WhatsApp conectado', () => {
    it('aceita só chaves longas e sem caracteres estranhos', () => {
        expect(isPlausibleBridgeKey('a'.repeat(64))).toBe(true);
        expect(isPlausibleBridgeKey('Ab0-_'.repeat(8))).toBe(true);
        expect(isPlausibleBridgeKey('curta')).toBe(false);
        expect(isPlausibleBridgeKey(`${'a'.repeat(40)} ' OR 1=1`)).toBe(false);
        expect(isPlausibleBridgeKey(null)).toBe(false);
    });

    it('guarda a chave como SHA-256 em hex, igual ao banco', async () => {
        expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });

    it('lê as ações do painel e limita a lista', () => {
        expect(parseBridgeCommand({ action: 'hello' })).toEqual({ action: 'hello' });
        expect(parseBridgeCommand({ action: 'pending' })).toEqual({ action: 'pending', limit: 100 });
        expect(parseBridgeCommand({ action: 'pending', limit: 5000 })).toEqual({ action: 'pending', limit: 200 });
        expect(parseBridgeCommand({ action: 'pending', limit: 0 })).toEqual({ action: 'pending', limit: 1 });
        expect(parseBridgeCommand({ action: 'claim', id: 7 })).toEqual({ action: 'claim', id: 7 });
    });

    it('recusa pedidos sem identificação, situação inválida ou ação desconhecida', () => {
        expect(parseBridgeCommand({ action: 'claim', id: '7' })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'claim', id: -1 })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'report', id: 3, status: 'read' })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'delete' })).toHaveProperty('invalid');
        expect(parseBridgeCommand(null)).toHaveProperty('invalid');
        expect(parseBridgeCommand([])).toHaveProperty('invalid');
    });

    it('um resultado com motivo de falha é um resultado, não uma recusa', () => {
        const command = parseBridgeCommand({ action: 'report', id: 3, status: 'failed', error: 'Número sem WhatsApp' });
        expect('invalid' in command).toBe(false);
        expect(command).toMatchObject({ action: 'report', status: 'failed', error: 'Número sem WhatsApp' });
    });

    it('limpa e corta o erro e o código da mensagem informados pelo painel', () => {
        expect(parseBridgeCommand({ action: 'report', id: 3, status: 'failed', error: `  ${'x'.repeat(600)} `, providerMessageId: '  ' })).toEqual({
            action: 'report', id: 3, status: 'failed', error: 'x'.repeat(500), providerMessageId: null,
        });
        expect(parseBridgeCommand({ action: 'report', id: 3, status: 'sent', providerMessageId: 'ABC123' })).toEqual({
            action: 'report', id: 3, status: 'sent', error: null, providerMessageId: 'ABC123',
        });
    });
});
