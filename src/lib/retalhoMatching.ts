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

// Verifica se um retalho comporta uma peça de largura x comprimento (cm),
// considerando rotação. Checa só a GEOMETRIA (não o status nem a película) —
// o filtro de status/película fica a cargo de quem chama (ex.: painel do estoque).
export const doesRetalhoFitDimensions = (
    retalho: Retalho,
    larguraCm: number,
    comprimentoCm: number
): boolean => {
    if (!retalho.id || larguraCm <= 0 || comprimentoCm <= 0) {
        return false;
    }
    const dims = normalizeLegacyRetalhoDimensions(retalho.larguraCm, retalho.comprimentoCm, retalho.areaM2);
    const fits = (w: number, l: number) => dims.larguraCm + EPSILON_CM >= w && dims.comprimentoCm + EPSILON_CM >= l;
    return fits(larguraCm, comprimentoCm) || fits(comprimentoCm, larguraCm);
};

// Retorna os retalhos disponíveis que cabem na medida informada (cm), do menor
// desperdício para o maior. filmId opcional restringe à película.
export const getRetalhosForDimensions = (
    larguraCm: number,
    comprimentoCm: number,
    retalhos: Retalho[],
    filmId?: string
): Retalho[] => {
    const normalizedFilm = normalizeFilmName(filmId);
    const requiredAreaCm2 = larguraCm * comprimentoCm;

    return retalhos
        .filter(retalho =>
            doesRetalhoFitDimensions(retalho, larguraCm, comprimentoCm)
            && (!normalizedFilm || normalizeFilmName(retalho.filmId) === normalizedFilm))
        .sort((left, right) => {
            const l = normalizeLegacyRetalhoDimensions(left.larguraCm, left.comprimentoCm, left.areaM2);
            const r = normalizeLegacyRetalhoDimensions(right.larguraCm, right.comprimentoCm, right.areaM2);
            const leftWaste = l.larguraCm * l.comprimentoCm - requiredAreaCm2;
            const rightWaste = r.larguraCm * r.comprimentoCm - requiredAreaCm2;
            if (leftWaste !== rightWaste) return leftWaste - rightWaste;
            return (left.id || 0) - (right.id || 0);
        });
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
