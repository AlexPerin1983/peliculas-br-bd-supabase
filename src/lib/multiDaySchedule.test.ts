import { describe, expect, it } from 'vitest';
import { buildContinuationNote, buildMultiDayAgendamentos, formatDayLabel, moveToDay, nextDayKey, normalizeExtraDays, splitContinuationNote, toDayKey } from './multiDaySchedule';

// Sexta, 02/10/2026, das 8h às 17h no horário do aparelho.
const first = {
    clienteId: 7,
    clienteNome: 'Amaury',
    start: new Date(2026, 9, 2, 8, 0).toISOString(),
    end: new Date(2026, 9, 2, 17, 0).toISOString(),
    notes: 'Película G20',
    pdfId: 50,
    pdfIds: [50],
    serviceStatus: 'scheduled' as const,
};

const localTime = (iso: string) => {
    const date = new Date(iso);
    return `${toDayKey(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

describe('multiDaySchedule', () => {
    it('monta um agendamento por dia, com os seguintes como continuação', () => {
        const days = buildMultiDayAgendamentos(first, ['2026-10-03']);

        expect(days).toHaveLength(2);
        expect(days[0]).toBe(first);
        expect(localTime(days[1].start)).toBe('2026-10-03 08:00');
        expect(localTime(days[1].end)).toBe('2026-10-03 17:00');
        expect(days[1]).toMatchObject({
            clienteId: 7,
            clienteNome: 'Amaury',
            pdfIds: [],
            stockSourcePdfIds: [50],
            serviceStatus: 'scheduled',
            notes: 'Continuação do atendimento de 02/10.\n\nPelícula G20',
        });
        expect(days[1].pdfId).toBeUndefined();
    });

    it('os dias seguintes herdam tipo, título e cor', () => {
        const days = buildMultiDayAgendamentos({ ...first, eventType: 'instalacao' as const, title: 'Fachada', color: '#db2777' }, ['2026-10-03']);
        expect(days[1]).toMatchObject({ eventType: 'instalacao', title: 'Fachada', color: '#db2777' });
    });

    it('ignora dia repetido, o próprio dia e datas inválidas, e ordena', () => {
        expect(normalizeExtraDays('2026-10-02', ['2026-10-05', '2026-10-02', 'x', '2026-10-03', '2026-10-05']))
            .toEqual(['2026-10-03', '2026-10-05']);
        expect(buildMultiDayAgendamentos(first, [])).toEqual([first]);
    });

    it('ajuda a montar os dias na tela', () => {
        expect(nextDayKey('2026-10-31')).toBe('2026-11-01');
        expect(formatDayLabel('2026-10-03')).toMatch(/^sáb.*03\/10$/);
        expect(localTime(moveToDay(first.start, '2026-10-05'))).toBe('2026-10-05 08:00');
    });

    it('separa o aviso de continuação das observações', () => {
        const [, secondDay] = buildMultiDayAgendamentos(first, ['2026-10-03']);
        expect(buildContinuationNote(first.start)).toBe('Continuação do atendimento de 02/10.');
        expect(splitContinuationNote(secondDay.notes)).toEqual({ originDate: '02/10', notes: 'Película G20' });
        // Continuação de uma continuação: vale a data mais recente.
        expect(splitContinuationNote('Continuação do atendimento de 03/10.\n\nContinuação do atendimento de 02/10.'))
            .toEqual({ originDate: '03/10', notes: '' });
        expect(splitContinuationNote('Levar escada')).toEqual({ originDate: undefined, notes: 'Levar escada' });
        expect(splitContinuationNote(undefined)).toEqual({ originDate: undefined, notes: '' });
    });
});
