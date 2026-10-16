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

describe('estagiária IA: cliente, proposta e PDF pela ponte', () => {
    const measurement = { id: 1791925247578, largura: '1,20', altura: '1,00', quantidade: 2, ambiente: 'Quarto', tipoAplicacao: 'Desconhecido', pelicula: 'Fumê G20', active: true, discount: { type: 'percentage', value: '0' } };
    const proposal = {
        total_preco: 288, total_m2: 2.4, subtotal: 288, general_discount_amount: 0,
        general_discount: { value: '', type: 'fixed', operation: 'discount', discountValue: '10', discountType: 'percentage', increaseValue: '', increaseType: 'fixed', pricingMode: 'complete', extra: 'fora' },
        measurements: [measurement], nome_arquivo: 'Orçamento Maria.pdf', proposal_option_name: 'Opção 1', payment_config: { paymentMethods: [] },
    };

    it('lê o contexto e o cadastro do cliente, guardando só os campos conhecidos', () => {
        expect(parseBridgeCommand({ action: 'intern_context', phone: '5583988887777' })).toEqual({ action: 'intern_context', phone: '5583988887777' });
        expect(parseBridgeCommand({ action: 'intern_context' })).toEqual({ action: 'intern_context', phone: null });
        expect(parseBridgeCommand({ action: 'intern_context', phone: '123' })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'intern_client_save', phone: '5583988887777', name: '  Maria   Souza ', fields: { bairro: 'Bessa', cpf_cnpj: '000', senha: 'x' } }))
            .toEqual({ action: 'intern_client_save', phone: '5583988887777', name: 'Maria Souza', fields: { bairro: 'Bessa' } });
        expect(parseBridgeCommand({ action: 'intern_client_save', phone: '5583988887777', name: ' ' })).toHaveProperty('invalid');
    });

    it('aceita a proposta no formato do app e descarta o que não conhece', () => {
        const command = parseBridgeCommand({ action: 'intern_proposal_save', clientId: 12, proposal });
        expect(command).toMatchObject({ action: 'intern_proposal_save', clientId: 12, savedPdfId: null });
        expect((command as { proposal: { general_discount: Record<string, unknown> } }).proposal.general_discount).not.toHaveProperty('extra');
        expect(parseBridgeCommand({ action: 'intern_proposal_save', clientId: 12, savedPdfId: 99, proposal })).toMatchObject({ savedPdfId: 99 });
    });

    it('leva a opção nova para o link que já existe só com um identificador válido', () => {
        const portal = '3F2504E0-4F89-11D3-9A0C-0305E82C3301';
        const joined = parseBridgeCommand({ action: 'intern_proposal_save', clientId: 12, proposal: { ...proposal, portal_id: portal } }) as { proposal: { portal_id: string | null } };
        expect(joined.proposal.portal_id).toBe(portal.toLowerCase());
        const odd = parseBridgeCommand({ action: 'intern_proposal_save', clientId: 12, proposal: { ...proposal, portal_id: "x'; drop table" } }) as { proposal: { portal_id: string | null } };
        expect(odd.proposal.portal_id).toBeNull();
        expect((parseBridgeCommand({ action: 'intern_proposal_save', clientId: 12, proposal }) as { proposal: { portal_id: string | null } }).proposal.portal_id).toBeNull();
    });

    it('recusa proposta sem medida, com medida estranha ou valor negativo', () => {
        expect(parseBridgeCommand({ action: 'intern_proposal_save', clientId: 12, proposal: { ...proposal, measurements: [] } })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'intern_proposal_save', clientId: 12, proposal: { ...proposal, measurements: [{ ...measurement, largura: '1.20' }] } })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'intern_proposal_save', clientId: 12, proposal: { ...proposal, total_preco: -5 } })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'intern_proposal_save', clientId: 0, proposal })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'intern_proposal_save', clientId: 12, savedPdfId: 'x', proposal })).toHaveProperty('invalid');
    });

    it('só aceita PDF de verdade no envio do arquivo', () => {
        const pdf = btoa('%PDF-1.3 teste');
        const command = parseBridgeCommand({ action: 'intern_proposal_pdf', savedPdfId: 5, pdfBase64: pdf });
        expect(command).toMatchObject({ action: 'intern_proposal_pdf', savedPdfId: 5 });
        expect((command as { pdf: Uint8Array }).pdf.length).toBe(14);
        expect(parseBridgeCommand({ action: 'intern_proposal_pdf', savedPdfId: 5, pdfBase64: btoa('<html>') })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'intern_proposal_pdf', savedPdfId: 5, pdfBase64: 'não é base64' })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'intern_proposal_delete', savedPdfId: 5 })).toEqual({ action: 'intern_proposal_delete', savedPdfId: 5 });
        expect(parseBridgeCommand({ action: 'intern_proposal_delete' })).toHaveProperty('invalid');
    });
});
