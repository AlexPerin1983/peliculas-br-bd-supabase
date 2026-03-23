import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { Profile } from '../types';
import { getSessionScope, isPrivilegedAdminEmail } from '../services/sessionScope';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    isAdmin: boolean;
    isBlocked: boolean;
    isOwner: boolean;
    organizationId: string | null;
    memberStatus: 'pending' | 'active' | 'blocked' | null;
    isPasswordRecovery: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    clearPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [memberStatus, setMemberStatus] = useState<'pending' | 'active' | 'blocked' | null>(null);
    const [isOwner, setIsOwner] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id, session.user.email!);
            } else {
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                console.log('[AuthContext] PASSWORD_RECOVERY event detected');
                setIsPasswordRecovery(true);
            }

            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id, session.user.email!);
            } else {
                setProfile(null);
                setMemberStatus(null);
                setIsOwner(false);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (_userId: string, email: string) => {
        try {
            const scope = await getSessionScope({ ensureProfile: true, email });
            setProfile(scope.profile);
            setMemberStatus(scope.memberStatus);
            setIsOwner(scope.isOwner);
        } catch (error) {
            console.error('Error fetching profile:', error);
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
        setIsOwner(false);
        setIsPasswordRecovery(false);
    };

    const clearPasswordRecovery = () => {
        setIsPasswordRecovery(false);
    };

    const isAdminByEmail = isPrivilegedAdminEmail(user?.email);

    const value = {
        session,
        user,
        profile,
        loading,
        isAdmin: isAdminByEmail || profile?.role === 'admin',
        isBlocked: memberStatus === 'blocked',
        isOwner,
        organizationId: profile?.organization_id ?? null,
        memberStatus,
        isPasswordRecovery,
        signOut,
        refreshProfile,
        clearPasswordRecovery
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
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
