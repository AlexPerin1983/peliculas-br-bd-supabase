import { renderHook, waitFor } from '@testing-library/react';
import { useAppBootstrap } from './useAppBootstrap';

const dbMocks = vi.hoisted(() => ({
  getAllClients: vi.fn(),
  getClientPage: vi.fn(),
  getAllCustomFilms: vi.fn(),
  getAllPDFs: vi.fn(),
  getPDFPage: vi.fn(),
  getAllAgendamentos: vi.fn(),
  getUserInfo: vi.fn(),
  migratePDFsWithProposalOptionId: vi.fn()
}));

vi.mock('../../services/db', () => dbMocks);
vi.mock('../../services/syncService', () => ({
  initSyncService: vi.fn(),
  subscribeSyncStatus: vi.fn(() => vi.fn())
}));
vi.mock('../lib/canonicalHost', () => ({
  redirectToCanonicalHostIfNeeded: vi.fn()
}));

describe('useAppBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    dbMocks.migratePDFsWithProposalOptionId.mockResolvedValue(undefined);
  });

  it('libera o dashboard antes dos dados secundarios terminarem', async () => {
    let resolveUserInfo!: (value: any) => void;
    let resolveFilms!: (value: any[]) => void;
    let resolveAgenda!: (value: any[]) => void;

    dbMocks.getUserInfo.mockReturnValue(new Promise(resolve => { resolveUserInfo = resolve; }));
    dbMocks.getAllCustomFilms.mockReturnValue(new Promise(resolve => { resolveFilms = resolve; }));
    dbMocks.getAllAgendamentos.mockReturnValue(new Promise(resolve => { resolveAgenda = resolve; }));

    const setIsLoading = vi.fn();
    const setUserInfo = vi.fn();
    const setFilms = vi.fn();
    const setAgendamentos = vi.fn();
    const setHasLoadedAgendamentos = vi.fn();

    renderHook(() => useAppBootstrap({
      authUserId: 'user-1',
      initialClientLoad: 'deferred',
      initialPdfLoad: 'deferred',
      setIsLoading,
      setClients: vi.fn(),
      setClientListClients: vi.fn(),
      setClientListHasMore: vi.fn(),
      setClientListNextOffset: vi.fn(),
      setHasLoadedAllClients: vi.fn(),
      setSelectedClientId: vi.fn(),
      setUserInfo,
      setFilms,
      setAllSavedPdfs: vi.fn(),
      setHistoryPdfs: vi.fn(),
      setHistoryHasMore: vi.fn(),
      setHistoryNextOffset: vi.fn(),
      setHasLoadedAllPdfs: vi.fn(),
      setAgendamentos,
      setHasLoadedHistory: vi.fn(),
      setHasLoadedAgendamentos
    }));

    await waitFor(() => expect(setIsLoading).toHaveBeenCalledWith(false));
    expect(setUserInfo).not.toHaveBeenCalled();
    expect(setFilms).not.toHaveBeenCalled();
    expect(setAgendamentos).not.toHaveBeenCalled();

    resolveUserInfo({ id: 'info', nome: 'Empresa' });
    resolveFilms([{ nome: 'Pelicula B' }, { nome: 'Pelicula A' }]);
    resolveAgenda([{ id: 1 }]);

    await waitFor(() => expect(setUserInfo).toHaveBeenCalled());
    expect(setFilms).toHaveBeenCalledWith([{ nome: 'Pelicula A' }, { nome: 'Pelicula B' }]);
    expect(setAgendamentos).toHaveBeenCalledWith([{ id: 1 }]);
    expect(setHasLoadedAgendamentos).toHaveBeenCalledWith(true);
  });
});
