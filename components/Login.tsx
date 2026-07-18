import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { clearSignupInProgress, markSignupInProgress } from '../src/lib/signupFlow';

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

// Traduz as mensagens de erro do Supabase Auth (em ingles) para portugues.
// Mensagens ja em portugues (validacoes locais) ou nao mapeadas passam direto.
const translateAuthError = (
    rawMessage?: string,
    fallback = 'Não foi possível concluir. Tente novamente.'
): string => {
    const message = (rawMessage || '').trim();

    if (message === 'login_timeout') {
        return 'O servidor demorou para responder. Tente novamente em instantes.';
    }

    const m = message.toLowerCase();

    if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('network request failed')) {
        return 'Não conseguimos conectar ao servidor agora. Tente novamente em instantes.';
    }
    if (m.includes('user already registered') || m.includes('already been registered') || m.includes('already registered')) {
        return 'Este email já está cadastrado. Faça login ou recupere sua senha.';
    }
    if (m.includes('invalid login credentials')) {
        return 'Email ou senha incorretos.';
    }
    if (m.includes('email not confirmed')) {
        return 'Confirme seu email antes de entrar. Verifique sua caixa de entrada.';
    }
    if (m.includes('password should be at least') || m.includes('password is too short')) {
        return 'A senha deve ter pelo menos 6 caracteres.';
    }
    if (m.includes('unable to validate email address') || m.includes('invalid format') || m.includes('invalid email')) {
        return 'Email inválido. Verifique e tente novamente.';
    }
    if (m.includes('email rate limit exceeded') || m.includes('rate limit')) {
        return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.';
    }
    if (m.includes('for security purposes') && m.includes('second')) {
        return 'Aguarde alguns segundos antes de tentar novamente.';
    }
    if (m.includes('new password should be different')) {
        return 'A nova senha precisa ser diferente da anterior.';
    }
    if (m.includes('token has expired') || m.includes('invalid token') || m.includes('otp_expired') || m.includes('expired or is invalid')) {
        return 'O link expirou ou é inválido. Solicite um novo.';
    }
    if (m.includes('user not found')) {
        return 'Não encontramos uma conta com esse email.';
    }
    if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
        return 'Os cadastros estão temporariamente desativados.';
    }

    return message || fallback;
};

