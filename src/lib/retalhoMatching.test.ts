import { describe, expect, it } from 'vitest';
import { Measurement, Retalho } from '../../types';
import {
    doesRetalhoFitDimensions,
    getCompatibleRetalhosForMeasurement,
    getMeasurementDimensionsCm,
    getRetalhosForDimensions,
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

    describe('busca por medida (estoque)', () => {
        it('cabe na medida considerando rotação, sem exigir película', () => {
            expect(doesRetalhoFitDimensions(compatibleRetalho, 50, 70)).toBe(true); // girado
            expect(doesRetalhoFitDimensions(compatibleRetalho, 80, 50)).toBe(false); // largo demais
        });

        it('confere só geometria — status fica a cargo de quem chama (painel do estoque)', () => {
            expect(doesRetalhoFitDimensions({ ...compatibleRetalho, status: 'usado' }, 50, 50)).toBe(true);
        });

        it('lista os que cabem do menor desperdício e respeita filtro de película', () => {
            const retalhos: Retalho[] = [
                { ...compatibleRetalho, id: 20, larguraCm: 100, comprimentoCm: 100 },
                { ...compatibleRetalho, id: 10, larguraCm: 70, comprimentoCm: 50 },
                { ...compatibleRetalho, id: 30, filmId: 'Outra', larguraCm: 70, comprimentoCm: 50 }
            ];

            expect(getRetalhosForDimensions(60, 40, retalhos).map(r => r.id)).toEqual([10, 30, 20]);
            expect(getRetalhosForDimensions(60, 40, retalhos, 'Window Blue thermal').map(r => r.id)).toEqual([10, 20]);
        });
    });
});
