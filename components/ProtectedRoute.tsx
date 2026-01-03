import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Login } from './Login';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { session, loading, isApproved, isBlocked, signOut } = useAuth();

    if (loading) {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!session) {
        return <Login />;
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

    // REMOVIDO: Verificação de aprovação pendente
    // Todos os usuários agora têm acesso liberado automaticamente
    // if (!isApproved) { ... }

    return <>{children}</>;
};
