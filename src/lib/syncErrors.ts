export type SyncErrorCategory = 'network' | 'server' | 'authentication' | 'permission'
    | 'validation' | 'duplicate' | 'conflict' | 'dependency' | 'configuration' | 'storage' | 'unknown';

export interface SyncErrorInfo {
    category: SyncErrorCategory;
    code: string;
}

const CATEGORY_CODES: Record<SyncErrorCategory, string> = {
    network: 'SYNC_NETWORK', server: 'SYNC_SERVER', authentication: 'SYNC_AUTH',
    permission: 'SYNC_PERMISSION', validation: 'SYNC_VALIDATION', duplicate: 'SYNC_DUPLICATE',
    conflict: 'SYNC_CONFLICT', dependency: 'SYNC_DEPENDENCY', configuration: 'SYNC_CONFIGURATION',
    storage: 'SYNC_STORAGE', unknown: 'SYNC_UNKNOWN',
};
const SAFE_BACKEND_CODES = new Set([
    'PGRST000', 'PGRST001', 'PGRST002', 'PGRST003', 'PGRST202', 'PGRST204', 'PGRST205',
    'PGRST301', 'PGRST302', 'PGRST303', '42501', '22003', '22P02', '23502', '23503',
    '23505', '23514', '40001', '40P01', '57014', '53300', '57P01', '08000', '08001',
    '08003', '08006', '42P01', '42703', 'HTTP_401', 'HTTP_403', 'HTTP_408', 'HTTP_429',
    'HTTP_500', 'HTTP_502', 'HTTP_503', 'HTTP_504',
]);

// Metadados e mensagens do servidor nunca são copiados para o diagnóstico.
// Somente categorias e códigos conhecidos atravessam esta fronteira.
export const sanitizeSyncErrorInfo = (info?: SyncErrorInfo): SyncErrorInfo | undefined => {
    if (!info || !Object.prototype.hasOwnProperty.call(CATEGORY_CODES, info.category)) return undefined;
    return {
        category: info.category,
        code: SAFE_BACKEND_CODES.has(info.code) ? info.code : CATEGORY_CODES[info.category],
    };
};

