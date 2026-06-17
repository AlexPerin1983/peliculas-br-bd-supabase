// Garantia de mão de obra: valor livre + unidade (dias/meses/anos).
// Películas antigas não têm unidade → tratadas como "dias" (retrocompatível).

export type GarantiaUnidade = 'dias' | 'meses' | 'anos';

export const GARANTIA_UNIDADES: { value: GarantiaUnidade; label: string }[] = [
    { value: 'dias', label: 'Dias' },
    { value: 'meses', label: 'Meses' },
    { value: 'anos', label: 'Anos' },
];

const SINGULAR: Record<GarantiaUnidade, string> = { dias: 'dia', meses: 'mês', anos: 'ano' };
const PLURAL: Record<GarantiaUnidade, string> = { dias: 'dias', meses: 'meses', anos: 'anos' };
const CURTO: Record<GarantiaUnidade, string> = { dias: 'd', meses: 'm', anos: 'a' };

const normalizeUnidade = (unidade?: GarantiaUnidade | string | null): GarantiaUnidade =>
    unidade === 'meses' || unidade === 'anos' ? unidade : 'dias';

// Forma longa: "30 dias", "1 mês", "2 anos". Retorna 'N/A' quando vazio.
export const formatGarantiaMaoDeObra = (
    value?: number | null,
    unidade?: GarantiaUnidade | string | null,
): string => {
    if (value == null || !Number.isFinite(value) || value <= 0) return 'N/A';
    const u = normalizeUnidade(unidade);
    return `${value} ${value === 1 ? SINGULAR[u] : PLURAL[u]}`;
};

// Forma curta para selos/badges: "30d", "6m", "2a". Retorna '' quando vazio.
export const formatGarantiaMaoDeObraCurto = (
    value?: number | null,
    unidade?: GarantiaUnidade | string | null,
): string => {
    if (value == null || !Number.isFinite(value) || value <= 0) return '';
    return `${value}${CURTO[normalizeUnidade(unidade)]}`;
};

// Converte para dias (apenas para comparar garantias de unidades diferentes).
export const garantiaEmDias = (value?: number | null, unidade?: GarantiaUnidade | string | null): number => {
    if (value == null || !Number.isFinite(value) || value <= 0) return 0;
    const u = normalizeUnidade(unidade);
    return value * (u === 'anos' ? 365 : u === 'meses' ? 30 : 1);
};
