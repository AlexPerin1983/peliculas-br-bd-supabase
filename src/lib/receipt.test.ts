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

    it('detalha um único orçamento com opção, aplicação, película e ambiente', () => {
        const pdf = {
            proposalOptionName: 'Residencial',
            measurements: [{
                tipoAplicacao: 'Janela',
                pelicula: 'Carbono Prime',
                ambiente: 'Sala',
            }],
        } as SavedPDF;

        expect(getDefaultReceiptDescription(pdf)).toBe(
            'Serviço de fornecimento e aplicação de película: Carbono Prime — Opção: Residencial; Aplicação: Janela; Ambiente: Sala',
        );
    });

    it('reúne vários orçamentos e elimina dados duplicados sem diferenciar maiúsculas', () => {
        const pdfs = [
            {
                proposalOptionName: 'Residencial',
                measurements: [{ tipoAplicacao: 'Janela', pelicula: 'Carbono Prime', ambiente: 'Sala' }],
            },
            {
                proposalOptionName: 'Comercial',
                measurements: [
                    { tipoAplicacao: ' janela ', pelicula: ' carbono prime ', ambiente: ' sala ' },
                    { tipoAplicacao: 'Porta de vidro', pelicula: 'Jateada', ambiente: 'Entrada' },
                ],
            },
        ] as SavedPDF[];

        const expected = 'Serviço de fornecimento e aplicação de película: Carbono Prime, Jateada — Opções: Residencial e Comercial; Aplicações: Janela e Porta de vidro; Ambientes: Sala e Entrada';
        expect(getDefaultReceiptDescription(pdfs)).toBe(expected);
        expect(buildReceiptDetails({ agendamento: appointment, amount: 850, linkedPdfs: pdfs }).description)
            .toBe(expected);
    });

    it('mantém os fallbacks para orçamento sem medições e atendimento avulso', () => {
        expect(getDefaultReceiptDescription({ proposalOptionName: 'Opção 3' } as SavedPDF))
            .toBe('Serviço de aplicação de películas — Opção 3');
        expect(getDefaultReceiptDescription())
            .toBe('Serviço de fornecimento e aplicação de películas');
    });

    it('prioriza a descrição manual e depois o snapshot do agendamento', () => {
        const appointmentWithSnapshot = {
            ...appointment,
            receiptDescription: 'Serviço confirmado no encerramento',
        } as Agendamento & { receiptDescription?: string };
        const linkedPdfs = [{
            measurements: [{ pelicula: 'Carbono Prime' }],
        }] as SavedPDF[];

        expect(buildReceiptDetails({
            agendamento: appointmentWithSnapshot,
            amount: 850,
            linkedPdfs,
            description: '  Descrição ajustada pelo usuário  ',
        }).description).toBe('Descrição ajustada pelo usuário');

        expect(buildReceiptDetails({
            agendamento: appointmentWithSnapshot,
            amount: 850,
            linkedPdfs,
        }).description).toBe('Serviço confirmado no encerramento');
    });

    it('limita a descrição automática a 300 caracteres sem terminar em separador', () => {
        const pdf = {
            proposalOptionName: 'Projeto corporativo com diferentes fachadas e divisórias internas',
            measurements: Array.from({ length: 12 }, (_, index) => ({
                tipoAplicacao: `Aplicação especial número ${index + 1}`,
                pelicula: `Película técnica de controle solar modelo ${index + 1}`,
                ambiente: `Ambiente comercial número ${index + 1}`,
            })),
        } as SavedPDF;

        const description = getDefaultReceiptDescription(pdf);

        expect(description.length).toBeLessThanOrEqual(300);
        expect(description).toMatch(/…$/u);
        expect(description).not.toMatch(/[\s,:;—-]…$/u);
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
