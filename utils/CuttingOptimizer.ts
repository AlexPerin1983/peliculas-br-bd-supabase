export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
    id?: number | string;
    label?: string;
    rotated?: boolean;
    locked?: boolean;
}

export interface OptimizationResult {
    placedItems: Rect[];
    totalHeight: number;
    efficiency: number;
    rollWidth: number;
}

export interface OptimizerOptions {
    rollWidth: number;
    bladeWidth?: number; // Spacing between cuts
    allowRotation?: boolean;
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

export class CuttingOptimizer {
    private rollWidth: number;
    private bladeWidth: number;
    private allowRotation: boolean;
    private items: Rect[] = [];
    private freeRects: Rect[] = [];
    private placedItems: Rect[] = [];
    private binHeight: number = 0;

    constructor(options: OptimizerOptions) {
        this.rollWidth = options.rollWidth;
        this.bladeWidth = options.bladeWidth || 0;
        this.allowRotation = options.allowRotation !== undefined ? options.allowRotation : true;
    }

    public addItem(w: number, h: number, id?: number | string, label?: string) {
        this.items.push({ x: 0, y: 0, w, h, id, label });
    }

    public optimize(
        forcedRotations: { [id: string]: boolean } = {},
        useDeepSearch: boolean = false,
        lockedItems: Rect[] = []
    ): OptimizationResult {
        // Identify locked IDs
        const lockedIds = new Set(lockedItems.filter(i => i.id).map(i => i.id));

        // Prepare items to pack (excluding locked ones)
        const itemsToPack = this.items
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

        let bestResult: OptimizationResult | null = null;
        let bestMethod = '';

        // Only use Row and Skyline if no items are locked (they don't support pre-placed items easily)
        if (lockedItems.length === 0) {
            // Try row-based packing first (best for mixed sizes)
            const rowResult = this.runRowBasedPacking(itemsToPack);
            if (rowResult) {
                bestResult = rowResult;
                bestMethod = 'Row-based';
            }

            // Try Skyline packing
            const skylineResult = this.runSkylinePacking(itemsToPack);
            if (skylineResult) {
                const isBetter = !bestResult ||
                    skylineResult.totalHeight < bestResult.totalHeight ||
                    (Math.abs(skylineResult.totalHeight - bestResult.totalHeight) < 5 && skylineResult.efficiency > bestResult.efficiency);

                if (isBetter) {
                    bestResult = skylineResult;
                    bestMethod = 'Skyline';
                }
            }
        }

        // Try MaxRects packing (Best Area Fit) - Supports locked items
        const maxRectsResult = this.runMaxRectsPacking(itemsToPack, false, lockedItems);
        if (maxRectsResult) {
            const isBetter = !bestResult ||
                maxRectsResult.totalHeight < bestResult.totalHeight ||
                (Math.abs(maxRectsResult.totalHeight - bestResult.totalHeight) < 5 && maxRectsResult.efficiency > bestResult.efficiency);

            if (isBetter) {
                bestResult = maxRectsResult;
                bestMethod = 'MaxRects-BAF';
            }
        }

        // Try Guillotine strategies as comparison/fallback - Supports locked items
        for (const orientation of orientations) {
            if (!this.allowRotation && orientation.name !== 'None') continue;

            for (const strategy of baseStrategies) {
                const result = this.runHeuristic(itemsToPack, strategy.sort, orientation.normalize, lockedItems);

                // Choose best based on: 1) Height (most important), 2) Efficiency
                const isBetter = !bestResult ||
                    result.totalHeight < bestResult.totalHeight ||
                    (Math.abs(result.totalHeight - bestResult.totalHeight) < 5 && result.efficiency > bestResult.efficiency);

                if (isBetter) {
                    bestResult = result;
                    bestMethod = `Guillotine-${strategy.name}-${orientation.name}`;
                }
            }
        }

        // Deep Search (Randomized / Genetic-lite)
        if (useDeepSearch) {
            const iterations = 50; // Number of random tries

            for (let i = 0; i < iterations; i++) {
                // Shuffle items randomly
                const shuffledItems = [...itemsToPack].sort(() => Math.random() - 0.5);

                // Run MaxRects on shuffled items
                const randomResult = this.runMaxRectsPacking(shuffledItems, true, lockedItems); // true = skip internal sort

                if (randomResult) {
                    const isBetter = !bestResult ||
                        randomResult.totalHeight < bestResult.totalHeight ||
                        (Math.abs(randomResult.totalHeight - bestResult.totalHeight) < 5 && randomResult.efficiency > bestResult.efficiency);

                    if (isBetter) {
                        bestResult = randomResult;
                        bestMethod = `DeepSearch-Iter${i}`;
                    }
                }
            }
        }

        // console.log('Selected method:', bestMethod, '| Height:', bestResult?.totalHeight, 'cm | Efficiency:', bestResult?.efficiency.toFixed(2) + '%');
        return bestResult!;
    }

