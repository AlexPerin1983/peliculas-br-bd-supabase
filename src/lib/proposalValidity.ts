// Regra de negócio da validade da proposta.
// A validade é limitada a um teto fixo para que a retenção de arquivos no
// Storage (e, portanto, o custo) seja previsível: nenhum orçamento pode ficar
// "vivo" por mais do que MAX_PROPOSAL_VALIDITY_DAYS + a carência de limpeza.

export const PROPOSAL_VALIDITY_OPTIONS = [7, 15, 30, 60] as const;

export const DEFAULT_PROPOSAL_VALIDITY_DAYS = 30;

export const MAX_PROPOSAL_VALIDITY_DAYS = 60;

/**
 * Normaliza um valor de validade para um dos presets permitidos.
 * Valores inválidos ou acima do teto caem no preset válido mais próximo,
 * garantindo que dados legados (ex.: 365 dias) não estourem a retenção.
 */
export function clampValidityDays(value: number | null | undefined): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_PROPOSAL_VALIDITY_DAYS;
    }
    if (parsed >= MAX_PROPOSAL_VALIDITY_DAYS) {
        return MAX_PROPOSAL_VALIDITY_DAYS;
    }
    // Escolhe o maior preset que ainda seja <= valor informado.
    let chosen: number = PROPOSAL_VALIDITY_OPTIONS[0];
    for (const option of PROPOSAL_VALIDITY_OPTIONS) {
        if (parsed >= option) {
            chosen = option;
        }
    }
    return chosen;
}
