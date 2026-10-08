import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { usePdfActions, sanitizeForFilename, toPdfBlob } from './usePdfActions';
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
    const sanitizedOption = sanitizeForFilename('Opção: Janela/Quarto?');
    expect(sanitizedOption).toContain('JanelaQuarto');
    expect(sanitizedOption).not.toMatch(/[<>:"/\\|?*]/);
    const sanitized = sanitizeForFilename('Opção*Teste');
    expect(sanitized).not.toMatch(/[<>:"/\\|?*]/);
    expect(sanitized).toContain('Teste');
  });
});

describe('toPdfBlob', () => {
  it('converte o PDF guardado no aparelho (base64) em arquivo', async () => {
    const pdfText = '%PDF-1.4 teste';
    const fromDataUrl = toPdfBlob(`data:application/pdf;base64,${btoa(pdfText)}`);
    const fromRaw = toPdfBlob(btoa(pdfText));
    expect(fromDataUrl?.type).toBe('application/pdf');
    expect(await fromDataUrl?.text()).toBe(pdfText);
    expect(await fromRaw?.text()).toBe(pdfText);
  });

  it('vazio ou inválido conta como sem PDF', () => {
    expect(toPdfBlob(undefined)).toBeNull();
    expect(toPdfBlob('')).toBeNull();
    expect(toPdfBlob('não é base64 ✗')).toBeNull();
    expect(toPdfBlob(new Blob([]))).toBeNull();
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
    generalDiscount: { value: '0', type: 'percentage', pricingMode: 'complete' }
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
    totalLabor: 0,
    operationalExpenses: 0,
    expensesByCategory: [],
    estimatedMaterialCost: 0,
    estimatedTotalCost: 0,
    estimatedProfit: 190,
    estimatedMarginPercentage: 100,
    pricingMode: 'complete'
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
        generalDiscount: { value: '10', type: 'fixed', pricingMode: 'complete' },
        totals,
        selectedClient,
        selectedClientId: selectedClient.id ?? null,
        userInfo,
        activeOption,
        proposalPaymentConfig: { paymentMethods: [], prazoPagamento: '' },
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
    expect(mockedDb.savePDF).toHaveBeenCalledWith(expect.objectContaining({
      generalDiscount: expect.objectContaining({
        pricingMode: 'complete',
        operation: 'discount',
        expenseSnapshot: expect.objectContaining({
          operationalExpenses: 0,
          estimatedProfit: 190
        })
      })
    }));
    expect(setPdfGenerationStatus).toHaveBeenCalledWith('generating');
    expect(setPdfGenerationStatus).toHaveBeenCalledWith('success');
    expect(result.current.latestGeneratedProposal).toEqual(expect.objectContaining({
      client: selectedClient,
      pdf: expect.objectContaining({ id: 99, clienteId: 12 })
    }));
    expect(anchor.click).toHaveBeenCalled();
    expect(handleShowInfo).not.toHaveBeenCalled();
  });

  it('compartilha o ultimo PDF gerado pelo menu nativo', async () => {
    createAnchor();
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: nativeShare });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn().mockReturnValue(true) });
    const pdfBlob = new Blob(['pdf'], { type: 'application/pdf' });
    const pdfModule = await import('../../services/pdfGenerator');
    vi.mocked(pdfModule.generatePDF).mockResolvedValue(pdfBlob);
    mockedDb.savePDF.mockResolvedValue({
      id: 102,
      clienteId: 12,
      date: new Date().toISOString(),
      totalPreco: 190,
      totalM2: 2,
      nomeArquivo: 'teste.pdf'
    });
    const { result } = buildHook();

    await act(async () => { await result.current.handleGeneratePdf(); });
    expect(result.current.canShareGeneratedPdf).toBe(true);
    await act(async () => { await result.current.handleShareGeneratedPdf(); });

    expect(nativeShare).toHaveBeenCalledWith(expect.objectContaining({
      files: expect.arrayContaining([expect.any(File)])
    }));
  });

  it('abre o ultimo PDF gerado em uma nova aba para conferencia', async () => {
    const anchor = createAnchor();
    const pdfBlob = new Blob(['pdf'], { type: 'application/pdf' });
    const pdfModule = await import('../../services/pdfGenerator');
    vi.mocked(pdfModule.generatePDF).mockResolvedValue(pdfBlob);
    mockedDb.savePDF.mockResolvedValue({
      id: 103,
      clienteId: 12,
      date: new Date().toISOString(),
      totalPreco: 190,
      totalM2: 2,
      nomeArquivo: 'teste.pdf'
    });
    const { result } = buildHook();

    await act(async () => { await result.current.handleGeneratePdf(); });
    expect(result.current.canPreviewGeneratedPdf).toBe(true);
    expect(result.current.handlePreviewGeneratedPdf()).toBe(true);

    expect(anchor.click).toHaveBeenCalledTimes(2);
    expect(anchor.target).toBe('_blank');
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

  it('mantem o modal aberto e informa quando o save anterior ao PDF falha', async () => {
    const handleSaveChanges = vi.fn().mockRejectedValue(new Error('falha local'));
    const setIsSaveBeforePdfModalOpen = vi.fn();
    const handleShowInfo = vi.fn();
    const pdfModule = await import('../../services/pdfGenerator');
    const { result } = buildHook({
      handleSaveChanges,
      setIsSaveBeforePdfModalOpen,
      handleShowInfo
    });

    await act(async () => {
      await result.current.handleConfirmSaveBeforePdf();
    });

    expect(setIsSaveBeforePdfModalOpen).not.toHaveBeenCalledWith(false);
    expect(pdfModule.generatePDF).not.toHaveBeenCalled();
    expect(handleShowInfo).toHaveBeenCalledWith(
      'Não foi possível salvar o orçamento. Tente novamente.'
    );
    expect(result.current.isSavingBeforePdf).toBe(false);
  });

  describe('reabrir o PDF depois de fechar e abrir o app', () => {
    const generateOnce = async () => {
      const pdfModule = await import('../../services/pdfGenerator');
      vi.mocked(pdfModule.generatePDF).mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
      const savedPdf = {
        id: -1791,
        clienteId: 12,
        proposalOptionId: 5,
        proposalOptionName: 'Opcao 1',
        date: new Date().toISOString(),
        totalPreco: 190,
        totalM2: 2,
        nomeArquivo: 'teste.pdf',
        pdfBlob: new Blob(['pdf salvo'], { type: 'application/pdf' })
      };
      mockedDb.savePDF.mockResolvedValue(savedPdf);
      const first = buildHook();
      await act(async () => {
        await first.result.current.handleGeneratePdfWithSaveCheck(false);
      });
      first.unmount();
      return savedPdf;
    };

    beforeEach(() => {
      window.localStorage.clear();
      // Dois hooks no mesmo teste (antes e depois de reabrir o app): cada um
      // precisa do seu lugar na página.
      vi.mocked(document.body.appendChild).mockRestore();
      vi.mocked(document.body.removeChild).mockRestore();
    });

    it('acha o PDF de hoje desta opção quando nada mudou', async () => {
      const savedPdf = await generateOnce();
      // App reaberto: hook novo, sem a memória do último PDF.
      const { result } = buildHook();
      expect(result.current.isLatestPdfUpToDate()).toBe(false);
      expect(result.current.findReusablePdf([savedPdf])).toBe(savedPdf);
    });

    it('não reaproveita quando o orçamento mudou', async () => {
      const savedPdf = await generateOnce();
      const { result } = buildHook({ totals: { ...totals, finalTotal: 250 } });
      expect(result.current.findReusablePdf([savedPdf])).toBeNull();
    });

    it('não reaproveita PDF de outro dia nem de outra opção', async () => {
      const savedPdf = await generateOnce();
      const { result } = buildHook();
      expect(result.current.findReusablePdf([{ ...savedPdf, date: '2026-01-01T10:00:00.000Z' }])).toBeNull();
      expect(result.current.findReusablePdf([{ ...savedPdf, proposalOptionId: 99 }])).toBeNull();
    });

    it('reabre o modal com o PDF salvo, sem gerar outro', async () => {
      const savedPdf = await generateOnce();
      const pdfModule = await import('../../services/pdfGenerator');
      vi.mocked(pdfModule.generatePDF).mockClear();
      mockedDb.savePDF.mockClear();
      const setPdfGenerationStatus = vi.fn();
      const { result } = buildHook({ setPdfGenerationStatus });

      let reopened = false;
      await act(async () => {
        reopened = await result.current.reopenSavedPdf(savedPdf);
      });

      expect(reopened).toBe(true);
      expect(setPdfGenerationStatus).toHaveBeenCalledWith('success');
      expect(result.current.canPreviewGeneratedPdf).toBe(true);
      expect(result.current.latestGeneratedProposal?.pdf).toBe(savedPdf);
      expect(pdfModule.generatePDF).not.toHaveBeenCalled();
      expect(mockedDb.savePDF).not.toHaveBeenCalled();
    });
  });

  describe('propostas marcadas no Orçamento gerado', () => {
    const savedProposal = (id: number, name: string) => ({
      id,
      clienteId: 12,
      proposalOptionId: id,
      proposalOptionName: name,
      date: '2026-10-07T10:00:00.000Z',
      totalPreco: 190,
      totalM2: 2,
      nomeArquivo: `${name}.pdf`,
      pdfBlob: new Blob([name], { type: 'application/pdf' })
    });

    it('Ver PDF abre só a proposta tocada, na janela aberta no toque', async () => {
      const pdfModule = await import('../../services/pdfGenerator');
      const popup = { location: { href: '' }, close: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
      const pdf = savedProposal(1, 'Suntek');
      const { result } = buildHook();

      let opened = false;
      await act(async () => {
        opened = await result.current.handlePreviewProposal(pdf);
      });

      expect(opened).toBe(true);
      expect(window.open).toHaveBeenCalledWith('', '_blank');
      expect(pdfModule.generateCombinedPDF).not.toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalledWith(pdf.pdfBlob);
      expect(popup.location.href).toBe('blob:test');
    });

    it('Compartilhar várias manda um PDF por opção, sem juntar', async () => {
      const pdfModule = await import('../../services/pdfGenerator');
      const share = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', { configurable: true, value: share });
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      const pdfs = [savedProposal(1, 'Suntek'), savedProposal(2, 'Window Premium')];
      const { result } = buildHook();

      let outcome = '';
      await act(async () => {
        outcome = await result.current.handleShareProposals(pdfs);
      });

      expect(outcome).toBe('shared');
      expect(pdfModule.generateCombinedPDF).not.toHaveBeenCalled();
      const files = share.mock.calls[0][0].files as File[];
      expect(files.map(file => file.name)).toEqual(['Suntek.pdf', 'Window Premium.pdf']);
      Reflect.deleteProperty(navigator, 'share');
      Reflect.deleteProperty(navigator, 'canShare');
    });

    it('Compartilhar manda os bytes do PDF guardado no aparelho em base64', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', { configurable: true, value: share });
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      const pdfText = '%PDF-1.4 do aparelho';
      const pdf = { ...savedProposal(1, 'Suntek'), pdfBlob: `data:application/pdf;base64,${btoa(pdfText)}` as unknown as Blob };
      const { result } = buildHook();

      await act(async () => {
        await result.current.handleShareProposals([pdf]);
      });

      const file = share.mock.calls[0][0].files[0] as File;
      expect(await file.text()).toBe(pdfText);
      Reflect.deleteProperty(navigator, 'share');
      Reflect.deleteProperty(navigator, 'canShare');
    });
  });
});
