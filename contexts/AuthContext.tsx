import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { Profile } from '../types';
import { getSessionScope } from '../services/sessionScope';
import { repairAgendaPushSubscription } from '../services/agendaPushNotifications';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    isAdmin: boolean;
    isBlocked: boolean;
    isOwner: boolean;
    memberRole: 'owner' | 'admin' | 'member' | null;
    organizationId: string | null;
    memberStatus: 'pending' | 'active' | 'blocked' | null;
    isPasswordRecovery: boolean;
    connectionError: string | null;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    clearPasswordRecovery: () => void;
    retryConnection: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_REQUEST_TIMEOUT_MS = 18_000;
const AUTH_CONNECTION_ERROR_MESSAGE = 'Nao foi possivel conectar ao servidor agora. Tente novamente em instantes.';

// Deve ser igual ao storageKey configurado em services/supabaseClient.ts
const AUTH_SESSION_STORAGE_KEY = 'peliculas-br-bd-auth-v4';
// Cache local do "escopo" do usuario (perfil + papel) para reabertura instantanea.
const AUTH_SCOPE_CACHE_KEY = 'peliculas-br-bd-auth-scope-v1';

interface CachedScope {
    profile: Profile | null;
    memberStatus: 'pending' | 'active' | 'blocked' | null;
    memberRole: 'owner' | 'admin' | 'member' | null;
    isOwner: boolean;
}

// Le a sessao persistida pelo Supabase de forma sincrona, para que a primeira
// renderizacao ja tenha a sessao e nao mostre a tela de login por um instante.
const readPersistedSession = (): Session | null => {
    try {
        const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const candidate = parsed?.currentSession ?? parsed?.session ?? parsed;
        if (candidate && candidate.access_token && candidate.user) {
            return candidate as Session;
        }
        return null;
    } catch {
        return null;
    }
};

