// Uso de IA de uma empresa, para a ficha do Admin.

export interface AiUsageFeatureRow {
    feature: string;
    usos24h: number;
    usos7d: number;
    usos30d: number;
    usosTotal: number;
    falhas30d: number;
    tokens30d: number;
    ultimoUso: string | null;
}

export interface AiUsageSummary {
    usos24h: number;
    usos7d: number;
    usos30d: number;
    usosTotal: number;
    falhas30d: number;
    tokens30d: number;
    ultimoUso: string | null;
    /** Funcionalidades com uso nos últimos 30 dias, da mais usada para a menos. */
    features: AiUsageFeatureRow[];
}

// Limite diário por usuário aplicado no servidor (MAX_REQUESTS_PER_DAY em
// supabase/functions/gemini-proxy/index.ts). Se mudar lá, mude aqui.
export const AI_DAILY_LIMIT = 200;

const FEATURE_LABELS: Record<string, string> = {
    client_extraction: 'Cadastro de cliente',
    quick_proposal: 'Orçamento rápido',
    film_extraction: 'Cadastro de película',
    measurement_extraction: 'Leitura de medidas',
    stock_extraction: 'Estoque',
    schedule_extraction: 'Agendamento por voz',
};

export const aiFeatureLabel = (feature: string) => FEATURE_LABELS[feature] || feature;

const toNumber = (value: unknown): number => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
};

export const normalizeAiUsageRows = (data: unknown): AiUsageFeatureRow[] => (
    (Array.isArray(data) ? data : []).map((row: any) => ({
        feature: String(row?.feature || ''),
        usos24h: toNumber(row?.usos_24h),
        usos7d: toNumber(row?.usos_7d),
        usos30d: toNumber(row?.usos_30d),
        usosTotal: toNumber(row?.usos_total),
        falhas30d: toNumber(row?.falhas_30d),
        tokens30d: toNumber(row?.tokens_30d),
        ultimoUso: row?.ultimo_uso || null,
    }))
);

export const summarizeAiUsage = (rows: AiUsageFeatureRow[]): AiUsageSummary => {
    const sum = (pick: (row: AiUsageFeatureRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
    const ultimoUso = rows.reduce<string | null>((latest, row) => (
        row.ultimoUso && (!latest || new Date(row.ultimoUso).getTime() > new Date(latest).getTime()) ? row.ultimoUso : latest
    ), null);
    return {
        usos24h: sum(row => row.usos24h),
        usos7d: sum(row => row.usos7d),
        usos30d: sum(row => row.usos30d),
        usosTotal: sum(row => row.usosTotal),
        falhas30d: sum(row => row.falhas30d),
        tokens30d: sum(row => row.tokens30d),
        ultimoUso,
        features: rows.filter(row => row.usos30d > 0).sort((a, b) => b.usos30d - a.usos30d),
    };
};
