import { describe, expect, it } from 'vitest';
import { buildDayRoute } from './dayRoute';

// Terça, 06/10/2026, 07:00 no horário do aparelho.
const now = new Date(2026, 9, 6, 7, 0);
const at = (hour: number) => new Date(2026, 9, 6, hour, 0).toISOString();
const visit = (hour: number, extra: Record<string, unknown> = {}) => ({ start: at(hour), end: at(hour + 1), ...extra });

describe('rota do dia', () => {
    it('sai de onde a pessoa está e passa pelos endereços na ordem dos horários', () => {
        const addresses = ['Rua A, 1 - Bessa', 'Rua B, 2 - Manaíra', 'Rua C, 3 - Tambaú'];
        const route = buildDayRoute([visit(8), visit(10), visit(14)], (index) => addresses[index], now)!;

        expect(route).toMatchObject({ count: 3, total: 3 });
        expect(route.url).toBe(
            'https://www.google.com/maps/dir/?api=1'
            + `&destination=${encodeURIComponent('Rua C, 3 - Tambaú')}`
            + `&waypoints=${encodeURIComponent('Rua A, 1 - Bessa')}%7C${encodeURIComponent('Rua B, 2 - Manaíra')}`
            + '&travelmode=driving',
        );
        expect(route.url).not.toContain('origin=');
    });

    it('deixa de fora cancelado, falta, concluído, o que já terminou e quem não tem endereço', () => {
        const addresses = ['Já foi', 'Cancelado', 'Sem endereço', 'Rua D', 'Faltou', 'Rua E'];
        const route = buildDayRoute([
            visit(6),
            visit(8, { serviceStatus: 'cancelled' }),
            visit(9),
            visit(10),
            visit(11, { serviceStatus: 'no_show' }),
            visit(15),
        ], (index) => (index === 2 ? '' : addresses[index]), now);

        expect(route).toMatchObject({ count: 2, total: 2 });
        expect(decodeURIComponent(route!.url)).toContain('destination=Rua E&waypoints=Rua D&');
    });

    it('com menos de 2 endereços não monta rota; com mais de 4, leva os 4 primeiros', () => {
        expect(buildDayRoute([visit(8)], () => 'Rua A', now)).toBeNull();
        // O mesmo endereço seguido conta uma vez só.
        expect(buildDayRoute([visit(8), visit(10)], () => 'Rua A', now)).toBeNull();

        const route = buildDayRoute([visit(8), visit(9), visit(10), visit(11), visit(12)], (index) => `Rua ${index}`, now)!;
        expect(route).toMatchObject({ count: 4, total: 5 });
        expect(decodeURIComponent(route.url)).toContain('destination=Rua 3&waypoints=Rua 0|Rua 1|Rua 2&');
    });
});
