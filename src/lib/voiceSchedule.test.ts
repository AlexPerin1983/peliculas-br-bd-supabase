import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildQuickClientRecord,
    buildScheduleExtractionPrompt,
    buildVoiceScheduleDraft,
    canUndoVoiceSchedule,
    describeVoiceSchedule,
    extractScheduleWithGemini,
    getFriendlyScheduleError,
    normalizeDateKey,
    normalizeTime,
    parseScheduleExtraction,
    readScheduleAutoSave,
    undoVoiceScheduleSave,
    VoiceScheduleError,
    writeScheduleAutoSave,
} from './voiceSchedule';
import { GeminiGatewayError } from '../../services/geminiGateway';
import { SavedPDF } from '../../types';

const gatewayMocks = vi.hoisted(() => ({
    createGeminiModel: vi.fn(),
    generateContent: vi.fn(),
}));

vi.mock('../../services/geminiGateway', async () => {
    const actual = await vi.importActual<typeof import('../../services/geminiGateway')>('../../services/geminiGateway');
    return { ...actual, createGeminiModel: gatewayMocks.createGeminiModel };
});

// Segunda-feira, 28/09/2026, 14:35 no horário do aparelho.
const now = new Date(2026, 8, 28, 14, 35);

const localParts = (iso?: string) => {
    const date = new Date(iso!);
    return {
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
    };
};

describe('normalizeTime', () => {
    it.each([
        ['09:00', '09:00'],
        ['9:30', '09:30'],
        ['9h', '09:00'],
        ['14h30', '14:30'],
        ['14', '14:00'],
        ['08:15:00', '08:15'],
    ])('entende "%s" como %s', (input, expected) => {
        expect(normalizeTime(input)).toBe(expected);
    });

    it.each(['', '25:00', '9:75', 'nove horas'])('recusa "%s"', input => {
        expect(normalizeTime(input)).toBeNull();
    });
});

describe('normalizeDateKey', () => {
    it('aceita só datas reais no formato AAAA-MM-DD', () => {
        expect(normalizeDateKey('2026-10-02')).toBe('2026-10-02');
        expect(normalizeDateKey('2026-02-30')).toBeNull();
        expect(normalizeDateKey('02/10/2026')).toBeNull();
        expect(normalizeDateKey('')).toBeNull();
    });
});

describe('buildScheduleExtractionPrompt', () => {
    it('informa o momento atual e a tabela dos próximos dias', () => {
        const prompt = buildScheduleExtractionPrompt(now);
        expect(prompt).toContain('Agora: segunda-feira, 28/09/2026, 14:35.');
        expect(prompt).toContain('- segunda-feira, 28/09/2026 = 2026-09-28 (hoje)');
        expect(prompt).toContain('- terça-feira, 29/09/2026 = 2026-09-29 (amanhã)');
        expect(prompt).toContain('- sexta-feira, 02/10/2026 = 2026-10-02');
        expect(prompt).toContain('"sexta e sábado" = dois dias');
    });
});

