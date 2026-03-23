import { useCallback, useState } from 'react';
import { Measurement, UIMeasurement } from '../../types';

export type NumpadConfig = {
    isOpen: boolean;
    measurementId: number | null;
    field: 'largura' | 'altura' | 'quantidade' | null;
    currentValue: string;
    shouldClearOnNextInput: boolean;
};

interface UseMeasurementEditorParams {
    measurements: UIMeasurement[];
    handleMeasurementsChange: (newMeasurements: UIMeasurement[]) => void;
    createEmptyMeasurement: () => Measurement;
}

const CLOSED_NUMPAD: NumpadConfig = {
    isOpen: false,
    measurementId: null,
    field: null,
    currentValue: '',
    shouldClearOnNextInput: false
};

export function useMeasurementEditor({
    measurements,
    handleMeasurementsChange,
    createEmptyMeasurement
}: UseMeasurementEditorParams) {
    const [editingMeasurement, setEditingMeasurement] = useState<UIMeasurement | null>(null);
    const [editingMeasurementForDiscount, setEditingMeasurementForDiscount] = useState<UIMeasurement | null>(null);
    const [editingMeasurementBasePrice, setEditingMeasurementBasePrice] = useState<number>(0);
    const [measurementToDeleteId, setMeasurementToDeleteId] = useState<number | null>(null);
    const [deletedMeasurement, setDeletedMeasurement] = useState<UIMeasurement | null>(null);
    const [deletedMeasurementIndex, setDeletedMeasurementIndex] = useState<number | null>(null);
    const [showUndoToast, setShowUndoToast] = useState(false);
    const [numpadConfig, setNumpadConfig] = useState<NumpadConfig>(CLOSED_NUMPAD);

    const saveCurrentNumpadValue = useCallback((config: NumpadConfig, currentMeasurements: UIMeasurement[]) => {
        const { measurementId, field, currentValue } = config;

        if (measurementId === null || field === null) {
            return currentMeasurements;
        }

        let finalValue: string | number;
        if (field === 'quantidade') {
            finalValue = parseInt(String(currentValue), 10) || 1;
        } else {
            finalValue = (String(currentValue) === '' || String(currentValue) === '.') ? '0' : String(currentValue).replace('.', ',');
        }

        return currentMeasurements.map(measurement =>
            measurement.id === measurementId ? { ...measurement, [field]: finalValue } : measurement
        );
    }, []);

    const handleNumpadClose = useCallback(() => {
        setNumpadConfig(prev => {
            const updatedMeasurements = saveCurrentNumpadValue(prev, measurements);
            handleMeasurementsChange(updatedMeasurements);
            return CLOSED_NUMPAD;
        });
    }, [measurements, handleMeasurementsChange, saveCurrentNumpadValue]);

    const handleOpenNumpad = useCallback((measurementId: number, field: 'largura' | 'altura' | 'quantidade', currentValue: string | number) => {
        setNumpadConfig(prev => {
            const isSameButton = prev.isOpen && prev.measurementId === measurementId && prev.field === field;

            if (prev.isOpen && (prev.measurementId !== measurementId || prev.field !== field)) {
                const updatedMeasurements = saveCurrentNumpadValue(prev, measurements);
                handleMeasurementsChange(updatedMeasurements);
            }

            if (isSameButton) {
                return {
                    ...prev,
                    shouldClearOnNextInput: false
                };
            }

            return {
                isOpen: true,
                measurementId,
                field,
                currentValue: String(currentValue).replace(',', '.'),
                shouldClearOnNextInput: true
            };
        });
    }, [measurements, handleMeasurementsChange, saveCurrentNumpadValue]);

    const handleNumpadDone = useCallback(() => {
        const { measurementId, field, currentValue } = numpadConfig;
        if (measurementId === null || field === null) return;

        let finalValue: string | number;
        if (field === 'quantidade') {
            finalValue = parseInt(String(currentValue), 10) || 1;
        } else {
            finalValue = (String(currentValue) === '' || String(currentValue) === '.') ? '0' : String(currentValue).replace('.', ',');
        }

        const updatedMeasurements = measurements.map(measurement =>
            measurement.id === measurementId ? { ...measurement, [field]: finalValue } : measurement
        );
        handleMeasurementsChange(updatedMeasurements);

        const fieldSequence: Array<'largura' | 'altura' | 'quantidade'> = ['largura', 'altura', 'quantidade'];
        const currentIndex = fieldSequence.indexOf(field);
        const nextIndex = currentIndex + 1;

        if (nextIndex < fieldSequence.length) {
            const nextField = fieldSequence[nextIndex];
            const currentMeasurement = updatedMeasurements.find(measurement => measurement.id === measurementId);
            const nextValue = currentMeasurement ? currentMeasurement[nextField] : '';

            setNumpadConfig({
                isOpen: true,
                measurementId,
                field: nextField,
                currentValue: String(nextValue).replace(',', '.'),
                shouldClearOnNextInput: true
            });
            return;
        }

        setNumpadConfig(CLOSED_NUMPAD);
    }, [numpadConfig, measurements, handleMeasurementsChange]);

    const handleNumpadInput = useCallback((value: string) => {
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
                const measurementsWithSavedValue = measurements.map(measurement =>
                    measurement.id === prev.measurementId ? { ...measurement, [prev.field!]: finalValue } : measurement
                );
                handleMeasurementsChange(measurementsWithSavedValue);

                const fieldSequence: Array<'largura' | 'altura' | 'quantidade'> = ['largura', 'altura', 'quantidade'];
                const currentIndex = fieldSequence.indexOf(prev.field!);
                const nextIndex = currentIndex + 1;

                if (nextIndex < fieldSequence.length) {
                    const nextField = fieldSequence[nextIndex];
                    const currentMeasurement = measurementsWithSavedValue.find(measurement => measurement.id === prev.measurementId);
                    const nextValueForField = currentMeasurement ? currentMeasurement[nextField] : '';

                    return {
                        isOpen: true,
                        measurementId: prev.measurementId,
                        field: nextField,
                        currentValue: String(nextValueForField).replace(',', '.'),
                        shouldClearOnNextInput: true
                    };
                }

                return CLOSED_NUMPAD;
            }

            return { ...prev, currentValue: newValue, shouldClearOnNextInput: false };
        });
    }, [measurements, handleMeasurementsChange]);

    const handleNumpadDelete = useCallback(() => {
        setNumpadConfig(prev => ({
            ...prev,
            currentValue: prev.currentValue.slice(0, -1),
            shouldClearOnNextInput: false
        }));
    }, []);

    const handleNumpadDuplicate = useCallback(() => {
        const { measurementId, field, currentValue } = numpadConfig;
        if (measurementId === null || field === null) return;

        let finalValue: string | number;
        if (field === 'quantidade') {
            finalValue = parseInt(String(currentValue), 10) || 1;
        } else {
            finalValue = (String(currentValue) === '' || String(currentValue) === '.') ? '0' : String(currentValue).replace('.', ',');
        }

        const measurementsWithSavedValue = measurements.map(measurement =>
            measurement.id === measurementId ? { ...measurement, [field]: finalValue } : measurement
        );
        const measurementToDuplicate = measurementsWithSavedValue.find(measurement => measurement.id === measurementId);

        if (!measurementToDuplicate) {
            return;
        }

        const newMeasurement: UIMeasurement = {
            ...measurementToDuplicate,
            id: Date.now(),
            isNew: false
        };

        const index = measurementsWithSavedValue.findIndex(measurement => measurement.id === measurementId);
        const finalMeasurements = [...measurementsWithSavedValue];
        finalMeasurements.splice(index + 1, 0, newMeasurement);

        handleMeasurementsChange(finalMeasurements.map(measurement =>
            measurement.id === newMeasurement.id ? measurement : { ...measurement, isNew: false }
        ));
        setNumpadConfig(CLOSED_NUMPAD);
    }, [numpadConfig, measurements, handleMeasurementsChange]);

    const handleNumpadClear = useCallback(() => {
        const { measurementId, field } = numpadConfig;
        if (measurementId === null) return;

        const updatedMeasurements = measurements.map(measurement =>
            measurement.id === measurementId ? { ...measurement, largura: '', altura: '', quantidade: 1 } : measurement
        );
        handleMeasurementsChange(updatedMeasurements);

        setNumpadConfig(prev => ({
            ...prev,
            currentValue: field === 'quantidade' ? '1' : '',
            shouldClearOnNextInput: true
        }));
    }, [numpadConfig, measurements, handleMeasurementsChange]);

    const handleNumpadAddGroup = useCallback(() => {
        const updatedMeasurements = saveCurrentNumpadValue(numpadConfig, measurements);
        const newMeasurement: UIMeasurement = { ...createEmptyMeasurement(), isNew: true };
        const finalMeasurements = [
            ...updatedMeasurements.map(measurement => ({ ...measurement, isNew: false })),
            newMeasurement
        ];

        handleMeasurementsChange(finalMeasurements);
        setNumpadConfig(CLOSED_NUMPAD);
    }, [numpadConfig, measurements, createEmptyMeasurement, handleMeasurementsChange, saveCurrentNumpadValue]);

    const handleOpenEditMeasurementModal = useCallback((measurement: UIMeasurement) => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setEditingMeasurement(measurement);
    }, [numpadConfig.isOpen, handleNumpadClose]);

    const handleCloseEditMeasurementModal = useCallback(() => {
        setEditingMeasurement(null);
    }, []);

    const handleUpdateEditingMeasurement = useCallback((updatedData: Partial<Measurement>) => {
        if (!editingMeasurement) return;

        const updatedMeasurement = { ...editingMeasurement, ...updatedData };
        setEditingMeasurement(updatedMeasurement);

        const newMeasurements = measurements.map(measurement =>
            measurement.id === updatedMeasurement.id ? updatedMeasurement : measurement
        );
        handleMeasurementsChange(newMeasurements);
    }, [editingMeasurement, measurements, handleMeasurementsChange]);

    const handleRequestDeleteMeasurement = useCallback((measurementId: number) => {
        handleCloseEditMeasurementModal();
        setMeasurementToDeleteId(measurementId);
    }, [handleCloseEditMeasurementModal]);

    const handleConfirmDeleteIndividualMeasurement = useCallback(() => {
        if (measurementToDeleteId === null) return;

        handleMeasurementsChange(measurements.filter(measurement => measurement.id !== measurementToDeleteId));
        setMeasurementToDeleteId(null);
    }, [measurementToDeleteId, measurements, handleMeasurementsChange]);

    const handleDeleteMeasurementFromEditModal = useCallback(() => {
        if (editingMeasurement) {
            handleRequestDeleteMeasurement(editingMeasurement.id);
        }
    }, [editingMeasurement, handleRequestDeleteMeasurement]);

    const handleDeleteMeasurementFromGroup = useCallback((measurementId: number) => {
        handleRequestDeleteMeasurement(measurementId);
    }, [handleRequestDeleteMeasurement]);

    const handleImmediateDeleteMeasurement = useCallback((measurementId: number) => {
        const measurementIndex = measurements.findIndex(measurement => measurement.id === measurementId);
        const measurement = measurements[measurementIndex];

        if (!measurement || measurementIndex === -1) {
            return;
        }

        setDeletedMeasurement(measurement);
        setDeletedMeasurementIndex(measurementIndex);
        setShowUndoToast(true);
        handleMeasurementsChange(measurements.filter(item => item.id !== measurementId));
    }, [measurements, handleMeasurementsChange]);

    const handleUndoDelete = useCallback(() => {
        if (!deletedMeasurement || deletedMeasurementIndex === null) {
            return;
        }

        const newMeasurements = [...measurements];
        newMeasurements.splice(deletedMeasurementIndex, 0, deletedMeasurement);
        handleMeasurementsChange(newMeasurements);
        setDeletedMeasurement(null);
        setDeletedMeasurementIndex(null);
        setShowUndoToast(false);
    }, [deletedMeasurement, deletedMeasurementIndex, measurements, handleMeasurementsChange]);

    const handleDismissUndo = useCallback(() => {
        setDeletedMeasurement(null);
        setDeletedMeasurementIndex(null);
        setShowUndoToast(false);
    }, []);

    const handleOpenDiscountModal = useCallback((measurement: UIMeasurement, basePrice: number = 0) => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setEditingMeasurementForDiscount(measurement);
        setEditingMeasurementBasePrice(basePrice);
    }, [numpadConfig.isOpen, handleNumpadClose]);

    const handleCloseDiscountModal = useCallback(() => {
        setEditingMeasurementForDiscount(null);
        setEditingMeasurementBasePrice(0);
    }, []);

    const handleSaveDiscount = useCallback((discount: { value: string; type: 'percentage' | 'fixed' }) => {
        if (!editingMeasurementForDiscount) return;

        const updatedMeasurements = measurements.map(measurement =>
            measurement.id === editingMeasurementForDiscount.id ? { ...measurement, discount } : measurement
        );
        handleMeasurementsChange(updatedMeasurements);
        handleCloseDiscountModal();
    }, [editingMeasurementForDiscount, measurements, handleMeasurementsChange, handleCloseDiscountModal]);

    return {
        numpadConfig,
        editingMeasurement,
        setEditingMeasurement,
        editingMeasurementForDiscount,
        editingMeasurementBasePrice,
        measurementToDeleteId,
        setMeasurementToDeleteId,
        deletedMeasurement,
        showUndoToast,
        handleOpenNumpad,
        handleNumpadClose,
        handleNumpadDone,
        handleNumpadInput,
        handleNumpadDelete,
        handleNumpadDuplicate,
        handleNumpadClear,
        handleNumpadAddGroup,
        handleOpenEditMeasurementModal,
        handleCloseEditMeasurementModal,
        handleUpdateEditingMeasurement,
        handleRequestDeleteMeasurement,
        handleConfirmDeleteIndividualMeasurement,
        handleDeleteMeasurementFromEditModal,
        handleDeleteMeasurementFromGroup,
        handleImmediateDeleteMeasurement,
        handleUndoDelete,
        handleDismissUndo,
        handleOpenDiscountModal,
        handleCloseDiscountModal,
        handleSaveDiscount
    };
}
