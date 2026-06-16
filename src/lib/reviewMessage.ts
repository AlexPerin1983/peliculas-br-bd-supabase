import { Client, Measurement } from '../../types';

/**
 * Origem dos dados de SEO para o pedido de avaliacao. Tanto um orcamento salvo
 * (SavedPDF) quanto um agendamento avulso satisfazem este formato, permitindo
 * reaproveitar a mesma mensagem no Historico e na Agenda.
 */
export type ReviewSource = {
    clientName?: string;
    measurements?: Measurement[];
};

const getFirstName = (name: string) => name.trim().split(/\s+/)[0] || name;

const isMeaningfulText = (value?: string | null) => {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized !== '' && normalized !== 'desconhecido';
};

const getUniqueMeaningfulValues = (values: Array<string | undefined>) => {
    return Array.from(
        new Set(
            values
                .map(value => value?.trim())
                .filter((value): value is string => isMeaningfulText(value))
        )
    );
};

const buildFilmSummary = (filmNames: string[]) => {
    if (filmNames.length === 0) return 'as películas selecionadas';
    if (filmNames.length === 1) return `a película ${filmNames[0]}`;
    if (filmNames.length === 2) return `as películas ${filmNames[0]} e ${filmNames[1]}`;
    return `as películas ${filmNames[0]}, ${filmNames[1]} e outras`;
};

const joinNatural = (items: string[]) => {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
};

/**
 * Mensagem curta e direta para usar com o cliente na hora (acabamos de terminar
 * o servico). Puxa apenas modelo da pelicula e bairro quando vinculados, sem
 * texto de apoio. Retorna '' quando nao ha link do Google configurado.
 */
export const buildShortReviewMessage = (source: ReviewSource, client: Client, googleReviewsLink?: string) => {
    const reviewLink = googleReviewsLink?.trim();
    if (!reviewLink) return '';

    const measurements = source.measurements || [];
    const filmModels = joinNatural(getUniqueMeaningfulValues(measurements.map(measurement => measurement.pelicula)));
    const bairro = isMeaningfulText(client.bairro) ? client.bairro!.trim() : '';

    const filmPart = filmModels ? ` de película ${filmModels}` : '';
    const bairroPart = bairro ? ` no bairro ${bairro}` : '';

    return `Segue o link de avaliação para avaliar nosso serviço${filmPart}${bairroPart}:\n${reviewLink}`;
};

/**
 * Monta a dica de SEO usando pelicula, tipo de aplicacao, ambiente e bairro do
 * servico, orientando o cliente a escrever palavras que ajudam no Google.
 */
export const buildReviewLocationHint = (source: ReviewSource, client: Client) => {
    const measurements = source.measurements || [];
    const applicationTypes = getUniqueMeaningfulValues(measurements.map(measurement => measurement.tipoAplicacao));
    const environments = getUniqueMeaningfulValues(measurements.map(measurement => measurement.ambiente));
    const filmNames = getUniqueMeaningfulValues(measurements.map(measurement => measurement.pelicula));
    const filmDetail = filmNames.length > 0 ? buildFilmSummary(filmNames) : '';
    const applicationDetail = applicationTypes.length > 0 || environments.length > 0
        ? `onde aplicamos${applicationTypes.length > 0 || environments.length > 0
            ? ` (${[applicationTypes[0], environments[0]].filter(Boolean).join(' / ')})`
            : ''}`
        : '';
    const neighborhoodDetail = isMeaningfulText(client.bairro)
        ? `sua região/bairro (${client.bairro!.trim()})`
        : '';

    const details = [filmDetail, applicationDetail, neighborhoodDetail].filter(Boolean);
    if (details.length === 0) {
        return 'Se puder, use palavras que descrevam o servico feito, como pelicula para vidro, controle solar, privacidade, seguranca, insulfilm residencial ou comercial e sua cidade/bairro. Isso ajuda outras pessoas a encontrarem a Peliculas Brasil no Google.';
    }

    if (details.length === 1) {
        return `Se puder, mencione ${details[0]} e palavras relacionadas ao servico, como pelicula para vidro, controle solar, privacidade, seguranca, insulfilm residencial ou comercial e sua cidade/bairro. Isso ajuda outras pessoas a encontrarem a Peliculas Brasil no Google.`;
    }

    const intro = details.slice(0, -1).join(', ');
    const lastDetail = details[details.length - 1];
    return `Se puder, mencione ${intro} e ${lastDetail}, junto com palavras relacionadas ao servico, como pelicula para vidro, controle solar, privacidade, seguranca, insulfilm residencial ou comercial e sua cidade/bairro. Isso ajuda outras pessoas a encontrarem a Peliculas Brasil no Google.`;
};

