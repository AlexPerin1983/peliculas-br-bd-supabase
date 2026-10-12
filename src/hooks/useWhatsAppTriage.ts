import { useCallback, useEffect, useState } from 'react';
import { listWhatsAppTriage, type TriageList } from '../../services/whatsappTriageService';

const REFRESH_MS = 120_000;

/** Lista da triagem do WhatsApp conectado; vazia (enabled: false) para quem não tem a conexão. */
export const useWhatsAppTriage = () => {
    const [state, setState] = useState<TriageList>({ enabled: false, pending: [], recent: [] });

    const refresh = useCallback(async () => {
        setState(await listWhatsAppTriage());
    }, []);

    useEffect(() => {
        void refresh();
        const timer = window.setInterval(() => {
            if (!document.hidden) void refresh();
        }, REFRESH_MS);
        return () => window.clearInterval(timer);
    }, [refresh]);

    return { ...state, refresh };
};
