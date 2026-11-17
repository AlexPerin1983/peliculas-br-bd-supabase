import { describe, expect, it } from 'vitest';
import { clientPlaceLabel, matchedOnlyByAddress, matchesClientSearch } from './clientSearch';
import { buildClientSearchFilter } from '../../services/supabaseDb';

const maria = {
    nome: 'Maria Souza',
    telefone: '(11) 98765-4321',
    email: 'maria@exemplo.com',
    cep: '01310-100',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
};

describe('matchesClientSearch', () => {
    it('acha pelo nome, ignorando acentos e maiúsculas', () => {
        expect(matchesClientSearch(maria, 'MARIA')).toBe(true);
        expect(matchesClientSearch(maria, 'joão')).toBe(false);
    });

    it('acha pelo bairro, rua e cidade', () => {
        expect(matchesClientSearch(maria, 'bela vista')).toBe(true);
        expect(matchesClientSearch(maria, 'paulista')).toBe(true);
        expect(matchesClientSearch(maria, 'sao paulo')).toBe(true);
        expect(matchesClientSearch(maria, 'Centro')).toBe(false);
    });

    it('acha pelo CEP com ou sem traço', () => {
        expect(matchesClientSearch(maria, '01310-100')).toBe(true);
        expect(matchesClientSearch(maria, '01310100')).toBe(true);
        expect(matchesClientSearch(maria, '01310')).toBe(true);
        expect(matchesClientSearch(maria, '04500')).toBe(false);
    });

    it('acha pelo telefone só com números', () => {
        expect(matchesClientSearch(maria, '98765')).toBe(true);
    });

    it('junta nome e bairro na mesma busca', () => {
        expect(matchesClientSearch(maria, 'maria bela vista')).toBe(true);
        expect(matchesClientSearch(maria, 'maria centro')).toBe(false);
    });

    it('não quebra com cliente sem endereço', () => {
        expect(matchesClientSearch({ nome: 'Ana', telefone: '' }, 'centro')).toBe(false);
        expect(matchesClientSearch({ nome: 'Ana', telefone: '' }, '')).toBe(true);
    });
});

describe('matchedOnlyByAddress', () => {
    it('avisa quando o cliente apareceu por causa do endereço', () => {
        expect(matchedOnlyByAddress(maria, 'bela vista')).toBe(true);
        expect(matchedOnlyByAddress(maria, '01310')).toBe(true);
        expect(matchedOnlyByAddress(maria, 'maria')).toBe(false);
        expect(matchedOnlyByAddress(maria, '98765')).toBe(false);
    });

    it('mostra bairro e cidade', () => {
        expect(clientPlaceLabel(maria)).toBe('Bela Vista · São Paulo');
        expect(clientPlaceLabel({ cidade: 'Campinas' })).toBe('Campinas');
    });
});

describe('buildClientSearchFilter', () => {
    it('procura também no endereço do cliente', () => {
        const filter = buildClientSearchFilter('Centro');
        expect(filter).toContain('bairro.ilike.%Centro%');
        expect(filter).toContain('logradouro.ilike.%Centro%');
        expect(filter).toContain('cidade.ilike.%Centro%');
        expect(filter).toContain('cep.ilike.%Centro%');
    });

    it('acha CEP salvo com traço quando a pessoa digita só os números', () => {
        expect(buildClientSearchFilter('01310100')).toContain('cep.ilike.%01310-100%');
        expect(buildClientSearchFilter('01310-100')).toContain('cep.ilike.%01310100%');
    });
});
