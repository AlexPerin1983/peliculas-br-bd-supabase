import { normalizeSearchText } from './textSearch';

type ClientSearchFields = {
    nome?: string | null;
    telefone?: string | null;
    email?: string | null;
    cpfCnpj?: string | null;
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
};

const digitsOf = (value?: string | null) => (value || '').replace(/\D/g, '');

/** Endereço do cliente numa linha só, para busca (rua, número, bairro, cidade, UF e CEP). */
export const clientAddressSearchText = (client: ClientSearchFields): string => [
    client.logradouro,
    client.numero,
    client.complemento,
    client.bairro,
    client.cidade,
    client.uf,
    client.cep,
].filter(Boolean).join(' ');

/** Bairro e cidade para mostrar ao lado do nome quando a busca achou pelo endereço. */
export const clientPlaceLabel = (client: ClientSearchFields): string =>
    [client.bairro, client.cidade].map(part => (part || '').trim()).filter(Boolean).join(' · ');

/**
 * Busca de cliente pelo que o aplicador lembra: nome, e-mail, rua, bairro, cidade,
 * ou números (telefone, CEP, CPF/CNPJ). Ignora acentos, maiúsculas e a pontuação dos números
 * ("01310100" acha "01310-100"). Cada palavra do termo precisa aparecer em algum campo,
 * então "Maria Centro" acha a Maria que mora no Centro.
 */
export const matchesClientSearch = (client: ClientSearchFields, term: string): boolean => {
    const normalizedTerm = normalizeSearchText(term);
    if (!normalizedTerm) return true;

    const termDigits = digitsOf(normalizedTerm);
    const onlyNumbers = termDigits.length >= 3 && !/[a-z]/.test(normalizedTerm);
    if (onlyNumbers) {
        return [client.telefone, client.cep, client.cpfCnpj]
            .some(value => digitsOf(value).includes(termDigits));
    }

    const haystack = normalizeSearchText([
        client.nome,
        client.email,
        clientAddressSearchText(client),
    ].filter(Boolean).join(' '));
    if (haystack.includes(normalizedTerm)) return true;

    const words = normalizedTerm.split(/\s+/).filter(Boolean);
    return words.length > 1 && words.every(word => haystack.includes(word));
};

/** Indica se a busca só encontrou o cliente pelo endereço (não pelo nome nem pelo telefone). */
export const matchedOnlyByAddress = (client: ClientSearchFields, term: string): boolean => {
    const normalizedTerm = normalizeSearchText(term);
    if (!normalizedTerm || !matchesClientSearch(client, term)) return false;
    if (normalizeSearchText(client.nome).includes(normalizedTerm)) return false;
    const termDigits = digitsOf(normalizedTerm);
    if (termDigits.length >= 3 && digitsOf(client.telefone).includes(termDigits)) return false;
    return matchesClientSearch({
        cep: client.cep,
        logradouro: client.logradouro,
        numero: client.numero,
        complemento: client.complemento,
        bairro: client.bairro,
        cidade: client.cidade,
        uf: client.uf,
    }, term);
};
