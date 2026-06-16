import { describe, expect, it } from 'vitest';
import { Client, Measurement } from '../../types';
import {
    buildShortReviewMessage,
    getReviewTokens,
    renderReviewTemplate,
    templatizeReviewMessage,
} from './reviewMessage';

const LINK = 'https://g.page/r/abc/review';

const makeClient = (overrides: Partial<Client> = {}): Client => ({
    nome: 'Polyana Gonçalves',
    bairro: 'Alhandra',
    ...overrides,
} as Client);

const makeSource = (peliculas: string[]) => ({
    clientName: 'Polyana Gonçalves',
    measurements: peliculas.map(pelicula => ({ pelicula } as Measurement)),
});

describe('buildShortReviewMessage', () => {
    it('inclui só película e bairro vinculados', () => {
        const msg = buildShortReviewMessage(makeSource(['Fumê espelhado']), makeClient(), LINK);
        expect(msg).toBe(`Segue o link de avaliação para avaliar nosso serviço de película Fumê espelhado no bairro Alhandra:\n${LINK}`);
    });

    it('omite partes sem dado vinculado', () => {
        const msg = buildShortReviewMessage(makeSource([]), makeClient({ bairro: undefined }), LINK);
        expect(msg).toBe(`Segue o link de avaliação para avaliar nosso serviço:\n${LINK}`);
    });

    it('retorna vazio sem link do Google', () => {
        expect(buildShortReviewMessage(makeSource(['X']), makeClient(), '')).toBe('');
    });
});

describe('molde salvo (templatize → render)', () => {
    it('mantém a redação editada e troca os dados pelo do próximo cliente', () => {
        const tokensA = getReviewTokens(makeSource(['Fumê espelhado', 'Jateada']), makeClient(), LINK);

        // Usuário editou o texto na tela (já renderizado com os dados do cliente A).
        const edited = 'Oi! Avalie nosso serviço de película Fumê espelhado e Jateada no bairro Alhandra aqui: ' + LINK;
        const template = templatizeReviewMessage(edited, tokensA);

        expect(template).toBe('Oi! Avalie nosso serviço de película {{pelicula}} no bairro {{bairro}} aqui: {{link}}');

        // Próximo atendimento: outro cliente/película/bairro, mesmo link.
        const tokensB = getReviewTokens(makeSource(['Insulfilm G20']), makeClient({ bairro: 'Centro' }), LINK);
        const rendered = renderReviewTemplate(template, tokensB);

        expect(rendered).toBe(`Oi! Avalie nosso serviço de película Insulfilm G20 no bairro Centro aqui: ${LINK}`);
    });
});
