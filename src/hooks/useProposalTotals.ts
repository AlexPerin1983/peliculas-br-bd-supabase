import { useMemo } from 'react';
import { Film, ProposalDiscount, Totals, UIMeasurement } from '../../types';
import { calculateProposalTotals } from '../lib/calculateProposalTotals';

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
    return useMemo<Totals>(
        () => calculateProposalTotals({ measurements, films, generalDiscount }),
        [measurements, films, generalDiscount]
    );
}
