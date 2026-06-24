// Supabase Database Service
// Migração do IndexedDB para Supabase
import { supabase } from './supabaseClient';
import { Client, Measurement, UserInfo, Film, SavedPDF, Agendamento, ProposalOption, StandaloneExpense } from '../types';
import { mockUserInfo } from './mockData';
import {
    getCurrentUserId as getSessionUserId,
    getEffectiveOrganizationId,
    getEffectiveOwnerUserId
} from './sessionScope';

// Cache para o ID do usuário para evitar chamadas repetidas ao auth.getUser()

// Helper para obter o user_id atual
const getCurrentUserId = async (): Promise<string | null> => {
    return getSessionUserId();
    // Tenta obter da sessão primeiro (mais rápido)

};

// Helper para obter o ID do dono da organização (para configurações compartilhadas)
export const getOwnerUserId = async (): Promise<string | null> => {
    return getEffectiveOwnerUserId();
    const userId = await getCurrentUserId();
    if (!userId) return null;

    // Buscar o organization_id do usuário atual  
    const orgId = await getEffectiveOrganizationId();
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();

    // Se tem organização, buscar o owner_id
    if (profile?.organization_id) {
        const { data: org } = await supabase
            .from('organizations')
            .select('owner_id')
            .eq('id', profile.organization_id)
            .single();

        if (org?.owner_id) {
            return org.owner_id;
        }
    }

    return userId;
};

// ============================================
// CLIENT FUNCTIONS
// ============================================

export const getAllClients = async (): Promise<Client[]> => {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    // RLS controla acesso por organização - não filtrar por user_id
    const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('pinned', { ascending: false, nullsFirst: false })
        .order('nome', { ascending: true });

    if (error) {
        console.error('Error fetching clients:', error);
        return [];
    }

    // Mapeia os campos do Supabase para o formato do Client
    return (data || []).map(row => ({
        id: row.id,
        nome: row.nome || '',
        telefone: row.telefone || '',
        email: row.email || '',
        cpfCnpj: row.cpf_cnpj || '',
        cep: row.cep || '',
        logradouro: row.logradouro || '',
        numero: row.numero || '',
        complemento: row.complemento || '',
        bairro: row.bairro || '',
        cidade: row.cidade || '',
        uf: row.uf || '',
        lastUpdated: row.last_updated,
        pinned: row.pinned || false,
        pinnedAt: row.pinned_at ? new Date(row.pinned_at).getTime() : undefined
    }));
};

export const saveClient = async (client: Omit<Client, 'id'> | Client): Promise<Client> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const clientData = {
        user_id: userId,
        nome: client.nome,
        telefone: client.telefone,
        email: client.email,
        cpf_cnpj: client.cpfCnpj,
        cep: client.cep || null,
        logradouro: client.logradouro || null,
        numero: client.numero || null,
        complemento: client.complemento || null,
        bairro: client.bairro || null,
        cidade: client.cidade || null,
        uf: client.uf || null,
        last_updated: new Date().toISOString(),
        pinned: client.pinned || false,
        pinned_at: client.pinnedAt ? new Date(client.pinnedAt).toISOString() : null
    };

    if ('id' in client && client.id) {
        // Update existing client
        // RLS controla acesso por organização - não filtrar por user_id
        const { data, error } = await supabase
            .from('clients')
            .update(clientData)
            .eq('id', client.id)
            .select()
            .single();

        if (error) throw error;
        return mapRowToClient(data);
    } else {
        // Insert new client
        const { data, error } = await supabase
            .from('clients')
            .insert(clientData)
            .select()
            .single();

        if (error) throw error;
        return mapRowToClient(data);
    }
};

export const deleteClient = async (id: number): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    // RLS controla acesso por organização - não filtrar por user_id
    const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

const mapRowToClient = (row: any): Client => ({
    id: row.id,
    nome: row.nome || '',
    telefone: row.telefone || '',
    email: row.email || '',
    cpfCnpj: row.cpf_cnpj || '',
    cep: row.cep || '',
    logradouro: row.logradouro || '',
    numero: row.numero || '',
    complemento: row.complemento || '',
    bairro: row.bairro || '',
    cidade: row.cidade || '',
    uf: row.uf || '',
    lastUpdated: row.last_updated,
    pinned: row.pinned || false,
    pinnedAt: row.pinned_at ? new Date(row.pinned_at).getTime() : undefined
});

