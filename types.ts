export interface Client {
    id?: number;
    nome: string;
    telefone: string;
    email: string;
    cpfCnpj: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
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
}

export interface ProposalOption {
    id: number;
    name: string;
    measurements: Measurement[];
    generalDiscount: { value: string | number; type: 'percentage' | 'fixed' };
}

export interface Film {
    nome: string;
    preco: number;
    maoDeObra: number; // Novo campo
    garantiaFabricante: number;
    garantiaMaoDeObra: number; // Novo campo
    uv: number;
    ir: number;
    vtl: number;
    espessura: number;
    tser: number;
    imagens?: string[];
}

export type PaymentMethodType = 'pix' | 'boleto' | 'parcelado_sem_juros' | 'parcelado_com_juros' | 'adiantamento' | 'observacao';

export interface PaymentMethod {
    tipo: PaymentMethodType;
    ativo: boolean;
    // Pix
    chave_pix?: string;
    tipo_chave_pix?: 'cpf' | 'cnpj' | 'telefone' | 'email' | 'aleatoria';
    nome_responsavel_pix?: string;
    // Parcelado
    parcelas_max?: number | null;
    juros?: number | null;
    // Adiantamento
    porcentagem?: number | null;
    // Observação
    texto?: string;
}

export type PaymentMethods = PaymentMethod[];

export interface Employee {
    id: number;
    nome: string;
}

export type ActiveTab = 'client' | 'films' | 'settings' | 'history' | 'agenda';

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
    activeTab?: ActiveTab; // Aba ativa persistida
}

export interface Agendamento {
    id?: number;
    clienteId: number;
    clienteNome: string;
    start: string; // ISO Date String
    end: string;   // ISO Date String
    notes?: string;
    pdfId?: number | null;
}

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