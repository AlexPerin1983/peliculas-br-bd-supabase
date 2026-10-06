import { describe, expect, it } from 'vitest';
import type { Film } from '../../types';
import {
    buildFilmDuplicate,
    findFilmByName,
    FILM_PREVIOUS_NAMES_KEY,
    getFilmPreviousNames,
    getVisibleCustomFields,
    isFilmNameTaken,
    prepareFilmForSave,
    sortFilmsForDisplay,
} from './filmCatalog';

const film = (overrides: Partial<Film>): Film => ({ nome: 'G5', preco: 100, ...overrides });

describe('catálogo de películas', () => {
    describe('renomear', () => {
        it('guarda o nome antigo e mantém a película fixada', () => {
            const original = film({ nome: 'G5', pinned: true, pinnedAt: 123 });
            const fromForm = film({ nome: 'G5 Nano', customFields: { Cor: 'Fumê' } });

            const saved = prepareFilmForSave(fromForm, original);

            expect(saved.pinned).toBe(true);
            expect(saved.pinnedAt).toBe(123);
            expect(getFilmPreviousNames(saved)).toEqual(['G5']);
            expect(saved.customFields?.Cor).toBe('Fumê');
        });

        it('acumula nomes antigos e tira o nome que voltou a ser usado', () => {
            const renamedTwice = prepareFilmForSave(
                film({ nome: 'G5 Premium' }),
                prepareFilmForSave(film({ nome: 'G5 Nano' }), film({ nome: 'G5' }))
            );
            expect(getFilmPreviousNames(renamedTwice)).toEqual(['G5', 'G5 Nano']);

            const backToOriginal = prepareFilmForSave(film({ nome: 'G5' }), renamedTwice);
            expect(getFilmPreviousNames(backToOriginal)).toEqual(['G5 Nano', 'G5 Premium']);
        });

        it('editar sem renomear não cria nomes antigos', () => {
            const saved = prepareFilmForSave(film({ preco: 120 }), film({}));

            expect(saved.customFields?.[FILM_PREVIOUS_NAMES_KEY]).toBeUndefined();
        });

        it('acha a película pelo nome antigo, mas o nome atual tem prioridade', () => {
            const renamed = prepareFilmForSave(film({ nome: 'G5 Nano' }), film({ nome: 'G5' }));
            const films = [renamed, film({ nome: 'G20' })];

            expect(findFilmByName(films, 'G5')?.nome).toBe('G5 Nano');
            expect(findFilmByName(films, 'G5 Nano')?.nome).toBe('G5 Nano');
            expect(findFilmByName(films, 'G35')).toBeUndefined();
            expect(findFilmByName([...films, film({ nome: 'G5' })], 'G5')?.nome).toBe('G5');
        });

        it('ignora nomes antigos corrompidos', () => {
            expect(getFilmPreviousNames(film({ customFields: { [FILM_PREVIOUS_NAMES_KEY]: 'não é json' } }))).toEqual([]);
        });
    });

    it('esconde os campos internos (marca, aliases e nomes antigos)', () => {
        const fields = getVisibleCustomFields(film({
            customFields: {
                __match_brand: '3M',
                __match_aliases: 'fumê',
                [FILM_PREVIOUS_NAMES_KEY]: '["G5"]',
                Cor: 'Fumê',
            },
        }));

        expect(fields).toEqual([['Cor', 'Fumê']]);
    });

    it('não deixa usar o nome de outra película, ignorando maiúsculas e espaços', () => {
        const films = [film({ nome: 'G5' }), film({ nome: 'G20' })];

        expect(isFilmNameTaken(' g20 ', films)).toBe(true);
        expect(isFilmNameTaken('G35', films)).toBe(false);
        expect(isFilmNameTaken('g5', films, 'G5')).toBe(false);
    });

    it('duplica como película nova, com nome livre e sem fixar', () => {
        const original = prepareFilmForSave(
            film({ nome: 'G5', imagens: ['a'], pinned: true, customFields: { Cor: 'Fumê' } }),
            film({ nome: 'G5 antiga', pinned: true, pinnedAt: 1 })
        );
        const films = [original, film({ nome: 'G5 (cópia)' })];

        const copy = buildFilmDuplicate(original, films);

        expect(copy.nome).toBe('G5 (cópia 2)');
        expect(copy.pinned).toBe(false);
        expect(copy.imagens).toEqual(['a']);
        expect(copy.imagens).not.toBe(original.imagens);
        expect(copy.customFields).toEqual({ Cor: 'Fumê' });
    });

    it('ordena fixadas primeiro (a mais recente no topo) e o resto de A a Z', () => {
        const sorted = sortFilmsForDisplay([
            film({ nome: 'G35' }),
            film({ nome: 'Blackout', pinned: true, pinnedAt: 1 }),
            film({ nome: 'g20' }),
            film({ nome: 'Nano', pinned: true, pinnedAt: 2 }),
            film({ nome: 'G5' }),
        ]);

        expect(sorted.map(item => item.nome)).toEqual(['Nano', 'Blackout', 'G5', 'g20', 'G35']);
    });
});
