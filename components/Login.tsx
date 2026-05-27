import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

const LOGIN_TIMEOUT_MS = 25_000;
const withLoginTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error('login_timeout'));
        }, LOGIN_TIMEOUT_MS);
    });

    try {
        return await Promise.race([promise, timeout]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
};

export const Login: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');

    useEffect(() => {
        const loginMessage = sessionStorage.getItem('loginMessage');
        const loginEmail = sessionStorage.getItem('loginEmail');

        if (loginMessage) {
            setMessage({ type: 'success', text: loginMessage });
            sessionStorage.removeItem('loginMessage');
        }

        if (loginEmail) {
            setEmail(loginEmail);
            sessionStorage.removeItem('loginEmail');
        }
    }, []);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (showForgotPassword) {
                const redirectTo = `${window.location.origin}/reset-password`;
                const { error } = await withLoginTimeout(
                    supabase.auth.resetPasswordForEmail(resetEmail, {
                        redirectTo,
                    })
                );

                if (error) throw error;

                setMessage({ type: 'success', text: 'Email de redefinicao enviado. Verifique sua caixa de entrada.' });
                setShowForgotPassword(false);
            } else if (isSignUp) {
                if (password !== confirmPassword) {
                    throw new Error('As senhas não coincidem');
                }

                const { data, error } = await withLoginTimeout(
                    supabase.auth.signUp({
                        email,
                        password,
                        options: {
                            data: {
                                full_name: fullName,
                            }
                        }
                    })
                );

                if (error) throw error;

                if (data.user && !data.session) {
                    setMessage({ type: 'success', text: 'Cadastro realizado. Verifique seu email para confirmar.' });
                }
            } else {
                const { error } = await withLoginTimeout(
                    supabase.auth.signInWithPassword({
                        email,
                        password,
                    })
                );

                if (error) throw error;
            }
        } catch (error: any) {
            console.error('[Login] Erro:', error);
            setMessage({
                type: 'error',
                text: error.message === 'login_timeout'
                    ? 'O servidor demorou para responder. Tente novamente em instantes.'
                    : error.message === 'Failed to fetch'
                    ? 'Nao conseguimos conectar ao servidor agora. Tente novamente em instantes.'
                    : error.message || 'Erro ao autenticar'
            });
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = 'w-full pl-11 pr-4 py-3 bg-[#f1f5f9] border-none rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-300 outline-none transition-all';

    return (
        <div className="flex min-h-[100dvh] w-full flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-6 font-sans sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-[420px] rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.05)] sm:p-8 lg:p-10">
                <div className="text-center mb-10">
                    <h2 className="font-display mb-3 text-3xl font-bold tracking-tight text-[#020617]">
                        {showForgotPassword ? 'Redefinir Senha' : (isSignUp ? 'Criar Conta' : 'Fazer Login')}
                    </h2>
                    <p className="text-slate-500 font-medium">
                        {showForgotPassword
                            ? 'Digite seu email para receber o link'
                            : (isSignUp ? 'Preencha os dados para se cadastrar' : 'Bem-vindo(a)! Entre na sua conta')}
                    </p>
                </div>

                {message && (
                    <div className={`p-4 rounded-xl mb-6 text-sm font-semibold text-center ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-6">
                    {!showForgotPassword ? (
                        <>
                            {isSignUp && (
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-[#020617] ml-1">Nome completo</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors">
                                            <User size={20} />
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className={inputClasses}
                                            placeholder="Joao Silva"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-[#020617] ml-1">Email</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors">
                                        <Mail size={20} />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className={inputClasses}
                                        placeholder="peliculasbr@gmail.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-[#020617] ml-1">Senha</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors">
                                        <Lock size={20} />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className={`${inputClasses} pr-12`}
                                        placeholder="********"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>

                            {isSignUp && (
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-[#020617] ml-1">Confirmar senha</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors">
                                            <Lock size={20} />
                                        </div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className={inputClasses}
                                            placeholder="********"
                                        />
                                    </div>
                                </div>
                            )}

                            {!isSignUp && (
                                <div className="flex justify-end pr-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowForgotPassword(true)}
                                        className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors underline-offset-4 hover:underline"
                                    >
                                        Esqueci minha senha
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-[#020617] ml-1">Email para recuperacao</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors">
                                    <Mail size={20} />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    className={inputClasses}
                                    placeholder="seu@email.com"
                                />
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 px-6 bg-[#020617] hover:bg-black text-white font-bold rounded-2xl transition-all shadow-xl shadow-slate-200/50 flex items-center justify-center gap-2 group disabled:opacity-70"
                    >
                        {loading ? (
                            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <span>{showForgotPassword ? 'Enviar Email' : (isSignUp ? 'Cadastrar' : 'Entrar')}</span>
                                {!showForgotPassword && <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />}
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 flex items-center justify-center gap-4">
                    <div className="h-px flex-grow bg-slate-100" />
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">OU</span>
                    <div className="h-px flex-grow bg-slate-100" />
                </div>

                <div className="mt-8 text-center">
                    <button
                        onClick={() => {
                            if (showForgotPassword) {
                                setShowForgotPassword(false);
                            } else {
                                setIsSignUp(!isSignUp);
                            }
                            setMessage(null);
                        }}
                        className="text-slate-500 font-medium"
                    >
                        {showForgotPassword ? (
                            <span className="text-slate-900 font-bold">Voltar para o login</span>
                        ) : (
                            <>
                                {isSignUp ? 'Já tem uma conta?' : 'Não tem conta?'}{' '}
                                <span className="text-slate-950 font-extrabold hover:underline">
                                    {isSignUp ? 'Faca login' : 'Crie uma conta'}
                                </span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
