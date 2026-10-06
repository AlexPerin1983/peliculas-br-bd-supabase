import { Agendamento } from '../../types';

// Mensagem pronta para confirmar o atendimento com o cliente pelo WhatsApp:
// "Olá, Juliana! Confirmando a instalação amanhã, terça (06/10), às 08:00. Qualquer dúvida, é só chamar."

const plain = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.$/, '');

const TREATMENTS = new Set(['dona', 'dra', 'dr', 'sr', 'sra', 'srta', 'seu']);

// Nome que começa assim é de empresa ou lugar: vai inteiro na saudação.
const BUSINESS_WORDS = new Set([
    'academia', 'associacao', 'auto', 'clinica', 'colegio', 'condominio', 'construtora', 'consultorio',
    'distribuidora', 'edificio', 'empresa', 'escola', 'escritorio', 'estudio', 'farmacia', 'grupo',
    'hospital', 'hotel', 'igreja', 'imobiliaria', 'instituto', 'laboratorio', 'loja', 'mercado',
    'oficina', 'padaria', 'pousada', 'residencial', 'restaurante', 'salao', 'studio', 'supermercado',
]);

// Como chamar o cliente: o primeiro nome ("Juliana"), com o tratamento ("Dona Lúcia")
// ou o nome inteiro quando é empresa ("Condomínio Mirante do Mar").
export const getGreetingName = (nome: string) => {
    const words = nome.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    const first = plain(words[0]);
    if (BUSINESS_WORDS.has(first)) return words.join(' ');
    if (TREATMENTS.has(first) && words.length > 1) return `${words[0]} ${words[1]}`;
    return words[0];
};

const SERVICE_BY_TYPE: Record<string, string> = {
    consulta: 'nossa visita',
    instalacao: 'a instalação',
};

const pad = (value: number) => String(value).padStart(2, '0');

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// "hoje (05/10)", "amanhã, terça (06/10)", "na sexta (16/10)", "no sábado (17/10)".
const describeDay = (start: Date, now: Date) => {
    const date = `${pad(start.getDate())}/${pad(start.getMonth() + 1)}`;
    const days = Math.round((startOfDay(start) - startOfDay(now)) / 86_400_000);
    const weekday = start.toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '');
    if (days === 0) return `hoje (${date})`;
    if (days === 1) return `amanhã, ${weekday} (${date})`;
    const isWeekend = start.getDay() === 0 || start.getDay() === 6;
    return `${isWeekend ? 'no' : 'na'} ${weekday} (${date})`;
};

// Só para atendimento agendado que ainda vai começar; depois disso não há o que confirmar.
export const buildAppointmentConfirmation = (
    agendamento: Pick<Agendamento, 'clienteNome' | 'start' | 'eventType' | 'serviceStatus'>,
    now: Date = new Date(),
): string | undefined => {
    const start = new Date(agendamento.start);
    if ((agendamento.serviceStatus || 'scheduled') !== 'scheduled' || start.getTime() <= now.getTime()) return undefined;

    const name = getGreetingName(agendamento.clienteNome || '');
    const service = SERVICE_BY_TYPE[agendamento.eventType || ''] || 'nosso atendimento';
    const time = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
    return `${name ? `Olá, ${name}!` : 'Olá!'} Confirmando ${service} ${describeDay(start, now)}, às ${time}. Qualquer dúvida, é só chamar.`;
};
