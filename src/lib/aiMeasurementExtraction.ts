export type MeasurementExtractionErrorCode =
    | 'EMPTY_RESPONSE'
    | 'OUTPUT_TRUNCATED'
    | 'INVALID_FORMAT'
    | 'NO_MEASUREMENTS'
    | 'INVALID_MEASUREMENTS'
    | 'COUNT_MISMATCH'
    | 'LOW_CONFIDENCE';

export class MeasurementExtractionError extends Error {
    code: MeasurementExtractionErrorCode;

    constructor(code: MeasurementExtractionErrorCode, message?: string) {
        super(message || code);
        this.name = 'MeasurementExtractionError';
        this.code = code;
    }
}

export interface RawAIMeasurement {
    local?: unknown;
    largura?: unknown;
    altura?: unknown;
    quantidade?: unknown;
    peliculaDetectada?: unknown;
    linhaOrigem?: unknown;
}

export interface AIMeasurementExtractionPayload {
    medidas: RawAIMeasurement[];
    totalItens?: unknown;
    houveTrechoIlegivel?: unknown;
    observacao?: unknown;
}

export interface NormalizedAIMeasurement {
    local: string;
    largura: string;
    altura: string;
    quantidade: number;
    peliculaDetectada: string;
}

export interface NormalizedMeasurementExtraction {
    measurements: NormalizedAIMeasurement[];
    totalItems: number;
    skippedRows: number;
    needsReview: boolean;
}

const findBalancedJson = (rawText: string): string | null => {
    const text = rawText
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '');
    const objectIndex = text.indexOf('{');
    const arrayIndex = text.indexOf('[');
    const startIndex = objectIndex < 0
        ? arrayIndex
        : arrayIndex < 0
            ? objectIndex
            : Math.min(objectIndex, arrayIndex);

    if (startIndex < 0) return null;

    const opening = text[startIndex];
    const closing = opening === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < text.length; index += 1) {
        const character = text[index];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (character === '\\') {
                escaped = true;
            } else if (character === '"') {
                inString = false;
            }
            continue;
        }

        if (character === '"') {
            inString = true;
        } else if (character === opening) {
            depth += 1;
        } else if (character === closing) {
            depth -= 1;
            if (depth === 0) return text.slice(startIndex, index + 1);
        }
    }

    return null;
};

