import { isStraightCuttable } from './straightCuts';
import { planSeam, type SeamDirection, type SeamOption, type SeamStyle } from './seamStrips';

// Faixa de uma peça maior que a bobina (emenda de topo).
export interface SeamInfo {
    pieceId?: number | string;
    index: number;
    count: number;
    direction: SeamDirection;
    // Medida da peça inteira (cm).
    pieceW: number;
    pieceH: number;
    // Onde a faixa começa na peça (cm): da esquerda (vertical) ou do topo (horizontal).
    offset: number;
}

export interface SeamPieceSummary {
    id?: number | string;
    label?: string;
    w: number;
    h: number;
    chosen: SeamOption;
    alternative: SeamOption | null;
    // Caberia inteira girada, mas "respeitar veio" não deixa girar.
    fitsIfRotated: boolean;
    // A faixa do complemento vai primeiro (em cima / à esquerda).
    complementFirst: boolean;
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
    id?: number | string;
    label?: string;
    rotated?: boolean;
    locked?: boolean;
    seam?: SeamInfo;
}

// Faixas de emenda contam como uma peça só (a primeira representa a peça).
export const countPlacedPieces = (items: Rect[]): number =>
    items.filter(item => !item.seam || item.seam.index === 0).length;

export interface OptimizationResult {
    placedItems: Rect[];
    totalHeight: number;
    efficiency: number;
    rollWidth: number;
    // Peças que não couberam na bobina (maiores que a largura em todas as
    // orientações permitidas). Opcional para compatibilidade com históricos salvos.
    unplacedItems?: Rect[];
    // true quando o plano sai só com cortes retos de ponta a ponta (faixas).
    straightCuts?: boolean;
    // Comprimentos (cm) dos melhores planos de cada tipo, para a tela comparar.
    layoutComparison?: { compactHeight: number; straightHeight: number | null };
    // Peças maiores que a bobina que viraram faixas com emenda.
    seamPieces?: SeamPieceSummary[];
    // Preenchido pelo painel: comprimento do plano (cm) se cada grupo de emenda trocasse de direção.
    seamAlternativeTotals?: Record<string, number>;
}

export type CutPreference = 'straight' | 'compact';

export interface OptimizerOptions {
    rollWidth: number;
    bladeWidth?: number; // Spacing between cuts
    allowRotation?: boolean;
    // 'straight' (padrão): prefere plano em faixas se gastar até straightCutTolerance a mais.
    cutPreference?: CutPreference;
    straightCutTolerance?: number;
    // Peças maiores que a bobina: como dividir as faixas e a direção escolhida por peça (id).
    seamStyle?: SeamStyle;
    seamDirections?: Record<string, SeamDirection>;
    // Peças (id) em que a faixa do complemento vai primeiro (em cima / à esquerda).
    seamComplementFirst?: Record<string, boolean>;
}

// Quanto a mais de bobina aceitamos para ter um plano só com cortes retos.
export const DEFAULT_STRAIGHT_CUT_TOLERANCE = 0.03;

interface BandColumn {
    x: number;
    w: number;
    usedHeight: number;
}

interface Row {
    y: number;
    height: number; // Height including blade width
    itemHeight: number; // Original item height (without blade width)
    remainingWidth: number;
    items: Rect[];
}

interface SkylineSegment {
    x: number;
    y: number;
    width: number;
}

const isBetterResult = (candidate: OptimizationResult, current: OptimizationResult | null) => !current ||
    candidate.placedItems.length > current.placedItems.length ||
    (candidate.placedItems.length === current.placedItems.length && (
        candidate.totalHeight < current.totalHeight ||
        (Math.abs(candidate.totalHeight - current.totalHeight) < 5 && candidate.efficiency > current.efficiency)
    ));

export class CuttingOptimizer {
    private rollWidth: number;
    private bladeWidth: number;
    private allowRotation: boolean;
    private cutPreference: CutPreference;
    private straightCutTolerance: number;
    private seamStyle: SeamStyle;
    private seamDirections: Record<string, SeamDirection>;
    private seamComplementFirst: Record<string, boolean>;
    private items: Rect[] = [];
    private freeRects: Rect[] = [];
    private placedItems: Rect[] = [];
    private binHeight: number = 0;

    constructor(options: OptimizerOptions) {
        this.rollWidth = options.rollWidth;
        this.bladeWidth = options.bladeWidth || 0;
        this.allowRotation = options.allowRotation !== undefined ? options.allowRotation : true;
        this.cutPreference = options.cutPreference ?? 'straight';
        this.straightCutTolerance = options.straightCutTolerance ?? DEFAULT_STRAIGHT_CUT_TOLERANCE;
        this.seamStyle = options.seamStyle ?? 'full';
        this.seamDirections = options.seamDirections ?? {};
        this.seamComplementFirst = options.seamComplementFirst ?? {};
    }

    public addItem(w: number, h: number, id?: number | string, label?: string) {
        this.items.push({ x: 0, y: 0, w, h, id, label });
    }