const readCachedScope = (): CachedScope | null => {
    try {
        const raw = localStorage.getItem(AUTH_SCOPE_CACHE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as CachedScope;
    } catch {
        return null;
    }
};

const writeCachedScope = (scope: CachedScope): void => {
    try {
        localStorage.setItem(AUTH_SCOPE_CACHE_KEY, JSON.stringify(scope));
    } catch {
        // localStorage indisponivel: ignora, apenas perde a reabertura instantanea.
    }
};

const clearCachedScope = (): void => {
    try {
        localStorage.removeItem(AUTH_SCOPE_CACHE_KEY);
    } catch {
        // ignora
    }
};

const withTimeout = async <T,>(promise: Promise<T>, label: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${label}_timeout`));
        }, AUTH_REQUEST_TIMEOUT_MS);
    });

    try {
        return await Promise.race([promise, timeout]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
};

const hasRecoveryContextInUrl = (hasSession: boolean = false) => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const isResetPath = window.location.pathname.startsWith('/reset-password');

    return (
        searchParams.get('type') === 'recovery' ||
        hashParams.get('type') === 'recovery' ||
        (isResetPath && (
            searchParams.has('code') ||
            hashParams.has('access_token') ||
            hashParams.has('refresh_token') ||
            hasSession
        ))
    );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Hidratacao sincrona a partir do cache local: se o usuario ja estava logado,
    // reabrimos direto na interface, sem a tela "Conectando sua conta".
    const initialSession = readPersistedSession();
    const initialScope = readCachedScope();
    const canHydrate = Boolean(initialSession && initialScope);

    const [session, setSession] = useState<Session | null>(initialSession);
    const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
    const [profile, setProfile] = useState<Profile | null>(initialScope?.profile ?? null);
    const [memberStatus, setMemberStatus] = useState<'pending' | 'active' | 'blocked' | null>(initialScope?.memberStatus ?? null);
    const [memberRole, setMemberRole] = useState<'owner' | 'admin' | 'member' | null>(initialScope?.memberRole ?? null);
    const [isOwner, setIsOwner] = useState(initialScope?.isOwner ?? false);
    // So bloqueia com o spinner quando nao temos dados em cache para mostrar.
    const [loading, setLoading] = useState(!canHydrate);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [connectionRetryKey, setConnectionRetryKey] = useState(0);

    // Indica se ja temos dados utilizaveis do usuario (perfil) para decidir se a
    // revalidacao em segundo plano deve ou nao re-bloquear a interface.
    const hasUsableScopeRef = useRef<boolean>(Boolean(initialScope?.profile));

    useEffect(() => {
        let isMounted = true;

        const loadInitialSession = async () => {
            // Quando ja temos dados em cache, revalidamos em segundo plano sem
            // bloquear a interface (sem mostrar "Conectando sua conta").
            const silentBoot = hasUsableScopeRef.current;
            if (!silentBoot) {
                setLoading(true);
            }
            setConnectionError(null);

            try {
                const { data: { session } } = await withTimeout(
                    supabase.auth.getSession(),
                    'auth_session'
                );

                if (!isMounted) return;

                setSession(session);
                setUser(session?.user ?? null);
                setIsPasswordRecovery(hasRecoveryContextInUrl(!!session));
                if (session?.user) {
                    fetchProfile(session.user.id, session.user.email!, { silent: silentBoot });
                } else {
                    clearCachedScope();
                    hasUsableScopeRef.current = false;
                    setProfile(null);
                    setMemberStatus(null);
                    setMemberRole(null);
                    setIsOwner(false);
                    setLoading(false);
                }
            } catch (error) {
                if (!isMounted) return;
                // Se temos dados em cache, mantemos o app utilizavel offline em vez
                // de jogar o usuario para a tela de erro de conexao.
                if (silentBoot) {
                    console.warn('[AuthContext] Revalidacao em segundo plano falhou; usando cache local:', error);
                    setLoading(false);
                    return;
                }
                console.error('[AuthContext] Error loading session:', error);
                setSession(null);
                setUser(null);
                setProfile(null);
                setMemberStatus(null);
                setMemberRole(null);
                setIsOwner(false);
                setConnectionError(AUTH_CONNECTION_ERROR_MESSAGE);
                setLoading(false);
            }
        };

        loadInitialSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                console.log('[AuthContext] PASSWORD_RECOVERY event detected');
                setIsPasswordRecovery(true);
            } else if (hasRecoveryContextInUrl(!!session)) {
                setIsPasswordRecovery(true);
            }

            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                setConnectionError(null);
                // Eventos como TOKEN_REFRESHED/SIGNED_IN disparam ao reabrir o app.
                // Se ja temos perfil, atualizamos em segundo plano sem re-bloquear
                // a interface com a tela "Conectando sua conta".
                const silent = hasUsableScopeRef.current;
                if (!silent) {
                    setLoading(true);
                }
                fetchProfile(session.user.id, session.user.email!, { silent });
            } else {
                clearCachedScope();
                hasUsableScopeRef.current = false;
                setProfile(null);
                setMemberStatus(null);
                setMemberRole(null);
                setIsOwner(false);
                setConnectionError(null);
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [connectionRetryKey]);

    useEffect(() => {
        if (!user) return;

        const repairPush = () => {
            if (document.visibilityState === 'hidden') return;
            void repairAgendaPushSubscription().catch((error) => {
                console.warn('[push] Nao foi possivel renovar a assinatura silenciosamente:', error);
            });
        };

        repairPush();
        document.addEventListener('visibilitychange', repairPush);
        window.addEventListener('pageshow', repairPush);

        return () => {
            document.removeEventListener('visibilitychange', repairPush);
            window.removeEventListener('pageshow', repairPush);
        };
    }, [user?.id]);

    const fetchProfile = async (_userId: string, email: string, options?: { silent?: boolean }) => {
        const silent = options?.silent ?? false;
        try {
            const scope = await withTimeout(
                getSessionScope({ ensureProfile: true, email }),
                'auth_profile'
            );
            const nextMemberRole = scope.member?.role ?? null;
            setProfile(scope.profile);
            setMemberStatus(scope.memberStatus);
            setMemberRole(nextMemberRole);
            setIsOwner(scope.isOwner);
            setConnectionError(null);
            hasUsableScopeRef.current = Boolean(scope.profile);
            if (scope.profile) {
                writeCachedScope({
                    profile: scope.profile,
                    memberStatus: scope.memberStatus,
                    memberRole: nextMemberRole,
                    isOwner: scope.isOwner
                });
            } else {
                clearCachedScope();
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            // Numa atualizacao silenciosa (app ja aberto com dados em cache),
            // preservamos o que ja esta na tela em vez de derrubar a sessao.
            if (silent) {
                console.warn('[AuthContext] Mantendo perfil em cache apos falha de revalidacao.');
            } else {
                setProfile(null);
                setMemberStatus(null);
                setMemberRole(null);
                setIsOwner(false);
                setConnectionError(AUTH_CONNECTION_ERROR_MESSAGE);
            }
        } finally {
            setLoading(false);
        }
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id, user.email!);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        clearCachedScope();
        hasUsableScopeRef.current = false;
        setProfile(null);
        setSession(null);
        setUser(null);
        setMemberStatus(null);
        setMemberRole(null);
        setIsOwner(false);
        setIsPasswordRecovery(false);
        setConnectionError(null);
    };

    const clearPasswordRecovery = () => {
        setIsPasswordRecovery(false);
        const url = new URL(window.location.href);
        const isResetContext = url.pathname.startsWith('/reset-password')
            || url.searchParams.get('type') === 'recovery'
            || url.hash.includes('type=recovery');

        if (isResetContext) {
            window.history.replaceState({}, '', url.origin);
        }
    };

    const retryConnection = () => {
        setLoading(true);
        setConnectionError(null);
        setConnectionRetryKey((key) => key + 1);
    };

    const value = {
        session,
        user,
        profile,
        loading,
        isAdmin: profile?.role === 'admin',
        isBlocked: memberStatus === 'blocked',
        isOwner,
        memberRole,
        organizationId: profile?.organization_id ?? null,
        memberStatus,
        isPasswordRecovery,
        connectionError,
        signOut,
        refreshProfile,
        clearPasswordRecovery,
        retryConnection
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
