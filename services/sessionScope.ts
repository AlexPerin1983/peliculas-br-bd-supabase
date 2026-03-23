import { Session, User } from '@supabase/supabase-js';
import { OrganizationMember, Profile } from '../types';
import { supabase } from './supabaseClient';

export interface SessionScope {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    member: OrganizationMember | null;
    organizationId: string | null;
    ownerUserId: string | null;
    memberStatus: 'pending' | 'active' | 'blocked' | null;
    isOwner: boolean;
    isAdmin: boolean;
}

export const ADMIN_EMAILS = ['windowfilm.br@gmail.com', 'windowfilm.app@gmail.com'];

export function isPrivilegedAdminEmail(email?: string | null): boolean {
    return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function getCurrentSession(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session ?? null;
}

export async function getCurrentUser(): Promise<User | null> {
    const session = await getCurrentSession();
    if (session?.user) return session.user;

    const { data: { user } } = await supabase.auth.getUser();
    return user ?? null;
}

export async function getCurrentUserId(): Promise<string | null> {
    const user = await getCurrentUser();
    return user?.id ?? null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        if (error.code !== 'PGRST116') {
            console.error('[sessionScope] Error fetching profile:', error);
        }
        return null;
    }

    return data;
}

export async function ensureProfile(userId: string, email: string): Promise<Profile | null> {
    const existingProfile = await getProfile(userId);
    if (existingProfile) return existingProfile;

    const { data, error } = await supabase
        .from('profiles')
        .insert([{ id: userId, email, role: 'user' }])
        .select()
        .single();

    if (error) {
        console.error('[sessionScope] Error creating profile:', error);
        return null;
    }

    return data;
}

export async function getOrganizationMember(profile: Profile): Promise<OrganizationMember | null> {
    if (!profile.organization_id) return null;

    const { data, error } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('user_id', profile.id)
        .single();

    if (error) {
        console.error('[sessionScope] Error fetching organization member:', error);
        return null;
    }

    return data;
}

export async function getEffectiveOrganizationId(): Promise<string | null> {
    const userId = await getCurrentUserId();
    if (!userId) return null;

    const profile = await getProfile(userId);
    return profile?.organization_id ?? null;
}

export async function getEffectiveOwnerUserId(): Promise<string | null> {
    const userId = await getCurrentUserId();
    if (!userId) return null;

    const organizationId = await getEffectiveOrganizationId();
    if (!organizationId) return userId;

    const { data: org, error } = await supabase
        .from('organizations')
        .select('owner_id')
        .eq('id', organizationId)
        .single();

    if (error) {
        console.error('[sessionScope] Error fetching owner user id:', error);
        return userId;
    }

    return org?.owner_id || userId;
}

export async function getSessionScope(options?: { ensureProfile?: boolean; email?: string }): Promise<SessionScope> {
    const session = await getCurrentSession();
    const user = session?.user ?? await getCurrentUser();

    if (!user) {
        return {
            session,
            user: null,
            profile: null,
            member: null,
            organizationId: null,
            ownerUserId: null,
            memberStatus: null,
            isOwner: false,
            isAdmin: false
        };
    }

    const profile = options?.ensureProfile && (options.email || user.email)
        ? await ensureProfile(user.id, options.email || user.email || '')
        : await getProfile(user.id);
    const member = profile ? await getOrganizationMember(profile) : null;
    const ownerUserId = profile?.organization_id ? await getEffectiveOwnerUserId() : user.id;

    return {
        session,
        user,
        profile,
        member,
        organizationId: profile?.organization_id ?? null,
        ownerUserId,
        memberStatus: (member?.status as 'pending' | 'active' | 'blocked' | null) ?? null,
        isOwner: member?.role === 'owner',
        isAdmin: isPrivilegedAdminEmail(user.email) || profile?.role === 'admin'
    };
}
