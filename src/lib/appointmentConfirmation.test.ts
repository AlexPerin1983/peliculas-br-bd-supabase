import { describe, expect, it } from 'vitest';
import { buildAppointmentConfirmation, getGreetingName } from './appointmentConfirmation';

// Segunda-feira, 05/10/2026, 14:00 no horário do aparelho.
const now = new Date(2026, 9, 5, 14, 0);
const at = (day: number, hour: number) => new Date(2026, 9, day, hour, 0).toISOString();

describe('confirmação do atendimento pelo WhatsApp', () => {
    it('monta a mensagem com o tipo, o dia e a hora', () => {
        expect(buildAppointmentConfirmation({ clienteNome: 'Juliana Ribeiro', start: at(6, 8), eventType: 'instalacao' }, now))
            .toBe('Olá, Juliana! Confirmando a instalação amanhã, terça (06/10), às 08:00. Qualquer dúvida, é só chamar.');
        expect(buildAppointmentConfirmation({ clienteNome: 'Maria', start: at(9, 10), eventType: 'consulta' }, now))
            .toBe('Olá, Maria! Confirmando nossa visita na sexta (09/10), às 10:00. Qualquer dúvida, é só chamar.');
        expect(buildAppointmentConfirmation({ clienteNome: 'Pedro', start: at(10, 9) }, now))
            .toBe('Olá, Pedro! Confirmando nosso atendimento no sábado (10/10), às 09:00. Qualquer dúvida, é só chamar.');
        expect(buildAppointmentConfirmation({ clienteNome: 'Pedro', start: at(5, 16), eventType: 'variado' }, now))
            .toBe('Olá, Pedro! Confirmando nosso atendimento hoje (05/10), às 16:00. Qualquer dúvida, é só chamar.');
    });

    it('não oferece mensagem para o que já começou, foi cancelado ou concluído', () => {
        expect(buildAppointmentConfirmation({ clienteNome: 'Ana', start: at(5, 9) }, now)).toBeUndefined();
        expect(buildAppointmentConfirmation({ clienteNome: 'Ana', start: at(6, 9), serviceStatus: 'cancelled' }, now)).toBeUndefined();
        expect(buildAppointmentConfirmation({ clienteNome: 'Ana', start: at(6, 9), serviceStatus: 'completed' }, now)).toBeUndefined();
    });

    it('chama pelo primeiro nome, com tratamento ou pelo nome da empresa', () => {
        expect(getGreetingName('Juliana Ribeiro')).toBe('Juliana');
        expect(getGreetingName('Dona Lúcia Alves')).toBe('Dona Lúcia');
        expect(getGreetingName('Condomínio Mirante do Mar')).toBe('Condomínio Mirante do Mar');
        expect(getGreetingName('Clinica Sorriso')).toBe('Clinica Sorriso');
        expect(getGreetingName('  ')).toBe('');
        expect(buildAppointmentConfirmation({ clienteNome: '', start: at(6, 8) }, now)).toMatch(/^Olá! Confirmando/);
    });
});
