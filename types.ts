export interface Client {
    id?: number;
    nome: string;
    telefone: string;
    email: string;
    cpfCnpj: string;
    // Endereço foi reestruturado
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    lastUpdated?: string; // Novo campo para rastrear a última modificação
    pinned?: boolean; // Fixar cliente no topo da lista
    pinnedAt?: number; // Timestamp de quando foi fixado
}

export interface Measurement {
    id: number;
    largura: string;
    altura: string;
    quantidade: number;
    ambiente: string;
    tipoAplicacao: string;
    pelicula: string;
    active: boolean;
    discount?: {
        value: string;
        type: 'percentage' | 'fixed';
    };
    observation?: string;
    locked?: boolean;
}

export interface UIMeasurement extends Measurement {
    isNew?: boolean;
}

export interface ProposalOption {
    id: number;
    name: string;
    measurements: Measurement[];
    generalDiscount: {
        value: string;
        type: 'percentage' | 'fixed';
    };
}

export interface Film {
    nome: string;
    preco: number;
    precoMetroLinear?: number; // Preço por metro linear
    maoDeObra?: number; // NOVO CAMPO: Valor fixo de mão de obra por m²
    garantiaFabricante?: number;
    garantiaMaoDeObra?: number;
    uv?: number;
    ir?: number;
    vtl?: number;
    espessura?: number;
    tser?: number;
    imagens?: string[]; // Alterado para array de strings (Base64)
    pinned?: boolean; // Fixar película no topo da lista
    pinnedAt?: number; // Timestamp de quando foi fixado
    customFields?: { [key: string]: string }; // Campos técnicos personalizados
}

export type PaymentMethodType = 'pix' | 'boleto' | 'parcelado_sem_juros' | 'parcelado_com_juros' | 'adiantamento' | 'observacao';

export interface PaymentMethod {
    tipo: PaymentMethodType;
    ativo: boolean;
    parcelas_max?: number | null;
    juros?: number | null;
    porcentagem?: number | null;
    texto?: string;
    chave_pix?: string;
    tipo_chave_pix?: 'cpf' | 'cnpj' | 'telefone' | 'email' | 'aleatoria' | null;
    nome_responsavel_pix?: string;
}

export type PaymentMethods = PaymentMethod[];

export interface Employee {
    id: number;
    nome: string;
}

export interface UserInfo {
    id: 'info';
    nome: string;
    empresa: string;
    telefone: string;
    email: string;
    endereco: string;
    cpfCnpj: string;
    site?: string;
    logo?: string;
    assinatura?: string;
    cores?: {
        primaria: string;
        secundaria: string;
    };
    payment_methods: PaymentMethods;
    proposalValidityDays?: number;
    prazoPagamento?: string;
    workingHours?: {
        start: string; // "HH:MM" format
        end: string;   // "HH:MM" format
        days: number[]; // 0 for Sunday, 1 for Monday, etc.
    };
    employees?: Employee[];
    aiConfig?: {
        provider: 'gemini' | 'openai';
        apiKey: string;
    };
    lastSelectedClientId?: number | null; // Novo campo
}

export interface Agendamento {
    id?: number;
    pdfId?: number;
    clienteId: number;
    clienteNome: string;
    start: string; // ISO string for date and time
    end: string;   // ISO string for date and time
    notes?: string;
}

export interface SavedPDF {
    id?: number;
    clienteId: number;
    clientName?: string;
    date: string;
    expirationDate?: string;
    totalPreco: number; // Final total price
    totalM2: number;
    subtotal?: number;
    generalDiscountAmount?: number;
    generalDiscount?: {
        value: number | string;
        type: 'percentage' | 'fixed' | 'none';
    };
    pdfBlob: Blob;
    nomeArquivo: string;
    measurements?: Measurement[];
    status?: 'pending' | 'approved' | 'revised';
    agendamentoId?: number;
    proposalOptionName?: string;
    proposalOptionId?: number; // ID da opção de proposta para navegação
}
export type SchedulingInfo = {
    pdf: SavedPDF;
    agendamento?: Agendamento;
} | {
    agendamento: Partial<Agendamento>;
    pdf?: SavedPDF;
};

export interface ExtractedClientData {
    nome?: string;
    telefone?: string;
    email?: string;
    cpfCnpj?: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
}
