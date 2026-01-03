import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
    getSubscriptionInfo,
    getAvailableModules,
    isModuleActive,
    hasReachedLimit,
    clearSubscriptionCache,
    SubscriptionInfo,
    SubscriptionModule,
    FREE_PLAN_LIMITS
} from '../services/subscriptionService';
import { useAuth } from './AuthContext';

// Emails que têm acesso total liberado (admin)
const ADMIN_EMAILS = [
    'windowfilm.br@gmail.com',
    'windowfilm.app@gmail.com'
];

// ============================================
// TIPOS DO CONTEXTO
// ============================================

interface SubscriptionContextType {
    // Estado
    info: SubscriptionInfo | null;
    modules: SubscriptionModule[];
    isLoading: boolean;
    error: string | null;

    // Verificações rápidas
    hasModule: (moduleId: string) => boolean;
    isLimitReached: (resource: 'clients' | 'films' | 'pdfs' | 'agendamentos', currentCount: number) => boolean;
    getRemainingQuota: (resource: 'clients' | 'films' | 'pdfs' | 'agendamentos', currentCount: number) => number;

    // Módulos específicos
    canUseEstoque: boolean;
    canUseQrServicos: boolean;
    canUseColaboradores: boolean;
    canUseIA: boolean;
    canCustomize: boolean;
    canAddLocais: boolean;
    canUseCorteInteligente: boolean;
    isUnlimited: boolean;

    // Ações
    refresh: () => Promise<void>;
}

const defaultContext: SubscriptionContextType = {
    info: null,
    modules: [],
    isLoading: true,
    error: null,
    hasModule: () => false,
    isLimitReached: () => false,
    getRemainingQuota: () => 0,
    canUseEstoque: false,
    canUseQrServicos: false,
    canUseColaboradores: false,
    canUseIA: false,
    canCustomize: false,
    canAddLocais: false,
    canUseCorteInteligente: false,
    isUnlimited: false,
    refresh: async () => { }
};

const SubscriptionContext = createContext<SubscriptionContextType>(defaultContext);

// ============================================
// PROVIDER
// ============================================

interface SubscriptionProviderProps {
    children: ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
    const { user } = useAuth();
    const [info, setInfo] = useState<SubscriptionInfo | null>(null);
    const [modules, setModules] = useState<SubscriptionModule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Verificar se o usuário é admin (tem acesso total liberado)
    const isAdminUser = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

    // Carregar dados iniciais
    const loadSubscriptionData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [subscriptionInfo, availableModules] = await Promise.all([
                getSubscriptionInfo(true),
                getAvailableModules()
            ]);

            setInfo(subscriptionInfo);
            setModules(availableModules);
        } catch (err) {
            console.error('Erro ao carregar dados de assinatura:', err);
            setError('Erro ao carregar informações da assinatura');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSubscriptionData();
    }, [loadSubscriptionData]);

    // Verificações - Admin tem acesso a tudo
    const hasModule = useCallback((moduleId: string): boolean => {
        if (isAdminUser) return true; // Admin tem todos os módulos
        if (!info) return false;
        return info.active_modules.includes(moduleId);
    }, [info, isAdminUser]);

    const isLimitReached = useCallback((resource: 'clients' | 'films' | 'pdfs' | 'agendamentos', currentCount: number): boolean => {
        // Admin nunca atinge limites
        if (isAdminUser) return false;

        if (!info) return false;

        // Se tem módulo ilimitado, nunca atinge limite
        if (info.active_modules.includes('ilimitado')) return false;

        const limits = info.limits || FREE_PLAN_LIMITS;
        const usage = info.usage || { pdfs_generated: 0, agendamentos_created: 0 };

        switch (resource) {
            case 'clients':
                return currentCount >= limits.max_clients;
            case 'films':
                return currentCount >= limits.max_films;
            case 'pdfs':
                return usage.pdfs_generated >= limits.max_pdfs_month;
            case 'agendamentos':
                return usage.agendamentos_created >= limits.max_agendamentos_month;
            default:
                return false;
        }
    }, [info, isAdminUser]);

    const getRemainingQuota = useCallback((resource: 'clients' | 'films' | 'pdfs' | 'agendamentos', currentCount: number): number => {
        if (!info) return 0;

        // Se tem módulo ilimitado, retorna -1 (infinito)
        if (info.active_modules.includes('ilimitado')) return -1;

        const limits = info.limits || FREE_PLAN_LIMITS;
        const usage = info.usage || { pdfs_generated: 0, agendamentos_created: 0 };

        switch (resource) {
            case 'clients':
                return Math.max(0, limits.max_clients - currentCount);
            case 'films':
                return Math.max(0, limits.max_films - currentCount);
            case 'pdfs':
                return Math.max(0, limits.max_pdfs_month - usage.pdfs_generated);
            case 'agendamentos':
                return Math.max(0, limits.max_agendamentos_month - usage.agendamentos_created);
            default:
                return 0;
        }
    }, [info]);

    // Verificações de módulos específicos
    const canUseEstoque = hasModule('estoque');
    const canUseQrServicos = hasModule('qr_servicos');
    const canUseColaboradores = hasModule('colaboradores');
    const canUseIA = hasModule('ia_ocr');
    const canCustomize = hasModule('personalizacao');
    const canAddLocais = hasModule('locais_global');
    const canUseCorteInteligente = hasModule('corte_inteligente');
    const isUnlimited = hasModule('ilimitado');

    // Função de refresh
    const refresh = useCallback(async () => {
        clearSubscriptionCache();
        await loadSubscriptionData();
    }, [loadSubscriptionData]);

    const value: SubscriptionContextType = {
        info,
        modules,
        isLoading,
        error,
        hasModule,
        isLimitReached,
        getRemainingQuota,
        canUseEstoque,
        canUseQrServicos,
        canUseColaboradores,
        canUseIA,
        canCustomize,
        canAddLocais,
        canUseCorteInteligente,
        isUnlimited,
        refresh
    };

    return (
        <SubscriptionContext.Provider value={value}>
            {children}
        </SubscriptionContext.Provider>
    );
}

// ============================================
// HOOK
// ============================================

export function useSubscription() {
    const context = useContext(SubscriptionContext);
    if (!context) {
        throw new Error('useSubscription must be used within SubscriptionProvider');
    }
    return context;
}

// ============================================
// HOOK PARA VERIFICAÇÃO SIMPLES
// ============================================

export function useFeatureAccess(moduleId: string): {
    hasAccess: boolean;
    isLoading: boolean;
    moduleInfo: SubscriptionModule | undefined;
} {
    const { hasModule, modules, isLoading } = useSubscription();

    return {
        hasAccess: hasModule(moduleId),
        isLoading,
        moduleInfo: modules.find(m => m.id === moduleId)
    };
}
