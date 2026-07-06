import React from 'react';
import { BarChart3, Building2, ChevronRight, Clock, Crown, KeyRound, LayoutDashboard, Moon, Search, Shield, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ActionButton from './ui/ActionButton';
import ContentState from './ui/ContentState';
import DatePeriodFilter, { DatePeriodValue, getDatePeriodLabel, resolveDatePeriod } from './ui/DatePeriodFilter';
import { AdminUserEngagement } from './AdminUserEngagement';
import { AdminOverview } from './admin/AdminOverview';
import { AdminCompanyDrawer } from './admin/AdminCompanyDrawer';
import { isTestAccount, isUserAdmin, useAdminUsers } from '../src/hooks/useAdminUsers';
import { useAdminEngagement } from '../src/hooks/useAdminEngagement';
import { formatInt, relativeDays } from './admin/adminFormat';
import {
    CompanyStatusBadge,
    CompanyFilterKey,
    CompanyFlags,
    deriveCompanyStatus,
    daysUntilExpiry,
    matchesFilter,
} from './admin/companyStatus';

type AdminTabKey = 'overview' | 'empresas' | 'engajamento' | 'acessos';

export const AdminUsers: React.FC = () => {
    const { isAdmin } = useAuth();
    const {
        profiles,
        loading,
        activatingModule,
        grantingAll,
        busyUser,
        signupTrial,
        savingSignupTrial,
        saveSignupTrial,
        feedback,
        fetchProfiles,
        activateModuleForUser,
        grantFullAccessAll,
        setUserBlocked,
        deleteUser,
        getModuleExpiryDays,
        isModuleActive,
        activeGrants,
    } = useAdminUsers(isAdmin);

    const { rows: engagementRows, loading: engLoading, error: engError, fetchEngagement, activeWindowDays } = useAdminEngagement(isAdmin);

    const [activeTab, setActiveTab] = React.useState<AdminTabKey>('overview');
    const [period, setPeriod] = React.useState<DatePeriodValue>({ key: 'month' });
    const [accessDays, setAccessDays] = React.useState(30);
    const [trialDays, setTrialDays] = React.useState(7);
    const [onlyTests, setOnlyTests] = React.useState(false);
    const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState('');
    const [filterKey, setFilterKey] = React.useState<CompanyFilterKey>('todas');
    const [sortKey, setSortKey] = React.useState<'recentes' | 'orcamentos' | 'faturamento' | 'atividade' | 'az'>('recentes');
    const [visibleCount, setVisibleCount] = React.useState(20);

    const trialUserIds = React.useMemo(() => new Set(activeGrants.map(g => g.id)), [activeGrants]);
    const engagementMap = React.useMemo(() => new Map(engagementRows.map(r => [r.user_id, r])), [engagementRows]);

    const periodRange = React.useMemo(() => resolveDatePeriod(period), [period]);
    const periodProfiles = React.useMemo(() => {
        if (!periodRange) return profiles;
        return profiles.filter(profile => {
            if (!profile.created_at) return false;
            const createdAt = new Date(profile.created_at);
            return !Number.isNaN(createdAt.getTime()) && createdAt >= periodRange.start && createdAt <= periodRange.end;
        });
    }, [profiles, periodRange]);
    const periodProfileIds = React.useMemo(
        () => new Set(periodProfiles.filter(profile => !isUserAdmin(profile)).map(profile => profile.id)),
        [periodProfiles],
    );
    const periodEngagementRows = React.useMemo(
        () => engagementRows.filter(row => periodProfileIds.has(row.user_id)),
        [engagementRows, periodProfileIds],
    );
    const periodTrialUserIds = React.useMemo(
        () => new Set([...trialUserIds].filter(id => periodProfileIds.has(id))),
        [trialUserIds, periodProfileIds],
    );
    const periodTotals = React.useMemo(() => {
        const cutoff = Date.now() - activeWindowDays * 86_400_000;
        return periodEngagementRows.reduce(
            (summary, row) => {
                summary.orcamentos += row.orcamentos;
                summary.clientes += row.clientes;
                summary.faturamento += row.faturamento;
                if (row.ultima_atividade && new Date(row.ultima_atividade).getTime() >= cutoff) summary.ativos30d += 1;
                summary.totalUsuarios += 1;
                return summary;
            },
            { orcamentos: 0, clientes: 0, faturamento: 0, ativos30d: 0, totalUsuarios: 0 },
        );
    }, [periodEngagementRows, activeWindowDays]);

    const selectedProfile = selectedUserId ? profiles.find(p => p.id === selectedUserId) ?? null : null;

    const isRecent = React.useCallback((iso: string | null | undefined) => {
        if (!iso) return false;
        return (Date.now() - new Date(iso).getTime()) / 86_400_000 <= activeWindowDays;
    }, [activeWindowDays]);

    // Situação (status + recortes de atividade/teste) de cada empresa.
    const flagsByProfile = React.useMemo(() => {
        const map = new Map<string, CompanyFlags>();
        for (const p of profiles) {
            const eng = engagementMap.get(p.id);
            map.set(p.id, {
                status: deriveCompanyStatus(p),
                inactive: !isUserAdmin(p) && !p.blocked && !isRecent(eng?.ultima_atividade),
                test: isTestAccount(p),
            });
        }
        return map;
    }, [profiles, engagementMap, isRecent]);

    // Base = só busca + "contas de teste" (antes do filtro de status), para as
    // contagens dos chips refletirem o contexto da busca atual.
    const baseList = React.useMemo(() => {
        let list = onlyTests ? periodProfiles.filter(isTestAccount) : periodProfiles;
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter(p =>
                (p.empresa || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q));
        }
        return list;
    }, [periodProfiles, onlyTests, search]);

    // Contagem por filtro (para mostrar nos chips e esconder os vazios).
    const counts = React.useMemo(() => {
        const c: Record<CompanyFilterKey, number> = {
            todas: baseList.length,
            comAcessoGroup: 0, assinante: 0, cortesia: 0, comAcesso: 0,
            terminou: 0, gratis: 0, bloqueado: 0, admin: 0, inativas: 0, teste: 0,
        };
        for (const p of baseList) {
            const f = flagsByProfile.get(p.id);
            if (!f) continue;
            c[f.status] += 1;
            if (f.status === 'assinante' || f.status === 'cortesia' || f.status === 'comAcesso') c.comAcessoGroup += 1;
            if (f.inactive) c.inativas += 1;
            if (f.test) c.teste += 1;
        }
        return c;
    }, [baseList, flagsByProfile]);

    // Lista final: aplica o filtro de status escolhido + ordenação.
    const filteredCompanies = React.useMemo(() => {
        const list = baseList.filter(p => {
            const f = flagsByProfile.get(p.id);
            return f ? matchesFilter(filterKey, f) : false;
        });
        return [...list].sort((a, b) => {
            const ea = engagementMap.get(a.id);
            const eb = engagementMap.get(b.id);
            switch (sortKey) {
                case 'orcamentos': return (eb?.orcamentos || 0) - (ea?.orcamentos || 0);
                case 'faturamento': return (eb?.faturamento || 0) - (ea?.faturamento || 0);
                case 'atividade': return new Date(eb?.ultima_atividade || 0).getTime() - new Date(ea?.ultima_atividade || 0).getTime();
                case 'az': return (a.empresa || a.email || '').localeCompare(b.empresa || b.email || '');
                case 'recentes':
                default: return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
            }
        });
    }, [baseList, flagsByProfile, filterKey, sortKey, engagementMap]);

    const visibleCompanies = filteredCompanies.slice(0, visibleCount);

    // Reseta a paginação quando os critérios mudam
    React.useEffect(() => { setVisibleCount(20); }, [search, filterKey, sortKey, onlyTests, period]);

    // Sincroniza o input de dias do trial quando a config carrega do banco
    React.useEffect(() => {
        if (signupTrial.days > 0) setTrialDays(signupTrial.days);
    }, [signupTrial.days]);

    const handleGrantAll = () => {
        if (window.confirm(`Liberar o Pacote Completo por ${accessDays} dia(s) para TODAS as organizações? Isso libera todos os módulos para todos os usuários.`)) {
            grantFullAccessAll(accessDays);
        }
    };

    const handleToggleTrial = () => saveSignupTrial(!signupTrial.enabled, trialDays);
    const handleSaveTrialDays = () => saveSignupTrial(signupTrial.enabled, trialDays);

    if (!isAdmin) return null;

    const allCompaniesCount = profiles.filter(p => !isUserAdmin(p)).length;
    const companiesCount = periodProfiles.filter(p => !isUserAdmin(p)).length;

    const tabs: { key: AdminTabKey; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
        { key: 'overview', label: 'Visão geral', icon: LayoutDashboard },
        { key: 'empresas', label: 'Empresas', icon: Building2, badge: companiesCount },
        { key: 'engajamento', label: 'Engajamento', icon: BarChart3 },
        { key: 'acessos', label: 'Acessos & Trial', icon: KeyRound, badge: activeGrants.length },
    ];

    return (
        <div className="space-y-4">
            {/* Navegação por abas — cada assunto na sua tela, sem empilhar tudo */}
            <div className="-mx-1 overflow-x-auto px-1 scrollbar-hide">
                <div className="inline-flex min-w-full gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-800 sm:min-w-0">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveTab(tab.key)}
                                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors sm:px-4 ${active
                                    ? 'bg-blue-500 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                                {typeof tab.badge === 'number' && tab.badge > 0 && (
                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none ${active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {activeTab !== 'acessos' ? (
                <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Período de cadastro</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Métricas e empresas cadastradas em {getDatePeriodLabel(period).toLowerCase()}.</p>
                    </div>
                    <DatePeriodFilter value={period} onChange={setPeriod} className="w-full sm:w-auto" />
                </div>
            ) : null}

            {feedback && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${feedback.type === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300'
                    : 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-300'
                    }`}>
                    {feedback.message}
                </div>
            )}

            {/* ── Visão geral ─────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
                <AdminOverview
                    profiles={periodProfiles}
                    allCompaniesCount={allCompaniesCount}
                    periodLabel={getDatePeriodLabel(period)}
                    engagementRows={periodEngagementRows}
                    trialUserIds={periodTrialUserIds}
                    totals={periodTotals}
                    activeWindowDays={activeWindowDays}
                />
            )}

            {/* ── Empresas ────────────────────────────────────────────────── */}
            {activeTab === 'empresas' && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="border-b border-slate-200 p-4 dark:border-slate-700 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                Empresas <span className="text-sm font-normal text-slate-400">({filteredCompanies.length})</span>
                            </h3>
                            <div className="flex items-center gap-3">
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                    <input type="checkbox" checked={onlyTests} onChange={(e) => setOnlyTests(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                                    Só contas de teste
                                </label>
                                <ActionButton variant="secondary" size="sm" iconClassName="fas fa-rotate-right" onClick={fetchProfiles}>
                                    Atualizar Lista
                                </ActionButton>
                            </div>
                        </div>

                        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
                            {/* Busca */}
                            <div className="relative flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar por empresa ou email…"
                                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                />
                            </div>
                            {/* Ordenação */}
                            <select
                                value={sortKey}
                                onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                            >
                                <option value="recentes">Mais recentes</option>
                                <option value="orcamentos">Mais orçamentos</option>
                                <option value="faturamento">Maior faturamento</option>
                                <option value="atividade">Última atividade</option>
                                <option value="az">A–Z</option>
                            </select>
                        </div>

                        {/* Filtros rápidos com contagem (esconde os vazios) */}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {([
                                ['todas', 'Todas'],
                                ['comAcessoGroup', 'Acesso ativo'],
                                ['assinante', 'Assinantes'],
                                ['cortesia', 'Cortesia'],
                                ['comAcesso', 'Com acesso'],
                                ['terminou', 'Terminou teste'],
                                ['gratis', 'Grátis'],
                                ['inativas', 'Inativas'],
                                ['bloqueado', 'Bloqueadas'],
                                ['teste', 'Teste'],
                            ] as [CompanyFilterKey, string][])
                                // "Com acesso (grupo)" só aparece quando há mistura de assinante+cortesia;
                                // o "Com acesso" simples cobre o estado pré-migration (sem dado de pagamento).
                                .filter(([key]) => {
                                    if (key === 'todas') return true;
                                    if (key === 'comAcessoGroup') return counts.assinante > 0 && counts.cortesia > 0;
                                    return counts[key] > 0;
                                })
                                .map(([key, label]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setFilterKey(key)}
                                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterKey === key
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                            }`}
                                    >
                                        {label}
                                        <span className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${filterKey === key ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-600 dark:text-slate-300'}`}>
                                            {counts[key]}
                                        </span>
                                    </button>
                                ))}
                        </div>
                    </div>

                    {loading ? (
                        <ContentState compact iconClassName="fas fa-users" title="Carregando usuarios" description="Buscando perfis e acessos." />
                    ) : filteredCompanies.length === 0 ? (
                        <ContentState
                            compact
                            iconClassName="fas fa-users-slash"
                            title={search || filterKey !== 'todas' ? 'Nenhuma empresa encontrada' : onlyTests ? 'Nenhuma conta de teste' : 'Nenhum usuario ainda'}
                            description={search || filterKey !== 'todas' ? 'Ajuste a busca ou os filtros.' : onlyTests ? 'Não há contas de teste (emails com +, demo ou @example.com).' : 'Os usuarios cadastrados aparecem aqui.'}
                        />
                    ) : (
                        <>
                            {/* Desktop: tabela com colunas alinhadas */}
                            <table className="hidden w-full lg:table">
                                <thead>
                                    <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700">
                                        <th className="px-5 py-2.5 font-semibold">Empresa</th>
                                        <th className="px-3 py-2.5 font-semibold">Situação</th>
                                        <th className="px-3 py-2.5 font-semibold">Cadastro</th>
                                        <th className="px-3 py-2.5 text-right font-semibold">Orçamentos</th>
                                        <th className="px-3 py-2.5 font-semibold">Última atividade</th>
                                        <th className="px-3 py-2.5 font-semibold">Acesso</th>
                                        <th className="w-10" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {visibleCompanies.map(profile => {
                                        const eng = engagementMap.get(profile.id);
                                        const flags = flagsByProfile.get(profile.id);
                                        const status = flags?.status ?? deriveCompanyStatus(profile);
                                        const isProfileAdmin = status === 'admin';
                                        const hasFullPackage = isModuleActive(profile, 'pacote_completo');
                                        const hasAccess = status === 'assinante' || status === 'cortesia' || status === 'comAcesso';
                                        const expiry = hasAccess ? daysUntilExpiry(profile) : null;
                                        const avatarBg = status === 'admin' ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                                            : status === 'bloqueado' ? 'bg-red-400 dark:bg-red-500/70'
                                            : status === 'assinante' ? 'bg-gradient-to-br from-emerald-400 to-green-600'
                                            : hasAccess ? 'bg-gradient-to-br from-amber-400 to-yellow-500'
                                            : 'bg-slate-300 dark:bg-slate-600';
                                        return (
                                            <tr
                                                key={profile.id}
                                                onClick={() => setSelectedUserId(profile.id)}
                                                className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40"
                                            >
                                                <td className="px-5 py-3">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${avatarBg}`}>
                                                            {isProfileAdmin ? <Shield className="h-4 w-4 text-white" /> : hasFullPackage ? <Crown className="h-4 w-4 text-white" /> : <span className="text-sm font-bold text-white">{(eng?.empresa || profile.email)?.charAt(0).toUpperCase()}</span>}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="truncate font-medium text-slate-900 dark:text-white">{eng?.empresa || profile.email}</div>
                                                            {eng?.empresa && <div className="truncate text-xs text-slate-400">{profile.email}</div>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <CompanyStatusBadge status={status} />
                                                        {flags?.inactive && (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                                                                <Moon className="h-2.5 w-2.5" /> Inativo
                                                            </span>
                                                        )}
                                                        {flags?.test && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">Teste</span>}
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-500">
                                                    {profile.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '—'}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-3 text-right text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                                                    {formatInt(eng?.orcamentos || 0)}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-500">
                                                    {relativeDays(eng?.ultima_atividade)}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-3">
                                                    {expiry !== null ? (
                                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${expiry <= 7
                                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                            }`}>
                                                            {expiry > 0 ? `${expiry}d restantes` : 'vence hoje'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm text-slate-300 dark:text-slate-600">—</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Mobile: cartões compactos */}
                            <div className="divide-y divide-slate-200 dark:divide-slate-700 lg:hidden">
                                {visibleCompanies.map(profile => {
                                    const eng = engagementMap.get(profile.id);
                                    const flags = flagsByProfile.get(profile.id);
                                    const status = flags?.status ?? deriveCompanyStatus(profile);
                                    const isProfileAdmin = status === 'admin';
                                    const hasFullPackage = isModuleActive(profile, 'pacote_completo');
                                    const hasAccess = status === 'assinante' || status === 'cortesia' || status === 'comAcesso';
                                    const expiry = hasAccess ? daysUntilExpiry(profile) : null;
                                    const avatarBg = status === 'admin' ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                                        : status === 'bloqueado' ? 'bg-red-400 dark:bg-red-500/70'
                                        : status === 'assinante' ? 'bg-gradient-to-br from-emerald-400 to-green-600'
                                        : hasAccess ? 'bg-gradient-to-br from-amber-400 to-yellow-500'
                                        : 'bg-slate-300 dark:bg-slate-600';
                                    return (
                                        <button
                                            key={profile.id}
                                            type="button"
                                            onClick={() => setSelectedUserId(profile.id)}
                                            className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                        >
                                            <div className="flex min-w-0 items-center gap-4">
                                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${avatarBg}`}>
                                                    {isProfileAdmin ? <Shield className="h-5 w-5 text-white" /> : hasFullPackage ? <Crown className="h-5 w-5 text-white" /> : <span className="text-sm font-bold text-white">{(eng?.empresa || profile.email)?.charAt(0).toUpperCase()}</span>}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="truncate font-medium text-slate-900 dark:text-white">{eng?.empresa || profile.email}</span>
                                                        <CompanyStatusBadge status={status} />
                                                        {flags?.inactive && (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                                                                <Moon className="h-2.5 w-2.5" /> Inativo
                                                            </span>
                                                        )}
                                                        {flags?.test && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">Teste</span>}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-500">
                                                        {eng?.empresa && <span className="truncate text-xs text-slate-400">{profile.email}</span>}
                                                        <span className="text-xs">{profile.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '—'}</span>
                                                        {eng && <span className="text-xs text-blue-500">• {eng.orcamentos} orç.</span>}
                                                        {expiry !== null && (
                                                            <span className={`text-xs font-medium ${expiry <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                                                                • {expiry > 0 ? `${expiry}d restantes` : 'vence hoje'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" />
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {!loading && filteredCompanies.length > visibleCount && (
                        <div className="border-t border-slate-200 p-3 text-center dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => setVisibleCount(c => c + 20)}
                                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                            >
                                Carregar mais ({filteredCompanies.length - visibleCount} restantes)
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Engajamento ─────────────────────────────────────────────── */}
            {activeTab === 'engajamento' && (
                <AdminUserEngagement
                    rows={periodEngagementRows}
                    loading={engLoading}
                    error={engError}
                    fetchEngagement={fetchEngagement}
                    onSelectCompany={setSelectedUserId}
                />
            )}

            {/* ── Acessos & Trial ─────────────────────────────────────────── */}
            {activeTab === 'acessos' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {/* Liberar acesso por X dias */}
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                            <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
                                <Zap className="h-4 w-4 text-blue-500" /> Liberar acesso por período
                            </h3>
                            <p className="mt-1 hidden text-sm text-slate-500 sm:block">
                                Define a duração em dias. Vale para os botões de ativação por empresa (no detalhe) e para a liberação geral. A revogação é automática no vencimento.
                            </p>
                            <div className="mt-3 flex items-end gap-3">
                                <label className="text-sm">
                                    <span className="mb-1 block text-slate-500">Dias</span>
                                    <input
                                        type="number"
                                        min={1}
                                        value={accessDays}
                                        onChange={(e) => setAccessDays(Math.max(1, Number(e.target.value) || 1))}
                                        className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                    />
                                </label>
                                <ActionButton
                                    variant="primary"
                                    size="sm"
                                    iconClassName="fas fa-bolt"
                                    loading={grantingAll}
                                    loadingText="Liberando..."
                                    onClick={handleGrantAll}
                                >
                                    Liberar tudo para todos
                                </ActionButton>
                            </div>
                        </div>

                        {/* Trial automático para novos cadastros */}
                        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
                            <h3 className="flex flex-wrap items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
                                <Clock className="h-4 w-4 text-violet-500" /> Trial automático para novos cadastros
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${signupTrial.enabled
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                    }`}>
                                    {signupTrial.enabled ? `Ligado · ${signupTrial.days}d` : 'Desligado'}
                                </span>
                            </h3>
                            <p className="mt-1 hidden text-sm text-slate-500 sm:block">
                                Quando ligado, todo novo cadastro ganha o Pacote Completo por X dias automaticamente. No vencimento, volta para o plano grátis.
                            </p>
                            <div className="mt-3 flex flex-wrap items-end gap-3">
                                <label className="text-sm">
                                    <span className="mb-1 block text-slate-500">Dias</span>
                                    <input
                                        type="number"
                                        min={1}
                                        value={trialDays}
                                        onChange={(e) => setTrialDays(Math.max(1, Number(e.target.value) || 1))}
                                        className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                    />
                                </label>
                                {signupTrial.enabled && signupTrial.days !== trialDays && (
                                    <ActionButton variant="secondary" size="sm" loading={savingSignupTrial} loadingText="Salvando..." onClick={handleSaveTrialDays}>
                                        Salvar dias
                                    </ActionButton>
                                )}
                                <ActionButton
                                    variant={signupTrial.enabled ? 'secondary' : 'primary'}
                                    size="sm"
                                    iconClassName={signupTrial.enabled ? 'fas fa-toggle-off' : 'fas fa-toggle-on'}
                                    loading={savingSignupTrial}
                                    loadingText="Salvando..."
                                    onClick={handleToggleTrial}
                                >
                                    {signupTrial.enabled ? 'Desligar trial' : 'Ligar trial'}
                                </ActionButton>
                            </div>
                        </div>
                    </div>

                    {/* Acompanhamento de acessos liberados */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                        <div className="flex items-center gap-2 border-b border-slate-200 p-4 dark:border-slate-700">
                            <Clock className="h-4 w-4 text-slate-500" />
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                                Acessos liberados <span className="text-sm font-normal text-slate-400">({activeGrants.length})</span>
                            </h3>
                        </div>
                        {activeGrants.length === 0 ? (
                            <ContentState compact iconClassName="fas fa-key" title="Nenhum acesso liberado" description="Quando você liberar módulos por período, o acompanhamento aparece aqui." />
                        ) : (
                            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                                {activeGrants.map(grant => {
                                    const expiringSoon = grant.daysRemaining !== null && grant.daysRemaining <= 7;
                                    return (
                                        <button
                                            key={grant.id}
                                            type="button"
                                            onClick={() => setSelectedUserId(grant.id)}
                                            className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-blue-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500/50 dark:hover:bg-slate-700/40"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="min-w-0 truncate text-sm font-medium text-slate-900 dark:text-white">{grant.email}</span>
                                                {grant.daysRemaining !== null && (
                                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${expiringSoon
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        }`}>
                                                        {grant.daysRemaining}d
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {grant.hasFullPackage ? 'Pacote Completo' : `${grant.moduleCount} módulo(s)`}
                                                {grant.expiresAt && ` • expira em ${new Date(grant.expiresAt).toLocaleDateString('pt-BR')}`}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Detalhe da empresa */}
            <AdminCompanyDrawer
                profile={selectedProfile}
                engagement={selectedUserId ? engagementMap.get(selectedUserId) : undefined}
                accessDays={accessDays}
                activatingModule={activatingModule}
                busyUser={busyUser}
                onClose={() => setSelectedUserId(null)}
                activateModuleForUser={activateModuleForUser}
                setUserBlocked={setUserBlocked}
                deleteUser={deleteUser}
                getModuleExpiryDays={getModuleExpiryDays}
                isModuleActive={isModuleActive}
            />
        </div>
    );
};
