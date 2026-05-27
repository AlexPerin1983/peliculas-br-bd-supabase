import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateMock = vi.fn();
const insertMock = vi.fn();
const selectMock = vi.fn();
const singleMock = vi.fn();
const eqSecondMock = vi.fn();
const eqFirstMock = vi.fn();
const fromMock = vi.fn();

vi.mock('./sessionScope', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue('user-1'),
  getEffectiveOrganizationId: vi.fn().mockResolvedValue(1),
  getEffectiveOwnerUserId: vi.fn().mockResolvedValue('user-1')
}));

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args)
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
        client_id: 12,
        client_name: 'Cliente Agenda',
        start,
        end,
        notes: 'Instalacao'
      },
      error: null
    });
    selectMock.mockReturnValue({ single: singleMock });
    insertMock.mockReturnValue({ select: selectMock });
    fromMock.mockReturnValue({ update: updateMock, insert: insertMock });

    const { saveAgendamento } = await import('./supabaseDb');
    const saved = await saveAgendamento({
      pdfId: 91,
      clienteId: 12,
      clienteNome: 'Cliente Agenda',
      start,
      end,
      notes: 'Instalacao'
    });

    expect(fromMock).toHaveBeenCalledWith('agendamentos');
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      pdf_id: 91,
      client_id: 12,
      client_name: 'Cliente Agenda',
      start,
      end,
      notes: 'Instalacao'
    }));
    expect(insertMock.mock.calls[0][0]).not.toHaveProperty('start_time');
    expect(insertMock.mock.calls[0][0]).not.toHaveProperty('end_time');
    expect(saved).toEqual(expect.objectContaining({
      id: 55,
      pdfId: 91,
      clienteId: 12,
      clienteNome: 'Cliente Agenda',
      start,
      end
    }));
  });
});
