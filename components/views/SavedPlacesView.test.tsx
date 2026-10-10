import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SavedPlacesView from './SavedPlacesView';
import { FeedbackProvider } from '../../src/contexts/FeedbackContext';
import { SAVED_PLACES_STORAGE_KEY } from '../../services/savedPlacesService';

const renderView = () =>
    render(
        <FeedbackProvider>
            <SavedPlacesView />
        </FeedbackProvider>
    );

const seedPlaces = () => {
    window.localStorage.setItem(SAVED_PLACES_STORAGE_KEY, JSON.stringify([
        { id: 'p1', name: 'Almoço perto da Aldeota', category: 'almoco', address: 'Rua Tibúrcio Cavalcante, 1100', notes: '', latitude: null, longitude: null, createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-03T10:00:00.000Z' },
        { id: 'p2', name: 'Obra Mirante', category: 'cliente', address: 'Local salvo pela posição atual', notes: 'Entrada pela garagem', latitude: -3.72, longitude: -38.51, createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-02T10:00:00.000Z' },
    ]));
};

describe('SavedPlacesView', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it('cadastra um endereço e oferece a rota direto na lista', () => {
        renderView();

        fireEvent.click(screen.getByRole('button', { name: /Novo/ }));
        fireEvent.change(screen.getByLabelText('Apelido do local'), {
            target: { value: 'Almoço de sexta' }
        });
        fireEvent.change(screen.getByLabelText(/Endereço ou ponto de referência/), {
            target: { value: 'Rua das Flores, 123' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Salvar local' }));

        expect(screen.getByText('Almoço de sexta')).toBeInTheDocument();
        expect(screen.getByText('Almoço · Rua das Flores, 123')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Abrir rota para Almoço de sexta' })).toHaveAttribute(
            'href',
            'https://www.google.com/maps/dir/?api=1&destination=Rua%20das%20Flores%2C%20123&travelmode=driving'
        );
    });

    it('captura a posição atual somente quando o usuário solicita e permite remover', () => {
        const getCurrentPosition = vi.fn().mockImplementation(success => {
            success({ coords: { latitude: -3.731862, longitude: -38.526669 } });
        });
        Object.defineProperty(navigator, 'geolocation', {
            configurable: true,
            value: { getCurrentPosition }
        });

        renderView();
        expect(getCurrentPosition).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: /Novo/ }));
        expect(screen.getByLabelText('Apelido do local')).not.toHaveFocus();
        fireEvent.click(screen.getByRole('button', { name: /Usar onde estou agora/ }));

        expect(getCurrentPosition).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Posição exata salva')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Remover posição do GPS' }));
        expect(screen.getByRole('button', { name: /Usar onde estou agora/ })).toBeInTheDocument();
    });

    it('busca sem acento e filtra por categoria', async () => {
        seedPlaces();
        renderView();

        expect(screen.getByText('2 locais · salvos neste aparelho')).toBeInTheDocument();

        fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar locais salvos' }), { target: { value: 'almoco' } });
        expect(screen.getByText('Almoço perto da Aldeota')).toBeInTheDocument();
        expect(screen.queryByText('Obra Mirante')).not.toBeInTheDocument();

        fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar locais salvos' }), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: /^Cliente/ }));
        expect(screen.getByText('Obra Mirante')).toBeInTheDocument();
        expect(screen.queryByText('Almoço perto da Aldeota')).not.toBeInTheDocument();
        expect(screen.getByText('1 encontrado')).toBeInTheDocument();
    });

    it('abre a ficha com rota, mapa e compartilhar, sem o texto antigo de endereço do GPS', async () => {
        seedPlaces();
        renderView();

        expect(screen.getByText('Cliente · Posição pelo GPS')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Obra Mirante'));

        const sheet = await screen.findByRole('dialog', { name: 'Obra Mirante' });
        expect(within(sheet).getByRole('link', { name: /Rota/ })).toHaveAttribute('href', expect.stringContaining('destination=-3.72%2C-38.51'));
        expect(within(sheet).getByRole('link', { name: /Ver no mapa/ })).toBeInTheDocument();
        expect(within(sheet).getByRole('button', { name: /Compartilhar/ })).toBeInTheDocument();
        expect(within(sheet).getByText('Posição exata pelo GPS')).toBeInTheDocument();
        expect(within(sheet).getByText('Entrada pela garagem')).toBeInTheDocument();
        expect(within(sheet).queryByText('Local salvo pela posição atual')).not.toBeInTheDocument();
    });

    it('exclui pela ficha depois de confirmar', async () => {
        seedPlaces();
        renderView();
        fireEvent.click(screen.getByText('Almoço perto da Aldeota'));
        const sheet = await screen.findByRole('dialog', { name: 'Almoço perto da Aldeota' });
        fireEvent.click(within(sheet).getByRole('button', { name: /Excluir/ }));

        await act(async () => {
            fireEvent.click(await screen.findByRole('button', { name: 'Excluir local' }));
        });

        await waitFor(() => expect(screen.queryByText('Almoço perto da Aldeota')).not.toBeInTheDocument());
        expect(JSON.parse(window.localStorage.getItem(SAVED_PLACES_STORAGE_KEY) || '[]')).toHaveLength(1);
    });
});
