import { useMemo } from 'react';
import { Film, Measurement, Totals, UIMeasurement } from '../../types';
import { CuttingOptimizer } from '../../utils/CuttingOptimizer';

type DiscountType = {
    value: string;
    type: 'percentage' | 'fixed';
};

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

        const result = measurements.reduce((acc, measurement) => {
            if (!measurement.active) {
                return acc;
            }

            const largura = parseFloat(measurement.largura.replace(',', '.')) || 0;
            const altura = parseFloat(measurement.altura.replace(',', '.')) || 0;
            const quantidade = parseInt(String(measurement.quantidade), 10) || 0;
            const m2 = largura * altura * quantidade;
            const film = films.find(item => item.nome === measurement.pelicula);

            let pricePerM2 = 0;
            if (film) {
                if (film.preco > 0) {
                    pricePerM2 = film.preco;
                } else if (film.maoDeObra && film.maoDeObra > 0) {
                    pricePerM2 = film.maoDeObra;
                }
            }

            const basePrice = pricePerM2 * m2;
            const materialPrice = (film?.preco || 0) * m2;
            const laborPrice = (film?.maoDeObra || 0) * m2;

            let itemDiscountAmount = 0;
            const discountObj = measurement.discount || { value: '0', type: 'percentage' };
            const discountValue = parseFloat(String(discountObj.value).replace(',', '.')) || 0;

            if (discountObj.type === 'percentage' && discountValue > 0) {
                itemDiscountAmount = basePrice * (discountValue / 100);
            } else if (discountObj.type === 'fixed' && discountValue > 0) {
                itemDiscountAmount = discountValue;
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
                    unitPriceMaterial: film?.preco || 0,
                    unitPriceLabor: film?.maoDeObra || 0,
                    unitPriceLinearMeter: film?.precoMetroLinear || 0
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

        let generalDiscountAmount = 0;
        const discountInputValue = parseFloat(String(generalDiscount.value).replace(',', '.')) || 0;
        if (discountInputValue > 0) {
            if (generalDiscount.type === 'percentage') {
                generalDiscountAmount = result.priceAfterItemDiscounts * (discountInputValue / 100);
            } else if (generalDiscount.type === 'fixed') {
                generalDiscountAmount = discountInputValue;
            }
        }

        const finalTotal = Math.max(0, result.priceAfterItemDiscounts - generalDiscountAmount);

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

            const optimizer = new CuttingOptimizer({
                rollWidth: 152,
                bladeWidth: 0,
                allowRotation: true
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
            const linearMeters = optimizationResult.totalHeight / 100;
            totalLinearMeters += linearMeters;

            if (groupedTotals[filmName]) {
                groupedTotals[filmName].totalLinearMeters = linearMeters;
                if (film?.precoMetroLinear) {
                    const cost = linearMeters * film.precoMetroLinear;
                    linearMeterCost += cost;
                    groupedTotals[filmName].totalLinearMeterCost = cost;
                }
            }
        });

        return {
            ...result,
            generalDiscountAmount,
            finalTotal,
            totalLinearMeters,
            linearMeterCost,
            groupedTotals
        };
    }, [measurements, films, generalDiscount]);
}
