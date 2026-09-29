import { describe, expect, it } from 'vitest';
import { buildMultiDayAgendamentos, formatDayLabel, moveToDay, nextDayKey, normalizeExtraDays, toDayKey } from './multiDaySchedule';

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
});
