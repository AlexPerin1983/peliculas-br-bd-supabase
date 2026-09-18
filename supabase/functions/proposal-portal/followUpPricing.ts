// Shared by the public endpoint and company inbox. Follow-up prices always
// come from saved_pdfs, including after the discount has been removed.
export const resolvePortalPricing = (pdf: any, item: any, expiresAt: string) => {
    if (Number(pdf?.follow_up_revision || 0) > 0) {
        return {
            conditionOriginalValue: pdf.follow_up_base_value == null ? null : Number(pdf.follow_up_base_value),
            conditionFinalValue: Number(pdf.total_preco || 0),
            conditionDiscountAmount: Number(pdf.follow_up_discount_amount || 0),
            conditionDiscountPercent: Number(pdf.follow_up_discount_percent || 0),
            conditionExpiresAt: expiresAt,
        };
    }
    return {
        conditionOriginalValue: item.condition_original_value == null ? null : Number(item.condition_original_value),
        conditionFinalValue: item.condition_final_value == null ? null : Number(item.condition_final_value),
        conditionDiscountAmount: item.condition_discount_amount == null ? null : Number(item.condition_discount_amount),
        conditionDiscountPercent: item.condition_discount_percent == null ? null : Number(item.condition_discount_percent),
        conditionExpiresAt: item.condition_expires_at,
    };
};
