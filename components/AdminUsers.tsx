import React from 'react';
import { ChevronRight, Clock, Crown, Search, Shield, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ActionButton from './ui/ActionButton';
import ContentState from './ui/ContentState';
import { AdminUserEngagement } from './AdminUserEngagement';
import { AdminOverview } from './admin/AdminOverview';
import { AdminCompanyDrawer } from './admin/AdminCompanyDrawer';
import { isTestAccount, isUserAdmin, useAdminUsers } from '../src/hooks/useAdminUsers';
import { useAdminEngagement } from '../src/hooks/useAdminEngagement';

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

    const { rows: engagementRows, loading: engLoading, error: engError, fetchEngagement, totals, activeWindowDays } = useAdminEngagement(isAdmin);

    const [accessDays, setAccessDays] = React.useState(30);
    const [trialDays, setTrialDays] = React.useState(7);
    const [onlyTests, setOnlyTests] = React.useState(false);
    const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState('');
    const [filterKey, setFilterKey] = React.useState<'todas' | 'ativas' | 'inativas' | 'trial' | 'bloqueadas' | 'completo'>('todas');
    const [sortKey, setSortKey] = React.useState<'recentes' | 'orcamentos' | 'faturamento' | 'atividade' | 'az'>('recentes');
    const [visibleCount, setVisibleCount] = React.useState(20);

    const trialUserIds = React.useMemo(() => new Set(activeGrants.map(g => g.id)), [activeGrants]);
    const engagementMap = React.useMemo(() => new Map(engagementRows.map(r => [r.user_id, r])), [engagementRows]);

    const selectedProfile = selectedUserId ? profiles.find(p => p.id === selectedUserId) ?? null : null;

    const isRecent = React.useCallback((iso: string | null | undefined) => {
        if (!iso) return false;
        return (Date.now() - new Date(iso).getTime()) / 86_400_000 <= activeWindowDays;
    }, [activeWindowDays]);

    // Lista de empresas: filtro + busca + ordenação (cruzando com engajamento)
    const filteredCompanies = React.useMemo(() => {
        let list = onlyTests ? profiles.filter(isTestAccount) : profiles;

        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter(p =>
                (p.empresa || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q));
        }

        list = list.filter(p => {
            const eng = engagementMap.get(p.id);
            const admin = isUserAdmin(p);
            switch (filterKey) {
                case 'ativas': return isRecent(eng?.ultima_atividade);
                case 'inativas': return !admin && !isRecent(eng?.ultima_atividade);
                case 'trial': return trialUserIds.has(p.id);
                case 'bloqueadas': return !!p.blocked;
                case 'completo': return isModuleActive(p, 'pacote_completo');
                default: return true;
            }
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
    }, [profiles, onlyTests, search, filterKey, sortKey, engagementMap, trialUserIds, isModuleActive, isRecent]);

    const visibleCompanies = filteredCompanies.slice(0, visibleCount);

    // Reseta a paginação quando os critérios mudam
    React.useEffect(() => { setVisibleCount(20); }, [search, filterKey, sortKey, onlyTests]);

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

    return (
        <div className="space-y-6">
            {/* Overview: KPIs + visualizações */}
            <AdminOverview
                profiles={profiles}
                engagementRows={engagementRows}
                trialUserIds={trialUserIds}
                totals={totals}
                activeWindowDays={activeWindowDays}
            />

            {feedback && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${feedback.type === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300'
                    : 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-300'
                    }`}>
                    {feedback.message}
                </div>
            )}

            {/* Acessos & Trial */}
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
            {activeGrants.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-center gap-2 border-b border-slate-200 p-4 dark:border-slate-700">
                        <Clock className="h-4 w-4 text-slate-500" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Acessos liberados (por vencimento)</h3>
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                        {activeGrants.map(grant => {
                            const expiringSoon = grant.daysRemaining !== null && grant.daysRemaining <= 7;
                            return (
                                <button
                                    key={grant.id}
                                    type="button"
                                    onClick={() => setSelectedUserId(grant.id)}
                                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-slate-900 dark:text-white">{grant.email}</div>
                                        <div className="text-xs text-slate-500">
                                            {grant.hasFullPackage ? 'Pacote Completo' : `${grant.moduleCount} módulo(s)`}
                                            {grant.expiresAt && ` • expira em ${new Date(grant.expiresAt).toLocaleDateString('pt-BR')}`}
                                        </div>
                                    </div>
                                    {grant.daysRemaining !== null && (
                                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${expiringSoon
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            }`}>
                                            {grant.daysRemaining}d restantes
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Ranking de engajamento — clicável */}
            <AdminUserEngagement
                rows={engagementRows}
                loading={engLoading}
                error={engError}
                fetchEngagement={fetchEngagement}
                onSelectCompany={setSelectedUserId}
            />

            {/* Lista de empresas */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="border-b border-slate-200 p-4 dark:border-slate-700 sm:p-6">
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

                    {/* Filtros rápidos */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {([
                            ['todas', 'Todas'],
                            ['ativas', 'Ativas'],
                            ['inativas', 'Inativas'],
                            ['trial', 'Em trial'],
                            ['completo', 'Completo'],
                            ['bloqueadas', 'Bloqueadas'],
                        ] as const).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setFilterKey(key)}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterKey === key
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-slate-700">
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
                        visibleCompanies.map(profile => {
                            const eng = engagementMap.get(profile.id);
                            const isProfileAdmin = isUserAdmin(profile);
                            const hasFullPackage = isModuleActive(profile, 'pacote_completo');
                            const activeModulesCount = profile.subscription?.active_modules?.length || 0;
                            return (
                                <button
                                    key={profile.id}
                                    type="button"
                                    onClick={() => setSelectedUserId(profile.id)}
                                    className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                >
                                    <div className="flex min-w-0 items-center gap-4">
                                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isProfileAdmin
                                            ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                                            : hasFullPackage ? 'bg-gradient-to-br from-amber-400 to-yellow-500' : activeModulesCount > 0 ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'
                                            }`}>
                                            {isProfileAdmin ? <Shield className="h-5 w-5 text-white" /> : hasFullPackage ? <Crown className="h-5 w-5 text-white" /> : <span className="text-sm font-bold text-white">{(eng?.empresa || profile.email)?.charAt(0).toUpperCase()}</span>}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="truncate font-medium text-slate-900 dark:text-white">{eng?.empresa || profile.email}</span>
                                                {isProfileAdmin && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Admin</span>}
                                                {hasFullPackage && !isProfileAdmin && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Completo</span>}
                                                {profile.blocked && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700 dark:bg-red-900/30 dark:text-red-400">Bloqueado</span>}
                                                {isTestAccount(profile) && !isProfileAdmin && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">Teste</span>}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                                                {eng?.empresa && <span className="truncate text-xs text-slate-400">{profile.email}</span>}
                                                <span>{profile.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '—'}</span>
                                                {eng && <span className="text-blue-500">• {eng.orcamentos} orç.</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" />
                                </button>
                            );
                        })
                    )}
                </div>

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
