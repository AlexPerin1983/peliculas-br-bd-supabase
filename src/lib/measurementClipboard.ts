import { UIMeasurement } from '../../types';

const MEASUREMENT_CLIPBOARD_KEY = 'peliculasbr.measurementClipboard.v1';
const MEASUREMENT_CLIPBOARD_VERSION = 1;

type MeasurementClipboardItem = Omit<UIMeasurement, 'id' | 'isNew' | 'estoqueUso'>;

interface MeasurementClipboardPayload {
    version: typeof MEASUREMENT_CLIPBOARD_VERSION;
    copiedAt: string;
    measurements: MeasurementClipboardItem[];
}

const hasStorage = () => {
    try {
        return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    } catch {
        return false;
    }
};

const normalizeClipboardItem = (measurement: Partial<UIMeasurement>): MeasurementClipboardItem => {
    const {
        id: _id,
        isNew: _isNew,
        estoqueUso: _estoqueUso,
        discount,
        aiFilmSuggestion,
        ...copyableMeasurement
    } = measurement;

    return {
        largura: String(copyableMeasurement.largura ?? ''),
        altura: String(copyableMeasurement.altura ?? ''),
        quantidade: Number(copyableMeasurement.quantidade) || 1,
        ambiente: String(copyableMeasurement.ambiente ?? ''),
        tipoAplicacao: String(copyableMeasurement.tipoAplicacao ?? ''),
        pelicula: String(copyableMeasurement.pelicula ?? ''),
        active: copyableMeasurement.active !== false,
        ...(discount ? { discount: { ...discount } } : {}),
        ...(aiFilmSuggestion ? { aiFilmSuggestion: { ...aiFilmSuggestion } } : {}),
        ...(copyableMeasurement.observation ? { observation: copyableMeasurement.observation } : {}),
        ...(copyableMeasurement.locked !== undefined ? { locked: copyableMeasurement.locked } : {}),
        ...(copyableMeasurement.locationId !== undefined ? { locationId: copyableMeasurement.locationId } : {}),
        ...(copyableMeasurement.locationName ? { locationName: copyableMeasurement.locationName } : {})
    };
};

const parseMeasurementClipboard = (rawPayload: string | null): MeasurementClipboardPayload | null => {
    if (!rawPayload) {
        return null;
    }

    try {
        const parsedPayload = JSON.parse(rawPayload) as Partial<MeasurementClipboardPayload>;

        if (parsedPayload.version !== MEASUREMENT_CLIPBOARD_VERSION || !Array.isArray(parsedPayload.measurements)) {
            return null;
        }

        const measurements = parsedPayload.measurements.map(item => normalizeClipboardItem(item));

        if (measurements.length === 0) {
            return null;
        }

        return {
            version: MEASUREMENT_CLIPBOARD_VERSION,
            copiedAt: typeof parsedPayload.copiedAt === 'string' ? parsedPayload.copiedAt : new Date().toISOString(),
            measurements
        };
    } catch (error) {
        console.warn('Nao foi possivel ler a area de transferencia de medidas:', error);
        return null;
    }
};

const createUniqueMeasurementId = (usedIds: Set<number>, offset: number) => {
    let id = Date.now() + offset;

    while (usedIds.has(id)) {
        id += 1000;
    }

    usedIds.add(id);
    return id;
};

export const copyMeasurementsToMeasurementClipboard = (measurements: UIMeasurement[]) => {
    const payload: MeasurementClipboardPayload = {
        version: MEASUREMENT_CLIPBOARD_VERSION,
        copiedAt: new Date().toISOString(),
        measurements: measurements.map(measurement => normalizeClipboardItem(measurement))
    };

    if (hasStorage()) {
        window.localStorage.setItem(MEASUREMENT_CLIPBOARD_KEY, JSON.stringify(payload));
    }

    return payload;
};

export const getMeasurementClipboard = () => {
    if (!hasStorage()) {
        return null;
    }

    try {
        return parseMeasurementClipboard(window.localStorage.getItem(MEASUREMENT_CLIPBOARD_KEY));
    } catch (error) {
        console.warn('Nao foi possivel acessar a area de transferencia de medidas:', error);
        return null;
    }
};

export const getMeasurementClipboardCount = () => getMeasurementClipboard()?.measurements.length ?? 0;

export const createPastedMeasurementsFromClipboard = (currentMeasurements: UIMeasurement[]) => {
    const clipboard = getMeasurementClipboard();

    if (!clipboard) {
        return [];
    }

    const usedIds = new Set(currentMeasurements.map(measurement => measurement.id));

    return clipboard.measurements.map((measurement, index): UIMeasurement => ({
        ...measurement,
        id: createUniqueMeasurementId(usedIds, index),
        isNew: false
    }));
};
