import { useCallback, useSyncExternalStore } from 'react';

export type NumpadField = 'largura' | 'altura' | 'quantidade';

export type NumpadDraftSnapshot = {
    isOpen: boolean;
    measurementId: number | null;
    field: NumpadField | null;
    currentValue: string;
    shouldClearOnNextInput: boolean;
};

export const CLOSED_NUMPAD_DRAFT: NumpadDraftSnapshot = Object.freeze({
    isOpen: false,
    measurementId: null,
    field: null,
    currentValue: '',
    shouldClearOnNextInput: false
});

let activeDraft: NumpadDraftSnapshot = CLOSED_NUMPAD_DRAFT;
const listenersByMeasurement = new Map<number, Set<() => void>>();

const notifyMeasurement = (measurementId: number | null) => {
    if (measurementId === null) return;
    listenersByMeasurement.get(measurementId)?.forEach(listener => listener());
};

export const getActiveNumpadDraft = () => activeDraft;

export const setActiveNumpadDraft = (nextDraft: NumpadDraftSnapshot) => {
    if (Object.is(activeDraft, nextDraft)) return;

    const previousMeasurementId = activeDraft.measurementId;
    activeDraft = nextDraft;
    notifyMeasurement(previousMeasurementId);

    if (nextDraft.measurementId !== previousMeasurementId) {
        notifyMeasurement(nextDraft.measurementId);
    }
};

export const updateActiveNumpadDraft = (
    updater: (currentDraft: NumpadDraftSnapshot) => NumpadDraftSnapshot
) => {
    setActiveNumpadDraft(updater(activeDraft));
};

export const closeActiveNumpadDraft = () => {
    setActiveNumpadDraft(CLOSED_NUMPAD_DRAFT);
};

const subscribeToMeasurementDraft = (measurementId: number, listener: () => void) => {
    const listeners = listenersByMeasurement.get(measurementId) || new Set<() => void>();
    listeners.add(listener);
    listenersByMeasurement.set(measurementId, listeners);

    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            listenersByMeasurement.delete(measurementId);
        }
    };
};

const getDraftForMeasurement = (measurementId: number) => (
    activeDraft.isOpen && activeDraft.measurementId === measurementId
        ? activeDraft
        : CLOSED_NUMPAD_DRAFT
);

export const useNumpadDraft = (measurementId: number) => {
    const subscribe = useCallback(
        (listener: () => void) => subscribeToMeasurementDraft(measurementId, listener),
        [measurementId]
    );
    const getSnapshot = useCallback(
        () => getDraftForMeasurement(measurementId),
        [measurementId]
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
