import { Measurement, SavedPDF } from '../../types';
import { CuttingOptimizer } from '../../utils/CuttingOptimizer';
import { normalizeFilmCuttingSettings } from './proposalCutting';

export interface StockPlanPiece {
    id: string;
    sourcePdfId: number;
    sourceMeasurementId: number;
    sourceMeasurementIndex: number;
    pieceIndex: number;
    widthCm: number;
    heightCm: number;
}

export interface StockPlanCuttingSource {
    sourcePdfId: number;
    defaultRollWidthCm: number;
    bladeWidthMm: number;
    respectGrain: boolean;
    pieceIds: string[];
}

export interface StockPlanCalculation {
    /** A single value when every cutting source used the same roll width. */
    rollWidthCm: number | null;
    /** All roll widths used by the calculation, in first-seen order. */
    rollWidthsCm: number[];
    totalLinearMeters: number;
    totalPieceCount: number;
    placedPieceCount: number;
    unplacedPieceCount: number;
}

export interface StockFilmPlan {
    filmName: string;
    normalizedFilmName: string;
    sourcePdfIds: number[];
    pieces: StockPlanPiece[];
    alreadyConsumedPieces: number;
    cuttingSources: StockPlanCuttingSource[];
    defaultCalculation: StockPlanCalculation;
}

type MutableStockFilmPlan = Omit<StockFilmPlan, 'defaultCalculation'>;

const roundLinearMeters = (centimeters: number): number => {
    if (!Number.isFinite(centimeters) || centimeters <= 0) return 0;

    const meters = centimeters / 100;
    const rounded = Math.round((meters + Number.EPSILON) * 100) / 100;
    // A valid, very small cut must not be reported as no material usage.
    return rounded > 0 ? rounded : 0.01;
};

const uniqueNumbers = (values: number[]): number[] => {
    const seen = new Set<number>();
    return values.filter((value) => {
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
    });
};

export const normalizeStockFilmName = (value?: string): string => (
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('pt-BR')
);

const getDisplayFilmName = (value?: string): string => (
    String(value || '').trim().replace(/\s+/g, ' ')
);

const parseMeasurementDimensionCm = (value: string | number): number => {
    const parsed = typeof value === 'number'
        ? value
        : Number(String(value).trim().replace(',', '.'));

    return Number.isFinite(parsed) && parsed > 0 ? parsed * 100 : 0;
};

const getMeasurementQuantity = (measurement: Measurement): number => {
    const parsed = Number(measurement.quantidade);
    if (!Number.isFinite(parsed) || parsed < 1) return 0;
    return Math.floor(parsed);
};

const getPdfId = (pdf: SavedPDF): number | null => (
    typeof pdf.id === 'number' && Number.isFinite(pdf.id) ? pdf.id : null
);

const findFilmCuttingSettings = (pdf: SavedPDF, normalizedFilmName: string) => {
    const settingsMap = pdf.generalDiscount?.filmCuttingSettings;
    if (!settingsMap) return normalizeFilmCuttingSettings(undefined);

    const matchingEntry = Object.entries(settingsMap).find(([filmName]) => (
        normalizeStockFilmName(filmName) === normalizedFilmName
    ));

    return normalizeFilmCuttingSettings(matchingEntry?.[1]);
};

const buildPieceId = (
    pdfId: number,
    measurement: Measurement,
    measurementIndex: number,
    pieceIndex: number,
): string => (
    `pdf:${pdfId}:measurement:${measurement.id}:row:${measurementIndex}:piece:${pieceIndex}`
);

const calculateWithSources = (
    plan: Pick<StockFilmPlan, 'pieces' | 'cuttingSources'>,
    rollWidthOverrideCm?: number,
): StockPlanCalculation => {
    const piecesById = new Map(plan.pieces.map((piece) => [piece.id, piece]));
    const usedRollWidthsCm: number[] = [];
    let totalHeightCm = 0;
    let placedPieceCount = 0;
    let unplacedPieceCount = 0;

    plan.cuttingSources.forEach((source) => {
        const rollWidthCm = rollWidthOverrideCm ?? source.defaultRollWidthCm;
        usedRollWidthsCm.push(rollWidthCm);

        const optimizer = new CuttingOptimizer({
            rollWidth: rollWidthCm,
            bladeWidth: source.bladeWidthMm / 10,
            allowRotation: !source.respectGrain,
        });

        source.pieceIds.forEach((pieceId) => {
            const piece = piecesById.get(pieceId);
            if (!piece) return;
            optimizer.addItem(
                piece.widthCm,
                piece.heightCm,
                piece.id,
                `${piece.widthCm}x${piece.heightCm}`,
            );
        });

        const result = optimizer.optimize();
        totalHeightCm += result.totalHeight;
        placedPieceCount += result.placedItems.length;
        unplacedPieceCount += result.unplacedItems?.length || 0;
    });

    const rollWidthsCm = uniqueNumbers(usedRollWidthsCm);

    return {
        rollWidthCm: rollWidthsCm.length === 1 ? rollWidthsCm[0] : null,
        rollWidthsCm,
        totalLinearMeters: roundLinearMeters(totalHeightCm),
        totalPieceCount: plan.pieces.length,
        placedPieceCount,
        unplacedPieceCount,
    };
};