// ============================================
// PROPOSAL OPTIONS FUNCTIONS
// ============================================

export const getProposalOptions = async (clientId: number): Promise<ProposalOption[]> => {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    // RLS controla acesso por organização
    const { data, error } = await supabase
        .from('proposal_options')
        .select('*')
        .eq('client_id', clientId);

    if (error) {
        console.error('Error fetching proposal options:', error);
        return [];
    }

    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        measurements: row.measurements || [],
        generalDiscount: row.general_discount || { value: '0', type: 'percentage' }
    }));
};

export const saveProposalOptions = async (clientId: number, options: ProposalOption[]): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');
    const orgId = await getEffectiveOrganizationId();

    // Buscar organization_id do usuário para manter consistência
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();


    // Delete existing options for this client (RLS controla acesso por organização)
    // Não filtramos por user_id para permitir colaboradores editar dados do owner
    await supabase
        .from('proposal_options')
        .delete()
        .eq('client_id', clientId);

    // Insert new options
    if (options.length > 0) {
        const optionsData = options.map(opt => ({
            user_id: userId,  // Quem está salvando
            organization_id: orgId,  // Organização para RLS
            client_id: clientId,
            name: opt.name,
            measurements: opt.measurements,
            general_discount: opt.generalDiscount
        }));

        const { error } = await supabase
            .from('proposal_options')
            .insert(optionsData);

        if (error) throw error;
    }

    // Update client's lastUpdated timestamp (sem filtro de user_id)
    await supabase
        .from('clients')
        .update({ last_updated: new Date().toISOString() })
        .eq('id', clientId);
};

export const deleteProposalOptions = async (clientId: number): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    // RLS controla acesso por organização - não filtrar por user_id
    const { error } = await supabase
        .from('proposal_options')
        .delete()
        .eq('client_id', clientId);

    if (error) throw error;
};

// ============================================
// USER INFO FUNCTIONS
// ============================================

export const getUserInfo = async (): Promise<UserInfo> => {
    const userId = await getCurrentUserId();
    if (!userId) return { ...mockUserInfo, isFallback: true };

    // Sempre buscar os dados do OWNER para garantir consistência na empresa
    const targetUserId = await getOwnerUserId();

    if (!targetUserId) return { ...mockUserInfo, isFallback: true };


    // Buscar user_info do owner (ou do próprio usuário se for owner)
    const { data, error } = await supabase
        .from('user_info')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching user info:', error);
        return { ...mockUserInfo, isFallback: true };
    }

    if (!data) {
        // Return mock data if no user info exists
        return { ...mockUserInfo, isFallback: true };
    }

    const userInfo: UserInfo = {
        id: 'info',
        nome: data.nome ?? '',
        empresa: data.empresa ?? '',
        telefone: data.telefone ?? '',
        email: data.email ?? '',
        endereco: data.endereco ?? '',
        cpfCnpj: data.cpf_cnpj ?? '',
        site: data.site ?? '',
        logo: data.logo,
        assinatura: data.assinatura,
        cores: data.cores || mockUserInfo.cores,
        payment_methods: data.payment_methods || mockUserInfo.payment_methods,
        proposalValidityDays: data.proposal_validity_days,
        prazoPagamento: data.prazo_pagamento,
        hideMeasurementsInPdf: data.hide_measurements_in_pdf ?? false,
        termoResponsabilidade: data.termo_responsabilidade ?? undefined,
        incluirTermoResponsabilidadePadrao: data.incluir_termo_responsabilidade_padrao ?? true,
        workingHours: data.working_hours,
        employees: data.employees,
        aiConfig: data.ai_config || mockUserInfo.aiConfig,
        lastSelectedClientId: data.last_selected_client_id,
        socialLinks: data.social_links,
        isFallback: false
    };

    return { ...mockUserInfo, ...userInfo, isFallback: false };
};

