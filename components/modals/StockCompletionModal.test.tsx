import type { ComponentProps, ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agendamento, Bobina, SavedPDF } from '../../types';
import StockCompletionModal from './StockCompletionModal';

const estoqueMocks = vi.hoisted(() => ({
    getAllBobinas: vi.fn(),
}));

vi.mock('../../services/estoqueDb', () => ({
    getAllBobinas: estoqueMocks.getAllBobinas,
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

const agendamento: Agendamento = {
    id: 55,
    clienteId: 7,
    clienteNome: 'Cliente Estoque',
    start: '2026-08-07T12:00:00.000Z',
    end: '2026-08-07T14:00:00.000Z',
};

const makePdf = (estoqueUso = false): SavedPDF => ({
    id: 91,
    clienteId: agendamento.clienteId,
    clientName: agendamento.clienteNome,
    date: '2026-08-07',
    totalPreco: 480,
    totalM2: 1,
    nomeArquivo: 'proposta-91.pdf',
    measurements: [{
        id: 1,
        largura: '1',
        altura: '1',
        quantidade: 1,
        ambiente: 'Sala',
        tipoAplicacao: 'Janela',
        pelicula: 'Carbono Prime',
        active: true,
        ...(estoqueUso ? {
            estoqueUso: {
                tipo: 'retalho' as const,
                retalhoId: 10,
                filmId: 'Carbono Prime',
                larguraCm: 100,
                comprimentoCm: 100,
                codigoQr: 'RET-10',
                consumidoEm: '2026-08-07T14:00:00.000Z',
            },
        } : {}),
    }],
});

const makeBobina = (id: number, remaining = 20): Bobina => ({
    id,
    filmId: 'Carbono Prime',
    codigoQr: `BOB-${id}`,
    larguraCm: 152,
    comprimentoTotalM: 30,
    comprimentoRestanteM: remaining,
    status: 'ativa',
});

const baseProps: ComponentProps<typeof StockCompletionModal> = {
    isOpen: true,
    onClose: vi.fn(),
    agendamento,
    linkedPdfs: [makePdf()],
    onConfirm: vi.fn().mockResolvedValue(true),
    onSkip: vi.fn().mockResolvedValue(true),
};

const renderModal = (overrides: Partial<ComponentProps<typeof StockCompletionModal>> = {}) => render(
    <StockCompletionModal {...baseProps} {...overrides} />,
);

describe('StockCompletionModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        estoqueMocks.getAllBobinas.mockResolvedValue([makeBobina(10)]);
    });

    afterEach(() => cleanup());

    it('seleciona a unica bobina compatível e envia uma baixa rastreável', async () => {
        const onConfirm = vi.fn().mockResolvedValue(true);
        renderModal({ onConfirm });

        const select = await screen.findByRole('combobox', { name: /bobina utilizada para carbono prime/i });
        await waitFor(() => expect(select).toHaveTextContent('#10'));
        expect(select.tagName).toBe('BUTTON');

        const confirmButton = screen.getByRole('button', { name: /concluir e baixar estoque/i });
        await waitFor(() => expect(confirmButton).toBeEnabled());
        fireEvent.click(confirmButton);

        await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
        expect(onConfirm).toHaveBeenCalledWith([
            expect.objectContaining({
                bobinaId: 10,
                metrosConsumidos: expect.any(Number),
                sourceKey: 'agenda:55:film:carbono%20prime',
                filmId: 'Carbono Prime',
                pdfId: 91,
            }),
        ]);
        expect(onConfirm.mock.calls[0][0][0].metrosConsumidos).toBeGreaterThan(0);
    });

    it('exige escolha explícita quando existem duas bobinas compatíveis', async () => {
        estoqueMocks.getAllBobinas.mockResolvedValue([makeBobina(10), makeBobina(11)]);
        renderModal();

        const select = await screen.findByRole('combobox', { name: /bobina utilizada para carbono prime/i });
        expect(select).toHaveTextContent(/selecione a bobina/i);
        expect(screen.getByRole('button', { name: /concluir e baixar estoque/i })).toBeDisabled();
        expect(screen.getByText(/selecione a bobina realmente utilizada/i)).toBeInTheDocument();

        fireEvent.click(select);
        fireEvent.click(screen.getByRole('option', { name: /bobina 11/i }));

        expect(select).toHaveTextContent('#11');
        expect(screen.getByRole('button', { name: /concluir e baixar estoque/i })).toBeEnabled();
    });

    it('impede confirmar quando a estimativa ultrapassa o saldo da bobina', async () => {
        estoqueMocks.getAllBobinas.mockResolvedValue([makeBobina(10, 0.2)]);
        renderModal();

        expect(await screen.findByText(/saldo insuficiente/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /concluir e baixar estoque/i })).toBeDisabled();
    });

    it('não desconta novamente uma medida já consumida como retalho', async () => {
        const onSkip = vi.fn().mockResolvedValue(true);
        renderModal({ linkedPdfs: [makePdf(true)], onSkip });

        expect(await screen.findByText(/retalho já baixada/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /concluir e baixar estoque/i })).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: /concluir sem baixar agora/i }));
        await waitFor(() => expect(onSkip).toHaveBeenCalledTimes(1));
    });
});
