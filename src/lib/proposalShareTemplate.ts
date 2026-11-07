// Mensagem do link salva pelo aplicador ("Salvar como padrão"), guardada no
// aparelho. O texto editado vira um modelo: o que é do cliente (nome, link,
// validade, valores, quantidade de opções) vira um campo que o app preenche
// na próxima vez, para outro cliente.

import { attachProposalLink } from './proposalShareText';

export type ShareMessageStyle = 'short' | 'full';

export interface ShareMessageValues {
    firstName: string;
    url: string;
    expiresAt: string;
    /** Uma linha por opção ("Nome: R$ 1.234,56"), como na mensagem com valores. */
    prices: string;
    /** Valores em R$ de cada opção, para saber se algum ficou solto no texto. */
    amounts: string[];
    /** Nome de cada opção (película), na mesma ordem da lista de valores. */
    names: string[];
    count: number;
}

/** O que ficou solto no texto e iria igual para o próximo cliente. */
export type ShareTemplateProblem = 'valores' | 'opcoes' | null;

const STORAGE_KEY = 'peliculas-br-proposal-message-templates-v1';

const formatExpiry = (expiresAt: string) => new Date(expiresAt).toLocaleDateString('pt-BR');
const optionsLabel = (count: number) => count === 1 ? '1 opção' : `${count} opções`;
const quoteLabel = (count: number) => count > 1 ? 'os orçamentos' : 'o orçamento';
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const replaceAll = (text: string, search: string, token: string) =>
    search ? text.split(search).join(token) : text;

/**
 * Troca o que é do cliente atual pelos campos do modelo. `problem` avisa que um
 * valor em R$ ou o nome de uma opção foi mexido à mão e iria igual para o
 * próximo cliente (ex.: apagou o preço e deixou só "Color Stable").
 */
export const toShareTemplate = (text: string, values: ShareMessageValues) => {
    let template = text.trim();
    template = replaceAll(template, values.url, '{{link}}');
    template = replaceAll(template, values.prices, '{{valores}}');
    // Lista só com os nomes (o aplicador tirou os preços): vira a lista de opções.
    template = replaceAll(template, values.names.join('\n'), '{{opcoes}}');
    template = replaceAll(template, formatExpiry(values.expiresAt), '{{validade}}');
    if (values.count > 1) template = replaceAll(template, optionsLabel(values.count), '{{n_opcoes}}');
    template = template.replace(/(^|[^\p{L}])(os orçamentos|o orçamento)(?![\p{L}])/gu, '$1{{o_orcamento}}');
    template = template.replace(/(^|[^\p{L}])(Os orçamentos|O orçamento)(?![\p{L}])/gu, '$1{{O_orcamento}}');
    if (values.firstName) {
        const name = new RegExp(`(^|[^\\p{L}])${escapeRegExp(values.firstName)}(?![\\p{L}])`, 'gu');
        template = template.replace(name, '$1{{nome}}');
    }
    const problem: ShareTemplateProblem = values.amounts.some(amount => amount && template.includes(amount))
        ? 'valores'
        : values.names.some(name => name.trim() && template.includes(name.trim()))
            ? 'opcoes'
            : null;
    return { template, problem };
};

/** Monta a mensagem do modelo salvo para o cliente e o link atuais. */
export const fillShareTemplate = (template: string, values: ShareMessageValues) => {
    let text = template
        .replace(/\{\{\s*valores\s*\}\}/g, values.prices)
        .replace(/\{\{\s*opcoes\s*\}\}/g, values.names.join('\n'))
        .replace(/\{\{\s*n_opcoes\s*\}\}/g, optionsLabel(values.count))
        .replace(/\{\{O_orcamento\}\}/g, () => {
            const label = quoteLabel(values.count);
            return label.charAt(0).toUpperCase() + label.slice(1);
        })
        .replace(/\{\{o_orcamento\}\}/g, quoteLabel(values.count));
    // Cliente sem nome: "Oi, {{nome}}!" vira "Oi!".
    text = values.firstName
        ? text.replace(/\{\{\s*nome\s*\}\}/g, values.firstName)
        : text.replace(/,?[ \t]*\{\{\s*nome\s*\}\}/g, '');
    return attachProposalLink(text, values.url, values.expiresAt);
};

export const loadShareTemplates = (): Partial<Record<ShareMessageStyle, string>> => {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
        const result: Partial<Record<ShareMessageStyle, string>> = {};
        if (typeof parsed?.short === 'string' && parsed.short.trim()) result.short = parsed.short;
        if (typeof parsed?.full === 'string' && parsed.full.trim()) result.full = parsed.full;
        return result;
    } catch {
        return {};
    }
};

/** Guarda (ou apaga, com null) o modelo de um estilo. Devolve os modelos atuais. */
export const saveShareTemplate = (style: ShareMessageStyle, template: string | null) => {
    const next = { ...loadShareTemplates() };
    if (template && template.trim()) next[style] = template.trim();
    else delete next[style];
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // Sem armazenamento no aparelho: vale só até fechar a tela.
    }
    return next;
};
