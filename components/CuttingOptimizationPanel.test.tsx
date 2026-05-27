import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CuttingOptimizationPanel from './CuttingOptimizationPanel';

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

vi.mock('../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    canUseCorteInteligente: true,
  }),
}));

vi.mock('./subscription/SubscriptionComponents', () => ({
  LockedScreen: () => <div>Locked</div>,
}));

describe('CuttingOptimizationPanel fullscreen', () => {
  it('abre o fullscreen ao clicar em Expandir', async () => {
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

    await waitFor(() => {
      expect(screen.getAllByTitle('Expandir tela cheia').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByTitle('Expandir tela cheia')[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: /mesa de corte expandida/i })).toBeInTheDocument();
    });
  });
});
