import { canAccessAppTab } from './appAccess';

describe('canAccessAppTab', () => {
  it('restringe Assistentes para administradores', () => {
    expect(canAccessAppTab('assistentes', false)).toBe(false);
    expect(canAccessAppTab('assistentes', true)).toBe(true);
  });

  it('mantem as demais telas disponiveis para usuarios comuns', () => {
    expect(canAccessAppTab('dashboard', false)).toBe(true);
    expect(canAccessAppTab('history', false)).toBe(true);
  });
});
