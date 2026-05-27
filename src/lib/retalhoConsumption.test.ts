import { describe, expect, it } from 'vitest';
import { Measurement, Retalho } from '../../types';
import {
    MIN_RESTOCKABLE_RETALHO_LENGTH_CM,
    getRetalhoConsumptionPlans,
    planRetalhoConsumption
} from './retalhoConsumption';

const measurement: Measurement = {
    id: 1,
    largura: '1,52',
    altura: '0,50',
    quantidade: 1,
    ambiente: 'Sala',
    tipoAplicacao: 'Interna',
    pelicula: 'Carbono black',
    active: true
};

const retalho: Retalho = {
    id: 7,
    filmId: 'Carbono black',
    codigoQr: 'RET-7',
    larguraCm: 152,
    comprimentoCm: 55,
    status: 'disponivel'
};

describe('retalhoConsumption', () => {
    it('nao gera novo retalho quando a sobra no comprimento fica abaixo do minimo', () => {
        const plan = planRetalhoConsumption(measurement, retalho);

        expect(plan).not.toBeNull();
        if (!plan) {
            throw new Error('Plano de consumo nao deveria ser nulo');
        }
        expect(plan.appliedWidthCm).toBe(152);
        expect(plan.appliedLengthCm).toBe(50);
        expect(plan.hasReusableLeftover).toBe(false);
        expect(plan.leftoverLengthCm).toBe(5);
    });

    it('gera novo retalho quando a sobra no comprimento e util', () => {
        const plan = planRetalhoConsumption(measurement, {
            ...retalho,
            comprimentoCm: 65
        });

        expect(plan).not.toBeNull();
        if (!plan) {
            throw new Error('Plano de consumo nao deveria ser nulo');
        }
        expect(plan.hasReusableLeftover).toBe(true);
        expect(plan.leftoverWidthCm).toBe(152);
        expect(plan.leftoverLengthCm).toBe(15);
        expect(plan.leftoverLengthCm).toBeGreaterThanOrEqual(MIN_RESTOCKABLE_RETALHO_LENGTH_CM);
    });

    it('oferece duas orientacoes quando a peca cabe nos dois sentidos', () => {
        const plans = getRetalhoConsumptionPlans({
            ...measurement,
            largura: '0,50',
            altura: '1,20'
        }, {
            ...retalho,
            larguraCm: 120,
            comprimentoCm: 160
        });

        expect(plans.map(plan => plan.orientation)).toEqual(['original', 'rotated']);
    });
});
