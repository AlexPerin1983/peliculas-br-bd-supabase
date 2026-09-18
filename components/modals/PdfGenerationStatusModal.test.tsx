import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PdfGenerationStatusModal from './PdfGenerationStatusModal';

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
});
