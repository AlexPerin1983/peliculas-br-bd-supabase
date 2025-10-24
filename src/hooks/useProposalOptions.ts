import { useState, useCallback, useEffect } from 'react';
import { ProposalOption, Measurement } from '../../types';
import * as db from '../../services/db';

export const useProposalOptions = (selectedClientId: number | null) => {
    const [proposalOptions, setProposalOptions] = useState<ProposalOption[]>([]);
    const [activeOptionId, setActiveOptionId] = useState<number | null>(null);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        const loadDataForClient = async () => {
            if (selectedClientId) {
                const savedOptions = await db.getProposalOptions(selectedClientId);
                
                if (savedOptions.length === 0) {
                    const defaultOption: ProposalOption = {
                        id: Date.now(),
                        name: 'Opção 1',
                        measurements: [],
                        generalDiscount: { value: '', type: 'percentage' }
                    };
                    setProposalOptions([defaultOption]);
                    setActiveOptionId(defaultOption.id);
                } else {
                    setProposalOptions(savedOptions);
                    setActiveOptionId(savedOptions[0].id);
                }
                setIsDirty(false);
            } else {
                setProposalOptions([]);
                setActiveOptionId(null);
                setIsDirty(false);
            }
        };
        loadDataForClient();
    }, [selectedClientId]);

    const saveChanges = useCallback(async () => {
        if (selectedClientId && proposalOptions.length > 0) {
            await db.saveProposalOptions(selectedClientId, proposalOptions);
            setIsDirty(false);
        }
    }, [selectedClientId, proposalOptions]);

    useEffect(() => {
        if (!isDirty) return;
        
        const timerId = setTimeout(() => {
            saveChanges();
        }, 1500);

        return () => clearTimeout(timerId);
    }, [proposalOptions, isDirty, saveChanges]);

    const updateMeasurements = useCallback((newMeasurements: Measurement[]) => {
        if (!activeOptionId) return;
        
        setProposalOptions(prev => prev.map(opt =>
            opt.id === activeOptionId
                ? { ...opt, measurements: newMeasurements }
                : opt
        ));
        setIsDirty(true);
    }, [activeOptionId]);

    const updateGeneralDiscount = useCallback((discount: { value: string; type: 'percentage' | 'fixed' }) => {
        if (!activeOptionId) return;
        
        setProposalOptions(prev => prev.map(opt =>
            opt.id === activeOptionId
                ? { ...opt, generalDiscount: discount }
                : opt
        ));
        setIsDirty(true);
    }, [activeOptionId]);

    const addOption = useCallback(() => {
        const newOption: ProposalOption = {
            id: Date.now(),
            name: `Opção ${proposalOptions.length + 1}`,
            measurements: [],
            generalDiscount: { value: '', type: 'percentage' }
        };
        
        setProposalOptions(prev => [...prev, newOption]);
        setActiveOptionId(newOption.id);
        setIsDirty(true);
    }, [proposalOptions.length]);

    const renameOption = useCallback((optionId: number, newName: string) => {
        setProposalOptions(prev => prev.map(opt =>
            opt.id === optionId ? { ...opt, name: newName } : opt
        ));
        setIsDirty(true);
    }, []);

    const deleteOption = useCallback((optionId: number) => {
        const remainingOptions = proposalOptions.filter(opt => opt.id !== optionId);
        setProposalOptions(remainingOptions);
        
        if (activeOptionId === optionId && remainingOptions.length > 0) {
            setActiveOptionId(remainingOptions[0].id);
        }
        setIsDirty(true);
    }, [proposalOptions, activeOptionId]);

    const duplicateOption = useCallback((sourceOption: ProposalOption) => {
        const newOption: ProposalOption = {
            id: Date.now(),
            name: `Opção ${proposalOptions.length + 1}`,
            measurements: sourceOption.measurements.map((m, index) => ({
                ...m,
                id: Date.now() + index,
            })),
            generalDiscount: { ...sourceOption.generalDiscount }
        };
        
        setProposalOptions(prev => [...prev, newOption]);
        setActiveOptionId(newOption.id);
        setIsDirty(true);
    }, [proposalOptions.length]);

    const activeOption = proposalOptions.find(opt => opt.id === activeOptionId) || null;

    return {
        proposalOptions,
        activeOptionId,
        activeOption,
        isDirty,
        setActiveOptionId,
        updateMeasurements,
        updateGeneralDiscount,
        addOption,
        renameOption,
        deleteOption,
        duplicateOption,
        saveChanges
    };
};