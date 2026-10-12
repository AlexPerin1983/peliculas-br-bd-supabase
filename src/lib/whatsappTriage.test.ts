// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { approveLabel, doneLabel, formatTriagePhone, pendingSummary, suggestionSummary, triageKind } from './whatsappTriage';

describe('triagem do WhatsApp conectado', () => {
    it('sabe o que aprovar faz com cada tipo', () => {
        expect(triageKind('agendar')).toBe('client');
        expect(triageKind('fornecedor')).toBe('supplier');
        expect(triageKind('pessoal')).toBe('ignore');
        expect(approveLabel('orcamento')).toBe('Salvar como cliente');
        expect(approveLabel('fornecedor')).toBe('Salvar em Fornecedores');
        expect(approveLabel('nao_cliente')).toBe('Confirmar: não é cliente');
    });

    it('resume a chance de acerto e o que espera revisão', () => {
        expect(suggestionSummary('novo_cliente', 0.876, 'gemini')).toBe('Cliente novo · 88% · Gemini');
        expect(suggestionSummary('pessoal', null, null)).toBe('Amigos e família');
        expect(pendingSummary(['novo_cliente', 'agendar', 'fornecedor', 'pessoal'])).toBe('2 possíveis clientes · 1 fornecedor · 1 outro');
        expect(pendingSummary([])).toBe('');
    });

    it('mostra o telefone como a empresa lê e como ficou cada contato revisado', () => {
        expect(formatTriagePhone('5583999998888')).toBe('(83) 99999-8888');
        expect(formatTriagePhone('351912345678')).toBe('+351912345678');
        expect(formatTriagePhone(null)).toBe('Número oculto pelo WhatsApp');
        expect(doneLabel('auto_approved', 'fornecedor')).toBe('Salvo em Fornecedores (pelo painel, sozinho)');
        expect(doneLabel('approved', 'pessoal')).toBe('Amigos e família');
        expect(doneLabel('discarded', 'novo_cliente')).toBe('Descartado');
    });
});
