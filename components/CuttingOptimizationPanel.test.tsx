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

describe('CuttingOptimizationPanel roll widths', () => {
  it('oferece larguras prontas e envia a largura escolhida para a proposta', async () => {
    const onCuttingSettingsChange = vi.fn();

    render(
      <CuttingOptimizationPanel
        measurements={[
          {
            id: 1,
            largura: '0,70',
            altura: '1,00',
            quantidade: 2,
            ambiente: 'Janela',
            tipoAplicacao: 'vidro',
            pelicula: 'Color Stable',
            active: true,
          },
        ]}
        clientId={1}
        optionId={1}
        films={[{ nome: 'Color Stable', preco: 100, precoMetroLinear: 110 }]}
        onCuttingSettingsChange={onCuttingSettingsChange}
      />
    );

    const triggers = await screen.findAllByRole('button', { name: 'Selecionar largura da bobina' });
    fireEvent.click(triggers[0]);

    expect(screen.getByRole('dialog', { name: 'Escolher largura da bobina' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1,00 m' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1,22 m' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1,50 m' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1,52 m' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1,82 m' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '1,22 m' }));
    expect(onCuttingSettingsChange).toHaveBeenLastCalledWith('Color Stable', {
      rollWidthCm: 122,
      bladeWidthMm: 0,
      respectGrain: false,
    });

    fireEvent.click(triggers[0]);
    fireEvent.click(screen.getByRole('button', { name: /Personalizada/i }));
    expect(screen.getAllByRole('spinbutton', { name: /largura personalizada/i }).length).toBeGreaterThan(0);
  });
});
