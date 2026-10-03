import React from 'react';
import { AlertCircle, Crown } from 'lucide-react';
import ActionButton from '../ui/ActionButton';
import { AVAILABLE_MODULES, UserWithSubscription, moduleName } from '../../src/hooks/useAdminUsers';
import { ModuleAccess, describeAccess, getModuleAccess, pendingPayments } from './companyStatus';

// ============================================================================
// Bloco "Acesso" do detalhe da empresa: mostra o que a empresa tem hoje, módulo
// por módulo, e deixa liberar, estender ou remover na mesma linha. O período
// fica aqui (e não no topo da página) para ficar claro quanto tempo vai liberar.
// ============================================================================

const PERIOD_OPTIONS = [7, 15, 30, 90];

interface AdminAccessPanelProps {
    profile: UserWithSubscription;
    activatingModule: { userId: string; moduleId: string } | null;
    revokingModule: { userId: string; moduleId: string } | null;
    onGrant: (moduleId: string, days: number) => void;
    onRevoke: (moduleId: string) => void;
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const accessLine = (access: ModuleAccess): { text: string; tone: string; dot: string } => {
    switch (access.kind) {
        case 'active': {
            const until = access.expiresAt
                ? `até ${shortDate(access.expiresAt)}${access.daysLeft !== null ? ` · ${Math.max(access.daysLeft, 0)} dia(s)` : ''}`
                : 'sem vencimento';
            return {
                text: `Ativo ${until} · ${access.paid ? 'pago' : 'cortesia'}`,
                tone: 'text-emerald-700 dark:text-emerald-400',
                dot: 'bg-emerald-500',
            };
        }
        case 'included':
            return { text: 'Incluso no Pacote Completo', tone: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-300' };
        case 'pending':
            return { text: 'Começou a pagar e não concluiu', tone: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' };
        case 'expired':
            return {
                text: access.expiresAt ? `Venceu em ${shortDate(access.expiresAt)}` : 'Venceu',
                tone: 'text-slate-500',
                dot: 'bg-slate-400',
            };
        case 'cancelled':
            return { text: 'Cancelado', tone: 'text-slate-500', dot: 'bg-slate-400' };
        default:
            return { text: 'Sem acesso', tone: 'text-slate-400', dot: 'bg-slate-300 dark:bg-slate-600' };
    }
};

export const AdminAccessPanel: React.FC<AdminAccessPanelProps> = ({
    profile,
    activatingModule,
    revokingModule,
    onGrant,
    onRevoke,
}) => {
    const [days, setDays] = React.useState(30);
    const pending = pendingPayments(profile);
    const busyFor = (moduleId: string) =>
        (activatingModule?.userId === profile.id && activatingModule.moduleId === moduleId)
        || (revokingModule?.userId === profile.id && revokingModule.moduleId === moduleId);

    const handleRevoke = (moduleId: string) => {
        if (!window.confirm(`Remover ${moduleName(moduleId)} de ${profile.email} agora?`)) return;
        onRevoke(moduleId);
    };

    const renderRow = (moduleId: string, highlight = false) => {
        const access = getModuleAccess(profile, moduleId);
        const line = accessLine(access);
        const busy = busyFor(moduleId);
        const isActive = access.kind === 'active';
        const granting = activatingModule?.userId === profile.id && activatingModule.moduleId === moduleId;
        const revoking = revokingModule?.userId === profile.id && revokingModule.moduleId === moduleId;

        return (
            <li
                key={moduleId}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 ${highlight ? 'bg-amber-50/70 dark:bg-amber-950/20' : ''}`}
            >
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-white">
                        {highlight && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                        <span className="truncate">{moduleName(moduleId)}</span>
                    </div>
                    <div className={`mt-0.5 flex items-center gap-1.5 text-xs ${line.tone}`}>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${line.dot}`} />
                        <span className="truncate">{line.text}</span>
                    </div>
                </div>
                {access.kind !== 'included' && (
                    // Fonte no contêiner: o CSS global faz os botões herdarem o tamanho do pai.
                    <div className="flex shrink-0 items-center gap-1 text-xs">
                        {isActive && !access.paid && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleRevoke(moduleId)}
                                className="rounded-lg px-2 py-1.5 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
                            >
                                {revoking ? 'Removendo…' : 'Remover'}
                            </button>
                        )}
                        <ActionButton
                            variant={highlight && !isActive ? 'primary' : 'secondary'}
                            size="sm"
                            className="!h-8 !px-3"
                            disabled={busy && !granting}
                            loading={granting}
                            loadingText="…"
                            onClick={() => onGrant(moduleId, days)}
                        >
                            {isActive ? `+${days} dias` : 'Liberar'}
                        </ActionButton>
                    </div>
                )}
            </li>
        );
    };

    return (
        <section className="mb-4">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Acesso</h4>
            <p className="mb-3 text-sm text-slate-700 dark:text-slate-200">{describeAccess(profile)}</p>

            {pending.length > 0 && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>Começou a pagar e não concluiu: {pending.map(moduleName).join(', ')}. Pode valer um contato.</span>
                </div>
            )}

            {/* Período usado pelos botões abaixo */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="mr-1 text-slate-500">Liberar por</span>
                {PERIOD_OPTIONS.map(option => (
                    <button
                        key={option}
                        type="button"
                        onClick={() => setDays(option)}
                        className={`rounded-full px-2.5 py-1 font-semibold transition-colors ${days === option
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                            }`}
                    >
                        {option} dias
                    </button>
                ))}
                <label className="flex items-center gap-1 text-slate-500">
                    ou
                    <input
                        type="number"
                        min={1}
                        value={days}
                        onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
                        aria-label="Outro número de dias"
                        className="w-12 rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-center text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    dias
                </label>
            </div>

            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                {renderRow('pacote_completo', true)}
                {AVAILABLE_MODULES.filter(m => m.id !== 'pacote_completo').map(m => renderRow(m.id))}
            </ul>
            <p className="mt-2 text-[11px] text-slate-400">
                "Liberar" usa o período escolhido acima; "+dias" soma ao que já falta. No vencimento, o acesso sai sozinho. Acesso pago só sai cancelando a assinatura.
            </p>
        </section>
    );
};

export default AdminAccessPanel;
