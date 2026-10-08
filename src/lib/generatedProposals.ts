import type { Client, Film, ProposalOption, SavedPDF, UIMeasurement, UserInfo } from '../../types';
import { findFilmByName } from './filmCatalog';

/**
 * Identificação de uma proposta gerada, igual em todas as cópias dela: o PDF
 * nasce com um id provisório e ganha o definitivo no servidor, e a cópia do
 * servidor vem sem a opção (a sincronização não a guarda) e com a data em outro
 * formato ("+00:00" em vez de "Z"). Cliente + instante da geração não mudam.
 */
export const getProposalKey = (pdf: Pick<SavedPDF, 'clienteId' | 'date'>): string => {
    const time = Date.parse(pdf.date);
    return `${pdf.clienteId}|${Number.isFinite(time) ? time : pdf.date}`;
};

const hasPersistedId = (pdf: SavedPDF) => typeof pdf.id === 'number' && pdf.id > 0;

const normalizeOptionName = (name?: string | null) => name?.trim().toLocaleLowerCase('pt-BR') || '';

/** Mesma opção pelo nome impresso no PDF (a cópia do servidor não traz o id da opção). */
export const isSameOptionName = (left?: string | null, right?: string | null): boolean => {
    const normalized = normalizeOptionName(left);
    return !!normalized && normalized === normalizeOptionName(right);
};

/** Id da opção de um PDF que não o traz (cópia do servidor), quando dá para saber. */
export type OptionIdResolver = (pdf: SavedPDF) => number | undefined;

/**
 * Resolve pelo nome só quando exatamente uma opção atual do cliente tem esse
 * nome; nome repetido ou de opção que já não existe fica sem id (grupo à parte).
 */
export const buildOptionIdResolver = (options: Array<Pick<ProposalOption, 'id' | 'name'>>): OptionIdResolver => {
    const idByName = new Map<string, number | null>();
    for (const option of options) {
        const name = normalizeOptionName(option.name);
        if (!name) continue;
        idByName.set(name, idByName.has(name) ? null : option.id);
    }
    return pdf => idByName.get(normalizeOptionName(pdf.proposalOptionName)) ?? undefined;
};

// Versões da mesma opção: pelo id da opção; sem ele, pelo id que o nome indica
// sem ambiguidade; senão, pelo nome (grupo à parte, nunca junto de outra opção).
const getOptionKey = (pdf: SavedPDF, resolveOptionId?: OptionIdResolver) => {
    const optionId = pdf.proposalOptionId ?? resolveOptionId?.(pdf);
    if (optionId != null) return `id:${optionId}`;
    const name = normalizeOptionName(pdf.proposalOptionName);
    return name ? `nome:${name}` : `pdf:${getProposalKey(pdf)}`;
};

// Duas cópias da mesma proposta: fica a definitiva, com o que só a outra tem
// (o PDF já em memória e o id da opção, que a cópia do servidor não traz).
const mergeProposalCopies = (left: SavedPDF, right: SavedPDF): SavedPDF => {
    const preferred = !hasPersistedId(left) && hasPersistedId(right) ? right : left;
    const other = preferred === left ? right : left;
    return {
        ...preferred,
        pdfBlob: preferred.pdfBlob ?? other.pdfBlob,
        proposalOptionId: preferred.proposalOptionId ?? other.proposalOptionId,
    };
};

// Junta as cópias de cada proposta (aparelho, servidor, provisória e definitiva).
const mergeCopies = (pdfs: SavedPDF[]): SavedPDF[] => {
    const byKey = new Map<string, SavedPDF>();
    for (const pdf of pdfs) {
        const key = getProposalKey(pdf);
        const current = byKey.get(key);
        byKey.set(key, current ? mergeProposalCopies(current, pdf) : pdf);
    }
    return [...byKey.values()];
};

const dateOf = (pdf: SavedPDF) => new Date(pdf.date).getTime();

/**
 * Propostas do cliente para escolher no "Orçamento gerado": uma por opção (o
 * PDF mais recente de cada), mais recentes no topo. As cópias da mesma proposta
 * contam uma vez só, com a definitiva.
 */
export const listClientProposals = (
    pdfs: SavedPDF[],
    clientId: number,
    limit = 6,
    resolveOptionId?: OptionIdResolver
): SavedPDF[] => {
    const byOption = new Map<string, SavedPDF>();
    for (const pdf of mergeCopies(pdfs.filter(item => item.clienteId === clientId && item.id != null))) {
        const optionKey = getOptionKey(pdf, resolveOptionId);
        const current = byOption.get(optionKey);
        if (!current || dateOf(pdf) > dateOf(current)) byOption.set(optionKey, pdf);
    }
    return [...byOption.values()]
        .sort((left, right) => dateOf(right) - dateOf(left))
        .slice(0, limit);
};

/**
 * Todas as versões (PDFs) da mesma opção do cliente, cada proposta uma vez só.
 * A lixeira da lista tira a opção inteira: sai a versão tocada e as antigas,
 * menos as antigas que `isKept` protege. Basta uma cópia da versão estar
 * protegida (outra lista pode estar desatualizada).
 */
