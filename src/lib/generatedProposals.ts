import type { SavedPDF } from '../../types';

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
