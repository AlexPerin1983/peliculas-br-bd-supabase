import type { ComponentProps, ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agendamento, SavedPDF } from '../../types';
import ReceiptModal from './ReceiptModal';

const receiptGeneratorMocks = vi.hoisted(() => ({
    downloadReceiptPdf: vi.fn(),
    shareReceiptPdf: vi.fn(),
}));

vi.mock('../../services/receiptGenerator', () => ({
    downloadReceiptPdf: receiptGeneratorMocks.downloadReceiptPdf,
    shareReceiptPdf: receiptGeneratorMocks.shareReceiptPdf,
}));

vi.mock('../ui/Modal', () => ({
    default: ({ isOpen, title, children, footer }: {
        isOpen: boolean;
        title: ReactNode;
        children: ReactNode;
        footer?: ReactNode;
    }) => isOpen ? (
        <div role="dialog">
            <div>{title}</div>
            <div>{children}</div>
            <div>{footer}</div>
        </div>
    ) : null,
}));

const appointment: Agendamento = {
    id: 42,
    clienteId: 7,
    clienteNome: 'João da Silva',
    start: '2026-07-16T12:00:00.000Z',
    end: '2026-07-16T14:00:00.000Z',
    serviceStatus: 'completed',
};

const makePdf = (id: number, film: string): SavedPDF => ({
    id,
    clienteId: appointment.clienteId,
    clientName: appointment.clienteNome,
    date: '2026-07-16',
    totalPreco: 425,
    totalM2: 5,
    nomeArquivo: `proposta-${id}.pdf`,
    measurements: [{ pelicula: film }] as SavedPDF['measurements'],
});

const baseProps: ComponentProps<typeof ReceiptModal> = {
    isOpen: true,
    onClose: vi.fn(),
    agendamento: appointment,
    amount: 850,
};

const renderReceipt = (overrides: Partial<ComponentProps<typeof ReceiptModal>> = {}) => render(
    <ReceiptModal {...baseProps} {...overrides} />,
);

describe('ReceiptModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        receiptGeneratorMocks.downloadReceiptPdf.mockResolvedValue(undefined);
        receiptGeneratorMocks.shareReceiptPdf.mockResolvedValue('shared');
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('preenche a descrição usando todos os orçamentos vinculados', () => {
        const linkedPdfs = [
            makePdf(10, 'Carbono Prime'),
            makePdf(11, 'Jateada'),
        ];

        renderReceipt({ linkedPdf: linkedPdfs[0], linkedPdfs });

        expect(screen.getByRole('textbox')).toHaveValue(
            'Serviço de fornecimento e aplicação de película: Carbono Prime, Jateada',
        );
    });

    it('prioriza a descrição salva no agendamento em vez do orçamento atual', () => {
        renderReceipt({
            agendamento: {
                ...appointment,
                receiptDescription: 'Instalação confirmada no encerramento do serviço',
            },
            linkedPdfs: [makePdf(10, 'Carbono Prime')],
        });

        expect(screen.getByRole('textbox')).toHaveValue(
            'Instalação confirmada no encerramento do serviço',
        );
    });

    it('impede a emissão enquanto algum orçamento vinculado ainda não carregou', async () => {
        renderReceipt({
            agendamento: { ...appointment, pdfId: 10, pdfIds: [10, 11] },
            linkedPdfs: [makePdf(10, 'Carbono Prime')],
        });

        await waitFor(() => expect(screen.getByRole('button', { name: /baixar pdf/i })).toBeDisabled());
        expect(screen.getByText(/aguarde enquanto carregamos todos os serviços/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /compartilhar/i })).toBeDisabled();
    });

    it('baixa com o texto editado e só depois salva a descrição confirmada', async () => {
        let finishDownload!: () => void;
        receiptGeneratorMocks.downloadReceiptPdf.mockImplementation(() => new Promise<void>((resolve) => {
            finishDownload = resolve;
        }));
        const onSaveDescription = vi.fn().mockResolvedValue(undefined);
        const editedDescription = 'Aplicação de película de controle solar na fachada';

        renderReceipt({
            linkedPdfs: [makePdf(10, 'Carbono Prime')],
            onSaveDescription,
        });

        fireEvent.change(screen.getByRole('textbox'), { target: { value: editedDescription } });
        fireEvent.click(screen.getByRole('button', { name: /baixar pdf/i }));

        await waitFor(() => expect(receiptGeneratorMocks.downloadReceiptPdf).toHaveBeenCalledTimes(1));
        expect(receiptGeneratorMocks.downloadReceiptPdf).toHaveBeenCalledWith(
            expect.objectContaining({ description: editedDescription }),
        );
        expect(onSaveDescription).not.toHaveBeenCalled();

        await act(async () => {
            finishDownload();
        });

        await waitFor(() => expect(onSaveDescription).toHaveBeenCalledWith(editedDescription));
        expect(
            receiptGeneratorMocks.downloadReceiptPdf.mock.invocationCallOrder[0],
        ).toBeLessThan(onSaveDescription.mock.invocationCallOrder[0]);
    });

    it('não salva o snapshot quando o compartilhamento é cancelado', async () => {
        const abortError = Object.assign(new Error('Compartilhamento cancelado'), { name: 'AbortError' });
        receiptGeneratorMocks.shareReceiptPdf.mockRejectedValue(abortError);
        const onSaveDescription = vi.fn().mockResolvedValue(undefined);

        renderReceipt({
            linkedPdfs: [makePdf(10, 'Carbono Prime')],
            onSaveDescription,
        });

        const shareButton = screen.getByRole('button', { name: /compartilhar/i });
        fireEvent.click(shareButton);

        await waitFor(() => expect(receiptGeneratorMocks.shareReceiptPdf).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(shareButton).not.toBeDisabled());
        expect(onSaveDescription).not.toHaveBeenCalled();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('mantém o download válido e avisa quando não consegue salvar a descrição', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const onSaveDescription = vi.fn().mockRejectedValue(new Error('Falha ao persistir'));

        renderReceipt({
            linkedPdfs: [makePdf(10, 'Carbono Prime')],
            onSaveDescription,
        });

        fireEvent.click(screen.getByRole('button', { name: /baixar pdf/i }));

        expect(await screen.findByRole('status')).toHaveTextContent(
            /recibo baixado, mas a descrição não pôde ser guardada para a próxima emissão/i,
        );
        expect(receiptGeneratorMocks.downloadReceiptPdf).toHaveBeenCalledTimes(1);
        expect(onSaveDescription).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(/não foi possível gerar o recibo/i)).not.toBeInTheDocument();
    });
});
