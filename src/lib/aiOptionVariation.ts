import type { Film } from '../../types';
import { matchFilmFromExtractedText } from '../../services/filmMatchingService';
import { getFilmMatchingAliases, getFilmMatchingBrand } from '../../utils/filmMatchingMetadata';
import { findBalancedJson } from './aiMeasurementExtraction';
import { findFilmByName } from './filmCatalog';

/**
 * "Duplicar com IA" no Orçamento gerado: o instalador fala o que muda
 * ("mantém o jateado e troca a outra pela Window Premium") e a IA devolve as
 * trocas de película. O app confere cada nome com a opção e o catálogo e
 * mostra tudo para o instalador revisar antes de gerar a nova opção.
 */

/** Só aceita a película do catálogo quando o nome bate com segurança. */
const MIN_CATALOG_CONFIDENCE = 0.9;

/**
 * Nome + marca + apelidos cadastrados ("para IA"), para a IA entender
 * "a fumê", "a da 3M" ou "o jateado" quando o nome não diz isso.
 */
const describeFilm = (name: string, catalog: Film[]) => {
    const film = findFilmByName(catalog, name);
    if (!film) return name;
    const extras = [
        getFilmMatchingBrand(film) ? `marca ${getFilmMatchingBrand(film)}` : '',
        getFilmMatchingAliases(film).length ? `também chamada: ${getFilmMatchingAliases(film).join(', ')}` : '',
    ].filter(Boolean);
    return extras.length ? `${film.nome} (${extras.join('; ')})` : film.nome;
};

export const buildOptionVariationPrompt = (currentFilms: string[], catalog: Film[]) => `Você ajuda um instalador de película para vidros a montar uma nova opção de orçamento a partir da opção atual.

Películas da opção atual:
${currentFilms.map(name => `- ${describeFilm(name, catalog)}`).join('\n')}

Películas do catálogo do instalador:
${catalog.map(film => `- ${describeFilm(film.nome, catalog)}`).join('\n')}

O pedido do instalador vem a seguir (texto ou áudio). Responda em "trocas" quais películas da opção atual mudam e por qual película do catálogo.

Regras:
- Use exatamente os nomes das películas (sem a marca e os apelidos entre parênteses), inclusive em peliculaAtual.
- Película que o instalador manda manter, ou que ele não cita, fica igual: não coloque em "trocas".
- "A outra", "as outras", "as demais" ou "o resto" são as películas da opção atual que ele não mandou manter.
- A troca vale para a película inteira, em todas as medidas onde ela está. Exemplo: opção com "Carbono Prime" e "Jateada" e o pedido "troque a Carbono Prime por Window Premium, mas onde está jateada mantenha" vira uma troca só: Carbono Prime → Window Premium.
- Se ele pedir uma película que não está no catálogo, escreva em novaPelicula o nome como ele falou.
- nomeOpcao: nome curto para a nova opção só se ele pedir um nome; senão deixe vazio.
- Se não der para entender o que trocar, deixe "trocas" vazio e explique em "observacao".`;

export const OPTION_VARIATION_SCHEMA = {
    type: 'OBJECT',
    properties: {
        trocas: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    peliculaAtual: { type: 'STRING' },
                    novaPelicula: { type: 'STRING' },
                },
                required: ['peliculaAtual', 'novaPelicula'],
            },
        },
        nomeOpcao: { type: 'STRING' },
        observacao: { type: 'STRING' },
    },
    required: ['trocas'],
} as const;

export interface RawOptionVariation {
    trocas?: Array<{ peliculaAtual?: unknown; novaPelicula?: unknown }>;
    nomeOpcao?: unknown;
    observacao?: unknown;
}

export interface OptionVariationRow {
    /** Película da opção atual. */
    current: string;
    /** Película nova do catálogo; null = mantém. */
    target: string | null;
    /** Nome que a IA entendeu e não está no catálogo (o instalador escolhe). */
    notFound?: string;
}

export interface OptionVariationPlan {
    rows: OptionVariationRow[];
    optionName: string;
    note: string;
}

export class OptionVariationError extends Error {
    code: 'EMPTY_RESPONSE' | 'INVALID_FORMAT' | 'NO_CHANGES';
    note: string;

