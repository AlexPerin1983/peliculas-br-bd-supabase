import { Agendamento, AgendamentoEventType } from '../../types';

// Tipo do agendamento (Consulta, Instalação...) e a cor que ele mostra na agenda.
// As cores ficam fora das do status (azul, verde, âmbar e vermelho) para não confundir.

export interface EventTypeMeta {
    value: AgendamentoEventType;
    label: string;
    iconClassName: string;
    color: string;
}

export const EVENT_TYPES: EventTypeMeta[] = [
    { value: 'consulta', label: 'Consulta', iconClassName: 'fas fa-comments', color: '#7c3aed' },
    { value: 'instalacao', label: 'Instalação', iconClassName: 'fas fa-screwdriver-wrench', color: '#0891b2' },
    { value: 'variado', label: 'Variado', iconClassName: 'fas fa-shapes', color: '#ea580c' },
    { value: 'outro', label: 'Outro', iconClassName: 'fas fa-ellipsis', color: '#64748b' },
];

// Agendamento novo já começa como Instalação, o mais comum.
export const DEFAULT_EVENT_TYPE: AgendamentoEventType = 'instalacao';

// Cores para trocar a do tipo num agendamento específico.
export const EVENT_COLOR_PALETTE = ['#7c3aed', '#0891b2', '#ea580c', '#db2777', '#0d9488', '#4f46e5', '#65a30d', '#64748b'];

export const getEventTypeMeta = (value?: string | null) => EVENT_TYPES.find(type => type.value === value);

export const normalizeEventType = (value: unknown): AgendamentoEventType | undefined => {
    const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
    const plain = text.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return getEventTypeMeta(plain)?.value;
};

export const normalizeEventColor = (value: unknown): string | undefined => (
    typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : undefined
);

// Cor que o agendamento mostra: a escolhida, senão a do tipo.
export const getAgendamentoColor = (agendamento: Pick<Agendamento, 'eventType' | 'color'>) => (
    normalizeEventColor(agendamento.color) ?? getEventTypeMeta(agendamento.eventType)?.color
);
