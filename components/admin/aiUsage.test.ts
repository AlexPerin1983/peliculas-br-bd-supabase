import { describe, expect, it } from 'vitest';
import { aiFeatureLabel, normalizeAiUsageRows, summarizeAiUsage } from './aiUsage';

describe('uso de IA na ficha do Admin', () => {
    it('soma as funcionalidades e ordena pela mais usada em 30 dias', () => {
        const rows = normalizeAiUsageRows([
            { feature: 'client_extraction', usos_24h: 1, usos_7d: 3, usos_30d: 5, usos_total: 9, falhas_30d: 1, tokens_30d: '1200', ultimo_uso: '2026-11-10T10:00:00Z' },
            { feature: 'measurement_extraction', usos_24h: 4, usos_7d: 10, usos_30d: 22, usos_total: 40, falhas_30d: 0, tokens_30d: 90000, ultimo_uso: '2026-11-12T15:00:00Z' },
            { feature: 'stock_extraction', usos_24h: 0, usos_7d: 0, usos_30d: 0, usos_total: 2, falhas_30d: 0, tokens_30d: 0, ultimo_uso: '2026-08-01T15:00:00Z' },
        ]);
        const summary = summarizeAiUsage(rows);

        expect(summary.usos24h).toBe(5);
        expect(summary.usos7d).toBe(13);
        expect(summary.usos30d).toBe(27);
        expect(summary.usosTotal).toBe(51);
        expect(summary.falhas30d).toBe(1);
        expect(summary.tokens30d).toBe(91200);
        expect(summary.ultimoUso).toBe('2026-11-12T15:00:00Z');
        expect(summary.features.map(row => row.feature)).toEqual(['measurement_extraction', 'client_extraction']);
    });

    it('sem uso nenhum devolve tudo zerado', () => {
        const summary = summarizeAiUsage(normalizeAiUsageRows(null));
        expect(summary.usosTotal).toBe(0);
        expect(summary.ultimoUso).toBeNull();
        expect(summary.features).toEqual([]);
    });

    it('mostra o nome da funcionalidade em português e mantém o código desconhecido', () => {
        expect(aiFeatureLabel('schedule_extraction')).toBe('Agendamento por voz');
        expect(aiFeatureLabel('nova_funcao')).toBe('nova_funcao');
    });
});
