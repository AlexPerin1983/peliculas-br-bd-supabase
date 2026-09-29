import { Agendamento, Client, SavedPDF } from '../../types';
import type { VoiceScheduleDraft } from './voiceSchedule';

// Agendamento por voz de cliente já cadastrado: o app (não a IA) procura o nome
// falado na lista de clientes e escolhe a proposta que deve ir junto.

const HONORIFICS = new Set(['dona', 'dono', 'seu', 'sr', 'sra', 'senhor', 'senhora', 'dr', 'dra', 'doutor', 'doutora']);
const CONNECTORS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const MAX_CANDIDATES = 3;

const normalize = (value: string) => value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const nameTokens = (value: string) => normalize(value).split(' ').filter(token => token && !CONNECTORS.has(token));

const levenshtein = (a: string, b: string) => {
    const row = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
        let previous = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j += 1) {
            const current = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
            previous = current;
        }
    }
    return row[b.length];
};

// "Sousa" x "Souza", "Luis" x "Luiz": uma letra de diferença em nomes de 4+ letras.
const similarToken = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && levenshtein(a, b) <= 1);

export interface SpokenClientMatch {
    // Um só cliente com o nome falado completo (duas palavras ou mais).
    strong: Client | null;
    // Parecidos para a pessoa escolher quando não dá para ter certeza.
    candidates: Client[];
}

export const findClientsBySpokenName = (spokenName: string, clients: Client[]): SpokenClientMatch => {
    const spoken = nameTokens(spokenName).filter(token => !HONORIFICS.has(token));
    if (!spoken.length) return { strong: null, candidates: [] };

    const matches = clients.filter(client => {
        if (client.id == null) return false;
        const tokens = nameTokens(client.nome || '');
        return spoken.every(word => tokens.some(token => similarToken(word, token)));
    });

    if (matches.length === 1 && spoken.length >= 2) return { strong: matches[0], candidates: [] };

    const candidates = [...matches]
        .sort((a, b) => {
            const exactA = nameTokens(a.nome).length === spoken.length ? 0 : 1;
            const exactB = nameTokens(b.nome).length === spoken.length ? 0 : 1;
            if (exactA !== exactB) return exactA - exactB;
            return new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime();
        })
        .slice(0, MAX_CANDIDATES);
    return { strong: null, candidates };
};

const isActive = (agendamento: Agendamento) => agendamento.serviceStatus !== 'cancelled' && agendamento.serviceStatus !== 'no_show';

// A proposta aprovada que ainda espera agendamento. Com mais de uma, nenhuma:
// a pessoa escolhe na conferência.
export const pickProposalToLink = (clientPdfs: SavedPDF[], agendamentos: Agendamento[]): SavedPDF | null => {
    const taken = new Set<number>();
    agendamentos.filter(isActive).forEach(agendamento => {
        (agendamento.pdfIds?.length ? agendamento.pdfIds : (agendamento.pdfId ? [agendamento.pdfId] : []))
            .forEach(id => taken.add(id));
    });
    const waiting = clientPdfs.filter(pdf => typeof pdf.id === 'number' && pdf.status === 'approved' && !taken.has(pdf.id));
    return waiting.length === 1 ? waiting[0] : null;
};

// O local falado bate com o endereço do cadastro? (rua contida um no outro)
export const isClientAddress = (local: string, client: Client) => {
    const spoken = normalize(local);
    const street = normalize(client.logradouro || '');
    if (!spoken) return true;
    if (!street) return false;
    return spoken.includes(street) || street.includes(spoken);
};

// Local diferente do cadastro vai para a observação deste agendamento, sem mexer no cliente.
export const withLocalNote = (notes: string | undefined, local: string) => {
    const current = (notes || '').trim();
    const line = `Local: ${local.trim()}`;
    if (!local.trim() || current.includes(local.trim())) return current;
    return current ? `${current}\n${line}` : line;
};

export const attachExistingClient = (
    draft: VoiceScheduleDraft,
    client: Client,
    proposal: SavedPDF | null,
    { fromClientScreen = false }: { fromClientScreen?: boolean } = {}
): VoiceScheduleDraft => {
    const local = draft.quickClient.local;
    const notes = isClientAddress(local, client) ? draft.agendamento.notes : withLocalNote(draft.agendamento.notes, local);
    // Na tela do cliente o nome não precisa ser falado.
    const reviewHints = (draft.quickClient.reviewHints || [])
        .filter(hint => !(fromClientScreen && hint === 'O nome do cliente não ficou claro.'));

    return {
        agendamento: {
            ...draft.agendamento,
            clienteId: client.id,
            clienteNome: client.nome,
            notes,
            pdfId: proposal?.id,
            pdfIds: proposal?.id != null ? [proposal.id] : [],
        },
        quickClient: {
            ...draft.quickClient,
            // Achado pelo nome falado: a conferência mostra de onde veio e deixa desfazer.
            matchedClientId: fromClientScreen ? undefined : client.id,
            reviewHints: reviewHints.length ? reviewHints : undefined,
        },
    };
};

export const attachCandidates = (draft: VoiceScheduleDraft, candidates: Client[]): VoiceScheduleDraft => ({
    ...draft,
    quickClient: {
        ...draft.quickClient,
        candidateIds: candidates.map(client => client.id!),
        reviewHints: [
            candidates.length > 1 ? 'Achei mais de um cliente com esse nome. Escolha qual.' : 'Achei um cliente parecido. Confira se é ele.',
            ...(draft.quickClient.reviewHints || []),
        ],
    },
});