    // Troca peças maiores que a bobina pelas faixas da emenda (cada faixa vira uma peça).
    private expandSeams(): { items: Rect[]; seamPieces: SeamPieceSummary[] } {
        const items: Rect[] = [];
        const seamPieces: SeamPieceSummary[] = [];

        this.items.forEach(item => {
            const complementFirst = item.id !== undefined && this.seamComplementFirst[String(item.id)] === true;
            const plan = planSeam(item.w, item.h, this.rollWidth, {
                allowRotation: this.allowRotation,
                style: this.seamStyle,
                direction: item.id !== undefined ? this.seamDirections[String(item.id)] : undefined,
                complementFirst,
            });
            if (!plan) {
                items.push(item);
                return;
            }

            const { chosen } = plan;
            seamPieces.push({
                id: item.id,
                label: item.label,
                w: item.w,
                h: item.h,
                chosen,
                alternative: plan.alternative,
                fitsIfRotated: !this.allowRotation && item.h <= this.rollWidth,
                complementFirst,
            });

            let offset = 0;
            chosen.strips.forEach((stripWidth, index) => {
                items.push({
                    x: 0,
                    y: 0,
                    // Na bobina: largura = faixa, comprimento = lado que não foi dividido.
                    w: stripWidth,
                    h: chosen.stripLength,
                    id: item.id !== undefined ? `${item.id}-f${index + 1}` : undefined,
                    label: item.label ? `${item.label} · faixa ${index + 1}/${chosen.strips.length}` : undefined,
                    seam: {
                        pieceId: item.id,
                        index,
                        count: chosen.strips.length,
                        direction: chosen.direction,
                        pieceW: item.w,
                        pieceH: item.h,
                        offset,
                    },
                });
                offset += stripWidth;
            });
        });

        return { items, seamPieces };
    }

    public optimize(
        forcedRotations: { [id: string]: boolean } = {},
        useDeepSearch: boolean = false,
        lockedItems: Rect[] = []
    ): OptimizationResult {
        // Identify locked IDs
        const lockedIds = new Set(lockedItems.filter(i => i.id).map(i => i.id));

        const { items: expandedItems, seamPieces } = this.expandSeams();

        // Prepare items to pack (excluding locked ones)
        const itemsToPack = expandedItems
            .filter(item => !item.id || !lockedIds.has(item.id))
            .map(item => {
                if (item.id && forcedRotations[item.id] !== undefined) {
                    const shouldRotate = forcedRotations[item.id];
                    // If forced, we set the dimensions to the desired orientation and mark as locked
                    return {
                        ...item,
                        w: shouldRotate ? item.h : item.w,
                        h: shouldRotate ? item.w : item.h,
                        rotated: shouldRotate,
                        locked: true // Custom property to indicate rotation is locked
                    };
                }
                return { ...item, locked: false };
            });

        const baseStrategies = [
            { name: 'Height', sort: (a: Rect, b: Rect) => b.h - a.h },
            { name: 'Width', sort: (a: Rect, b: Rect) => b.w - a.w },
            { name: 'Area', sort: (a: Rect, b: Rect) => (b.w * b.h) - (a.w * a.h) },
            { name: 'MaxSide', sort: (a: Rect, b: Rect) => Math.max(b.w, b.h) - Math.max(a.w, a.h) }
        ];

        const orientations = [
            { name: 'None', normalize: (item: Rect) => item },
            { name: 'Vertical', normalize: (item: Rect) => item.locked ? item : ({ ...item, w: Math.min(item.w, item.h), h: Math.max(item.w, item.h) }) },
            { name: 'Horizontal', normalize: (item: Rect) => item.locked ? item : ({ ...item, w: Math.max(item.w, item.h), h: Math.min(item.w, item.h) }) }
        ];

        // Guarda o melhor plano geral (mais compacto) e o melhor só com cortes retos.
        let bestResult: OptimizationResult | null = null;
        let bestStraight: OptimizationResult | null = null;
        const consider = (result: OptimizationResult | null) => {
            if (!result) return;
            if (isBetterResult(result, bestResult)) bestResult = result;
            if (isBetterResult(result, bestStraight) && isStraightCuttable(result.placedItems)) bestStraight = result;
        };

        // Only use Row, Band and Skyline if no items are locked (they don't support pre-placed items easily)
        if (lockedItems.length === 0) {
            // Try row-based packing first (best for mixed sizes)
            consider(this.runRowBasedPacking(itemsToPack));

            // Faixas atravessadas com colunas empilhadas: sempre cortável em linhas retas.
            for (const opening of ['best', 'long', 'short', 'asis'] as const) {
                for (const sortBy of ['height', 'area'] as const) {
                    consider(this.runBandPacking(itemsToPack, opening, sortBy));
                }
            }

            // Try Skyline packing
            consider(this.runSkylinePacking(itemsToPack));
        }

        // Try MaxRects packing (Best Area Fit) - Supports locked items
        consider(this.runMaxRectsPacking(itemsToPack, false, lockedItems));

        // Try Guillotine strategies as comparison/fallback - Supports locked items
        for (const orientation of orientations) {
            if (!this.allowRotation && orientation.name !== 'None') continue;

            for (const strategy of baseStrategies) {
                consider(this.runHeuristic(itemsToPack, strategy.sort, orientation.normalize, lockedItems));
            }
        }

        // Deep Search (Randomized / Genetic-lite)
        if (useDeepSearch) {
            const iterations = 50; // Number of random tries

            for (let i = 0; i < iterations; i++) {
                // Shuffle items randomly
                const shuffledItems = [...itemsToPack].sort(() => Math.random() - 0.5);

                // Run MaxRects on shuffled items
                consider(this.runMaxRectsPacking(shuffledItems, true, lockedItems)); // true = skip internal sort
            }
        }

        const compact = bestResult as OptimizationResult | null;
        const straight = bestStraight as OptimizationResult | null;
        const useStraight = !!compact && !!straight && this.cutPreference === 'straight'
            && straight.placedItems.length >= compact.placedItems.length
            && straight.totalHeight <= compact.totalHeight * (1 + this.straightCutTolerance) + 0.01;
        const chosen = useStraight ? straight : compact;

        const finalResult: OptimizationResult = chosen ? {
            ...chosen,
            straightCuts: chosen === straight || isStraightCuttable(chosen.placedItems),
            layoutComparison: {
                compactHeight: compact!.totalHeight,
                straightHeight: straight?.totalHeight ?? null,
            },
        } : {
            placedItems: [...lockedItems],
            totalHeight: 0,
            efficiency: 0,
            rollWidth: this.rollWidth
        };

        // Peças que nenhuma estratégia conseguiu posicionar (não cabem na
        // largura da bobina) eram descartadas em silêncio; agora são reportadas.
        const placedIds = new Set(finalResult.placedItems.map(p => p.id));
        const unplacedItems = itemsToPack.filter(item => item.id !== undefined && !placedIds.has(item.id));

        // As estratégias recriam as peças ao posicionar; devolve a informação da faixa pelo id.
        const seamById = new Map(expandedItems
            .filter(item => item.seam && item.id !== undefined)
            .map(item => [item.id, item.seam!]));
        const placedItems = seamById.size > 0
            ? finalResult.placedItems.map(item => (item.id !== undefined && seamById.has(item.id)
                ? { ...item, seam: seamById.get(item.id) }
                : item))
            : finalResult.placedItems;

        return { ...finalResult, placedItems, unplacedItems, seamPieces };
    }

