import { Agendamento, AgendamentoEventType } from '../../types';

// Busca e filtro por tipo da Lista da agenda.

export type AgendaTypeFilter = AgendamentoEventType | 'todos';

// Sem acento e sem maiúscula: "joao" acha "João".
export const normalizeSearchText = (value: string) => value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// A busca olha o nome do cliente, o título e o bairro; o tipo "todos" deixa passar qualquer um.
export const matchesAgendaFilters = (
    agendamento: Pick<Agendamento, 'clienteNome' | 'title' | 'eventType'>,
    { query, type, bairro }: { query: string; type: AgendaTypeFilter; bairro?: string },
) => {
    if (type !== 'todos' && agendamento.eventType !== type) return false;
    const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const haystack = normalizeSearchText([agendamento.clienteNome, agendamento.title, bairro].filter(Boolean).join(' '));
    return terms.every((term) => haystack.includes(term));
};
