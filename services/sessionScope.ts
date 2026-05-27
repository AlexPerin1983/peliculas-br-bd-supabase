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

function isSessionExpired(session: Session | null): boolean {
    if (!session?.expires_at) return false;
    return session.expires_at * 1000 <= Date.now();
}

function shouldRefreshSession(session: Session | null): boolean {
    if (!session?.expires_at) return false;
    const expiresAtMs = session.expires_at * 1000;
    return expiresAtMs - Date.now() < 60_000;
}

export async function getCurrentSession(): Promise<Session | null> {
    const {
        data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
        return null;
    }

    if (shouldRefreshSession(session)) {
        const { data, error } = await supabase.auth.refreshSession();
        if (!error && data.session) {
            return data.session;
        }

        if (isSessionExpired(session)) {
            console.warn('[sessionScope] Session refresh failed for expired token:', error);
            return null;
        }
    }

    return session;
}

export async function getCurrentUser(): Promise<User | null> {
    const session = await getCurrentSession();
    if (session?.user) return session.user;

    const {
        data: { user }
    } = await supabase.auth.getUser();
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

async function getOrganizationOwnerId(organizationId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('organizations')
        .select('owner_id')
        .eq('id', organizationId)
        .maybeSingle();

    if (error) {
        console.error('[sessionScope] Error fetching organization owner:', error);
        return null;
    }

    return data?.owner_id ?? null;
}

export async function getOrganizationMember(profile: Profile): Promise<OrganizationMember | null> {
    if (!profile.organization_id) return null;

    const { data, error } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('user_id', profile.id)
        .maybeSingle();

    if (error) {
        if (error.code !== 'PGRST116') {
            console.error('[sessionScope] Error fetching organization member:', error);
        }
        return null;
    }

    if (data) {
        return data;
    }

    const ownerId = await getOrganizationOwnerId(profile.organization_id);
    if (ownerId === profile.id) {
        return {
            id: `owner-fallback-${profile.organization_id}-${profile.id}`,
            organization_id: profile.organization_id,
            user_id: profile.id,
            email: profile.email,
            role: 'owner',
            status: 'active',
            invited_at: new Date(0).toISOString(),
            joined_at: new Date(0).toISOString()
        };
    }

    return null;
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

    const ownerId = await getOrganizationOwnerId(organizationId);
    return ownerId || userId;
}

export async function getSessionScope(options?: {
    ensureProfile?: boolean;
    email?: string;
}): Promise<SessionScope> {
    const session = await getCurrentSession();
    const user = session?.user ?? (await getCurrentUser());

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

    const profile =
        options?.ensureProfile && (options.email || user.email)
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
        isAdmin: profile?.role === 'admin'
    };
}
