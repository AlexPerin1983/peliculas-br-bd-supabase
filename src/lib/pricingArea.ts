export const roundAreaForPricing = (area: number) => {
    if (!Number.isFinite(area)) return 0;
    return Math.round((area + Number.EPSILON) * 100) / 100;
};

export const calculatePricingAreaM2 = (width: number, height: number, quantity: number) => (
    roundAreaForPricing(width * height * quantity)
);
