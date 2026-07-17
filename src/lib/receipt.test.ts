import { describe, expect, it, vi } from 'vitest';
import { amountToWordsBRL, buildReceiptDetails, getDefaultReceiptDescription, receiptFileName } from './receipt';
import { Agendamento, SavedPDF } from '../../types';

const appointment: Agendamento = {
    id: 42,
    clienteId: 7,
    clienteNome: 'João da Silva',
    start: '2026-07-16T12:00:00.000Z',
    end: '2026-07-16T14:00:00.000Z',
    serviceStatus: 'completed',
};

describe('receipt', () => {
    it('escreve o valor em reais por extenso', () => {
        expect(amountToWordsBRL(1)).toBe('um real');
        expect(amountToWordsBRL(150.25)).toBe('cento e cinquenta reais e vinte e cinco centavos');
        expect(amountToWordsBRL(0.01)).toBe('um centavo');
    });

    it('monta uma descrição usando as películas sem repetir nomes', () => {
        const pdf = { measurements: [{ pelicula: 'Carbono Prime' }, { pelicula: 'Carbono Prime' }, { pelicula: 'Jateada' }] } as SavedPDF;
        expect(getDefaultReceiptDescription(pdf)).toBe('Serviço de fornecimento e aplicação de película: Carbono Prime, Jateada');
    });

    it('preenche dados do recibo sem alterar o orçamento', () => {
        vi.setSystemTime(new Date('2026-07-17T12:00:00.000Z'));
        const details = buildReceiptDetails({
            agendamento: appointment,
            amount: 850,
            client: { id: 7, nome: 'João da Silva', telefone: '83999990000', email: '', cpfCnpj: '123.456.789-00' },
            userInfo: { id: 'info', nome: 'Thiago', empresa: 'Películas Brasil', telefone: '', email: '', endereco: '', cpfCnpj: '12.345.678/0001-00', payment_methods: [] },
        });

        expect(details.receiptNumber).toBe('REC-20260716-00042');
        expect(details.client.name).toBe('João da Silva');
        expect(details.company.name).toBe('Películas Brasil');
        expect(details.amountInWords).toBe('oitocentos e cinquenta reais');
        expect(receiptFileName(details)).toContain('recibo-joao-da-silva');
        vi.useRealTimers();
    });
});