    private runRowBasedPacking(items: Rect[]): OptimizationResult | null {
        // Clone items and sort intelligently for row packing
        const sortedItems = [...items].sort((a, b) => {
            // When rotation is allowed, group by minimum dimension (height after rotation)
            const aMinDim = Math.min(a.w, a.h);
            const bMinDim = Math.min(b.w, b.h);
            const aMaxDim = Math.max(a.w, a.h);
            const bMaxDim = Math.max(b.w, b.h);

            // Primary sort: by minimum dimension (ascending - smallest height first)
            const minDiff = aMinDim - bMinDim;
            if (minDiff !== 0) return minDiff;

            // Secondary sort: by maximum dimension (descending - largest width first)
            return bMaxDim - aMaxDim;
        });

        const rows: Row[] = [];
        const placed: Rect[] = [];
        const remainingItems = [...sortedItems];

        while (remainingItems.length > 0) {
            // Try to find an item that fits in an existing row
            let foundFit = false;

            for (const row of rows) {
                for (let i = 0; i < remainingItems.length; i++) {
                    const item = remainingItems[i];

                    // Try normal orientation
                    const itemWidth = item.w + this.bladeWidth;
                    const heightTolerance = 0.5;
                    let canFitNormal = Math.abs(item.h - row.itemHeight) <= heightTolerance && itemWidth <= row.remainingWidth;

                    // Try rotated orientation
                    const itemWidthRotated = item.h + this.bladeWidth;
                    let canFitRotated = this.allowRotation && Math.abs(item.w - row.itemHeight) <= heightTolerance && itemWidthRotated <= row.remainingWidth && !item.locked;

                    if (canFitNormal || canFitRotated) {
                        // Prefer normal orientation if both fit, but choose rotated if it uses less height
                        const useRotated = canFitRotated && (!canFitNormal || item.w < item.h);
                        const xPos = this.rollWidth - row.remainingWidth;

                        placed.push({
                            x: xPos,
                            y: row.y,
                            w: useRotated ? item.h : item.w,
                            h: useRotated ? item.w : item.h,
                            id: item.id,
                            label: item.label,
                            rotated: (item.rotated ? !useRotated : useRotated)
                        });

                        row.items.push(item);
                        row.remainingWidth -= useRotated ? itemWidthRotated : itemWidth;
                        remainingItems.splice(i, 1);
                        foundFit = true;
                        break;
                    }
                }
                if (foundFit) break;
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
                    const normalWidth = item.w + this.bladeWidth;
                    const rotatedWidth = item.h + this.bladeWidth;

                    const fitsNormal = Math.floor(this.rollWidth / normalWidth);
                    const fitsRotated = Math.floor(this.rollWidth / rotatedWidth);

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
                const rowWidthWithSpacing = rowItemWidth + this.bladeWidth;
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
                    remainingWidth: this.rollWidth - rowWidthWithSpacing,
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
