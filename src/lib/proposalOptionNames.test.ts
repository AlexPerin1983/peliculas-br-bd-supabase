import { describe, expect, it } from 'vitest';
import { getUniqueOptionName } from './proposalOptionNames';

describe('nome da nova opção de proposta', () => {
    it('usa o nome da película quando está livre', () => {
        expect(getUniqueOptionName('Window Premium', ['Opção 1', 'Jateado'])).toBe('Window Premium');
    });

    it('numera quando o nome já existe, sem diferenciar maiúsculas', () => {
        expect(getUniqueOptionName('Window Premium', ['window premium'])).toBe('Window Premium 2');
        expect(getUniqueOptionName('Window Premium', ['Window Premium', 'Window Premium 2'])).toBe('Window Premium 3');
    });

    it('sem nome, cai em "Opção"', () => {
        expect(getUniqueOptionName('  ', [])).toBe('Opção');
    });
});
