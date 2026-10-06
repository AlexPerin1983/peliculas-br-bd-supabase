import { describe, expect, it } from 'vitest';
import { matchesAgendaFilters, normalizeSearchText } from './agendaFilters';

const amaury = { clienteNome: 'Amaury Gonçalves', title: 'Fachada da loja', eventType: 'instalacao' as const };

describe('busca e filtro da agenda', () => {
    it('acha pelo nome sem ligar para acento e maiúscula', () => {
        expect(normalizeSearchText('  JOÃO  ')).toBe('joao');
        expect(matchesAgendaFilters(amaury, { query: 'amaury', type: 'todos' })).toBe(true);
        expect(matchesAgendaFilters(amaury, { query: 'goncalves', type: 'todos' })).toBe(true);
        expect(matchesAgendaFilters(amaury, { query: 'maria', type: 'todos' })).toBe(false);
    });

    it('também acha pelo título e pelo bairro, com todas as palavras', () => {
        expect(matchesAgendaFilters(amaury, { query: 'fachada', type: 'todos' })).toBe(true);
        expect(matchesAgendaFilters(amaury, { query: 'amaury bessa', type: 'todos', bairro: 'Bessa' })).toBe(true);
        expect(matchesAgendaFilters(amaury, { query: 'amaury manaira', type: 'todos', bairro: 'Bessa' })).toBe(false);
    });

    it('filtra pelo tipo; sem busca, todos do tipo passam', () => {
        expect(matchesAgendaFilters(amaury, { query: '', type: 'instalacao' })).toBe(true);
        expect(matchesAgendaFilters(amaury, { query: '', type: 'consulta' })).toBe(false);
        expect(matchesAgendaFilters({ clienteNome: 'Antigo' }, { query: '', type: 'instalacao' })).toBe(false);
        expect(matchesAgendaFilters({ clienteNome: 'Antigo' }, { query: '', type: 'todos' })).toBe(true);
    });
});
