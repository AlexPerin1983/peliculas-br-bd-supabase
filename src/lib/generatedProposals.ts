import type { Client, Film, ProposalOption, SavedPDF, UIMeasurement, UserInfo } from '../../types';
import { findFilmByName } from './filmCatalog';

/**
 * Identificação de uma proposta gerada que não muda com a sincronização: o PDF
 * nasce com um id provisório (negativo) e, quando sobe para o servidor, ganha o
 * id definitivo. Cliente + opção + data de geração continuam os mesmos.
 */
export const getProposalKey = (pdf: Pick<SavedPDF, 'clienteId' | 'proposalOptionId' | 'proposalOptionName' | 'date'>): string =>
    `${pdf.clienteId}|${pdf.proposalOptionId ?? pdf.proposalOptionName ?? ''}|${pdf.date}`;

const hasPersistedId = (pdf: SavedPDF) => typeof pdf.id === 'number' && pdf.id > 0;

const getOptionKey = (pdf: SavedPDF) => pdf.proposalOptionId != null
    ? `id:${pdf.proposalOptionId}`
    : pdf.proposalOptionName ? `nome:${pdf.proposalOptionName}` : `pdf:${getProposalKey(pdf)}`;

/**
 * Propostas do cliente para escolher no "Orçamento gerado": uma por opção (o
 * PDF mais recente de cada), mais recentes no topo. A mesma proposta com id
 * provisório e definitivo conta uma vez só, com o definitivo.
 */
export const listClientProposals = (pdfs: SavedPDF[], clientId: number, limit = 6): SavedPDF[] => {
    const byOption = new Map<string, SavedPDF>();
    for (const pdf of pdfs) {
        if (pdf.clienteId !== clientId || pdf.id == null) continue;
        const optionKey = getOptionKey(pdf);
        const current = byOption.get(optionKey);
        if (!current || new Date(pdf.date).getTime() > new Date(current.date).getTime()) {
            byOption.set(optionKey, pdf);
        } else if (getProposalKey(pdf) === getProposalKey(current)) {
            const preferred = !hasPersistedId(current) && hasPersistedId(pdf) ? pdf : current;
            const other = preferred === pdf ? current : pdf;
            // Mantém o PDF já gerado em memória (abre e compartilha sem baixar de novo).
            byOption.set(optionKey, !preferred.pdfBlob && other.pdfBlob ? { ...preferred, pdfBlob: other.pdfBlob } : preferred);
        }
    }
    return [...byOption.values()]
        .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
        .slice(0, limit);
};

/**
 * Todas as versões (PDFs) da mesma opção do cliente, sem repetir a provisória e a
 * definitiva. A lixeira da lista tira a opção inteira: sai a versão tocada e as
 * antigas, menos as antigas que `isKept` protege (aprovadas ou agendadas). Basta
 * uma cópia da versão protegida (outra lista pode estar desatualizada).
 */
export const getOptionVersions = (
    pdfs: SavedPDF[],
    target: SavedPDF,
    isKept: (pdf: SavedPDF) => boolean
): { all: SavedPDF[]; toDelete: SavedPDF[]; kept: SavedPDF[] } => {
    const optionKey = getOptionKey(target);
    const targetKey = getProposalKey(target);
    const byKey = new Map<string, SavedPDF>();
    const keptKeys = new Set<string>();
    for (const pdf of pdfs) {
        if (pdf.clienteId !== target.clienteId || pdf.id == null || getOptionKey(pdf) !== optionKey) continue;
        const key = getProposalKey(pdf);
        if (isKept(pdf)) keptKeys.add(key);
        const current = byKey.get(key);
        if (!current || (!hasPersistedId(current) && hasPersistedId(pdf))) byKey.set(key, pdf);
    }
    if (!byKey.has(targetKey)) byKey.set(targetKey, target);

    const all = [...byKey.values()];
    const kept = all.filter(pdf => getProposalKey(pdf) !== targetKey && keptKeys.has(getProposalKey(pdf)));
    return { all, toDelete: all.filter(pdf => !kept.includes(pdf)), kept };
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
