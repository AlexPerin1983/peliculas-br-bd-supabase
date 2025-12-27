import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { OrganizationMember } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface TeamManagementProps {
    onMemberCountChange?: (count: number) => void;
}

const TeamManagement: React.FC<TeamManagementProps> = ({ onMemberCountChange }) => {
    const { organizationId, isOwner, user, profile } = useAuth();
    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviting, setInviting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [canManageTeam, setCanManageTeam] = useState(false);

    useEffect(() => {
        if (organizationId) {
            fetchMembers();
            checkIfOwner();
        }
    }, [organizationId, user]);

    // Verificar diretamente no banco se o usuário é owner
    const checkIfOwner = async () => {
        if (!user || !organizationId) {
            setCanManageTeam(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('organization_members')
                .select('role')
                .eq('organization_id', organizationId)
                .eq('user_id', user.id)
                .single();

            if (!error && data?.role === 'owner') {
                setCanManageTeam(true);
            } else {
                // Fallback: verificar se é o owner da organização
                const { data: orgData } = await supabase
                    .from('organizations')
                    .select('owner_id')
                    .eq('id', organizationId)
                    .single();

                setCanManageTeam(orgData?.owner_id === user.id);
            }
        } catch (err) {
            console.error('Error checking owner:', err);
            setCanManageTeam(false);
        }
    };


    const fetchMembers = async () => {
        if (!organizationId) return;

        try {
            const { data, error } = await supabase
                .from('organization_members')
                .select('*')
                .eq('organization_id', organizationId)
                .order('invited_at', { ascending: false });

            if (error) throw error;
            setMembers(data || []);
            onMemberCountChange?.(data?.length || 0);
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setLoading(false);
        }
    };


    const handleInvite = async () => {
        if (!inviteEmail.trim() || !organizationId) return;

        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(inviteEmail)) {
            setError('Email inválido');
            return;
        }

        // Verificar se já existe
        const existingMember = members.find(m => m.email.toLowerCase() === inviteEmail.toLowerCase());
        if (existingMember) {
            setError('Este email já foi convidado');
            return;
        }

        setInviting(true);
        setError(null);

        try {
            const { error } = await supabase
                .from('organization_members')
                .insert({
                    organization_id: organizationId,
                    email: inviteEmail.toLowerCase().trim(),
                    role: 'member',
                    status: 'pending'
                });

            if (error) throw error;

            setSuccess('Convite enviado! O colaborador pode se cadastrar com este email.');
            setInviteEmail('');
            setTimeout(() => setSuccess(null), 5000);
            await fetchMembers();
        } catch (error: any) {
            console.error('Error inviting member:', error);
            setError(error.message || 'Erro ao enviar convite');
        } finally {
            setInviting(false);
        }
    };

    const handleToggleStatus = async (member: OrganizationMember) => {
        const newStatus = member.status === 'active' ? 'blocked' : 'active';

        try {
            const { error } = await supabase
                .from('organization_members')
                .update({ status: newStatus })
                .eq('id', member.id);

            if (error) throw error;

            setMembers(members.map(m =>
                m.id === member.id ? { ...m, status: newStatus } : m
            ));
        } catch (error) {
            console.error('Error updating member status:', error);
            setError('Erro ao atualizar status');
        }
    };

    const handleRemoveMember = async (member: OrganizationMember) => {
        if (member.role === 'owner') return;

        try {
            const { error } = await supabase
                .from('organization_members')
                .delete()
                .eq('id', member.id);

            if (error) throw error;

            setMembers(members.filter(m => m.id !== member.id));
            onMemberCountChange?.(members.length - 1);
        } catch (error) {
            console.error('Error removing member:', error);
            setError('Erro ao remover membro');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        Ativo
                    </span>
                );
            case 'pending':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                        Pendente
                    </span>
                );
            case 'blocked':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        Bloqueado
                    </span>
                );
            default:
                return null;
        }
    };

    if (!organizationId) {
        return (
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-center">
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Organização não configurada. Entre em contato com o suporte.
                </p>
            </div>
        );
    }


    return (
        <div className="space-y-4">
            {/* Mensagens */}
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                    {error}
                </div>
            )}
            {success && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">
                    {success}
                </div>
            )}

            {/* Lista de membros */}
            <div className="space-y-3">
                {loading ? (
                    <div className="p-4 text-center text-slate-500">Carregando...</div>
                ) : members.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                        Nenhum colaborador ainda. Convide usando o campo abaixo.
                    </div>
                ) : (
                    members.map(member => (
                        <div
                            key={member.id}
                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center shrink-0">
                                    <span className="text-slate-600 dark:text-slate-300 font-medium text-sm">
                                        {member.email.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-slate-800 dark:text-slate-200 font-medium truncate">
                                        {member.email}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {getStatusBadge(member.status)}
                                        {member.role === 'owner' && (
                                            <span className="px-2 py-0.5 text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full font-bold uppercase">
                                                Dono
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {member.role !== 'owner' && canManageTeam && (
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => handleToggleStatus(member)}
                                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${member.status === 'blocked'
                                            ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                                            : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50'
                                            }`}
                                    >
                                        {member.status === 'blocked' ? 'Ativar' : 'Bloquear'}
                                    </button>
                                    <button
                                        onClick={() => handleRemoveMember(member)}
                                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 h-8 w-8 rounded-full flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                        <i className="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Formulário de convite - só aparece para o dono */}
            {canManageTeam && (
                <>
                    <div className="flex items-center gap-2 pt-2">
                        <div className="flex-1">
                            <input
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="Email do colaborador"
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition-all"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleInvite();
                                    }
                                }}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleInvite}
                            disabled={inviting || !inviteEmail.trim()}
                            className="px-4 py-2.5 bg-slate-800 dark:bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {inviting ? 'Enviando...' : 'Convidar'}
                        </button>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        O colaborador receberá acesso ao fazer cadastro com o email convidado.
                    </p>
                </>
            )}
        </div>
    );
};

export default TeamManagement;

