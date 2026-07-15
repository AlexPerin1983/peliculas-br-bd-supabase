export type MeasurementInputMode = 'meters' | 'centimeters';

export const MEASUREMENT_INPUT_MODE_STORAGE_KEY = 'peliculas-br-measurement-input-mode-v1';
export const MEASUREMENT_INPUT_MODE_EVENT = 'measurement-input-mode-change';
export const OPEN_MEASUREMENT_INPUT_SETTINGS_EVENT = 'open-measurement-input-settings';

export const readMeasurementInputMode = (): MeasurementInputMode => {
    if (typeof window === 'undefined') return 'meters';

    try {
        const stored = window.localStorage.getItem(MEASUREMENT_INPUT_MODE_STORAGE_KEY);
        return stored === 'centimeters' ? 'centimeters' : 'meters';
    } catch {
        return 'meters';
    }
};

export const saveMeasurementInputMode = (mode: MeasurementInputMode) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(MEASUREMENT_INPUT_MODE_STORAGE_KEY, mode);
    } catch {
        // A preferencia continua ativa nesta sessao mesmo sem armazenamento local.
    }

    window.dispatchEvent(new CustomEvent<MeasurementInputMode>(MEASUREMENT_INPUT_MODE_EVENT, {
        detail: mode
    }));
};

export const formatCentimeterDigitsAsMeters = (rawDigits: string): string => {
    const digits = rawDigits.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    if (!digits) return '';

    const centimeters = Number(digits);
    if (!Number.isFinite(centimeters)) return '';

    return (centimeters / 100).toFixed(2);
};

export const metersValueToCentimeterDigits = (value: string | number): string => {
    const parsed = Number.parseFloat(String(value || '0').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return '';

    return String(Math.round(parsed * 100));
};

const sanitizeMetersInput = (rawValue: string) => {
    const cleanedValue = rawValue
        .replace(/\./g, ',')
        .replace(/[^\d,]/g, '');
    const [integerPart, ...decimalParts] = cleanedValue.split(',');

    if (decimalParts.length === 0) return integerPart;
    return `${integerPart},${decimalParts.join('')}`;
};

export const normalizeMeasurementInput = (
    rawValue: string,
    mode: MeasurementInputMode
): string => {
    const sanitized = sanitizeMetersInput(rawValue);

    // No modo centimetros, uma virgula explicita continua sendo aceita como
    // metros. Isso evita erro para quem alterna entre as duas formas de medir.
    if (mode === 'meters' || sanitized.includes(',')) {
        let finalValue = sanitized;
        if (finalValue.startsWith(',')) finalValue = `0${finalValue}`;
        if (finalValue.endsWith(',')) finalValue = finalValue.slice(0, -1);
        return finalValue;
    }

    const meters = formatCentimeterDigitsAsMeters(sanitized);
    return meters ? meters.replace('.', ',') : '';
};
