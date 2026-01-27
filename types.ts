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
    locationId?: number;
    locationName?: string;
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
        provider: 'gemini' | 'openai' | 'local_ocr';
        apiKey: string;
    };
    lastSelectedClientId?: number | null; // Novo campo
    socialLinks?: {
        facebook?: string;
        instagram?: string;
        tiktok?: string;
        youtube?: string;
        googleReviews?: string;
    };
    organizationId?: string;
    isOwner?: boolean;
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

export interface Totals {
    totalM2: number;
    subtotal: number;
    totalItemDiscount: number;
    generalDiscountAmount: number;
    finalTotal: number;
    totalQuantity: number;
    priceAfterItemDiscounts: number;
    totalLinearMeters: number;
    linearMeterCost: number;
    totalMaterial: number;
    totalLabor: number;
    groupedTotals?: {
        [filmName: string]: {
            filmName: string;
            totalM2: number;
            totalLinearMeters: number;
            totalMaterial: number;
            totalLabor: number;
            totalLinearMeterCost: number;
            unitPriceMaterial: number;
            unitPriceLabor: number;
            unitPriceLinearMeter: number;
        };
    };
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
    pdfBlob?: Blob;
    nomeArquivo: string;
    measurements?: Measurement[];
    status?: 'pending' | 'approved' | 'revised';
    agendamentoId?: number;
    proposalOptionName?: string;
    proposalOptionId?: number; // ID da opção de proposta para navegação
    totalLinearMeters?: number;
    linearMeterCost?: number;
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

export interface Profile {
    id: string;
    email: string;
    role: 'admin' | 'user';
    approved: boolean;
    created_at: string;
    organization_id?: string;
}

export interface Organization {
    id: string;
    name: string;
    owner_id: string;
    created_at: string;
}

export interface OrganizationMember {
    id: string;
    organization_id: string;
    user_id?: string;
    email: string;
    role: 'owner' | 'admin' | 'member';
    status: 'pending' | 'active' | 'blocked';
    invited_at: string;
    joined_at?: string;
}


// ============================================
// TIPOS PARA CONTROLE DE ESTOQUE
// ============================================

export interface Bobina {
    id?: number;
    filmId: string; // Nome da película
    codigoQr: string; // Código único para QR Code
    larguraCm: number; // Largura da bobina em cm
    comprimentoTotalM: number; // Comprimento total em metros
    comprimentoRestanteM: number; // Comprimento restante em metros
    custoTotal?: number; // Custo total da bobina
    fornecedor?: string;
    lote?: string; // Lote do fabricante
    dataCadastro?: string;
    dataUltimaAtualizacao?: string;
    status: 'ativa' | 'finalizada' | 'descartada';
    localizacao?: string; // Onde está armazenada
    observacao?: string;
}

export interface Retalho {
    id?: number;
    bobinaId?: number; // Pode ser null se retalho avulso
    filmId: string; // Nome da película
    codigoQr: string; // Código único para QR Code
    larguraCm: number; // Largura em cm
    comprimentoCm: number; // Comprimento em cm
    areaM2?: number; // Área calculada automaticamente
    dataCadastro?: string;
    dataUtilizacao?: string;
    status: 'disponivel' | 'reservado' | 'usado' | 'descartado';
    localizacao?: string; // Onde está armazenado
    observacao?: string;
}

export interface Consumo {
    id?: number;
    bobinaId?: number;
    retalhoId?: number;
    clientId?: number;
    clientName?: string;
    pdfId?: number;
    metrosConsumidos: number;
    larguraCorteCm?: number;
    comprimentoCorteCm?: number;
    areaM2?: number;
    dataConsumo?: string;
    tipo: 'corte' | 'perda' | 'amostra' | 'descarte';
    observacao?: string;
}

export type BobinaStatus = 'ativa' | 'finalizada' | 'descartada';
export type RetalhoStatus = 'disponivel' | 'reservado' | 'usado' | 'descartado';
export type ConsumoTipo = 'corte' | 'perda' | 'amostra' | 'descarte';

// ============================================
// TIPOS PARA LOCAIS E MEDIDAS PADRÃO
// ============================================

export interface LocationMeasurement {
    id?: number;
    location_id: number;
    name: string;
    largura: string;
    altura: string;
    quantidade: number;
    ambiente: string;
    tipo_aplicacao: string;
    observacao?: string;
    created_at?: string;
    created_by_user_id?: string;
    created_by_company_name?: string;
}

export interface Location {
    id?: number;
    name: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    type: 'condominium' | 'company' | 'other';
    user_id?: string;
    created_at?: string;
    created_by_company_name?: string;
    observacao?: string; // Observações públicas para outros aplicadores
    measurements?: LocationMeasurement[];
}

