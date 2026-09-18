import type { SavedPDF } from '../../types';
import { calculateFollowUpDiscount, type FollowUpDiscountType } from './proposalMessages';

// Preserve the price before the first follow-up. Replacing an offer must never
// calculate another discount on top of the previous follow-up.
export const getFollowUpBase = (pdf: SavedPDF): number =>
    pdf.followUpBaseValue ?? pdf.totalPreco;

export const previewProposalFollowUp = (pdf: SavedPDF, raw: string, type: FollowUpDiscountType): SavedPDF => {
    const base = getFollowUpBase(pdf);
    const discount = calculateFollowUpDiscount(base, raw, type);
    const percent = type === 'percentage' ? discount.discountValue
        : base > 0 ? Math.round(discount.discountAmount / base * 10000) / 100 : 0;
    return {
        ...pdf,
        totalPreco: discount.specialValue,
        followUpBaseValue: discount.discountValue > 0 ? base : undefined,
        followUpDiscountPercent: percent,
        followUpDiscountType: type,
        followUpDiscountAmount: discount.discountAmount,
    };
};
