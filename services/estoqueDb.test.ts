import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();
const fromMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const singleMock = vi.fn();
const getSessionMock = vi.fn();
const getUserMock = vi.fn();

vi.mock('./supabaseClient', () => ({
    supabase: {
        rpc: (...args: unknown[]) => rpcMock(...args),
        from: (...args: unknown[]) => fromMock(...args),
        auth: {
            getSession: (...args: unknown[]) => getSessionMock(...args),
            getUser: (...args: unknown[]) => getUserMock(...args)
        }
    }
}));

import {
    completeAgendamentoWithStock,
    saveBobina,
    saveConsumo,
    ServiceStockConsumptionInput
} from './estoqueDb';

describe('estoqueDb atomic stock completion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSessionMock.mockResolvedValue({
            data: { session: { user: { id: 'user-1' } } }
        });
        getUserMock.mockResolvedValue({
            data: { user: { id: 'user-1' } }
        });
    });

    it('envia todas as linhas em uma unica RPC e mapeia o snapshot retornado', async () => {
        rpcMock.mockResolvedValue({
            data: {
                agendamento_id: 55,
                stock_status: 'confirmed',
                stock_consumed_at: '2026-08-07T15:30:00.000Z',
                stock_source_pdf_ids: [91],
                stock_consumption_snapshot: [{
                    bobina_id: 10,
                    metros_consumidos: 2.75,
                    source_key: 'agenda:55:bobina:10',
                    film_id: 'Carbono Prime',
                    pdf_id: 91,
                    largura_corte_cm: 152,
                    comprimento_corte_cm: 275,
                    area_m2: 4.18,
                    tipo: 'corte',
                    observacao: 'Servico concluido'
                }],
                already_confirmed: false
            },
            error: null
        });

        const lines: ServiceStockConsumptionInput[] = [{
            bobinaId: 10,
            metrosConsumidos: 2.75,
            sourceKey: 'agenda:55:bobina:10',
            filmId: ' Carbono Prime ',
            pdfId: 91,
            larguraCorteCm: 152,
            comprimentoCorteCm: 275,
            areaM2: 4.18,
            tipo: 'corte',
            observacao: ' Servico concluido '
        }];

        const result = await completeAgendamentoWithStock(55, 480, lines);

        expect(rpcMock).toHaveBeenCalledTimes(1);
        expect(rpcMock).toHaveBeenCalledWith('complete_agendamento_with_stock', {
            p_agendamento_id: 55,
            p_final_value: 480,
            p_lines: [{
                bobina_id: 10,
                metros_consumidos: 2.75,
                source_key: 'agenda:55:bobina:10',
                film_id: 'Carbono Prime',
                pdf_id: 91,
                largura_corte_cm: 152,
                comprimento_corte_cm: 275,
                area_m2: 4.18,
                tipo: 'corte',
                observacao: 'Servico concluido'
            }]
        });
        expect(result).toEqual({
            agendamentoId: 55,
            stockStatus: 'confirmed',
            stockConsumedAt: '2026-08-07T15:30:00.000Z',
            stockSourcePdfIds: [91],
            alreadyConfirmed: false,
            lines: [{
                bobinaId: 10,
                metrosConsumidos: 2.75,
                sourceKey: 'agenda:55:bobina:10',
                filmId: 'Carbono Prime',
                pdfId: 91,
                larguraCorteCm: 152,
                comprimentoCorteCm: 275,
                areaM2: 4.18,
                tipo: 'corte',
                observacao: 'Servico concluido'
            }]
        });
    });

    it('aceita valor final nulo e preserva a resposta idempotente da RPC', async () => {
        rpcMock.mockResolvedValue({
            data: {
                agendamento_id: 55,
                stock_status: 'confirmed',
                stock_consumed_at: '2026-08-07T15:30:00.000Z',
                stock_source_pdf_ids: [],
                stock_consumption_snapshot: [{
                    bobina_id: 10,
                    metros_consumidos: 1,
                    source_key: 'agenda:55:bobina:10'
                }],
                already_confirmed: true
            },
            error: null
        });

        const result = await completeAgendamentoWithStock(55, null, [{
            bobinaId: 10,
            metrosConsumidos: 1,
            sourceKey: 'agenda:55:bobina:10'
        }]);

        expect(rpcMock).toHaveBeenCalledWith('complete_agendamento_with_stock', {
            p_agendamento_id: 55,
            p_final_value: null,
            p_lines: [{
                bobina_id: 10,
                metros_consumidos: 1,
                source_key: 'agenda:55:bobina:10'
            }]
        });
        expect(result.alreadyConfirmed).toBe(true);
    });

    it('rejeita linhas invalidas antes de chamar a RPC', async () => {
        await expect(completeAgendamentoWithStock(55, 100, [{
            bobinaId: 10,
            metrosConsumidos: 1,
            sourceKey: 'outra-origem'
        }])).rejects.toThrow('agenda:55:');

        await expect(completeAgendamentoWithStock(55, 100, [])).rejects.toThrow('ao menos um material');
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('propaga falhas da RPC sem tentar uma segunda escrita', async () => {
        const rpcError = { code: 'P0001', message: 'Saldo insuficiente' };
        rpcMock.mockResolvedValue({ data: null, error: rpcError });

        await expect(completeAgendamentoWithStock(55, 100, [{
            bobinaId: 10,
            metrosConsumidos: 3,
            sourceKey: 'agenda:55:bobina:10'
        }])).rejects.toBe(rpcError);

        expect(rpcMock).toHaveBeenCalledTimes(1);
    });

    it('preserva agendamento e chave de origem nos consumos manuais mapeados', async () => {
        singleMock.mockResolvedValue({
            data: {
                id: 200,
                user_id: 'user-1',
                bobina_id: 10,
                retalho_id: null,
                client_id: 7,
                client_name: 'Cliente',
                pdf_id: 91,
                agendamento_id: 55,
                source_key: 'agenda:55:bobina:10',
                metros_consumidos: 2,
                largura_corte_cm: 152,
                comprimento_corte_cm: 200,
                area_m2: 3.04,
                data_consumo: '2026-08-07T15:30:00.000Z',
                tipo: 'corte',
                observacao: 'Conclusao'
            },
            error: null
        });
        selectMock.mockReturnValue({ single: singleMock });
        insertMock.mockReturnValue({ select: selectMock });
        fromMock.mockReturnValue({ insert: insertMock });

        const saved = await saveConsumo({
            bobinaId: 10,
            clientId: 7,
            clientName: 'Cliente',
            pdfId: 91,
            agendamentoId: 55,
            sourceKey: 'agenda:55:bobina:10',
            metrosConsumidos: 2,
            larguraCorteCm: 152,
            comprimentoCorteCm: 200,
            areaM2: 3.04,
            tipo: 'corte',
            observacao: 'Conclusao'
        });

        expect(fromMock).toHaveBeenCalledWith('consumos');
        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
            agendamento_id: 55,
            source_key: 'agenda:55:bobina:10'
        }));
        expect(saved).toEqual(expect.objectContaining({
            id: 200,
            agendamentoId: 55,
            sourceKey: 'agenda:55:bobina:10'
        }));
    });

    it('nao sobrescreve o saldo ao editar metadata ou status de uma bobina', async () => {
        singleMock.mockResolvedValue({
            data: {
                id: 10,
                film_id: 'Carbono Prime',
                codigo_qr: 'PBR-10',
                largura_cm: 152,
                comprimento_total_m: 30,
                comprimento_restante_m: 17,
                status: 'ativa',
                localizacao: 'Prateleira A'
            },
            error: null
        });
        selectMock.mockReturnValue({ single: singleMock });
        eqMock.mockReturnValue({ select: selectMock });
        updateMock.mockReturnValue({ eq: eqMock });
        fromMock.mockReturnValue({ update: updateMock });

        const saved = await saveBobina({
            id: 10,
            filmId: 'Carbono Prime',
            codigoQr: 'PBR-10',
            larguraCm: 152,
            comprimentoTotalM: 30,
            // Snapshot antigo: a resposta remota ja possui apenas 17 m.
            comprimentoRestanteM: 25,
            status: 'ativa',
            localizacao: 'Prateleira A'
        });

        expect(updateMock).toHaveBeenCalledTimes(1);
        expect(updateMock.mock.calls[0][0]).not.toHaveProperty('comprimento_restante_m');
        expect(eqMock).toHaveBeenCalledWith('id', 10);
        expect(saved.comprimentoRestanteM).toBe(17);
    });
});
