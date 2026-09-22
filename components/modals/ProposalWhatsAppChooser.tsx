import React from 'react';
import { BriefcaseBusiness, MessageCircle, Smartphone } from 'lucide-react';
import Modal from '../ui/Modal';

interface ProposalWhatsAppChooserProps {
    clientName: string;
    appUrl: string;
    businessUrl: string;
    onClose: () => void;
}

const ProposalWhatsAppChooser: React.FC<ProposalWhatsAppChooserProps> = ({ clientName, appUrl, businessUrl, onClose }) => (
    <Modal
        isOpen={true}
        onClose={onClose}
        wrapperClassName="backdrop-blur-sm"
        title={(
            <span className="inline-flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-emerald-500 text-white shadow-[0_8px_18px_rgba(5,150,105,0.24)]">
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>Escolher WhatsApp</span>
            </span>
        )}
    >
        <div className="space-y-4">
            <div className="rounded-[14px] border border-emerald-100 bg-emerald-50/70 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/25">
                <p className="text-sm font-bold text-[var(--text-strong)]">Mensagem pronta para {clientName}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">Escolha onde deseja abrir a conversa. A mensagem não será enviada automaticamente.</p>
            </div>

            <div className="grid gap-3">
                <a
                    href={appUrl}
                    onClick={onClose}
                    className="flex min-h-14 items-center gap-3 rounded-[14px] bg-emerald-600 px-4 py-3 text-white shadow-[0_10px_22px_rgba(5,150,105,0.22)] transition-all duration-200 hover:bg-emerald-700 active:scale-[0.99]"
                >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-white/16">
                        <Smartphone className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 text-left">
                        <span className="block text-sm font-black">WhatsApp do celular</span>
                        <span className="block text-[11px] font-medium text-white/72">Abrir o aplicativo instalado</span>
                    </span>
                </a>

                <a
                    href={businessUrl}
                    onClick={onClose}
                    className="flex min-h-14 items-center gap-3 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-[var(--text-strong)] transition-all duration-200 hover:border-blue-200 hover:bg-blue-50 active:scale-[0.99] dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20"
                >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-blue-50 text-[var(--brand-primary)] dark:bg-blue-950/40">
                        <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 text-left">
                        <span className="block text-sm font-black">WhatsApp Business</span>
                        <span className="block text-[11px] font-medium text-[var(--text-muted)]">Abrir o aplicativo Business</span>
                    </span>
                </a>
            </div>

            <button type="button" onClick={onClose} className="h-11 w-full rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface)] text-sm font-bold text-[var(--text-body)] transition-colors duration-200 hover:bg-[var(--surface-muted)]">
                Cancelar
            </button>
        </div>
    </Modal>
);

export default ProposalWhatsAppChooser;
