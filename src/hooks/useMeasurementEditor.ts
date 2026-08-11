import { useCallback, useEffect, useRef, useState } from 'react';
import { Measurement, UIMeasurement } from '../../types';
import { useMeasurementInputMode } from './useMeasurementInputMode';
import { formatCentimeterDigitsAsMeters, metersValueToCentimeterDigits } from '../lib/measurementInputMode';
import {
    CLOSED_NUMPAD_DRAFT,
    closeActiveNumpadDraft,
    getActiveNumpadDraft,
    NumpadDraftSnapshot,
    NumpadField,
    setActiveNumpadDraft,
    updateActiveNumpadDraft
} from './useNumpadDraft';

export type NumpadConfig = NumpadDraftSnapshot;

interface UseMeasurementEditorParams {
    measurements: UIMeasurement[];
    handleMeasurementsChange: (newMeasurements: UIMeasurement[]) => void;
    handleMeasurementsChangeWithPersistence?: (newMeasurements: UIMeasurement[]) => Promise<void>;
    createEmptyMeasurement: () => Measurement;
}

const CLOSED_NUMPAD = CLOSED_NUMPAD_DRAFT;

export function useMeasurementEditor({
    measurements,
    handleMeasurementsChange,
    handleMeasurementsChangeWithPersistence,
    createEmptyMeasurement
}: UseMeasurementEditorParams) {
    const { mode: measurementInputMode } = useMeasurementInputMode();
    const [editingMeasurement, setEditingMeasurement] = useState<UIMeasurement | null>(null);
    const [editingMeasurementForDiscount, setEditingMeasurementForDiscount] = useState<UIMeasurement | null>(null);
    const [editingMeasurementBasePrice, setEditingMeasurementBasePrice] = useState<number>(0);
    const [measurementToDeleteId, setMeasurementToDeleteId] = useState<number | null>(null);
    const [deletedMeasurement, setDeletedMeasurement] = useState<UIMeasurement | null>(null);
    const [deletedMeasurementIndex, setDeletedMeasurementIndex] = useState<number | null>(null);
    const [showUndoToast, setShowUndoToast] = useState(false);
    const [numpadConfig, setNumpadConfig] = useState<NumpadConfig>(CLOSED_NUMPAD);
    const measurementsRef = useRef(measurements);

    measurementsRef.current = measurements;

    useEffect(() => () => {
        closeActiveNumpadDraft();
    }, []);

    const applyMeasurements = useCallback(async (nextMeasurements: UIMeasurement[]) => {
        if (handleMeasurementsChangeWithPersistence) {
            await handleMeasurementsChangeWithPersistence(nextMeasurements);
            return;
        }

        handleMeasurementsChange(nextMeasurements);
    }, [handleMeasurementsChange, handleMeasurementsChangeWithPersistence]);

    const applyMeasurementsInBackground = useCallback((nextMeasurements: UIMeasurement[]) => {
        void applyMeasurements(nextMeasurements);
    }, [applyMeasurements]);

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
        const currentDraft = getActiveNumpadDraft();
        if (!currentDraft.isOpen) {
            setNumpadConfig(CLOSED_NUMPAD);
            return;
        }

        const updatedMeasurements = saveCurrentNumpadValue(currentDraft, measurementsRef.current);
        applyMeasurementsInBackground(updatedMeasurements);
        closeActiveNumpadDraft();
        setNumpadConfig(CLOSED_NUMPAD);
    }, [saveCurrentNumpadValue, applyMeasurementsInBackground]);

    const handleOpenNumpad = useCallback((measurementId: number, field: NumpadField, currentValue: string | number) => {
        const previousDraft = getActiveNumpadDraft();
        const isSameButton = previousDraft.isOpen
            && previousDraft.measurementId === measurementId
            && previousDraft.field === field;

        if (previousDraft.isOpen && !isSameButton) {
            const updatedMeasurements = saveCurrentNumpadValue(previousDraft, measurementsRef.current);
            applyMeasurementsInBackground(updatedMeasurements);
        }

        if (isSameButton) {
            updateActiveNumpadDraft(current => ({
                ...current,
                shouldClearOnNextInput: false
            }));
            return;
        }

        const nextDraft: NumpadConfig = {
            isOpen: true,
            measurementId,
            field,
            currentValue: String(currentValue).replace(',', '.'),
            shouldClearOnNextInput: true
        };

        setActiveNumpadDraft(nextDraft);
        setNumpadConfig(nextDraft);
    }, [saveCurrentNumpadValue, applyMeasurementsInBackground]);

    const handleNumpadDone = useCallback(() => {
        const currentDraft = getActiveNumpadDraft();
        const { measurementId, field, currentValue } = currentDraft;
        if (measurementId === null || field === null) return;

        let finalValue: string | number;
        if (field === 'quantidade') {
            finalValue = parseInt(String(currentValue), 10) || 1;
        } else {
            finalValue = (String(currentValue) === '' || String(currentValue) === '.') ? '0' : String(currentValue).replace('.', ',');
        }

        const updatedMeasurements = measurementsRef.current.map(measurement =>
            measurement.id === measurementId ? { ...measurement, [field]: finalValue } : measurement
        );
        applyMeasurementsInBackground(updatedMeasurements);

        const fieldSequence: NumpadField[] = ['largura', 'altura', 'quantidade'];
        const currentIndex = fieldSequence.indexOf(field);
        const nextIndex = currentIndex + 1;

        if (nextIndex < fieldSequence.length) {
            const nextField = fieldSequence[nextIndex];
            const currentMeasurement = updatedMeasurements.find(measurement => measurement.id === measurementId);
            const nextValue = currentMeasurement ? currentMeasurement[nextField] : '';

            const nextDraft: NumpadConfig = {
                isOpen: true,
                measurementId,
                field: nextField,
                currentValue: String(nextValue).replace(',', '.'),
                shouldClearOnNextInput: true
            };
            setActiveNumpadDraft(nextDraft);
            setNumpadConfig(nextDraft);
            return;
        }

        closeActiveNumpadDraft();
        setNumpadConfig(CLOSED_NUMPAD);
    }, [applyMeasurementsInBackground]);

    const handleNumpadInput = useCallback((value: string) => {
        const previousDraft = getActiveNumpadDraft();
        if (!previousDraft.isOpen) return;

        const getNextDraft = (prev: NumpadConfig) => {
            const shouldClear = prev.shouldClearOnNextInput;
            let newValue = prev.currentValue;
            const char = value === ',' ? '.' : value;
            const isWidthOrHeight = prev.field === 'largura' || prev.field === 'altura';

            if (isWidthOrHeight && measurementInputMode === 'centimeters') {
                // Neste modo cada tecla representa centimetros inteiros:
                // 1 -> 0,01 m; 15 -> 0,15 m; 152 -> 1,52 m.
                if (char === '.') return prev;
                const currentDigits = shouldClear ? '' : metersValueToCentimeterDigits(prev.currentValue);
                newValue = formatCentimeterDigitsAsMeters(`${currentDigits}${char}`);
                return { ...prev, currentValue: newValue, shouldClearOnNextInput: false };
            }

            if (char === '.') {
                if (prev.field !== 'quantidade') {
                    newValue = shouldClear ? '0.' : (newValue.includes('.') ? newValue : newValue + '.');
                }
            } else {
                newValue = shouldClear ? char : newValue + char;
            }

            const matchesPattern = /^\d\.\d{2}$/.test(newValue);

            if (isWidthOrHeight && matchesPattern) {
                const finalValue = newValue.replace('.', ',');
                const measurementsWithSavedValue = measurementsRef.current.map(measurement =>
                    measurement.id === prev.measurementId ? { ...measurement, [prev.field!]: finalValue } : measurement
                );
                applyMeasurementsInBackground(measurementsWithSavedValue);

                const fieldSequence: NumpadField[] = ['largura', 'altura', 'quantidade'];
                const currentIndex = fieldSequence.indexOf(prev.field!);
                const nextIndex = currentIndex + 1;

                if (nextIndex < fieldSequence.length) {
                    const nextField = fieldSequence[nextIndex];
                    const currentMeasurement = measurementsWithSavedValue.find(measurement => measurement.id === prev.measurementId);
                    const nextValueForField = currentMeasurement ? currentMeasurement[nextField] : '';

                    const nextDraft: NumpadConfig = {
                        isOpen: true,
                        measurementId: prev.measurementId,
                        field: nextField,
                        currentValue: String(nextValueForField).replace(',', '.'),
                        shouldClearOnNextInput: true
                    };
                    setActiveNumpadDraft(nextDraft);
                    setNumpadConfig(nextDraft);
                    return null;
                }

                closeActiveNumpadDraft();
                setNumpadConfig(CLOSED_NUMPAD);
                return null;
            }

            return { ...prev, currentValue: newValue, shouldClearOnNextInput: false };
        };

        const nextDraft = getNextDraft(previousDraft);
        if (nextDraft) {
            setActiveNumpadDraft(nextDraft);
        }
    }, [applyMeasurementsInBackground, measurementInputMode]);

    const handleNumpadDelete = useCallback(() => {
        updateActiveNumpadDraft(prev => {
            const isWidthOrHeight = prev.field === 'largura' || prev.field === 'altura';
            if (isWidthOrHeight && measurementInputMode === 'centimeters') {
                const currentDigits = metersValueToCentimeterDigits(prev.currentValue);
                return {
                    ...prev,
                    currentValue: formatCentimeterDigitsAsMeters(currentDigits.slice(0, -1)),
                    shouldClearOnNextInput: false
                };
            }

            return {
                ...prev,
                currentValue: prev.currentValue.slice(0, -1),
                shouldClearOnNextInput: false
            };
        });
    }, [measurementInputMode]);

    const handleNumpadDuplicate = useCallback(() => {
        const currentDraft = getActiveNumpadDraft();
        const { measurementId, field, currentValue } = currentDraft;
        if (measurementId === null || field === null) return;

        let finalValue: string | number;
        if (field === 'quantidade') {
            finalValue = parseInt(String(currentValue), 10) || 1;
        } else {
            finalValue = (String(currentValue) === '' || String(currentValue) === '.') ? '0' : String(currentValue).replace('.', ',');
        }

        const measurementsWithSavedValue = measurementsRef.current.map(measurement =>
            measurement.id === measurementId ? { ...measurement, [field]: finalValue } : measurement
        );
        const measurementToDuplicate = measurementsWithSavedValue.find(measurement => measurement.id === measurementId);

        if (!measurementToDuplicate) {
            return;
        }

        const newMeasurement: UIMeasurement = {
            ...measurementToDuplicate,
            id: Date.now(),
            isNew: false,
            // Copia da medida ainda nao foi aplicada na obra.
            aplicadoEm: undefined,
            aplicadoPecas: undefined
        };

        const index = measurementsWithSavedValue.findIndex(measurement => measurement.id === measurementId);
        const finalMeasurements = [...measurementsWithSavedValue];
        finalMeasurements.splice(index + 1, 0, newMeasurement);

        applyMeasurementsInBackground(finalMeasurements.map(measurement =>
            measurement.id === newMeasurement.id ? measurement : { ...measurement, isNew: false }
        ));
        closeActiveNumpadDraft();
        setNumpadConfig(CLOSED_NUMPAD);
    }, [applyMeasurementsInBackground]);

    const handleNumpadClear = useCallback(() => {
        const currentDraft = getActiveNumpadDraft();
        const { measurementId, field } = currentDraft;
        if (measurementId === null) return;

        const updatedMeasurements = measurementsRef.current.map(measurement =>
            measurement.id === measurementId ? { ...measurement, largura: '', altura: '', quantidade: 1 } : measurement
        );
        applyMeasurementsInBackground(updatedMeasurements);

        updateActiveNumpadDraft(prev => ({
            ...prev,
            currentValue: field === 'quantidade' ? '1' : '',
            shouldClearOnNextInput: true
        }));
    }, [applyMeasurementsInBackground]);

    const handleNumpadAddGroup = useCallback(() => {
        const updatedMeasurements = saveCurrentNumpadValue(getActiveNumpadDraft(), measurementsRef.current);
        const newMeasurement: UIMeasurement = { ...createEmptyMeasurement(), isNew: true };
        const finalMeasurements = [
            ...updatedMeasurements.map(measurement => ({ ...measurement, isNew: false })),
            newMeasurement
        ];

        applyMeasurementsInBackground(finalMeasurements);
        closeActiveNumpadDraft();
        setNumpadConfig(CLOSED_NUMPAD);
    }, [createEmptyMeasurement, saveCurrentNumpadValue, applyMeasurementsInBackground]);

    const handleOpenEditMeasurementModal = useCallback((measurement: UIMeasurement) => {
        if (getActiveNumpadDraft().isOpen) {
            handleNumpadClose();
        }
        setEditingMeasurement(measurement);
    }, [handleNumpadClose]);

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
        applyMeasurementsInBackground(newMeasurements);
    }, [editingMeasurement, measurements, applyMeasurementsInBackground]);

    const handleRequestDeleteMeasurement = useCallback((measurementId: number) => {
        handleCloseEditMeasurementModal();
        setMeasurementToDeleteId(measurementId);
    }, [handleCloseEditMeasurementModal]);

    const handleConfirmDeleteIndividualMeasurement = useCallback(async () => {
        if (measurementToDeleteId === null) return;

        await applyMeasurements(measurements.filter(measurement => measurement.id !== measurementToDeleteId));
        setMeasurementToDeleteId(null);
    }, [measurementToDeleteId, measurements, applyMeasurements]);

    const handleDeleteMeasurementFromEditModal = useCallback(() => {
        if (editingMeasurement) {
            handleRequestDeleteMeasurement(editingMeasurement.id);
        }
    }, [editingMeasurement, handleRequestDeleteMeasurement]);

    const handleDeleteMeasurementFromGroup = useCallback((measurementId: number) => {
        handleRequestDeleteMeasurement(measurementId);
    }, [handleRequestDeleteMeasurement]);

    const handleImmediateDeleteMeasurement = useCallback(async (measurementId: number) => {
        const measurementIndex = measurements.findIndex(measurement => measurement.id === measurementId);
        const measurement = measurements[measurementIndex];

        if (!measurement || measurementIndex === -1) {
            return;
        }

        setDeletedMeasurement(measurement);
        setDeletedMeasurementIndex(measurementIndex);
        setShowUndoToast(true);
        await applyMeasurements(measurements.filter(item => item.id !== measurementId));
    }, [measurements, applyMeasurements]);

    const handleUndoDelete = useCallback(async () => {
        if (!deletedMeasurement || deletedMeasurementIndex === null) {
            return;
        }

        const newMeasurements = [...measurements];
        newMeasurements.splice(deletedMeasurementIndex, 0, deletedMeasurement);
        await applyMeasurements(newMeasurements);
        setDeletedMeasurement(null);
        setDeletedMeasurementIndex(null);
        setShowUndoToast(false);
    }, [deletedMeasurement, deletedMeasurementIndex, measurements, applyMeasurements]);

    const handleDismissUndo = useCallback(() => {
        setDeletedMeasurement(null);
        setDeletedMeasurementIndex(null);
        setShowUndoToast(false);
    }, []);

    const handleOpenDiscountModal = useCallback((measurement: UIMeasurement, basePrice: number = 0) => {
        if (getActiveNumpadDraft().isOpen) {
            handleNumpadClose();
        }
        setEditingMeasurementForDiscount(measurement);
        setEditingMeasurementBasePrice(basePrice);
    }, [handleNumpadClose]);

    const handleCloseDiscountModal = useCallback(() => {
        setEditingMeasurementForDiscount(null);
        setEditingMeasurementBasePrice(0);
    }, []);

    const handleSaveDiscount = useCallback((discount: { value: string; type: 'percentage' | 'fixed' }) => {
        if (!editingMeasurementForDiscount) return;

        const updatedMeasurements = measurements.map(measurement =>
            measurement.id === editingMeasurementForDiscount.id ? { ...measurement, discount } : measurement
        );
        applyMeasurementsInBackground(updatedMeasurements);
        handleCloseDiscountModal();
    }, [editingMeasurementForDiscount, measurements, applyMeasurementsInBackground, handleCloseDiscountModal]);

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
