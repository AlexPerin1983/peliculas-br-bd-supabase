import { describe, expect, it } from 'vitest';
import {
    buildCanonicalRedirectUrl,
    isPublicBypassRoute,
    shouldRedirectToCanonicalHost
} from './canonicalHost';

describe('canonicalHost', () => {
    it('redireciona alias da Vercel para o dominio canonico quando nao ha pendencia local', () => {
        expect(shouldRedirectToCanonicalHost({
            hostname: 'peliculas-br-testes.vercel.app',
            pathname: '/',
            search: '',
            hasSyncDebt: false
        })).toBe(true);
    });

    it('mantem o alias quando existe fila ou erro local para sincronizar', () => {
        expect(shouldRedirectToCanonicalHost({
            hostname: 'peliculas-br-testes.vercel.app',
            pathname: '/',
            search: '',
            hasSyncDebt: true
        })).toBe(false);
    });

    it('nao redireciona rotas publicas de QR, servico, convite ou reset', () => {
        expect(isPublicBypassRoute('/', '?qr=abc')).toBe(true);
        expect(isPublicBypassRoute('/', '?servico=abc')).toBe(true);
        expect(isPublicBypassRoute('/convite/abc')).toBe(true);
        expect(isPublicBypassRoute('/reset-password')).toBe(true);
    });

    it('preserva caminho, query string e hash ao montar URL canonica', () => {
        expect(buildCanonicalRedirectUrl({
            pathname: '/dashboard',
            search: '?aba=orcamentos',
            hash: '#recentes'
        })).toBe('https://app.filmstec.shop/dashboard?aba=orcamentos#recentes');
    });
});
