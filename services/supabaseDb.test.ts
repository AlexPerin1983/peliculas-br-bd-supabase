import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateMock = vi.fn();
const insertMock = vi.fn();
const selectMock = vi.fn();
const singleMock = vi.fn();
const eqSecondMock = vi.fn();
const eqFirstMock = vi.fn();
const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('./sessionScope', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue('user-1'),
  getEffectiveOrganizationId: vi.fn().mockResolvedValue(1),
  getEffectiveOwnerUserId: vi.fn().mockResolvedValue('user-1')
}));

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args)
  }
}));

const buildUpdateChain = () => {
  singleMock.mockResolvedValue({
    data: {
      id: 91,
      client_id: 12,
      client_name: 'Cliente PDF',
      date: '2026-04-13',
      expiration_date: null,
      total_preco: 100,
      total_m2: 2,
      subtotal: null,
      general_discount_amount: null,
      general_discount: null,
      nome_arquivo: 'orcamento.pdf',
      measurements: [],
      status: 'approved',
      agendamento_id: null,
      proposal_option_name: null,
      proposal_option_id: null,
      pdf_blob: null
    },
    error: null
  });

  selectMock.mockReturnValue({ single: singleMock });
  eqSecondMock.mockReturnValue({ select: selectMock });
  eqFirstMock.mockReturnValue({ eq: eqSecondMock });
  updateMock.mockReturnValue({ eq: eqFirstMock });
  fromMock.mockReturnValue({ update: updateMock, insert: insertMock });
};

