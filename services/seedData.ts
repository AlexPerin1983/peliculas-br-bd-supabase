// Popula a conta de um usuário novo com dados de exemplo (1 cliente,
// algumas películas e um orçamento) para que o app não fique vazio no
// primeiro acesso. Os exemplos são rotulados como "Exemplo" para deixar
// claro que podem ser apagados.

import { Client, Film, Measurement, ProposalOption } from '../types';
import * as db from './db';

const SEED_FLAG_KEY = 'peliculas-br-seed-v1';

const EXAMPLE_FILMS: Film[] = [
    {
        nome: 'Película G20 (Fumê Médio) — Exemplo',
        preco: 80,
        maoDeObra: 30,
        garantiaFabricante: 60,
        garantiaMaoDeObra: 12,
        vtl: 20
    },
    {
        nome: 'Película G5 (Fumê Escuro) — Exemplo',
        preco: 90,
        maoDeObra: 30,
        garantiaFabricante: 60,
        garantiaMaoDeObra: 12,
        vtl: 5
    },
    {
        nome: 'Película Jateada (Decorativa) — Exemplo',
        preco: 120,
        maoDeObra: 40,
        garantiaFabricante: 60,
        garantiaMaoDeObra: 12
    }
];

const EXAMPLE_CLIENT: Omit<Client, 'id'> = {
    nome: 'Maria Silva (Cliente Exemplo)',
    telefone: '(11) 91234-5678',
    email: 'maria.exemplo@email.com',
    cpfCnpj: '',
    cidade: 'São Paulo',
    uf: 'SP',
    lastUpdated: new Date().toISOString()
};

function buildExampleMeasurements(): Measurement[] {
    const base = Date.now();
    return [
        {
            id: base,
            largura: '1.20',
            altura: '1.00',
            quantidade: 2,
            ambiente: 'Sala',
            tipoAplicacao: 'Janela',
            pelicula: EXAMPLE_FILMS[0].nome,
            active: true
        },
        {
            id: base + 1,
            largura: '0.80',
            altura: '2.10',
            quantidade: 1,
            ambiente: 'Entrada',
            tipoAplicacao: 'Porta de vidro',
            pelicula: EXAMPLE_FILMS[2].nome,
            active: true
        }
    ];
}

function hasSeeded(): boolean {
    try {
        return localStorage.getItem(SEED_FLAG_KEY) === 'true';
    } catch {
        return false;
    }
}

function markSeeded(): void {
    try {
        localStorage.setItem(SEED_FLAG_KEY, 'true');
    } catch {
        // Sem storage: o exemplo pode ser recriado, mas a checagem de dados
        // existentes abaixo evita duplicação na maioria dos casos.
    }
}

/**
 * Cria os dados de exemplo apenas se for realmente um começo do zero.
 * Não faz nada se já marcou como semeado ou se já existem clientes/películas
 * (para nunca poluir a conta de quem já usa o app).
 * Retorna true se algo foi criado.
 */
export async function seedExampleDataIfNeeded(): Promise<boolean> {
    if (hasSeeded()) return false;

    try {
        const [existingClients, existingFilms] = await Promise.all([
            db.getAllClients(),
            db.getAllCustomFilms()
        ]);

        if (existingClients.length > 0 || existingFilms.length > 0) {
            // Conta já tem conteúdo: apenas registra para não tentar de novo.
            markSeeded();
            return false;
        }

        // Películas de exemplo.
        for (const film of EXAMPLE_FILMS) {
            await db.saveCustomFilm(film);
        }

        // Cliente de exemplo.
        const savedClient = await db.saveClient(EXAMPLE_CLIENT);

        // Orçamento de exemplo para o cliente.
        if (savedClient?.id) {
            const option: ProposalOption = {
                id: Date.now(),
                name: 'Orçamento Exemplo',
                measurements: buildExampleMeasurements(),
                generalDiscount: { value: '', type: 'percentage' }
            };
            await db.saveProposalOptions(savedClient.id, [option]);
        }

        markSeeded();
        return true;
    } catch (error) {
        console.error('[Seed] Não foi possível criar os dados de exemplo:', error);
        return false;
    }
}
