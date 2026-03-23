import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useMeasurementEditor } from './useMeasurementEditor';
import { UIMeasurement } from '../../types';

describe('useMeasurementEditor', () => {
  const measurement: UIMeasurement = {
    id: 1,
    largura: '',
    altura: '0,50',
    quantidade: 1,
    ambiente: 'Sala',
    tipoAplicacao: 'Interna',
    pelicula: 'Blackout',
    active: true,
    discount: { value: '0', type: 'percentage' }
  };

  const createEmptyMeasurement = () => ({
    id: 999,
    largura: '',
    altura: '',
    quantidade: 1,
    ambiente: 'Novo',
    tipoAplicacao: 'Interna',
    pelicula: 'Blackout',
    active: true,
    discount: { value: '0', type: 'percentage' as const }
  });

  it('salva largura completa e avanca automaticamente para altura', () => {
    const handleMeasurementsChange = vi.fn();

    const { result } = renderHook(() =>
      useMeasurementEditor({
        measurements: [measurement],
        handleMeasurementsChange,
        createEmptyMeasurement
      })
    );

    act(() => {
      result.current.handleOpenNumpad(1, 'largura', '');
      result.current.handleNumpadInput('1');
      result.current.handleNumpadInput(',');
      result.current.handleNumpadInput('2');
      result.current.handleNumpadInput('3');
    });

    expect(handleMeasurementsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, largura: '1,23' })
    ]);
    expect(result.current.numpadConfig.field).toBe('altura');
  });

  it('conclui quantidade e fecha o numpad', () => {
    const handleMeasurementsChange = vi.fn();

    const { result } = renderHook(() =>
      useMeasurementEditor({
        measurements: [{ ...measurement, quantidade: 1 }],
        handleMeasurementsChange,
        createEmptyMeasurement
      })
    );

    act(() => {
      result.current.handleOpenNumpad(1, 'quantidade', 1);
    });

    act(() => {
      result.current.handleNumpadInput('3');
    });

    act(() => {
      result.current.handleNumpadDone();
    });

    expect(handleMeasurementsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, quantidade: 3 })
    ]);
    expect(result.current.numpadConfig.isOpen).toBe(false);
  });

  it('duplica a medida atual a partir do numpad', () => {
    const handleMeasurementsChange = vi.fn();
    vi.spyOn(Date, 'now').mockReturnValue(5000);

    const { result } = renderHook(() =>
      useMeasurementEditor({
        measurements: [{ ...measurement, altura: '1,20' }],
        handleMeasurementsChange,
        createEmptyMeasurement
      })
    );

    act(() => {
      result.current.handleOpenNumpad(1, 'altura', '1,20');
    });

    act(() => {
      result.current.handleNumpadDuplicate();
    });

    expect(handleMeasurementsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, isNew: false }),
      expect.objectContaining({ id: 5000, altura: '1,20', isNew: false })
    ]);
    expect(result.current.numpadConfig.isOpen).toBe(false);
  });

  it('remove uma medida e permite desfazer apos rerender do estado externo', () => {
    const handleMeasurementsChange = vi.fn();
    const measurements = [
      measurement,
      { ...measurement, id: 2, ambiente: 'Quarto' }
    ];

    const { result, rerender } = renderHook(
      ({ currentMeasurements }) =>
        useMeasurementEditor({
          measurements: currentMeasurements,
          handleMeasurementsChange,
          createEmptyMeasurement
        }),
      {
        initialProps: { currentMeasurements: measurements }
      }
    );

    act(() => {
      result.current.handleImmediateDeleteMeasurement(1);
    });

    expect(handleMeasurementsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 2 })
    ]);
    expect(result.current.showUndoToast).toBe(true);

    rerender({
      currentMeasurements: [{ ...measurement, id: 2, ambiente: 'Quarto' }]
    });

    act(() => {
      result.current.handleUndoDelete();
    });

    expect(handleMeasurementsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 2 })
    ]);
    expect(result.current.showUndoToast).toBe(false);
  });

  it('salva desconto na medida em edicao', () => {
    const handleMeasurementsChange = vi.fn();

    const { result } = renderHook(() =>
      useMeasurementEditor({
        measurements: [measurement],
        handleMeasurementsChange,
        createEmptyMeasurement
      })
    );

    act(() => {
      result.current.handleOpenDiscountModal(measurement, 100);
    });

    act(() => {
      result.current.handleSaveDiscount({ value: '15', type: 'fixed' });
    });

    expect(handleMeasurementsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 1,
        discount: { value: '15', type: 'fixed' }
      })
    ]);
    expect(result.current.editingMeasurementForDiscount).toBe(null);
  });
});
