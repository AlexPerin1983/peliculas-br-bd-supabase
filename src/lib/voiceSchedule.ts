import { createGeminiModel, GeminiGatewayError } from '../../services/geminiGateway';
import { AIInput, Agendamento, Client, QuickClientAddress, QuickClientDraft } from '../../types';

// Campos que a IA devolve ao ouvir (ou ler) um pedido de agendamento.
export interface ScheduleExtraction {
    clienteNome?: string;
    local?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    data?: string;
    horaInicio?: string;
    horaFim?: string;
    observacoes?: string;
}

export interface VoiceScheduleDraft {
    agendamento: Partial<Agendamento>;
    quickClient: QuickClientDraft;
}

const DEFAULT_START_TIME = '09:00';
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;
const CALENDAR_DAYS_IN_PROMPT = 21;
const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const pad = (value: number) => String(value).padStart(2, '0');
const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

// Data local (AAAA-MM-DD). toISOString usaria UTC e trocaria o dia à noite.
export const toLocalDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatBrazilianDate = (date: Date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;

export const normalizeDateKey = (value?: string): string | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(value));
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(year, month - 1, day);
    const isRealDate = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    return isRealDate ? match[0] : null;
};

// Aceita "09:00", "9:30", "9h", "14h30" e "14".
export const normalizeTime = (value?: string): string | null => {
    const match = /^(\d{1,2})(?:\s*[:hH.]\s*(\d{2})(?::\d{2})?)?\s*h?$/.exec(clean(value));
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2] || 0);
    if (hours > 23 || minutes > 59) return null;
    return `${pad(hours)}:${pad(minutes)}`;
};

const atTime = (dateKey: string, time: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
};

// Tabela dos próximos dias: a IA só consulta, em vez de fazer conta de calendário.
const buildCalendarLines = (now: Date) => Array.from({ length: CALENDAR_DAYS_IN_PROMPT }, (_, offset) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const label = offset === 0 ? ' (hoje)' : offset === 1 ? ' (amanhã)' : offset === 2 ? ' (depois de amanhã)' : '';
    return `- ${WEEKDAYS[day.getDay()]}, ${formatBrazilianDate(day)} = ${toLocalDateKey(day)}${label}`;
}).join('\n');

export const buildScheduleExtractionPrompt = (now: Date) => `Você anota agendamentos de uma empresa que instala películas em vidros.
Leia o pedido (áudio, texto ou imagem) e extraia UM agendamento.

Agora: ${WEEKDAYS[now.getDay()]}, ${formatBrazilianDate(now)}, ${pad(now.getHours())}:${pad(now.getMinutes())}.
Próximos dias:
${buildCalendarLines(now)}

Responda APENAS com JSON válido com estes campos (use "" quando não for dito):
- clienteNome: nome do cliente como foi dito (ex.: "Maria Souza", "Dona Lúcia", "Loja Bella Moda").
- local: onde será o serviço, completo e bem escrito (rua, número, bairro, cidade, ponto de referência).
- logradouro, numero, bairro, cidade, uf: partes do local quando der para separar. UF só com a sigla de 2 letras.
- data: dia no formato AAAA-MM-DD.
- horaInicio: início no formato HH:MM (24 horas).
- horaFim: término HH:MM, só se foi dito ("das 9 às 11") ou se foi dita a duração ("umas 3 horas" = início + 3 horas).
- observacoes: o que mais ajudar no serviço (tipo de serviço, película, quantidade de vidros), em uma frase curta.

Regras:
1. Use a lista de próximos dias para "hoje", "amanhã", "depois de amanhã" e dias da semana.
2. Dia da semana sem data ("sexta", "na segunda") é a próxima vez que esse dia aparece depois de hoje.
3. "Dia 15" sem mês é o próximo dia 15: este mês se ainda não passou; se já passou, o mês seguinte.
4. Horários: "9h", "nove horas" e "9 da manhã" = 09:00; "2 da tarde" = 14:00; "meio-dia" = 12:00; "9 e meia" = 09:30. Sem manhã, tarde ou noite: de 7 a 11 é manhã e de 1 a 6 é tarde (13:00 a 18:00).
5. Nunca invente nome, local, data ou horário que não foram ditos.`;

// Mesmo formato de schema usado pelas outras extrações (tipos do Gemini em texto).
const SCHEDULE_RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        clienteNome: { type: 'STRING' },
        local: { type: 'STRING' },
        logradouro: { type: 'STRING' },
        numero: { type: 'STRING' },
        bairro: { type: 'STRING' },
        cidade: { type: 'STRING' },
        uf: { type: 'STRING' },
        data: { type: 'STRING' },
        horaInicio: { type: 'STRING' },
        horaFim: { type: 'STRING' },
        observacoes: { type: 'STRING' }
    },
    required: ['clienteNome', 'local', 'data', 'horaInicio']
};

// Mensagens nossas, já prontas para mostrar na tela.
export class VoiceScheduleError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'VoiceScheduleError';
    }
}

export const parseScheduleExtraction = (rawText: string): ScheduleExtraction => {
    const text = clean(rawText);
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    let parsed: unknown = null;
    if (start !== -1 && end > start) {
        try {
            parsed = JSON.parse(text.slice(start, end + 1));
        } catch {
            parsed = null;
        }
    }
    if (!parsed || typeof parsed !== 'object') {
        throw new VoiceScheduleError('A IA não devolveu o agendamento num formato válido. Tente de novo.');
    }

    const source = parsed as Record<string, unknown>;
    const fields: (keyof ScheduleExtraction)[] = [
        'clienteNome', 'local', 'logradouro', 'numero', 'bairro', 'cidade', 'uf',
        'data', 'horaInicio', 'horaFim', 'observacoes'
    ];
    return Object.fromEntries(fields.map(field => [field, clean(source[field])])) as ScheduleExtraction;
};

