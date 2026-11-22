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

  describe('cliente aberto ao iniciar', () => {
    const clientesDaConta = [
      { id: 7, nome: 'Editado agora pelo socio', lastUpdated: '2026-10-31T12:00:00Z' },
      { id: 3, nome: 'Meu cliente', lastUpdated: '2026-10-30T12:00:00Z' }
    ];

    const abrirApp = async (link?: { id: number; aviso: () => void }) => {
      dbMocks.getUserInfo.mockResolvedValue({ id: 'info', nome: 'Empresa' });
      dbMocks.getAllClients.mockResolvedValue(clientesDaConta);
      dbMocks.getAllCustomFilms.mockResolvedValue([]);
      dbMocks.getAllAgendamentos.mockResolvedValue([]);
      const setSelectedClientId = vi.fn();

      renderHook(() => useAppBootstrap({
        authUserId: 'user-1',
        initialClientLoad: 'all',
        initialPdfLoad: 'deferred',
        requestedClientId: link?.id,
        onRequestedClientMissing: link?.aviso,
        setIsLoading: vi.fn(),
        setClients: vi.fn(),
        setClientListClients: vi.fn(),
        setClientListHasMore: vi.fn(),
        setClientListNextOffset: vi.fn(),
        setHasLoadedAllClients: vi.fn(),
        setSelectedClientId,
        setUserInfo: vi.fn(),
        setFilms: vi.fn(),
        setAllSavedPdfs: vi.fn(),
        setHistoryPdfs: vi.fn(),
        setHistoryHasMore: vi.fn(),
        setHistoryNextOffset: vi.fn(),
        setHasLoadedAllPdfs: vi.fn(),
        setAgendamentos: vi.fn(),
        setHasLoadedHistory: vi.fn(),
        setHasLoadedAgendamentos: vi.fn()
      }));

      await waitFor(() => expect(setSelectedClientId).toHaveBeenCalled());
      return setSelectedClientId;
    };

    it('volta ao cliente deste aparelho mesmo que outro tenha sido editado depois', async () => {
      window.localStorage.setItem('peliculas-br-selected-client-id', '3');
      expect(await abrirApp()).toHaveBeenLastCalledWith(3);
    });

    it('abre o mais recente quando o aparelho nao tem cliente guardado', async () => {
      expect(await abrirApp()).toHaveBeenLastCalledWith(7);
    });

    it('link abre o cliente pedido, e nao o ultimo deste aparelho', async () => {
      const aviso = vi.fn();
      // O app grava o cliente do link neste aparelho antes de carregar a lista.
      window.localStorage.setItem('peliculas-br-selected-client-id', '3');
      expect(await abrirApp({ id: 3, aviso })).toHaveBeenLastCalledWith(3);
      expect(aviso).not.toHaveBeenCalled();
    });

    it('link de cliente que nao esta na lista nao abre outro cliente e avisa uma vez', async () => {
      const aviso = vi.fn();
      window.localStorage.setItem('peliculas-br-selected-client-id', '2059');
      expect(await abrirApp({ id: 2059, aviso })).toHaveBeenLastCalledWith(null);
      expect(aviso).toHaveBeenCalledTimes(1);
    });

    it('cliente do link que chega depois e aberto na atualizacao seguinte', async () => {
      const aviso = vi.fn();
      const setSelectedClientId = vi.fn();
      dbMocks.getUserInfo.mockResolvedValue({ id: 'info', nome: 'Empresa' });
      dbMocks.getAllClients.mockResolvedValue(clientesDaConta);
      dbMocks.getAllCustomFilms.mockResolvedValue([]);
      dbMocks.getAllAgendamentos.mockResolvedValue([]);
      const nada = () => undefined;
      const { result } = renderHook(() => useAppBootstrap({
        authUserId: 'user-1', initialClientLoad: 'all', initialPdfLoad: 'deferred', requestedClientId: 2059, onRequestedClientMissing: aviso,
        setIsLoading: nada, setClients: nada, setClientListClients: nada, setClientListHasMore: nada, setClientListNextOffset: nada,
        setHasLoadedAllClients: nada, setSelectedClientId, setUserInfo: nada, setFilms: nada, setAllSavedPdfs: nada, setHistoryPdfs: nada,
        setHistoryHasMore: nada, setHistoryNextOffset: nada, setHasLoadedAllPdfs: nada, setAgendamentos: nada, setHasLoadedHistory: nada, setHasLoadedAgendamentos: nada
      }));
      await waitFor(() => expect(setSelectedClientId).toHaveBeenLastCalledWith(null));
      await result.current.loadClients(undefined, false);
      expect(setSelectedClientId).toHaveBeenLastCalledWith(null);
      dbMocks.getAllClients.mockResolvedValue([...clientesDaConta, { id: 2059, nome: 'Cristian' }]);
      await result.current.loadClients(undefined, false);
      expect(setSelectedClientId).toHaveBeenLastCalledWith(2059);
      expect(aviso).toHaveBeenCalledTimes(1);
    });

    it('quem escolhe outro cliente depois do link fica nele', async () => {
      const aviso = vi.fn();
      window.localStorage.setItem('peliculas-br-selected-client-id', '7');
      expect(await abrirApp({ id: 2059, aviso })).toHaveBeenLastCalledWith(7);
      expect(aviso).not.toHaveBeenCalled();
    });

    it('ignora cliente guardado que nao existe nesta conta', async () => {
      window.localStorage.setItem('peliculas-br-selected-client-id', '999');
      expect(await abrirApp()).toHaveBeenLastCalledWith(7);
    });
  });

  it('nao busca colecoes completas que a tela inicial nao usa', async () => {
    dbMocks.getUserInfo.mockResolvedValue({ id: 'info', nome: 'Empresa' });
    dbMocks.getAllCustomFilms.mockResolvedValue([]);
    dbMocks.getAllAgendamentos.mockResolvedValue([]);
    dbMocks.getPDFPage.mockResolvedValue({
      pdfs: [],
      hasMore: false,
      nextOffset: 0
    });

    const setIsLoading = vi.fn();

    renderHook(() => useAppBootstrap({
      authUserId: 'user-1',
      initialClientLoad: 'deferred',
      initialPdfLoad: 'history',
      setIsLoading,
      setClients: vi.fn(),
      setClientListClients: vi.fn(),
      setClientListHasMore: vi.fn(),
      setClientListNextOffset: vi.fn(),
      setHasLoadedAllClients: vi.fn(),
      setSelectedClientId: vi.fn(),
      setUserInfo: vi.fn(),
      setFilms: vi.fn(),
      setAllSavedPdfs: vi.fn(),
      setHistoryPdfs: vi.fn(),
      setHistoryHasMore: vi.fn(),
      setHistoryNextOffset: vi.fn(),
      setHasLoadedAllPdfs: vi.fn(),
      setAgendamentos: vi.fn(),
      setHasLoadedHistory: vi.fn(),
      setHasLoadedAgendamentos: vi.fn()
    }));

    await waitFor(() => expect(setIsLoading).toHaveBeenLastCalledWith(false));
    expect(dbMocks.getPDFPage).toHaveBeenCalledWith({ offset: 0, limit: 50 });
    expect(dbMocks.getAllClients).not.toHaveBeenCalled();
    expect(dbMocks.getAllPDFs).not.toHaveBeenCalled();
  });
});