describe('supabaseDb PDF updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildUpdateChain();
  });

  it('atualiza metadata do PDF sem exigir pdfBlob', async () => {
    const { updatePDF } = await import('./supabaseDb');

    await updatePDF({
      id: 91,
      clienteId: 12,
      clientName: 'Cliente PDF',
      date: '2026-04-13',
      totalPreco: 100,
      totalM2: 2,
      nomeArquivo: 'orcamento.pdf',
      status: 'approved'
    });

    expect(fromMock).toHaveBeenCalledWith('saved_pdfs');
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0][0]).not.toHaveProperty('pdf_blob');
    expect(eqFirstMock).toHaveBeenCalledWith('id', 91);
    expect(eqSecondMock).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('salva agendamento usando as colunas atuais start/end', async () => {
    const start = '2026-05-20T09:00:00.000Z';
    const end = '2026-05-20T11:00:00.000Z';

    singleMock.mockResolvedValue({
      data: {
        id: 55,
        pdf_id: 91,
        pdf_ids: [91, 92],
        client_id: 12,
        client_name: 'Cliente Agenda',
        start,
        end,
        notes: 'Instalacao',
        receipt_description: 'Aplicacao de pelicula Carbono Prime',
        stock_status: 'pending',
        stock_consumed_at: null,
        stock_source_pdf_ids: [91, 92]
      },
      error: null
    });
    selectMock.mockReturnValue({ single: singleMock });
    insertMock.mockReturnValue({ select: selectMock });
    fromMock.mockReturnValue({ update: updateMock, insert: insertMock });

    const { saveAgendamento } = await import('./supabaseDb');
    const saved = await saveAgendamento({
      pdfId: 91,
      pdfIds: [91, 92],
      clienteId: 12,
      clienteNome: 'Cliente Agenda',
      start,
      end,
      notes: 'Instalacao',
      receiptDescription: 'Aplicacao de pelicula Carbono Prime',
      stockStatus: 'pending',
      stockSourcePdfIds: [91, 92]
    });

    expect(fromMock).toHaveBeenCalledWith('agendamentos');
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      pdf_id: 91,
      pdf_ids: [91, 92],
      client_id: 12,
      client_name: 'Cliente Agenda',
      start,
      end,
      notes: 'Instalacao',
      receipt_description: 'Aplicacao de pelicula Carbono Prime',
      stock_status: 'pending',
      stock_source_pdf_ids: [91, 92]
    }));
    expect(insertMock.mock.calls[0][0]).not.toHaveProperty('start_time');
    expect(insertMock.mock.calls[0][0]).not.toHaveProperty('end_time');
    expect(saved).toEqual(expect.objectContaining({
      id: 55,
      pdfId: 91,
      pdfIds: [91, 92],
      clienteId: 12,
      clienteNome: 'Cliente Agenda',
      start,
      end,
      receiptDescription: 'Aplicacao de pelicula Carbono Prime',
      stockStatus: 'pending',
      stockSourcePdfIds: [91, 92]
    }));
  });

  it('mantém payloads antigos compatíveis quando a coluna ainda não foi migrada', async () => {
    const start = '2026-05-20T09:00:00.000Z';
    const end = '2026-05-20T11:00:00.000Z';
    singleMock
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST204', message: "Could not find the 'receipt_description' column" }
      })
      .mockResolvedValueOnce({
        data: {
          id: 55,
          client_id: 12,
          client_name: 'Cliente Agenda',
          start,
          end,
          notes: null
        },
        error: null
      });
    selectMock.mockReturnValue({ single: singleMock });
    insertMock.mockReturnValue({ select: selectMock });
    fromMock.mockReturnValue({ update: updateMock, insert: insertMock });

    const { saveAgendamento } = await import('./supabaseDb');
    const saved = await saveAgendamento({
      clienteId: 12,
      clienteNome: 'Cliente Agenda',
      start,
      end,
      receiptDescription: undefined
    });

    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertMock.mock.calls[0][0]).toHaveProperty('receipt_description', null);
    expect(insertMock.mock.calls[1][0]).not.toHaveProperty('receipt_description');
    expect(saved.receiptDescription).toBeUndefined();
  });

  it('não descarta silenciosamente um snapshot quando falta a coluna remota', async () => {
    const start = '2026-05-20T09:00:00.000Z';
    const end = '2026-05-20T11:00:00.000Z';
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST204', message: "Could not find the 'receipt_description' column" }
    });
    selectMock.mockReturnValue({ single: singleMock });
    insertMock.mockReturnValue({ select: selectMock });
    fromMock.mockReturnValue({ update: updateMock, insert: insertMock });

    const { saveAgendamento } = await import('./supabaseDb');
    await expect(saveAgendamento({
      clienteId: 12,
      clienteNome: 'Cliente Agenda',
      start,
      end,
      receiptDescription: 'Aplicacao de pelicula'
    })).rejects.toMatchObject({ code: 'PGRST204' });

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0]).toHaveProperty('receipt_description', 'Aplicacao de pelicula');
  });

  it('não descarta uma pendência de estoque quando falta a migração remota', async () => {
    const start = '2026-05-20T09:00:00.000Z';
    const end = '2026-05-20T11:00:00.000Z';
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST204', message: "Could not find the 'stock_status' column" }
    });
    selectMock.mockReturnValue({ single: singleMock });
    insertMock.mockReturnValue({ select: selectMock });
    fromMock.mockReturnValue({ update: updateMock, insert: insertMock });

    const { saveAgendamento } = await import('./supabaseDb');
    await expect(saveAgendamento({
      clienteId: 12,
      clienteNome: 'Cliente Agenda',
      start,
      end,
      serviceStatus: 'completed',
      stockStatus: 'pending',
      stockSourcePdfIds: [91]
    })).rejects.toMatchObject({ code: 'PGRST204' });

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0]).toEqual(expect.objectContaining({
      stock_status: 'pending',
      stock_source_pdf_ids: [91]
    }));
  });

  it('pagina PDFs usando um registro extra para indicar a proxima pagina', async () => {
    const rangeMock = vi.fn().mockResolvedValue({
      data: [
        { id: 3, client_id: 1, client_name: 'C', date: '2026-07-03', total_preco: 30, total_m2: 1, nome_arquivo: 'c.pdf', measurements: [] },
        { id: 2, client_id: 1, client_name: 'B', date: '2026-07-02', total_preco: 20, total_m2: 1, nome_arquivo: 'b.pdf', measurements: [] },
        { id: 1, client_id: 1, client_name: 'A', date: '2026-07-01', total_preco: 10, total_m2: 1, nome_arquivo: 'a.pdf', measurements: [] }
      ],
      error: null
    });
    const secondOrderMock = vi.fn().mockReturnValue({ range: rangeMock });
    const firstOrderMock = vi.fn().mockReturnValue({ order: secondOrderMock });
    const pageSelectMock = vi.fn().mockReturnValue({ order: firstOrderMock });
    fromMock.mockReturnValue({ select: pageSelectMock });

    const { getPDFPage } = await import('./supabaseDb');
    const result = await getPDFPage({ offset: 0, limit: 2 });

    expect(rangeMock).toHaveBeenCalledWith(0, 2);
    expect(result.pdfs.map(pdf => pdf.id)).toEqual([3, 2]);
    expect(result.hasMore).toBe(true);
    expect(result.nextOffset).toBe(2);
  });

  it('lista o historico imutavel das medidas da versao mais recente para a mais antiga', async () => {
    const limitMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 12,
          client_id: 44,
          revision: 3,
          snapshot: [{ id: 9, name: 'Opcao 1', measurements: [], generalDiscount: { value: '', type: 'fixed' } }],
          created_at: '2026-08-16T12:00:00.000Z',
          created_by: 'user-1',
          source_device_id: 'device-b'
        }
      ],
      error: null
    });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const historyEqMock = vi.fn().mockReturnValue({ order: orderMock });
    const historySelectMock = vi.fn().mockReturnValue({ eq: historyEqMock });
    fromMock.mockReturnValue({ select: historySelectMock });

    const { getProposalOptionsHistory } = await import('./supabaseDb');
    const result = await getProposalOptionsHistory(44, 10);

    expect(fromMock).toHaveBeenCalledWith('proposal_option_history');
    expect(historyEqMock).toHaveBeenCalledWith('client_id', 44);
    expect(orderMock).toHaveBeenCalledWith('revision', { ascending: false });
    expect(limitMock).toHaveBeenCalledWith(10);
    expect(result).toEqual([
      expect.objectContaining({
        id: 12,
        clientId: 44,
        revision: 3,
        sourceDeviceId: 'device-b'
      })
    ]);
  });

  it('pagina clientes recentes e informa quando existe outra pagina', async () => {
    const rangeMock = vi.fn().mockResolvedValue({
      data: [
        { id: 3, nome: 'Cliente C', telefone: '', email: '', cpf_cnpj: '', pinned: false, last_updated: '2026-07-03' },
        { id: 2, nome: 'Cliente B', telefone: '', email: '', cpf_cnpj: '', pinned: false, last_updated: '2026-07-02' },
        { id: 1, nome: 'Cliente A', telefone: '', email: '', cpf_cnpj: '', pinned: false, last_updated: '2026-07-01' }
      ],
      error: null
    });
    const thirdOrderMock = vi.fn().mockReturnValue({ range: rangeMock });
    const secondOrderMock = vi.fn().mockReturnValue({ order: thirdOrderMock });
    const firstOrderMock = vi.fn().mockReturnValue({ order: secondOrderMock });
    const pageSelectMock = vi.fn().mockReturnValue({ order: firstOrderMock });
    fromMock.mockReturnValue({ select: pageSelectMock });

    const { getClientPage } = await import('./supabaseDb');
    const result = await getClientPage({ offset: 0, limit: 2 });

    expect(rangeMock).toHaveBeenCalledWith(0, 2);
    expect(result.clients.map(client => client.id)).toEqual([3, 2]);
    expect(result.hasMore).toBe(true);
    expect(result.nextOffset).toBe(2);
  });
});

