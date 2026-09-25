// Junta uma mensagem pronta com o link da proposta para enviar tudo de uma vez.

const LINK_TOKEN = /\{\{\s*link\s*\}\}/g;
const EXPIRY_TOKEN = /\{\{\s*validade\s*\}\}/g;

const formatExpiry = (expiresAt: string) => new Date(expiresAt).toLocaleDateString('pt-BR');

export const buildProposalLinkBlock = (portalUrl: string, expiresAt: string) =>
    `Veja os detalhes, baixe o PDF e aprove pelo link:\n${portalUrl}\n\nVálido até ${formatExpiry(expiresAt)}.`;

/**
 * Se a mensagem tiver {{link}} (e opcionalmente {{validade}}), o link entra ali;
 * senão, o bloco com o link e a validade vai no fim da mensagem.
 */
export const attachProposalLink = (message: string, portalUrl: string, expiresAt: string) => {
    const text = message.trim();
    if (text.search(LINK_TOKEN) >= 0) {
        return text.replace(LINK_TOKEN, portalUrl).replace(EXPIRY_TOKEN, formatExpiry(expiresAt));
    }
    return `${text.replace(EXPIRY_TOKEN, formatExpiry(expiresAt))}\n\n${buildProposalLinkBlock(portalUrl, expiresAt)}`;
};
