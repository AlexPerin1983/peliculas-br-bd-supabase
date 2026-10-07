import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PdfGenerationStatusModal from './PdfGenerationStatusModal';

vi.mock('./ProposalShareModal', () => ({
    default: ({ autoCreate, pdfs }: { autoCreate?: boolean; pdfs: Array<{ proposalOptionName?: string }> }) => (
        <>
            <div>{autoCreate ? 'Link automático aberto' : 'Link aberto'}</div>
            <div data-testid="link-pdfs">{pdfs.map(pdf => pdf.proposalOptionName).join(' + ')}</div>
        </>
    ),
}));

const client = { id: 7, nome: 'Camila', telefone: '83999990000', email: '', cpfCnpj: '' };
const proposal = (id: number, proposalOptionName: string, totalPreco: number, date: string) =>
    ({ id, clienteId: 7, proposalOptionName, totalPreco, date, totalM2: 1, nomeArquivo: `${id}.pdf`, status: 'pending' }) as any;
const baseProps = () => ({
    status: 'success' as const,
    onClose: vi.fn(),
    onGoToHistory: vi.fn(),
    onShare: vi.fn().mockResolvedValue('shared'),
    onPreview: vi.fn().mockReturnValue(true),
    canShare: true,
    canPreview: true,
});

describe('PdfGenerationStatusModal', () => {
    it('compartilha o PDF recém-gerado pelo botão principal', async () => {
        const onShare = vi.fn().mockResolvedValue('shared');

        render(
            <PdfGenerationStatusModal
                status="success"
                onClose={vi.fn()}
                onGoToHistory={vi.fn()}
                onShare={onShare}
                onPreview={vi.fn().mockReturnValue(true)}
                canShare
                canPreview
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /compartilhar pdf/i }));

        await waitFor(() => expect(onShare).toHaveBeenCalledTimes(1));
        expect(await screen.findByText(/pdf compartilhado com sucesso/i)).toBeInTheDocument();
    });

    it('explica quando o navegador baixa o arquivo como alternativa', async () => {
        render(
            <PdfGenerationStatusModal
                status="success"
                onClose={vi.fn()}
                onGoToHistory={vi.fn()}
                onShare={vi.fn().mockResolvedValue('downloaded')}
                onPreview={vi.fn().mockReturnValue(true)}
                canShare
                canPreview
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /compartilhar pdf/i }));
        expect(await screen.findByText(/arquivo foi baixado para você enviar/i)).toBeInTheDocument();
    });

    it('abre o PDF para conferência antes do compartilhamento', () => {
        const onPreview = vi.fn().mockReturnValue(true);

        render(
            <PdfGenerationStatusModal
                status="success"
                onClose={vi.fn()}
                onGoToHistory={vi.fn()}
                onShare={vi.fn().mockResolvedValue('shared')}
                onPreview={onPreview}
                canShare
                canPreview
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /visualizar pdf/i }));

        expect(onPreview).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/pdf aberto para conferência/i)).toBeInTheDocument();
    });

    it('abre a criação automática do link para WhatsApp da proposta salva', () => {
        render(
            <PdfGenerationStatusModal
                status="success"
                onClose={vi.fn()}
                onGoToHistory={vi.fn()}
                onShare={vi.fn().mockResolvedValue('shared')}
                onPreview={vi.fn().mockReturnValue(true)}
                canShare
                canPreview
                proposalForLink={{
                    client: { id: 7, nome: 'Camila', telefone: '83999990000', email: '', cpfCnpj: '' },
                    pdf: { id: 42, clienteId: 7, totalPreco: 500 } as any,
                }}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /criar link e enviar/i }));
        expect(screen.getByText('Link automático aberto')).toBeInTheDocument();
    });

    it('mostra a opção gerada no topo e oferece duplicar com outra película', () => {
        const onDuplicateWithFilm = vi.fn();
        render(
            <PdfGenerationStatusModal
                {...baseProps()}
                proposalForLink={{ client, pdf: proposal(42, 'Suntek', 2649.6, '2026-10-07T10:00:00Z') }}
                onDuplicateWithFilm={onDuplicateWithFilm}
            />
        );

        expect(screen.getByRole('heading', { name: 'Orçamento gerado' })).toBeInTheDocument();
        expect(screen.getByText(/Suntek · R\$\s2\.649,60/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Duplicar com outra película' }));
        expect(onDuplicateWithFilm).toHaveBeenCalledTimes(1);
    });

    it('sem duplicação possível, não mostra a seção de outra opção', () => {
        render(<PdfGenerationStatusModal {...baseProps()} />);

        expect(screen.queryByRole('button', { name: 'Duplicar com outra película' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ver Histórico' })).toBeInTheDocument();
    });

    it('depois de duplicar, manda as opções marcadas juntas num link', () => {
        const original = proposal(42, 'Suntek', 2649.6, '2026-10-07T10:00:00Z');
        const nova = proposal(43, 'Window Premium', 3120, '2026-10-07T10:05:00Z');
        const antiga = proposal(30, 'Opção antiga', 1000, '2026-09-01T10:00:00Z');
        render(
            <PdfGenerationStatusModal
                {...baseProps()}
                proposalForLink={{ client, pdf: nova }}
                clientProposals={[nova, original, antiga]}
                preselectedPdfIds={[42, 43]}
                onDuplicateWithFilm={vi.fn()}
            />
        );

        expect(screen.getByRole('heading', { name: 'Nova opção gerada' })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /Window Premium/ })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: /Suntek/ })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: /Opção antiga/ })).not.toBeChecked();

        fireEvent.click(screen.getByRole('checkbox', { name: /Opção antiga/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Enviar as 3 pelo WhatsApp' }));
        expect(screen.getByTestId('link-pdfs')).toHaveTextContent('Window Premium + Suntek + Opção antiga');
    });

    it('não envia sem nenhuma opção marcada', () => {
        const original = proposal(42, 'Suntek', 2649.6, '2026-10-07T10:00:00Z');
        const nova = proposal(43, 'Window Premium', 3120, '2026-10-07T10:05:00Z');
        render(
            <PdfGenerationStatusModal
                {...baseProps()}
                proposalForLink={{ client, pdf: nova }}
                clientProposals={[nova, original]}
                preselectedPdfIds={[42, 43]}
            />
        );

        fireEvent.click(screen.getByRole('checkbox', { name: /Window Premium/ }));
        expect(screen.getByRole('button', { name: 'Enviar 1 opção pelo WhatsApp' })).toBeEnabled();
        fireEvent.click(screen.getByRole('checkbox', { name: /Suntek/ }));
        expect(screen.getByRole('button', { name: 'Marque ao menos uma opção' })).toBeDisabled();
    });
});
