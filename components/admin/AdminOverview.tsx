import React from 'react';
import { Building2, Activity, UserPlus, FileText, DollarSign, Clock } from 'lucide-react';
import { AVAILABLE_MODULES, UserWithSubscription } from '../../src/hooks/useAdminUsers';
import { EngagementRow } from '../../src/hooks/useAdminEngagement';
import { formatInt, formatMoney, monthLabel } from './adminFormat';
import { MiniBars, MiniBar } from './charts/MiniBars';
import { Donut } from './charts/Donut';

interface AdminOverviewProps {
    profiles: UserWithSubscription[];
    engagementRows: EngagementRow[];
    trialUserIds: Set<string>;
    totals: { orcamentos: number; clientes: number; faturamento: number; ativos30d: number; totalUsuarios: number };
    activeWindowDays: number;
}

const Card: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; accent?: string; sub?: string }> = ({ icon: Icon, label, value, accent = 'text-slate-900 dark:text-white', sub }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-1.5 text-xs text-slate-500"><Icon className="h-3.5 w-3.5" /> {label}</div>
        <div className={`mt-1 text-2xl font-bold ${accent}`}>{value}</div>
        {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
);

export const AdminOverview: React.FC<AdminOverviewProps> = ({ profiles, engagementRows, trialUserIds, totals, activeWindowDays }) => {
    const companies = React.useMemo(() => profiles.filter(p => p.role !== 'admin'), [profiles]);

    // Novas empresas no mês corrente
    const novasNoMes = React.useMemo(() => {
        const now = new Date();
        return companies.filter(p => {
            if (!p.created_at) return false;
            const d = new Date(p.created_at);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;
    }, [companies]);

    // Cadastros por mês — últimos 6 meses
    const signupsByMonth = React.useMemo<MiniBar[]>(() => {
        const buckets: { key: string; label: string; value: number }[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: monthLabel(d.toISOString()), value: 0 });
        }
        const index = new Map(buckets.map((b, i) => [b.key, i]));
        for (const p of companies) {
            if (!p.created_at) continue;
            const d = new Date(p.created_at);
            const idx = index.get(`${d.getFullYear()}-${d.getMonth()}`);
            if (idx !== undefined) buckets[idx].value += 1;
        }
        return buckets.map(b => ({ label: b.label, value: b.value, hint: `${b.label}: ${b.value} cadastro(s)` }));
    }, [companies]);

    // Módulos mais usados (conta ocorrências em active_modules)
    const moduleUsage = React.useMemo(() => {
        const counts = new Map<string, number>();
        for (const p of companies) {
            for (const mid of p.subscription?.active_modules || []) {
                counts.set(mid, (counts.get(mid) || 0) + 1);
            }
        }
        return AVAILABLE_MODULES
            .map(m => ({ id: m.id, name: m.name, count: counts.get(m.id) || 0 }))
            .filter(m => m.count > 0)
            .sort((a, b) => b.count - a.count);
    }, [companies]);
    const maxModule = moduleUsage.reduce((acc, m) => Math.max(acc, m.count), 0);

    // Donut: ativas vs inativas vs trial (grupos disjuntos)
    const health = React.useMemo(() => {
        const cutoff = Date.now() - activeWindowDays * 24 * 60 * 60 * 1000;
        let ativas = 0, trial = 0, inativas = 0;
        for (const r of engagementRows) {
            if (trialUserIds.has(r.user_id)) { trial += 1; continue; }
            const recent = r.ultima_atividade && new Date(r.ultima_atividade).getTime() >= cutoff;
            if (recent) ativas += 1; else inativas += 1;
        }
        return { ativas, trial, inativas };
    }, [engagementRows, trialUserIds, activeWindowDays]);

    return (
        <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Card icon={Building2} label="Empresas" value={formatInt(companies.length)} />
                <Card icon={Activity} label={`Ativas (${activeWindowDays}d)`} value={<span className="text-green-600 dark:text-green-400">{totals.ativos30d}</span>} sub={`de ${companies.length}`} />
                <Card icon={UserPlus} label="Novas no mês" value={formatInt(novasNoMes)} accent="text-blue-600 dark:text-blue-400" />
                <Card icon={FileText} label="Orçamentos" value={formatInt(totals.orcamentos)} />
                <Card icon={DollarSign} label="Faturamento" value={<span className="text-sm sm:text-base lg:text-xl">{formatMoney(totals.faturamento)}</span>} />
                <Card icon={Clock} label="Em trial" value={<span className="text-amber-600 dark:text-amber-400">{trialUserIds.size}</span>} />
            </div>

            {/* Visualizações */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Cadastros por mês */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                    <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Cadastros por mês</h4>
                    <MiniBars data={signupsByMonth} colorClass="bg-blue-500" />
                </div>

                {/* Módulos mais usados */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                    <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Módulos mais usados</h4>
                    {moduleUsage.length === 0 ? (
                        <p className="text-sm text-slate-400">Nenhum módulo ativo ainda.</p>
                    ) : (
                        <div className="space-y-2">
                            {moduleUsage.slice(0, 6).map(m => (
                                <div key={m.id}>
                                    <div className="mb-0.5 flex items-center justify-between text-xs">
                                        <span className="truncate text-slate-600 dark:text-slate-300">{m.name}</span>
                                        <span className="font-semibold text-slate-900 dark:text-white">{m.count}</span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                        <div className="h-full rounded-full bg-purple-500" style={{ width: `${maxModule > 0 ? Math.max(4, (m.count / maxModule) * 100) : 0}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Saúde da base */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                    <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Saúde da base</h4>
                    <Donut
                        centerValue={engagementRows.length}
                        centerLabel="empresas"
                        segments={[
                            { label: 'Ativas', value: health.ativas, color: '#22c55e' },
                            { label: 'Em trial', value: health.trial, color: '#f59e0b' },
                            { label: 'Inativas', value: health.inativas, color: '#94a3b8' },
                        ]}
                    />
                </div>
            </div>
        </div>
    );
};

export default AdminOverview;
