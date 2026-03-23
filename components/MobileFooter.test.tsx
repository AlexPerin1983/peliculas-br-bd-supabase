import { fireEvent, render, screen } from '@testing-library/react';
import MobileFooter from './MobileFooter';

vi.mock('./ui/TotalsDrawer', () => ({
  TotalsDrawer: ({
    isOpen,
    onClose
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) => (isOpen ? <button onClick={onClose}>Fechar Totais</button> : null)
}));

describe('MobileFooter', () => {
  const baseProps = {
    totals: {
      totalM2: 10,
      subtotal: 1000,
      totalItemDiscount: 50,
      generalDiscountAmount: 25,
      finalTotal: 925
    },
    generalDiscount: { value: '10', type: 'percentage' as const },
    onOpenGeneralDiscountModal: vi.fn(),
    onUpdateGeneralDiscount: vi.fn(),
    onAddMeasurement: vi.fn(),
    onDuplicateMeasurements: vi.fn(),
    onGeneratePdf: vi.fn(),
    isGeneratingPdf: false,
    onOpenAIModal: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispara as acoes principais do rodape mobile', () => {
    render(<MobileFooter {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'IA' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Nova Medida' }));
    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));

    expect(baseProps.onOpenAIModal).toHaveBeenCalled();
    expect(baseProps.onDuplicateMeasurements).toHaveBeenCalled();
    expect(baseProps.onAddMeasurement).toHaveBeenCalled();
    expect(baseProps.onGeneratePdf).toHaveBeenCalled();
  });

  it('abre o drawer de totais', () => {
    render(<MobileFooter {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Totais' }));

    expect(screen.getByRole('button', { name: 'Fechar Totais' })).toBeInTheDocument();
  });
});
