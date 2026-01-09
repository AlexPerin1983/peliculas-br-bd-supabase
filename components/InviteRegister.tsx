import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { validateInviteCode, incrementInviteUsage } from '../services/inviteService';
import { supabase } from '../services/supabaseClient';

const InviteRegister: React.FC = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [valid, setValid] = useState(false);
    const [organizationName, setOrganizationName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [registering, setRegistering] = useState(false);

    useEffect(() => {
        checkInviteCode();
    }, [code]);

    const checkInviteCode = async () => {
        if (!code) {
            setError('Código de convite não fornecido.');
            setLoading(false);
            return;
        }

        const result = await validateInviteCode(code);

        if (result.valid) {
            setValid(true);
            setOrganizationName(result.organizationName || 'Organização');
        } else {
            setValid(false);
            setError(result.error || 'Código de convite inválido ou expirado');
        }

        setLoading(false);
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validações
        if (!name.trim()) {
            setError('Por favor, informe seu nome completo.');
            return;
        }

        if (!email.trim() || !email.includes('@')) {
            setError('Por favor, informe um email válido.');
            return;
        }

        if (password.length < 6) {
            setError('A senha deve ter no mínimo 6 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        setRegistering(true);

        try {
            // Registrar usuário no Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email.trim(),
                password: password,
                options: {
                    data: {
                        name: name.trim(),
                        invite_code: code?.toUpperCase()  // Passa código para o trigger processar
                    },
                    emailRedirectTo: `${window.location.origin}/login`
                }
            });

            if (authError) {
                throw authError;
            }

            // Incrementar contador de usos do convite
            if (code) {
                await incrementInviteUsage(code);
            }

            // Sucesso - redirecionar para login
            navigate('/login', {
                state: {
                    message: 'Cadastro realizado com sucesso! Verifique seu email e faça login para continuar.',
                    email: email.trim()
                }
            });
        } catch (err: any) {
            console.error('Erro ao cadastrar:', err);

            // Tratar mensagens de erro específicas
            if (err.message?.includes('already registered')) {
                setError('Este email já está cadastrado. Faça login ou use outro email.');
            } else if (err.message?.includes('email')) {
                setError('Email inválido. Verifique e tente novamente.');
            } else {
                setError(err.message || 'Erro ao criar conta. Tente novamente.');
            }

            setRegistering(false);
        }
    };

    // Tela de carregamento
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-300 font-medium">Validando convite...</p>
                </div>
            </div>
        );
    }

    // Código inválido
    if (!valid) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 dark:from-slate-900 dark:to-slate-800 p-4">
                <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 text-center">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="fas fa-times-circle text-4xl text-red-500"></i>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">
                        Convite Inválido
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        {error}
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                    >
                        Ir para Login
                    </button>
                </div>
            </div>
        );
    }

    // Formulário de cadastro
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 dark:from-slate-900 dark:to-slate-800 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                {/* Header */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i className="fas fa-user-plus text-2xl text-white"></i>
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
                            Bem-vindo!
                        </h2>
                        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                            Você foi convidado para
                        </p>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
                            {organizationName}
                        </p>
                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                            <i className="fas fa-ticket-alt text-blue-600 dark:text-blue-400"></i>
                            <span className="text-sm font-mono font-bold text-blue-700 dark:text-blue-300">
                                {code?.toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {/* Formulário */}
                    <form className="space-y-5" onSubmit={handleRegister}>
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Nome Completo *
                            </label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={registering}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="João da Silva"
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Email *
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={registering}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="seu@email.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Senha *
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={registering}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Mínimo 6 caracteres"
                                minLength={6}
                            />
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Confirmar Senha *
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={registering}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Repita sua senha"
                            />
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                                <p className="text-sm text-red-800 dark:text-red-300 flex items-start gap-2">
                                    <i className="fas fa-exclamation-circle mt-0.5"></i>
                                    <span>{error}</span>
                                </p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={registering}
                            className="w-full py-4 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
                        >
                            {registering ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Criando conta...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-check-circle"></i>
                                    <span>Criar Minha Conta</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Já tem uma conta?{' '}
                            <button
                                onClick={() => navigate('/login')}
                                className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            >
                                Fazer Login
                            </button>
                        </p>
                    </div>
                </div>

                {/* Informação adicional */}
                <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                    Ao criar uma conta, você terá acesso aos dados e funcionalidades da organização.
                </p>
            </div>
        </div>
    );
};

export default InviteRegister;
