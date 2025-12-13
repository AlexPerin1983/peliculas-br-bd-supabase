import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

// Declaração do Meta Pixel para TypeScript
declare global {
    interface Window {
        fbq: (...args: any[]) => void;
    }
}

export const Login: React.FC = () => {
    const [view, setView] = useState<'vsl' | 'auth'>('vsl');
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (showForgotPassword) {
                const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                    redirectTo: window.location.origin,
                });
                if (error) throw error;
                setMessage({ type: 'success', text: 'Email de redefinição enviado! Verifique sua caixa de entrada.' });
                setShowForgotPassword(false);
            } else if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;

                if (!data.session) {
                    setMessage({ type: 'success', text: 'Cadastro realizado! Verifique seu email para confirmar.' });
                }
                // Meta Pixel: Evento de registro completado
                if (typeof window.fbq === 'function') {
                    window.fbq('track', 'CompleteRegistration', {
                        content_name: 'Películas Brasil',
                        status: 'success'
                    });
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Erro ao autenticar' });
        } finally {
            setLoading(false);
        }
    };

    if (view === 'vsl') {
        return (
            <div className="h-[100dvh] bg-slate-900 flex flex-col items-center justify-between py-6 px-4 overflow-hidden">

                {/* 1. Headline (Compact) */}
                <div className="text-center space-y-2 shrink-0 z-10">
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
                        Pare de Jogar <span className="text-green-500">Dinheiro Fora</span>
                    </h1>
                    <p className="text-slate-400 text-sm md:text-base">
                        Descubra como otimizar seus cortes e lucrar mais.
                    </p>
                </div>

                {/* 2. Video (Takes available space, maintains aspect ratio) */}
                <div className="flex-1 w-full flex items-center justify-center min-h-0 my-4">
                    <div className="relative h-full max-h-full aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
                        <iframe
                            className="absolute top-0 left-0 w-full h-full"
                            src="https://www.youtube.com/embed/snuL-vtFJJk?rel=0&modestbranding=1&playsinline=1&controls=1"
                            title="Vídeo de Vendas"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        ></iframe>
                    </div>
                </div>

                {/* 3. CTA & Footer (Always visible) */}
                <div className="w-full max-w-md space-y-3 shrink-0 z-10">
                    <button
                        onClick={() => {
                            // Meta Pixel: Evento Lead quando clica no CTA
                            if (typeof window.fbq === 'function') {
                                window.fbq('track', 'Lead', {
                                    content_name: 'CTA - Quero Economizar Agora',
                                    content_category: 'VSL Page'
                                });
                            }
                            setIsSignUp(true);
                            setView('auth');
                        }}
                        className="w-full py-3.5 px-6 bg-green-600 hover:bg-green-500 text-white text-lg font-bold rounded-xl shadow-lg shadow-green-600/20 transform transition-all hover:scale-105 active:scale-95 animate-pulse"
                    >
                        QUERO ECONOMIZAR AGORA
                    </button>

                    <div className="text-center">
                        <button
                            onClick={() => {
                                setIsSignUp(false);
                                setView('auth');
                            }}
                            className="text-slate-500 hover:text-white text-xs font-medium transition-colors"
                        >
                            Já sou aluno? <span className="underline">Fazer Login</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
            <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl p-8 border border-slate-700 relative">
                {/* Back Button */}
                <button
                    onClick={() => setView('vsl')}
                    className="absolute top-4 left-4 text-slate-400 hover:text-white transition-colors"
                >
                    <i className="fas fa-arrow-left mr-2"></i> Voltar
                </button>

                <div className="text-center mb-8 mt-4">
                    <h2 className="text-3xl font-bold text-white mb-2">
                        {showForgotPassword ? 'Redefinir Senha' : (isSignUp ? 'Criar Conta' : 'Bem-vindo')}
                    </h2>
                    <p className="text-slate-400">
                        {showForgotPassword
                            ? 'Digite seu email para receber o link'
                            : (isSignUp ? 'Preencha os dados para se cadastrar' : 'Faça login para acessar o sistema')}
                    </p>
                </div>

                {message && (
                    <div className={`p-4 rounded-lg mb-6 text-sm font-medium ${message.type === 'error' ? 'bg-red-900/50 text-red-200 border border-red-800' : 'bg-green-900/50 text-green-200 border border-green-800'
                        }`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-6">
                    {!showForgotPassword ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="seu@email.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Senha</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all pr-12"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                                    >
                                        <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                </div>
                                {!isSignUp && (
                                    <div className="flex justify-end mt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowForgotPassword(true);
                                                setMessage(null);
                                            }}
                                            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            Esqueci minha senha
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Email para recuperação</label>
                            <input
                                type="email"
                                required
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="seu@email.com"
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Processando...
                            </span>
                        ) : (
                            showForgotPassword ? 'Enviar Email' : (isSignUp ? 'Cadastrar' : 'Entrar')
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => {
                            if (showForgotPassword) {
                                setShowForgotPassword(false);
                            } else {
                                setIsSignUp(!isSignUp);
                            }
                            setMessage(null);
                        }}
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        {showForgotPassword
                            ? 'Voltar para o login'
                            : (isSignUp ? 'Já tem uma conta? Faça login' : 'Não tem conta? Cadastre-se')}
                    </button>
                </div>
            </div>
        </div>
    );
};
