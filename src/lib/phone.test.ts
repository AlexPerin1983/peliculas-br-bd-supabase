import { describe, expect, it } from 'vitest';
import {
    formatBrazilianPhone,
    getBrazilianPhoneDigits,
    isValidBrazilianPhone
} from './phone';

describe('telefone brasileiro', () => {
    it('aplica a máscara de celular enquanto o usuário digita', () => {
        expect(formatBrazilianPhone('8')).toBe('(8');
        expect(formatBrazilianPhone('83')).toBe('(83');
        expect(formatBrazilianPhone('8399647')).toBe('(83) 9964-7');
        expect(formatBrazilianPhone('83996476052')).toBe('(83) 99647-6052');
    });

    it('aplica a máscara de telefone fixo', () => {
        expect(formatBrazilianPhone('1133334444')).toBe('(11) 3333-4444');
    });

    it('aceita colagem com código do Brasil e remove caracteres extras', () => {
        expect(formatBrazilianPhone('+55 (83) 99647-6052')).toBe('(83) 99647-6052');
        expect(getBrazilianPhoneDigits('+55 (83) 99647-6052')).toBe('83996476052');
    });

    it('valida somente números completos com DDD', () => {
        expect(isValidBrazilianPhone('(83) 99647-6052')).toBe(true);
        expect(isValidBrazilianPhone('(11) 3333-4444')).toBe(true);
        expect(isValidBrazilianPhone('99647-6052')).toBe(false);
        expect(isValidBrazilianPhone('(03) 99647-6052')).toBe(false);
        expect(isValidBrazilianPhone('(83) 9964-760')).toBe(false);
    });
});
