import { Agendamento, UserInfo } from '../../types';

// Regras de horário da agenda, usadas pela conferência e pelo salvamento direto por voz.

const timeToMinutes = (value: string): number => {
    const [hours = '0', minutes = '0'] = value.split(':');
    return Number(hours) * 60 + Number(minutes);
};

const toTimeValue = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

export const isWithinWorkingHours = (
    startTime: string,
    endTime: string,
    scheduleStart: string,
    scheduleEnd: string
): boolean => {
    const appointmentStart = timeToMinutes(startTime);
    const appointmentEnd = timeToMinutes(endTime);
    const workingStart = timeToMinutes(scheduleStart);
    let workingEnd = timeToMinutes(scheduleEnd);

    if (workingEnd <= workingStart) {
        workingEnd += 24 * 60;
    }

    return appointmentStart >= workingStart && appointmentEnd <= workingEnd;
};

export const getWorkingEndLabel = (scheduleStart: string, scheduleEnd: string): string => {
    if (timeToMinutes(scheduleEnd) <= timeToMinutes(scheduleStart)) {
        return `${scheduleEnd} (meia-noite)`;
    }

    return scheduleEnd;
};

// Motivo para não agendar neste horário, ou null quando está livre.
export const getAgendamentoSlotError = ({
    start,
    end,
    workingHours,
    agendamentos,
    capacity,
    ignoreId,
}: {
    start: Date;
    end: Date;
    workingHours?: UserInfo['workingHours'];
    agendamentos: Agendamento[];
    // Colaboradores ativos da organização (mínimo 1 = o dono).
    capacity: number;
    // Agendamento em edição, que não conflita com ele mesmo.
    ignoreId?: number;
}): string | null => {
    if (!workingHours) {
        return 'Configure o horário de funcionamento da empresa nas Configurações para agendar.';
    }

    if (start >= end) {
        return 'O horário de término deve ser posterior ao de início.';
    }

    if (!workingHours.days.includes(start.getDay())) {
        return 'A data selecionada não é um dia de trabalho.';
    }

    if (!isWithinWorkingHours(toTimeValue(start), toTimeValue(end), workingHours.start, workingHours.end)) {
        return `O horário deve ser entre ${workingHours.start} e ${getWorkingEndLabel(workingHours.start, workingHours.end)}.`;
    }

    const conflictingAppointments = agendamentos.filter(ag => {
        if (ignoreId !== undefined && ag.id === ignoreId) return false;
        // Cancelados / não comparecidos não ocupam colaborador, então liberam o horário.
        if (ag.serviceStatus === 'cancelled' || ag.serviceStatus === 'no_show') return false;
        return start < new Date(ag.end) && end > new Date(ag.start);
    });

    if (conflictingAppointments.length >= capacity) {
        return `Todos os ${capacity} colaboradores já estão ocupados neste horário.`;
    }

    return null;
};