export const calculateStockPlanForRoll = (
    plan: StockFilmPlan,
    rollWidthCm: number,
): StockPlanCalculation => {
    const normalizedRollWidth = Number(rollWidthCm);
    if (!Number.isFinite(normalizedRollWidth) || normalizedRollWidth <= 0) {
        return {
            rollWidthCm: null,
            rollWidthsCm: [],
            totalLinearMeters: 0,
            totalPieceCount: plan.pieces.length,
            placedPieceCount: 0,
            unplacedPieceCount: plan.pieces.length,
        };
    }

    return calculateWithSources(plan, normalizedRollWidth);
};

export const buildServiceStockPlans = (linkedPdfs: SavedPDF[]): StockFilmPlan[] => {
    const plansByFilm = new Map<string, MutableStockFilmPlan>();
    const seenPdfIds = new Set<number>();

    linkedPdfs.forEach((pdf) => {
        const pdfId = getPdfId(pdf);
        if (pdfId === null || seenPdfIds.has(pdfId)) return;
        seenPdfIds.add(pdfId);

        if (pdf.generalDiscount?.pricingMode === 'labor_only') return;

        const sourceByFilm = new Map<string, StockPlanCuttingSource>();

        (pdf.measurements || []).forEach((measurement, measurementIndex) => {
            // PDFs antigos podem não ter gravado o campo `active`; somente um
            // false explícito significa que a medida foi desativada.
            if (measurement.active === false) return;

            const filmName = getDisplayFilmName(measurement.pelicula);
            const normalizedFilmName = normalizeStockFilmName(filmName);
            const widthCm = parseMeasurementDimensionCm(measurement.largura);
            const heightCm = parseMeasurementDimensionCm(measurement.altura);
            const quantity = getMeasurementQuantity(measurement);

            if (!normalizedFilmName || widthCm <= 0 || heightCm <= 0 || quantity <= 0) return;

            let plan = plansByFilm.get(normalizedFilmName);
            if (!plan) {
                plan = {
                    filmName,
                    normalizedFilmName,
                    sourcePdfIds: [],
                    pieces: [],
                    alreadyConsumedPieces: 0,
                    cuttingSources: [],
                };
                plansByFilm.set(normalizedFilmName, plan);
            }

            if (!plan.sourcePdfIds.includes(pdfId)) plan.sourcePdfIds.push(pdfId);

            if (measurement.estoqueUso) {
                plan.alreadyConsumedPieces += quantity;
                return;
            }

            let cuttingSource = sourceByFilm.get(normalizedFilmName);
            if (!cuttingSource) {
                const settings = findFilmCuttingSettings(pdf, normalizedFilmName);
                cuttingSource = {
                    sourcePdfId: pdfId,
                    defaultRollWidthCm: settings.rollWidthCm,
                    bladeWidthMm: settings.bladeWidthMm,
                    respectGrain: settings.respectGrain,
                    pieceIds: [],
                };
                sourceByFilm.set(normalizedFilmName, cuttingSource);
                plan.cuttingSources.push(cuttingSource);
            }

            for (let index = 0; index < quantity; index += 1) {
                const pieceIndex = index + 1;
                const piece: StockPlanPiece = {
                    id: buildPieceId(pdfId, measurement, measurementIndex, pieceIndex),
                    sourcePdfId: pdfId,
                    sourceMeasurementId: measurement.id,
                    sourceMeasurementIndex: measurementIndex,
                    pieceIndex,
                    widthCm,
                    heightCm,
                };
                plan.pieces.push(piece);
                cuttingSource.pieceIds.push(piece.id);
            }
        });
    });

    return Array.from(plansByFilm.values()).map((plan) => ({
        ...plan,
        defaultCalculation: calculateWithSources(plan),
    }));
};