export const classifySyncError = (error: unknown): SyncErrorInfo => {
    const record = typeof error === 'object' && error !== null
        ? error as { message?: unknown; code?: unknown; status?: unknown; name?: unknown }
        : {};
    const message = String(record.message ?? error ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const code = String(record.code ?? '').toUpperCase();
    const httpCode = `HTTP_${record.status}`;
    const safeCode = SAFE_BACKEND_CODES.has(code) ? code : SAFE_BACKEND_CODES.has(httpCode) ? httpCode : undefined;
    const result = (category: SyncErrorCategory): SyncErrorInfo => ({ category, code: safeCode || CATEGORY_CODES[category] });
    const has = (...parts: string[]) => parts.some(part => message.includes(part));

    if (['PGRST301', 'PGRST302', 'PGRST303'].includes(code) || record.status === 401
        || has('jwt expired', 'invalid jwt', 'unauthorized', 'user not authenticated', 'sessao expirada', 'sessao nao autenticada', 'not authenticated')) return result('authentication');
    if (code === '42501' || record.status === 403
        || has('row-level security', 'permission denied', 'cliente nao autorizado', 'nao autorizad', 'forbidden')) return result('permission');
    if (['SYNC_CONFIGURATION', 'PGRST202', 'PGRST204', 'PGRST205', '42P01', '42703'].includes(code)
        || has('schema cache', 'could not find the function', 'could not find the table')) return result('configuration');
    if (String(record.name) === 'QuotaExceededError' || has('quotaexceedederror', 'quota exceeded', 'databaseclosederror', 'indexeddb', 'invalidstateerror')) return result('storage');
    if (has('failed to fetch', 'networkerror', 'network error', 'load failed', 'err_network', 'falha de rede')) return result('network');
    if (['PGRST000', 'PGRST001', 'PGRST002', 'PGRST003', '57014', '53300', '57P01', '08000', '08001', '08003', '08006'].includes(code)
        || [408, 429, 500, 502, 503, 504].includes(Number(record.status))
        || has('timeout', 'timed out', 'statement timeout', 'service unavailable', 'too many requests', 'bad gateway', 'fetch failed')) return result('server');
    if (code === '23505' || has('duplicate key', 'unique constraint')) return result('duplicate');
    if (code === '23503' || has('foreign key', 'id do cliente nao encontrado', 'id do agendamento nao encontrado', 'nao existe para receber a medida')) return result('dependency');
    if (['22003', '22P02', '23502', '23514'].includes(code)
        || has('numeric field overflow', 'invalid input syntax', 'not-null constraint', 'check constraint', 'operacao upsert_', 'operacoes de medidas devem', 'pdf sem arquivo valido')) return result('validation');
    if (['40001', '40P01'].includes(code)
        || has('mudaram repetidamente em outro aparelho', 'serialization failure', 'deadlock detected')) return result('conflict');
    return result('unknown');
};

export const getSyncErrorInfo = (item: { lastError?: string | null; errorInfo?: SyncErrorInfo }): SyncErrorInfo => (
    sanitizeSyncErrorInfo(item.errorInfo) ?? classifySyncError(item.lastError)
);

export const canAutomaticallyRetrySyncError = (info: SyncErrorInfo, retryCount = 0): boolean => {
    if (info.category === 'network' || info.category === 'server') return true;
    // Falhas desconhecidas ou conflitos não ficam em um ciclo infinito.
    return (info.category === 'unknown' || info.category === 'conflict') && retryCount < 3;
};

export const getSyncErrorPresentation = (info: SyncErrorInfo, table?: string) => {
    const messages: Record<SyncErrorCategory, { title: string; message: string }> = {
        network: { title: 'Aguardando conexão com o servidor', message: 'Conexão instável com o servidor. O envio será tentado novamente automaticamente quando houver conexão.' },
        server: { title: 'Servidor temporariamente indisponível', message: 'O servidor não respondeu a tempo ou está ocupado. O envio será tentado novamente automaticamente.' },
        authentication: { title: 'Sessão precisa ser renovada', message: 'Entre novamente na mesma conta e toque em Tentar novamente. Não limpe os dados do navegador.' },
        permission: { title: 'Sem permissão para salvar', message: 'Sua conta não foi autorizada a salvar esta alteração. Peça a revisão do acesso na empresa e tente novamente após a correção.' },
        validation: { title: 'Dado precisa de revisão', message: 'Um dado não foi aceito pelo servidor. Revise o preenchimento ou envie o diagnóstico ao suporte. A tentativa automática foi pausada.' },
        duplicate: { title: 'Registro já existente', message: 'O servidor encontrou um registro duplicado. Envie o diagnóstico ao suporte para conciliar os dados sem descartar suas alterações.' },
        conflict: { title: 'Alterações em outro aparelho', message: 'A versão do orçamento mudou durante o envio. Evite editar o mesmo orçamento nos dois aparelhos ao mesmo tempo e tente novamente.' },
        dependency: { title: 'Vínculo precisa de revisão', message: 'O registro vinculado a esta alteração não foi localizado. Envie o diagnóstico ao suporte; não apague o cadastro nem a pendência.' },
        configuration: { title: 'Atualização do servidor necessária', message: 'O aplicativo e o servidor não conseguiram concluir a operação. Envie o diagnóstico ao suporte para revisar a atualização.' },
        storage: { title: 'Falha no armazenamento local', message: 'Não foi possível acessar ou atualizar o armazenamento deste aparelho. Não limpe os dados nem feche a tela antes de falar com o suporte.' },
        unknown: { title: 'Falha ainda não identificada', message: 'Não foi possível confirmar o envio. Se persistir após as novas tentativas, copie o diagnóstico e envie ao suporte.' },
    };
    if (info.category === 'validation' && table === 'films') {
        return { title: messages.validation.title, message: 'Uma película possui um valor numérico inválido ou um campo não aceito. Confira o preenchimento e salve novamente.' };
    }
    return messages[info.category] ?? messages.unknown;
};

const TABLE_LABELS: Record<string, string> = {
    clients: 'Clientes', films: 'Películas', savedPdfs: 'PDFs', agendamentos: 'Agendamentos',
    proposalOptions: 'Opções de orçamento', userInfo: 'Configurações', standaloneExpenses: 'Despesas',
};
export const getSyncTableLabel = (table: string) => Object.prototype.hasOwnProperty.call(TABLE_LABELS, table) ? TABLE_LABELS[table] : 'Registro';
