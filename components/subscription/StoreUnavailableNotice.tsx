import React from 'react';
import { Info } from 'lucide-react';

/**
 * Aviso neutro mostrado no lugar de funções pagas no app da Google Play.
 * Não cita preço, plano, site, navegador nem forma de pagamento (regra da Play).
 */
export const STORE_UNAVAILABLE_MESSAGE = 'Esta função não está disponível nesta versão.';

export const StoreUnavailableNotice: React.FC = () => (
    <div
        role="status"
        className="flex items-center gap-3 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-[var(--text-muted)]"
    >
        <Info className="h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="text-sm">{STORE_UNAVAILABLE_MESSAGE}</p>
    </div>
);

export default StoreUnavailableNotice;
