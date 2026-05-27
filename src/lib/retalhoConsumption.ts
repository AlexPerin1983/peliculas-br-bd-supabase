import { Measurement, Retalho } from '../../types';
import { calculateAreaM2FromCentimeters } from './estoqueDimensions';

export const MIN_RESTOCKABLE_RETALHO_LENGTH_CM = 10;
export type RetalhoCutOrientation = 'original' | 'rotated';

export interface RetalhoConsumptionPlan {
    orientation: RetalhoCutOrientation;
    orientationLabel: string;
    appliedWidthCm: number;
    appliedLengthCm: number;
    appliedAreaM2: number;
    leftoverWidthCm: number;
    leftoverLengthCm: number;
    leftoverAreaM2: number;
    hasReusableLeftover: boolean;
}

const parseMeasurementValueToCm = (value?: string | number): number => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value * 100 : 0;
    }

    const normalized = String(value || '').replace(',', '.').trim();
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed * 100 : 0;
};

const getMeasurementDimensionsCm = (measurement: Measurement) => ({
    larguraCm: parseMeasurementValueToCm(measurement.largura),
    comprimentoCm: parseMeasurementValueToCm(measurement.altura)
});

export const planRetalhoConsumption = (
    measurement: Measurement,
    retalho: Retalho,
    orientation: RetalhoCutOrientation = 'original'
): RetalhoConsumptionPlan | null => {
    const measurementDimensions = getMeasurementDimensionsCm(measurement);
    const appliedWidthCm = orientation === 'rotated'
        ? measurementDimensions.comprimentoCm
        : measurementDimensions.larguraCm;
    const appliedLengthCm = orientation === 'rotated'
        ? measurementDimensions.larguraCm
        : measurementDimensions.comprimentoCm;

    if (retalho.larguraCm < appliedWidthCm || retalho.comprimentoCm < appliedLengthCm) {
        return null;
    }

    const leftoverLengthCmRaw = retalho.comprimentoCm - appliedLengthCm;
    const leftoverLengthCm = leftoverLengthCmRaw > 0 ? leftoverLengthCmRaw : 0;
    const hasReusableLeftover = leftoverLengthCm >= MIN_RESTOCKABLE_RETALHO_LENGTH_CM;
    const leftoverWidthCm = hasReusableLeftover ? retalho.larguraCm : 0;

    return {
        orientation,
        orientationLabel: orientation === 'rotated' ? 'Girado 90°' : 'Padrão',
        appliedWidthCm,
        appliedLengthCm,
        appliedAreaM2: calculateAreaM2FromCentimeters(appliedWidthCm, appliedLengthCm),
        leftoverWidthCm,
        leftoverLengthCm,
        leftoverAreaM2: hasReusableLeftover
            ? calculateAreaM2FromCentimeters(leftoverWidthCm, leftoverLengthCm)
            : 0,
        hasReusableLeftover
    };
};

export const getRetalhoConsumptionPlans = (
    measurement: Measurement,
    retalho: Retalho
): RetalhoConsumptionPlan[] => {
    const plans = [
        planRetalhoConsumption(measurement, retalho, 'original'),
        planRetalhoConsumption(measurement, retalho, 'rotated')
    ].filter((plan): plan is RetalhoConsumptionPlan => Boolean(plan));

    return plans.filter((plan, index, currentPlans) => currentPlans.findIndex(otherPlan =>
        otherPlan.appliedWidthCm === plan.appliedWidthCm
        && otherPlan.appliedLengthCm === plan.appliedLengthCm
    ) === index);
};
