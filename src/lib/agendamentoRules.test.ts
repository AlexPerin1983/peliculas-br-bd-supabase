import { describe, expect, it } from 'vitest';
import { getAgendamentoSlotError, getWorkingEndLabel, isWithinWorkingHours } from './agendamentoRules';
import { Agendamento } from '../../types';

const workingHours = { start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] };
// Sexta-feira, 02/10/2026, no horário do aparelho.
const at = (hours: number, minutes = 0, day = 2) => new Date(2026, 9, day, hours, minutes);

const booked = (start: Date, end: Date, extra: Partial<Agendamento> = {}): Agendamento => ({
    id: 1,
    clienteId: 7,
    clienteNome: 'Ana',
    start: start.toISOString(),
    end: end.toISOString(),
    ...extra,
});

describe('getAgendamentoSlotError', () => {
    const base = { workingHours, agendamentos: [] as Agendamento[], capacity: 1 };

    it('libera horário dentro do expediente', () => {
        expect(getAgendamentoSlotError({ ...base, start: at(9), end: at(12) })).toBeNull();
    });

    it('pede o horário de funcionamento quando ele não foi configurado', () => {
        expect(getAgendamentoSlotError({ ...base, workingHours: undefined, start: at(9), end: at(12) }))
            .toBe('Configure o horário de funcionamento da empresa nas Configurações para agendar.');
    });

    it('recusa término antes do início, dia sem trabalho e fora do expediente', () => {
        expect(getAgendamentoSlotError({ ...base, start: at(12), end: at(9) }))
            .toBe('O horário de término deve ser posterior ao de início.');
        expect(getAgendamentoSlotError({ ...base, start: at(9, 0, 4), end: at(12, 0, 4) }))
            .toBe('A data selecionada não é um dia de trabalho.');
        expect(getAgendamentoSlotError({ ...base, start: at(17), end: at(19) }))
            .toBe('O horário deve ser entre 08:00 e 18:00.');
    });

    it('recusa quando toda a equipe está ocupada, ignorando cancelados e o próprio agendamento', () => {
        const busy = [booked(at(8), at(10))];
        expect(getAgendamentoSlotError({ ...base, agendamentos: busy, start: at(9), end: at(11) }))
            .toBe('Todos os 1 colaboradores já estão ocupados neste horário.');
        expect(getAgendamentoSlotError({ ...base, agendamentos: busy, capacity: 2, start: at(9), end: at(11) })).toBeNull();
        expect(getAgendamentoSlotError({ ...base, agendamentos: busy, ignoreId: 1, start: at(9), end: at(11) })).toBeNull();
        expect(getAgendamentoSlotError({
            ...base,
            agendamentos: [booked(at(8), at(10), { serviceStatus: 'cancelled' })],
            start: at(9),
            end: at(11),
        })).toBeNull();
    });
});

describe('expediente que passa da meia-noite', () => {
    it('aceita o horário e mostra o fim como meia-noite', () => {
        expect(isWithinWorkingHours('22:00', '23:30', '18:00', '00:00')).toBe(true);
        expect(getWorkingEndLabel('18:00', '00:00')).toBe('00:00 (meia-noite)');
    });
});
