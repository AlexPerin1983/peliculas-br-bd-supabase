import type { Film, FilmPriceOverrides, FilmPricingModes, Measurement, ProposalAdjustmentOperation, ProposalPricingMode, Totals } from '../../types';
import { calculatePricingAreaM2 } from './pricingArea';
import { resolveFilmPrices } from './filmPriceOverrides';
import {
    calculateMeasurementPriceAdjustment,
    getMeasurementAdjustmentOperation,
} from './measurementPriceAdjustment';

type PdfGeneralAdjustment = {
    operation?: ProposalAdjustmentOperation;
    filmPricingModes?: FilmPricingModes;
    filmPriceOverrides?: FilmPriceOverrides;
};

type PdfDisplayTotals = Pick<Totals, 'subtotal' | 'totalItemDiscount' | 'generalDiscountAmount' | 'finalTotal' | 'generalIncreaseAmount' | 'generalFinalDiscountAmount' | 'groupedTotals'>;

export interface PdfDisplayLineItem {
    measurement: Measurement;
    m2: number;
    basePrice: number;
    itemDiscountAmount: number;
    itemIncreaseAmount: number;
    finalItemPrice: number;
    displayBasePrice: number;
    displayItemDiscountAmount: number;
    displayFinalItemPrice: number;
    embeddedIncreaseAmount: number;
}

export interface PdfAdjustmentDisplay {
    lineItems: PdfDisplayLineItem[];
    embedsGeneralIncrease: boolean;
    summarySubtotal: number;
    summaryItemDiscount: number;
    summaryFinalTotal: number;
}

const parseDecimal = (value: string | number | undefined | null) => (
    parseFloat(String(value ?? '').replace(',', '.')) || 0
);

const toCents = (value: number) => Math.round((Math.max(0, value) + Number.EPSILON) * 100);

const distributeAmount = (amount: number, weights: number[]) => {
    const amountCents = toCents(amount);
    if (amountCents <= 0 || weights.length === 0) {
        return weights.map(() => 0);
    }

    const normalizedWeights = weights.map(weight => Math.max(0, weight));
    const totalWeight = normalizedWeights.reduce((sum, weight) => sum + weight, 0);
    const effectiveWeights = totalWeight > 0 ? normalizedWeights : weights.map(() => 1);
    const effectiveTotal = effectiveWeights.reduce((sum, weight) => sum + weight, 0);

    const rawShares = effectiveWeights.map(weight => (amountCents * weight) / effectiveTotal);
    const floorShares = rawShares.map(Math.floor);
    let remainingCents = amountCents - floorShares.reduce((sum, cents) => sum + cents, 0);

    rawShares
        .map((share, index) => ({ index, fraction: share - Math.floor(share) }))
        .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
        .forEach(({ index }) => {
            if (remainingCents <= 0) return;
            floorShares[index] += 1;
            remainingCents -= 1;
        });

    return floorShares.map(cents => cents / 100);
};

const getPricePerM2 = (
    film: Film | undefined,
    filmName: string,
    pricingMode: ProposalPricingMode,
    overrides?: FilmPriceOverrides,
) => {
    if (!film) return 0;
    const prices = resolveFilmPrices(film, overrides, filmName);
    if (pricingMode === 'labor_only') return prices.maoDeObra;
    if (prices.preco > 0) return prices.preco;
    return prices.maoDeObra > 0 ? prices.maoDeObra : 0;
};

const getPercentageDiscountRate = (measurement: Measurement) => {
    if (getMeasurementAdjustmentOperation(measurement.discount) !== 'discount') return 0;
    if (measurement.discount?.type !== 'percentage') return 0;
    return parseDecimal(measurement.discount.value);
};

