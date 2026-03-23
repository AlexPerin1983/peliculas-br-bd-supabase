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

    fireEvent.click(screen.getByRole('button', { name: /1 erro/i }));

    expect(screen.getByText('Conexao')).toBeInTheDocument();
    expect(screen.getByText(/clients.*update.*tentativa 2/i)).toBeInTheDocument();
    expect(screen.getByText('Falha de rede')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /sincronizar agora/i }));

    await waitFor(() => {
      expect(mockedForcSync).toHaveBeenCalled();
    });
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
