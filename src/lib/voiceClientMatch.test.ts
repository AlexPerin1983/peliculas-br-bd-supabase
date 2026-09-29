import { describe, expect, it } from 'vitest';
import {
    attachCandidates,
    attachExistingClient,
    findClientsBySpokenName,
    isClientAddress,
    pickProposalToLink,
    withLocalNote,
} from './voiceClientMatch';
import { Agendamento, Client, SavedPDF } from '../../types';
import type { VoiceScheduleDraft } from './voiceSchedule';

const client = (id: number, nome: string, extra: Partial<Client> = {}): Client => ({
    id, nome, telefone: '', email: '', cpfCnpj: '', ...extra,
});

const clients = [
    client(1, 'Maria de Souza Lima', { logradouro: 'Rua das Flores', bairro: 'Bessa', lastUpdated: '2026-09-01T00:00:00Z' }),
    client(2, 'Maria Oliveira', { lastUpdated: '2026-09-20T00:00:00Z' }),
    client(3, 'João Pedro', { lastUpdated: '2026-08-01T00:00:00Z' }),
    client(4, 'Dona Lúcia', { lastUpdated: '2026-07-01T00:00:00Z' }),
];

const pdf = (id: number, status: SavedPDF['status'] = 'approved'): SavedPDF => ({
    id, clienteId: 1, date: '2026-09-10', totalPreco: 1250, totalM2: 5, subtotal: 1250,
    generalDiscountAmount: 0, generalDiscount: { value: '', type: 'fixed' }, nomeArquivo: `p${id}.pdf`, status,
} as SavedPDF);

const draft = (overrides: Partial<VoiceScheduleDraft['quickClient']> = {}): VoiceScheduleDraft => ({
    agendamento: { clienteNome: 'Maria Souza', start: '2026-10-02T12:00:00.000Z', end: '2026-10-02T15:00:00.000Z', notes: 'Película G20' },
    quickClient: { nome: 'Maria Souza', local: 'Rua das Flores, 120', ...overrides },
});

describe('findClientsBySpokenName', () => {
    it('acha um só cliente pelo nome completo, sem ligar para acento, "de" ou Sousa/Souza', () => {
        expect(findClientsBySpokenName('Maria Souza', clients).strong?.id).toBe(1);
        expect(findClientsBySpokenName('maria sousa', clients).strong?.id).toBe(1);
        expect(findClientsBySpokenName('Joao Pedro', clients).strong?.id).toBe(3);
    });

    it('com um nome só, ou mais de um parecido, devolve os candidatos (mais recente primeiro)', () => {
        const maria = findClientsBySpokenName('Maria', clients);
        expect(maria.strong).toBeNull();
        expect(maria.candidates.map(item => item.id)).toEqual([2, 1]);

        const lucia = findClientsBySpokenName('Dona Lúcia', clients);
        expect(lucia.strong).toBeNull();
        expect(lucia.candidates.map(item => item.id)).toEqual([4]);
    });

    it('não acha nada quando o nome não existe', () => {
        expect(findClientsBySpokenName('Carlos Mendes', clients)).toEqual({ strong: null, candidates: [] });
        expect(findClientsBySpokenName('', clients)).toEqual({ strong: null, candidates: [] });
    });
});

describe('pickProposalToLink', () => {
    const booked = (pdfIds: number[], serviceStatus?: Agendamento['serviceStatus']): Agendamento => ({
        id: 9, clienteId: 1, clienteNome: 'Maria', start: '', end: '', pdfIds, serviceStatus,
    });

    it('liga a única proposta aprovada que ainda espera agenda', () => {
        expect(pickProposalToLink([pdf(10), pdf(11, 'pending')], [])?.id).toBe(10);
        expect(pickProposalToLink([pdf(10), pdf(11)], [booked([11])])?.id).toBe(10);
        expect(pickProposalToLink([pdf(10)], [booked([10], 'cancelled')])?.id).toBe(10);
    });

    it('com duas esperando ou nenhuma, não escolhe', () => {
        expect(pickProposalToLink([pdf(10), pdf(11)], [])).toBeNull();
        expect(pickProposalToLink([pdf(10)], [booked([10])])).toBeNull();
    });
});

describe('local falado', () => {
    it('reconhece o endereço do cadastro e anota o que for diferente', () => {
        expect(isClientAddress('Rua das Flores, 120', clients[0])).toBe(true);
        expect(isClientAddress('Av. Beira Mar, 900', clients[0])).toBe(false);
        expect(isClientAddress('', clients[0])).toBe(true);
        expect(withLocalNote('Película G20', 'Av. Beira Mar, 900')).toBe('Película G20\nLocal: Av. Beira Mar, 900');
        expect(withLocalNote('', 'Av. Beira Mar')).toBe('Local: Av. Beira Mar');
    });
});

describe('attachExistingClient', () => {
    it('usa o cliente cadastrado, liga a proposta e só anota local diferente', () => {
        const same = attachExistingClient(draft(), clients[0], pdf(10));
        expect(same.agendamento).toMatchObject({ clienteId: 1, clienteNome: 'Maria de Souza Lima', pdfId: 10, pdfIds: [10], notes: 'Película G20' });
        expect(same.quickClient.matchedClientId).toBe(1);

        const other = attachExistingClient(draft({ local: 'Av. Beira Mar, 900' }), clients[0], null);
        expect(other.agendamento).toMatchObject({ pdfIds: [], notes: 'Película G20\nLocal: Av. Beira Mar, 900' });
    });

    it('na tela do cliente não pede o nome e não mostra "achei"', () => {
        const fromScreen = attachExistingClient(
            draft({ nome: '', local: '', reviewHints: ['O nome do cliente não ficou claro.'] }),
            clients[0], null, { fromClientScreen: true },
        );
        expect(fromScreen.quickClient.reviewHints).toBeUndefined();
        expect(fromScreen.quickClient.matchedClientId).toBeUndefined();
    });
});

describe('attachCandidates', () => {
    it('guarda os parecidos e pede para escolher', () => {
        const result = attachCandidates(draft(), [clients[1], clients[0]]);
        expect(result.quickClient.candidateIds).toEqual([2, 1]);
        expect(result.quickClient.reviewHints?.[0]).toBe('Achei mais de um cliente com esse nome. Escolha qual.');
    });
});
