import { describe, expect, it } from 'vitest';
import { selectCompanyBranding } from '../../supabase/functions/proposal-portal/companyBranding';

describe('branding de proposta multiempresa', () => {
    it('prioriza a marca do owner da empresa, mesmo quando outro usuario criou o link', () => {
        const branding = selectCompanyBranding(
            { name: 'Empresa do tenant', owner_id: 'owner-1' },
            [
                { user_id: 'creator-1', empresa: 'Conta do colaborador', logo: 'logo-do-criador' },
                { user_id: 'owner-1', empresa: 'Empresa oficial', logo: 'logo-da-empresa' },
            ],
            'creator-1',
        );

        expect(branding.name).toBe('Empresa oficial');
        expect(branding.logo).toBe('logo-da-empresa');
    });

    it('mantem os dados do criador como fallback para portais legados sem cadastro do owner', () => {
        const branding = selectCompanyBranding(
            { name: 'Empresa do tenant', owner_id: 'owner-1' },
            [{ user_id: 'creator-1', empresa: 'Empresa legada', logo: 'logo-legada' }],
            'creator-1',
        );

        expect(branding.name).toBe('Empresa legada');
        expect(branding.logo).toBe('logo-legada');
    });
});
