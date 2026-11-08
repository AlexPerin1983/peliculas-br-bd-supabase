import React, { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { clearAllLocalData } from '../../services/offlineDb';
import { useAuth } from '../../contexts/AuthContext';

const CONFIRMATION_WORD = 'EXCLUIR';

/**
 * Exclusão da própria conta (Google Play / LGPD). Pede a palavra EXCLUIR,
 * chama a função delete-account no servidor e, se der certo, limpa a cópia
 * local e volta para a tela de login.
 */
const DeleteAccountPanel: React.FC = () => {
    const { isOwner } = useAuth();
    const [isConfirming, setIsConfirming] = useState(false);
    const [typed, setTyped] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canDelete = typed.trim().toUpperCase() === CONFIRMATION_WORD && !isDeleting;

    const handleDelete = async () => {
        if (!canDelete) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setError('Conecte-se à internet para excluir a conta.');
            return;
        }
        setIsDeleting(true);
        setError(null);
        try {
            const { data, error: invokeError } = await supabase.functions.invoke('delete-account', {
                body: { confirmation: CONFIRMATION_WORD },
            });
            if (invokeError || !data?.success) {
                let message = data?.error as string | undefined;
                const context = (invokeError as { context?: Response } | null)?.context;
                if (!message && context && typeof context.json === 'function') {
                    message = await context.json().then((body: { error?: string }) => body?.error).catch(() => undefined);
                }
                throw new Error(message || 'Não foi possível excluir a conta agora.');
            }

            await clearAllLocalData().catch(() => undefined);
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
            window.location.replace('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível excluir a conta agora.');
            setIsDeleting(false);
        }
    };

    if (!isConfirming) {
        return (
            <div className="space-y-3">
                <p className="text-sm text-[var(--text-body)]">
                    Apaga sua conta e os dados ligados a ela. Essa ação não pode ser desfeita.
                </p>
                <button
                    type="button"
                    onClick={() => setIsConfirming(true)}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-red-200 bg-white px-4 text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950/40"
                >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span className="text-sm font-semibold">Excluir minha conta</span>
                </button>
                <a
                    href="/excluir-conta"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-xs text-[var(--text-muted)] underline"
                >
                    Como funciona a exclusão
                </a>
            </div>
        );
    }

    return (
        <div className="space-y-4 rounded-[var(--radius-control)] border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
            <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                <div className="space-y-2 text-sm text-red-900 dark:text-red-100">
                    <p className="font-semibold">A exclusão é definitiva.</p>
                    {isOwner ? (
                        <p>
                            Você é o dono da empresa. Serão apagados sua conta e todos os dados da empresa:
                            clientes, orçamentos, PDFs, agenda, estoque, fornecedores e configurações. Os membros
                            da equipe perdem o acesso. Se houver assinatura automática, ela será cancelada.
                        </p>
                    ) : (
                        <p>
                            Seu login e seu perfil serão apagados e você sairá da equipe. Os clientes e orçamentos
                            da empresa continuam com o dono dela.
                        </p>
                    )}
                </div>
            </div>

            <label className="block space-y-1.5">
                <span className="text-sm text-red-900 dark:text-red-100">
                    Digite <strong>{CONFIRMATION_WORD}</strong> para confirmar
                </span>
                <input
                    type="text"
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    autoCapitalize="characters"
                    autoComplete="off"
                    disabled={isDeleting}
                    className="h-11 w-full rounded-[var(--radius-control)] border border-red-300 bg-white px-3 text-[var(--text-strong)] dark:border-red-800 dark:bg-slate-900"
                    aria-label={`Digite ${CONFIRMATION_WORD} para confirmar`}
                />
            </label>

            {error && (
                <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
                <button
                    type="button"
                    onClick={() => { setIsConfirming(false); setTyped(''); setError(null); }}
                    disabled={isDeleting}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-[var(--text-body)]"
                >
                    <span className="text-sm font-semibold">Cancelar</span>
                </button>
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={!canDelete}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-red-600 px-4 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isDeleting
                        ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                    <span className="text-sm font-semibold">{isDeleting ? 'Excluindo...' : 'Excluir conta definitivamente'}</span>
                </button>
            </div>
        </div>
    );
};

export default DeleteAccountPanel;
