import { useMemo } from 'react';
import { Film, FilmPricingMode, Measurement, ProposalDiscount, Totals, UIMeasurement } from '../../types';
import { CuttingOptimizer } from '../../utils/CuttingOptimizer';
import { summarizeProposalExpenses } from '../lib/proposalExpenses';
import { calculatePricingAreaM2 } from '../lib/pricingArea';
import { calculateProposalAdjustmentAmounts } from '../lib/proposalAdjustments';
import { getCatalogFilmPrices, resolveFilmPrices } from '../lib/filmPriceOverrides';
import {
    buildFilmCuttingMeasurementSignature,
    normalizeFilmCuttingSettings,
} from '../lib/proposalCutting';

type DiscountType = ProposalDiscount;

interface UseProposalTotalsParams {
    measurements: UIMeasurement[];
    films: Film[];
    generalDiscount: DiscountType;
}

export function useProposalTotals({
    measurements,
    films,
    generalDiscount
}: UseProposalTotalsParams) {
    return useMemo<Totals>(() => {
        const groupedTotals: { [key: string]: any } = {};
        const pricingMode = generalDiscount.pricingMode === 'labor_only' ? 'labor_only' : 'complete';
        const filmPricingModes = generalDiscount.filmPricingModes || {};
        const filmPriceOverrides = generalDiscount.filmPriceOverrides;
        // No modo "mão de obra" toda a cobrança é por m² (a venda por metro linear é ignorada).
        const getFilmPricingMode = (filmName: string): FilmPricingMode => (
            pricingMode !== 'labor_only' && filmPricingModes[filmName] === 'linear' ? 'linear' : 'area'
        );

        const result = measurements.reduce((acc, measurement) => {
            if (!measurement.active) {
                return acc;
            }

            const largura = parseFloat(measurement.largura.replace(',', '.')) || 0;
            const altura = parseFloat(measurement.altura.replace(',', '.')) || 0;
            const quantidade = parseInt(String(measurement.quantidade), 10) || 0;
            const m2 = calculatePricingAreaM2(largura, altura, quantidade);
            const film = films.find(item => item.nome === measurement.pelicula);
            const prices = resolveFilmPrices(film, filmPriceOverrides, measurement.pelicula);
            const catalogPrices = getCatalogFilmPrices(film);
            const filmPricingMode = getFilmPricingMode(measurement.pelicula);

            let pricePerM2 = 0;
            if (film) {
                if (pricingMode === 'labor_only') {
                    pricePerM2 = prices.maoDeObra;
                } else if (prices.preco > 0) {
                    pricePerM2 = prices.preco;
                } else if (prices.maoDeObra > 0) {
                    pricePerM2 = prices.maoDeObra;
                }
            }

            // No modo metro linear a venda é calculada por película (depois do loop), não por m².
            const basePrice = filmPricingMode === 'linear' ? 0 : pricePerM2 * m2;
            const materialPrice = pricingMode === 'labor_only' ? 0 : prices.preco * m2;
            const laborPrice = prices.maoDeObra * m2;

            let itemDiscountAmount = 0;
            if (filmPricingMode !== 'linear') {
                const discountObj = measurement.discount || { value: '0', type: 'percentage' };
                const discountValue = parseFloat(String(discountObj.value).replace(',', '.')) || 0;

                if (discountObj.type === 'percentage' && discountValue > 0) {
                    itemDiscountAmount = basePrice * (discountValue / 100);
                } else if (discountObj.type === 'fixed' && discountValue > 0) {
                    itemDiscountAmount = discountValue;
                }
            }

            const finalItemPrice = Math.max(0, basePrice - itemDiscountAmount);

            acc.totalM2 += m2;
            acc.subtotal += basePrice;
            acc.totalItemDiscount += itemDiscountAmount;
            acc.priceAfterItemDiscounts += finalItemPrice;
            acc.totalQuantity += quantidade;
            acc.totalMaterial += materialPrice;
            acc.totalLabor += laborPrice;

            if (!groupedTotals[measurement.pelicula]) {
                groupedTotals[measurement.pelicula] = {
                    filmName: measurement.pelicula,
                    totalM2: 0,
                    totalLinearMeters: 0,
                    totalMaterial: 0,
                    totalLabor: 0,
                    totalLinearMeterCost: 0,
                    unitPriceMaterial: pricingMode === 'labor_only' ? 0 : prices.preco,
                    unitPriceLabor: prices.maoDeObra,
                    unitPriceLinearMeter: pricingMode === 'labor_only' ? 0 : prices.precoMetroLinear,
                    filmPricingMode,
                    unitSalePriceLinearMeter: filmPricingMode === 'linear' ? prices.precoVendaMetroLinear : 0,
                    linearSaleSubtotal: 0,
                    catalogUnitPriceMaterial: catalogPrices.preco,
                    catalogUnitPriceLabor: catalogPrices.maoDeObra,
                    catalogUnitPriceLinearMeter: catalogPrices.precoMetroLinear,
                    catalogUnitSalePriceLinearMeter: catalogPrices.precoVendaMetroLinear,
                };
            }

            groupedTotals[measurement.pelicula].totalM2 += m2;
            groupedTotals[measurement.pelicula].totalMaterial += materialPrice;
            groupedTotals[measurement.pelicula].totalLabor += laborPrice;

            return acc;
        }, {
            totalM2: 0,
            subtotal: 0,
            totalItemDiscount: 0,
            priceAfterItemDiscounts: 0,
            totalQuantity: 0,
            totalMaterial: 0,
            totalLabor: 0
        });

        const groupedByFilm: { [key: string]: Measurement[] } = {};
        measurements.filter(measurement => measurement.active).forEach(measurement => {
            if (!groupedByFilm[measurement.pelicula]) {
                groupedByFilm[measurement.pelicula] = [];
            }
            groupedByFilm[measurement.pelicula].push(measurement);
        });

        let totalLinearMeters = 0;
        let linearMeterCost = 0;

        Object.entries(groupedByFilm).forEach(([filmName, filmMeasurements]) => {
            const film = films.find(item => item.nome === filmName);
            const prices = resolveFilmPrices(film, filmPriceOverrides, filmName);
            const cuttingSettings = normalizeFilmCuttingSettings(
                generalDiscount.filmCuttingSettings?.[filmName]
            );
            const measurementSignature = buildFilmCuttingMeasurementSignature(
                measurements,
                filmName
            );


            const optimizer = new CuttingOptimizer({
                rollWidth: cuttingSettings.rollWidthCm,
                bladeWidth: cuttingSettings.bladeWidthMm / 10,
                allowRotation: !cuttingSettings.respectGrain
            });

            filmMeasurements.forEach(measurement => {
                const qty = Math.max(1, Math.floor(measurement.quantidade || 1));
                const w = parseFloat(String(measurement.largura).replace(',', '.')) * 100;
                const h = parseFloat(String(measurement.altura).replace(',', '.')) * 100;

                if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
                    for (let index = 0; index < qty; index += 1) {
                        optimizer.addItem(w, h);
                    }
                }
            });

            const optimizationResult = optimizer.optimize();
            const hasCurrentPlanResult = cuttingSettings.measurementSignature === measurementSignature
                && Number.isFinite(cuttingSettings.totalLinearMeters)
                && (cuttingSettings.totalLinearMeters || 0) >= 0;
            const linearMeters = hasCurrentPlanResult
                ? cuttingSettings.totalLinearMeters!
                : optimizationResult.totalHeight / 100;
            totalLinearMeters += linearMeters;

            if (groupedTotals[filmName]) {
                groupedTotals[filmName].totalLinearMeters = linearMeters;
                if (pricingMode !== 'labor_only' && prices.precoMetroLinear > 0) {
                    const cost = linearMeters * prices.precoMetroLinear;
                    linearMeterCost += cost;
                    groupedTotals[filmName].totalLinearMeterCost = cost;
                }
                // Venda por metro linear: substitui o preço por m² desta película.
                if (groupedTotals[filmName].filmPricingMode === 'linear') {
                    const linearSale = linearMeters * prices.precoVendaMetroLinear;
                    groupedTotals[filmName].linearSaleSubtotal = linearSale;
                    result.subtotal += linearSale;
                    result.priceAfterItemDiscounts += linearSale;
                }
            }
        });

        const {
            generalDiscountAmount,
            generalIncreaseAmount,
            generalFinalDiscountAmount
        } = calculateProposalAdjustmentAmounts(generalDiscount, result.priceAfterItemDiscounts);

        const finalTotal = Math.max(
            0,
            result.priceAfterItemDiscounts + generalIncreaseAmount - generalFinalDiscountAmount
        );

        const expenseSummary = summarizeProposalExpenses(generalDiscount.expenses);
        const estimatedMaterialCost = pricingMode === 'labor_only' ? 0 : linearMeterCost;
        const estimatedTotalCost = estimatedMaterialCost + expenseSummary.total;
        const estimatedProfit = finalTotal - estimatedTotalCost;
        const estimatedMarginPercentage = finalTotal > 0 ? (estimatedProfit / finalTotal) * 100 : 0;

        return {
            ...result,
            generalDiscountAmount,
            generalIncreaseAmount,
            generalFinalDiscountAmount,
            finalTotal,
            totalLinearMeters,
            linearMeterCost,
            operationalExpenses: expenseSummary.total,
            expensesByCategory: expenseSummary.byCategory,
            estimatedMaterialCost,
            estimatedTotalCost,
            estimatedProfit,
            estimatedMarginPercentage,
            pricingMode,
            groupedTotals
        };
    }, [measurements, films, generalDiscount]);
}