export const saveUserInfo = async (userInfo: UserInfo): Promise<UserInfo> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    // Se o usuário faz parte de uma organização, salvar na linha do OWNER
    const targetUserId = await getOwnerUserId() || userId;

    const userInfoData = {
        user_id: targetUserId,
        nome: userInfo.nome,
        empresa: userInfo.empresa,
        telefone: userInfo.telefone,
        email: userInfo.email,
        endereco: userInfo.endereco,
        cpf_cnpj: userInfo.cpfCnpj,
        site: userInfo.site,
        logo: userInfo.logo,
        assinatura: userInfo.assinatura,
        cores: userInfo.cores,
        payment_methods: userInfo.payment_methods,
        proposal_validity_days: userInfo.proposalValidityDays,
        prazo_pagamento: userInfo.prazoPagamento,
        hide_measurements_in_pdf: userInfo.hideMeasurementsInPdf ?? false,
        termo_responsabilidade: userInfo.termoResponsabilidade ?? null,
        incluir_termo_responsabilidade_padrao: userInfo.incluirTermoResponsabilidadePadrao ?? true,
        working_hours: userInfo.workingHours,
        employees: userInfo.employees,
        ai_config: userInfo.aiConfig,
        last_selected_client_id: userInfo.lastSelectedClientId,
        social_links: userInfo.socialLinks
    };

    const { error } = await supabase
        .from('user_info')
        .upsert(userInfoData, { onConflict: 'user_id' })
        .select();

    if (error) throw error;
    return { ...userInfo, isFallback: false };
};

const patchUserInfoFields = async (patch: Record<string, unknown>): Promise<UserInfo | null> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const targetUserId = await getOwnerUserId() || userId;

    const { error } = await supabase
        .from('user_info')
        .upsert({ user_id: targetUserId, ...patch }, { onConflict: 'user_id' });

    if (error) throw error;

    return await getUserInfo();
};

// Atualiza APENAS o campo payment_methods sem sobrescrever outros campos
export const updatePaymentMethodsOnly = async (paymentMethods: any[]): Promise<UserInfo | null> => {
    const userId = await getCurrentUserId();
    return await patchUserInfoFields({ payment_methods: paymentMethods });
    if (!userId) throw new Error('User not authenticated');

    // Se o usuário faz parte de uma organização, atualizar na linha do OWNER
    const targetUserId = await getOwnerUserId() || userId;

    const { error } = await supabase
        .from('user_info')
        .update({ payment_methods: paymentMethods })
        .eq('user_id', targetUserId);

    if (error) throw error;

    // Retornar o userInfo completo atualizado
    return await getUserInfo();
};

export const updateAIConfigOnly = async (aiConfig: UserInfo['aiConfig']): Promise<UserInfo | null> => {
    return await patchUserInfoFields({ ai_config: aiConfig ?? null });
};

export const updateLastSelectedClientIdOnly = async (lastSelectedClientId: UserInfo['lastSelectedClientId']): Promise<UserInfo | null> => {
    return await patchUserInfoFields({ last_selected_client_id: lastSelectedClientId ?? null });
};

// ============================================
// CUSTOM FILM FUNCTIONS
// ============================================

export const getAllCustomFilms = async (): Promise<Film[]> => {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    // RLS controla acesso por organização
    const { data, error } = await supabase
        .from('films')
        .select('*')
        .order('pinned', { ascending: false, nullsFirst: false })
        .order('nome', { ascending: true });

    if (error) {
        console.error('Error fetching films:', error);
        return [];
    }

    return (data || []).map(row => ({
        nome: row.nome,
        preco: row.preco,
        precoMetroLinear: row.preco_metro_linear,
        precoVendaMetroLinear: row.preco_venda_metro_linear,
        maoDeObra: row.mao_de_obra,
        garantiaFabricante: row.garantia_fabricante,
        garantiaMaoDeObra: row.garantia_mao_de_obra,
        garantiaMaoDeObraUnidade: row.garantia_mao_de_obra_unidade || undefined,
        uv: row.uv,
        ir: row.ir,
        vtl: row.vtl,
        espessura: row.espessura,
        tser: row.tser,
        imagens: row.imagens,
        pinned: row.pinned,
        pinnedAt: row.pinned_at ? new Date(row.pinned_at).getTime() : undefined,
        customFields: row.custom_fields
    }));
};

