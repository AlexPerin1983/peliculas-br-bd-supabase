import { useCallback, useEffect, useState } from 'react';
import {
    MEASUREMENT_INPUT_MODE_EVENT,
    readMeasurementInputMode,
    saveMeasurementInputMode,
    type MeasurementInputMode,
} from '../lib/measurementInputMode';

export const useMeasurementInputMode = () => {
    const [mode, setModeState] = useState<MeasurementInputMode>(readMeasurementInputMode);

    useEffect(() => {
        const handleModeChange = (event: Event) => {
            const nextMode = (event as CustomEvent<MeasurementInputMode>).detail;
            setModeState(nextMode === 'centimeters' ? 'centimeters' : 'meters');
        };
        const handleStorage = () => setModeState(readMeasurementInputMode());

        window.addEventListener(MEASUREMENT_INPUT_MODE_EVENT, handleModeChange);
        window.addEventListener('storage', handleStorage);
        return () => {
            window.removeEventListener(MEASUREMENT_INPUT_MODE_EVENT, handleModeChange);
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    const setMode = useCallback((nextMode: MeasurementInputMode) => {
        setModeState(nextMode);
        saveMeasurementInputMode(nextMode);
    }, []);

    return { mode, setMode };
};
