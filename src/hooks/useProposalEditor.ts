import { useCallback, useEffect, useMemo, useState } from 'react';
import { Film, Measurement, ProposalOption, UIMeasurement } from '../../types';
import * as db from '../../services/db';

type DiscountType = { value: string; type: 'percentage' | 'fixed' };

interface UseProposalEditorParams {
    selectedClientId: number | null;
    films: Film[];
    loadClients: (clientIdToSelect?: number, shouldReorder?: boolean) => Promise<void>;
}

const EMPTY_GENERAL_DISCOUNT: DiscountType = { value: '', type: 'percentage' };

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
                setProposalOptions(savedOptions);
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
    const generalDiscount = activeOption?.generalDiscount || EMPTY_GENERAL_DISCOUNT;

    const handleSaveChanges = useCallback(async () => {
        if (selectedClientId && proposalOptions.length > 0) {
            await db.saveProposalOptions(selectedClientId, proposalOptions);
            setIsDirty(false);
            await loadClients(selectedClientId);
        }
    }, [selectedClientId, proposalOptions, loadClients]);

    useEffect(() => {
        if (!isDirty) {
            return;
        }

        const timerId = setTimeout(() => {
            handleSaveChanges();
        }, 1500);

        return () => clearTimeout(timerId);
    }, [proposalOptions, isDirty, handleSaveChanges]);

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

    const handleGeneralDiscountChange = useCallback((discount: DiscountType) => {
        updateActiveOption(option => ({ ...option, generalDiscount: discount }));
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

    const duplicateActiveOption = useCallback(() => {
        if (!activeOption) {
            return;
        }

        const newOption: ProposalOption = {
            id: Date.now(),
            name: `Opcao ${proposalOptions.length + 1}`,
            measurements: activeOption.measurements.map((measurement, index) => ({
                ...measurement,
                id: Date.now() + index,
                isNew: false
            })),
            generalDiscount: { ...activeOption.generalDiscount }
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
        handleGeneralDiscountChange,
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
