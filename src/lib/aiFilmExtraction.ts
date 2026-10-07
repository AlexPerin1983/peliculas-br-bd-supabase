import type { Film } from '../../types';
import { withMatchingMetadata } from '../../utils/filmMatchingMetadata';
import { isInternalFilmFieldKey } from './filmCatalog';
import { findBalancedJson } from './aiMeasurementExtraction';
import type { GarantiaUnidade } from './filmWarranty';

/**
 * "Película com IA": lê ficha técnica, foto da caixa, texto ou áudio e
 * preenche o cadastro para o instalador revisar. O ponto mais delicado é o
 * preço: material de fornecedor traz CUSTO (metro linear ou bobina), e isso
 * não pode cair no preço de venda por m², que vai para a proposta do cliente.
 */
// Regras de cada campo, iguais para uma película e para a tabela inteira.
const FILM_FIELD_RULES = `- Extraia só o que está no material. Não invente nem deduza valores (por exemplo, não tire o VTL do nome "G5").
- nome: nome comercial da película, sem a marca quando ela vier separada. marca: fabricante (ex.: 3M, SunTek, Llumar, Insulfilm).
- codigosAlternativos: outros nomes ou códigos da mesma película que aparecem no material (ex.: código do fabricante). Não crie apelidos.
- Percentuais são números de 0 a 100, sem o símbolo %.
  - uv: proteção, bloqueio ou rejeição de UV.
  - ir: rejeição de infravermelho (IR).
  - vtl: transmissão de luz visível (VTL, VLT, "luz visível transmitida").
  - tser: rejeição total de energia solar (TSER), também dita "bloqueia X% do calor".
- espessura: número como aparece, com a unidade em espessuraUnidade ("micras" para µm/micras, "mil" para mil/mils).
- Preços (em reais, só números):
  - precoVendaM2: quanto o instalador COBRA do cliente por m². Use quando ele diz que cobra/vende, fala em m², ou descreve a própria película com "R$ X o metro" sem falar em metro linear, bobina, rolo ou fornecedor.
  - custoMetroLinear: preço de COMPRA por metro linear da bobina ("metro linear", "ml", "por metro da bobina").
  - custoBobina e comprimentoBobinaM: preço de COMPRA do rolo/bobina inteiro e o comprimento dele em metros.
  - Tabela de preços, ficha ou orçamento de fornecedor/distribuidor traz CUSTO: nunca coloque esses valores em precoVendaM2.
  - maoDeObraM2: valor de mão de obra/instalação/aplicação por m².
- garantiaFabricanteAnos: garantia do fabricante em anos. garantiaMaoDeObra + garantiaMaoDeObraUnidade ("dias", "meses" ou "anos"): garantia da instalação.
- outrasEspecificacoes: outros dados técnicos úteis que não têm campo próprio (ex.: Refletância, Cor, Largura da bobina, Rejeição de brilho), com nome e valor como aparecem.
- Deixe de fora qualquer campo que não estiver no material.`;

export const FILM_EXTRACTION_PROMPT = `Você ajuda instaladores de película para vidros (automotiva, residencial/comercial, segurança e decorativa/jateada) a cadastrar uma película. Leia o material enviado (texto, foto da caixa ou da etiqueta, ficha técnica em PDF ou áudio) e preencha os campos.

Regras:
- Se o material tiver várias películas, preencha só a primeira e informe em "outrasPeliculas" quantas outras existem.
${FILM_FIELD_RULES}`;

/**
 * Importar a tabela do fornecedor: a mesma leitura, mas de todas as
 * películas do material de uma vez (vira uma lista para o instalador revisar).
 */
export const FILM_TABLE_EXTRACTION_PROMPT = `Você ajuda instaladores de película para vidros (automotiva, residencial/comercial, segurança e decorativa/jateada) a montar o catálogo. Leia a tabela de preços, o catálogo ou a lista enviada (foto, PDF, texto ou áudio) e liste em "peliculas" TODAS as películas, na ordem em que aparecem.

Regras:
- Uma entrada por película. Se a mesma película aparece em larguras de bobina diferentes, registre uma vez só, com o custo da bobina de 1,52 m (ou da maior largura) e a largura em outrasEspecificacoes.
- Ignore linhas que não são película (frete, acessórios, ferramentas, totais).
${FILM_FIELD_RULES}`;