export const parseMeasurementExtractionResponse = (
    rawText: string,
    finishReason?: string | null
): AIMeasurementExtractionPayload => {
    if (/MAX_TOKENS|LENGTH/i.test(String(finishReason || ''))) {
        throw new MeasurementExtractionError('OUTPUT_TRUNCATED');
    }

    if (!rawText?.trim()) {
        throw new MeasurementExtractionError('EMPTY_RESPONSE');
    }

    const json = findBalancedJson(rawText);
    if (!json) {
        const looksTruncated = /[{[]/.test(rawText) && !/[}\]]\s*(?:```)?\s*$/.test(rawText);
        throw new MeasurementExtractionError(looksTruncated ? 'OUTPUT_TRUNCATED' : 'INVALID_FORMAT');
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new MeasurementExtractionError('INVALID_FORMAT');
    }

    if (Array.isArray(parsed)) {
        return { medidas: parsed as RawAIMeasurement[] };
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as any).medidas)) {
        throw new MeasurementExtractionError('INVALID_FORMAT');
    }

    return parsed as AIMeasurementExtractionPayload;
};

const parsePositiveDimensionCm = (value: unknown): number | null => {
    if (typeof value !== 'string' && typeof value !== 'number') return null;

    const normalized = String(value)
        .trim()
        .replace(/\s+/g, '')
        .replace(',', '.');
    const match = normalized.match(/^\d+(?:\.\d+)?/);
    if (!match) return null;

    const meters = Number(match[0]);
    if (!Number.isFinite(meters) || meters <= 0) return null;

    const centimeters = Math.round(meters * 100);
    return centimeters > 0 ? centimeters : null;
};

const parsePositiveInteger = (value: unknown): number | null => {
    const quantity = typeof value === 'number' ? value : Number(String(value ?? '').trim());
    return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
};

const normalizeText = (value: unknown): string => (
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
);

const formatMeters = (centimeters: number): string => (
    (centimeters / 100).toFixed(2).replace('.', ',')
);

const groupingText = (value: string): string => (
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
);

export const normalizeAndGroupMeasurementExtraction = (
    payload: AIMeasurementExtractionPayload
): NormalizedMeasurementExtraction => {
    if (!Array.isArray(payload.medidas) || payload.medidas.length === 0) {
        throw new MeasurementExtractionError('NO_MEASUREMENTS');
    }

    const validRows: Array<NormalizedAIMeasurement & {
        widthCm: number;
        heightCm: number;
        sourceLine: number | null;
    }> = [];
    let skippedRows = 0;
    const hasSourceLineField = payload.medidas.some(row => (
        !!row && Object.prototype.hasOwnProperty.call(row, 'linhaOrigem')
    ));

    for (const row of payload.medidas) {
        const widthCm = parsePositiveDimensionCm(row?.largura);
        const heightCm = parsePositiveDimensionCm(row?.altura);
        const quantity = parsePositiveInteger(row?.quantidade);

        if (!widthCm || !heightCm || !quantity) {
            skippedRows += 1;
            continue;
        }

        validRows.push({
            local: normalizeText(row.local),
            largura: formatMeters(widthCm),
            altura: formatMeters(heightCm),
            quantidade: quantity,
            peliculaDetectada: normalizeText(row.peliculaDetectada),
            widthCm,
            heightCm,
            sourceLine: parsePositiveInteger(row.linhaOrigem)
        });
    }

    if (validRows.length === 0) {
        throw new MeasurementExtractionError('INVALID_MEASUREMENTS');
    }

    const totalItems = validRows.reduce((sum, row) => sum + row.quantidade, 0);
    const declaredTotal = parsePositiveInteger(payload.totalItens);
    if (payload.totalItens !== undefined && payload.totalItens !== null && declaredTotal === null) {
        throw new MeasurementExtractionError('COUNT_MISMATCH');
    }
    if (declaredTotal !== null && declaredTotal !== totalItems) {
        throw new MeasurementExtractionError('COUNT_MISMATCH');
    }

    if (hasSourceLineField) {
        const sourceLines = validRows.map(row => row.sourceLine);
        const hasInvalidOrRepeatedSequence = sourceLines.some(line => line === null)
            || new Set(sourceLines).size !== sourceLines.length
            || [...sourceLines]
                .sort((left, right) => Number(left) - Number(right))
                .some((line, index) => Number(line) !== index + 1);
        if (hasInvalidOrRepeatedSequence) {
            throw new MeasurementExtractionError('COUNT_MISMATCH');
        }
    }

    const grouped = new Map<string, NormalizedAIMeasurement>();
    for (const row of validRows) {
        const key = [
            row.widthCm,
            row.heightCm,
            groupingText(row.local),
            groupingText(row.peliculaDetectada)
        ].join('|');
        const current = grouped.get(key);

        if (current) {
            current.quantidade += row.quantidade;
        } else {
            grouped.set(key, {
                local: row.local,
                largura: row.largura,
                altura: row.altura,
                quantidade: row.quantidade,
                peliculaDetectada: row.peliculaDetectada
            });
        }
    }

    return {
        measurements: [...grouped.values()],
        totalItems,
        skippedRows,
        needsReview: skippedRows > 0 || payload.houveTrechoIlegivel === true
    };
};

export const getFriendlyMeasurementExtractionError = (error: unknown): { title: string; message: string } => {
    const internalCode = error instanceof MeasurementExtractionError
        ? error.code
        : typeof (error as any)?.code === 'string'
            ? (error as any).code
            : '';
    const rawMessage = error instanceof Error ? error.message : String(error || '');
    const code = `${internalCode} ${rawMessage}`;

    if (/OUTPUT_TRUNCATED|MAX_TOKENS|LENGTH/i.test(code)) {
        return {
            title: 'Lista muito grande',
            message: 'A leitura ficou incompleta porque há muitas linhas. Divida a tabela em duas fotos e envie uma parte por vez.'
        };
    }
    if (/COUNT_MISMATCH|LOW_CONFIDENCE/i.test(code)) {
        return {
            title: 'Confira a imagem',
            message: 'A conferência encontrou uma diferença nas quantidades. Tente novamente com uma foto mais próxima e mostrando toda a tabela.'
        };
    }
    if (/NO_MEASUREMENTS|EMPTY_RESPONSE/i.test(code)) {
        return {
            title: 'Nenhuma medida encontrada',
            message: 'Não encontrei largura e altura legíveis. Tente recortar apenas a tabela e tirar a foto de frente.'
        };
    }
    if (/INVALID_FORMAT|INVALID_MEASUREMENTS/i.test(code)) {
        return {
            title: 'Não consegui organizar as medidas',
            message: 'Tente novamente com uma imagem mais nítida, de frente e mostrando as colunas de largura e altura.'
        };
    }
    if (/USER_RATE_LIMIT|muitas tentativas|429/i.test(code)) {
        return {
            title: 'Muitas tentativas',
            message: 'Aguarde um minuto e tente novamente.'
        };
    }
    if (/CONTENT_BLOCKED|SAFETY|PROHIBITED/i.test(code)) {
        return {
            title: 'Imagem não processada',
            message: 'Não foi possível analisar esta imagem. Envie somente a parte que contém a tabela de medidas.'
        };
    }
    if (/INPUT_TOO_LARGE|Entrada muito grande|413/i.test(code)) {
        return {
            title: 'Arquivo muito grande',
            message: 'Reduza o tamanho da imagem ou envie a tabela dividida em duas fotos.'
        };
    }
    if (/401|Nao autorizado|não autorizado|sessão|session/i.test(code)) {
        return {
            title: 'Entre novamente',
            message: 'Sua sessão precisa ser renovada. Entre novamente no aplicativo e repita a leitura.'
        };
    }
    if (/NETWORK|fetch|conectar|conexão|offline/i.test(code)) {
        return {
            title: 'Sem conexão com a leitura automática',
            message: 'Confira sua internet e tente novamente em alguns instantes.'
        };
    }

    return {
        title: 'Não foi possível concluir a leitura',
        message: 'Tente novamente. Se continuar, recorte apenas a tabela ou envie as medidas em duas fotos.'
    };
};