/**
 * Valores dinamicos de um servico usados para montar/renderizar a mensagem.
 * Servem para "tokenizar" o texto editado pelo usuario (salvo no navegador) e
 * depois reidratar com os dados do proximo atendimento.
 */
export type ReviewTokens = {
    cliente: string;
    pelicula: string;
    bairro: string;
    link: string;
};

export const getReviewTokens = (source: ReviewSource, client: Client, googleReviewsLink?: string): ReviewTokens => {
    const measurements = source.measurements || [];
    return {
        cliente: getFirstName(client.nome || source.clientName || 'cliente'),
        pelicula: joinNatural(getUniqueMeaningfulValues(measurements.map(measurement => measurement.pelicula))),
        bairro: isMeaningfulText(client.bairro) ? client.bairro!.trim() : '',
        link: googleReviewsLink?.trim() || '',
    };
};

// Ordem importa: substituimos primeiro os valores mais longos/unicos (link,
// pelicula) e por ultimo o nome, evitando casar pedaços de palavra por engano.
const REVIEW_TOKEN_ORDER: { token: string; key: keyof ReviewTokens }[] = [
    { token: '{{link}}', key: 'link' },
    { token: '{{pelicula}}', key: 'pelicula' },
    { token: '{{bairro}}', key: 'bairro' },
    { token: '{{cliente}}', key: 'cliente' },
];

/**
 * Converte um texto ja renderizado (editado pelo usuario) em um molde, trocando
 * os valores dinamicos daquele atendimento por marcadores.
 */
export const templatizeReviewMessage = (text: string, tokens: ReviewTokens): string => {
    let result = text;
    for (const { token, key } of REVIEW_TOKEN_ORDER) {
        const value = tokens[key];
        if (value) result = result.split(value).join(token);
    }
    return result;
};

/**
 * Reidrata um molde salvo com os dados do atendimento atual. Faz uma limpeza
 * leve de espacos/pontuacao para o caso de algum marcador ficar vazio.
 */
export const renderReviewTemplate = (template: string, tokens: ReviewTokens): string => {
    let result = template;
    for (const { token, key } of REVIEW_TOKEN_ORDER) {
        result = result.split(token).join(tokens[key]);
    }
    return result
        .split('\n')
        .map(line => line.replace(/[ \t]{2,}/g, ' ').replace(/\s+([:,.;])/g, '$1').trimEnd())
        .join('\n');
};

/**
 * Mensagem completa de pos-venda com o link do Google e a dica de SEO.
 * Retorna '' quando nao ha link do Google configurado.
 */
export const buildReviewFollowUpMessage = (source: ReviewSource, client: Client, googleReviewsLink?: string) => {
    const reviewLink = googleReviewsLink?.trim();
    if (!reviewLink) return '';

    const firstName = getFirstName(client.nome || source.clientName || 'cliente');
    const locationHint = buildReviewLocationHint(source, client);

    return [
        `Ola ${firstName}, essa e uma pesquisa de satisfacao para avaliar nosso trabalho.`,
        '',
        'Seu retorno ajuda a gente a melhorar e tambem ajuda novos clientes a conhecerem a qualidade do servico.',
        '',
        'Se puder, deixe sua avaliacao no Google pelo link abaixo:',
        reviewLink,
        ...(locationHint ? ['', locationHint] : []),
        '',
        'Se tambem puder enviar 1 ou 2 fotos do resultado, registramos junto do pos-venda e da garantia.',
        '',
        'Obrigado pela confianca.',
    ].join('\n');
};
