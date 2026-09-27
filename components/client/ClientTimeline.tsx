import React, { useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { relativeDays, type ClientTimelineEntry } from '../../src/lib/clientInsights';

const TONE_DOT: Record<ClientTimelineEntry['tone'], string> = {
    neutral: 'bg-slate-300 dark:bg-slate-600',
    info: 'bg-blue-500',
    good: 'bg-emerald-500',
    warn: 'bg-amber-500',
    bad: 'bg-red-500',
};

const PREVIEW = 6;

/** Tudo o que aconteceu com o cliente, do mais recente para o mais antigo. */
const ClientTimeline: React.FC<{ entries: ClientTimelineEntry[]; now?: number }> = ({ entries, now = Date.now() }) => {
    const [showAll, setShowAll] = useState(false);
    const shown = showAll ? entries : entries.slice(0, PREVIEW);

    return (
        <section className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-hairline)]" aria-label="Linha do tempo">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
                <History className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" /> Linha do tempo
            </h3>
            {entries.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--text-muted)]">Nada por aqui ainda. Os orçamentos, links e serviços deste cliente aparecem aqui.</p>
            ) : (
                <>
                    <ol className="mt-3 space-y-3 border-l border-[var(--border-subtle)] pl-4">
                        {shown.map((entry, index) => (
                            <li key={`${entry.at}-${index}`} className="relative">
                                <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--surface-raised)] ${TONE_DOT[entry.tone]}`} aria-hidden="true" />
                                <p className="text-sm font-medium text-[var(--text-strong)]">{entry.title}</p>
                                <p className="text-xs text-[var(--text-muted)]">
                                    <span className="tabular-nums">{new Date(entry.at).toLocaleDateString('pt-BR')}</span> · {relativeDays(entry.at, now)}
                                    {entry.detail ? <> · <span className="text-[var(--text-body)]">{entry.detail}</span></> : null}
                                </p>
                            </li>
                        ))}
                    </ol>
                    {entries.length > PREVIEW ? (
                        <div className="mt-3 text-xs font-semibold">
                            <button type="button" onClick={() => setShowAll(current => !current)} aria-expanded={showAll} className="inline-flex items-center gap-1 text-[var(--brand-primary)]">
                                {showAll ? 'Mostrar menos' : `Ver tudo (${entries.length})`}
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} aria-hidden="true" />
                            </button>
                        </div>
                    ) : null}
                </>
            )}
        </section>
    );
};

export default ClientTimeline;
