import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Login } from './Login';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { session, loading, isBlocked, signOut, connectionError, retryConnection } = useAuth();

    if (loading) {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center bg-slate-900">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    <div>
                        <p className="text-sm font-bold text-white">Conectando sua conta</p>
                        <p className="mt-1 text-xs font-medium text-slate-400">Carregando dados com seguranca...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (connectionError) {
        return (
            <div className="min-h-[100dvh] bg-slate-950 flex items-center justify-center px-4">
                <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
                    <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
                        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M4.93 19h14.14a2 2 0 001.74-2.99L13.74 4.04a2 2 0 00-3.48 0L3.19 16.01A2 2 0 004.93 19z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">
                        Conexao indisponivel
                    </h2>
                    <p className="text-sm leading-6 text-slate-400 mb-6">
                        {connectionError}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={retryConnection}
                            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500"
                        >
                            Tentar novamente
                        </button>
                        {session && (
                            <button
                                type="button"
                                onClick={signOut}
                                className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-800"
                            >
                                Sair
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="flex min-h-[100dvh] w-full flex-1">
                <Login />
            </div>
        );
    }

    // Verificar se membro está bloqueado
    if (isBlocked) {
        return (
            <div className="min-h-[100dvh] bg-slate-900 flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl p-8 border border-slate-700 text-center">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-3">
                        Acesso Suspenso
                    </h2>

                    <p className="text-slate-400 mb-6">
                        Seu acesso foi suspenso pelo administrador da empresa. Entre em contato com o responsável para mais informações.
                    </p>

                    <button
                        onClick={signOut}
                        className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                    >
                        Sair
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