export const saveCustomFilm = async (film: Film): Promise<Film> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const filmData = {
        user_id: userId,
        nome: film.nome,
        preco: film.preco,
        preco_metro_linear: film.precoMetroLinear,
        preco_venda_metro_linear: film.precoVendaMetroLinear,
        mao_de_obra: film.maoDeObra,
        garantia_fabricante: film.garantiaFabricante,
        garantia_mao_de_obra: film.garantiaMaoDeObra,
        garantia_mao_de_obra_unidade: film.garantiaMaoDeObraUnidade || 'dias',
        uv: film.uv,
        ir: film.ir,
        vtl: film.vtl,
        espessura: film.espessura,
        tser: film.tser,
        imagens: film.imagens,
        pinned: film.pinned,
        pinned_at: film.pinnedAt ? new Date(film.pinnedAt).toISOString() : null,
        custom_fields: film.customFields
    };

    const { data, error } = await supabase
        .from('films')
        .upsert(filmData, { onConflict: 'user_id,nome' })
        .select()
        .single();

    if (error) throw error;
    return film;
};

export const deleteCustomFilm = async (filmName: string): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    // RLS controla acesso por organização - não filtrar por user_id
    const { error } = await supabase
        .from('films')
        .delete()
        .eq('nome', filmName);

    if (error) throw error;
};

// ============================================
// SAVED PDF FUNCTIONS
// ============================================

export const savePDF = async (pdfData: Omit<SavedPDF, 'id'>): Promise<SavedPDF> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const normalizedPdfBlob = normalizePdfBlobInput(pdfData.pdfBlob);
    if (!normalizedPdfBlob) {
        throw new Error('PDF sem arquivo valido para upload.');
    }

    // Sobe o arquivo para o Storage (não guardamos mais base64 no banco)
    const pdfPath = await uploadPdfToStorage(normalizedPdfBlob);

    const pdfRow = {
        user_id: userId,
        client_id: pdfData.clienteId,
        client_name: pdfData.clientName,
        date: pdfData.date,
        expiration_date: pdfData.expirationDate,
        total_preco: pdfData.totalPreco,
        total_m2: pdfData.totalM2,
        subtotal: pdfData.subtotal,
        general_discount_amount: pdfData.generalDiscountAmount,
        general_discount: pdfData.generalDiscount,
        pdf_path: pdfPath,
        nome_arquivo: pdfData.nomeArquivo,
        measurements: pdfData.measurements,
        status: pdfData.status || 'pending',
        agendamento_id: pdfData.agendamentoId,
        proposal_option_name: pdfData.proposalOptionName,
        proposal_option_id: pdfData.proposalOptionId
    };

    const { data, error } = await supabase
        .from('saved_pdfs')
        .insert(pdfRow)
        .select()
        .single();

    if (error) {
        // Rollback: remove o arquivo órfão do Storage se o insert falhar
        await removePdfFromStorage(pdfPath);
        throw error;
    }

    const mapped = await mapRowToPDF(data);
    mapped.pdfBlob = normalizedPdfBlob;
    return mapped;
};

export const updatePDF = async (pdfData: SavedPDF): Promise<SavedPDF> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const pdfRow = {
        client_id: pdfData.clienteId,
        client_name: pdfData.clientName,
        date: pdfData.date,
        expiration_date: pdfData.expirationDate,
        total_preco: pdfData.totalPreco,
        total_m2: pdfData.totalM2,
        subtotal: pdfData.subtotal,
        general_discount_amount: pdfData.generalDiscountAmount,
        general_discount: pdfData.generalDiscount,
        nome_arquivo: pdfData.nomeArquivo,
        measurements: pdfData.measurements,
        status: pdfData.status,
        agendamento_id: pdfData.agendamentoId,
        proposal_option_name: pdfData.proposalOptionName,
        proposal_option_id: pdfData.proposalOptionId
    };

    const normalizedPdfBlob = normalizePdfBlobInput(pdfData.pdfBlob);
    if (normalizedPdfBlob) {
        const pdfPath = await uploadPdfToStorage(normalizedPdfBlob);
        (pdfRow as typeof pdfRow & { pdf_path: string; pdf_blob: string | null }).pdf_path = pdfPath;
        // Limpa o base64 legado para liberar espaço no banco
        (pdfRow as typeof pdfRow & { pdf_path: string; pdf_blob: string | null }).pdf_blob = null;
    }

    const { data, error } = await supabase
        .from('saved_pdfs')
        .update(pdfRow)
        .eq('id', pdfData.id)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) throw error;

    const mapped = await mapRowToPDF(data);
    if (normalizedPdfBlob) {
        mapped.pdfBlob = normalizedPdfBlob;
    }
    return mapped;
};