export const getOptionVersions = (
    pdfs: SavedPDF[],
    target: SavedPDF,
    isKept: (pdf: SavedPDF) => boolean,
    resolveOptionId?: OptionIdResolver
): { all: SavedPDF[]; toDelete: SavedPDF[]; kept: SavedPDF[]; targetLocked: boolean } => {
    const targetKey = getProposalKey(target);
    const sameClient = pdfs.filter(pdf => pdf.clienteId === target.clienteId && pdf.id != null);
    const keptKeys = new Set([...sameClient, target].filter(isKept).map(getProposalKey));
    const copies = mergeCopies([...sameClient, target]);
    const mergedTarget = copies.find(pdf => getProposalKey(pdf) === targetKey) ?? target;
    const optionKey = getOptionKey(mergedTarget, resolveOptionId);

    const all = copies.filter(pdf => getOptionKey(pdf, resolveOptionId) === optionKey);
    const kept = all.filter(pdf => getProposalKey(pdf) !== targetKey && keptKeys.has(getProposalKey(pdf)));
    // A tocada sai sempre, mas, se ela mesma está protegida, a tela avisa.
    return { all, toDelete: all.filter(pdf => !kept.includes(pdf)), kept, targetLocked: keptKeys.has(targetKey) };
};

interface PdfContentInput {
    client: Client | null | undefined;
    option: ProposalOption | null | undefined;
    measurements: UIMeasurement[];
    films: Film[];
    generalDiscount: unknown;
    totals: unknown;
    paymentConfig: unknown;
    userInfo: UserInfo | null | undefined;
    /** Dia de hoje: o PDF imprime a data de emissão e a validade conta dela. */
    issueDay: string;
}

/**
 * Resumo do que vai no PDF do orçamento. Igual ao do último PDF gerado = nada
 * mudou, então o botão PDF reabre aquele PDF em vez de salvar outro igual.
 * Fica de fora o que não aparece no PDF (ids, marcações de tela, datas internas).
 */
export const buildPdfContentSignature = ({
    client, option, measurements, films, generalDiscount, totals, paymentConfig, userInfo, issueDay,
}: PdfContentInput): string => {
    const activeMeasurements = measurements
        .filter(measurement => measurement.active)
        .map(({ id, isNew, focusField, ...content }) => content);
    // A mesma busca do PDF: acha a película também pelo nome antigo.
    const usedFilms = [...new Map(activeMeasurements
        .map(measurement => findFilmByName(films, measurement.pelicula))
        .filter((film): film is Film => !!film)
        .map(film => [film.nome, film])).values()];
    const { lastUpdated, pinned, pinnedAt, ...clientContent } = (client || {}) as Client;
    const { lastSelectedClientId, ...companyContent } = (userInfo || {}) as UserInfo;
    // O cálculo de corte é refeito sozinho (ex.: depois de duplicar); o que ele
    // muda no PDF chega pelos totais.
    const { filmCuttingSettings, ...discountContent } = (generalDiscount || {}) as { filmCuttingSettings?: unknown };
    return JSON.stringify({
        client: clientContent,
        optionId: option?.id ?? null,
        optionName: option?.name ?? null,
        measurements: activeMeasurements,
        films: usedFilms,
        generalDiscount: discountContent,
        totals,
        paymentConfig,
        company: companyContent,
        issueDay,
    });
};

/** Resumo curto (hash) da assinatura do PDF, para guardar no aparelho. */
export const hashPdfSignature = (value: string): string => {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        h1 = Math.imul(h1 ^ code, 2654435761);
        h2 = Math.imul(h2 ^ code, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return `${value.length.toString(36)}-${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`;
};

// Assinaturas dos PDFs gerados neste aparelho (as mais recentes), para o botão
// PDF reabrir o mesmo PDF mesmo depois de fechar e abrir o app.
const PDF_SIGNATURES_STORAGE_KEY = 'peliculas-br-pdf-signatures';
const MAX_STORED_PDF_SIGNATURES = 40;

const readStoredPdfSignatures = (): Array<[string, string]> => {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(PDF_SIGNATURES_STORAGE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.filter((entry): entry is [string, string] => (
            Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'string'
        )) : [];
    } catch {
        return [];
    }
};

export const rememberPdfSignature = (proposalKey: string, signatureHash: string): void => {
    try {
        const entries = readStoredPdfSignatures().filter(([key]) => key !== proposalKey);
        entries.push([proposalKey, signatureHash]);
        window.localStorage.setItem(
            PDF_SIGNATURES_STORAGE_KEY,
            JSON.stringify(entries.slice(-MAX_STORED_PDF_SIGNATURES))
        );
    } catch {
        // Sem espaço ou sem acesso ao armazenamento: o botão PDF só gera de novo.
    }
};

export const recallPdfSignature = (proposalKey: string): string | null => (
    readStoredPdfSignatures().find(([key]) => key === proposalKey)?.[1] ?? null
);
