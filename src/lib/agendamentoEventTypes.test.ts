import { describe, expect, it } from 'vitest';
import { DEFAULT_EVENT_TYPE, getAgendamentoColor, getEventTypeMeta, normalizeEventColor, normalizeEventType } from './agendamentoEventTypes';

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
        expect(getAgendamentoColor({ eventType: 'consulta' })).toBe(getEventTypeMeta('consulta')!.color);
        expect(getAgendamentoColor({ eventType: 'consulta', color: 'vermelho' })).toBe(getEventTypeMeta('consulta')!.color);
        expect(getAgendamentoColor({})).toBeUndefined();
        expect(normalizeEventColor('#12ab9f')).toBe('#12ab9f');
        expect(normalizeEventColor('12ab9f')).toBeUndefined();
    });
});