export const getAllPDFs = async (): Promise<SavedPDF[]> => {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    // RLS controla acesso por organização
    // N?O buscamos o pdf_blob aqui para performance
    const { data, error } = await supabase
        .from('saved_pdfs')
        .select('id, client_id, client_name, date, expiration_date, total_preco, total_m2, subtotal, general_discount_amount, general_discount, nome_arquivo, measurements, status, agendamento_id, proposal_option_name, proposal_option_id, archived_at')
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching PDFs:', error);
        return [];
    }

    const pdfs = await Promise.all((data || []).map(row => mapRowToPDF(row)));
    return pdfs;
};

export const getPDFBlob = async (id: number): Promise<Blob | null> => {
    const { data, error } = await supabase
        .from('saved_pdfs')
        .select('pdf_path, pdf_blob')
        .eq('id', id)
        .single();

    if (error || !data) {
        console.error('Error fetching PDF blob:', error);
        return null;
    }

    // Novo caminho: arquivo no Storage
    if (data.pdf_path) {
        return await downloadPdfFromStorage(data.pdf_path);
    }

    // Fallback: registros antigos ainda em base64 no banco
    if (data.pdf_blob) {
        return base64ToBlob(data.pdf_blob);
    }

    return null;
};

export const getPDFsForClient = async (clientId: number): Promise<SavedPDF[]> => {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    // RLS controla acesso por organização
    // N?O buscamos o pdf_blob aqui para reduzir egress (blob sob demanda via getPDFBlob)
    const { data, error } = await supabase
        .from('saved_pdfs')
        .select('id, client_id, client_name, date, expiration_date, total_preco, total_m2, subtotal, general_discount_amount, general_discount, nome_arquivo, measurements, status, agendamento_id, proposal_option_name, proposal_option_id, archived_at')
        .eq('client_id', clientId)
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching PDFs for client:', error);
        return [];
    }

    const pdfs = await Promise.all((data || []).map(row => mapRowToPDF(row)));
    return pdfs;
};

export const deletePDF = async (id: number): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    // RLS controla acesso por organização - não filtrar por user_id
    // First get the PDF to check for agendamento
    const { data: pdf } = await supabase
        .from('saved_pdfs')
        .select('agendamento_id, pdf_path')
        .eq('id', id)
        .single();

    if (pdf?.agendamento_id) {
        await deleteAgendamento(pdf.agendamento_id);
    }

    const { error } = await supabase
        .from('saved_pdfs')
        .delete()
        .eq('id', id);

    if (error) throw error;

    // Remove o arquivo do Storage após apagar a linha
    if (pdf?.pdf_path) {
        await removePdfFromStorage(pdf.pdf_path);
    }
};

// ============================================
// STANDALONE EXPENSE FUNCTIONS
// ============================================

const mapRowToStandaloneExpense = (row: any): StandaloneExpense => ({
    id: row.id,
    date: row.expense_date || row.date,
    category: row.category || 'other',
    amount: typeof row.amount === 'number' ? row.amount : Number(row.amount || 0),
    description: row.description || '',
    paymentMethod: row.payment_method || '',
    clientId: row.client_id ?? null,
    proposalId: row.proposal_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
});

