import type { Client, Film, ProposalOption, SavedPDF, UIMeasurement, UserInfo } from '../../types';

/**
 * Identificação de uma proposta gerada que não muda com a sincronização: o PDF
 * nasce com um id provisório (negativo) e, quando sobe para o servidor, ganha o
 * id definitivo. Cliente + opção + data de geração continuam os mesmos.
 */
export const getProposalKey = (pdf: Pick<SavedPDF, 'clienteId' | 'proposalOptionId' | 'proposalOptionName' | 'date'>): string =>
    `${pdf.clienteId}|${pdf.proposalOptionId ?? pdf.proposalOptionName ?? ''}|${pdf.date}`;

const hasPersistedId = (pdf: SavedPDF) => typeof pdf.id === 'number' && pdf.id > 0;

/**
 * Propostas do cliente para escolher no "Orçamento gerado": sem repetir a mesma
 * proposta (provisória e definitiva), a definitiva primeiro, mais recentes no topo.
 */
export const listClientProposals = (pdfs: SavedPDF[], clientId: number, limit = 6): SavedPDF[] => {
    const byKey = new Map<string, SavedPDF>();
    for (const pdf of pdfs) {
        if (pdf.clienteId !== clientId || pdf.id == null) continue;
        const key = getProposalKey(pdf);
        const current = byKey.get(key);
        if (!current || (!hasPersistedId(current) && hasPersistedId(pdf))) {
            // Mantém o PDF já gerado em memória (abre e compartilha sem baixar de novo).
            byKey.set(key, current?.pdfBlob && !pdf.pdfBlob ? { ...pdf, pdfBlob: current.pdfBlob } : pdf);
        }
    }
    return [...byKey.values()]
        .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
        .slice(0, limit);
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
}

/**
 * Resumo do que vai no PDF do orçamento. Igual ao do último PDF gerado = nada
 * mudou, então o botão PDF reabre aquele PDF em vez de salvar outro igual.
 * Fica de fora o que não aparece no PDF (ids, marcações de tela, datas internas).
 */
export const buildPdfContentSignature = ({
    client, option, measurements, films, generalDiscount, totals, paymentConfig, userInfo,
}: PdfContentInput): string => {
    const activeMeasurements = measurements
        .filter(measurement => measurement.active)
        .map(({ id, isNew, focusField, ...content }) => content);
    const usedFilms = new Set(activeMeasurements.map(measurement => measurement.pelicula));
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
        films: films.filter(film => usedFilms.has(film.nome)),
        generalDiscount: discountContent,
        totals,
        paymentConfig,
        company: companyContent,
    });
};
