import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Login } from './Login';
import { PAYMENT_LINK } from '../constants';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { session, loading, isApproved, signOut } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!session) {
        return <Login />;
    }

    if (!isApproved) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
                <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl p-8 border border-slate-700 text-center">
                    <div className="mb-6">
                        <div className="w-16 h-16 bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Aguardando Aprovação</h2>
                        <p className="text-slate-400 mb-6">
                            Para liberar seu acesso imediato, finalize sua assinatura.
                        </p>

                        <a
                            href="https://www.abacatepay.com/pay/bill_dzGqwnwrBqXbRzWFy2Tuy5aC"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-lg shadow-green-600/20 mb-4"
                        >
                            Liberar Acesso Agora
                        </a>

                        <p className="text-xs text-slate-500 mb-6">
                            Após o pagamento, seu acesso será liberado automaticamente em instantes.
                        </p>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-lg mb-6 text-sm text-slate-500">
                        ID do Usuário: <span className="font-mono text-slate-400">{session.user.id}</span>
                    </div>

                    <button
                        onClick={signOut}
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                    >
                        Sair e tentar outra conta
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