const buildStandaloneExpenseRow = async (expense: StandaloneExpense) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');
    const orgId = await getEffectiveOrganizationId();
    const amount = typeof expense.amount === 'number'
        ? expense.amount
        : Number(String(expense.amount || '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, ''));

    return {
        user_id: userId,
        organization_id: orgId,
        expense_date: expense.date,
        category: expense.category,
        amount: Number.isFinite(amount) ? amount : 0,
        description: expense.description || '',
        payment_method: expense.paymentMethod || null,
        client_id: expense.clientId || null,
        proposal_id: expense.proposalId || null
    };
};

export const getAllStandaloneExpenses = async (): Promise<StandaloneExpense[]> => {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
        .from('standalone_expenses')
        .select('*')
        .order('expense_date', { ascending: false });

    if (error) {
        console.error('Error fetching standalone expenses:', error);
        throw error;
    }

    return (data || []).map(mapRowToStandaloneExpense);
};

export const saveStandaloneExpense = async (expense: StandaloneExpense): Promise<StandaloneExpense> => {
    const row = await buildStandaloneExpenseRow(expense);

    if (expense.id) {
        const { data, error } = await supabase
            .from('standalone_expenses')
            .update(row)
            .eq('id', expense.id)
            .select()
            .single();

        if (error) throw error;
        return mapRowToStandaloneExpense(data);
    }

    const { data, error } = await supabase
        .from('standalone_expenses')
        .insert(row)
        .select()
        .single();

    if (error) throw error;
    return mapRowToStandaloneExpense(data);
};

export const deleteStandaloneExpense = async (id: number): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { error } = await supabase
        .from('standalone_expenses')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

// Helper functions for PDF blob handling
const base64ToBlob = (base64: string): Blob => {
    const parts = base64.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/pdf';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};

// ============================================
// PDF STORAGE HELPERS (Supabase Storage)
// PDFs deixam de ser guardados como base64 no banco e passam a viver
// no bucket privado "pdfs". A coluna pdf_blob fica apenas como fallback
// de leitura para registros antigos ainda não migrados.
// ============================================
const PDF_BUCKET = 'pdfs';

const getPdfStoragePrefix = async (): Promise<string> => {
    const ownerId = await getEffectiveOwnerUserId();
    if (ownerId) return ownerId;
    const userId = await getCurrentUserId();
    if (userId) return userId;
    throw new Error('Não foi possível determinar a pasta de armazenamento do PDF.');
};

const generatePdfStorageName = (): string => {
    const cryptoObj = globalThis.crypto;
    const uuid = typeof cryptoObj?.randomUUID === 'function'
        ? cryptoObj.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${uuid}.pdf`;
};

const uploadPdfToStorage = async (blob: Blob): Promise<string> => {
    const prefix = await getPdfStoragePrefix();
    const path = `${prefix}/${generatePdfStorageName()}`;
    const { error } = await supabase.storage
        .from(PDF_BUCKET)
        .upload(path, blob, {
            contentType: blob.type || 'application/pdf',
            upsert: false
        });

    if (error) throw error;
    return path;
};

const downloadPdfFromStorage = async (path: string): Promise<Blob | null> => {
    const { data, error } = await supabase.storage.from(PDF_BUCKET).download(path);
    if (error || !data) {
        console.error('Error downloading PDF from storage:', error);
        return null;
    }
    return data;
};

const removePdfFromStorage = async (path: string): Promise<void> => {
    const { error } = await supabase.storage.from(PDF_BUCKET).remove([path]);
    if (error) {
        console.error('Error removing PDF from storage:', error);
    }
};

const mapRowToPDF = async (row: any): Promise<SavedPDF> => ({
    id: row.id,
    clienteId: row.client_id,
    clientName: row.client_name,
    date: row.date,
    expirationDate: row.expiration_date,
    totalPreco: row.total_preco,
    totalM2: row.total_m2,
    subtotal: row.subtotal,
    generalDiscountAmount: row.general_discount_amount,
    generalDiscount: row.general_discount,
    pdfBlob: row.pdf_blob ? base64ToBlob(row.pdf_blob) : undefined,
    nomeArquivo: row.nome_arquivo,
    measurements: row.measurements,
    status: row.status,
    agendamentoId: row.agendamento_id,
    proposalOptionName: row.proposal_option_name,
    proposalOptionId: row.proposal_option_id,
    archivedAt: row.archived_at ?? null
});

// ============================================
// AGENDAMENTO FUNCTIONS
// ============================================

export const getAllAgendamentos = async (): Promise<Agendamento[]> => {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    // RLS controla acesso por organização
    const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .order('start', { ascending: true });

    if (error && isAgendamentoModernColumnError(error)) {
        const { data: legacyData, error: legacyError } = await supabase
            .from('agendamentos')
            .select('*')
            .order('start_time', { ascending: true });

        if (legacyError) {
            console.error('Error fetching agendamentos:', legacyError);
            return [];
        }

        return (legacyData || []).map(mapRowToAgendamento);
    }

    if (error) {
        console.error('Error fetching agendamentos:', error);
        return [];
    }

    return (data || []).map(mapRowToAgendamento);
};

export const saveAgendamento = async (agendamento: Agendamento | Omit<Agendamento, 'id'>): Promise<Agendamento> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const serviceStatus = agendamento.serviceStatus || 'scheduled';
    const agendamentoData = {
        user_id: userId,
        pdf_id: agendamento.pdfId,
        client_id: agendamento.clienteId,
        client_name: agendamento.clienteNome,
        start: agendamento.start,
        end: agendamento.end,
        notes: agendamento.notes,
        service_status: serviceStatus,
        valor_final: agendamento.valorFinal ?? null
    };
    const legacyAgendamentoData = {
        user_id: userId,
        pdf_id: agendamento.pdfId,
        client_id: agendamento.clienteId,
        client_name: agendamento.clienteNome,
        start_time: agendamento.start,
        end_time: agendamento.end,
        notes: agendamento.notes
    };
    // Remove a coluna service_status caso a migração ainda não tenha sido aplicada.
    const stripServiceStatus = <T extends { service_status?: unknown }>(payload: T) => {
        const { service_status, ...rest } = payload;
        return rest;
    };
    // Remove a coluna valor_final caso a migração ainda não tenha sido aplicada.
    const stripValorFinal = <T extends { valor_final?: unknown }>(payload: T) => {
        const { valor_final, ...rest } = payload;
        return rest;
    };

    const id = 'id' in agendamento && agendamento.id ? agendamento.id : undefined;

    const runQuery = (payload: Record<string, unknown>) => {
        const table = supabase.from('agendamentos');
        return id
            ? table.update(payload).eq('id', id).select().single()
            : table.insert(payload).select().single();
    };

    let payload: Record<string, unknown> = agendamentoData;
    let { data, error } = await runQuery(payload);

    if (error && isValorFinalColumnError(error)) {
        payload = stripValorFinal(payload);
        ({ data, error } = await runQuery(payload));
    }

    if (error && isServiceStatusColumnError(error)) {
        payload = stripServiceStatus(payload);
        ({ data, error } = await runQuery(payload));
    }

    if (error && isAgendamentoModernColumnError(error)) {
        const { data: legacyData, error: legacyError } = await runQuery(legacyAgendamentoData);
        if (legacyError) throw legacyError;
        return mapRowToAgendamento(legacyData);
    }

    if (error) throw error;
    return mapRowToAgendamento(data);
};

export const deleteAgendamento = async (id: number): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    // RLS controla acesso por organização - não filtrar por user_id
    const { error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const getAgendamentoByPdfId = async (pdfId: number): Promise<Agendamento | undefined> => {
    const userId = await getCurrentUserId();
    if (!userId) return undefined;

    // RLS controla acesso por organização
    const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('pdf_id', pdfId)
        .single();

    if (error || !data) return undefined;
    return mapRowToAgendamento(data);
};

const mapRowToAgendamento = (row: any): Agendamento => ({
    id: row.id,
    pdfId: row.pdf_id,
    clienteId: row.client_id,
    clienteNome: row.client_name,
    start: row.start ?? row.start_time,
    end: row.end ?? row.end_time,
    notes: row.notes,
    serviceStatus: row.service_status || 'scheduled',
    valorFinal: row.valor_final ?? undefined
});

const isServiceStatusColumnError = (error: unknown): boolean => {
    const details = [
        (error as { message?: string })?.message,
        (error as { details?: string })?.details,
        (error as { hint?: string })?.hint,
        (error as { code?: string })?.code
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return details.includes('service_status')
        && (
            details.includes('column')
            || details.includes('schema cache')
            || details.includes('could not find')
        );
};

const isValorFinalColumnError = (error: unknown): boolean => {
    const details = [
        (error as { message?: string })?.message,
        (error as { details?: string })?.details,
        (error as { hint?: string })?.hint,
        (error as { code?: string })?.code
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return details.includes('valor_final')
        && (
            details.includes('column')
            || details.includes('schema cache')
            || details.includes('could not find')
        );
};

const isAgendamentoModernColumnError = (error: unknown): boolean => {
    const details = [
        (error as { message?: string })?.message,
        (error as { details?: string })?.details,
        (error as { hint?: string })?.hint,
        (error as { code?: string })?.code
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return Boolean(details)
        && (details.includes('start') || details.includes('end'))
        && (
            details.includes('column')
            || details.includes('schema cache')
            || details.includes('could not find')
        );
};

// ============================================
// MEASUREMENTS FUNCTIONS (deprecated - use proposal options)
// ============================================

export const getMeasurements = async (clientId: number): Promise<Measurement[] | null> => {
    const options = await getProposalOptions(clientId);
    if (options.length > 0) {
        return options[0].measurements;
    }
    return null;
};

export const saveMeasurements = async (clientId: number, medidas: Measurement[]): Promise<void> => {
    const options = await getProposalOptions(clientId);
    if (options.length > 0) {
        options[0].measurements = medidas;
        await saveProposalOptions(clientId, options);
    } else {
        await saveProposalOptions(clientId, [{
            id: 1,
            name: 'Opção 1',
            measurements: medidas,
            generalDiscount: { value: '0', type: 'percentage', operation: 'discount' }
        }]);
    }
};

export const deleteMeasurements = async (clientId: number): Promise<void> => {
    await deleteProposalOptions(clientId);
};

const normalizePdfBlobInput = (pdfBlob: unknown): Blob | undefined => {
    if (pdfBlob instanceof Blob) {
        return pdfBlob;
    }

    if (typeof pdfBlob === 'string' && pdfBlob.startsWith('data:')) {
        return base64ToBlob(pdfBlob);
    }

    return undefined;
};

// ============================================
// REMOTE WRITE OPERATIONS
// ============================================

export async function saveClientRemote(client: Omit<Client, 'id'> | Client): Promise<Client> {
    return saveClient(client);
}

export async function deleteClientRemote(id: number): Promise<void> {
    return deleteClient(id);
}

export async function saveProposalOptionsRemote(clientId: number, options: ProposalOption[]): Promise<void> {
    return saveProposalOptions(clientId, options);
}

export async function saveUserInfoRemote(userInfo: UserInfo): Promise<UserInfo> {
    return saveUserInfo(userInfo);
}

export async function saveCustomFilmRemote(film: Film): Promise<Film> {
    return saveCustomFilm(film);
}

export async function deleteCustomFilmRemote(filmName: string): Promise<void> {
    return deleteCustomFilm(filmName);
}

export async function savePDFRemote(pdfData: Omit<SavedPDF, 'id'> | SavedPDF): Promise<SavedPDF> {
    const normalizedPdfBlob = normalizePdfBlobInput(pdfData.pdfBlob);

    if ('id' in pdfData && pdfData.id) {
        return updatePDF({ ...pdfData, pdfBlob: normalizedPdfBlob });
    }

    return savePDF({ ...pdfData, pdfBlob: normalizedPdfBlob });
}

export async function saveStandaloneExpenseRemote(expense: StandaloneExpense): Promise<StandaloneExpense> {
    return saveStandaloneExpense(expense);
}

export async function deleteStandaloneExpenseRemote(id: number): Promise<void> {
    return deleteStandaloneExpense(id);
}

export async function saveAgendamentoRemote(agendamento: Agendamento | Omit<Agendamento, 'id'>): Promise<Agendamento> {
    return saveAgendamento(agendamento);
}

export async function deleteAgendamentoRemote(id: number): Promise<void> {
    return deleteAgendamento(id);
}

// ============================================
// MIGRATION FUNCTION
// ============================================

export const migratePDFsWithProposalOptionId = async (): Promise<{ updated: number; skipped: number; errors: number }> => {
    // This migration is now handled differently in Supabase
    // Returning default values for compatibility
    return { updated: 0, skipped: 0, errors: 0 };
};
