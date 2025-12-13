import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { Profile } from '../types';

// Declaração do Meta Pixel para TypeScript
declare global {
    interface Window {
        fbq: (...args: any[]) => void;
    }
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    isAdmin: boolean;
    isApproved: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    // Meta Pixel: Dispara evento Purchase quando usuário é aprovado
    useEffect(() => {
        const isApproved = profile?.approved ?? false;
        const alreadyTracked = localStorage.getItem('meta_purchase_tracked');

        if (isApproved && !alreadyTracked) {
            if (typeof window.fbq === 'function') {
                window.fbq('track', 'Purchase', {
                    value: 39.00,
                    currency: 'BRL',
                    content_name: 'FilmsPro - Acesso Vitalício'
                });
            }
            localStorage.setItem('meta_purchase_tracked', 'true');
        }
    }, [profile?.approved]);

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

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id, session.user.email!);
            } else {
                setProfile(null);
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
                const newProfile: Profile = {
                    id: userId,
                    email: email,
                    role: 'user',
                    approved: false, // Default to not approved
                    created_at: new Date().toISOString()
                };
                const { data: createdProfile, error: createError } = await supabase
                    .from('profiles')
                    .insert([newProfile])
                    .select()
                    .single();

                if (createError) {
                    console.error('Error creating profile:', createError);
                } else {
                    setProfile(createdProfile);
                }
            } else if (data) {
                setProfile(data);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setSession(null);
        setUser(null);
    };

    const value = {
        session,
        user,
        profile,
        loading,
        isAdmin: profile?.role === 'admin',
        isApproved: profile?.approved ?? false,
        signOut
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