describe('supabaseDb proposal operation writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envia somente o lote incremental para o RPC', async () => {
    const base = [{
      id: 10,
      name: 'Opcao 1',
      measurements: [{
        id: 1,
        largura: '1,00',
        altura: '1,00',
        quantidade: 1,
        ambiente: 'Sala',
        tipoAplicacao: 'Janela',
        pelicula: 'Carbono',
        active: true
      }],
      generalDiscount: { value: '', type: 'fixed' as const }
    }];
    const next = [{
      ...base[0],
      measurements: [{ ...base[0].measurements[0], largura: '1,25' }]
    }];

    rpcMock.mockResolvedValue({
      data: { status: 'saved', revision: 8, snapshot: next },
      error: null
    });

    const { saveProposalOptionsRemote } = await import('./supabaseDb');
    const result = await saveProposalOptionsRemote(12, next, {
      baseRevision: 7,
      baseOptions: base,
      deviceId: 'device-test'
    });

    expect(rpcMock).toHaveBeenCalledWith('apply_proposal_option_operations', {
      p_client_id: 12,
      p_operations: [expect.objectContaining({
        type: 'upsert_measurement',
        optionId: 10,
        measurement: expect.objectContaining({ id: 1, largura: '1,25' })
      })],
      p_expected_revision: 7,
      p_device_id: 'device-test'
    });
    expect(result).toEqual(expect.objectContaining({
      options: next,
      revision: 8,
      conflictResolved: false
    }));
  });
});
