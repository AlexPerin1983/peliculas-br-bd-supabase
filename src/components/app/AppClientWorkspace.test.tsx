import { fireEvent, render, screen } from '@testing-library/react';
import { AppClientWorkspace } from './AppClientWorkspace';

vi.mock('../../../components/ClientBar', () => ({
  default: ({ onAddClient }: { onAddClient: () => void }) => (
    <button onClick={onAddClient}>ClientBar Add</button>
  )
}));

vi.mock('../../../components/ProposalOptionsCarousel', () => ({
  default: ({ onAddOption }: { onAddOption: () => void }) => (
    <button onClick={onAddOption}>Add Option</button>
  )
}));

vi.mock('../../../components/SummaryBar', () => ({
  default: () => <div>SummaryBar</div>
}));

vi.mock('../../../components/ActionsBar', () => ({
  default: ({
    onAddMeasurement,
    onDuplicateMeasurements,
    onGeneratePdf
  }: {
    onAddMeasurement: () => void;
    onDuplicateMeasurements: () => void;
    onGeneratePdf: () => void;
  }) => (
    <div>
      <button onClick={onAddMeasurement}>Desktop Add</button>
      <button onClick={onDuplicateMeasurements}>Desktop Duplicate</button>
      <button onClick={onGeneratePdf}>Desktop PDF</button>
    </div>
  )
}));

vi.mock('../../../components/CuttingOptimizationPanel', () => ({
  default: () => <div>CuttingOptimizationPanel</div>
}));

vi.mock('../../../components/MobileFooter', () => ({
  default: ({
    onAddMeasurement,
    onDuplicateMeasurements,
    onGeneratePdf
  }: {
    onAddMeasurement: () => void;
    onDuplicateMeasurements: () => void;
    onGeneratePdf: () => void;
  }) => (
    <div>
      <button onClick={onAddMeasurement}>Mobile Add</button>
      <button onClick={onDuplicateMeasurements}>Mobile Duplicate</button>
      <button onClick={onGeneratePdf}>Mobile PDF</button>
    </div>
  )
}));

describe('AppClientWorkspace', () => {
  const baseProps = {
    clientsCount: 1,
    selectedClient: { id: 1, nome: 'Cliente' } as any,
    clientTransitionKey: 1,
    proposalOptions: [{ id: 10, name: 'Opcao 1' }] as any,
    activeOptionId: 10,
    selectedClientId: 1,
    measurements: [{ id: 99 }] as any,
    films: [],
    totals: {
      totalM2: 5,
      subtotal: 100,
      totalItemDiscount: 0,
      generalDiscountAmount: 0,
      finalTotal: 100,
      totalQuantity: 2
    },
    generalDiscount: { value: '0', type: 'percentage' as const },
    content: <div>Workspace Content</div>,
    isGeneratingPdf: false,
    onSelectClientClick: vi.fn(),
    onAddClient: vi.fn(),
    onAddClientAI: vi.fn(),
    onEditClient: vi.fn(),
    onDeleteClient: vi.fn(),
    onSwipeLeft: vi.fn(),
    onSwipeRight: vi.fn(),
    onSelectOption: vi.fn(),
    onRenameOption: vi.fn(),
    onDeleteOption: vi.fn(),
    onAddOption: vi.fn(),
    onSwipeDirectionChange: vi.fn(),
    onOpenGeneralDiscountModal: vi.fn(),
    onUpdateGeneralDiscount: vi.fn(),
    onAddMeasurement: vi.fn(),
    onDuplicateMeasurements: vi.fn(),
    onGeneratePdf: vi.fn(),
    onOpenAIModal: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra apenas o conteudo quando nao ha clientes', () => {
    render(
      <AppClientWorkspace
        {...baseProps}
        clientsCount={0}
        selectedClient={null}
        selectedClientId={null}
        measurements={[]}
      />
    );

    expect(screen.getByText('Workspace Content')).toBeInTheDocument();
    expect(screen.queryByText('ClientBar Add')).not.toBeInTheDocument();
  });

  it('conecta as acoes principais do workspace', () => {
    render(<AppClientWorkspace {...baseProps} />);

    fireEvent.click(screen.getByText('ClientBar Add'));
    fireEvent.click(screen.getByText('Add Option'));
    fireEvent.click(screen.getByText('Desktop Add'));
    fireEvent.click(screen.getByText('Desktop Duplicate'));
    fireEvent.click(screen.getByText('Desktop PDF'));
    fireEvent.click(screen.getByText('Mobile Add'));
    fireEvent.click(screen.getByText('Mobile Duplicate'));
    fireEvent.click(screen.getByText('Mobile PDF'));

    expect(baseProps.onAddClient).toHaveBeenCalled();
    expect(baseProps.onAddOption).toHaveBeenCalled();
    expect(baseProps.onAddMeasurement).toHaveBeenCalledTimes(2);
    expect(baseProps.onDuplicateMeasurements).toHaveBeenCalledTimes(2);
    expect(baseProps.onGeneratePdf).toHaveBeenCalledTimes(2);
    expect(screen.getByText('CuttingOptimizationPanel')).toBeInTheDocument();
  });
});
