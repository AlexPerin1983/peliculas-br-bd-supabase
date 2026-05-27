import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { Profile } from '../types';
import { getSessionScope } from '../services/sessionScope';

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
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [memberStatus, setMemberStatus] = useState<'pending' | 'active' | 'blocked' | null>(null);
    const [memberRole, setMemberRole] = useState<'owner' | 'admin' | 'member' | null>(null);
    const [isOwner, setIsOwner] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [connectionRetryKey, setConnectionRetryKey] = useState(0);

    useEffect(() => {
        let isMounted = true;

        const loadInitialSession = async () => {
            setLoading(true);
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
                    fetchProfile(session.user.id, session.user.email!);
                } else {
                    setLoading(false);
                }
            } catch (error) {
                if (!isMounted) return;
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
                setLoading(true);
                setConnectionError(null);
                fetchProfile(session.user.id, session.user.email!);
            } else {
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

    const fetchProfile = async (_userId: string, email: string) => {
        try {
            const scope = await withTimeout(
                getSessionScope({ ensureProfile: true, email }),
                'auth_profile'
            );
            setProfile(scope.profile);
            setMemberStatus(scope.memberStatus);
            setMemberRole(scope.member?.role ?? null);
            setIsOwner(scope.isOwner);
            setConnectionError(null);
        } catch (error) {
            console.error('Error fetching profile:', error);
            setProfile(null);
            setMemberStatus(null);
            setMemberRole(null);
            setIsOwner(false);
            setConnectionError(AUTH_CONNECTION_ERROR_MESSAGE);
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
