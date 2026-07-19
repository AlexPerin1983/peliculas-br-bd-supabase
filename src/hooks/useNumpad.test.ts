import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Measurement } from '../../types';
import { useNumpad } from './useNumpad';

const measurement: Measurement = {
    id: 1,
    largura: '',
    altura: '',
    quantidade: 1,
    ambiente: '',
    tipoAplicacao: '',
    pelicula: '',
    active: true,
};

describe('useNumpad', () => {
    it('mantém o campo ativo até a confirmação explícita', () => {
        const onMeasurementsChange = vi.fn();
        const { result, rerender } = renderHook(
            ({ measurements }) => useNumpad(measurements, onMeasurementsChange),
            { initialProps: { measurements: [measurement] } },
        );

        act(() => result.current.openNumpad(1, 'largura', ''));
        act(() => {
            result.current.handleInput('1');
            result.current.handleInput(',');
            result.current.handleInput('2');
            result.current.handleInput('0');
        });

        expect(result.current.numpadConfig.field).toBe('largura');
        expect(result.current.numpadConfig.currentValue).toBe('1.20');
        expect(onMeasurementsChange).not.toHaveBeenCalled();

        act(() => result.current.handleDone());

        expect(onMeasurementsChange).toHaveBeenLastCalledWith([
            expect.objectContaining({ id: 1, largura: '1,20' }),
        ]);
        expect(result.current.numpadConfig.field).toBe('altura');

        const measurementsWithWidth = [{ ...measurement, largura: '1,20' }];
        rerender({ measurements: measurementsWithWidth });
        act(() => {
            result.current.handleInput('1');
            result.current.handleInput(',');
            result.current.handleInput('0');
            result.current.handleInput('0');
        });

        expect(result.current.numpadConfig.field).toBe('altura');
        expect(result.current.numpadConfig.currentValue).toBe('1.00');
    });
});
