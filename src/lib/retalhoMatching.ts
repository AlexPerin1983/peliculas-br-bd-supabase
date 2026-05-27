import { Measurement, Retalho } from '../../types';
import { normalizeLegacyRetalhoDimensions } from './estoqueDimensions';
import { getRetalhoConsumptionPlans } from './retalhoConsumption';

const EPSILON_CM = 0.01;

export interface MeasurementDimensionsCm {
    larguraCm: number;
    comprimentoCm: number;
}

const normalizeFilmName = (value?: string) => (value || '').trim().toLowerCase();

export const parseMeasurementValueToCm = (value?: string | number): number => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value * 100 : 0;
    }

    const normalized = String(value || '').replace(',', '.').trim();
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed * 100 : 0;
};

export const getMeasurementDimensionsCm = (measurement: Measurement): MeasurementDimensionsCm => ({
    larguraCm: parseMeasurementValueToCm(measurement.largura),
    comprimentoCm: parseMeasurementValueToCm(measurement.altura)
});

export const canMeasurementUseRetalho = (measurement: Measurement): boolean => {
    const { larguraCm, comprimentoCm } = getMeasurementDimensionsCm(measurement);
    return normalizeFilmName(measurement.pelicula).length > 0 && larguraCm > 0 && comprimentoCm > 0;
};

export const isRetalhoCompatibleWithMeasurement = (
    measurement: Measurement,
    retalho: Retalho
): boolean => {
    if (!retalho.id || retalho.status !== 'disponivel' || !canMeasurementUseRetalho(measurement)) {
        return false;
    }

    if (normalizeFilmName(measurement.pelicula) !== normalizeFilmName(retalho.filmId)) {
        return false;
    }

    const normalizedRetalhoDimensions = normalizeLegacyRetalhoDimensions(
        retalho.larguraCm,
        retalho.comprimentoCm,
        retalho.areaM2
    );
    const normalizedRetalho = {
        ...retalho,
        larguraCm: normalizedRetalhoDimensions.larguraCm,
        comprimentoCm: normalizedRetalhoDimensions.comprimentoCm
    };

    return getRetalhoConsumptionPlans(measurement, normalizedRetalho).some(plan =>
        plan.appliedWidthCm > 0
        && plan.appliedLengthCm > 0
        && normalizedRetalho.larguraCm + EPSILON_CM >= plan.appliedWidthCm
        && normalizedRetalho.comprimentoCm + EPSILON_CM >= plan.appliedLengthCm
    );
};

export const getCompatibleRetalhosForMeasurement = (
    measurement: Measurement,
    retalhos: Retalho[]
): Retalho[] => {
    const { larguraCm, comprimentoCm } = getMeasurementDimensionsCm(measurement);
    const requiredAreaCm2 = larguraCm * comprimentoCm;

    return retalhos
        .filter(retalho => isRetalhoCompatibleWithMeasurement(measurement, retalho))
        .sort((left, right) => {
            const leftDimensions = normalizeLegacyRetalhoDimensions(left.larguraCm, left.comprimentoCm, left.areaM2);
            const rightDimensions = normalizeLegacyRetalhoDimensions(right.larguraCm, right.comprimentoCm, right.areaM2);
            const leftAreaCm2 = leftDimensions.larguraCm * leftDimensions.comprimentoCm;
            const rightAreaCm2 = rightDimensions.larguraCm * rightDimensions.comprimentoCm;
            const leftWaste = leftAreaCm2 - requiredAreaCm2;
            const rightWaste = rightAreaCm2 - requiredAreaCm2;

            if (leftWaste !== rightWaste) {
                return leftWaste - rightWaste;
            }

            return (left.id || 0) - (right.id || 0);
        });
};
