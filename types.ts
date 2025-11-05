export interface Client {
    id?: number;
    nome: string;
    telefone?: string;
    email?: string;
    cpfCnpj: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    lastUpdated?: string;
}

export interface Measurement {
    id: number;
    largura: string | number;
    altura: string | number;
    quantidade: number;
    ambiente: string;
    tipoAplicacao: string;
    pelicula: string;
    active: boolean;
    discount: number;
    discountType: 'percentage' | 'fixed';
    preco: number; // Preço unitário no momento do cálculo
}

export interface Film {
    nome: string;
    preco: number;
    maoDeObra: number;
    garantiaFabricante?: number;
    garantiaMaoDeObra?: number;
    uv?: number;
    ir?: number;
    vtl?: number;
    espessura?: number;
    tser?: number;
    imagens?: string[];
}

export interface UserInfo {
    id: string;
    nome: string;
    empresa: string;
    telefone: string;
    email: string;
    endereco: string;
    cpfCnpj: string;
    logo?: string;
    assinatura?: string;
    cores?: { primaria: string; secundaria: string };
    payment_methods?: PaymentMethods;
    prazoPagamento?: string;
    proposalValidityDays?: number;
    workingHours?: { start: string; end: string; days: number[] };
    employees?: { id: number; nome: string }[];
    aiConfig?: { provider: 'gemini' | 'openai'; apiKey: string };
    lastSelectedClientId: number | null;
    activeTab: ActiveTab;
}

export type PaymentMethod = {
    tipo: 'pix' | 'boleto' | 'parcelado_sem_juros' | 'parcelado_com_juros' | 'adiantamento' | 'observacao';
    ativo: boolean;
} & Partial<{
    chave_pix: string;
    tipo_chave_pix: 'cpf' | 'cnpj' | 'telefone' | 'email' | 'aleatoria';
    nome_responsavel_pix: string;
    parcelas_max: number | null;
    juros: number | null;
    porcentagem: number | null;
    texto: string;
}>;

export type PaymentMethods = PaymentMethod[];

export interface SavedPDF {
    id?: number;
    clienteId: number;
    date: string;
    nomeArquivo: string;
    totalM2: number;
    totalPreco: number;
    pdfBlob: Blob;
    status?: 'pending' | 'approved' | 'revised';
    expirationDate?: string;
    proposalOptionName?: string;
}

export interface Agendamento {
    id?: number;
    clienteId: number;
    clienteNome: string;
    start: string;
    end: string;
    notes?: string;
    pdfId?: number;
}

export interface Discount {
    value: string | number;
    type: 'percentage' | 'fixed';
}

export interface ProposalOption {
    id: number;
    name: string;
    measurements: Measurement[];
    generalDiscount: Discount;
}

export type ActiveTab = 'client' | 'films' | 'settings' | 'history' | 'agenda';

export type SchedulingInfo = {
    agendamento: Agendamento;
    pdf?: SavedPDF;
} | {
    pdf: SavedPDF;
    agendamento?: Agendamento;
};