export const buildPdfAdjustmentDisplay = ({
    measurements,
    films,
    pricingMode,
    generalAdjustment,
    totals
}: {
    measurements: Measurement[];
    films: Film[];
    pricingMode: ProposalPricingMode;
    generalAdjustment?: PdfGeneralAdjustment;
    totals: PdfDisplayTotals;
}): PdfAdjustmentDisplay => {
    const filmPricingModes = generalAdjustment?.filmPricingModes || {};
    const filmPriceOverrides = generalAdjustment?.filmPriceOverrides;
    const groupedTotals = totals.groupedTotals || {};
    const isLinearFilm = (filmName: string) => (
        pricingMode !== 'labor_only' && filmPricingModes[filmName] === 'linear'
    );

    const rawLineItems = measurements.map(measurement => {
        const largura = parseDecimal(measurement.largura);
        const altura = parseDecimal(measurement.altura);
        const quantidade = parseInt(String(measurement.quantidade), 10) || 0;
        const m2 = calculatePricingAreaM2(largura, altura, quantidade);
        const film = films.find(item => item.nome === measurement.pelicula);
        const linear = isLinearFilm(measurement.pelicula);
        // No modo metro linear o preço por linha é distribuído da venda da película (abaixo).
        const basePrice = linear ? 0 : getPricePerM2(film, measurement.pelicula, pricingMode, filmPriceOverrides) * m2;
        const itemAdjustment = calculateMeasurementPriceAdjustment(
            basePrice,
            linear ? undefined : measurement.discount
        );
        const itemDiscountAmount = itemAdjustment.operation === 'discount' ? itemAdjustment.amount : 0;
        const itemIncreaseAmount = itemAdjustment.operation === 'increase' ? itemAdjustment.amount : 0;
        const finalItemPrice = itemAdjustment.finalPrice;

        return {
            measurement,
            m2,
            basePrice,
            itemDiscountAmount,
            itemIncreaseAmount,
            finalItemPrice,
            linear
        };
    });

    // Distribui a venda por metro linear de cada película entre suas linhas (peso por m²).
    const linearFilmGroups: { [film: string]: number[] } = {};
    rawLineItems.forEach((item, index) => {
        if (item.linear) {
            (linearFilmGroups[item.measurement.pelicula] ||= []).push(index);
        }
    });
    Object.entries(linearFilmGroups).forEach(([filmName, indices]) => {
        const linearSale = groupedTotals[filmName]?.linearSaleSubtotal || 0;
        const shares = distributeAmount(linearSale, indices.map(index => rawLineItems[index].m2));
        indices.forEach((index, position) => {
            rawLineItems[index].basePrice = shares[position];
            rawLineItems[index].itemDiscountAmount = 0;
            rawLineItems[index].itemIncreaseAmount = 0;
            rawLineItems[index].finalItemPrice = shares[position];
        });
    });

    const increaseAmount = totals.generalIncreaseAmount ?? (
        generalAdjustment?.operation === 'increase' ? totals.generalDiscountAmount : 0
    );
    const finalDiscountAmount = totals.generalFinalDiscountAmount ?? (
        generalAdjustment?.operation === 'discount' ? totals.generalDiscountAmount : 0
    );
    const embedsGeneralIncrease = increaseAmount > 0;
    const increaseShares = embedsGeneralIncrease
        ? distributeAmount(
            increaseAmount,
            rawLineItems.map(item => item.m2 > 0 ? item.m2 : item.finalItemPrice)
        )
        : rawLineItems.map(() => 0);

    const lineItems = rawLineItems.map((item, index) => {
        const embeddedIncreaseAmount = increaseShares[index] || 0;
        const displayFinalItemPrice = item.finalItemPrice + embeddedIncreaseAmount;
        let displayBasePrice = item.basePrice + item.itemIncreaseAmount + embeddedIncreaseAmount;
        let displayItemDiscountAmount = item.itemDiscountAmount;

        const percentageDiscountRate = item.linear ? 0 : getPercentageDiscountRate(item.measurement);
        if (embedsGeneralIncrease && percentageDiscountRate > 0 && percentageDiscountRate < 100) {
            displayBasePrice = displayFinalItemPrice / (1 - (percentageDiscountRate / 100));
            displayItemDiscountAmount = displayBasePrice - displayFinalItemPrice;
        }

        return {
            ...item,
            displayBasePrice,
            displayItemDiscountAmount,
            displayFinalItemPrice,
            embeddedIncreaseAmount
        };
    });

    const summaryItemDiscount = lineItems.reduce((sum, item) => sum + item.displayItemDiscountAmount, 0);
    const itemIncreaseTotal = rawLineItems.reduce((sum, item) => sum + item.itemIncreaseAmount, 0);

    return {
        lineItems,
        embedsGeneralIncrease,
        summarySubtotal: embedsGeneralIncrease
            ? totals.finalTotal + finalDiscountAmount + summaryItemDiscount
            : totals.subtotal + itemIncreaseTotal,
        summaryItemDiscount,
        summaryFinalTotal: totals.finalTotal
    };
};
