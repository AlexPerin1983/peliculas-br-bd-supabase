import { describe, expect, it } from 'vitest';
import { Measurement, Retalho } from '../../types';
import {
    getCompatibleRetalhosForMeasurement,
    getMeasurementDimensionsCm,
    isRetalhoCompatibleWithMeasurement,
    parseMeasurementValueToCm
} from './retalhoMatching';

const measurement: Measurement = {
    id: 1,
    largura: '0,62',
    altura: '0,37',
    quantidade: 1,
    ambiente: 'Teste',
    tipoAplicacao: 'Interna',
    pelicula: 'Window Blue thermal',
    active: true
};

const compatibleRetalho: Retalho = {
    id: 10,
    filmId: 'Window Blue thermal',
    codigoQr: 'PBR-TEST-1',
    larguraCm: 70,
    comprimentoCm: 50,
    status: 'disponivel'
};

describe('retalhoMatching', () => {
    it('converte medidas em metros para centimetros', () => {
        expect(parseMeasurementValueToCm('0,62')).toBe(62);
        expect(getMeasurementDimensionsCm(measurement)).toEqual({
            larguraCm: 62,
            comprimentoCm: 37
        });
    });

    it('aceita retalho com mesma pelicula e dimensoes suficientes', () => {
        expect(isRetalhoCompatibleWithMeasurement(measurement, compatibleRetalho)).toBe(true);
    });

    it('aceita retalho legado salvo com decimal pequeno, tratando como metro digitado por engano', () => {
        expect(isRetalhoCompatibleWithMeasurement(measurement, {
            ...compatibleRetalho,
            larguraCm: 0.70,
            comprimentoCm: 0.50,
            areaM2: 0.000035
        })).toBe(true);
    });

    it('rejeita retalho com pelicula diferente ou indisponivel', () => {
        expect(isRetalhoCompatibleWithMeasurement(measurement, {
            ...compatibleRetalho,
            filmId: 'Outra pelicula'
        })).toBe(false);

        expect(isRetalhoCompatibleWithMeasurement(measurement, {
            ...compatibleRetalho,
            status: 'usado'
        })).toBe(false);
    });

    it('aceita retalho quando a peça cabe apenas girada', () => {
        expect(isRetalhoCompatibleWithMeasurement({
            ...measurement,
            largura: '0,50',
            altura: '1,20'
        }, {
            ...compatibleRetalho,
            larguraCm: 120,
            comprimentoCm: 160
        })).toBe(true);
    });

    it('ordena os retalhos pelo melhor encaixe', () => {
        const sorted = getCompatibleRetalhosForMeasurement(measurement, [
            { ...compatibleRetalho, id: 20, larguraCm: 100, comprimentoCm: 100 },
            compatibleRetalho
        ]);

        expect(sorted.map(item => item.id)).toEqual([10, 20]);
    });
});
