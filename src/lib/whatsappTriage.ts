// Triagem do WhatsApp conectado: textos e regras da tela onde a empresa aprova o que a
// IA do painel local separou nas conversas (cliente novo, fornecedor, amigos e família...).

export const TRIAGE_CATEGORIES = ['novo_cliente', 'agendar', 'orcamento', 'pos_venda', 'fornecedor', 'pessoal', 'nao_cliente'] as const;
export type TriageCategory = typeof TRIAGE_CATEGORIES[number];
export type TriageKind = 'client' | 'supplier' | 'ignore';

export const TRIAGE_LABELS: Record<TriageCategory, string> = {
    novo_cliente: 'Cliente novo',
    agendar: 'Quer agendar',
    orcamento: 'Fala do orçamento',
    pos_venda: 'Pós-venda',
    fornecedor: 'Fornecedor',
    pessoal: 'Amigos e família',
    nao_cliente: 'Não é cliente',
};

const SOURCE_LABELS: Record<string, string> = { jev: 'Jev', gemini: 'Gemini', claude: 'Claude', regra: 'regra do PIX', regras: 'regras', voce: 'você' };

/** O que aprovar faz com o contato: salva como cliente, em Fornecedores ou só registra. */
export const triageKind = (category: TriageCategory): TriageKind =>
    category === 'fornecedor' ? 'supplier' : category === 'pessoal' || category === 'nao_cliente' ? 'ignore' : 'client';

export const approveLabel = (category: TriageCategory): string => {
    const kind = triageKind(category);
    if (kind === 'client') return 'Salvar como cliente';
    if (kind === 'supplier') return 'Salvar em Fornecedores';
    return category === 'pessoal' ? 'Confirmar: amigos e família' : 'Confirmar: não é cliente';
};

/** "Cliente novo · 92% · Jev" — a chance de acerto e quem decidiu. */
export const suggestionSummary = (category: TriageCategory, confidence: number | null, source: string | null): string =>
    [TRIAGE_LABELS[category] || 'Contato',
        typeof confidence === 'number' ? `${Math.round(confidence * 100)}%` : '',
        source ? SOURCE_LABELS[source] || source : '']
        .filter(Boolean).join(' · ');

/** Resumo da linha em "Ações do dia": "3 clientes novos · 1 fornecedor · 2 outros". */
export const pendingSummary = (categories: TriageCategory[]): string => {
    const counts = { client: 0, supplier: 0, ignore: 0 };
    categories.forEach(category => { counts[triageKind(category)] += 1; });
    return [
        counts.client ? `${counts.client} ${counts.client === 1 ? 'possível cliente' : 'possíveis clientes'}` : '',
        counts.supplier ? `${counts.supplier} ${counts.supplier === 1 ? 'fornecedor' : 'fornecedores'}` : '',
        counts.ignore ? `${counts.ignore} ${counts.ignore === 1 ? 'outro' : 'outros'}` : '',
    ].filter(Boolean).join(' · ');
};

/** Telefone salvo só com dígitos (5583999998888) no formato que a empresa lê. */
export const formatTriagePhone = (phone: string | null): string => {
    if (!phone) return 'Número oculto pelo WhatsApp';
    const br = phone.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
    return br ? `(${br[1]}) ${br[2]}-${br[3]}` : `+${phone}`;
};

export type TriageDoneStatus = 'approved' | 'auto_approved' | 'discarded';
/** Como ficou um contato já revisado. */
export const doneLabel = (status: TriageDoneStatus, category: TriageCategory): string => {
    if (status === 'discarded') return 'Descartado';
    const kind = triageKind(category);
    const what = kind === 'client' ? 'Salvo como cliente' : kind === 'supplier' ? 'Salvo em Fornecedores' : TRIAGE_LABELS[category];
    return status === 'auto_approved' ? `${what} (pelo painel, sozinho)` : what;
};