const blobToInlineData = (blob: Blob): Promise<{ mimeType: string; data: string }> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        const [header, data] = String(reader.result).split(',');
        resolve({ mimeType: header.match(/:(.*?);/)?.[1] || blob.type, data });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

export const extractScheduleWithGemini = async (
    input: AIInput,
    { apiKey, now = new Date() }: { apiKey?: string | null; now?: Date } = {}
): Promise<ScheduleExtraction> => {
    const model = createGeminiModel({
        apiKey,
        feature: 'schedule_extraction',
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: SCHEDULE_RESPONSE_SCHEMA
        }
    });

    const parts: unknown[] = [buildScheduleExtractionPrompt(now)];
    if (input.text?.trim()) parts.push(input.text.trim());
    for (const file of input.images || []) {
        parts.push({ inlineData: await blobToInlineData(file) });
    }
    if (input.audio) {
        parts.push({ inlineData: await blobToInlineData(input.audio) });
    }

    const result = await model.generateContent(parts);
    const extraction = parseScheduleExtraction(result.response.text());
    if (!extraction.clienteNome && !extraction.data && !extraction.horaInicio) {
        throw new VoiceScheduleError('Não entendi o agendamento. Fale o nome do cliente, o local, o dia e a hora.');
    }
    return extraction;
};

export const getFriendlyScheduleError = (error: unknown): string => {
    if (error instanceof VoiceScheduleError) return error.message;
    const code = error instanceof GeminiGatewayError ? error.code : '';
    const message = error instanceof Error ? error.message : String(error || '');
    if (code === 'USER_RATE_LIMIT') return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
    if (code === 'GLOBAL_QUOTA_EXHAUSTED') return 'A IA está sem limite disponível agora. Tente de novo mais tarde.';
    if (code === 'INPUT_TOO_LARGE') return 'O áudio ficou longo demais. Grave só o nome, o local, o dia e a hora.';
    if (code === 'UNAUTHORIZED') return 'Sua sessão expirou. Entre de novo no aplicativo e repita.';
    if (/NETWORK|Failed to fetch|conectar/i.test(`${code} ${message}`)) return 'Sem conexão com a IA. Confira a internet e tente de novo.';
    return 'Não foi possível montar o agendamento. Tente de novo.';
};

const composeLocal = (extraction: ScheduleExtraction) => [
    [extraction.logradouro, extraction.numero].filter(Boolean).join(', '),
    extraction.bairro,
    [extraction.cidade, extraction.uf].filter(Boolean).join(' - ')
].filter(Boolean).join(', ');

export const buildVoiceScheduleDraft = (extraction: ScheduleExtraction, now: Date = new Date()): VoiceScheduleDraft => {
    const nome = clean(extraction.clienteNome);
    const local = clean(extraction.local) || composeLocal(extraction);
    const dateKey = normalizeDateKey(extraction.data);
    const startTime = normalizeTime(extraction.horaInicio);
    const endTime = normalizeTime(extraction.horaFim);

    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const start = atTime(dateKey || toLocalDateKey(tomorrow), startTime || DEFAULT_START_TIME);
    const suggestedEnd = endTime ? atTime(toLocalDateKey(start), endTime) : null;
    const end = suggestedEnd && suggestedEnd > start ? suggestedEnd : new Date(start.getTime() + DEFAULT_DURATION_MS);

    const reviewHints: string[] = [];
    if (!nome) reviewHints.push('O nome do cliente não ficou claro.');
    if (!dateKey) reviewHints.push('O dia não ficou claro. Confira a data.');
    else if (dateKey < toLocalDateKey(now)) reviewHints.push('A data ficou no passado. Confira o dia.');
    if (!startTime) reviewHints.push('O horário não ficou claro. Confira o início.');
    else if (dateKey === toLocalDateKey(now) && start < now) reviewHints.push('Esse horário de hoje já passou. Confira o início.');

    const endereco: QuickClientAddress = {
        logradouro: clean(extraction.logradouro),
        numero: clean(extraction.numero),
        bairro: clean(extraction.bairro),
        cidade: clean(extraction.cidade),
        uf: clean(extraction.uf).slice(0, 2).toUpperCase()
    };

    return {
        agendamento: {
            clienteNome: nome,
            start: start.toISOString(),
            end: end.toISOString(),
            notes: clean(extraction.observacoes)
        },
        quickClient: {
            nome,
            local,
            ...(endereco.logradouro ? { endereco } : {}),
            ...(reviewHints.length ? { reviewHints } : {})
        }
    };
};

// Cadastro mínimo do cliente ditado. As partes do endereço separadas pela IA só
// valem enquanto o local não foi editado na conferência.
export const buildQuickClientRecord = (
    values: { nome: string; local: string },
    draft?: QuickClientDraft
): Omit<Client, 'id'> => {
    const local = values.local.trim();
    const endereco: QuickClientAddress = draft?.endereco && local === draft.local.trim()
        ? draft.endereco
        : { logradouro: local };

    return {
        nome: values.nome.trim(),
        telefone: '',
        email: '',
        cpfCnpj: '',
        cep: '',
        logradouro: endereco.logradouro || '',
        numero: endereco.numero || '',
        complemento: '',
        bairro: endereco.bairro || '',
        cidade: endereco.cidade || '',
        uf: endereco.uf || '',
        lastUpdated: new Date().toISOString()
    };
};
