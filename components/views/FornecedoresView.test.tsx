import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import FornecedoresView from './FornecedoresView';
import { FeedbackProvider } from '../../src/contexts/FeedbackContext';
import { Fornecedor } from '../../types';
import * as service from '../../services/fornecedorService';

vi.mock('../../services/fornecedorService', () => ({
    getFornecedores: vi.fn(),
    saveFornecedor: vi.fn(),
    deleteFornecedor: vi.fn(),
    migrateFromLocalStorage: vi.fn().mockResolvedValue(0),
    createFornecedor: (partial = {}) => ({ id: 'temp-1', empresa: '', contato: '', telefone: '', criadoEm: '', ...partial }),
}));

const fornecedores: Fornecedor[] = [
    { id: 'f2', empresa: 'Filmes & Cia', contato: 'Patrícia', telefone: '(81) 3344-1200', representacoes: 'Decorativas, Jateadas', criadoEm: '' },
    { id: 'f1', empresa: 'Distribuidora Solar', contato: 'Marcelo', telefone: '(85) 3021-4400', representacoes: 'Nano cerâmica, Controle solar, Segurança', email: 'vendas@solar.com', endereco: 'Rua A, 900 - Fortaleza', observacao: 'Entrega em 24 h', criadoEm: '' },
];

const renderView = async () => {
    render(
        <FeedbackProvider>
            <FornecedoresView />
        </FeedbackProvider>
    );
    await screen.findByText('Distribuidora Solar');
};

describe('FornecedoresView', () => {
    beforeEach(() => {
        vi.mocked(service.getFornecedores).mockResolvedValue(fornecedores.map(item => ({ ...item })));
        vi.mocked(service.saveFornecedor).mockImplementation(async (item: Fornecedor) => ({ ...item, id: item.id.startsWith('temp-') ? 'novo-1' : item.id }));
        vi.mocked(service.deleteFornecedor).mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('lista em ordem alfabética com contato, marcas e WhatsApp direto na linha', async () => {
        await renderView();

        expect(screen.getByText('2 fornecedores')).toBeInTheDocument();
        const names = screen.getAllByRole('listitem').map(item => within(item).getAllByText(/Distribuidora Solar|Filmes & Cia/)[0].textContent);
        expect(names).toEqual(['Distribuidora Solar', 'Filmes & Cia']);
        expect(screen.getByText('Marcelo · Nano cerâmica, Controle solar +1')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'WhatsApp de Filmes & Cia' })).toBeInTheDocument();
    });

    it('no computador o WhatsApp da linha abre a conversa direto', async () => {
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        await renderView();

        fireEvent.click(screen.getByRole('button', { name: 'WhatsApp de Distribuidora Solar' }));

        expect(open).toHaveBeenCalledWith('https://wa.me/558530214400', '_blank', 'noopener,noreferrer');
        expect(screen.queryByText('Conversar no WhatsApp')).not.toBeInTheDocument();
        open.mockRestore();
    });

    it('mostra as marcas com a primeira letra maiúscula', async () => {
        vi.mocked(service.getFornecedores).mockResolvedValue([
            { id: 'f9', empresa: 'Atacado Sul', contato: 'Rui', telefone: '(51) 3000-1000', representacoes: 'fumê, jateada', criadoEm: '' },
        ]);
        render(
            <FeedbackProvider>
                <FornecedoresView />
            </FeedbackProvider>
        );

        expect(await screen.findByText('Rui · Fumê, Jateada')).toBeInTheDocument();
    });

    it('busca por marca e por telefone sem pontuação', async () => {
        await renderView();
        const search = screen.getByRole('searchbox', { name: 'Buscar fornecedor' });

        fireEvent.change(search, { target: { value: 'jateadas' } });
        await waitFor(() => expect(screen.queryByText('Distribuidora Solar')).not.toBeInTheDocument());
        expect(screen.getByText('Filmes & Cia')).toBeInTheDocument();
        expect(screen.getByText('1 encontrado')).toBeInTheDocument();

        fireEvent.change(search, { target: { value: '8530214400' } });
        await waitFor(() => expect(screen.getByText('Distribuidora Solar')).toBeInTheDocument());
        expect(screen.queryByText('Filmes & Cia')).not.toBeInTheDocument();
    });

    it('abre a ficha com atalhos de contato e os dados do fornecedor', async () => {
        await renderView();
        fireEvent.click(screen.getByText('Distribuidora Solar'));

        const sheet = await screen.findByRole('dialog', { name: 'Distribuidora Solar' });
        expect(within(sheet).getByRole('link', { name: /Ligar/ })).toHaveAttribute('href', 'tel:+558530214400');
        expect(within(sheet).getByRole('link', { name: /Rota/ })).toHaveAttribute('href', expect.stringContaining('google.com/maps'));
        expect(within(sheet).getByRole('link', { name: /E-mail/ })).toHaveAttribute('href', 'mailto:vendas@solar.com');
        expect(within(sheet).getByRole('button', { name: /WhatsApp/ })).toBeInTheDocument();
        expect(within(sheet).getByText('Segurança')).toBeInTheDocument();
        expect(within(sheet).getByText('Entrega em 24 h')).toBeInTheDocument();
    });

    it('exclui pela ficha depois de confirmar', async () => {
        await renderView();
        fireEvent.click(screen.getByText('Filmes & Cia'));
        const sheet = await screen.findByRole('dialog', { name: 'Filmes & Cia' });
        fireEvent.click(within(sheet).getByRole('button', { name: /Excluir/ }));

        await act(async () => {
            fireEvent.click(await screen.findByRole('button', { name: 'Sim, excluir' }));
        });

        expect(service.deleteFornecedor).toHaveBeenCalledWith('f2');
        await waitFor(() => expect(screen.queryByText('Filmes & Cia')).not.toBeInTheDocument());
    });

    it('formata o telefone ao digitar e exige empresa, contato e telefone', async () => {
        await renderView();
        fireEvent.click(screen.getByRole('button', { name: /Novo/ }));

        const phone = await screen.findByLabelText(/Telefone/);
        fireEvent.change(phone, { target: { value: '85988776655' } });
        expect(phone).toHaveValue('(85) 98877-6655');

        fireEvent.click(screen.getByRole('button', { name: 'Adicionar fornecedor' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Preencha empresa, contato e telefone');
        expect(service.saveFornecedor).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText(/Empresa/), { target: { value: 'Atacado Novo' } });
        fireEvent.change(screen.getByLabelText(/Contato/), { target: { value: 'Ana' } });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Adicionar fornecedor' }));
        });

        expect(service.saveFornecedor).toHaveBeenCalledWith(expect.objectContaining({ empresa: 'Atacado Novo', contato: 'Ana', telefone: '(85) 98877-6655' }));
        expect(await screen.findByText('Atacado Novo')).toBeInTheDocument();
    });
});
