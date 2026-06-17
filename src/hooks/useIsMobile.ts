import { useEffect, useState } from 'react';

/**
 * Retorna true quando a viewport está no breakpoint mobile (<= maxWidth).
 * Usado onde a decisão precisa ser em JS (ex.: direção do drawer vaul),
 * não só CSS responsivo.
 */
export const useIsMobile = (maxWidth = 639): boolean => {
    const query = `(max-width: ${maxWidth}px)`;
    const [isMobile, setIsMobile] = useState<boolean>(() =>
        typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
    );

    useEffect(() => {
        const mql = window.matchMedia(query);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        setIsMobile(mql.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [query]);

    return isMobile;
};
