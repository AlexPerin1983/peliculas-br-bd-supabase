import { ProposalOption } from '../types';
import { applyProposalOperations, buildProposalOperations, mergeProposalOptions } from './proposalSync';

const option = (measurements: ProposalOption['measurements']): ProposalOption => ({
    id: 10,
    name: 'Opcao 1',
    measurements,
    generalDiscount: { value: '', type: 'fixed' }
});

const measurement = (id: number, largura: string) => ({
    id,
    largura,
    altura: '1,00',
    quantidade: 1,
    ambiente: 'Sala',
    tipoAplicacao: 'Janela',
    pelicula: 'Carbono',
    active: true
});

describe('mergeProposalOptions', () => {
    it('preserva medidas adicionadas simultaneamente em dois aparelhos', () => {
        const base = [option([measurement(1, '1,00')])];
        const local = [option([measurement(1, '1,00'), measurement(2, '2,00')])];
        const remote = [option([measurement(1, '1,00'), measurement(3, '3,00')])];

        const result = mergeProposalOptions(base, local, remote);

        expect(result.options[0].measurements.map(item => item.id)).toEqual([1, 2, 3]);
        expect(result.preservedConflicts).toBe(0);
    });

    it('nao deixa uma fotografia local vazia apagar medidas remotas novas', () => {
        const local = [option([])];
        const remote = [option([measurement(20, '1,58'), measurement(21, '4,00')])];

        const result = mergeProposalOptions([], local, remote);

        expect(result.options[0].measurements).toHaveLength(2);
        expect(result.options[0].measurements.map(item => item.id)).toEqual([20, 21]);
    });

    it('respeita uma exclusao quando o outro aparelho nao alterou a medida', () => {
        const base = [option([measurement(1, '1,00'), measurement(2, '2,00')])];
        const local = [option([measurement(1, '1,00')])];
        const remote = [option([measurement(1, '1,00'), measurement(2, '2,00')])];

        const result = mergeProposalOptions(base, local, remote);

        expect(result.options[0].measurements.map(item => item.id)).toEqual([1]);
    });

    it('preserva as duas versoes quando a mesma medida muda nos dois aparelhos', () => {
        const base = [option([measurement(1, '1,00')])];
        const local = [option([measurement(1, '1,20')])];
        const remote = [option([measurement(1, '1,30')])];

        const result = mergeProposalOptions(base, local, remote);

        expect(result.options[0].measurements).toHaveLength(2);
        expect(result.options[0].measurements[0].largura).toBe('1,20');
        expect(result.options[0].measurements[1].largura).toBe('1,30');
        expect(result.options[0].measurements[1].id).toBeLessThan(0);
        expect(result.preservedConflicts).toBe(1);
    });
});

describe('operações incrementais de proposta', () => {
    it('envia somente a medida alterada e reconstrói o mesmo resultado', () => {
        const base = [option([measurement(1, '1,00'), measurement(2, '2,00')])];
        const next = [option([measurement(1, '1,25'), measurement(2, '2,00')])];

        const operations = buildProposalOperations(base, next);

        expect(operations).toEqual([
            expect.objectContaining({
                type: 'upsert_measurement',
                optionId: 10,
                measurement: expect.objectContaining({ id: 1, largura: '1,25' })
            })
        ]);
        expect(applyProposalOperations(base, operations)).toEqual(next);
    });

    it('agrupa inclusão, exclusão e reordenação sem enviar medidas inalteradas', () => {
        const base = [option([
            measurement(1, '1,00'),
            measurement(2, '2,00'),
            measurement(3, '3,00')
        ])];
        const next = [option([
            measurement(3, '3,00'),
            measurement(1, '1,00'),
            measurement(4, '4,00')
        ])];

        const operations = buildProposalOperations(base, next);

        expect(operations.filter(operation => operation.type === 'upsert_measurement')).toHaveLength(1);
        expect(operations).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'delete_measurement', measurementId: 2 }),
            expect.objectContaining({ type: 'set_measurement_order', measurementIds: [3, 1, 4] })
        ]));
        expect(applyProposalOperations(base, operations)).toEqual(next);
    });

    it('inclui e remove opções usando operações pequenas', () => {
        const first = option([measurement(1, '1,00')]);
        const second: ProposalOption = {
            ...option([measurement(9, '9,00')]),
            id: 20,
            name: 'Opcao 2'
        };

        const addOperations = buildProposalOperations([first], [first, second]);
        expect(applyProposalOperations([first], addOperations)).toEqual([first, second]);

        const deleteOperations = buildProposalOperations([first, second], [second]);
        expect(deleteOperations).toContainEqual({ type: 'delete_option', optionId: 10 });
        expect(applyProposalOperations([first, second], deleteOperations)).toEqual([second]);
    });
});
