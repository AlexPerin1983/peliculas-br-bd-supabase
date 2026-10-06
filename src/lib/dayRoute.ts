import { Agendamento } from '../../types';

// Rota do dia no Google Maps: sai de onde a pessoa está e passa pelos endereços
// na ordem dos horários. No celular o Maps aceita até 3 paradas no caminho mais
// o destino, então a rota leva no máximo 4 endereços.
export const MAX_ROUTE_STOPS = 4;

export interface DayRoute {
    url: string;
    // Endereços que entraram na rota e quantos o dia tinha.
    count: number;
    total: number;
}

const sameAddress = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Só o que ainda vai acontecer no dia: sem cancelado, falta ou concluído, e sem o que já terminou.
// Com menos de 2 endereços não há rota a montar (o cartão já tem o botão de rota).
export const buildDayRoute = (
    agendamentos: Pick<Agendamento, 'start' | 'end' | 'serviceStatus'>[],
    getAddress: (index: number) => string,
    now: Date = new Date(),
): DayRoute | null => {
    const addresses: string[] = [];
    agendamentos.forEach((agendamento, index) => {
        const status = agendamento.serviceStatus || 'scheduled';
        if (status === 'cancelled' || status === 'no_show' || status === 'completed') return;
        if (new Date(agendamento.end).getTime() <= now.getTime()) return;
        const address = getAddress(index).trim();
        // Dois atendimentos seguidos no mesmo lugar contam como uma parada só.
        if (address && !(addresses.length && sameAddress(addresses[addresses.length - 1], address))) {
            addresses.push(address);
        }
    });
    if (addresses.length < 2) return null;

    const stops = addresses.slice(0, MAX_ROUTE_STOPS);
    const destination = stops[stops.length - 1];
    const waypoints = stops.slice(0, -1).map(encodeURIComponent).join('%7C');
    return {
        url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&waypoints=${waypoints}&travelmode=driving`,
        count: stops.length,
        total: addresses.length,
    };
};
