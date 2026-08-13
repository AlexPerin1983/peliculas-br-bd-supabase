import { describe, expect, it, vi } from 'vitest';
import {
    isPersistedAppTab,
    loadActiveTab,
    resolveStartupTab,
    saveActiveTab,
} from './activeTabPreferences';

describe('activeTabPreferences', () => {
    it('salva e restaura a ultima secao valida', () => {
        const values = new Map<string, string>();
        const storage = {
            getItem: vi.fn((key: string) => values.get(key) ?? null),
            setItem: vi.fn((key: string, value: string) => values.set(key, value)),
        };

        saveActiveTab('history', storage);

        expect(loadActiveTab(storage)).toBe('history');
    });

    it('ignora valores antigos ou desconhecidos', () => {
        const storage = {
            getItem: vi.fn(() => 'tela-que-nao-existe'),
            setItem: vi.fn(),
        };

        expect(loadActiveTab(storage)).toBeNull();
        expect(isPersistedAppTab('tela-que-nao-existe')).toBe(false);
    });

    it('mantem a navegacao funcional quando o storage esta bloqueado', () => {
        const storage = {
            getItem: vi.fn(() => {
                throw new Error('storage bloqueado');
            }),
            setItem: vi.fn(() => {
                throw new Error('storage bloqueado');
            }),
        };

        expect(loadActiveTab(storage)).toBeNull();
        expect(() => saveActiveTab('agenda', storage)).not.toThrow();
    });

    it('prefere a ultima secao ao primeiro item organizado do menu', () => {
        expect(resolveStartupTab(null, 'history', 'dashboard')).toBe('history');
    });

    it('mantem atalhos e deep links acima da secao persistida', () => {
        expect(resolveStartupTab('agenda', 'history', 'dashboard')).toBe('agenda');
    });
});
