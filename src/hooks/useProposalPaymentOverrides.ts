import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProposalPaymentConfig, UserInfo } from '../../types';

const STORAGE_KEY = 'peliculas-br-proposal-payment-overrides-v1';

type StoredProposalPaymentOverride = ProposalPaymentConfig & {
    updatedAt: string;
};

type StoredProposalPaymentOverrides = Record<string, StoredProposalPaymentOverride>;

const clonePaymentMethods = (methods: ProposalPaymentConfig['paymentMethods'] = []) =>
    methods.map(method => ({ ...method }));

const sanitizeOptionKey = (optionName: string) => optionName.trim().toLowerCase();

const buildStorageKey = (clientId: number, optionName: string) => `${clientId}:${sanitizeOptionKey(optionName)}`;

const readStoredOverrides = (): StoredProposalPaymentOverrides => {
    if (typeof window === 'undefined') {
        return {};
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {};
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {};
        }

        return parsed;
    } catch (error) {
        console.warn('[ProposalPaymentOverrides] Falha ao ler overrides salvos:', error);
        return {};
    }
};

export const getDefaultProposalPaymentConfig = (userInfo: UserInfo | null): ProposalPaymentConfig => ({
    paymentMethods: clonePaymentMethods(userInfo?.payment_methods),
    prazoPagamento: userInfo?.prazoPagamento || ''
});

/**
 * Resolve a configuração de pagamento de uma proposta (cliente + opção) fora de um
 * componente React — usa o override salvo no localStorage e, se não houver, cai para
 * o padrão da empresa. Espelha exatamente a regra de `effectivePaymentConfig` do hook,
 * para que o orçamento gerado em segundo plano use a mesma config que a tela usaria.
 */
export const resolveProposalPaymentConfig = (
    clientId: number | null | undefined,
    optionName: string | null | undefined,
    userInfo: UserInfo | null
): ProposalPaymentConfig => {
    if (clientId && optionName?.trim()) {
        const override = readStoredOverrides()[buildStorageKey(clientId, optionName)];
        if (override) {
            return {
                paymentMethods: clonePaymentMethods(override.paymentMethods),
                prazoPagamento: override.prazoPagamento || ''
            };
        }
    }

    return getDefaultProposalPaymentConfig(userInfo);
};

interface UseProposalPaymentOverridesParams {
    selectedClientId: number | null;
    activeOptionName: string | null;
    userInfo: UserInfo | null;
}

export function useProposalPaymentOverrides({
    selectedClientId,
    activeOptionName,
    userInfo
}: UseProposalPaymentOverridesParams) {
    const [storedOverrides, setStoredOverrides] = useState<StoredProposalPaymentOverrides>(() => readStoredOverrides());

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedOverrides));
    }, [storedOverrides]);

    const activeStorageKey = useMemo(() => {
        if (!selectedClientId || !activeOptionName?.trim()) {
            return null;
        }

        return buildStorageKey(selectedClientId, activeOptionName);
    }, [selectedClientId, activeOptionName]);

    const activeOverride = activeStorageKey ? storedOverrides[activeStorageKey] ?? null : null;

    const effectivePaymentConfig = useMemo<ProposalPaymentConfig>(() => {
        if (activeOverride) {
            return {
                paymentMethods: clonePaymentMethods(activeOverride.paymentMethods),
                prazoPagamento: activeOverride.prazoPagamento || ''
            };
        }

        return getDefaultProposalPaymentConfig(userInfo);
    }, [activeOverride, userInfo]);

    const saveActiveOverride = useCallback(async (config: ProposalPaymentConfig) => {
        if (!activeStorageKey) {
            return;
        }

        setStoredOverrides(current => ({
            ...current,
            [activeStorageKey]: {
                paymentMethods: clonePaymentMethods(config.paymentMethods),
                prazoPagamento: config.prazoPagamento || '',
                updatedAt: new Date().toISOString()
            }
        }));
    }, [activeStorageKey]);

    const clearActiveOverride = useCallback(async () => {
        if (!activeStorageKey) {
            return;
        }

        setStoredOverrides(current => {
            if (!current[activeStorageKey]) {
                return current;
            }

            const next = { ...current };
            delete next[activeStorageKey];
            return next;
        });
    }, [activeStorageKey]);

    const renameOverride = useCallback((clientId: number, previousOptionName: string, nextOptionName: string) => {
        const previousKey = buildStorageKey(clientId, previousOptionName);
        const nextKey = buildStorageKey(clientId, nextOptionName);

        if (previousKey === nextKey) {
            return;
        }

        setStoredOverrides(current => {
            const existing = current[previousKey];
            if (!existing) {
                return current;
            }

            const next = { ...current };
            delete next[previousKey];
            next[nextKey] = {
                ...existing,
                updatedAt: new Date().toISOString()
            };
            return next;
        });
    }, []);

    const deleteOverride = useCallback((clientId: number, optionName: string) => {
        const key = buildStorageKey(clientId, optionName);

        setStoredOverrides(current => {
            if (!current[key]) {
                return current;
            }

            const next = { ...current };
            delete next[key];
            return next;
        });
    }, []);

    return {
        effectivePaymentConfig,
        hasActiveOverride: !!activeOverride,
        saveActiveOverride,
        clearActiveOverride,
        renameOverride,
        deleteOverride
    };
}