describe('buildVoiceScheduleDraft', () => {
    it('monta o agendamento com nome, local, dia e hora ditos', () => {
        const draft = buildVoiceScheduleDraft({
            clienteNome: 'Maria Souza',
            local: 'Rua das Flores, 120, Centro, João Pessoa - PB',
            logradouro: 'Rua das Flores',
            numero: '120',
            bairro: 'Centro',
            cidade: 'João Pessoa',
            uf: 'pb',
            data: '2026-10-02',
            horaInicio: '09:00',
            horaFim: '12:00',
            observacoes: 'Instalação de película G20 em 3 janelas',
        }, now);

        expect(localParts(draft.agendamento.start)).toEqual({ date: '2026-10-02', time: '09:00' });
        expect(localParts(draft.agendamento.end)).toEqual({ date: '2026-10-02', time: '12:00' });
        expect(draft.agendamento.clienteNome).toBe('Maria Souza');
        expect(draft.agendamento.notes).toBe('Instalação de película G20 em 3 janelas');
        expect(draft.quickClient).toEqual({
            nome: 'Maria Souza',
            local: 'Rua das Flores, 120, Centro, João Pessoa - PB',
            endereco: { logradouro: 'Rua das Flores', numero: '120', bairro: 'Centro', cidade: 'João Pessoa', uf: 'PB' },
        });
    });

    it('com vários dias ("sexta e sábado"), o primeiro vira o agendamento e os outros ficam como extras', () => {
        const draft = buildVoiceScheduleDraft({
            clienteNome: 'Amaury', local: 'Bessa', datas: ['2026-10-03', '2026-10-02', '2026-10-03', 'amanhã'],
            horaInicio: '08:00', horaFim: '17:00',
        }, now);

        expect(localParts(draft.agendamento.start)).toEqual({ date: '2026-10-02', time: '08:00' });
        expect(draft.extraDays).toEqual(['2026-10-03']);
        expect(buildVoiceScheduleDraft({ clienteNome: 'Ana', datas: ['2026-10-02'], horaInicio: '9h' }, now).extraDays).toEqual([]);
    });

    it('usa o tipo dito no áudio e, sem ele, Instalação', () => {
        expect(buildVoiceScheduleDraft({ clienteNome: 'Ana', datas: ['2026-10-02'], horaInicio: '10:00', tipo: 'consulta' }, now).agendamento.eventType).toBe('consulta');
        expect(buildVoiceScheduleDraft({ clienteNome: 'Ana', datas: ['2026-10-02'], horaInicio: '10:00', tipo: '' }, now).agendamento.eventType).toBe('instalacao');
    });

    it('o que será feito vira o título, sem repetir nas observações', () => {
        const draft = buildVoiceScheduleDraft({
            clienteNome: 'Maria', local: 'Bessa', datas: ['2026-10-02'], horaInicio: '10:00', tipo: 'consulta',
            titulo: ' Medir a fachada ', observacoes: 'medir a fachada',
        }, now);
        expect(draft.agendamento.title).toBe('Medir a fachada');
        expect(draft.agendamento.notes).toBe('');

        const semTitulo = buildVoiceScheduleDraft({ clienteNome: 'Ana', datas: ['2026-10-02'], horaInicio: '10:00', observacoes: 'Levar escada' }, now);
        expect(semTitulo.agendamento).not.toHaveProperty('title');
        expect(semTitulo.agendamento.notes).toBe('Levar escada');
        expect(buildVoiceScheduleDraft({ clienteNome: 'Ana', datas: ['2026-10-02'], horaInicio: '10:00', titulo: 'x'.repeat(200) }, now).agendamento.title).toHaveLength(120);
    });

    it('consulta sem término dura 1 hora', () => {
        const draft = buildVoiceScheduleDraft({ clienteNome: 'Maria', datas: ['2026-10-02'], horaInicio: '10:00', tipo: 'consulta' }, now);
        expect(localParts(draft.agendamento.end).time).toBe('11:00');
        const comFim = buildVoiceScheduleDraft({ clienteNome: 'Maria', datas: ['2026-10-02'], horaInicio: '10:00', horaFim: '12:00', tipo: 'consulta' }, now);
        expect(localParts(comFim.agendamento.end).time).toBe('12:00');
    });

    it('sem término (ou com término antes do início) usa 2 horas', () => {
        const withoutEnd = buildVoiceScheduleDraft({ clienteNome: 'Ana', data: '2026-10-02', horaInicio: '14:00' }, now);
        expect(localParts(withoutEnd.agendamento.end).time).toBe('16:00');

        const endBeforeStart = buildVoiceScheduleDraft({ clienteNome: 'Ana', data: '2026-10-02', horaInicio: '14:00', horaFim: '10:00' }, now);
        expect(localParts(endBeforeStart.agendamento.end).time).toBe('16:00');
    });

    it('sem dia e sem hora deixa amanhã às 9h e pede conferência', () => {
        const draft = buildVoiceScheduleDraft({ clienteNome: 'Ana', local: 'Loja do shopping' }, now);
        expect(localParts(draft.agendamento.start)).toEqual({ date: '2026-09-29', time: '09:00' });
        expect(draft.quickClient.reviewHints).toEqual([
            'O dia não ficou claro. Confira a data.',
            'O horário não ficou claro. Confira o início.',
        ]);
        // Sem logradouro separado, o local fica inteiro no cadastro.
        expect(draft.quickClient.endereco).toBeUndefined();
    });

    it('avisa quando o nome falta, a data já passou ou o horário de hoje já passou', () => {
        expect(buildVoiceScheduleDraft({ data: '2026-09-20', horaInicio: '10:00' }, now).quickClient.reviewHints).toEqual([
            'O nome do cliente não ficou claro.',
            'A data ficou no passado. Confira o dia.',
        ]);
        expect(buildVoiceScheduleDraft({ clienteNome: 'Ana', data: '2026-09-28', horaInicio: '08:00' }, now).quickClient.reviewHints).toEqual([
            'Esse horário de hoje já passou. Confira o início.',
        ]);
        expect(buildVoiceScheduleDraft({ clienteNome: 'Ana', data: '2026-09-28', horaInicio: '16:00' }, now).quickClient.reviewHints).toBeUndefined();
    });

    it('monta o local pelas partes quando a IA não escreve o local inteiro', () => {
        const draft = buildVoiceScheduleDraft({
            clienteNome: 'Ana', logradouro: 'Av. Epitácio Pessoa', numero: '500', bairro: 'Tambaú', cidade: 'João Pessoa', uf: 'PB',
            data: '2026-10-02', horaInicio: '9h',
        }, now);
        expect(draft.quickClient.local).toBe('Av. Epitácio Pessoa, 500, Tambaú, João Pessoa - PB');
    });
});

