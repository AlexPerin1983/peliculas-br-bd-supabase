import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const profiles = [
    {
        id: 'u1', email: 'ana@empresa.test', role: 'user', approved: true, created_at: inDays(-40), organization_id: 'org1',
        empresa: 'Ana Películas', blocked: false,
        subscription: { active_modules: ['pacote_completo'], modules_detail: [{ module_id: 'pacote_completo', expires_at: inDays(5), status: 'active' }] },
    },
    {
        id: 'u2', email: 'bruno@empresa.test', role: 'user', approved: true, created_at: inDays(-10), organization_id: 'org2',
        empresa: 'Bruno Films', blocked: false, subscription: { active_modules: [], modules_detail: [] },
    },
];

const adminUsers = {
    profiles,
    loading: false,
    activatingModule: null,
    revokingModule: null,
    grantingAll: false,
    busyUser: null,
    signupTrial: { enabled: true, days: 7 },
    savingSignupTrial: false,
    saveSignupTrial: vi.fn(),
    feedback: null,
    clearFeedback: vi.fn(),
    fetchProfiles: vi.fn(),
    activateModuleForUser: vi.fn(),
    revokeModuleForUser: vi.fn(),
    grantFullAccessAll: vi.fn(),
    setUserBlocked: vi.fn(),
    deleteUser: vi.fn(),
    isModuleActive: () => false,
    activeGrants: [{ id: 'u1', email: 'ana@empresa.test', modules: ['pacote_completo'], hasFullPackage: true, expiresAt: inDays(5), daysRemaining: 5 }],
};

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ isAdmin: true }) }));
vi.mock('../src/hooks/useAdminUsers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../src/hooks/useAdminUsers')>()),
    useAdminUsers: () => adminUsers,
}));
vi.mock('../src/hooks/useAdminEngagement', () => ({
    useAdminEngagement: () => ({
        rows: [
            { user_id: 'u1', email: 'ana@empresa.test', empresa: 'Ana Películas', telefone: null, created_at: inDays(-40), orcamentos: 12, clientes: 8, agendamentos: 3, servicos: 2, faturamento: 9000, ultima_atividade: inDays(-1) },
        ],
        loading: false,
        error: null,
        fetchEngagement: vi.fn(),
        totals: { orcamentos: 12, clientes: 8, faturamento: 9000, ativos30d: 1, totalUsuarios: 1 },
        activeWindowDays: 30,
    }),
}));
vi.mock('./admin/AdminCompanyDrawer', () => ({ AdminCompanyDrawer: () => null }));

import { AdminUsers } from './AdminUsers';

describe('AdminUsers', () => {
    beforeEach(() => window.localStorage.removeItem('peliculas-br-admin-section-v1'));
    afterEach(() => window.localStorage.removeItem('peliculas-br-admin-section-v1'));

    it('abre na lista de empresas, com os números no topo', () => {
        render(<AdminUsers />);

        expect(screen.getByRole('tab', { name: 'Empresas' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByPlaceholderText('Buscar por empresa ou email…')).toBeInTheDocument();
        expect(screen.getByText('bruno@empresa.test')).toBeInTheDocument();
        expect(screen.getByText('Novas no mês')).toBeInTheDocument();
        expect(screen.queryByText('Regras gerais de acesso')).not.toBeInTheDocument();
        expect(screen.queryByText('Engajamento dos usuários')).not.toBeInTheDocument();
    });

    it('cada aba mostra só a sua seção e nenhuma seção se perde', () => {
        render(<AdminUsers />);

        fireEvent.click(screen.getByRole('tab', { name: /A vencer/ }));
        expect(screen.getByText('Acessos ativos · próximos a vencer')).toBeInTheDocument();
        expect(screen.getByText('5d restantes')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Buscar por empresa ou email…')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Ranking' }));
        expect(screen.getByText('Engajamento dos usuários')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Gráficos' }));
        expect(screen.getByText('Cadastros por mês')).toBeInTheDocument();
        expect(screen.getByText('Saúde da base')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Regras' }));
        expect(screen.getByText('Regras gerais de acesso')).toBeInTheDocument();
        expect(screen.getByText('Teste grátis para quem se cadastra')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Liberar para todas' })).toBeInTheDocument();
    });

    it('lembra a aba escolhida ao voltar para a tela', () => {
        const first = render(<AdminUsers />);
        fireEvent.click(screen.getByRole('tab', { name: 'Regras' }));
        first.unmount();

        render(<AdminUsers />);
        expect(screen.getByRole('tab', { name: 'Regras' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Regras gerais de acesso')).toBeInTheDocument();
    });
});