    private runRowBasedPacking(items: Rect[]): OptimizationResult | null {
        // Clone items and sort by area descending
        // This allows better mixing of different sizes for optimal row packing
        const sortedItems = [...items].sort((a, b) => {
            const areaA = a.w * a.h;
            const areaB = b.w * b.h;

            // Primary sort: by area (descending - largest first)
            const areaDiff = areaB - areaA;
            if (areaDiff !== 0) return areaDiff;

            // Secondary sort: by width (descending - widest first)
            return b.w - a.w;
        });

        const rows: Row[] = [];
        const placed: Rect[] = [];
        const remainingItems = [...sortedItems];

        while (remainingItems.length > 0) {
            // Try to find the BEST item that fits in an existing row
            let foundFit = false;
            let bestFit: { rowIndex: number, itemIndex: number, useRotated: boolean, wastedSpace: number } | null = null;

            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                const row = rows[rowIndex];

                for (let i = 0; i < remainingItems.length; i++) {
                    const item = remainingItems[i];

                    // Try normal orientation
                    // Blade width is only added if this is NOT the first item in the row (spacing BETWEEN items)
                    const spacingNeeded = row.items.length > 0 ? this.bladeWidth : 0;
                    const itemWidth = item.w + spacingNeeded;
                    const heightTolerance = 0.5;
                    let canFitNormal = Math.abs(item.h - row.itemHeight) <= heightTolerance && itemWidth <= row.remainingWidth;

                    // Try rotated orientation
                    const itemWidthRotated = item.h + spacingNeeded;
                    let canFitRotated = this.allowRotation && Math.abs(item.w - row.itemHeight) <= heightTolerance && itemWidthRotated <= row.remainingWidth && !item.locked;

                    if (canFitNormal || canFitRotated) {
                        // Choose the orientation that wastes less space
                        const useRotated = canFitRotated && (!canFitNormal || item.w < item.h);
                        const usedWidth = useRotated ? itemWidthRotated : itemWidth;
                        const wastedSpace = row.remainingWidth - usedWidth;

                        // Track the best fit (least wasted space)
                        if (!bestFit || wastedSpace < bestFit.wastedSpace) {
                            bestFit = { rowIndex, itemIndex: i, useRotated, wastedSpace };
                        }
                    }
                }
            }

            // If we found a best fit, place it
            if (bestFit) {
                const row = rows[bestFit.rowIndex];
                const item = remainingItems[bestFit.itemIndex];
                const spacingNeeded = row.items.length > 0 ? this.bladeWidth : 0;
                const itemWidth = bestFit.useRotated ? item.h : item.w;

                // Calculate X position: start where remaining width begins, PLUS spacing for gap
                const xPos = (this.rollWidth - row.remainingWidth) + spacingNeeded;

                placed.push({
                    x: xPos,
                    y: row.y,
                    w: itemWidth,
                    h: bestFit.useRotated ? item.w : item.h,
                    id: item.id,
                    label: item.label,
                    rotated: (item.rotated ? !bestFit.useRotated : bestFit.useRotated)
                });

                row.items.push(item);
                // Subtract item width AND spacing from remaining width
                row.remainingWidth -= (itemWidth + spacingNeeded);
                remainingItems.splice(bestFit.itemIndex, 1);
                foundFit = true;
            }


            // If no fit found, create a new row with the largest remaining item
            if (!foundFit) {
                const item = remainingItems.shift()!;

                // Decide best orientation for new row
                let useRotation = false;
                let rowItemWidth = item.w;
                let rowItemHeight = item.h;

                // Check if rotation is allowed and beneficial
                if (this.allowRotation && !item.locked) {
                    // Count how many similar items remain (same dimensions)
                    const similarItems = remainingItems.filter(i =>
                        (i.w === item.w && i.h === item.h) || (i.w === item.h && i.h === item.w)
                    ).length + 1; // +1 for current item

                    // Calculate how many would fit in each orientation
                    // Formula: n items fit if: item_width * n + blade_width * (n-1) <= roll_width
                    // Solving for n: n <= (roll_width + blade_width) / (item_width + blade_width)
                    const fitsNormal = Math.floor((this.rollWidth + this.bladeWidth) / (item.w + this.bladeWidth));
                    const fitsRotated = Math.floor((this.rollWidth + this.bladeWidth) / (item.h + this.bladeWidth));

                    // Prefer rotation if:
                    // 1. It uses less height (item.w < item.h), OR
                    // 2. It allows more items per row and we have enough similar items
                    if (item.w < item.h || (fitsRotated > fitsNormal && similarItems >= fitsRotated)) {
                        useRotation = true;
                        rowItemWidth = item.h;
                        rowItemHeight = item.w;
                    }
                }

                // Check if item fits in roll width (handle oversized items)
                if (rowItemWidth > this.rollWidth) {
                    // Try opposite orientation
                    if (this.allowRotation && rowItemHeight <= this.rollWidth && !item.locked) {
                        useRotation = !useRotation;
                        const temp = rowItemWidth;
                        rowItemWidth = rowItemHeight;
                        rowItemHeight = temp;
                    } else {
                        continue; // Skip item that doesn't fit
                    }
                }

                const newY = rows.length > 0 ? rows[rows.length - 1].y + rows[rows.length - 1].height : 0;
                // First item in a row doesn't need horizontal spacing, only vertical spacing between rows
                const rowHeightWithSpacing = rowItemHeight + this.bladeWidth;

                placed.push({
                    x: 0,
                    y: newY,
                    w: rowItemWidth,
                    h: rowItemHeight,
                    id: item.id,
                    label: item.label,
                    rotated: (item.rotated ? !useRotation : useRotation)
                });

                rows.push({
                    y: newY,
                    height: rowHeightWithSpacing,
                    itemHeight: rowItemHeight,
                    remainingWidth: this.rollWidth - rowItemWidth, // No spacing for first item
                    items: [item]
                });
            }
        }

