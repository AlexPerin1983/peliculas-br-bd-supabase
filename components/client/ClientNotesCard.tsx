import React, { useEffect, useState } from 'react';
import { Check, LoaderCircle, NotebookPen } from 'lucide-react';
import { getClientNotes, saveClientNotes } from '../../services/supabaseDb';

type Status = 'loading' | 'idle' | 'saving' | 'saved' | 'error' | 'unavailable';

/** Observações livres sobre o cliente (local, preferências, combinados). */
const ClientNotesCard: React.FC<{ clientId: number }> = ({ clientId }) => {
    const [saved, setSaved] = useState('');
    const [draft, setDraft] = useState('');
    const [status, setStatus] = useState<Status>('loading');

    useEffect(() => {
        let active = true;
        setStatus('loading');
        getClientNotes(clientId)
            .then(notes => { if (!active) return; setSaved(notes); setDraft(notes); setStatus('idle'); })
            .catch(error => { console.error('[ClientNotesCard] Falha ao carregar observações:', error); if (active) setStatus('unavailable'); });
        return () => { active = false; };
    }, [clientId]);

    const dirty = draft.trim() !== saved.trim();

    const save = async () => {
        setStatus('saving');
        try {
            await saveClientNotes(clientId, draft);
            setSaved(draft.trim());
            setDraft(draft.trim());
            setStatus('saved');
            window.setTimeout(() => setStatus(current => (current === 'saved' ? 'idle' : current)), 1800);
        } catch (error) {
            console.error('[ClientNotesCard] Falha ao salvar observações:', error);
            setStatus('error');
        }
    };

    if (status === 'unavailable') return null;

    return (
        <section className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-hairline)]" aria-label="Observações">
            <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
                    <NotebookPen className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" /> Observações
                </h3>
                {status === 'saved' ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><Check className="h-3.5 w-3.5" aria-hidden="true" /> Salvo</span> : null}
            </div>
            <textarea
                value={draft}
                onChange={event => setDraft(event.target.value)}
                disabled={status === 'loading'}
                rows={3}
                aria-label="Observações do cliente"
                placeholder="Ex.: portão azul, falar com o Sr. João; prefere contato à tarde; tem cachorro."
                style={{ fontSize: 16 }}
                className="mt-2 w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 leading-6 text-[var(--text-body)] placeholder:text-[var(--text-soft)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60"
            />
            {status === 'error' ? <p className="mt-1 text-xs font-semibold text-red-600">Não foi possível salvar. Tente de novo.</p> : null}
            {dirty ? (
                <div className="mt-2 flex justify-end gap-2 text-xs font-semibold">
                    <button type="button" onClick={() => setDraft(saved)} className="h-9 rounded-lg px-3 text-[var(--text-muted)]">Descartar</button>
                    <button type="button" onClick={() => void save()} disabled={status === 'saving'} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-white disabled:opacity-60">
                        {status === 'saving' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null} Salvar observações
                    </button>
                </div>
            ) : null}
        </section>
    );
};

export default ClientNotesCard;
