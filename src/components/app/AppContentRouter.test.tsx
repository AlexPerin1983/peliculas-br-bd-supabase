import { fireEvent, render, screen } from '@testing-library/react';
import { AppContentRouter } from './AppContentRouter';

vi.mock('../../../components/MeasurementList', () => ({
  default: () => <div>MeasurementList</div>
}));

vi.mock('../../../components/subscription/SubscriptionComponents', () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

describe('AppContentRouter', () => {
  const baseProps = {
    activeTab: 'client' as const,
    isLoading: false,
    userInfo: null,
    organizationId: undefined,
    isOwner: false,
    isInstalled: false,
    allSavedPdfs: [],
    clients: [],
    agendamentos: [],
    films: [],
    initialEstoqueAction: null,
    selectedClientId: null,
    measurements: [],
    activeOptionId: null,
    totals: { totalM2: 0, totalQuantity: 0 },
    numpadConfig: {
      isOpen: false,
      measurementId: null,
      field: null,
      value: '',
      position: { x: 0, y: 0 }
    },
    swipeDirection: null,
    swipeDistance: 0,
    clientLoadingView: <div>client loading</div>,
    estoqueLoadingView: <div>estoque loading</div>,
    defaultLoadingView: <div>default loading</div>,
    onSaveUserInfo: vi.fn(),
    onOpenPaymentMethods: vi.fn(),
    onOpenApiKeyModal: vi.fn(),
    onPromptPwaInstall: vi.fn(),
    onDeletePdf: vi.fn(),
    onDownloadPdf: vi.fn(),
    onUpdatePdfStatus: vi.fn(),
    onSchedulePdf: vi.fn(),
    onGenerateCombinedPdf: vi.fn(),
    onNavigateToOption: vi.fn(),
    onEditAgendamento: vi.fn(),
    onCreateNewAgendamento: vi.fn(),
    onAddFilm: vi.fn(),
    onEditFilm: vi.fn(),
    onDeleteFilm: vi.fn(),
    onOpenGallery: vi.fn(),
    onOpenClientModal: vi.fn(),
    onAddMeasurement: vi.fn(),
    onOpenLocationImport: vi.fn(),
    onMeasurementsChange: vi.fn(),
    onOpenFilmModal: vi.fn(),
    onOpenFilmSelectionModal: vi.fn(),
    onOpenClearAllModal: vi.fn(),
    onOpenApplyFilmToAllModal: vi.fn(),
    onOpenNumpad: vi.fn(),
    onOpenEditModal: vi.fn(),
    onOpenDiscountModal: vi.fn(),
    onDeleteMeasurement: vi.fn(),
    onDeleteMeasurementImmediate: vi.fn()
  };

  it('mostra estado vazio de clientes e permite abrir cadastro', () => {
    render(<AppContentRouter {...baseProps} />);

    expect(screen.getByText('Crie seu Primeiro Cliente')).toBeInTheDocument();
    expect(screen.getByText(/Tudo comeca com um cliente/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Adicionar Cliente/i }));

    expect(baseProps.onOpenClientModal).toHaveBeenCalledWith('add');
  });

  it('mostra estado vazio de medidas para cliente selecionado', () => {
    render(
      <AppContentRouter
        {...baseProps}
        clients={[{ id: 1, nome: 'Cliente' } as any]}
        selectedClientId={1}
      />
    );

    expect(screen.getByText('Nenhuma Medida Ainda')).toBeInTheDocument();
    expect(screen.getByText(/Adicione as dimensoes das janelas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar Medida/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buscar por Localizacao/i })).toBeInTheDocument();
  });
});
