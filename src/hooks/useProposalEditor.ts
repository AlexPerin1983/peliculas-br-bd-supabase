import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Film, Measurement, ProposalDiscount, ProposalExpense, ProposalOption, ProposalPricingMode, UIMeasurement } from '../../types';
import * as db from '../../services/db';
import { normalizeProposalExpenses } from '../lib/proposalExpenses';

type DiscountType = ProposalDiscount;

interface UseProposalEditorParams {
    selectedClientId: number | null;
    films: Film[];
    loadClients: (clientIdToSelect?: number, shouldReorder?: boolean) => Promise<void>;
}

const EMPTY_GENERAL_DISCOUNT: DiscountType = { value: '', type: 'fixed', operation: 'discount', pricingMode: 'complete' };

const normalizeDiscountValue = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }

    return '';
};

const normalizeGeneralDiscount = (
    discount?: Partial<DiscountType> | null,
    fallback?: Partial<DiscountType> | null
): DiscountType => {
    const value = normalizeDiscountValue(discount?.value ?? fallback?.value);
    const type = discount?.type === 'fixed' || discount?.type === 'percentage'
        ? discount.type
        : fallback?.type === 'percentage'
            ? 'percentage'
            : 'fixed';
    const operation = discount?.operation === 'increase' || discount?.operation === 'discount'
        ? discount.operation
        : fallback?.operation === 'increase'
            ? 'increase'
            : 'discount';
    const discountValue = normalizeDiscountValue(
        discount?.discountValue ?? fallback?.discountValue ?? (operation === 'discount' ? value : '')
    );
    const increaseValue = normalizeDiscountValue(
        discount?.increaseValue ?? fallback?.increaseValue ?? (operation === 'increase' ? value : '')
    );

    return {
        value,
        type,
        operation,
        discountValue,
        discountType: discount?.discountType === 'fixed' || discount?.discountType === 'percentage'
            ? discount.discountType
            : fallback?.discountType === 'fixed' || fallback?.discountType === 'percentage'
                ? fallback.discountType
                : type === 'percentage' && (parseFloat(discountValue.replace(',', '.')) || 0) > 0
                    ? 'percentage'
                    : 'fixed',
        increaseValue,
        increaseType: discount?.increaseType === 'fixed' || discount?.increaseType === 'percentage'
            ? discount.increaseType
            : fallback?.increaseType === 'percentage'
                ? 'percentage'
                : type === 'percentage' && (parseFloat(increaseValue.replace(',', '.')) || 0) > 0
                    ? 'percentage'
                    : 'fixed',
        pricingMode: discount?.pricingMode === 'labor_only' || discount?.pricingMode === 'complete'
            ? discount.pricingMode
            : fallback?.pricingMode === 'labor_only'
                ? 'labor_only'
                : 'complete',
        filmPricingModes: discount?.filmPricingModes ?? fallback?.filmPricingModes,
        // `undefined` explícito significa que o usuário restaurou o catálogo.
        // Não podemos usar `?? fallback` nesse caso, senão o override antigo volta.
        filmPriceOverrides: discount && Object.prototype.hasOwnProperty.call(discount, 'filmPriceOverrides')
            ? discount.filmPriceOverrides
            : fallback?.filmPriceOverrides,
        filmCuttingSettings: discount?.filmCuttingSettings ?? fallback?.filmCuttingSettings,
        expenses: normalizeProposalExpenses(discount?.expenses ?? fallback?.expenses),
        hideMeasurements: discount?.hideMeasurements ?? fallback?.hideMeasurements,
        incluirTermoResponsabilidade: discount?.incluirTermoResponsabilidade ?? fallback?.incluirTermoResponsabilidade,
    };
};

const createDefaultOption = (): ProposalOption => ({
    id: Date.now(),
    name: 'Opcao 1',
    measurements: [],
    generalDiscount: { ...EMPTY_GENERAL_DISCOUNT }
});

