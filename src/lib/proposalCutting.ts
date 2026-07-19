import type { FilmCuttingPlanSettings, Measurement } from '../../types';

export const DEFAULT_ROLL_WIDTH_CM = 152;
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
    };
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
