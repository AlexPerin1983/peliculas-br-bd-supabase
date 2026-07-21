import React, { FormEvent, useState } from 'react';
import { ArrowRight, Download, KeyRound, Loader2, LogOut, MessageCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const COMMUNITY_GROUP_URL = 'https://chat.whatsapp.com/L7lDpi6vxD0BYLO3vaE0fW';

interface CommunityAccessGateProps {
    onGranted: () => Promise<void> | void;
    onSignOut: () => Promise<void> | void;
}

export const CommunityAccessGate: React.FC<CommunityAccessGateProps> = ({ onGranted, onSignOut }) => {
    const [groupOpened, setGroupOpened] = useState(false);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!code.trim() || loading) return;

        setLoading(true);
        setError(null);

        try {
            const { data, error: rpcError } = await supabase.rpc('redeem_community_access', {
                p_code: code.trim()
            });

            if (rpcError) throw rpcError;
            if (!data?.success) {
                setError('Codigo incorreto. Confira a mensagem fixada no grupo e tente novamente.');
                return;
            }

            await onGranted();
        } catch (submitError) {
            console.error('[CommunityAccessGate] Nao foi possivel liberar o acesso:', submitError);
            setError('Nao foi possivel validar agora. Verifique sua conexao e tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-[100dvh] w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.15),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-8 font-sans">
            <main className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.14)] sm:p-10">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-[0_14px_35px_rgba(5,150,105,0.25)]">
                    <MessageCircle className="h-8 w-8" aria-hidden="true" />
                </div>

                <div className="mt-6 text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        Aplicativo 100% gratuito
                    </span>
                    <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                        Receba o link para acessar e instalar
                    </h1>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
                        Entre gratuitamente no grupo de aplicadores. Lá você receberá o link para abrir e instalar o aplicativo, junto com o código de liberação.
                    </p>
                    <p className="mt-2 text-xs font-bold text-emerald-700">Sem cobrança, assinatura ou cadastro de cartão.</p>
                </div>

                <div className="mt-7 space-y-3">
                    <div className="flex gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white">1</span>
                        <div>
                            <p className="text-sm font-bold text-slate-900">Entre no grupo e pegue o código</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">Você receberá o acesso gratuito, o link de instalação e as orientações para começar.</p>
                        </div>
                    </div>

                    <a
                        href={COMMUNITY_GROUP_URL}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                            setGroupOpened(true);
                            setError(null);
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                    >
                        <MessageCircle className="h-5 w-5" aria-hidden="true" />
                        Receber meu acesso gratuito
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>

                    {groupOpened ? (
                        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label="Liberar acesso ao aplicativo">
                            <div className="flex gap-3">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white">2</span>
                                <div>
                                    <p className="text-sm font-bold text-slate-900">Já recebeu o código?</p>
                                    <p className="mt-1 text-xs leading-5 text-slate-500">Volte pelo link recebido e cole abaixo o código gratuito de liberação.</p>
                                </div>
                            </div>

                            <div className="relative">
                                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                <input
                                    value={code}
                                    onChange={(event) => {
                                        setCode(event.target.value.toUpperCase());
                                        setError(null);
                                    }}
                                    placeholder="Cole o código de acesso"
                                    autoCapitalize="characters"
                                    autoComplete="off"
                                    maxLength={32}
                                    aria-label="Codigo do grupo"
                                    aria-invalid={Boolean(error)}
                                    className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm font-bold uppercase tracking-wider text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                                />
                            </div>

                            {error ? <p role="alert" className="text-xs font-semibold leading-5 text-red-600">{error}</p> : null}

                            <button
                                type="submit"
                                disabled={!code.trim() || loading}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Download className="h-5 w-5" aria-hidden="true" />}
                                {loading ? 'Validando codigo...' : 'Liberar meu acesso'}
                            </button>
                        </form>
                    ) : null}
                </div>

                <button
                    type="button"
                    onClick={() => void onSignOut()}
                    className="mx-auto mt-6 flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:text-slate-700"
                >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sair desta conta
                </button>
            </main>
        </div>
    );
};
