const normalizeRawNumericValue = (value?: string | number): { parsed: number; raw: string } => {
    if (typeof value === 'number') {
        return {
            parsed: Number.isFinite(value) ? value : 0,
            raw: String(value)
        };
    }

    const raw = String(value || '').trim();
    const parsed = parseFloat(raw.replace(',', '.'));

    return {
        parsed: Number.isFinite(parsed) ? parsed : 0,
        raw
    };
};

const hasDecimalSeparator = (raw: string) => /[.,]/.test(raw);

export const normalizeLegacyCentimeterValue = (value?: number): number => {
    if (!value || !Number.isFinite(value)) {
        return 0;
    }

    if (value > 0 && value < 10 && !Number.isInteger(value)) {
        return value * 100;
    }

    return value;
};

const isSmallDecimalCentimeter = (value?: number): value is number => (
    Number.isFinite(value)
    && Boolean(value)
    && (value as number) > 0
    && (value as number) < 10
    && !Number.isInteger(value)
);

export const calculateAreaM2FromCentimeters = (
    larguraCm?: number,
    comprimentoCm?: number
): number => {
    const safeLargura = Number.isFinite(larguraCm) ? Number(larguraCm) : 0;
    const safeComprimento = Number.isFinite(comprimentoCm) ? Number(comprimentoCm) : 0;

    if (!safeLargura || !safeComprimento) {
        return 0;
    }

    return (safeLargura * safeComprimento) / 10000;
};

export const normalizeLegacyRetalhoDimensions = (
    larguraCm?: number,
    comprimentoCm?: number,
    areaM2?: number
): { larguraCm: number; comprimentoCm: number } => {
    const safeLargura = Number.isFinite(larguraCm) ? Number(larguraCm) : 0;
    const safeComprimento = Number.isFinite(comprimentoCm) ? Number(comprimentoCm) : 0;
    const safeArea = Number.isFinite(areaM2) ? Number(areaM2) : 0;

    const shouldNormalizeLegacyMeters =
        isSmallDecimalCentimeter(safeLargura)
        && isSmallDecimalCentimeter(safeComprimento)
        && safeArea > 0
        && safeArea < 0.001;

    if (!shouldNormalizeLegacyMeters) {
        return {
            larguraCm: safeLargura,
            comprimentoCm: safeComprimento
        };
    }

    return {
        larguraCm: safeLargura * 100,
        comprimentoCm: safeComprimento * 100
    };
};

export const parseFlexibleCentimeterInput = (value?: string | number): number => {
    const { parsed, raw } = normalizeRawNumericValue(value);

    if (!parsed) {
        return 0;
    }

    if (hasDecimalSeparator(raw) && parsed <= 10) {
        return parsed * 100;
    }

    return parsed;
};

export const parseFlexibleMeterInput = (value?: string | number): number => {
    const { parsed } = normalizeRawNumericValue(value);
    return parsed;
};

const formatNumberBR = (value: number, digits = 2): string => value
    .toFixed(digits)
    .replace('.', ',')
    .replace(/,00$/, '')
    .replace(/(\,\d*[1-9])0$/, '$1');

export const formatMetersFromCentimeters = (valueCm?: number, digits = 2): string => {
    const safeValue = Number.isFinite(valueCm) ? Number(valueCm) : 0;
    return formatNumberBR(safeValue / 100, digits);
};

export const formatCentimeterChip = (valueCm?: number): string => {
    const safeValue = Number.isFinite(valueCm) ? Number(valueCm) : 0;
    return formatNumberBR(safeValue, 0);
};

export const formatMeterValue = (valueMeters?: number, digits = 2): string => {
    if (!valueMeters || !Number.isFinite(valueMeters)) {
        return '0';
    }

    return formatNumberBR(valueMeters, digits);
};
