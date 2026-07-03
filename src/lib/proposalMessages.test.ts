import { describe, expect, it } from 'vitest';
import {
    buildProposalWhatsAppAppUrl,
    buildProposalWhatsAppBusinessUrl,
    buildProposalWhatsAppUrl,
    calculateFollowUpDiscount,
    fillProposalMessage,
    findUnsupportedProposalTags,
    normalizeWhatsAppPhone,
    ProposalMessageValues,
} from './proposalMessages';

const values: ProposalMessageValues = {
    primeiro_nome: 'Ana',
    nome_cliente: 'Ana Souza',
    titulo_orcamento: 'Sala',
    valor_final: 'R$ 900,00',
    desconto_extra: '',
    valor_especial: '',
    observacao_comercial: '',
};

describe('proposalMessages', () => {
    it('preenche as tags e usa texto vazio para campos opcionais', () => {
        expect(fillProposalMessage('Oi, {{primeiro_nome}}. {{observacao_comercial}}', values)).toBe('Oi, Ana. ');
    });

    it('identifica tags que não fazem parte da lista fixa', () => {
        expect(findUnsupportedProposalTags('{{primeiro_nome}} {{tag_renomeada}}')).toEqual(['tag_renomeada']);
    });

    it('limpa o telefone, inclui o país e monta o link codificado', () => {
        expect(normalizeWhatsAppPhone('(11) 99999-0000')).toBe('5511999990000');
        expect(buildProposalWhatsAppUrl('(11) 99999-0000', 'Olá, Ana!')).toBe(
            'https://wa.me/5511999990000?text=Ol%C3%A1%2C%20Ana!'
        );
        expect(buildProposalWhatsAppAppUrl('(11) 99999-0000', 'Olá, Ana!')).toBe(
            'whatsapp://send?phone=5511999990000&text=Ol%C3%A1%2C%20Ana!'
        );
        expect(buildProposalWhatsAppBusinessUrl('(11) 99999-0000', 'Olá, Ana!', 'Android')).toContain(
            'package=com.whatsapp.w4b'
        );
        expect(buildProposalWhatsAppBusinessUrl('(11) 99999-0000', 'Olá, Ana!', 'iPhone')).toBe(
            'whatsapp-business://send?phone=5511999990000&text=Ol%C3%A1%2C%20Ana!'
        );
    });

    it('calcula desconto percentual sobre o valor original', () => {
        expect(calculateFollowUpDiscount(4799.6, '10', 'percentage')).toEqual({
            discountValue: 10,
            discountAmount: 479.96,
            specialValue: 4319.64,
            formattedDiscount: '10%',
        });
    });

    it('calcula desconto fixo em reais', () => {
        expect(calculateFollowUpDiscount(4799.6, '300', 'fixed')).toEqual({
            discountValue: 300,
            discountAmount: 300,
            specialValue: 4499.6,
            formattedDiscount: 'R$\u00a0300,00',
        });
    });

    it('limita o desconto ao valor original e trata campos vazios sem NaN', () => {
        expect(calculateFollowUpDiscount(100, '150', 'fixed').specialValue).toBe(0);
        expect(calculateFollowUpDiscount(100, '120', 'percentage').discountValue).toBe(100);
        expect(calculateFollowUpDiscount(100, '', 'percentage')).toEqual({
            discountValue: 0,
            discountAmount: 0,
            specialValue: 100,
            formattedDiscount: '',
        });
        expect(calculateFollowUpDiscount(Number.NaN, 'abc', 'fixed').specialValue).toBe(0);
    });
});
