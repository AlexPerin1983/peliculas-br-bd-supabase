import React from 'react';
import { BarChart3, Copy, FileText, Users, CalendarClock, Wrench, DollarSign, Crown, MessageCircle, ChevronRight } from 'lucide-react';
import ActionButton from './ui/ActionButton';
import ContentState from './ui/ContentState';
import { EngagementMetric, EngagementRow } from '../src/hooks/useAdminEngagement';
import { buildWhatsappLink, formatInt, formatMoney, relativeDays } from './admin/adminFormat';

interface MetricDef {
    key: EngagementMetric;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string; // tailwind bg for the bar
    accent: string; // tailwind text
    format: (v: number) => string;
}

const METRICS: MetricDef[] = [
    { key: 'orcamentos', label: 'Orçamentos', icon: FileText, color: 'bg-blue-500', accent: 'text-blue-600 dark:text-blue-400', format: formatInt },
    { key: 'clientes', label: 'Clientes', icon: Users, color: 'bg-emerald-500', accent: 'text-emerald-600 dark:text-emerald-400', format: formatInt },
    { key: 'agendamentos', label: 'Agendamentos', icon: CalendarClock, color: 'bg-violet-500', accent: 'text-violet-600 dark:text-violet-400', format: formatInt },
    { key: 'servicos', label: 'Serviços', icon: Wrench, color: 'bg-amber-500', accent: 'text-amber-600 dark:text-amber-400', format: formatInt },
    { key: 'faturamento', label: 'Faturamento', icon: DollarSign, color: 'bg-rose-500', accent: 'text-rose-600 dark:text-rose-400', format: formatMoney },
];

interface AdminUserEngagementProps {
    rows: EngagementRow[];
    loading: boolean;
    error: string | null;
    fetchEngagement: () => void;
    onSelectCompany?: (userId: string) => void;
}

export const AdminUserEngagement: React.FC<AdminUserEngagementProps> = ({ rows, loading, error, fetchEngagement, onSelectCompany }) => {
    const [metric, setMetric] = React.useState<EngagementMetric>('orcamentos');
    const [showAll, setShowAll] = React.useState(false);
    const [copiedEmail, setCopiedEmail] = React.useState<string | null>(null);

    const activeMetric = METRICS.find(m => m.key === metric)!;

    const sorted = React.useMemo(() => {
        return [...rows].sort((a, b) => b[metric] - a[metric]);
    }, [rows, metric]);

    const maxValue = sorted.length ? Math.max(...sorted.map(r => r[metric])) : 0;
    const visible = showAll ? sorted : sorted.slice(0, 10);

    const copyEmail = async (email: string) => {
        try {
            await navigator.clipboard.writeText(email);
            setCopiedEmail(email);
            setTimeout(() => setCopiedEmail(null), 1500);
        } catch {
            /* clipboard indisponível */
        }
    };

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-6 dark:border-slate-700">
                <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Engajamento dos usuários</h3>
                        <p className="hidden text-sm text-slate-500 sm:block">Quem mais usa a ferramenta — clique numa empresa para ver o detalhe.</p>
                    </div>
                </div>
                <ActionButton variant="secondary" size="sm" iconClassName="fas fa-rotate-right" onClick={fetchEngagement}>
                    Atualizar
                </ActionButton>
            </div>

            {/* Seletor de métrica */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4 dark:border-slate-700">
                <span className="text-xs font-medium text-slate-500">Ordenar por:</span>
                {METRICS.map(m => {
                    const Icon = m.icon;
                    const active = m.key === metric;
                    return (
                        <button
                            key={m.key}
                            type="button"
                            onClick={() => setMetric(m.key)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${active
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                }`}
                        >
                            <Icon className="h-3.5 w-3.5" /> {m.label}
                        </button>
                    );
                })}
            </div>

            {/* Lista / ranking */}
            {loading ? (
                <ContentState compact iconClassName="fas fa-chart-bar" title="Carregando engajamento" description="Agregando atividade dos usuários." />
            ) : error ? (
                <ContentState compact iconClassName="fas fa-triangle-exclamation" title="Não foi possível carregar" description={error} />
            ) : sorted.length === 0 ? (
                <ContentState compact iconClassName="fas fa-chart-bar" title="Sem dados de uso ainda" description="Quando os usuários começarem a criar orçamentos, o ranking aparece aqui." />
            ) : (
                <>
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                        {visible.map((row, index) => {
                            const value = row[metric];
                            const pct = maxValue > 0 ? Math.max(2, (value / maxValue) * 100) : 0;
                            return (
                                <div
                                    key={row.user_id}
                                    role={onSelectCompany ? 'button' : undefined}
                                    onClick={onSelectCompany ? () => onSelectCompany(row.user_id) : undefined}
                                    className={`px-4 py-3 sm:px-6 ${onSelectCompany ? 'cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index === 0
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                                            }`}>
                                            {index === 0 ? <Crown className="h-4 w-4" /> : index + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                                                        {row.empresa || row.email}
                                                    </span>
                                                    {row.empresa && (
                                                        <span className="hidden truncate text-xs text-slate-400 sm:inline">{row.email}</span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); copyEmail(row.email); }}
                                                        title="Copiar email"
                                                        className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </button>
                                                    {(() => {
                                                        const wa = buildWhatsappLink(row.telefone);
                                                        return wa ? (
                                                            <a
                                                                href={wa}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                title={`WhatsApp: ${row.telefone}`}
                                                                className="shrink-0 rounded p-0.5 text-green-500 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/30"
                                                            >
                                                                <MessageCircle className="h-3.5 w-3.5" />
                                                            </a>
                                                        ) : null;
                                                    })()}
                                                    {copiedEmail === row.email && <span className="text-[10px] font-medium text-green-500">copiado</span>}
                                                </div>
                                                <div className="flex shrink-0 items-center gap-1.5">
                                                    <span className={`text-sm font-bold tabular-nums ${activeMetric.accent}`}>
                                                        {activeMetric.format(value)}
                                                    </span>
                                                    {onSelectCompany && <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />}
                                                </div>
                                            </div>
                                            {/* Barra */}
                                            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                                <div className={`h-full rounded-full ${activeMetric.color} transition-all`} style={{ width: `${pct}%` }} />
                                            </div>
                                            {/* Métricas secundárias */}
                                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                                <span>{formatInt(row.orcamentos)} orç.</span>
                                                <span>{formatInt(row.clientes)} cli.</span>
                                                <span className="hidden sm:inline">{formatInt(row.agendamentos)} agend.</span>
                                                <span className="hidden sm:inline">{formatInt(row.servicos)} serv.</span>
                                                <span className="text-slate-400">• {relativeDays(row.ultima_atividade)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {sorted.length > 10 && (
                        <div className="border-t border-slate-200 p-3 text-center dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => setShowAll(v => !v)}
                                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                            >
                                {showAll ? 'Mostrar só o top 10' : `Ver todos (${sorted.length})`}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default AdminUserEngagement;
