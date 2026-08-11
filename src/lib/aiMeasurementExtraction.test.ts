import {
    MeasurementExtractionError,
    getFriendlyMeasurementExtractionError,
    normalizeAndGroupMeasurementExtraction,
    parseMeasurementExtractionResponse
} from './aiMeasurementExtraction';

const sourceDimensions: Array<[string, string]> = [
    ['1,12', '0,87'],
    ['1,17', '0,87'],
    ['1,17', '0,87'],
    ['1,12', '0,87'],
    ['1,15', '0,87'],
    ['0,20', '0,87'],
    ['1,17', '0,87'],
    ['1,06', '0,87'],
    ['1,00', '0,87'],
    ['1,16', '0,87'],
    ['1,12', '0,87'],
    ['1,00', '0,87'],
    ['1,16', '0,87'],
    ['1,16', '0,87'],
    ['1,16', '0,87'],
    ['1,06', '0,87'],
    ['0,77', '0,84'],
    ['0,75', '0,84'],
    ['0,76', '0,84'],
    ['0,76', '0,84'],
    ['0,76', '0,84'],
    ['0,76', '0,84'],
    ['0,70', '1,02'],
    ['0,70', '1,02'],
    ['0,70', '1,02'],
    ['0,70', '1,02'],
    ['0,64', '0,95'],
    ['0,70', '1,02'],
    ['1,00', '1,00'],
    ['1,00', '1,00'],
    ['1,00', '1,00']
];

describe('aiMeasurementExtraction', () => {
    it('lê JSON estruturado e reconhece resposta truncada', () => {
        const payload = parseMeasurementExtractionResponse(JSON.stringify({
            medidas: [{ largura: '1,20', altura: '0,80', quantidade: 1 }],
            totalItens: 1
        }), 'STOP');

        expect(payload.medidas).toHaveLength(1);
        expect(() => parseMeasurementExtractionResponse('{"medidas":[{"largura":"1,20"}', 'MAX_TOKENS'))
            .toThrowError(expect.objectContaining({ code: 'OUTPUT_TRUNCATED' }));
    });

    it('agrupa no aplicativo as 31 linhas da foto sem trocar contagens', () => {
        const extraction = normalizeAndGroupMeasurementExtraction({
            medidas: sourceDimensions.map(([largura, altura], index) => ({
                linhaOrigem: index + 1,
                local: '',
                largura,
                altura,
                quantidade: 1,
                peliculaDetectada: ''
            })),
            totalItens: 31,
            houveTrechoIlegivel: false
        });

        expect(extraction.measurements).toHaveLength(13);
        expect(extraction.totalItems).toBe(31);
        expect(extraction.measurements.find(item => item.largura === '1,12' && item.altura === '0,87')?.quantidade).toBe(3);
        expect(extraction.measurements.find(item => item.largura === '0,76' && item.altura === '0,84')?.quantidade).toBe(4);

        const exactArea = extraction.measurements.reduce((sum, item) => (
            sum
            + Number(item.largura.replace(',', '.'))
            * Number(item.altura.replace(',', '.'))
            * item.quantidade
        ), 0);
        expect(exactArea).toBeCloseTo(25.781, 5);
        expect(Math.round((exactArea + Number.EPSILON) * 100) / 100).toBe(25.78);
    });

    it('preserva locais diferentes e sinaliza linhas inválidas para revisão', () => {
        const extraction = normalizeAndGroupMeasurementExtraction({
            medidas: [
                { local: 'Sala', largura: '1.20', altura: '0,80', quantidade: 1 },
                { local: 'Quarto', largura: 1.2, altura: 0.8, quantidade: 1 },
                { local: 'Inválida', largura: '', altura: '0,80', quantidade: 1 }
            ],
            totalItens: 2
        });

        expect(extraction.measurements).toHaveLength(2);
        expect(extraction.skippedRows).toBe(1);
        expect(extraction.needsReview).toBe(true);
    });

    it('bloqueia divergência entre total declarado e soma das quantidades', () => {
        expect(() => normalizeAndGroupMeasurementExtraction({
            medidas: [{ largura: '1,00', altura: '1,00', quantidade: 2 }],
            totalItens: 3
        })).toThrowError(expect.objectContaining({ code: 'COUNT_MISMATCH' }));
    });

    it('não mostra detalhes técnicos na mensagem para o usuário', () => {
        const friendly = getFriendlyMeasurementExtractionError(
            new MeasurementExtractionError('OUTPUT_TRUNCATED', 'SyntaxError at JSON.parse line 1')
        );

        expect(friendly.title).toBe('Lista muito grande');
        expect(friendly.message).not.toMatch(/SyntaxError|JSON\.parse/i);
    });
});