    constructor(code: OptionVariationError['code'], note = '') {
        super(code);
        this.name = 'OptionVariationError';
        this.code = code;
        this.note = note;
    }
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const parseOptionVariationResponse = (rawText: string): RawOptionVariation => {
    if (!rawText?.trim()) throw new OptionVariationError('EMPTY_RESPONSE');
    const json = findBalancedJson(rawText);
    if (!json) throw new OptionVariationError('INVALID_FORMAT');
    try {
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
        return parsed as RawOptionVariation;
    } catch {
        throw new OptionVariationError('INVALID_FORMAT');
    }
};

/** Película (da opção ou do catálogo) que corresponde ao nome devolvido pela IA. */
const resolveName = (name: string, films: Film[]): string | null => {
    if (!name) return null;
    const exact = findFilmByName(films, name);
    if (exact) return exact.nome;
    const match = matchFilmFromExtractedText(name, films);
    return match.matchedFilmName && match.confidence >= MIN_CATALOG_CONFIDENCE ? match.matchedFilmName : null;
};

/**
 * Uma linha por película da opção atual: troca conferida no catálogo,
 * "mantém" ou nome não encontrado (para o instalador escolher).
 */
export const resolveOptionVariation = (
    raw: RawOptionVariation,
    currentFilms: string[],
    catalog: Film[]
): OptionVariationPlan => {
    const currentAsFilms = currentFilms.map(nome => ({ nome, preco: 0 }) as Film);
    const rows: OptionVariationRow[] = currentFilms.map(current => ({ current, target: null }));

    for (const change of Array.isArray(raw.trocas) ? raw.trocas : []) {
        const current = resolveName(text(change?.peliculaAtual), currentAsFilms);
        const spokenTarget = text(change?.novaPelicula);
        if (!current || !spokenTarget) continue;

        const row = rows.find(item => item.current === current)!;
        const target = resolveName(spokenTarget, catalog);
        if (target && target !== current) {
            row.target = target;
            delete row.notFound;
        } else if (!target) {
            row.notFound = spokenTarget;
        }
    }

    const note = text(raw.observacao);
    if (!rows.some(row => row.target || row.notFound)) {
        throw new OptionVariationError('NO_CHANGES', note);
    }

    return { rows, optionName: text(raw.nomeOpcao), note };
};

/** Nome sugerido para a nova opção: o pedido pela IA ou as películas novas. */
export const suggestVariationName = (plan: OptionVariationPlan, rows: OptionVariationRow[] = plan.rows): string => {
    if (plan.optionName) return plan.optionName;
    const targets = rows.map(row => row.target).filter((name, index, all): name is string => !!name && all.indexOf(name) === index);
    return targets.join(' + ');
};

/** Trocas confirmadas: { película atual: película nova }. */
export const toFilmReplacements = (rows: OptionVariationRow[]): Record<string, string> =>
    Object.fromEntries(rows.filter(row => row.target).map(row => [row.current, row.target as string]));

export const getFriendlyOptionVariationError = (error: unknown): string => {
    if (error instanceof OptionVariationError && error.code === 'NO_CHANGES') {
        return error.note
            ? `Não entendi o que trocar: ${error.note}`
            : 'Não entendi o que trocar. Diga qual película mantém e qual troca, por exemplo: "mantém o jateado e troca a outra pela Window Premium".';
    }
    const code = `${typeof (error as any)?.code === 'string' ? (error as any).code : ''} ${error instanceof Error ? error.message : ''}`;
    if (/USER_RATE_LIMIT|429/i.test(code)) return 'Muitas tentativas seguidas. Aguarde um minuto e tente novamente.';
    if (/NETWORK|fetch|conexão|offline/i.test(code)) return 'Sem conexão com a IA. Confira sua internet e tente novamente.';
    if (/401|não autorizado|Nao autorizado|session|sessão/i.test(code)) return 'Sua sessão precisa ser renovada. Entre novamente no aplicativo.';
    return 'Não foi possível montar a nova opção agora. Tente de novo ou use "Duplicar com outra película".';
};
