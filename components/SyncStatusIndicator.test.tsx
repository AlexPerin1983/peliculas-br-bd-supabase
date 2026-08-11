import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SyncStatusIndicator from './SyncStatusIndicator';
import { subscribeSyncStatus, forcSync, type SyncStatus } from '../services/syncService';

vi.mock('../services/syncService', () => ({
  subscribeSyncStatus: vi.fn(),
  forcSync: vi.fn()
}));

const mockedSubscribeSyncStatus = vi.mocked(subscribeSyncStatus);
const mockedForcSync = vi.mocked(forcSync);

describe('SyncStatusIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildStatus(status: Partial<SyncStatus> = {}): SyncStatus {
    return {
      isOnline: true,
      pendingCount: 0,
      failedCount: 0,
      failedItems: [],
      lastSyncAt: null,
      syncInProgress: false,
      error: null,
      ...status
    };
  }

  it('nao renderiza quando esta online e sem pendencias', () => {
    mockedSubscribeSyncStatus.mockImplementation(listener => {
      listener(buildStatus());
      return vi.fn();
    });

    const { container } = render(<SyncStatusIndicator />);

    expect(container.firstChild).toBeNull();
  });

  it('renderiza detalhes de erro e permite sincronizar novamente', async () => {
    mockedSubscribeSyncStatus.mockImplementation(listener => {
      listener(buildStatus({
        failedCount: 1,
        failedItems: [
          {
            id: 1,
            table: 'clients',
            action: 'update',
            retryCount: 2,
            lastError: 'Falha de rede',
            lastAttemptAt: Date.now()
          }
        ]
      }));
      return vi.fn();
    });

    render(<SyncStatusIndicator />);

    fireEvent.click(screen.getByRole('button', { name: /salvo no celular/i }));

    expect(screen.getByText('Conexão')).toBeInTheDocument();
    expect(screen.getByText(/clientes.*aguardando conexão/i)).toBeInTheDocument();
    expect(screen.getByText(/conexão instável com o servidor/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));

    await waitFor(() => {
      expect(mockedForcSync).toHaveBeenCalled();
    });
  });

  it('traduz Failed to fetch e informa que o PDF continua salvo no celular', () => {
    mockedSubscribeSyncStatus.mockImplementation(listener => {
      listener(buildStatus({
        failedCount: 1,
        error: 'savedPdfs: Failed to fetch',
        failedItems: [{
          id: 9,
          table: 'savedPdfs',
          action: 'create',
          retryCount: 1,
          lastError: 'savedPdfs: Failed to fetch',
          lastAttemptAt: Date.now()
        }]
      }));
      return vi.fn();
    });

    render(<SyncStatusIndicator />);
    fireEvent.click(screen.getByRole('button', { name: /salvo no celular/i }));

    expect(screen.getByText(/pdfs.*aguardando conexão/i)).toBeInTheDocument();
    expect(screen.getAllByText(/seus dados estão salvos neste celular/i)).toHaveLength(2);
  });

  it('traduz erros técnicos de película e oculta o número de tentativas', () => {
    mockedSubscribeSyncStatus.mockImplementation(listener => {
      listener(buildStatus({
        failedCount: 1,
        error: 'films: numeric field overflow',
        failedItems: [{
          id: 10,
          table: 'films',
          action: 'update',
          retryCount: 114,
          lastError: 'films: numeric field overflow',
          lastAttemptAt: Date.now()
        }]
      }));
      return vi.fn();
    });

    render(<SyncStatusIndicator />);
    fireEvent.click(screen.getByRole('button', { name: /1 ajuste/i }));

    expect(screen.getByText(/películas.*precisa de revisão/i)).toBeInTheDocument();
    expect(screen.getAllByText(/valor numérico inválido/i)).toHaveLength(2);
    expect(screen.queryByText(/numeric field overflow/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tentativa 114/i)).not.toBeInTheDocument();
  });

  it('traduz erro de permissão das configurações sem expor termos do banco', () => {
    mockedSubscribeSyncStatus.mockImplementation(listener => {
      listener(buildStatus({
        failedCount: 1,
        failedItems: [{
          id: 11,
          table: 'userInfo',
          action: 'update',
          retryCount: 29,
          lastError: 'userInfo: new row violates row-level security policy for table user_info',
          lastAttemptAt: Date.now()
        }]
      }));
      return vi.fn();
    });

    render(<SyncStatusIndicator />);
    fireEvent.click(screen.getByRole('button', { name: /1 ajuste/i }));

    expect(screen.getByText(/configurações.*precisa de revisão/i)).toBeInTheDocument();
    expect(screen.getByText(/não foi possível salvar as configurações/i)).toBeInTheDocument();
    expect(screen.queryByText(/row-level security/i)).not.toBeInTheDocument();
  });

  it('mostra estado offline e nao exibe botao de sincronizacao', () => {
    mockedSubscribeSyncStatus.mockImplementation(listener => {
      listener(buildStatus({
        isOnline: false,
        pendingCount: 2
      }));
      return vi.fn();
    });

    render(<SyncStatusIndicator />);

    fireEvent.click(screen.getByRole('button', { name: /offline/i }));

    expect(screen.getAllByText('Offline')[0]).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sincronizar agora/i })).not.toBeInTheDocument();
  });

  it('mostra estado de sincronizacao em andamento com botao desabilitado', () => {
    mockedSubscribeSyncStatus.mockImplementation(listener => {
      listener(buildStatus({
        syncInProgress: true,
        pendingCount: 3
      }));
      return vi.fn();
    });

    render(<SyncStatusIndicator />);

    fireEvent.click(screen.getByRole('button', { name: /sincronizando/i }));

    const syncButtons = screen.getAllByRole('button', { name: /sincronizando/i });
    expect(syncButtons[1]).toBeDisabled();
  });
});
