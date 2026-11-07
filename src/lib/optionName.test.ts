import { describe, expect, it } from 'vitest';
import { formatOptionName } from './optionName';

describe('formatOptionName', () => {
    it('mostra "Opção" nas opções antigas criadas sem acento', () => {
        expect(formatOptionName('Opcao 1')).toBe('Opção 1');
        expect(formatOptionName('Opcao Premium')).toBe('Opção Premium');
        expect(formatOptionName('opcao 2')).toBe('opção 2');
        expect(formatOptionName('OPCAO 3')).toBe('OPÇÃO 3');
        expect(formatOptionName('Opcao')).toBe('Opção');
    });

    it('não mexe em nomes dados pelo aplicador', () => {
        expect(formatOptionName('Opção 1')).toBe('Opção 1');
        expect(formatOptionName('Suntek')).toBe('Suntek');
        expect(formatOptionName('Box Opcao')).toBe('Box Opcao');
        expect(formatOptionName('Opcaoextra')).toBe('Opcaoextra');
        expect(formatOptionName('')).toBe('');
        expect(formatOptionName(undefined)).toBeUndefined();
    });
});
