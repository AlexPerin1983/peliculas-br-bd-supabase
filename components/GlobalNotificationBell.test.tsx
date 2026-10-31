import { act, render } from '@testing-library/react';
import GlobalNotificationBell from './GlobalNotificationBell';

const mocks = vi.hoisted(() => ({
  handlers: [] as Array<() => void>,
  loadCompanyProposalPortals: vi.fn(),
  getAllAgendamentos: vi.fn()
}));

vi.mock('../services/db', () => ({ getAllAgendamentos: mocks.getAllAgendamentos }));
vi.mock('../src/lib/proposalPortal', () => ({
  loadCompanyProposalPortals: mocks.loadCompanyProposalPortals,
  markCompanyProposalPortalRead: vi.fn()
}));
vi.mock('../services/supabaseClient', () => ({
  supabase: {
    channel: () => {
      const channel = {
        on: (_event: string, _filter: unknown, handler: () => void) => {
          mocks.handlers.push(handler);
          return channel;
        },
        subscribe: () => channel
      };
      return channel;
    },
    removeChannel: vi.fn()
  }
}));

describe('GlobalNotificationBell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.handlers.length = 0;
    mocks.loadCompanyProposalPortals.mockResolvedValue([]);
    mocks.getAllAgendamentos.mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  it('junta eventos seguidos em uma unica recarga', async () => {
    render(<GlobalNotificationBell onNavigate={vi.fn()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    mocks.loadCompanyProposalPortals.mockClear();
    const handlers = [...mocks.handlers];

    act(() => {
      handlers[0]();
      handlers[1]();
      handlers[0]();
    });
    expect(mocks.loadCompanyProposalPortals).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(mocks.loadCompanyProposalPortals).toHaveBeenCalledTimes(1);
  });
});
