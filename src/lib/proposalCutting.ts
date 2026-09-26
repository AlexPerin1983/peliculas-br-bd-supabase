import type { FilmCuttingPlanSettings, Measurement } from '../../types';

export const DEFAULT_ROLL_WIDTH_CM = 152;
// Sobe quando muda a regra do metro linear salvo (2: peças maiores que a bobina viram faixas).
export const CUTTING_PLAN_VERSION = 2;
export const CUTTING_ROLL_WIDTH_PRESETS_CM = [100, 122, 150, 152, 182] as const;

export const createDefaultFilmCuttingSettings = (): FilmCuttingPlanSettings => ({
    rollWidthCm: DEFAULT_ROLL_WIDTH_CM,
    bladeWidthMm: 0,
    respectGrain: false,
});

export const normalizeFilmCuttingSettings = (
    settings?: Partial<FilmCuttingPlanSettings> | null
): FilmCuttingPlanSettings => {
    const rollWidthCm = Number(settings?.rollWidthCm);
    const bladeWidthMm = Number(settings?.bladeWidthMm);

    return {
        rollWidthCm: Number.isFinite(rollWidthCm) && rollWidthCm > 0
            ? rollWidthCm
            : DEFAULT_ROLL_WIDTH_CM,
        bladeWidthMm: Number.isFinite(bladeWidthMm) && bladeWidthMm >= 0
            ? bladeWidthMm
            : 0,
        respectGrain: settings?.respectGrain === true,
        totalLinearMeters: Number.isFinite(settings?.totalLinearMeters)
            ? settings?.totalLinearMeters
            : undefined,
        measurementSignature: settings?.measurementSignature,
        seamStyle: settings?.seamStyle === 'equal' ? 'equal' : 'full',
        seamDirections: normalizeSeamDirections(settings?.seamDirections),
        seamComplementFirst: normalizeSeamComplementFirst(settings?.seamComplementFirst),
        planVersion: Number.isFinite(settings?.planVersion) ? settings?.planVersion : undefined,
    };
};

const normalizeSeamDirections = (
    value?: FilmCuttingPlanSettings['seamDirections'] | null
): FilmCuttingPlanSettings['seamDirections'] => {
    if (!value || typeof value !== 'object') return undefined;
    const entries = Object.entries(value).filter(([, direction]) => direction === 'vertical' || direction === 'horizontal');
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const normalizeSeamComplementFirst = (
    value?: FilmCuttingPlanSettings['seamComplementFirst'] | null
): FilmCuttingPlanSettings['seamComplementFirst'] => {
    if (!value || typeof value !== 'object') return undefined;
    const entries = Object.entries(value).filter(([, first]) => first === true);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

export const buildFilmCuttingMeasurementSignature = (
    measurements: Measurement[],
    filmName: string
): string => JSON.stringify(
    measurements
        .filter(measurement => measurement.active && measurement.pelicula === filmName)
        .map(measurement => ({
            id: measurement.id,
            largura: String(measurement.largura),
            altura: String(measurement.altura),
            quantidade: Math.max(1, Math.floor(Number(measurement.quantidade) || 1)),
        }))
);