const FILM_FIELDS_SCHEMA = {
    nome: { type: 'STRING' },
    marca: { type: 'STRING' },
    codigosAlternativos: { type: 'ARRAY', items: { type: 'STRING' } },
    precoVendaM2: { type: 'NUMBER' },
    maoDeObraM2: { type: 'NUMBER' },
    custoMetroLinear: { type: 'NUMBER' },
    custoBobina: { type: 'NUMBER' },
    comprimentoBobinaM: { type: 'NUMBER' },
    garantiaFabricanteAnos: { type: 'NUMBER' },
    garantiaMaoDeObra: { type: 'NUMBER' },
    garantiaMaoDeObraUnidade: { type: 'STRING' },
    uv: { type: 'NUMBER' },
    ir: { type: 'NUMBER' },
    vtl: { type: 'NUMBER' },
    tser: { type: 'NUMBER' },
    espessura: { type: 'NUMBER' },
    espessuraUnidade: { type: 'STRING' },
    outrasEspecificacoes: {
        type: 'ARRAY',
        items: {
            type: 'OBJECT',
            properties: {
                nome: { type: 'STRING' },
                valor: { type: 'STRING' },
            },
            required: ['nome', 'valor'],
        },
    },
} as const;

/** Formato da resposta (Gemini responseSchema). Os tipos são os nomes do enum Type do SDK. */
export const FILM_EXTRACTION_SCHEMA = {
    type: 'OBJECT',
    properties: {
        ...FILM_FIELDS_SCHEMA,
        outrasPeliculas: { type: 'NUMBER' },
    },
} as const;

export const FILM_TABLE_EXTRACTION_SCHEMA = {
    type: 'OBJECT',
    properties: {
        peliculas: {
            type: 'ARRAY',
            items: { type: 'OBJECT', properties: FILM_FIELDS_SCHEMA, required: ['nome'] },
        },
    },
    required: ['peliculas'],
} as const;

export interface RawAIFilmExtraction {
    nome?: unknown;
    marca?: unknown;
    codigosAlternativos?: unknown;
    precoVendaM2?: unknown;
    maoDeObraM2?: unknown;
    custoMetroLinear?: unknown;
    custoBobina?: unknown;
    comprimentoBobinaM?: unknown;
    garantiaFabricanteAnos?: unknown;
    garantiaMaoDeObra?: unknown;
    garantiaMaoDeObraUnidade?: unknown;
    uv?: unknown;
    ir?: unknown;
    vtl?: unknown;
    tser?: unknown;
    espessura?: unknown;
    espessuraUnidade?: unknown;
    outrasEspecificacoes?: unknown;
    outrasPeliculas?: unknown;
}

export class FilmExtractionError extends Error {
    code: 'EMPTY_RESPONSE' | 'INVALID_FORMAT' | 'NO_DATA';

    constructor(code: FilmExtractionError['code']) {
        super(code);
        this.name = 'FilmExtractionError';
        this.code = code;
    }
}

const MICRAS_POR_MIL = 25.4;

/** Aceita número ou texto ("R$ 1.234,56", "99%", "1,5"); devolve undefined se não houver valor positivo. */
const toPositiveNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : undefined;
    if (typeof value !== 'string') return undefined;

    let text = value.replace(/[^\d.,-]/g, '');
    if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
    const parsed = Number(text);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const toPercentage = (value: unknown): number | undefined => {
    const parsed = toPositiveNumber(value);
    return parsed !== undefined && parsed <= 100 ? parsed : undefined;
};

const roundTo = (value: number, decimals: number) => Number(value.toFixed(decimals));

const toText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** "mês", "Meses", "ano"... viram a unidade do cadastro; sem unidade, dias (padrão do app). */
const toGarantiaUnidade = (value: unknown): GarantiaUnidade => {
    const text = toText(value).toLowerCase();
    if (text.startsWith('ano')) return 'anos';
    if (text.startsWith('m')) return 'meses';
    return 'dias';
};