export const Login: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
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

                // Identifica a sessão automática como parte de um novo cadastro. Assim,
                // o AuthContext pode abrir os dados da empresa sem reaproveitar o cache
                // visual de outra conta usada anteriormente no mesmo navegador.
                markSignupInProgress();
                try {
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

                    if (data.user) {
                        const userId = data.user.id;
                    // Cada evento tem seu proprio event_id, compartilhado entre o Pixel
                    // (browser) e a CAPI (servidor) para a Meta deduplicar em vez de contar 2x.
                    const genEventId = () =>
                        typeof crypto !== 'undefined' && 'randomUUID' in crypto
                            ? crypto.randomUUID()
                            : `ev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                    const leadEventId = genEventId();
                    const regEventId = genEventId();

                    const readCookie = (name: string) =>
                        document.cookie
                            .split('; ')
                            .find((c) => c.startsWith(`${name}=`))
                            ?.split('=')[1];
                    const fbp = readCookie('_fbp');
                    const fbc = readCookie('_fbc'); // identificador do clique no anuncio

                    (window as any).fbq?.('track', 'Lead', {
                        content_name: 'Cadastro App Filmstec',
                        content_category: 'app_registration'
                    }, { eventID: leadEventId });
                    (window as any).fbq?.('track', 'CompleteRegistration', {
                        content_name: 'Cadastro App Filmstec',
                        status: true
                    }, { eventID: regEventId });

                    // Conversions API (server-side). external_id (id do usuario) e fbc
                    // melhoram o match quality. Fire-and-forget: falha nunca afeta o cadastro.
                    const capiBase = {
                        email,
                        externalId: userId,
                        eventSourceUrl: window.location.href,
                        fbp,
                        fbc,
                    };
                    void supabase.functions
                        .invoke('meta-capi-event', {
                            body: {
                                ...capiBase,
                                eventName: 'Lead',
                                eventId: leadEventId,
                                customData: {
                                    content_name: 'Cadastro App Filmstec',
                                    content_category: 'app_registration'
                                }
                            }
                        })
                        .catch(() => {});
                    void supabase.functions
                        .invoke('meta-capi-event', {
                            body: {
                                ...capiBase,
                                eventName: 'CompleteRegistration',
                                eventId: regEventId,
                                customData: {
                                    content_name: 'Cadastro App Filmstec',
                                    status: true
                                }
                            }
                        })
                        .catch(() => {});
                    }

                    if (data.user && !data.session) {
                        setMessage({ type: 'success', text: 'Cadastro realizado. Verifique seu email para confirmar.' });
                    }
                } finally {
                    clearSignupInProgress();
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
                text: translateAuthError(error?.message, 'Erro ao autenticar'),
            });
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setMessage(null);
        setGoogleLoading(true);

        try {
            // Sinaliza que um retorno com ?code= na raiz e o callback do OAuth
            // (e nao um QR de estoque), para o roteamento em index.tsx distinguir
            // os dois casos. sessionStorage e por aba e sobrevive ao redirect.
            try {
                sessionStorage.setItem('pb-google-oauth-redirect', '1');
            } catch {
                // sessionStorage indisponivel: segue mesmo assim.
            }

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                },
            });

            if (error) throw error;
            // Em caso de sucesso o navegador redireciona para o Google; mantemos
            // o loading ativo ate a navegacao acontecer.
        } catch (error: any) {
            try {
                sessionStorage.removeItem('pb-google-oauth-redirect');
            } catch {
                // ignora
            }
            console.error('[Login] Erro Google:', error);
            setMessage({
                type: 'error',
                text: translateAuthError(error?.message, 'Não foi possível entrar com o Google.'),
            });
            setGoogleLoading(false);
        }
    };

    const inputClasses = 'w-full pl-11 pr-4 py-3 bg-[#f1f5f9] border-none rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/70 focus:bg-white outline-none transition-all';

    return (
        <div className="relative flex min-h-[100dvh] w-full flex-1 items-center justify-center px-4 py-6 font-sans sm:px-6 lg:justify-end lg:p-0">
            {/* Imagem de fundo - apenas desktop (background-image nao e baixado no mobile pois fica display:none) */}
            <div
                aria-hidden="true"
                className="absolute inset-0 hidden bg-cover bg-center lg:block"
                style={{ backgroundImage: "url('/login-bg.webp')" }}
            />

            {/* Fundo gradiente - mobile/tablet */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] lg:hidden" />

            {/* Frase de valor sobre a imagem - apenas desktop */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[5] hidden lg:block">
                {/* Degrade para legibilidade do texto sobre a foto */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                <div className="absolute bottom-0 left-0 right-[500px] p-14 xl:p-16">
                    <p className="max-w-xl text-[2rem] font-bold leading-[1.12] tracking-tight text-white xl:text-[2.5rem]">
                        Gestão completa para o seu negócio de películas.
                    </p>
                    <p className="mt-4 max-w-md text-base font-medium text-white/75">
                        Orçamentos, agenda, estoque e plano de corte — tudo em um só app.
                    </p>
                </div>
            </div>

            {/* Faixa que ancora o card (largura limitada para nao colar na borda em telas largas) */}
            <div className="relative z-10 flex w-full justify-center lg:block lg:w-auto">
            {/* Card do formulario */}
            <div className="w-full max-w-[420px] rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.05)] sm:p-8 lg:flex lg:h-[100dvh] lg:w-[500px] lg:max-w-none lg:flex-col lg:overflow-y-auto lg:rounded-none lg:border-none lg:px-16 lg:py-12 lg:shadow-[-24px_0_70px_rgba(0,0,0,0.5)]">
                <div className="text-center mb-10 lg:mt-auto">
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
                                    <label htmlFor="login-fullname" className="text-sm font-bold text-[#020617] ml-1">Nome completo</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                            <User size={20} />
                                        </div>
                                        <input
                                            id="login-fullname"
                                            name="name"
                                            type="text"
                                            autoComplete="name"
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
                                <label htmlFor="login-email" className="text-sm font-bold text-[#020617] ml-1">Email</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                        <Mail size={20} />
                                    </div>
                                    <input
                                        id="login-email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className={inputClasses}
                                        placeholder="peliculasbr@gmail.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="login-password" className="text-sm font-bold text-[#020617] ml-1">Senha</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                        <Lock size={20} />
                                    </div>
                                    <input
                                        id="login-password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete={isSignUp ? 'new-password' : 'current-password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className={`${inputClasses} pr-12`}
                                        placeholder="********"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>

                            {isSignUp && (
                                <div className="space-y-2">
                                    <label htmlFor="login-confirm-password" className="text-sm font-bold text-[#020617] ml-1">Confirmar senha</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                            <Lock size={20} />
                                        </div>
                                        <input
                                            id="login-confirm-password"
                                            name="confirm-password"
                                            type={showPassword ? 'text' : 'password'}
                                            autoComplete="new-password"
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
                            <label htmlFor="login-reset-email" className="text-sm font-bold text-[#020617] ml-1">Email para recuperacao</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                    <Mail size={20} />
                                </div>
                                <input
                                    id="login-reset-email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
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
                            <>
                                <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                                <span>
                                    {showForgotPassword
                                        ? 'Enviando email...'
                                        : isSignUp
                                            ? 'Criando sua conta...'
                                            : 'Entrando...'}
                                </span>
                            </>
                        ) : (
                            <>
                                <span>{showForgotPassword ? 'Enviar Email' : (isSignUp ? 'Cadastrar' : 'Entrar')}</span>
                                {!showForgotPassword && <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />}
                            </>
                        )}
                    </button>
                </form>

                {!showForgotPassword && (
                    <>
                        <div className="mt-8 flex items-center justify-center gap-4">
                            <div className="h-px flex-grow bg-slate-100" />
                            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">OU</span>
                            <div className="h-px flex-grow bg-slate-100" />
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={googleLoading || loading}
                            className="mt-6 w-full py-3.5 px-6 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-2xl border border-slate-200 transition-all shadow-sm flex items-center justify-center gap-3 disabled:opacity-70"
                        >
                            {googleLoading ? (
                                <div className="h-5 w-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                            ) : (
                                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                            )}
                            <span>Continuar com Google</span>
                        </button>
                    </>
                )}

                <div className="mt-8 text-center lg:mb-auto">
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
        </div>
    );
};
