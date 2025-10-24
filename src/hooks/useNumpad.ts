import { useState, useCallback } from 'react';
import { Measurement } from '../../types';

type NumpadConfig = {
    isOpen: boolean;
    measurementId: number | null;
    field: 'largura' | 'altura' | 'quantidade' | null;
    currentValue: string;
    shouldClearOnNextInput: boolean;
};

export const useNumpad = (
    measurements: Measurement[],
    onMeasurementsChange: (measurements: Measurement[]) => void
) => {
    const [numpadConfig, setNumpadConfig] = useState<NumpadConfig>({
        isOpen: false,
        measurementId: null,
        field: null,
        currentValue: '',
        shouldClearOnNextInput: false,
    });

    const openNumpad = useCallback((measurementId: number, field: 'largura' | 'altura' | 'quantidade', currentValue: string | number) => {
        const { isOpen, measurementId: prevId, field: prevField, currentValue: prevValue } = numpadConfig;

        if (isOpen && (prevId !== measurementId || prevField !== field)) {
            let finalValue: string | number;
            if (prevField === 'quantidade') {
                finalValue = parseInt(String(prevValue), 10) || 1;
            } else {
                finalValue = (prevValue === ',' || prevValue === '' || prevValue === '.') ? '0' : prevValue.replace('.', ',');
            }

            const updatedMeasurements = measurements.map(m =>
                m.id === prevId ? { ...m, [prevField!]: finalValue } : m
            );
            onMeasurementsChange(updatedMeasurements);
        }

        setNumpadConfig(prev => {
            const isSameButton = prev.isOpen && prev.measurementId === measurementId && prev.field === field;
            
            if (isSameButton) {
                return {
                    ...prev,
                    shouldClearOnNextInput: false,
                };
            }

            return {
                isOpen: true,
                measurementId,
                field,
                currentValue: String(currentValue).replace(',', '.'),
                shouldClearOnNextInput: true,
            };
        });
    }, [numpadConfig, measurements, onMeasurementsChange]);

    const closeNumpad = useCallback(() => {
        const { measurementId, field, currentValue } = numpadConfig;
        if (measurementId === null || field === null) {
            setNumpadConfig({ isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false });
            return;
        }

        let finalValue: string | number;
        if (field === 'quantidade') {
            finalValue = parseInt(String(currentValue), 10) || 1;
        } else {
            finalValue = (currentValue === '' || currentValue === '.') ? '0' : currentValue.replace('.', ',');
        }

        const updatedMeasurements = measurements.map(m =>
            m.id === measurementId ? { ...m, [field]: finalValue } : m
        );
        onMeasurementsChange(updatedMeasurements);
        
        setNumpadConfig({ isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false });
    }, [numpadConfig, measurements, onMeasurementsChange]);

    const handleInput = useCallback((value: string) => {
        setNumpadConfig(prev => {
            const shouldClear = prev.shouldClearOnNextInput;
            let newValue = prev.currentValue;

            const char = value === ',' ? '.' : value;

            if (char === '.') {
                if (prev.field !== 'quantidade') {
                    newValue = shouldClear ? '0.' : (newValue.includes('.') ? newValue : newValue + '.');
                }
            } else {
                newValue = shouldClear ? char : newValue + char;
            }

            const isWidthOrHeight = prev.field === 'largura' || prev.field === 'altura';
            const matchesPattern = /^\d\.\d{2}$/.test(newValue);

            if (isWidthOrHeight && matchesPattern) {
                const finalValue = newValue.replace('.', ',');
                
                // SALVAR EM TEMPO REAL APENAS SE FOR O PADRÃO COMPLETO X.XX
                const measurementsWithSavedValue = measurements.map(m =>
                    m.id === prev.measurementId ? { ...m, [prev.field!]: finalValue } : m
                );
                onMeasurementsChange(measurementsWithSavedValue);

                const fieldSequence: Array<'largura' | 'altura' | 'quantidade'> = ['largura', 'altura', 'quantidade'];
                const currentIndex = fieldSequence.indexOf(prev.field!);
                const nextIndex = currentIndex + 1;

                if (nextIndex < fieldSequence.length) {
                    const nextField = fieldSequence[nextIndex];
                    const currentMeasurement = measurementsWithSavedValue.find(m => m.id === prev.measurementId);
                    const nextValueForField = currentMeasurement ? currentMeasurement[nextField] : '';
                    
                    return {
                        isOpen: true,
                        measurementId: prev.measurementId,
                        field: nextField,
                        currentValue: String(nextValueForField).replace(',', '.'),
                        shouldClearOnNextInput: true,
                    };
                } else {
                    return { isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false };
                }
            } else if (prev.field === 'quantidade') {
                // Para quantidade, salvamos o inteiro em tempo real
                const finalQty = parseInt(newValue, 10) || 0;
                const measurementsWithSavedValue = measurements.map(m =>
                    m.id === prev.measurementId ? { ...m, quantidade: finalQty } : m
                );
                onMeasurementsChange(measurementsWithSavedValue);
            }

            // FIX: Desativar shouldClearOnNextInput após o primeiro caractere digitado, a menos que seja um ponto/vírgula
            const nextShouldClear = shouldClear && value !== ',' && value !== '.';

            return { ...prev, currentValue: newValue, shouldClearOnNextInput: nextShouldClear };
        });
    }, [measurements, onMeasurementsChange]);

    const handleDelete = useCallback(() => {
        setNumpadConfig(prev => ({ 
            ...prev, 
            currentValue: prev.currentValue.slice(0, -1),
            shouldClearOnNextInput: false 
        }));
    }, []);

    const handleDone = useCallback(() => {
        const { measurementId, field, currentValue } = numpadConfig;
        if (measurementId === null || field === null) return;

        let finalValue: string | number;
        if (field === 'quantidade') {
            finalValue = parseInt(String(currentValue), 10) || 1;
        } else {
            finalValue = (currentValue === '' || currentValue === '.') ? '0' : currentValue.replace('.', ',');
        }

        const updatedMeasurements = measurements.map(m =>
            m.id === measurementId ? { ...m, [field]: finalValue } : m
        );
        onMeasurementsChange(updatedMeasurements);

        const fieldSequence: Array<'largura' | 'altura' | 'quantidade'> = ['largura', 'altura', 'quantidade'];
        const currentIndex = fieldSequence.indexOf(field);
        const nextIndex = currentIndex + 1;

        if (nextIndex < fieldSequence.length) {
            const nextField = fieldSequence[nextIndex];
            const currentMeasurement = updatedMeasurements.find(m => m.id === measurementId);
            const nextValue = currentMeasurement ? currentMeasurement[nextField] : '';

            setNumpadConfig({
                isOpen: true,
                measurementId,
                field: nextField,
                currentValue: String(nextValue).replace(',', '.'),
                shouldClearOnNextInput: true,
            });
        } else {
            setNumpadConfig({ isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false });
        }
    }, [numpadConfig, measurements, onMeasurementsChange]);

    const handleClear = useCallback(() => {
        const { measurementId, field } = numpadConfig;
        if (measurementId === null) return;

        const updatedMeasurements = measurements.map(m =>
            m.id === measurementId ? { ...m, largura: '', altura: '', quantidade: 1 } : m
        );
        onMeasurementsChange(updatedMeasurements);

        setNumpadConfig(prev => ({
            ...prev,
            currentValue: field === 'quantidade' ? '1' : '',
            shouldClearOnNextInput: true,
        }));
    }, [numpadConfig, measurements, onMeasurementsChange]);

    return {
        numpadConfig,
        openNumpad,
        closeNumpad,
        handleInput,
        handleDelete,
        handleDone,
        handleClear
    };
};