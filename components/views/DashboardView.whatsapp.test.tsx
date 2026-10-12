import { fireEvent, render, screen } from '@testing-library/react';
import DashboardView from './DashboardView';
import { FeedbackProvider } from '../../src/contexts/FeedbackContext';
import { useWhatsAppTriage } from '../../src/hooks/useWhatsAppTriage';

vi.mock('../../services/servicosService', () => ({ getAllServicosPrestados: vi.fn().mockResolvedValue([]) }));
vi.mock('../../services/db', () => ({
    getAllStandaloneExpenses: vi.fn().mockResolvedValue([]),
    saveStandaloneExpense: vi.fn(),
    deleteStandaloneExpense: vi.fn(),
    getPDFPage: vi.fn().mockResolvedValue({ pdfs: [], hasMore: false, nextOffset: 0 }),
}));
vi.mock('../../src/hooks/useWhatsAppTriage', () => ({ useWhatsAppTriage: vi.fn() }));

const renderDashboard = () => render(
    <FeedbackProvider>
        <DashboardView allSavedPdfs={[]} clients={[]} agendamentos={[]} films={[]} onTabChange={vi.fn()} onOpenAIQuickProposal={vi.fn()} onOpenClientModal={vi.fn()} />
    </FeedbackProvider>
);

describe('DashboardView · triagem do WhatsApp', () => {
    beforeEach(() => window.localStorage.clear());

    it('não aparece para quem não tem o WhatsApp conectado', () => {
        vi.mocked(useWhatsAppTriage).mockReturnValue({ enabled: false, pending: [], recent: [], refresh: vi.fn() });
        renderDashboard();
        expect(screen.queryByText(/do WhatsApp para revisar/)).not.toBeInTheDocument();
    });

    it('mostra quantos contatos esperam revisão e abre a triagem', () => {
        vi.mocked(useWhatsAppTriage).mockReturnValue({
            enabled: true,
            recent: [],
            refresh: vi.fn(),
            pending: [
                { id: 1, phone: '5583999998888', name: 'Kleidson', category: 'novo_cliente', confidence: 1, source: 'jev', snippet: 'Oi', lastMessageAt: null },
                { id: 2, phone: '5581988887777', name: 'Somma', category: 'fornecedor', confidence: 0.95, source: 'regra', snippet: 'Pix', lastMessageAt: null },
            ],
        });
        renderDashboard();
        expect(screen.getByText('2 contatos do WhatsApp para revisar')).toBeInTheDocument();
        expect(screen.getByText('1 possível cliente · 1 fornecedor')).toBeInTheDocument();
        fireEvent.click(screen.getByText('2 contatos do WhatsApp para revisar'));
        expect(screen.getByText('Triagem do WhatsApp')).toBeInTheDocument();
        expect(screen.getByText('Cliente novo · 100% · Jev')).toBeInTheDocument();
    });
});
