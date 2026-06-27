import React from 'react';
import { isUserAdmin, UserWithSubscription } from '../../src/hooks/useAdminUsers';

// ============================================================================
// Situação de cada empresa no Admin — uma fonte única de verdade para o
// rótulo, a cor e os filtros da lista. Deriva o estado a partir do que a RPC
// admin_users_overview entrega.
//
// Pago vs cortesia depende do payment_reference dos módulos ativos: grants do
// admin usam "ADMIN-*" (PROMO/MANUAL/TRIAL); qualquer outra referência é
// pagamento real (AbacatePay) → assinante. "Terminou o teste" depende do flag
// ever_had_access (já teve algum módulo, mas hoje não tem nenhum ativo).
//
// Os dois campos (payment_reference, ever_had_access) são opcionais: enquanto a
// migration nova não é aplicada, caímos num rótulo neutro "Com acesso" e quem
// está sem acesso vira "Grátis" — o painel já funciona, só fica menos preciso.
// ============================================================================

export type CompanyStatusKey =
    | 'admin'
    | 'bloqueado'
    | 'assinante'
    | 'cortesia'
    | 'comAcesso'
    | 'terminou'
    | 'gratis';

export interface CompanyStatusMeta {
    label: string;
    /** classes do "pill" (fundo + texto), claro e escuro */
    badge: string;
    /** cor do ponto/realce */
    dot: string;
}

export const STATUS_META: Record<CompanyStatusKey, CompanyStatusMeta> = {
    admin: {
        label: 'Admin',
        badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
        dot: 'bg-purple-500',
    },
    bloqueado: {
        label: 'Bloqueado',
        badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        dot: 'bg-red-500',
    },
    assinante: {
        label: 'Assinante',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        dot: 'bg-emerald-500',
    },
    cortesia: {
        label: 'Cortesia',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        dot: 'bg-amber-500',
    },
    comAcesso: {
        label: 'Com acesso',
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        dot: 'bg-blue-500',
    },
    terminou: {
        label: 'Terminou o teste',
        badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
        dot: 'bg-orange-500',
    },
    gratis: {
        label: 'Grátis',
        badge: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
        dot: 'bg-slate-400',
    },
};

const isAdminRef = (ref?: string | null) => !!ref && /^ADMIN/i.test(ref);

/** Estado principal (mutuamente exclusivo) de uma empresa. */
export function deriveCompanyStatus(p: UserWithSubscription): CompanyStatusKey {
    if (isUserAdmin(p)) return 'admin';
    if (p.blocked) return 'bloqueado';

    const active = p.subscription?.active_modules || [];
    if (active.length > 0) {
        const details = p.subscription?.modules_detail || [];
        const paymentKnown = details.some(d => d.payment_reference != null);
        if (paymentKnown) {
            const anyPaid = details.some(d => d.payment_reference && !isAdminRef(d.payment_reference));
            return anyPaid ? 'assinante' : 'cortesia';
        }
        return 'comAcesso'; // fallback enquanto a RPC não expõe payment_reference
    }

    if (p.ever_had_access) return 'terminou';
    return 'gratis';
}

/** Dias até o vencimento mais próximo entre os módulos ativos (ou null). */
export function daysUntilExpiry(p: UserWithSubscription): number | null {
    const soonest = (p.subscription?.modules_detail || [])
        .filter(d => d.expires_at)
        .map(d => new Date(d.expires_at).getTime())
        .sort((a, b) => a - b)[0];
    if (!soonest) return null;
    return Math.ceil((soonest - Date.now()) / 86_400_000);
}

export const CompanyStatusBadge: React.FC<{ status: CompanyStatusKey; className?: string }> = ({ status, className = '' }) => {
    const meta = STATUS_META[status];
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.badge} ${className}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
        </span>
    );
};

// ---- Filtros da lista -------------------------------------------------------

export type CompanyFilterKey =
    | 'todas'
    | 'comAcessoGroup' // assinante + cortesia + comAcesso (qualquer acesso ativo)
    | CompanyStatusKey
    | 'inativas'
    | 'teste';

export interface CompanyFlags {
    status: CompanyStatusKey;
    inactive: boolean; // sem atividade recente (e não-admin)
    test: boolean;
}

/** Um filtro casa com a empresa? (status + recortes de atividade/teste) */
export function matchesFilter(key: CompanyFilterKey, flags: CompanyFlags): boolean {
    switch (key) {
        case 'todas': return true;
        case 'comAcessoGroup':
            return flags.status === 'assinante' || flags.status === 'cortesia' || flags.status === 'comAcesso';
        case 'inativas': return flags.inactive;
        case 'teste': return flags.test;
        default: return flags.status === key;
    }
}
