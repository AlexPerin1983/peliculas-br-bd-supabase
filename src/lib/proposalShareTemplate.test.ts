import { beforeEach, describe, expect, it } from 'vitest';
import { fillShareTemplate, loadShareTemplates, saveShareTemplate, toShareTemplate, type ShareMessageValues } from './proposalShareTemplate';

const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const expiresAt = '2026-12-07T23:59:59';
const expiry = new Date(expiresAt).toLocaleDateString('pt-BR');

const maria: ShareMessageValues = {
    firstName: 'Maria',
    url: 'https://app.filmstec.shop/p/maria/abc',
    expiresAt,
    prices: `Carbono: ${brl(4612.5)}\nBlackout: ${brl(768.75)}`,
    amounts: [brl(4612.5), brl(768.75)],
    names: ['Carbono', 'Blackout'],
    count: 2,
};
const joao: ShareMessageValues = {
    firstName: 'João',
    url: 'https://app.filmstec.shop/p/joao/xyz',
    expiresAt: '2027-01-15T23:59:59',
    prices: `Silver 20: ${brl(980)}`,
    amounts: [brl(980)],
    names: ['Silver 20'],
    count: 1,
};

describe('proposalShareTemplate', () => {
    beforeEach(() => window.localStorage.clear());

    it('troca nome, link e "os orçamentos" do cliente atual pelos do próximo', () => {
        const edited = `Maria, segue os orçamentos que conversamos:\n${maria.url}\nQualquer coisa me chama.`;
        const { template, problem } = toShareTemplate(edited, maria);

        expect(problem).toBeNull();
        expect(template).toBe('{{nome}}, segue {{o_orcamento}} que conversamos:\n{{link}}\nQualquer coisa me chama.');
        expect(fillShareTemplate(template, joao)).toBe(`João, segue o orçamento que conversamos:\n${joao.url}\nQualquer coisa me chama.`);
    });

    it('a mensagem com valores leva a lista, a quantidade e a validade do próximo cliente', () => {
        const edited = `Oi, Maria! Seguem as 2 opções:\n\n${maria.prices}\n\n${maria.url}\n\nVale até ${expiry}.`;
        const { template } = toShareTemplate(edited, maria);

        expect(template).toBe('Oi, {{nome}}! Seguem as {{n_opcoes}}:\n\n{{valores}}\n\n{{link}}\n\nVale até {{validade}}.');
        const filled = fillShareTemplate(template, joao);
        expect(filled).toContain('Oi, João! Seguem as 1 opção:');
        expect(filled).toContain(joao.prices);
        expect(filled).toContain(new Date(joao.expiresAt).toLocaleDateString('pt-BR'));
        expect(filled).not.toContain('Maria');
    });

    it('avisa quando um valor foi mexido à mão (iria igual para o próximo cliente)', () => {
        const edited = `Maria, o Carbono fica ${brl(4612.5)}.\n${maria.url}`;
        expect(toShareTemplate(edited, maria).problem).toBe('valores');
    });

    it('lista só com os nomes (preços apagados) leva as películas do próximo cliente', () => {
        // Caso real: apagou o preço e deixou só a película; o próximo cliente
        // não pode receber a película do anterior.
        const one: ShareMessageValues = { ...joao, firstName: 'Amauri', prices: `Color Stable: ${brl(1200)}`, amounts: [brl(1200)], names: ['Color Stable'] };
        const edited = `Amauri\nPreparei sua proposta:\n\nColor Stable\n\n${joao.url}`;
        const { template, problem } = toShareTemplate(edited, one);

        expect(problem).toBeNull();
        expect(template).toBe('{{nome}}\nPreparei sua proposta:\n\n{{opcoes}}\n\n{{link}}');
        const suntek: ShareMessageValues = { ...maria, firstName: 'Gilmar', names: ['Suntek'], prices: `Suntek: ${brl(352)}`, amounts: [brl(352)], count: 1 };
        expect(fillShareTemplate(template, suntek)).toBe(`Gilmar\nPreparei sua proposta:\n\nSuntek\n\n${maria.url}`);
    });

    it('com várias opções, os nomes sem preço também viram a lista do próximo cliente', () => {
        const edited = `Maria, seguem:\nCarbono\nBlackout\n${maria.url}`;
        const { template } = toShareTemplate(edited, maria);
        expect(template).toBe('{{nome}}, seguem:\n{{opcoes}}\n{{link}}');
        expect(fillShareTemplate(template, joao)).toBe(`João, seguem:\nSilver 20\n${joao.url}`);
    });

    it('não salva se o nome de uma película ficou solto no texto', () => {
        const edited = `Maria, o Blackout ficou ótimo.\n${maria.url}`;
        expect(toShareTemplate(edited, maria).problem).toBe('opcoes');
    });

    it('cliente sem nome: tira o nome sem deixar vírgula sobrando', () => {
        expect(fillShareTemplate('Oi, {{nome}}! Segue:\n{{link}}', { ...joao, firstName: '' })).toBe(`Oi! Segue:\n${joao.url}`);
    });

    it('guarda e apaga o modelo de cada estilo no aparelho', () => {
        saveShareTemplate('short', 'Segue {{o_orcamento}}:\n{{link}}');
        expect(loadShareTemplates()).toEqual({ short: 'Segue {{o_orcamento}}:\n{{link}}' });
        saveShareTemplate('full', 'Oi {{nome}}\n{{link}}');
        saveShareTemplate('short', null);
        expect(loadShareTemplates()).toEqual({ full: 'Oi {{nome}}\n{{link}}' });
    });
});