describe('buildQuickClientRecord', () => {
    const draft = {
        nome: 'Maria Souza',
        local: 'Rua das Flores, 120, Centro',
        endereco: { logradouro: 'Rua das Flores', numero: '120', bairro: 'Centro', cidade: '', uf: '' },
    };

    it('usa o endereço separado pela IA quando o local não mudou', () => {
        const client = buildQuickClientRecord({ nome: ' Maria Souza ', local: 'Rua das Flores, 120, Centro' }, draft);
        expect(client).toMatchObject({
            nome: 'Maria Souza',
            telefone: '',
            logradouro: 'Rua das Flores',
            numero: '120',
            bairro: 'Centro',
        });
    });

    it('guarda o local editado inteiro no logradouro', () => {
        const client = buildQuickClientRecord({ nome: 'Maria Souza', local: 'Condomínio Alphaville, casa 12' }, draft);
        expect(client).toMatchObject({ logradouro: 'Condomínio Alphaville, casa 12', numero: '', bairro: '' });
    });
});

describe('parseScheduleExtraction', () => {
    it('lê o JSON mesmo com texto em volta e ignora campos extras', () => {
        const extraction = parseScheduleExtraction('```json\n{"clienteNome":" Ana ","data":"2026-10-02","extra":1}\n```');
        expect(extraction.clienteNome).toBe('Ana');
        expect(extraction.data).toBe('2026-10-02');
        expect(extraction.datas).toEqual(['2026-10-02']);
        expect(extraction.local).toBe('');
        expect(extraction).not.toHaveProperty('extra');
    });

    it('lê o título', () => {
        expect(parseScheduleExtraction('{"clienteNome":"Maria","titulo":" Medir a fachada "}').titulo).toBe('Medir a fachada');
    });

    it('lê a lista de dias', () => {
        const extraction = parseScheduleExtraction('{"clienteNome":"Amaury","datas":["2026-10-02"," 2026-10-03 ",""]}');
        expect(extraction.datas).toEqual(['2026-10-02', '2026-10-03']);
    });

    it('recusa resposta sem JSON', () => {
        expect(() => parseScheduleExtraction('não entendi')).toThrow(VoiceScheduleError);
    });
});

describe('extractScheduleWithGemini', () => {
    beforeEach(() => {
        gatewayMocks.createGeminiModel.mockReset().mockReturnValue({ generateContent: gatewayMocks.generateContent });
        gatewayMocks.generateContent.mockReset();
    });

    it('pede a extração de agendamento com o momento atual e o texto', async () => {
        gatewayMocks.generateContent.mockResolvedValue({
            response: { text: () => JSON.stringify({ clienteNome: 'Maria', local: 'Rua A', datas: ['2026-10-02'], horaInicio: '09:00' }) },
        });

        const extraction = await extractScheduleWithGemini({ text: 'Maria, Rua A, sexta às 9' }, { apiKey: 'chave', now });

        expect(extraction).toMatchObject({ clienteNome: 'Maria', local: 'Rua A', datas: ['2026-10-02'], horaInicio: '09:00' });
        expect(gatewayMocks.createGeminiModel).toHaveBeenCalledWith(expect.objectContaining({
            apiKey: 'chave',
            feature: 'schedule_extraction',
        }));
        // O título vem junto: o que será feito, em poucas palavras.
        const { generationConfig } = gatewayMocks.createGeminiModel.mock.calls[0][0];
        expect(generationConfig.responseSchema.properties).toHaveProperty('titulo');
        const parts = gatewayMocks.generateContent.mock.calls[0][0];
        expect(parts[0]).toContain('- titulo:');
        expect(parts[0]).toContain('Agora: segunda-feira, 28/09/2026, 14:35.');
        expect(parts[1]).toBe('Maria, Rua A, sexta às 9');
    });

    it('avisa quando não entendeu nome, dia nem hora', async () => {
        gatewayMocks.generateContent.mockResolvedValue({
            response: { text: () => JSON.stringify({ clienteNome: '', local: '', data: '', horaInicio: '' }) },
        });

        await expect(extractScheduleWithGemini({ text: 'oi' }, { now })).rejects.toThrow('Não entendi o agendamento');
    });
});

