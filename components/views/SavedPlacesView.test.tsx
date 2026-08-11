import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SavedPlacesView from './SavedPlacesView';
import { FeedbackProvider } from '../../src/contexts/FeedbackContext';

const renderView = () =>
    render(
        <FeedbackProvider>
            <SavedPlacesView />
        </FeedbackProvider>
    );

describe('SavedPlacesView', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it('cadastra um endereço e oferece a ação de abrir rota', () => {
        renderView();

        fireEvent.click(screen.getByRole('button', { name: 'Salvar local' }));
        fireEvent.change(screen.getByLabelText('Apelido do local'), {
            target: { value: 'Almoço de sexta' }
        });
        fireEvent.change(screen.getByLabelText('Endereço ou ponto de referência'), {
            target: { value: 'Rua das Flores, 123' }
        });
        const saveButtons = screen.getAllByRole('button', { name: 'Salvar local' });
        expect(saveButtons).toHaveLength(2);
        fireEvent.click(saveButtons[1]);

        expect(screen.getByText('Almoço de sexta')).toBeInTheDocument();
        expect(screen.getByText('Rua das Flores, 123')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Abrir rota para Almoço de sexta' })).toHaveAttribute(
            'href',
            'https://www.google.com/maps/dir/?api=1&destination=Rua%20das%20Flores%2C%20123&travelmode=driving'
        );
    });

    it('captura a posição atual somente quando o usuário solicita', () => {
        const getCurrentPosition = vi.fn().mockImplementation(success => {
            success({ coords: { latitude: -3.731862, longitude: -38.526669 } });
        });
        Object.defineProperty(navigator, 'geolocation', {
            configurable: true,
            value: { getCurrentPosition }
        });

        renderView();
        expect(getCurrentPosition).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Salvar local' }));
        fireEvent.click(screen.getByRole('button', { name: 'Usar onde estou agoraO celular pedirá permissão para acessar o GPS.' }));

        expect(getCurrentPosition).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Posição exata capturada com sucesso')).toBeInTheDocument();
    });
});
