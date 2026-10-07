import { describe, expect, it } from 'vitest';
import type { Film } from '../../types';
import {
    buildOptionVariationPrompt,
    getFriendlyOptionVariationError,
    OptionVariationError,
    parseOptionVariationResponse,
    resolveOptionVariation,
    suggestVariationName,
    toFilmReplacements,
} from './aiOptionVariation';

const catalog: Film[] = ['Jateado Branco', 'Suntek Fumê 20', 'Window Premium', 'Window Blue'].map(nome => ({ nome, preco: 100 }));
const current = ['Jateado Branco', 'Suntek Fumê 20'];

describe('duplicar com IA', () => {
    it('"mantém o jateado e troca a outra pela Window Premium"', () => {
        const plan = resolveOptionVariation(
            { trocas: [{ peliculaAtual: 'Suntek Fumê 20', novaPelicula: 'Window Premium' }] },
            current,
            catalog
        );

        expect(plan.rows).toEqual([
            { current: 'Jateado Branco', target: null },
            { current: 'Suntek Fumê 20', target: 'Window Premium' },
        ]);
        expect(toFilmReplacements(plan.rows)).toEqual({ 'Suntek Fumê 20': 'Window Premium' });
        expect(suggestVariationName(plan)).toBe('Window Premium');
    });

    it('confere nomes escritos diferente (acento, maiúsculas, espaços) com o catálogo', () => {
        const plan = resolveOptionVariation(
            { trocas: [{ peliculaAtual: 'suntek fume 20', novaPelicula: 'window  premium' }] },
            current,
            catalog
        );

        expect(plan.rows[1]).toEqual({ current: 'Suntek Fumê 20', target: 'Window Premium' });
    });

    it('película fora do catálogo não é inventada: fica para o instalador escolher', () => {
        const plan = resolveOptionVariation(
            { trocas: [{ peliculaAtual: 'Suntek Fumê 20', novaPelicula: 'Llumar ATC 35' }] },
            current,
            catalog
        );

        expect(plan.rows[1]).toEqual({ current: 'Suntek Fumê 20', target: null, notFound: 'Llumar ATC 35' });
        expect(toFilmReplacements(plan.rows)).toEqual({});
    });

    it('usa o nome pedido para a opção e junta as películas novas quando não há nome', () => {
        const named = resolveOptionVariation(
            { trocas: [{ peliculaAtual: 'Jateado Branco', novaPelicula: 'Window Blue' }], nomeOpcao: 'Opção econômica' },
            current,
            catalog
        );
        expect(suggestVariationName(named)).toBe('Opção econômica');

        const both = resolveOptionVariation(
            {
                trocas: [
                    { peliculaAtual: 'Jateado Branco', novaPelicula: 'Window Blue' },
                    { peliculaAtual: 'Suntek Fumê 20', novaPelicula: 'Window Premium' },
                ],
            },
            current,
            catalog
        );
        expect(suggestVariationName(both)).toBe('Window Blue + Window Premium');
    });

    it('sem troca válida, explica o que não entendeu', () => {
        expect(() => resolveOptionVariation({ trocas: [], observacao: 'Não ficou claro qual película trocar.' }, current, catalog))
            .toThrow(OptionVariationError);
        expect(() => resolveOptionVariation({ trocas: [{ peliculaAtual: 'Jateado Branco', novaPelicula: 'Jateado Branco' }] }, current, catalog))
            .toThrow('NO_CHANGES');
        expect(() => resolveOptionVariation({ trocas: [{ peliculaAtual: 'Película que não está na opção', novaPelicula: 'Window Blue' }] }, current, catalog))
            .toThrow('NO_CHANGES');

        const error = new OptionVariationError('NO_CHANGES', 'Não ficou claro qual película trocar.');
        expect(getFriendlyOptionVariationError(error)).toBe('Não entendi o que trocar: Não ficou claro qual película trocar.');
    });

    it('lê a resposta da IA e manda as duas listas no pedido', () => {
        expect(parseOptionVariationResponse('```json\n{"trocas":[]}\n```')).toEqual({ trocas: [] });
        expect(() => parseOptionVariationResponse('')).toThrow('EMPTY_RESPONSE');
        expect(() => parseOptionVariationResponse('[1]')).toThrow('INVALID_FORMAT');

        const prompt = buildOptionVariationPrompt(current, catalog);
        expect(prompt).toContain('- Suntek Fumê 20');
        expect(prompt).toContain('- Window Premium');
    });

    it('manda a marca e os apelidos de cada película para a IA entender "a fumê" ou "a da 3M"', () => {
        const withMetadata: Film[] = [
            { nome: 'Carbono Prime', preco: 100, customFields: { __match_brand: 'SunTek', __match_aliases: 'carbono, fumê' } },
            { nome: 'Jateada', preco: 100 },
            { nome: 'Window Premium', preco: 100, customFields: { __match_brand: '3M' } },
        ];

        const prompt = buildOptionVariationPrompt(['Carbono Prime', 'Jateada'], withMetadata);

        expect(prompt).toContain('- Carbono Prime (marca SunTek; também chamada: carbono, fumê)');
        expect(prompt).toContain('- Window Premium (marca 3M)');
        expect(prompt).toContain('- Jateada\n');
    });

    it('"troque a Carbono Prime por Window Premium, mas onde está Jateada mantenha jateado"', () => {
        const films: Film[] = ['Carbono Prime', 'Jateada', 'Window Premium'].map(nome => ({ nome, preco: 100 }));
        // A IA devolve só a troca da Carbono Prime; a Jateada fica de fora (mantém).
        const plan = resolveOptionVariation(
            { trocas: [{ peliculaAtual: 'Carbono Prime', novaPelicula: 'Window Premium' }] },
            ['Carbono Prime', 'Jateada'],
            films
        );

        expect(plan.rows).toEqual([
            { current: 'Carbono Prime', target: 'Window Premium' },
            { current: 'Jateada', target: null },
        ]);
        expect(suggestVariationName(plan)).toBe('Window Premium');
    });
});
