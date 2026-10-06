import { describe, expect, it } from 'vitest';
import { DEFAULT_EVENT_TYPE, getAgendamentoColor, getCalendarDots, getEventTypeMeta, normalizeEventColor, normalizeEventType } from './agendamentoEventTypes';

const CONSULTA = getEventTypeMeta('consulta')!.color;
const INSTALACAO = getEventTypeMeta('instalacao')!.color;

describe('tipos de agendamento', () => {
    it('entende o tipo com ou sem acento e maiúsculas', () => {
        expect(normalizeEventType('Instalação')).toBe('instalacao');
        expect(normalizeEventType('CONSULTA')).toBe('consulta');
        expect(normalizeEventType(' variado ')).toBe('variado');
        expect(normalizeEventType('')).toBeUndefined();
        expect(normalizeEventType('reunião')).toBeUndefined();
        expect(DEFAULT_EVENT_TYPE).toBe('instalacao');
    });

    it('usa a cor escolhida, senão a do tipo, senão nenhuma', () => {
        expect(getAgendamentoColor({ eventType: 'consulta', color: '#DB2777' })).toBe('#db2777');
        expect(getAgendamentoColor({ eventType: 'consulta' })).toBe(CONSULTA);
        expect(getAgendamentoColor({ eventType: 'consulta', color: 'vermelho' })).toBe(CONSULTA);
        expect(getAgendamentoColor({})).toBeUndefined();
        expect(normalizeEventColor('#12ab9f')).toBe('#12ab9f');
        expect(normalizeEventColor('12ab9f')).toBeUndefined();
    });
});

describe('pontinhos do calendário', () => {
    it('um por agendamento, na cor do tipo, com cancelado e faltou apagados', () => {
        expect(getCalendarDots([
            { id: 1, clienteNome: 'Ana', eventType: 'consulta' },
            { id: 2, clienteNome: 'Bruno', eventType: 'instalacao', serviceStatus: 'cancelled' },
            { id: 3, clienteNome: 'Caio', serviceStatus: 'no_show' },
        ])).toEqual([
            { id: 1, color: CONSULTA, muted: false, label: 'Ana · Consulta' },
            { id: 2, color: INSTALACAO, muted: true, label: 'Bruno · Instalação' },
            { id: 3, color: undefined, muted: true, label: 'Caio' },
        ]);
    });

    it('com muitos no dia, mostra cada cor ao menos uma vez e os ativos antes dos apagados', () => {
        const dots = getCalendarDots([
            { id: 1, clienteNome: 'A', eventType: 'instalacao' },
            { id: 2, clienteNome: 'B', eventType: 'instalacao' },
            { id: 3, clienteNome: 'C', eventType: 'instalacao', serviceStatus: 'cancelled' },
            { id: 4, clienteNome: 'D', eventType: 'instalacao' },
            { id: 5, clienteNome: 'E', eventType: 'consulta' },
        ]);
        expect(dots.map(dot => dot.id)).toEqual([1, 2, 5]);
    });

    it('cor só de cancelado ainda aparece quando sobra espaço para ela', () => {
        const dots = getCalendarDots([
            { id: 1, clienteNome: 'A', eventType: 'instalacao' },
            { id: 2, clienteNome: 'B', eventType: 'instalacao' },
            { id: 3, clienteNome: 'C', eventType: 'instalacao' },
            { id: 4, clienteNome: 'D', eventType: 'consulta', serviceStatus: 'cancelled' },
        ]);
        expect(dots.map(dot => dot.id)).toEqual([1, 2, 4]);
    });
});
