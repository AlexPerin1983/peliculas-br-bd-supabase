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

    fireEvent.click(screen.getByRole('button', { name: /salvo no aparelho/i }));

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
    fireEvent.click(screen.getByRole('button', { name: /salvo no aparelho/i }));

    expect(screen.getByText(/pdfs.*aguardando conexão/i)).toBeInTheDocument();
    expect(screen.getByText(/há alterações neste aparelho/i)).toBeInTheDocument();
    expect(screen.getByText(/o envio será tentado novamente automaticamente/i)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /1 não enviado/i }));

    expect(screen.getByText(/películas.*dado precisa de revisão/i)).toBeInTheDocument();
    expect(screen.getByText(/valor numérico inválido/i)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /1 não enviado/i }));

    expect(screen.getByText(/configurações.*sem permissão para salvar/i)).toBeInTheDocument();
    expect(screen.getByText(/conta não foi autorizada/i)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: /salvo no aparelho/i }));

    expect(screen.getByRole('button', { name: /salvo no aparelho/i })).toBeInTheDocument();
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

  it('copia somente o diagnostico seguro e nao envia dados de negocio', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    mockedSubscribeSyncStatus.mockImplementation(listener => {
      listener(buildStatus({
        failedCount: 1,
        error: 'Maria Segredo maria@segredo.test R$ 999,00 1,52 x 2,80',
        failedItems: [{
          id: 20,
          table: 'clients',
          action: 'update',
          retryCount: 1,
          lastError: 'Maria Segredo maria@segredo.test R$ 999,00 1,52 x 2,80',
          lastAttemptAt: Date.now()
        }]
      }));
      return vi.fn();
    });

    render(<SyncStatusIndicator />);
    fireEvent.click(screen.getByRole('button', { name: /1 não enviado/i }));
    fireEvent.click(screen.getByRole('button', { name: /copiar diagnóstico/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0];
    expect(copied).not.toContain('Maria Segredo');
    expect(copied).not.toContain('maria@segredo.test');
    expect(copied).not.toContain('999,00');
    expect(copied).not.toContain('1,52');
    expect(screen.getByRole('status')).toHaveTextContent(/diagnóstico copiado/i);
  });
});