describe('salvar direto na agenda', () => {
    it('lembra a chave no aparelho', () => {
        writeScheduleAutoSave(true);
        expect(readScheduleAutoSave()).toBe(true);
        writeScheduleAutoSave(false);
        expect(readScheduleAutoSave()).toBe(false);
    });

    it('resume o que foi salvo para o aviso', () => {
        const summary = describeVoiceSchedule(
            'Maria Souza',
            new Date(2026, 9, 2, 9, 0).toISOString(),
            new Date(2026, 9, 2, 12, 0).toISOString(),
        );
        expect(summary).toMatch(/^sex.*02\/10, 09:00–12:00 · Maria Souza$/);

        const twoDays = describeVoiceSchedule(
            'Amaury',
            new Date(2026, 9, 2, 8, 0).toISOString(),
            new Date(2026, 9, 2, 17, 0).toISOString(),
            ['2026-10-03'],
        );
        expect(twoDays).toMatch(/^sex.*02\/10 e sáb.*03\/10, 08:00–17:00 · Amaury$/);

        const withTitle = describeVoiceSchedule(
            'Maria',
            new Date(2026, 9, 2, 10, 0).toISOString(),
            new Date(2026, 9, 2, 11, 0).toISOString(),
            [],
            'Medir a fachada',
        );
        expect(withTitle).toMatch(/^sex.*02\/10, 10:00–11:00 · Maria · Medir a fachada$/);
    });
});

describe('desfazer o que a voz salvou direto', () => {
    const day = (id: number) => ({ id, clienteId: 7, clienteNome: 'Amaury', start: '2026-10-02T11:00:00.000Z', end: '2026-10-02T20:00:00.000Z' });
    const store = () => {
        const calls: string[] = [];
        return {
            calls,
            deleteAgendamento: vi.fn(async (id: number) => { calls.push(`agendamento ${id}`); }),
            updatePDF: vi.fn(async (pdf: { id?: number }) => { calls.push(`proposta ${pdf.id}`); }),
            deleteClient: vi.fn(async (id: number) => { calls.push(`cliente ${id}`); }),
        };
    };

    it('só oferece desfazer com tudo salvo no servidor', () => {
        expect(canUndoVoiceSchedule([day(501), day(502)])).toBe(true);
        expect(canUndoVoiceSchedule([day(501), day(-1712)])).toBe(false);
        expect(canUndoVoiceSchedule([])).toBe(false);
    });

    it('apaga os dias, devolve a proposta como estava e por último o cliente criado pelo áudio', async () => {
        const fake = store();
        const proposta = { id: 50, clienteId: 7, date: '', totalPreco: 0, totalM2: 0, nomeArquivo: 'a.pdf' } as SavedPDF;
        await undoVoiceScheduleSave({ created: [day(501), day(502)], pdfsBeforeLink: [proposta], createdClientId: 7 }, fake);

        expect(fake.calls).toEqual(['agendamento 501', 'agendamento 502', 'proposta 50', 'cliente 7']);
        expect(fake.updatePDF).toHaveBeenCalledWith(proposta);
    });

    it('cliente que já existia não é apagado', async () => {
        const fake = store();
        await undoVoiceScheduleSave({ created: [day(501)], pdfsBeforeLink: [] }, fake);

        expect(fake.calls).toEqual(['agendamento 501']);
        expect(fake.deleteClient).not.toHaveBeenCalled();
    });
});

describe('getFriendlyScheduleError', () => {
    it('traduz os erros da IA para mensagens curtas', () => {
        expect(getFriendlyScheduleError(new GeminiGatewayError('USER_RATE_LIMIT', 'Limite de uso por usuario atingido')))
            .toBe('Muitas tentativas seguidas. Aguarde um minuto e tente de novo.');
        expect(getFriendlyScheduleError(new VoiceScheduleError('Não entendi o agendamento.'))).toBe('Não entendi o agendamento.');
        expect(getFriendlyScheduleError(new TypeError('Failed to fetch'))).toBe('Sem conexão com a IA. Confira a internet e tente de novo.');
        expect(getFriendlyScheduleError(new Error('got status: 500'))).toBe('Não foi possível montar o agendamento. Tente de novo.');
    });
});
