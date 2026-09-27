import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import ProposalPortalView from './ProposalPortalView';

// Em desenvolvimento, /p/demo/demo abre a proposta de demonstração (sem rede).
describe('página da proposta: prova social e opção recomendada', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/p/demo/demo');
    });

    it('mostra a nota do Google, a opção recomendada já marcada, fotos e depoimentos', async () => {
        render(<ProposalPortalView />);

        const rating = await screen.findByRole('link', { name: 'Nota 4,9 no Google' });
        expect(rating).toHaveAttribute('href', 'https://www.google.com/maps');
        expect(screen.getByText('· 127 avaliações no Google')).toBeInTheDocument();

        const options = screen.getByRole('region', { name: 'Opções da proposta' });
        const premium = within(options).getByRole('button', { name: /Opção Premium/ });
        expect(within(premium).getByText('Recomendada')).toBeInTheDocument();
        expect(premium).toHaveAttribute('aria-pressed', 'true');

        const works = screen.getByRole('region', { name: 'Trabalhos que já fizemos' });
        expect(within(works).getAllByRole('button')).toHaveLength(3);
        fireEvent.click(within(works).getByRole('button', { name: /Fachada de loja/ }));
        const lightbox = screen.getByRole('dialog', { name: 'Foto do trabalho' });
        expect(within(lightbox).getByText('2 de 3')).toBeInTheDocument();
        fireEvent.click(within(lightbox).getByRole('button', { name: 'Próxima foto' }));
        expect(within(lightbox).getByText('Varanda gourmet')).toBeInTheDocument();
        fireEvent.click(within(lightbox).getByRole('button', { name: 'Fechar foto' }));
        expect(screen.queryByRole('dialog', { name: 'Foto do trabalho' })).not.toBeInTheDocument();

        const reviews = screen.getByRole('region', { name: 'O que dizem nossos clientes' });
        expect(within(reviews).getByText(/A sala ficou bem mais fresca/)).toBeInTheDocument();
        expect(within(reviews).getByRole('link', { name: /Ver no Google/ })).toHaveAttribute('href', 'https://www.google.com/maps');
    });
});
