import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { Profile, OrganizationMember } from '../types';

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
        // Check active sessions and subscribe to auth changes
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
            // Detecta quando o usuário clica no link de recuperação de senha
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

    const fetchProfile = async (userId: string, email: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error && error.code === 'PGRST116') {
                // Profile doesn't exist, create it
                // Note: Não definimos approved ou organization_id aqui
                // O trigger handle_profile_changes define esses valores
                // (approved=true e organization_id correto para colaboradores com convite)
                const newProfile = {
                    id: userId,
                    email: email,
                    role: 'user'
                    // approved e organization_id são definidos pelo trigger
                };
                const { data: createdProfile, error: createError } = await supabase
                    .from('profiles')
                    .insert([newProfile])
                    .select()
                    .single();

                if (createError) {
                    console.error('Error creating profile:', createError);
                } else {
                    // Usar o profile retornado do banco (já processado pelo trigger)
                    setProfile(createdProfile);
                    // Check member status for new profile
                    await fetchMemberStatus(createdProfile);
                }
            } else if (data) {
                setProfile(data);
                // Check member status
                await fetchMemberStatus(data);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMemberStatus = async (profile: Profile) => {
        if (!profile.organization_id) {
            setMemberStatus(null);
            setIsOwner(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('organization_members')
                .select('*')
                .eq('organization_id', profile.organization_id)
                .eq('user_id', profile.id)
                .single();

            if (error) {
                console.error('Error fetching member status:', error);
                setMemberStatus(null);
                setIsOwner(false);
                return;
            }

            if (data) {
                setMemberStatus(data.status as 'pending' | 'active' | 'blocked');
                setIsOwner(data.role === 'owner');
            }
        } catch (error) {
            console.error('Error fetching member status:', error);
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

    // Emails que são sempre admin
    const ADMIN_EMAILS = ['windowfilm.br@gmail.com', 'windowfilm.app@gmail.com'];
    const isAdminByEmail = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

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
