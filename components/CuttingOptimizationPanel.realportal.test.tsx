import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CuttingOptimizationPanel from './CuttingOptimizationPanel';

vi.mock('../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    canUseCorteInteligente: true,
  }),
}));

vi.mock('./subscription/SubscriptionComponents', () => ({
  LockedScreen: () => <div>Locked</div>,
}));

describe('CuttingOptimizationPanel fullscreen with real portal', () => {
  const renderPanel = () =>
    render(
      <CuttingOptimizationPanel
        measurements={[
          {
            id: 1,
            largura: '100',
            altura: '100',
            quantidade: 2,
            ambiente: 'Janela',
            tipoAplicacao: 'vidro',
            pelicula: 'Jateada',
            active: true,
          },
        ]}
        clientId={1}
        optionId={1}
        films={[
          {
            nome: 'Jateada',
            preco: 120,
            precoMetroLinear: 50,
          },
        ]}
      />
    );

  it('opens fullscreen from the first Expandir button', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByTitle('Expandir tela cheia').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByTitle('Expandir tela cheia')[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ver mesa na horizontal/i })).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: /mesa de corte expandida/i })).toBeInTheDocument();
    });

    const roll = screen.getByTestId('fullscreen-cutting-roll');
    expect(parseFloat(roll.style.width)).toBeGreaterThan(0);
  });

  it('opens fullscreen from the second Expandir button', async () => {
    cleanup();
    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByTitle('Expandir tela cheia').length).toBeGreaterThan(1);
    });

    fireEvent.click(screen.getAllByTitle('Expandir tela cheia')[1]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ver mesa na horizontal/i })).toBeInTheDocument();
    });
  });

  it('closes fullscreen with Escape', async () => {
    cleanup();
    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByTitle('Expandir tela cheia').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByTitle('Expandir tela cheia')[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /mesa de corte expandida/i })).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /mesa de corte expandida/i })).not.toBeInTheDocument();
    });
  });
});
