import { act, renderHook } from '@testing-library/react';
import {
    CLOSED_NUMPAD_DRAFT,
    closeActiveNumpadDraft,
    setActiveNumpadDraft,
    updateActiveNumpadDraft,
    useNumpadDraft
} from './useNumpadDraft';

describe('useNumpadDraft', () => {
    beforeEach(() => {
        closeActiveNumpadDraft();
    });

    it('notifica somente a medida que esta sendo digitada', () => {
        const firstMeasurement = renderHook(() => useNumpadDraft(1));
        const secondMeasurement = renderHook(() => useNumpadDraft(2));

        act(() => {
            setActiveNumpadDraft({
                isOpen: true,
                measurementId: 1,
                field: 'largura',
                currentValue: '',
                shouldClearOnNextInput: true
            });
            updateActiveNumpadDraft(current => ({
                ...current,
                currentValue: '1.52',
                shouldClearOnNextInput: false
            }));
        });

        expect(firstMeasurement.result.current.currentValue).toBe('1.52');
        expect(secondMeasurement.result.current).toBe(CLOSED_NUMPAD_DRAFT);
    });
});