        // Calculate total height
        let totalHeight = 0;
        for (const item of placed) {
            totalHeight = Math.max(totalHeight, item.y + item.h);
        }

        // Calculate efficiency
        const usedArea = placed.reduce((sum, item) => sum + (item.w * item.h), 0);
        const totalArea = this.rollWidth * totalHeight;
        const efficiency = totalArea > 0 ? (usedArea / totalArea) * 100 : 0;

        return {
            placedItems: placed,
            totalHeight,
            efficiency,
            rollWidth: this.rollWidth
        };
    }

    /**
     * Plano em faixas: cada faixa atravessa a bobina (corte reto de lado a lado);
     * dentro dela as peças ficam em colunas, e cada coluna pode empilhar peças menores.
     * Todo corte é reto, do jeito que a bobina é desenrolada e cortada na mesa.
     * Com opening = 'best', cada faixa testa as peças iniciais possíveis e fica
     * com a mais bem aproveitada.
     */
    private runBandPacking(items: Rect[], opening: 'best' | 'long' | 'short' | 'asis', sortBy: 'height' | 'area'): OptimizationResult | null {
        type Option = { w: number; h: number; turned: boolean };
        type Placement = { item: Rect; option: Option; x: number; y: number };
        const gap = this.bladeWidth;
        const orientationsOf = (item: Rect): Option[] => {
            const options = [{ w: item.w, h: item.h, turned: false }];
            if (this.allowRotation && !item.locked && item.w !== item.h) options.push({ w: item.h, h: item.w, turned: true });
            return options.filter(option => option.w <= this.rollWidth);
        };
        const openingOf = (item: Rect) => {
            const options = orientationsOf(item);
            if (!options.length) return null;
            if (opening === 'asis' || opening === 'best') return options[0];
            return options.reduce((best, option) => (opening === 'long' ? option.h > best.h : option.h < best.h) ? option : best);
        };
        const sameSize = (a: Rect, b: Rect) => (a.w === b.w && a.h === b.h) || (a.w === b.h && a.h === b.w);
        const areaOf = (placements: Placement[]) => placements.reduce((sum, p) => sum + p.option.w * p.option.h, 0);

        // Monta uma faixa a partir da peça inicial, sem alterar a lista recebida.
        const buildBand = (pool: Rect[], opener: Rect, openerOption: Option, bandY: number): Placement[] => {
            const left = pool.filter(item => item !== opener);
            const bandHeight = openerOption.h;
            const columns: BandColumn[] = [{ x: 0, w: openerOption.w, usedHeight: openerOption.h }];
            const placements: Placement[] = [{ item: opener, option: openerOption, x: 0, y: bandY }];
            let usedWidth = openerOption.w;

            // Preenche a faixa escolhendo sempre o encaixe que desperdiça menos área.
            while (true) {
                let best: { item: Rect; option: Option; column: BandColumn | null; waste: number } | null = null;

                for (const item of left) {
                    for (const option of orientationsOf(item)) {
                        if (option.h > bandHeight) continue;
                        const area = option.w * option.h;

                        for (const column of columns) {
                            if (option.w > column.w || column.usedHeight + gap + option.h > bandHeight) continue;
                            const waste = ((column.w - option.w) * (option.h + gap)) / area;
                            if (!best || waste < best.waste) best = { item, option, column, waste };
                        }

                        const x = usedWidth + gap;
                        if (x + option.w <= this.rollWidth) {
                            // Nova coluna: considera quantas peças iguais caberiam empilhadas nela.
                            const twins = left.filter(other => sameSize(other, item)).length;
                            const perColumn = Math.max(1, Math.floor((bandHeight + gap) / (option.h + gap)));
                            const filled = Math.min(twins, perColumn) * area;
                            const waste = ((option.w + gap) * bandHeight - filled) / filled;
                            if (!best || waste < best.waste) best = { item, option, column: null, waste };
                        }
                    }
                }

                if (!best) break;
                if (best.column) {
                    placements.push({ item: best.item, option: best.option, x: best.column.x, y: bandY + best.column.usedHeight + gap });
                    best.column.usedHeight += gap + best.option.h;
                } else {
                    const x = usedWidth + gap;
                    placements.push({ item: best.item, option: best.option, x, y: bandY });
                    columns.push({ x, w: best.option.w, usedHeight: best.option.h });
                    usedWidth = x + best.option.w;
                }
                left.splice(left.indexOf(best.item), 1);
            }
            return placements;
        };

        let remaining = items.filter(item => openingOf(item));
        const placed: Rect[] = [];
        let bandY = 0;

        while (remaining.length > 0) {
            let band: Placement[] = [];
            if (opening === 'best') {
                // Testa uma peça de cada medida, em cada orientação, como início da faixa.
                let bestScore = -1;
                const tried = new Set<string>();
                for (const opener of remaining) {
                    for (const option of orientationsOf(opener)) {
                        const key = `${option.w}x${option.h}`;
                        if (tried.has(key)) continue;
                        tried.add(key);
                        const candidate = buildBand(remaining, opener, option, bandY);
                        const area = areaOf(candidate);
                        // 'height': melhor aproveitamento da faixa; 'area': favorece faixas que levam mais peça.
                        const score = sortBy === 'height'
                            ? area / ((option.h + gap) * this.rollWidth)
                            : area * area / ((option.h + gap) * this.rollWidth);
                        if (score > bestScore + 1e-9) { band = candidate; bestScore = score; }
                    }
                }
            } else {
                remaining.sort((a, b) => {
                    const oa = openingOf(a)!, ob = openingOf(b)!;
                    return sortBy === 'height'
                        ? (ob.h - oa.h) || (ob.w * ob.h - oa.w * oa.h)
                        : (ob.w * ob.h - oa.w * oa.h) || (ob.h - oa.h);
                });
                band = buildBand(remaining, remaining[0], openingOf(remaining[0])!, bandY);
            }

            band.forEach(({ item, option, x, y }) => placed.push({
                x, y, w: option.w, h: option.h, id: item.id, label: item.label,
                rotated: item.rotated ? !option.turned : option.turned,
            }));
            const used = new Set(band.map(p => p.item));
            remaining = remaining.filter(item => !used.has(item));
            bandY += band[0].option.h + gap;
        }

        if (!placed.length) return null;
        const totalHeight = Math.max(...placed.map(item => item.y + item.h));
        const usedArea = placed.reduce((sum, item) => sum + item.w * item.h, 0);
        return {
            placedItems: placed,
            totalHeight,
            efficiency: totalHeight > 0 ? (usedArea / (this.rollWidth * totalHeight)) * 100 : 0,
            rollWidth: this.rollWidth,
        };
    }

    private runSkylinePacking(items: Rect[]): OptimizationResult | null {
        // Sort by height descending, then width descending
        const sortedItems = [...items].sort((a, b) => {
            const heightDiff = b.h - a.h;
            return heightDiff !== 0 ? heightDiff : b.w - a.w;
        });

        let skyline: SkylineSegment[] = [{ x: 0, y: 0, width: this.rollWidth }];
        const placed: Rect[] = [];

        for (const item of sortedItems) {
            const bestPos = this.findBestSkylinePosition(skyline, item);

            if (bestPos) {
                placed.push({
                    x: bestPos.x,
                    y: bestPos.y,
                    w: bestPos.width,
                    h: bestPos.height,
                    id: item.id,
                    label: item.label,
                    rotated: (item.rotated ? !bestPos.rotated : bestPos.rotated)
                });

                this.updateSkyline(skyline, bestPos.x, bestPos.y, bestPos.width, bestPos.height);
            } else {
                // Item didn't fit - fallback logic
                if (item.w > this.rollWidth && (!this.allowRotation || item.h > this.rollWidth)) {
                    continue; // Skip oversized
                }

                let maxY = 0;
                for (const s of skyline) maxY = Math.max(maxY, s.y);

                const width = (this.allowRotation && item.h <= this.rollWidth && (item.h < item.w || item.w > this.rollWidth) && !item.locked) ? item.h : item.w;
                const height = (width === item.h) ? item.w : item.h;

                placed.push({
                    x: 0,
                    y: maxY,
                    w: width,
                    h: height,
                    id: item.id,
                    label: item.label,
                    rotated: (item.rotated ? !(width === item.h) : (width === item.h))
                });
                this.updateSkyline(skyline, 0, maxY, width, height);
            }
        }

        // Calculate total height
        let totalHeight = 0;
        for (const item of placed) {
            totalHeight = Math.max(totalHeight, item.y + item.h);
        }

        // Calculate efficiency
        const usedArea = placed.reduce((sum, item) => sum + (item.w * item.h), 0);
        const totalArea = this.rollWidth * totalHeight;
        const efficiency = totalArea > 0 ? (usedArea / totalArea) * 100 : 0;

        return {
            placedItems: placed,
            totalHeight,
            efficiency,
            rollWidth: this.rollWidth
        };
    }

    private runMaxRectsPacking(items: Rect[], skipSort: boolean = false, prePlacedItems: Rect[] = []): OptimizationResult | null {
        // Sort by Area descending (usually best for MaxRects) unless skipSort is true
        const sortedItems = skipSort ? [...items] : [...items].sort((a, b) => (b.w * b.h) - (a.w * a.h));

        this.freeRects = [{ x: 0, y: 0, w: this.rollWidth, h: Number.MAX_SAFE_INTEGER }];
        this.placedItems = [];
        this.binHeight = 0;

        // Process pre-placed items
        for (const item of prePlacedItems) {
            this.placedItems.push(item);
            const reservedRect = {
                x: item.x,
                y: item.y,
                w: item.w + this.bladeWidth,
                h: item.h + this.bladeWidth
            };
            this.splitFreeRects(reservedRect);
        }

        for (const item of sortedItems) {
            this.placeItemMaxRects(item);
        }

        // Calculate total height used
        let currentBinHeight = 0;
        for (const item of this.placedItems) {
            currentBinHeight = Math.max(currentBinHeight, item.y + item.h);
        }

        // Calculate efficiency
        const usedArea = this.placedItems.reduce((sum, item) => sum + (item.w * item.h), 0);
        const totalArea = this.rollWidth * currentBinHeight;
        const efficiency = totalArea > 0 ? (usedArea / totalArea) * 100 : 0;

        return {
            placedItems: [...this.placedItems],
            totalHeight: currentBinHeight,
            efficiency,
            rollWidth: this.rollWidth
        };
    }

    private placeItemMaxRects(item: Rect) {
        const wWithSpacing = item.w + this.bladeWidth;
        const hWithSpacing = item.h + this.bladeWidth;

        let bestNode: Rect | null = null;
        let bestScore = Number.MAX_VALUE;
        let bestOrientation = 'normal';

        // Try normal
        const normalFit = this.findBestAreaFit(wWithSpacing, hWithSpacing);
        if (normalFit.rect) {
            bestScore = normalFit.score;
            bestNode = normalFit.rect;
            bestOrientation = 'normal';
        }

        // Try rotated
        if (this.allowRotation && !item.locked) {
            const wRotated = item.h + this.bladeWidth;
            const hRotated = item.w + this.bladeWidth;
            const rotatedFit = this.findBestAreaFit(wRotated, hRotated);

            if (rotatedFit.rect && rotatedFit.score < bestScore) {
                bestNode = rotatedFit.rect;
                bestOrientation = 'rotated';
            }
        }

        if (bestNode) {
            const w = bestOrientation === 'normal' ? item.w : item.h;
            const h = bestOrientation === 'normal' ? item.h : item.w;

            const placedRect: Rect = {
                x: bestNode.x,
                y: bestNode.y,
                w,
                h,
                id: item.id,
                label: item.label,
                rotated: (item.rotated ? bestOrientation !== 'rotated' : bestOrientation === 'rotated')
            };

            this.placedItems.push(placedRect);

            const reservedRect = {
                x: bestNode.x,
                y: bestNode.y,
                w: bestOrientation === 'normal' ? wWithSpacing : item.h + this.bladeWidth,
                h: bestOrientation === 'normal' ? hWithSpacing : item.w + this.bladeWidth
            };

            this.splitFreeRects(reservedRect);
        } else {
            // Fallback: Extend height if no fit found (shouldn't happen with infinite height, but good practice)
            // For infinite height bin, we always find a spot (eventually at the top).
            // But if we fail to find a "best fit" in existing rects, we might need to look at the "infinite" rect at the top.
            // Our freeRects init includes a MAX_SAFE_INTEGER height rect, so it should always fit.
        }
    }

    private findBestAreaFit(w: number, h: number): { rect: Rect | null, score: number } {
        let bestAreaFit = Number.MAX_VALUE;
        let bestRect: Rect | null = null;

        for (const freeRect of this.freeRects) {
            // Check if it fits
            if (freeRect.w >= w && freeRect.h >= h) {
                // Best Area Fit Rule: Choose the free rect that leaves the minimum remaining area
                // actually, standard BAF is: minimize (freeRect.area - item.area)
                // But since item area is constant, we just minimize freeRect.area.
                // However, for infinite bin, the top rect has infinite area.
                // So we need to handle the infinite rect separately or use "Best Short Side Fit" (BSSF) which is often better.

                // Let's use Best Short Side Fit (BSSF) as it's very effective
                const leftoverHoriz = Math.abs(freeRect.w - w);
                const leftoverVert = Math.abs(freeRect.h - h);
                const shortSideFit = Math.min(leftoverHoriz, leftoverVert);

                if (shortSideFit < bestAreaFit || (shortSideFit === bestAreaFit && freeRect.y < (bestRect?.y || Number.MAX_VALUE))) {
                    bestAreaFit = shortSideFit;
                    bestRect = { x: freeRect.x, y: freeRect.y, w, h };
                }
            }
        }
        return { rect: bestRect, score: bestAreaFit };
    }

    private findBestSkylinePosition(skyline: SkylineSegment[], item: Rect): { x: number, y: number, width: number, height: number, rotated: boolean } | null {
        let bestY = Number.MAX_VALUE;
        let bestX = 0;
        let bestRotated = false;
        let found = false;

        // Try normal orientation
        if (item.w <= this.rollWidth) {
            const pos = this.findPositionForOrientation(skyline, item.w, item.h);
            if (pos && pos.y < bestY) {
                bestY = pos.y;
                bestX = pos.x;
                bestRotated = false;
                found = true;
            }
        }

        // Try rotated orientation
        if (this.allowRotation && item.h <= this.rollWidth && !item.locked) {
            const pos = this.findPositionForOrientation(skyline, item.h, item.w);
            if (pos && (pos.y < bestY || (pos.y === bestY && !found))) {
                bestY = pos.y;
                bestX = pos.x;
                bestRotated = true;
                found = true;
            }
        }

        if (found) {
            return {
                x: bestX,
                y: bestY,
                width: bestRotated ? item.h : item.w,
                height: bestRotated ? item.w : item.h,
                rotated: bestRotated
            };
        }
        return null;
    }

    private findPositionForOrientation(skyline: SkylineSegment[], width: number, height: number): { x: number, y: number } | null {
        const requiredWidth = width + this.bladeWidth;
        let bestX = -1;
        let bestY = Number.MAX_VALUE;

        // Iterate through all possible segments as starting points
        for (let i = 0; i < skyline.length; i++) {
            let currentWidth = 0;
            let maxY = -1;

            // Check if we can fit the item starting at segment i
            for (let j = i; j < skyline.length; j++) {
                currentWidth += skyline[j].width;
                maxY = Math.max(maxY, skyline[j].y);

                if (currentWidth >= requiredWidth) {
                    // Found a valid spot
                    if (maxY < bestY) {
                        bestY = maxY;
                        bestX = skyline[i].x;
                    }
                    break;
                }
            }
        }

        if (bestX !== -1) {
            return { x: bestX, y: bestY };
        }
        return null;
    }

    private updateSkyline(skyline: SkylineSegment[], x: number, y: number, width: number, height: number) {
        const newTop = y + height + this.bladeWidth;
        const itemRight = x + width + this.bladeWidth;

        const newSegments: SkylineSegment[] = [];

        let i = 0;
        while (i < skyline.length && skyline[i].x + skyline[i].width <= x) {
            newSegments.push(skyline[i]);
            i++;
        }

        if (i < skyline.length && skyline[i].x < x) {
            newSegments.push({
                x: skyline[i].x,
                y: skyline[i].y,
                width: x - skyline[i].x
            });
        }

        newSegments.push({
            x: x,
            y: newTop,
            width: width + this.bladeWidth
        });

        while (i < skyline.length && skyline[i].x + skyline[i].width <= itemRight) {
            i++;
        }

        if (i < skyline.length && skyline[i].x < itemRight) {
            newSegments.push({
                x: itemRight,
                y: skyline[i].y,
                width: (skyline[i].x + skyline[i].width) - itemRight
            });
            i++;
        }

        while (i < skyline.length) {
            newSegments.push(skyline[i]);
            i++;
        }

        this.mergeSkylineSegments(newSegments);
        skyline.length = 0;
        skyline.push(...newSegments);
    }

    private mergeSkylineSegments(skyline: SkylineSegment[]) {
        for (let i = 0; i < skyline.length - 1; i++) {
            if (skyline[i].y === skyline[i + 1].y) {
                skyline[i].width += skyline[i + 1].width;
                skyline.splice(i + 1, 1);
                i--;
            }
        }
    }

    private runHeuristic(
        items: Rect[],
        sortFn: (a: Rect, b: Rect) => number,
        normalizeFn: (item: Rect) => Rect = (i) => i,
        prePlacedItems: Rect[] = []
    ): OptimizationResult {
        // Clone and normalize items
        const currentItems = items.map(item => normalizeFn({ ...item }));
        currentItems.sort(sortFn);

        this.freeRects = [{ x: 0, y: 0, w: this.rollWidth, h: Number.MAX_SAFE_INTEGER }];
        this.placedItems = [];
        this.binHeight = 0;

        // Process pre-placed items
        for (const item of prePlacedItems) {
            this.placedItems.push(item);
            const reservedRect = {
                x: item.x,
                y: item.y,
                w: item.w + this.bladeWidth,
                h: item.h + this.bladeWidth
            };
            this.splitFreeRects(reservedRect);
        }

        // Place items
        for (const item of currentItems) {
            this.placeItem(item);
        }

        // Calculate total height used
        let currentBinHeight = 0;
        for (const item of this.placedItems) {
            currentBinHeight = Math.max(currentBinHeight, item.y + item.h);
        }

        // Calculate efficiency
        const usedArea = this.placedItems.reduce((sum, item) => sum + (item.w * item.h), 0);
        const totalArea = this.rollWidth * currentBinHeight;
        const efficiency = totalArea > 0 ? (usedArea / totalArea) * 100 : 0;

        return {
            placedItems: [...this.placedItems], // Return a copy of placed items
            totalHeight: currentBinHeight,
            efficiency,
            rollWidth: this.rollWidth
        };
    }

    private placeItem(item: Rect) {
        const wWithSpacing = item.w + this.bladeWidth;
        const hWithSpacing = item.h + this.bladeWidth;

        // Try to place item in normal orientation
        let bestNode = this.findPositionForNewNode(wWithSpacing, hWithSpacing);
        let bestOrientation = 'normal';

        // Try to place item rotated
        let rotatedNode: Rect | null = null;
        if (this.allowRotation && !item.locked) {
            const wRotatedWithSpacing = item.h + this.bladeWidth;
            const hRotatedWithSpacing = item.w + this.bladeWidth;
            rotatedNode = this.findPositionForNewNode(wRotatedWithSpacing, hRotatedWithSpacing);
        }

        // Simple heuristic: choose the one that fits highest up (min y), then left (min x)
        if (rotatedNode && (!bestNode || rotatedNode.y < bestNode.y || (rotatedNode.y === bestNode.y && rotatedNode.x < bestNode.x))) {
            bestNode = rotatedNode;
            bestOrientation = 'rotated';
        }

        if (bestNode) {
            const w = bestOrientation === 'normal' ? item.w : item.h;
            const h = bestOrientation === 'normal' ? item.h : item.w;

            const placedRect: Rect = {
                x: bestNode.x,
                y: bestNode.y,
                w,
                h,
                id: item.id,
                label: item.label,
                rotated: (item.rotated ? bestOrientation !== 'rotated' : bestOrientation === 'rotated')
            };

            this.placedItems.push(placedRect);

            const reservedRect = {
                x: bestNode.x,
                y: bestNode.y,
                w: bestOrientation === 'normal' ? wWithSpacing : item.h + this.bladeWidth,
                h: bestOrientation === 'normal' ? hWithSpacing : item.w + this.bladeWidth
            };

            this.splitFreeRects(reservedRect);
        }
    }

    private findPositionForNewNode(w: number, h: number): Rect | null {
        let bestNode: Rect | null = null;
        let bestY = Number.MAX_SAFE_INTEGER;
        let bestX = Number.MAX_SAFE_INTEGER;

        for (const freeRect of this.freeRects) {
            if (freeRect.w >= w && freeRect.h >= h) {
                if (freeRect.y < bestY || (freeRect.y === bestY && freeRect.x < bestX)) {
                    bestY = freeRect.y;
                    bestX = freeRect.x;
                    bestNode = { x: freeRect.x, y: freeRect.y, w, h };
                }
            }
        }
        return bestNode;
    }

    private splitFreeRects(placedRect: Rect) {
        for (let i = this.freeRects.length - 1; i >= 0; i--) {
            const freeRect = this.freeRects[i];
            if (this.intersects(placedRect, freeRect)) {
                this.freeRects.splice(i, 1);
                if (placedRect.y > freeRect.y && placedRect.y < freeRect.y + freeRect.h) {
                    this.freeRects.push({ x: freeRect.x, y: freeRect.y, w: freeRect.w, h: placedRect.y - freeRect.y });
                }
                if (placedRect.y + placedRect.h < freeRect.y + freeRect.h) {
                    this.freeRects.push({ x: freeRect.x, y: placedRect.y + placedRect.h, w: freeRect.w, h: (freeRect.y + freeRect.h) - (placedRect.y + placedRect.h) });
                }
                if (placedRect.x > freeRect.x && placedRect.x < freeRect.x + freeRect.w) {
                    this.freeRects.push({ x: freeRect.x, y: freeRect.y, w: placedRect.x - freeRect.x, h: freeRect.h });
                }
                if (placedRect.x + placedRect.w < freeRect.x + freeRect.w) {
                    this.freeRects.push({ x: placedRect.x + placedRect.w, y: freeRect.y, w: (freeRect.x + freeRect.w) - (placedRect.x + placedRect.w), h: freeRect.h });
                }
            }
        }
        this.pruneFreeRects();
    }

    private intersects(a: Rect, b: Rect): boolean {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    private pruneFreeRects() {
        for (let i = 0; i < this.freeRects.length; i++) {
            for (let j = i + 1; j < this.freeRects.length; j++) {
                if (this.isContained(this.freeRects[i], this.freeRects[j])) {
                    this.freeRects.splice(i, 1);
                    i--;
                    break;
                }
                if (this.isContained(this.freeRects[j], this.freeRects[i])) {
                    this.freeRects.splice(j, 1);
                    j--;
                }
            }
        }
    }

    private isContained(a: Rect, b: Rect): boolean {
        return a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
    }
}
