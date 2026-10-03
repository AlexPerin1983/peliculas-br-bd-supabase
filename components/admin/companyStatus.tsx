import React from 'react';
import { isUserAdmin, UserWithSubscription } from '../../src/hooks/useAdminUsers';

// ============================================================================
// Situação de cada empresa no Admin — uma fonte única de verdade para o
// rótulo, a cor e os filtros da lista. Deriva o estado a partir do que a RPC
// admin_users_overview entrega.
//
// Pago vs cortesia depende da origem dos módulos ativos: payment_provider
// 'manual' (ou referência "ADMIN-*" / "SIGNUP-TRIAL") é cortesia; AbacatePay é
// pagamento real → assinante. "Terminou o teste" depende do flag
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

// Acessos que não vieram de pagamento: liberação do admin (ADMIN-*) e o trial
// automático de cadastro (SIGNUP-TRIAL). Antes o SIGNUP-TRIAL contava como pago.
const isFreeGrantRef = (ref?: string | null) => !!ref && /^(ADMIN|SIGNUP)/i.test(ref);

/** Este acesso ativo foi pago? (null = sem dado para saber) */
const isPaidAccess = (p: UserWithSubscription, moduleId: string): boolean | null => {
    const state = p.subscription?.modules_state?.find(m => m.module_id === moduleId);
    if (state?.payment_provider) return state.payment_provider !== 'manual';
    const detail = p.subscription?.modules_detail?.find(d => d.module_id === moduleId);
    if (detail?.payment_reference == null) return null;
    return !isFreeGrantRef(detail.payment_reference);
};

/** Estado principal (mutuamente exclusivo) de uma empresa. */
export function deriveCompanyStatus(p: UserWithSubscription): CompanyStatusKey {
    if (isUserAdmin(p)) return 'admin';
    if (p.blocked) return 'bloqueado';

    const active = p.subscription?.active_modules || [];
    if (active.length > 0) {
        const paid = active.map(moduleId => isPaidAccess(p, moduleId));
        if (paid.some(v => v === true)) return 'assinante';
        if (paid.some(v => v === false)) return 'cortesia';
        return 'comAcesso'; // fallback enquanto a RPC não expõe a origem do acesso
    }

    if (p.ever_had_access) return 'terminou';
    return 'gratis';
}

// ---- Acesso por módulo (detalhe da empresa) ---------------------------------

export type ModuleAccessKind =
    | 'active'    // liberado e valendo
    | 'included'  // coberto pelo Pacote Completo
    | 'pending'   // começou a pagar e não terminou
    | 'expired'   // venceu
    | 'cancelled' // cancelado / removido
    | 'none';     // nunca teve

export interface ModuleAccess {
    kind: ModuleAccessKind;
    expiresAt: string | null;
    daysLeft: number | null;
    /** Só para kind 'active': veio de pagamento? */
    paid: boolean;
}

const daysFromNow = (iso: string | null | undefined) =>
    iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000) : null;

export function getModuleAccess(p: UserWithSubscription, moduleId: string): ModuleAccess {
    const active = p.subscription?.active_modules || [];
    if (active.includes(moduleId)) {
        const expiresAt = p.subscription?.modules_detail
            ?.filter(d => d.module_id === moduleId && d.expires_at)
            .map(d => d.expires_at)
            .sort()
            .pop() ?? null;
        return { kind: 'active', expiresAt, daysLeft: daysFromNow(expiresAt), paid: isPaidAccess(p, moduleId) === true };
    }
    if (moduleId !== 'pacote_completo' && active.includes('pacote_completo')) {
        return { kind: 'included', expiresAt: null, daysLeft: null, paid: false };
    }
    const state = p.subscription?.modules_state?.find(m => m.module_id === moduleId);
    const kind: ModuleAccessKind =
        state?.status === 'pending' ? 'pending'
            : state?.status === 'expired' || state?.status === 'active' ? 'expired'
                : state?.status === 'cancelled' ? 'cancelled'
                    : 'none';
    return { kind, expiresAt: state?.expires_at ?? null, daysLeft: null, paid: false };
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

/** Frase curta com a situação da empresa, para o topo do detalhe. */
export function describeAccess(p: UserWithSubscription): string {
    const status = deriveCompanyStatus(p);
    const soonest = daysUntilExpiry(p);
    const until = soonest === null ? '' : soonest <= 0 ? ' · vence hoje' : ` · ${soonest} dia(s) restantes`;
    switch (status) {
        case 'admin': return 'Administrador — acesso a tudo.';
        case 'bloqueado': return 'Conta bloqueada — não consegue entrar.';
        case 'assinante': return 'Assinante (pagando). Veja abaixo o que está ativo.';
        case 'cortesia': return `Acesso liberado por nós (cortesia)${until}.`;
        case 'comAcesso': return `Com acesso${until}.`;
        case 'terminou': {
            const ended = (p.subscription?.modules_state || [])
                .filter(m => m.status === 'expired' && m.expires_at)
                .map(m => m.expires_at as string)
                .sort()
                .pop();
            return ended
                ? `Plano grátis — o acesso acabou em ${shortDate(ended)}.`
                : 'Plano grátis — o acesso de teste acabou.';
        }
        default: return 'Plano grátis — nunca teve acesso liberado.';
    }
}

/** Módulos que a empresa começou a pagar e não concluiu. */
export function pendingPayments(p: UserWithSubscription): string[] {
    return (p.subscription?.modules_state || [])
        .filter(m => m.status === 'pending')
        .map(m => m.module_id);
}

/** Vencimento de cada módulo ativo. "+dias" cria outra ativação por cima,
 *  então vale a que vence por último. */
export function moduleExpiries(details: Array<{ module_id: string; expires_at: string | null }>): Map<string, number> {
    const byModule = new Map<string, number>();
    for (const d of details) {
        if (!d.expires_at) continue;
        const t = new Date(d.expires_at).getTime();
        byModule.set(d.module_id, Math.max(byModule.get(d.module_id) ?? 0, t));
    }
    return byModule;
}

/** Dias até o vencimento mais próximo entre os módulos ativos (ou null). */
export function daysUntilExpiry(p: UserWithSubscription): number | null {
    const expiries = [...moduleExpiries(p.subscription?.modules_detail || []).values()];
    if (!expiries.length) return null;
    return Math.ceil((Math.min(...expiries) - Date.now()) / 86_400_000);
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
