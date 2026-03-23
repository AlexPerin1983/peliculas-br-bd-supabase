import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { usePdfActions, sanitizeForFilename } from './usePdfActions';
import * as db from '../../services/db';
import { Client, Film, ProposalOption, Totals, UIMeasurement, UserInfo } from '../../types';

vi.mock('../../services/db', () => ({
  savePDF: vi.fn(),
  getPDFBlob: vi.fn()
}));

vi.mock('../../services/pdfGenerator', () => ({
  generatePDF: vi.fn(),
  generateCombinedPDF: vi.fn()
}));

const mockedDb = vi.mocked(db);

describe('sanitizeForFilename', () => {
  it('remove caracteres invalidos e normaliza padroes corrompidos', () => {
    const sanitizedOption = sanitizeForFilename('OpÃ§Ã£o: Janela/Quarto?');
    expect(sanitizedOption).toContain('JanelaQuarto');
    expect(sanitizedOption).not.toMatch(/[<>:"/\\|?*]/);
    const sanitized = sanitizeForFilename('OpÃƒÂ§ÃƒÂ£o*Teste');
    expect(sanitized).not.toMatch(/[<>:"/\\|?*]/);
    expect(sanitized).toContain('Teste');
  });
});

describe('usePdfActions', () => {
  const selectedClient: Client = {
    id: 12,
    nome: 'Alex Cliente',
    telefone: '83999990000',
    email: 'cliente@teste.com',
    cpfCnpj: ''
  };

  const userInfo: UserInfo = {
    id: 'info',
    nome: 'Alex',
    empresa: 'Peliculas BR',
    telefone: '83999990000',
    email: 'empresa@teste.com',
    endereco: 'Rua Teste',
    cpfCnpj: '',
    payment_methods: [],
    proposalValidityDays: 30
  };

  const activeOption: ProposalOption = {
    id: 5,
    name: 'Opcao 1',
    measurements: [],
    generalDiscount: { value: '0', type: 'percentage' }
  };

  const films: Film[] = [
    { nome: 'Blackout', preco: 100 }
  ];

  const totals: Totals = {
    totalM2: 2,
    subtotal: 200,
    totalItemDiscount: 0,
    generalDiscountAmount: 10,
    finalTotal: 190,
    totalQuantity: 1,
    priceAfterItemDiscounts: 200,
    totalLinearMeters: 0,
    linearMeterCost: 0,
    totalMaterial: 200,
    totalLabor: 0
  };

  const measurements: UIMeasurement[] = [
    {
      id: 1,
      largura: '2',
      altura: '1',
      quantidade: 1,
      ambiente: 'Sala',
      tipoAplicacao: 'Interna',
      pelicula: 'Blackout',
      active: true
    }
  ];

  const createAnchor = () => {
    const originalCreateElement = document.createElement.bind(document);
    const anchor = {
      click: vi.fn(),
      href: '',
      download: ''
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') return anchor;
      return originalCreateElement(tagName);
    });

    return anchor;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.body);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.body);
  });

  function buildHook(overrides: Partial<Parameters<typeof usePdfActions>[0]> = {}) {
    return renderHook(() =>
      usePdfActions({
        measurements,
        films,
        generalDiscount: { value: '10', type: 'fixed' },
        totals,
        selectedClient,
        selectedClientId: selectedClient.id ?? null,
        userInfo,
        activeOption,
        clients: [selectedClient],
        setAllSavedPdfs: vi.fn(),
        setPdfGenerationStatus: vi.fn(),
        setIsSaveBeforePdfModalOpen: vi.fn(),
        handleShowInfo: vi.fn(),
        handleSaveChanges: vi.fn().mockResolvedValue(undefined),
        ...overrides
      })
    );
  }

  it('abre modal de save antes do PDF quando ha alteracoes pendentes', async () => {
    const setIsSaveBeforePdfModalOpen = vi.fn();
    const { result } = buildHook({ setIsSaveBeforePdfModalOpen });

    await act(async () => {
      await result.current.handleGeneratePdfWithSaveCheck(true);
    });

    expect(setIsSaveBeforePdfModalOpen).toHaveBeenCalledWith(true);
  });

  it('gera e salva PDF com sucesso', async () => {
    const anchor = createAnchor();
    const setPdfGenerationStatus = vi.fn();
    const setAllSavedPdfs = vi.fn();
    const pdfBlob = new Blob(['pdf'], { type: 'application/pdf' });
    const handleShowInfo = vi.fn();

    const pdfModule = await import('../../services/pdfGenerator');
    vi.mocked(pdfModule.generatePDF).mockResolvedValue(pdfBlob);
    mockedDb.savePDF.mockResolvedValue({
      id: 99,
      clienteId: 12,
      date: new Date().toISOString(),
      totalPreco: 190,
      totalM2: 2,
      nomeArquivo: 'teste.pdf'
    });

    const { result } = buildHook({
      setPdfGenerationStatus,
      setAllSavedPdfs,
      handleShowInfo
    });

    await act(async () => {
      await result.current.handleGeneratePdf();
    });

    expect(pdfModule.generatePDF).toHaveBeenCalled();
    expect(mockedDb.savePDF).toHaveBeenCalled();
    expect(setPdfGenerationStatus).toHaveBeenCalledWith('generating');
    expect(setPdfGenerationStatus).toHaveBeenCalledWith('success');
    expect(anchor.click).toHaveBeenCalled();
    expect(handleShowInfo).not.toHaveBeenCalled();
  });

  it('avisa quando faltam dados obrigatorios para gerar PDF', async () => {
    const handleShowInfo = vi.fn();
    const { result } = buildHook({
      selectedClient: null,
      handleShowInfo
    });

    await act(async () => {
      await result.current.handleGeneratePdf();
    });

    expect(handleShowInfo).toHaveBeenCalled();
    expect(mockedDb.savePDF).not.toHaveBeenCalled();
  });

  it('volta para idle e informa erro quando a geracao do PDF falha', async () => {
    const setPdfGenerationStatus = vi.fn();
    const handleShowInfo = vi.fn();

    const pdfModule = await import('../../services/pdfGenerator');
    vi.mocked(pdfModule.generatePDF).mockRejectedValue(new Error('falha ao montar pdf'));

    const { result } = buildHook({
      setPdfGenerationStatus,
      handleShowInfo
    });

    await act(async () => {
      await result.current.handleGeneratePdf();
    });

    expect(setPdfGenerationStatus).toHaveBeenCalledWith('generating');
    expect(setPdfGenerationStatus).toHaveBeenCalledWith('idle');
    expect(handleShowInfo).toHaveBeenCalledWith(
      'Ocorreu um erro ao gerar o PDF. Verifique o console para mais detalhes.'
    );
  });

  it('faz save antes de gerar PDF quando o usuario confirma', async () => {
    const handleSaveChanges = vi.fn().mockResolvedValue(undefined);
    const setIsSaveBeforePdfModalOpen = vi.fn();
    const setPdfGenerationStatus = vi.fn();
    const pdfBlob = new Blob(['pdf'], { type: 'application/pdf' });

    const pdfModule = await import('../../services/pdfGenerator');
    vi.mocked(pdfModule.generatePDF).mockResolvedValue(pdfBlob);
    mockedDb.savePDF.mockResolvedValue({
      id: 101,
      clienteId: 12,
      date: new Date().toISOString(),
      totalPreco: 190,
      totalM2: 2,
      nomeArquivo: 'teste.pdf'
    });

    const { result } = buildHook({
      handleSaveChanges,
      setIsSaveBeforePdfModalOpen,
      setPdfGenerationStatus
    });

    await act(async () => {
      await result.current.handleConfirmSaveBeforePdf();
    });

    expect(handleSaveChanges).toHaveBeenCalled();
    expect(setIsSaveBeforePdfModalOpen).toHaveBeenCalledWith(false);
    expect(setPdfGenerationStatus).toHaveBeenCalledWith('success');
  });
});
