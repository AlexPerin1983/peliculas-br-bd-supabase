import { hasLocalSyncDebt } from '../../services/offlineDb';

export const CANONICAL_APP_HOST = 'app.filmstec.shop';
export const CANONICAL_APP_ORIGIN = `https://${CANONICAL_APP_HOST}`;

interface CanonicalHostDecisionInput {
    hostname: string;
    pathname: string;
    search?: string;
    hasSyncDebt: boolean;
}

const PUBLIC_PATH_PREFIXES = ['/convite/', '/reset-password'];

const normalizeHostname = (hostname: string): string => {
    const normalized = hostname.toLowerCase();

    if (normalized === '::1' || normalized === '[::1]') {
        return '::1';
    }

    return normalized.split(':')[0];
};

export function isProjectAliasHost(hostname: string): boolean {
    const normalizedHostname = normalizeHostname(hostname);

    return normalizedHostname === 'peliculas-br-testes.vercel.app'
        || (
            normalizedHostname.startsWith('peliculas-br-testes-')
            && normalizedHostname.endsWith('.vercel.app')
        );
}

export function isLocalHost(hostname: string): boolean {
    const normalizedHostname = normalizeHostname(hostname);

    return normalizedHostname === 'localhost'
        || normalizedHostname === '127.0.0.1'
        || normalizedHostname === '0.0.0.0'
        || normalizedHostname === '::1';
}

export function isPublicBypassRoute(pathname: string, search = ''): boolean {
    const params = new URLSearchParams(search);
    const isPublicEstoque = params.has('qr') || params.has('code');
    const isPublicServico = params.has('servico') || params.has('s');

    return PUBLIC_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix))
        || isPublicEstoque
        || isPublicServico;
}

export function shouldRedirectToCanonicalHost({
    hostname,
    pathname,
    search = '',
    hasSyncDebt
}: CanonicalHostDecisionInput): boolean {
    const normalizedHostname = normalizeHostname(hostname);

    if (normalizedHostname === CANONICAL_APP_HOST || isLocalHost(normalizedHostname)) {
        return false;
    }

    if (!isProjectAliasHost(normalizedHostname)) {
        return false;
    }

    if (isPublicBypassRoute(pathname, search)) {
        return false;
    }

    return !hasSyncDebt;
}

export function buildCanonicalRedirectUrl(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
    return `${CANONICAL_APP_ORIGIN}${location.pathname}${location.search}${location.hash}`;
}

export async function getCanonicalRedirectUrl(
    location: Pick<Location, 'hostname' | 'pathname' | 'search' | 'hash'> = window.location,
    hasSyncDebt = hasLocalSyncDebt
): Promise<string | null> {
    if (!isProjectAliasHost(location.hostname) || isPublicBypassRoute(location.pathname, location.search)) {
        return null;
    }

    const syncDebt = await hasSyncDebt();
    if (!shouldRedirectToCanonicalHost({
        hostname: location.hostname,
        pathname: location.pathname,
        search: location.search,
        hasSyncDebt: syncDebt
    })) {
        return null;
    }

    return buildCanonicalRedirectUrl(location);
}

export async function redirectToCanonicalHostIfNeeded(
    location: Location = window.location,
    hasSyncDebt = hasLocalSyncDebt
): Promise<boolean> {
    const redirectUrl = await getCanonicalRedirectUrl(location, hasSyncDebt);

    if (!redirectUrl || redirectUrl === location.href) {
        return false;
    }

    location.replace(redirectUrl);
    return true;
}
