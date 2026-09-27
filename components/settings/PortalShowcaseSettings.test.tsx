import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortalShowcaseSettings from './PortalShowcaseSettings';
import { deletePortfolioPhoto, getPortalShowcase, savePortalShowcase } from '../../services/supabaseDb';

vi.mock('../../services/supabaseDb', () => ({
    getPortalShowcase: vi.fn(),
    savePortalShowcase: vi.fn(),
    uploadPortfolioPhoto: vi.fn(),
    deletePortfolioPhoto: vi.fn(),
    getPortfolioPhotoUrl: (path: string) => `https://cdn/${path}`,
}));

describe('Configurações: página da proposta', () => {
    beforeEach(() => {
        vi.mocked(getPortalShowcase).mockReset().mockResolvedValue({ googleRating: 4.9, googleReviewCount: 127, testimonials: [], photos: [{ path: 'owner/a.jpg', caption: 'Sala' }] });
        vi.mocked(savePortalShowcase).mockReset().mockResolvedValue(undefined);
        vi.mocked(deletePortfolioPhoto).mockReset().mockResolvedValue(undefined);
    });

    it('edita nota e depoimento e salva', async () => {
        render(<PortalShowcaseSettings />);
        const rating = await screen.findByLabelText('Nota no Google');
        expect(rating).toHaveValue('4,9');

        fireEvent.change(rating, { target: { value: '4,8' } });
        fireEvent.click(screen.getByRole('button', { name: /Adicionar depoimento/ }));
        fireEvent.change(screen.getByLabelText('Nome do depoimento 1'), { target: { value: 'Ana P.' } });
        fireEvent.change(screen.getByLabelText('Texto do depoimento 1'), { target: { value: 'Ficou ótimo, recomendo.' } });
        fireEvent.click(screen.getByRole('button', { name: /Salvar página da proposta/ }));

        await waitFor(() => expect(savePortalShowcase).toHaveBeenCalledWith(expect.objectContaining({
            googleRating: 4.8,
            googleReviewCount: 127,
            testimonials: [{ name: 'Ana P.', text: 'Ficou ótimo, recomendo.' }],
            photos: [{ path: 'owner/a.jpg', caption: 'Sala' }],
        })));
        expect(await screen.findByText('Salvo')).toBeInTheDocument();
    });

    it('remover a foto salva a vitrine e apaga o arquivo', async () => {
        render(<PortalShowcaseSettings />);
        const photos = await screen.findByRole('region', { name: 'Fotos de trabalhos' });
        expect(within(photos).getByRole('img', { name: 'Sala' })).toHaveAttribute('src', 'https://cdn/owner/a.jpg');

        fireEvent.click(within(photos).getByRole('button', { name: 'Remover foto 1' }));
        await waitFor(() => expect(savePortalShowcase).toHaveBeenCalledWith(expect.objectContaining({ photos: [] })));
        expect(deletePortfolioPhoto).toHaveBeenCalledWith('owner/a.jpg');
    });
});
