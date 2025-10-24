import { useCallback } from 'react';
import { Measurement, Film } from '../../types';

type UIMeasurement = Measurement & { isNew?: boolean };

export const useMeasurements = (
    films: Film[],
    onMeasurementsChange: (measurements: UIMeasurement[]) => void
) => {
    const createEmptyMeasurement = useCallback((): Measurement => ({
        id: Date.now(),
        largura: '',
        altura: '',
        quantidade: 1,
        ambiente: 'Desconhecido',
        tipoAplicacao: 'Desconhecido',
        pelicula: films[0]?.nome || 'Nenhuma',
        active: true,
        discount: 0,
        discountType: 'percentage',
    }), [films]);

    const addMeasurement = useCallback((measurements: UIMeasurement[]) => {
        const newMeasurement: UIMeasurement = { ...createEmptyMeasurement(), isNew: true };
        const updatedMeasurements = [
            newMeasurement, 
            ...measurements.map(m => ({ ...m, isNew: false }))
        ];
        onMeasurementsChange(updatedMeasurements);
    }, [createEmptyMeasurement, onMeasurementsChange]);

    const duplicateMeasurement = useCallback((measurements: UIMeasurement[], measurementId: number) => {
        const measurementToDuplicate = measurements.find(m => m.id === measurementId);
        if (measurementToDuplicate) {
            const newMeasurement: UIMeasurement = { 
                ...measurementToDuplicate, 
                id: Date.now(), 
                isNew: false
            };
            const index = measurements.findIndex(m => m.id === measurementId);
            const newMeasurements = [...measurements];
            newMeasurements.splice(index + 1, 0, newMeasurement);
            onMeasurementsChange(newMeasurements);
        }
    }, [onMeasurementsChange]);

    return {
        createEmptyMeasurement,
        addMeasurement,
        duplicateMeasurement
    };
};