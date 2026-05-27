import type { Film, Measurement, ProposalAdjustmentOperation, ProposalPricingMode, Totals } from '../../types';
import { calculatePricingAreaM2 } from './pricingArea';

type PdfGeneralAdjustment = {
    operation?: ProposalAdjustmentOperation;
};

type PdfDisplayTotals = Pick<Totals, 'subtotal' | 'totalItemDiscount' | 'generalDiscountAmount' | 'finalTotal' | 'generalIncreaseAmount' | 'generalFinalDiscountAmount'>;

export interface PdfDisplayLineItem {
    measurement: Measurement;
    m2: number;
    basePrice: number;
    itemDiscountAmount: number;
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

const getPricePerM2 = (film: Film | undefined, pricingMode: ProposalPricingMode) => {
    if (!film) return 0;
    if (pricingMode === 'labor_only') return film.maoDeObra || 0;
    if (film.preco > 0) return film.preco;
    return film.maoDeObra && film.maoDeObra > 0 ? film.maoDeObra : 0;
};

const calculateItemDiscountAmount = (measurement: Measurement, basePrice: number) => {
    const discount = measurement.discount;
    if (!discount) return 0;

    const discountValue = parseDecimal(discount.value);
    if (discount.type === 'percentage' && discountValue > 0) {
        return basePrice * (discountValue / 100);
    }
    if (discount.type === 'fixed' && discountValue > 0) {
        return discountValue;
    }
    return 0;
};

const getPercentageDiscountRate = (measurement: Measurement) => {
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
    const rawLineItems = measurements.map(measurement => {
        const largura = parseDecimal(measurement.largura);
        const altura = parseDecimal(measurement.altura);
        const quantidade = parseInt(String(measurement.quantidade), 10) || 0;
        const m2 = calculatePricingAreaM2(largura, altura, quantidade);
        const film = films.find(item => item.nome === measurement.pelicula);
        const basePrice = getPricePerM2(film, pricingMode) * m2;
        const itemDiscountAmount = calculateItemDiscountAmount(measurement, basePrice);
        const finalItemPrice = Math.max(0, basePrice - itemDiscountAmount);

        return {
            measurement,
            m2,
            basePrice,
            itemDiscountAmount,
            finalItemPrice
        };
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
        let displayBasePrice = item.basePrice + embeddedIncreaseAmount;
        let displayItemDiscountAmount = item.itemDiscountAmount;

        const percentageDiscountRate = getPercentageDiscountRate(item.measurement);
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

    const summaryItemDiscount = embedsGeneralIncrease
        ? lineItems.reduce((sum, item) => sum + item.displayItemDiscountAmount, 0)
        : totals.totalItemDiscount;

    return {
        lineItems,
        embedsGeneralIncrease,
        summarySubtotal: embedsGeneralIncrease ? totals.finalTotal + finalDiscountAmount + summaryItemDiscount : totals.subtotal,
        summaryItemDiscount,
        summaryFinalTotal: totals.finalTotal
    };
};
