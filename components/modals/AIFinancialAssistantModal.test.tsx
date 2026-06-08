import { render, screen, waitFor } from '@testing-library/react';
import AIFinancialAssistantModal, { FinancialSummary } from './AIFinancialAssistantModal';

// Mock do SDK Gemini para espionar se a IA e (ou nao) chamada.
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: class {
        getGenerativeModel() {
            return { generateContent };
        }
    }
}));

const baseSummary: FinancialSummary = {
    periodo: 'Este mes',
    faturamentoTotal: 10000,
    faturamentoAprovado: 6000,
    despesas: 3000,
    lucroEstimado: 3000,
    margemEstimada: 30,
    ticketMedio: 1000,
    taxaAprovacao: 60,
    orcamentosGerados: 10,
    orcamentosAprovados: 6,
    orcamentosPendentes: 4,
    totalM2: 50,
    gastoDiarioMedio: 100,
    gastosPorCategoria: [{ label: 'Material', value: 2000 }],
    melhorCliente: { name: 'Cliente A', value: 4000 },
    peliculaMaisUsada: { name: 'Fume', area: 30, quantity: 5 }
};

const emptySummary: FinancialSummary = {
    ...baseSummary,
    faturamentoTotal: 0,
    faturamentoAprovado: 0,
    despesas: 0,
    lucroEstimado: 0,
    margemEstimada: 0,
    ticketMedio: 0,
    taxaAprovacao: 0,
    orcamentosGerados: 0,
    orcamentosAprovados: 0,
    orcamentosPendentes: 0,
    totalM2: 0,
    gastoDiarioMedio: 0,
    gastosPorCategoria: [],
    melhorCliente: null,
    peliculaMaisUsada: null
};

describe('AIFinancialAssistantModal', () => {
    beforeEach(() => {
        generateContent.mockReset();
    });

    it('nao chama a IA quando nao ha chave de API configurada', () => {
        render(
            <AIFinancialAssistantModal
                isOpen
                onClose={vi.fn()}
                summary={baseSummary}
                apiKey={undefined}
                provider={undefined}
                cache={null}
                onCached={vi.fn()}
            />
        );

        expect(screen.getByText(/configure o provedor/i)).toBeInTheDocument();
        expect(generateContent).not.toHaveBeenCalled();
    });

    it('nao chama a IA quando nao ha dados no periodo', () => {
        render(
            <AIFinancialAssistantModal
                isOpen
                onClose={vi.fn()}
                summary={emptySummary}
                apiKey="key-123"
                provider="gemini"
                cache={null}
                onCached={vi.fn()}
            />
        );

        expect(screen.getByText(/ainda nao ha dados suficientes/i)).toBeInTheDocument();
        expect(generateContent).not.toHaveBeenCalled();
    });

    it('reaproveita o cache sem chamar a IA quando os numeros nao mudaram', () => {
        const signature = JSON.stringify(baseSummary);
        render(
            <AIFinancialAssistantModal
                isOpen
                onClose={vi.fn()}
                summary={baseSummary}
                apiKey="key-123"
                provider="gemini"
                cache={{ signature, text: '## Diagnostico\nTudo certo.' }}
                onCached={vi.fn()}
            />
        );

        expect(screen.getByText('Diagnostico')).toBeInTheDocument();
        expect(screen.getByText('Tudo certo.')).toBeInTheDocument();
        expect(generateContent).not.toHaveBeenCalled();
    });

    it('chama a IA uma vez e renderiza a analise quando ha chave e dados', async () => {
        generateContent.mockResolvedValue({
            response: { text: () => '## Diagnostico\nMargem saudavel.\n\n## Pontos fortes\n- Boa **margem**' }
        });

        const onCached = vi.fn();
        render(
            <AIFinancialAssistantModal
                isOpen
                onClose={vi.fn()}
                summary={baseSummary}
                apiKey="key-123"
                provider="gemini"
                cache={null}
                onCached={onCached}
            />
        );

        await waitFor(() => expect(generateContent).toHaveBeenCalledTimes(1));
        await screen.findByText(/Margem saudavel/);
        expect(onCached).toHaveBeenCalledTimes(1);
    });
});
