import { ProposalExpense, ProposalExpenseCategory, ProposalExpenseCategoryTotal, ProposalFuelExpenseDetails } from '../../types';

export const PROPOSAL_EXPENSE_CATEGORY_OPTIONS: { category: ProposalExpenseCategory; label: string }[] = [
    { category: 'paid_traffic', label: 'Tráfego pago' },
    { category: 'transport', label: 'Locomoção' },
    { category: 'food', label: 'Alimentação' },
    { category: 'tools', label: 'Ferramentas' },
    { category: 'material', label: 'Material extra' },
    { category: 'other', label: 'Outros' }
];

const categoryLabels = PROPOSAL_EXPENSE_CATEGORY_OPTIONS.reduce((acc, option) => {
    acc[option.category] = option.label;
    return acc;
}, {} as Record<ProposalExpenseCategory, string>);

export const formatProposalExpenseCategory = (category: ProposalExpenseCategory): string => {
    return categoryLabels[category] || 'Outros';
};

export const parseCurrencyInput = (value?: string | number | null): number => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    const rawValue = String(value || '').trim();
    if (!rawValue) {
        return 0;
    }

    const normalizedValue = rawValue.includes(',')
        ? rawValue.replace(/\./g, '').replace(',', '.')
        : rawValue;
    const parsedValue = parseFloat(normalizedValue.replace(/[^0-9.-]/g, ''));

    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
};

export const normalizeCurrencyInput = (value?: string | number | null): string => {
    if (typeof value === 'number') {
        return value > 0 ? String(value) : '';
    }

    return String(value || '').replace(/[^0-9,.]/g, '').trim();
};

const roundMoney = (value: number): number => {
    return Math.round(value * 100) / 100;
};

export const calculateFuelExpenseAmount = (fuelDetails?: ProposalFuelExpenseDetails | null): number => {
    if (!fuelDetails) {
        return 0;
    }

    const fuelPricePerLiter = parseCurrencyInput(fuelDetails.fuelPricePerLiter);
    const consumptionKmPerLiter = parseCurrencyInput(fuelDetails.consumptionKmPerLiter);
    const distanceKm = parseCurrencyInput(fuelDetails.distanceKm);

    if (fuelPricePerLiter <= 0 || consumptionKmPerLiter <= 0 || distanceKm <= 0) {
        return 0;
    }

    return roundMoney((distanceKm / consumptionKmPerLiter) * fuelPricePerLiter);
};

export const normalizeFuelExpenseDetails = (fuelDetails?: ProposalFuelExpenseDetails | null): ProposalFuelExpenseDetails | undefined => {
    if (!fuelDetails) {
        return undefined;
    }

    const normalizedDetails: ProposalFuelExpenseDetails = {};
    const fuelPricePerLiter = normalizeCurrencyInput(fuelDetails.fuelPricePerLiter);
    const consumptionKmPerLiter = normalizeCurrencyInput(fuelDetails.consumptionKmPerLiter);
    const distanceKm = normalizeCurrencyInput(fuelDetails.distanceKm);

    if (fuelPricePerLiter) {
        normalizedDetails.fuelPricePerLiter = fuelPricePerLiter;
    }

    if (consumptionKmPerLiter) {
        normalizedDetails.consumptionKmPerLiter = consumptionKmPerLiter;
    }

    if (distanceKm) {
        normalizedDetails.distanceKm = distanceKm;
    }

    const calculatedAmount = calculateFuelExpenseAmount(normalizedDetails);
    if (calculatedAmount > 0) {
        normalizedDetails.calculatedAmount = calculatedAmount;
    }

    return Object.keys(normalizedDetails).length > 0 ? normalizedDetails : undefined;
};

export const normalizeProposalExpenses = (expenses?: ProposalExpense[] | null): ProposalExpense[] => {
    if (!Array.isArray(expenses)) {
        return [];
    }

    const validCategories = new Set(PROPOSAL_EXPENSE_CATEGORY_OPTIONS.map(option => option.category));

    return expenses
        .map((expense, index) => {
            const category = validCategories.has(expense.category) ? expense.category : 'other';
            const fuelDetails = category === 'transport'
                ? normalizeFuelExpenseDetails(expense.fuelDetails)
                : undefined;
            const fuelAmount = calculateFuelExpenseAmount(fuelDetails);
            const amount = parseCurrencyInput(expense.amount) > 0
                ? normalizeCurrencyInput(expense.amount)
                : fuelAmount > 0
                    ? String(fuelAmount)
                    : normalizeCurrencyInput(expense.amount);
            const description = String(expense.description || '').trim();

            return {
                id: expense.id || `${category}-${index}`,
                category,
                amount,
                ...(description ? { description } : {}),
                ...(fuelDetails ? { fuelDetails } : {})
            };
        })
        .filter(expense => parseCurrencyInput(expense.amount) > 0);
};

export const summarizeProposalExpenses = (expenses?: ProposalExpense[] | null): {
    total: number;
    byCategory: ProposalExpenseCategoryTotal[];
} => {
    const normalizedExpenses = normalizeProposalExpenses(expenses);
    const totalsByCategory = new Map<ProposalExpenseCategory, number>();

    normalizedExpenses.forEach(expense => {
        totalsByCategory.set(
            expense.category,
            (totalsByCategory.get(expense.category) || 0) + parseCurrencyInput(expense.amount)
        );
    });

    const byCategory = PROPOSAL_EXPENSE_CATEGORY_OPTIONS
        .map(option => ({
            category: option.category,
            label: option.label,
            total: totalsByCategory.get(option.category) || 0
        }))
        .filter(item => item.total > 0);

    return {
        total: byCategory.reduce((sum, item) => sum + item.total, 0),
        byCategory
    };
};
