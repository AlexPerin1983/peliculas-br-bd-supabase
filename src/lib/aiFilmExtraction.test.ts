import { describe, expect, it } from 'vitest';
import {
    countOtherFilms,
    FilmExtractionError,
    getAiFilmPriceNote,
    getFriendlyFilmExtractionError,
    getOtherFilmsMessage,
    normalizeFilmExtraction,
    parseFilmExtractionResponse,
} from './aiFilmExtraction';
import { getFilmMatchingAliases, getFilmMatchingBrand } from '../../utils/filmMatchingMetadata';
import type { Film } from '../../types';

describe('IA de cadastro de película', () => {
    describe('leitura da resposta', () => {
        it('aceita JSON puro ou dentro de bloco de código', () => {
            expect(parseFilmExtractionResponse('{"nome":"G5"}')).toEqual({ nome: 'G5' });
            expect(parseFilmExtractionResponse('```json\n{"nome":"G5"}\n```')).toEqual({ nome: 'G5' });
        });

        it('recusa resposta vazia, sem JSON ou que não é objeto', () => {
            expect(() => parseFilmExtractionResponse('')).toThrow(FilmExtractionError);
            expect(() => parseFilmExtractionResponse('não achei nada')).toThrow('INVALID_FORMAT');
            expect(() => parseFilmExtractionResponse('[1, 2]')).toThrow('INVALID_FORMAT');
        });
    });

    describe('preço: venda × custo', () => {
        it('a película descrita pelo instalador vira preço de venda por m²', () => {
            const film = normalizeFilmExtraction({ nome: 'G5', precoVendaM2: 100, uv: 99, tser: 50 });

            expect(film).toMatchObject({ nome: 'G5', preco: 100, uv: 99, tser: 50 });
            expect(film.precoMetroLinear).toBeUndefined();
            expect(getAiFilmPriceNote(film)).toBeNull();
        });

        it('preço da bobina vira custo por metro linear e o cadastro pede o preço de venda', () => {
            const film = normalizeFilmExtraction({ nome: 'Nano 70', custoBobina: 1500, comprimentoBobinaM: 30 });

            expect(film.precoMetroLinear).toBe(50);
            expect(film.preco).toBeUndefined();
            expect(getAiFilmPriceNote(film)).toMatch(/custo \(R\$\s50,00 por metro linear\)/);
        });

        it('custo por metro linear informado tem prioridade sobre a conta da bobina', () => {
            const film = normalizeFilmExtraction({ nome: 'G20', custoMetroLinear: '42,50', custoBobina: 1500, comprimentoBobinaM: 30 });

            expect(film.precoMetroLinear).toBe(42.5);
        });

        it('sem preço nenhum, o aviso pede o valor cobrado', () => {
            expect(getAiFilmPriceNote({ nome: 'G35' })).toContain('não apareceu');
            expect(getAiFilmPriceNote({ nome: 'G35', preco: 120 } as Partial<Film>)).toBeNull();
            expect(getAiFilmPriceNote(undefined)).toBeNull();
        });
    });

    it('converte números escritos como texto e ignora percentuais impossíveis', () => {
        const film = normalizeFilmExtraction({
            nome: 'Espelhada',
            precoVendaM2: 'R$ 1.234,56',
            uv: '99%',
            ir: 140,
            vtl: -5,
            maoDeObraM2: 0,
        });

        expect(film.preco).toBe(1234.56);
        expect(film.uv).toBe(99);
        expect(film.ir).toBeUndefined();
        expect(film.vtl).toBeUndefined();
        expect(film.maoDeObra).toBeUndefined();
    });

    it('guarda a espessura em micras, convertendo de mil', () => {
        expect(normalizeFilmExtraction({ nome: 'A', espessura: 2, espessuraUnidade: 'mil' }).espessura).toBe(50.8);
        expect(normalizeFilmExtraction({ nome: 'B', espessura: 50, espessuraUnidade: 'micras' }).espessura).toBe(50);
    });

    it('lê a unidade da garantia de mão de obra com variações', () => {
        expect(normalizeFilmExtraction({ nome: 'A', garantiaMaoDeObra: 6, garantiaMaoDeObraUnidade: 'mês' }))
            .toMatchObject({ garantiaMaoDeObra: 6, garantiaMaoDeObraUnidade: 'meses' });
        expect(normalizeFilmExtraction({ nome: 'B', garantiaMaoDeObra: 1, garantiaMaoDeObraUnidade: 'Ano' }).garantiaMaoDeObraUnidade)
            .toBe('anos');
        expect(normalizeFilmExtraction({ nome: 'C', garantiaMaoDeObra: 90 }).garantiaMaoDeObraUnidade).toBe('dias');
    });

    it('marca e códigos vão para os campos da IA; outras especificações viram campos personalizados', () => {
        const film = normalizeFilmExtraction({
            nome: 'Crystalline 70',
            marca: '3M',
            codigosAlternativos: ['CR70', 'Crystalline 70', ''],
            outrasEspecificacoes: [
                { nome: 'Refletância', valor: '9%' },
                { nome: '__match_brand', valor: 'invasor' },
                { nome: 'Refletância', valor: 'duplicada' },
                { nome: 'Cor', valor: '' },
            ],
        }) as Film;

        expect(getFilmMatchingBrand(film)).toBe('3M');
        expect(getFilmMatchingAliases(film)).toEqual(['CR70']);
        expect(film.customFields).toMatchObject({ Refletância: '9%' });
        expect(film.customFields).not.toHaveProperty('Cor');
    });

    it('recusa resposta sem nenhum dado de película', () => {
        expect(() => normalizeFilmExtraction({})).toThrow('NO_DATA');
        expect(() => normalizeFilmExtraction({ nome: '  ', uv: 0 })).toThrow('NO_DATA');
    });

    it('avisa quando o material tem outras películas', () => {
        expect(countOtherFilms({ outrasPeliculas: 3 })).toBe(3);
        expect(getOtherFilmsMessage(countOtherFilms({}))).toBeNull();
        expect(getOtherFilmsMessage(1)).toBe('O material tem mais 1 película. Preenchi só a primeira.');
        expect(getOtherFilmsMessage(4)).toContain('mais 4 películas');
    });

    it('troca erros técnicos por mensagens para o instalador', () => {
        expect(getFriendlyFilmExtractionError(new FilmExtractionError('NO_DATA'))).toContain('Não encontrei dados');
        expect(getFriendlyFilmExtractionError({ code: 'USER_RATE_LIMIT' })).toContain('Aguarde um minuto');
        expect(getFriendlyFilmExtractionError(new Error('Failed to fetch'))).toContain('internet');
        expect(getFriendlyFilmExtractionError(new Error('qualquer coisa'))).toContain('Tente novamente');
    });
});