export const parseFilmExtractionResponse = (rawText: string): RawAIFilmExtraction => {
    if (!rawText?.trim()) throw new FilmExtractionError('EMPTY_RESPONSE');

    const json = findBalancedJson(rawText);
    if (!json) throw new FilmExtractionError('INVALID_FORMAT');

    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new FilmExtractionError('INVALID_FORMAT');
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new FilmExtractionError('INVALID_FORMAT');
    }
    return parsed as RawAIFilmExtraction;
};

/** Converte a resposta da IA nos campos do cadastro (só o que veio preenchido). */
export const normalizeFilmExtraction = (raw: RawAIFilmExtraction): Partial<Film> => {
    const film: Partial<Film> = {};

    const nome = toText(raw.nome);
    if (nome) film.nome = nome;

    const preco = toPositiveNumber(raw.precoVendaM2);
    if (preco) film.preco = roundTo(preco, 2);

    const maoDeObra = toPositiveNumber(raw.maoDeObraM2);
    if (maoDeObra) film.maoDeObra = roundTo(maoDeObra, 2);

    const custoBobina = toPositiveNumber(raw.custoBobina);
    const comprimentoBobina = toPositiveNumber(raw.comprimentoBobinaM);
    const custoMetroLinear = toPositiveNumber(raw.custoMetroLinear)
        ?? (custoBobina && comprimentoBobina ? custoBobina / comprimentoBobina : undefined);
    if (custoMetroLinear) film.precoMetroLinear = roundTo(custoMetroLinear, 2);

    const garantiaFabricante = toPositiveNumber(raw.garantiaFabricanteAnos);
    if (garantiaFabricante) film.garantiaFabricante = Math.round(garantiaFabricante);

    const garantiaMaoDeObra = toPositiveNumber(raw.garantiaMaoDeObra);
    if (garantiaMaoDeObra) {
        film.garantiaMaoDeObra = Math.round(garantiaMaoDeObra);
        film.garantiaMaoDeObraUnidade = toGarantiaUnidade(raw.garantiaMaoDeObraUnidade);
    }

    for (const key of ['uv', 'ir', 'vtl', 'tser'] as const) {
        const value = toPercentage(raw[key]);
        if (value !== undefined) film[key] = roundTo(value, 1);
    }

    // O cadastro guarda espessura em micras; "mil" (milésimo de polegada) é convertido.
    const espessura = toPositiveNumber(raw.espessura);
    if (espessura) {
        film.espessura = toText(raw.espessuraUnidade).toLowerCase() === 'mil'
            ? roundTo(espessura * MICRAS_POR_MIL, 1)
            : roundTo(espessura, 1);
    }

    const customFields: Record<string, string> = {};
    if (Array.isArray(raw.outrasEspecificacoes)) {
        for (const item of raw.outrasEspecificacoes) {
            const key = toText((item as any)?.nome);
            const value = toText((item as any)?.valor);
            if (key && value && !isInternalFilmFieldKey(key) && !(key in customFields)) {
                customFields[key] = value;
            }
        }
    }

    const aliases = Array.isArray(raw.codigosAlternativos)
        ? raw.codigosAlternativos.map(toText).filter(alias => alias && alias !== nome).join(', ')
        : '';
    // Marca e códigos vão para os campos "para IA", que ajudam a reconhecer a película nas medidas.
    film.customFields = withMatchingMetadata(customFields, toText(raw.marca), aliases);

    const filledFields = Object.keys(film).filter(key => key !== 'customFields').length
        + Object.keys(film.customFields).length;
    if (filledFields === 0) throw new FilmExtractionError('NO_DATA');

    return film;
};

/** Resposta da tabela: { peliculas: [...] } (ou só a lista). */
export const parseFilmTableExtractionResponse = (rawText: string): RawAIFilmExtraction[] => {
    if (!rawText?.trim()) throw new FilmExtractionError('EMPTY_RESPONSE');

    const json = findBalancedJson(rawText);
    if (!json) throw new FilmExtractionError('INVALID_FORMAT');

    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new FilmExtractionError('INVALID_FORMAT');
    }

    const list = Array.isArray(parsed) ? parsed : (parsed as { peliculas?: unknown })?.peliculas;
    if (!Array.isArray(list)) throw new FilmExtractionError('INVALID_FORMAT');
    return list.filter((item): item is RawAIFilmExtraction => !!item && typeof item === 'object');
};

