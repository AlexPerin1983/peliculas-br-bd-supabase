import { describe, expect, it } from 'vitest';
import { UserWithSubscription } from '../../src/hooks/useAdminUsers';
import { describeAccess, deriveCompanyStatus, getModuleAccess, pendingPayments } from './companyStatus';

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const company = (subscription: UserWithSubscription['subscription'], extra: Partial<UserWithSubscription> = {}): UserWithSubscription => ({
    id: 'u1',
    email: 'empresa@teste.com',
    role: 'user',
    approved: true,
    subscription,
    ...extra,
} as UserWithSubscription);

describe('deriveCompanyStatus', () => {
    it('trata o teste grátis de cadastro como cortesia, não como assinante', () => {
        const p = company({
            active_modules: ['pacote_completo'],
            modules_detail: [{ module_id: 'pacote_completo', status: 'active', expires_at: inDays(5), payment_reference: 'SIGNUP-TRIAL' }],
        });
        expect(deriveCompanyStatus(p)).toBe('cortesia');
    });

    it('usa a origem do pagamento quando a RPC informa', () => {
        const p = company({
            active_modules: ['estoque'],
            modules_detail: [{ module_id: 'estoque', status: 'active', expires_at: inDays(90), payment_reference: 'pay_123' }],
            modules_state: [{ module_id: 'estoque', status: 'active', expires_at: inDays(90), payment_provider: 'abacatepay' }],
        });
        expect(deriveCompanyStatus(p)).toBe('assinante');
    });

    it('marca "terminou" quem teve acesso e hoje não tem nada', () => {
        const p = company({ active_modules: [], modules_detail: [] }, { ever_had_access: true });
        expect(deriveCompanyStatus(p)).toBe('terminou');
    });
});

describe('getModuleAccess', () => {
    // Caso real: teste do Pacote Completo vencido + checkouts não pagos.
    const expiredTrial = company({
        active_modules: [],
        modules_detail: [],
        modules_state: [
            { module_id: 'pacote_completo', status: 'expired', expires_at: '2026-08-09T15:00:00Z', payment_provider: 'manual' },
            { module_id: 'estoque', status: 'pending', expires_at: null, payment_provider: 'abacatepay' },
        ],
    }, { ever_had_access: true });

    it('mostra módulo nunca liberado como sem acesso', () => {
        expect(getModuleAccess(expiredTrial, 'ia_ocr').kind).toBe('none');
    });

    it('mostra vencido e pagamento pendente', () => {
        expect(getModuleAccess(expiredTrial, 'pacote_completo')).toMatchObject({ kind: 'expired', expiresAt: '2026-08-09T15:00:00Z' });
        expect(getModuleAccess(expiredTrial, 'estoque').kind).toBe('pending');
        expect(pendingPayments(expiredTrial)).toEqual(['estoque']);
    });

    it('resume a situação em uma frase', () => {
        expect(describeAccess(expiredTrial)).toContain('o acesso acabou em 09/08');
    });

    it('mostra ativo com dias restantes e marca módulos cobertos pelo pacote', () => {
        const p = company({
            active_modules: ['pacote_completo'],
            modules_detail: [{ module_id: 'pacote_completo', status: 'active', expires_at: inDays(10), payment_reference: 'ADMIN-TRIAL' }],
            modules_state: [{ module_id: 'pacote_completo', status: 'active', expires_at: inDays(10), payment_provider: 'manual' }],
        });
        expect(getModuleAccess(p, 'pacote_completo')).toMatchObject({ kind: 'active', daysLeft: 10, paid: false });
        expect(getModuleAccess(p, 'ia_ocr').kind).toBe('included');
    });
});
