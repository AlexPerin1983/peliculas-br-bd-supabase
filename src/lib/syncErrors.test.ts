import {
  canAutomaticallyRetrySyncError,
  classifySyncError,
  getSyncTableLabel,
  sanitizeSyncErrorInfo
} from './syncErrors';

describe('syncErrors', () => {
  it.each([
    [{ code: 'PGRST303', message: 'JWT expired' }, 'authentication'],
    [{ code: '42501', message: 'permission denied' }, 'permission'],
    [new Error('Failed to fetch'), 'network'],
    [{ status: 503, message: 'Service unavailable' }, 'server'],
    [{ code: '22003', message: 'numeric field overflow' }, 'validation'],
    [{ code: '23503', message: 'foreign key violation' }, 'dependency'],
    [{ code: '23505', message: 'duplicate key' }, 'duplicate']
  ])('classifica a falha sem depender de uma mensagem exibida ao usuario', (error, category) => {
    expect(classifySyncError(error).category).toBe(category);
  });

  it('repete somente falhas temporarias e limita erros desconhecidos', () => {
    expect(canAutomaticallyRetrySyncError({ category: 'network', code: 'SYNC_NETWORK' }, 50)).toBe(true);
    expect(canAutomaticallyRetrySyncError({ category: 'permission', code: 'SYNC_PERMISSION' }, 0)).toBe(false);
    expect(canAutomaticallyRetrySyncError({ category: 'unknown', code: 'SYNC_UNKNOWN' }, 2)).toBe(true);
    expect(canAutomaticallyRetrySyncError({ category: 'unknown', code: 'SYNC_UNKNOWN' }, 3)).toBe(false);
  });

  it('nao deixa metadado arbitrario atravessar a fronteira segura', () => {
    expect(sanitizeSyncErrorInfo({ category: 'permission', code: 'email@cliente.test' }))
      .toEqual({ category: 'permission', code: 'SYNC_PERMISSION' });
    expect(sanitizeSyncErrorInfo({ category: 'invalida', code: '42501' } as any)).toBeUndefined();
    expect(getSyncTableLabel('cliente@email.test')).toBe('Registro');
  });
});