/**
 * Películas da tabela prontas para revisar: só as que têm nome, sem repetir
 * nome (vale a primeira, como na tabela).
 */
export const normalizeFilmTableExtraction = (items: RawAIFilmExtraction[]): Partial<Film>[] => {
    const seen = new Set<string>();
    const films: Partial<Film>[] = [];

    for (const item of items) {
        let film: Partial<Film>;
        try {
            film = normalizeFilmExtraction(item);
        } catch {
            continue;
        }
        const key = film.nome?.toLocaleLowerCase('pt-BR');
        if (!key || seen.has(key)) continue;
        seen.add(key);
        films.push(film);
    }

    if (films.length === 0) throw new FilmExtractionError('NO_DATA');
    return films;
};

export const countOtherFilms = (raw: RawAIFilmExtraction): number => {
    const value = toPositiveNumber(raw.outrasPeliculas);
    return value ? Math.round(value) : 0;
};

export const getOtherFilmsMessage = (otherFilms: number): string | null => {
    if (otherFilms <= 0) return null;
    return otherFilms === 1
        ? 'O material tem mais 1 película. Preenchi só a primeira.'
        : `O material tem mais ${otherFilms} películas. Preenchi só a primeira.`;
};

/**
 * Aviso no topo do cadastro preenchido pela IA quando falta o preço de venda,
 * principalmente quando o material só traz o custo (caso de fornecedor).
 */
export const getAiFilmPriceNote = (aiData: Partial<Film> | undefined): string | null => {
    if (!aiData || aiData.preco) return null;

    if (aiData.precoMetroLinear) {
        const custo = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(aiData.precoMetroLinear);
        return `O material traz o custo (${custo} por metro linear), não o preço de venda. Informe quanto você cobra por m².`;
    }
    return 'O preço de venda por m² não apareceu no material. Informe quanto você cobra.';
};

export const getFriendlyFilmExtractionError = (error: unknown): string => {
    const internalCode = typeof (error as any)?.code === 'string' ? (error as any).code : '';
    const rawMessage = error instanceof Error ? error.message : String(error || '');
    const code = `${internalCode} ${rawMessage}`;

    if (/NO_DATA|EMPTY_RESPONSE/i.test(code)) {
        return 'Não encontrei dados de película no material. Envie a ficha técnica, uma foto nítida da caixa ou descreva a película.';
    }
    if (/OUTPUT_TRUNCATED|MAX_TOKENS/i.test(code)) {
        return 'O material é grande demais para uma leitura só. Envie uma página (ou uma parte da tabela) por vez.';
    }
    if (/INVALID_FORMAT/i.test(code)) {
        return 'Não consegui organizar os dados da película. Tente de novo ou envie só a página da ficha com as especificações.';
    }
    if (/USER_RATE_LIMIT|muitas tentativas|429/i.test(code)) {
        return 'Muitas tentativas seguidas. Aguarde um minuto e tente novamente.';
    }
    if (/CONTENT_BLOCKED|SAFETY|PROHIBITED/i.test(code)) {
        return 'Não foi possível analisar este arquivo. Envie só a parte com os dados da película.';
    }
    if (/INPUT_TOO_LARGE|Entrada muito grande|413/i.test(code)) {
        return 'Arquivo muito grande. Envie só a página da ficha técnica ou uma foto menor.';
    }
    if (/401|Nao autorizado|não autorizado|sessão|session/i.test(code)) {
        return 'Sua sessão precisa ser renovada. Entre novamente no aplicativo e repita a leitura.';
    }
    if (/NETWORK|fetch|conectar|conexão|offline/i.test(code)) {
        return 'Sem conexão com a leitura automática. Confira sua internet e tente novamente.';
    }
    return 'Não foi possível ler a película agora. Tente novamente em instantes.';
};
