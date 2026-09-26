import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProposalPaymentConfig } from '../../types';
import { PaymentSelectionPanel, pickInstallmentRange } from './PaymentSelectionPanel';

const lastMethods = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.lastCall![0].paymentMethods as ProposalPaymentConfig['paymentMethods'];
const methodOf = (onChange: ReturnType<typeof vi.fn>, tipo: string) => lastMethods(onChange).find(method => method.tipo === tipo)!;

describe('pagamento nos totais', () => {
    it('desmarca parcelas da proposta e preserva o cadastro da empresa', () => {
        const companyMethods: ProposalPaymentConfig['paymentMethods'] = [
            { tipo: 'pix', ativo: true, porcentagem: 5 },
            { tipo: 'parcelado_com_juros', ativo: true, parcelas_max: 12, juros: 2 },
        ];
        const config: ProposalPaymentConfig = { paymentMethods: companyMethods.map(method => ({ ...method })), prazoPagamento: '' };
        const onChange = vi.fn();
        render(<PaymentSelectionPanel config={config} companyMethods={companyMethods} onChange={onChange} />);

        expect(screen.getByRole('button', { name: '12x com juros' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: '12x com juros' }));
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            paymentMethods: expect.arrayContaining([expect.objectContaining({
                tipo: 'parcelado_com_juros', selectedInstallments: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            })]),
        }));
        expect(companyMethods[1].selectedInstallments).toBeUndefined();
    });

    it('toque escolhe "até" e o último tocado de novo sai', () => {
        const allowed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        expect(pickInstallmentRange(allowed, allowed, 6)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(pickInstallmentRange(allowed, [1, 2, 3, 4, 5, 6], 10)).toEqual(allowed);
        expect(pickInstallmentRange(allowed, [1, 2, 3, 4, 5, 6], 6)).toEqual([1, 2, 3, 4, 5]);
        // Buracos antigos (sem o 8x) viram faixa no primeiro toque.
        expect(pickInstallmentRange(allowed, [1, 2, 3, 4, 5, 6, 7, 9, 10], 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(pickInstallmentRange([11, 12], [11, 12], 11)).toEqual([11]);
    });

    it('com juros começa depois do sem juros, acompanha a mudança e mostra os valores', () => {
        const companyMethods: ProposalPaymentConfig['paymentMethods'] = [
            { tipo: 'pix', ativo: true, porcentagem: 5 },
            { tipo: 'boleto', ativo: true },
            { tipo: 'parcelado_sem_juros', ativo: true, parcelas_max: 10 },
            { tipo: 'parcelado_com_juros', ativo: true, parcelas_max: 12, juros: 2 },
        ];
        const config: ProposalPaymentConfig = {
            paymentMethods: [
                ...companyMethods.slice(0, 3).map(method => ({ ...method })),
                { ...companyMethods[3], selectedInstallments: [1, 2, 3, 11, 12] },
            ],
            prazoPagamento: '',
        };
        const onChange = vi.fn();
        render(<PaymentSelectionPanel config={config} companyMethods={companyMethods} onChange={onChange} total={365} />);

        // Valores que o cliente vai ver.
        expect(screen.getByRole('button', { name: 'Pix' })).toHaveTextContent(/R\$\s*346,75 \(−5%\)/);
        expect(screen.getByText(/até 10x de R\$\s*36,50/)).toBeInTheDocument();
        expect(screen.getByText(/11x de R\$.*12x de R\$/)).toBeInTheDocument();

        // 1x a 10x com juros ficam bloqueados (já são sem juros).
        const withInterest = screen.getByLabelText('Parcelas Cartão com juros');
        expect(within(withInterest).getByRole('button', { name: '3x com juros (já é sem juros)' })).toBeDisabled();
        expect(within(withInterest).getByRole('button', { name: '3x com juros (já é sem juros)' })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByText('Até 10x já é sem juros; com juros começa em 11x.')).toBeInTheDocument();

        // Sem juros até 6x: o com juros passa a começar em 7x e vai até 12x.
        fireEvent.click(screen.getByRole('button', { name: '6x sem juros' }));
        expect(methodOf(onChange, 'parcelado_sem_juros').selectedInstallments).toEqual([1, 2, 3, 4, 5, 6]);
        expect(methodOf(onChange, 'parcelado_com_juros').selectedInstallments).toEqual([7, 8, 9, 10, 11, 12]);

        // Pix desliga com um toque.
        fireEvent.click(screen.getByRole('button', { name: 'Pix' }));
        expect(methodOf(onChange, 'pix').ativo).toBe(false);
    });
});