export function useProposalEditor({
    selectedClientId,
    films,
    loadClients
}: UseProposalEditorParams) {
    const [proposalOptions, setProposalOptions] = useState<ProposalOption[]>([]);
    const [activeOptionId, setActiveOptionId] = useState<number | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const proposalOptionsRef = useRef<ProposalOption[]>([]);

    useEffect(() => {
        proposalOptionsRef.current = proposalOptions;
    }, [proposalOptions]);

    useEffect(() => {
        let isCancelled = false;

        const loadDataForClient = async () => {
            if (!selectedClientId) {
                if (!isCancelled) {
                    setProposalOptions([]);
                    setActiveOptionId(null);
                    setIsDirty(false);
                }
                return;
            }

            const savedOptions = await db.getProposalOptions(selectedClientId);

            if (isCancelled) {
                return;
            }

            if (savedOptions.length === 0) {
                const defaultOption = createDefaultOption();
                setProposalOptions([defaultOption]);
                setActiveOptionId(defaultOption.id);
            } else {
                setProposalOptions(savedOptions.map(option => ({
                    ...option,
                    generalDiscount: normalizeGeneralDiscount(option.generalDiscount)
                })));
                setActiveOptionId(savedOptions[0].id);
            }
            setIsDirty(false);
        };

        loadDataForClient();

        return () => {
            isCancelled = true;
        };
    }, [selectedClientId]);

    const activeOption = useMemo(() => {
        return proposalOptions.find(option => option.id === activeOptionId) || null;
    }, [proposalOptions, activeOptionId]);

    const measurements = activeOption?.measurements || [];
    const generalDiscount = normalizeGeneralDiscount(activeOption?.generalDiscount);

    const handleSaveChanges = useCallback(async () => {
        const currentProposalOptions = proposalOptionsRef.current;

        if (selectedClientId && currentProposalOptions.length > 0) {
            await db.saveProposalOptions(selectedClientId, currentProposalOptions);
            setIsDirty(false);
            // O orçamento já está seguro no banco local neste ponto. A
            // atualização da lista pode depender da rede e não deve bloquear
            // a geração do PDF (principalmente em conexões instáveis).
            void loadClients(selectedClientId, false).catch(error => {
                console.error('Erro ao atualizar clientes após salvar o orçamento:', error);
            });
        }
    }, [selectedClientId, loadClients]);

    const updateActiveOption = useCallback((updater: (option: ProposalOption) => ProposalOption) => {
        if (!activeOptionId) {
            return;
        }

        let hasUpdated = false;

        setProposalOptions(currentOptions => currentOptions.map(option => {
            if (option.id !== activeOptionId) {
                return option;
            }

            hasUpdated = true;
            return updater(option);
        }));

        if (hasUpdated) {
            setIsDirty(true);
        }
    }, [activeOptionId]);

    const handleMeasurementsChange = useCallback((newMeasurements: UIMeasurement[]) => {
        updateActiveOption(option => ({ ...option, measurements: newMeasurements }));
    }, [updateActiveOption]);

    const handleMeasurementsChangeWithPersistence = useCallback(async (newMeasurements: UIMeasurement[]) => {
        if (!selectedClientId || !activeOptionId) {
            handleMeasurementsChange(newMeasurements);
            return;
        }

        const updatedProposalOptions = proposalOptionsRef.current.map(option =>
            option.id === activeOptionId
                ? { ...option, measurements: newMeasurements }
                : option
        );

        setProposalOptions(updatedProposalOptions);
        proposalOptionsRef.current = updatedProposalOptions;
        setIsDirty(false);

        await db.saveProposalOptions(selectedClientId, updatedProposalOptions);
        setIsDirty(false);
        await loadClients(selectedClientId, false);
    }, [selectedClientId, activeOptionId, loadClients, handleMeasurementsChange]);

    useEffect(() => {
        if (!isDirty) {
            return;
        }

        const timerId = setTimeout(() => {
            handleSaveChanges();
        }, 1500);

        return () => clearTimeout(timerId);
    }, [proposalOptions, isDirty, handleSaveChanges]);

    const handleGeneralDiscountChange = useCallback((discount: DiscountType) => {
        updateActiveOption(option => ({
            ...option,
            generalDiscount: normalizeGeneralDiscount(discount, option.generalDiscount)
        }));
    }, [updateActiveOption]);

    const handleProposalPricingModeChange = useCallback((pricingMode: ProposalPricingMode) => {
        updateActiveOption(option => ({
            ...option,
            generalDiscount: normalizeGeneralDiscount({
                ...option.generalDiscount,
                pricingMode
            }, option.generalDiscount)
        }));
    }, [updateActiveOption]);

    const handleProposalExpensesChange = useCallback((expenses: ProposalExpense[]) => {
        updateActiveOption(option => ({
            ...option,
            generalDiscount: normalizeGeneralDiscount({
                ...option.generalDiscount,
                expenses
            }, option.generalDiscount)
        }));
    }, [updateActiveOption]);

    const createEmptyMeasurement = useCallback((): Measurement => ({
        id: Date.now(),
        largura: '',
        altura: '',
        quantidade: 1,
        ambiente: 'Desconhecido',
        tipoAplicacao: 'Desconhecido',
        pelicula: films[0]?.nome || 'Nenhuma',
        active: true,
        discount: { value: '0', type: 'percentage' }
    }), [films]);

    const addMeasurement = useCallback(() => {
        const newMeasurement: UIMeasurement = { ...createEmptyMeasurement(), isNew: true };
        const updatedMeasurements = [
            ...measurements.map(measurement => ({ ...measurement, isNew: false })),
            newMeasurement
        ];

        handleMeasurementsChange(updatedMeasurements);
    }, [createEmptyMeasurement, measurements, handleMeasurementsChange]);

    // filmName opcional: ao duplicar, ja aplica a mesma pelicula em todos os grupos
    // (acelera criar variacoes de orcamento trocando so o material).
    const duplicateActiveOption = useCallback((filmName?: string) => {
        if (!activeOption) {
            return;
        }

        const newOption: ProposalOption = {
            id: Date.now(),
            name: `Opcao ${proposalOptions.length + 1}`,
            measurements: activeOption.measurements.map((measurement, index) => ({
                ...measurement,
                id: Date.now() + index,
                isNew: false,
                ...(filmName ? { pelicula: filmName, aiFilmSuggestion: undefined } : {})
            })),
            generalDiscount: {
                ...activeOption.generalDiscount,
                expenses: normalizeProposalExpenses(activeOption.generalDiscount.expenses)
            }
        };

        setProposalOptions(currentOptions => [...currentOptions, newOption]);
        setActiveOptionId(newOption.id);
        setIsDirty(true);
    }, [activeOption, proposalOptions.length]);

    const addProposalOption = useCallback(() => {
        setProposalOptions(currentOptions => {
            const newOption: ProposalOption = {
                id: Date.now(),
                name: `Opcao ${currentOptions.length + 1}`,
                measurements: [],
                generalDiscount: { ...EMPTY_GENERAL_DISCOUNT }
            };

            setActiveOptionId(newOption.id);
            setIsDirty(true);

            return [...currentOptions, newOption];
        });
    }, []);

    const renameProposalOption = useCallback((optionId: number, newName: string) => {
        setProposalOptions(currentOptions => currentOptions.map(option =>
            option.id === optionId ? { ...option, name: newName } : option
        ));
        setIsDirty(true);
    }, []);

    const deleteProposalOption = useCallback((optionId: number) => {
        setProposalOptions(currentOptions => {
            const remainingOptions = currentOptions.filter(option => option.id !== optionId);

            setActiveOptionId(currentActiveOptionId => {
                if (currentActiveOptionId !== optionId) {
                    return currentActiveOptionId;
                }

                return remainingOptions[0]?.id ?? null;
            });

            return remainingOptions;
        });
        setIsDirty(true);
    }, []);

    const clearMeasurements = useCallback(() => {
        handleMeasurementsChange([]);
    }, [handleMeasurementsChange]);

    return {
        proposalOptions,
        activeOptionId,
        setActiveOptionId,
        activeOption,
        measurements,
        generalDiscount,
        isDirty,
        handleSaveChanges,
        handleMeasurementsChange,
        handleMeasurementsChangeWithPersistence,
        handleGeneralDiscountChange,
        handleProposalPricingModeChange,
        handleProposalExpensesChange,
        createEmptyMeasurement,
        addMeasurement,
        duplicateActiveOption,
        addProposalOption,
        renameProposalOption,
        deleteProposalOption,
        clearMeasurements,
        updateActiveOption
    };
}
