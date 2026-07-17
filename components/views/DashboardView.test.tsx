import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DashboardView from './DashboardView';
import { SavedPDF, StandaloneExpense } from '../../types';
import { getAllServicosPrestados } from '../../services/servicosService';
import { deleteStandaloneExpense, getAllStandaloneExpenses, saveStandaloneExpense } from '../../services/db';

vi.mock('../../services/servicosService', () => ({
  getAllServicosPrestados: vi.fn()
}));

vi.mock('../../services/db', () => ({
  getAllStandaloneExpenses: vi.fn(),
  saveStandaloneExpense: vi.fn(),
  deleteStandaloneExpense: vi.fn()
}));

describe('DashboardView', () => {
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);

  const standaloneExpenses: StandaloneExpense[] = [
    {
      id: 101,
      date: now.toISOString(),
      category: 'paid_traffic',
      amount: 75,
      description: 'Campanha local',
      paymentMethod: 'Pix',
      clientId: null,
      proposalId: null
    }
  ];

  const pdfs: SavedPDF[] = [
    {
      id: 1,
      clienteId: 10,
      clientName: 'Cliente A',
      date: now.toISOString(),
      totalPreco: 1200,
      totalM2: 12,
      nomeArquivo: 'orcamento-a.pdf',
      status: 'approved',
      proposalOptionName: 'Completo',
      measurements: [
        {
          id: 1,
          largura: '2',
          altura: '3',
          quantidade: 2,
          ambiente: 'Sala',
          tipoAplicacao: 'Interna',
          pelicula: 'Pelicula X',
          active: true
        }
      ],
      generalDiscount: {
        value: 0,
        type: 'none',
        expenseSnapshot: {
          operationalExpenses: 180,
          estimatedMaterialCost: 250,
          estimatedTotalCost: 430,
          estimatedProfit: 770,
          estimatedMarginPercentage: 64.1,
          expensesByCategory: [
            { category: 'transport', label: 'Transporte', total: 120 },
            { category: 'tools', label: 'Ferramentas', total: 60 }
          ]
        }
      }
    },
    {
      id: 2,
      clienteId: 20,
      clientName: 'Cliente B',
      date: now.toISOString(),
      expirationDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString(),
      totalPreco: 800,
      totalM2: 8,
      nomeArquivo: 'orcamento-b.pdf',
      status: 'pending',
      proposalOptionName: 'Basico'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(getAllServicosPrestados).mockResolvedValue([
      {
        id: 1,
        codigo_qr: 'SVC-1',
        cliente_nome: 'Cliente A',
        filme_aplicado: 'Pelicula X',
        metros_aplicados: 12,
        data_servico: now.toISOString(),
        empresa_nome: 'Peliculas BR'
      }
    ]);
    vi.mocked(getAllStandaloneExpenses).mockResolvedValue(standaloneExpenses);
    vi.mocked(saveStandaloneExpense).mockImplementation(async expense => ({ ...expense, id: 102 }));
    vi.mocked(deleteStandaloneExpense).mockResolvedValue(undefined);
  });

  it('resume orcamentos, gastos, agenda e servicos', async () => {
    render(
      <DashboardView
        allSavedPdfs={pdfs}
        clients={[{ id: 10, nome: 'Cliente A', telefone: '', email: '', cpfCnpj: '' }]}
        agendamentos={[
          {
            id: 1,
            clienteId: 10,
            clienteNome: 'Cliente A',
            start: nextWeek.toISOString(),
            end: nextWeek.toISOString()
          }
        ]}
        films={[{ nome: 'Pelicula X', preco: 100 }]}
        onTabChange={vi.fn()}
        onOpenAIQuickProposal={vi.fn()}
        onOpenClientModal={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abrir filtro de data:/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Hoje/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Abrir filtro de data desktop:/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Periodo anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Proximo periodo' })).toBeInTheDocument();
    expect(screen.getByText('Gasto periodo')).toBeInTheDocument();
    expect(screen.getByText('Media diaria')).toBeInTheDocument();
    expect(screen.getByText('O que precisa de ação')).toBeInTheDocument();
    expect(screen.getByText('Vencidas')).toBeInTheDocument();
    expect(screen.getByText('Receita e gastos por dia')).toBeInTheDocument();
    expect(screen.getByText('Transporte')).toBeInTheDocument();
    expect(await screen.findByText('Despesas avulsas')).toBeInTheDocument();
    expect(screen.getByText('Campanha local')).toBeInTheDocument();
    expect(screen.getAllByText('Cliente A').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Pelicula X/).length).toBeGreaterThan(0);
    expect(await screen.findByText('Servicos QR recentes')).toBeInTheDocument();
  });

  it('aciona atalhos principais', () => {
    const onOpenAIQuickProposal = vi.fn();
    const onTabChange = vi.fn();

    render(
      <DashboardView
        allSavedPdfs={[]}
        clients={[]}
        agendamentos={[]}
        films={[]}
        onTabChange={onTabChange}
        onOpenAIQuickProposal={onOpenAIQuickProposal}
        onOpenClientModal={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Nova proposta/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /Nova despesa/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Estoque/i }));

    expect(onOpenAIQuickProposal).toHaveBeenCalled();
    expect(screen.getByText('Salvar despesa')).toBeInTheDocument();
    expect(onTabChange).toHaveBeenCalledWith('estoque');
  });

  it('salva despesa avulsa pelo dashboard', async () => {
    render(
      <DashboardView
        allSavedPdfs={pdfs}
        clients={[{ id: 10, nome: 'Cliente A', telefone: '', email: '', cpfCnpj: '' }]}
        agendamentos={[]}
        films={[]}
        onTabChange={vi.fn()}
        onOpenAIQuickProposal={vi.fn()}
        onOpenClientModal={vi.fn()}
      />
    );

    await screen.findByText('Campanha local');

    fireEvent.click(screen.getAllByRole('button', { name: /Nova despesa/i })[0]);
    fireEvent.change(screen.getByPlaceholderText(/0,00/i), { target: { value: '120,50' } });
    fireEvent.change(screen.getByPlaceholderText(/mensalidade de trafego pago/i), { target: { value: 'Compra de ferramenta' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar despesa/i }));

    await waitFor(() => {
      expect(saveStandaloneExpense).toHaveBeenCalledWith(expect.objectContaining({
        amount: 120.5,
        description: 'Compra de ferramenta'
      }));
    });
  });

  it('envia filtros rapidos para o historico', () => {
    const onTabChange = vi.fn();

    render(
      <DashboardView
        allSavedPdfs={pdfs}
        clients={[{ id: 10, nome: 'Cliente A', telefone: '', email: '', cpfCnpj: '' }]}
        agendamentos={[]}
        films={[]}
        onTabChange={onTabChange}
        onOpenAIQuickProposal={vi.fn()}
        onOpenClientModal={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Gastos do periodo/i }));
    expect(window.localStorage.getItem('peliculas-br-history-focus-filter')).toBe('expenses');
    expect(onTabChange).toHaveBeenCalledWith('history');

    fireEvent.click(screen.getByRole('button', { name: /1 orcamentos pendentes/i }));
    expect(window.localStorage.getItem('peliculas-br-history-focus-filter')).toBe('pending');

    fireEvent.click(screen.getByRole('button', { name: /1 propostas vencidas/i }));
    expect(window.localStorage.getItem('peliculas-br-history-focus-filter')).toBe('expired');
  });

  it('mostra campos para intervalo personalizado', () => {
    render(
      <DashboardView
        allSavedPdfs={pdfs}
        clients={[]}
        agendamentos={[]}
        films={[]}
        onTabChange={vi.fn()}
        onOpenAIQuickProposal={vi.fn()}
        onOpenClientModal={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Abrir filtro de data desktop:/i }));

    const dialog = screen.getByRole('dialog', { name: 'Filtro de data desktop' });
    expect(within(dialog).getByRole('button', { name: 'Ontem' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /7 dias atras/i })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Personalizar' }));

    expect(within(dialog).getByLabelText('Data inicial')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Data final')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Aplicar' })).toBeInTheDocument();
  });

  it('abre seletor mobile de periodo e aplica intervalo personalizado', () => {
    render(
      <DashboardView
        allSavedPdfs={pdfs}
        clients={[]}
        agendamentos={[]}
        films={[]}
        onTabChange={vi.fn()}
        onOpenAIQuickProposal={vi.fn()}
        onOpenClientModal={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Abrir filtro de data:/i }));

    const dialog = screen.getByRole('dialog', { name: 'Filtro de periodo' });
    expect(within(dialog).getByRole('button', { name: /Personalizado/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /14 dias atras/i })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /Personalizado/i }));
    expect(within(dialog).getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button', { name: 'Editar datas manualmente' }).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric'
    }))).toBeInTheDocument();

    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Editar datas manualmente' })[0]);

    const manualDialog = screen.getByRole('dialog', { name: 'Editar datas manualmente' });
    const manualDateFields = within(manualDialog).getAllByPlaceholderText('dd/mm/aaaa');
    const futureManualDate = new Date(now);
    futureManualDate.setDate(now.getDate() + 1);

    fireEvent.change(manualDateFields[0], { target: { value: futureManualDate.toLocaleDateString('pt-BR') } });
    fireEvent.change(manualDateFields[1], { target: { value: now.toLocaleDateString('pt-BR') } });
    expect(within(manualDialog).getByText('Fora do intervalo.')).toBeInTheDocument();
    expect(within(manualDialog).getByRole('button', { name: 'OK' })).toBeDisabled();

    fireEvent.change(manualDateFields[0], { target: { value: '10/05/2026' } });
    fireEvent.change(manualDateFields[1], { target: { value: '12/05/2026' } });
    fireEvent.click(within(manualDialog).getByRole('button', { name: 'OK' }));

    expect(screen.queryByRole('dialog', { name: 'Editar datas manualmente' })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(screen.queryByRole('dialog', { name: 'Filtro de periodo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abrir filtro de data: 10\/05 - 12\/05/i })).toBeInTheDocument();
  }, 15_000);
});
