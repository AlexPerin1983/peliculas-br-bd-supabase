import { Agendamento } from '../../types';

// Atendimento em vários dias (ex.: sexta e sábado). Cada dia vira um agendamento:
// o primeiro leva a proposta; os seguintes são continuação, como o "Continuar"
// da agenda, sem reapontar a proposta (e com ela como origem do material).

const pad = (value: number) => String(value).padStart(2, '0');

export const toDayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const fromDayKey = (key: string) => {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day);
};

export const nextDayKey = (key: string) => {
    const date = fromDayKey(key);
    date.setDate(date.getDate() + 1);
    return toDayKey(date);
};

// "sáb., 03/10"
export const formatDayLabel = (key: string) => fromDayKey(key)
    .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

// Dias extras válidos, sem repetir e sem o dia principal, em ordem.
export const normalizeExtraDays = (mainDay: string, extraDays: string[]) => [...new Set(extraDays)]
    .filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key) && key !== mainDay)
    .sort();

// Mesmo horário, em outro dia (horário local).
export const moveToDay = (iso: string, dayKey: string) => {
    const source = new Date(iso);
    const target = fromDayKey(dayKey);
    target.setHours(source.getHours(), source.getMinutes(), 0, 0);
    return target.toISOString();
};

export const buildMultiDayAgendamentos = <T extends Omit<Agendamento, 'id'>>(first: T, extraDays: string[]): Array<Omit<Agendamento, 'id'>> => {
    const mainDay = toDayKey(new Date(first.start));
    const days = normalizeExtraDays(mainDay, extraDays);
    if (!days.length) return [first];

    const proposalIds = first.pdfIds?.length ? first.pdfIds : (first.pdfId ? [first.pdfId] : []);
    const originDate = new Date(first.start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const continuationNote = `Continuação do atendimento de ${originDate}.`;
    const notes = first.notes?.trim() ? `${continuationNote}\n\n${first.notes.trim()}` : continuationNote;

    return [
        first,
        ...days.map(day => ({
            clienteId: first.clienteId,
            clienteNome: first.clienteNome,
            start: moveToDay(first.start, day),
            end: moveToDay(first.end, day),
            notes,
            pdfIds: [],
            serviceStatus: 'scheduled' as const,
            receiptDescription: first.receiptDescription,
            stockSourcePdfIds: proposalIds.length ? proposalIds : undefined,
            eventType: first.eventType,
            title: first.title,
            color: first.color,
        })),
    ];
};
