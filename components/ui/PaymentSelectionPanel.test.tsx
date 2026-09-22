import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProposalPaymentConfig } from '../../types';
import { PaymentSelectionPanel } from './PaymentSelectionPanel';

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
});
