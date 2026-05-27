import {
    copyMeasurementsToMeasurementClipboard,
    createPastedMeasurementsFromClipboard,
    getMeasurementClipboardCount
} from './measurementClipboard';
import { UIMeasurement } from '../../types';

describe('measurementClipboard', () => {
    const measurement: UIMeasurement = {
        id: 10,
        largura: '2,14',
        altura: '2,08',
        quantidade: 1,
        ambiente: 'Sala',
        tipoAplicacao: 'Porta',
        pelicula: 'Blackout',
        active: true,
        discount: { value: '5', type: 'percentage' },
        estoqueUso: {
            tipo: 'retalho',
            retalhoId: 55,
            filmId: 'blackout',
            larguraCm: 100,
            comprimentoCm: 200,
            orientacao: 'original',
            consumidoEm: '2026-05-04T00:00:00.000Z'
        }
    };

    beforeEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it('copia medidas reaproveitaveis sem carregar id nem vinculo de estoque', () => {
        copyMeasurementsToMeasurementClipboard([measurement]);

        expect(getMeasurementClipboardCount()).toBe(1);

        const pastedMeasurements = createPastedMeasurementsFromClipboard([]);

        expect(pastedMeasurements).toHaveLength(1);
        expect(pastedMeasurements[0]).toEqual(expect.objectContaining({
            largura: '2,14',
            altura: '2,08',
            quantidade: 1,
            ambiente: 'Sala',
            pelicula: 'Blackout',
            discount: { value: '5', type: 'percentage' },
            active: true,
            isNew: false
        }));
        expect(pastedMeasurements[0].id).not.toBe(10);
        expect(pastedMeasurements[0].estoqueUso).toBeUndefined();
    });

    it('gera ids novos que nao colidem com medidas existentes', () => {
        vi.spyOn(Date, 'now').mockReturnValue(10);

        copyMeasurementsToMeasurementClipboard([
            measurement,
            { ...measurement, id: 11, ambiente: 'Quarto' }
        ]);

        const pastedMeasurements = createPastedMeasurementsFromClipboard([
            { ...measurement, id: 10 }
        ]);

        expect(pastedMeasurements.map(item => item.id)).toEqual([1010, 11]);
    });
});
