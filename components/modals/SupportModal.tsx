import React, { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import {
    Bug,
    ChevronRight,
    Handshake,
    Headset,
    Lightbulb,
    LifeBuoy,
    Rocket,
    X,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import * as db from '../../services/db';
import { UserInfo } from '../../types';

interface SupportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Número de suporte (DDD 83). wa.me exige o código do país (55).
const SUPPORT_PHONE = '5583996476052';

type SupportOption = {
    id: string;
    label: string;
    description: string;
    category: string;
    intro: string;
    icon: React.ReactNode;
    tone: string;
};

const SUPPORT_OPTIONS: SupportOption[] = [
    {
        id: 'bug',
        label: 'Relatar bug',
        description: 'Algo não funcionou como esperado',
        category: '🐞 Relato de bug',
        intro: 'Encontrei um problema no app e quero relatar:\n\n• O que aconteceu: \n• Em qual tela: \n• O que eu esperava: ',
        icon: <Bug className="h-5 w-5" aria-hidden="true" />,
        tone: 'text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-950/30',
    },
    {
        id: 'melhoria',
        label: 'Sugerir melhoria',
        description: 'Ideia para deixar algo melhor',
        category: '💡 Sugestão de melhoria',
        intro: 'Tenho uma sugestão de melhoria:\n\n• Minha ideia: \n• O que isso resolveria: ',
        icon: <Lightbulb className="h-5 w-5" aria-hidden="true" />,
        tone: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/30',
    },
    {
        id: 'recurso',
        label: 'Solicitar novo recurso',
        description: 'Pedir uma funcionalidade nova',
        category: '🚀 Solicitação de novo recurso',
        intro: 'Gostaria de solicitar um novo recurso:\n\n• Recurso desejado: \n• Para que serviria: ',
        icon: <Rocket className="h-5 w-5" aria-hidden="true" />,
        tone: 'text-violet-600 bg-violet-50 dark:text-violet-300 dark:bg-violet-950/30',
    },
    {
        id: 'suporte',
        label: 'Falar com suporte',
        description: 'Tirar uma dúvida com a equipe',
        category: '💬 Falar com suporte',
        intro: 'Preciso falar com o suporte:\n\n• Minha dúvida: ',
        icon: <Headset className="h-5 w-5" aria-hidden="true" />,
        tone: 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/30',
    },
    {
        id: 'ajuda',
        label: 'Central de ajuda',
        description: 'Ajuda para usar o app e tutoriais',
        category: '❓ Central de ajuda',
        intro: 'Quero ajuda para usar o app / acessar tutoriais:\n\n• Sobre o que preciso de ajuda: ',
        icon: <LifeBuoy className="h-5 w-5" aria-hidden="true" />,
        tone: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/30',
    },
    {
        id: 'parceria',
        label: 'Quero ser parceiro',
        description: 'Propor uma parceria comercial',
        category: '🤝 Proposta de parceria',
        intro: 'Tenho interesse em fazer uma parceria com o PelículasBR:\n\n• Quem sou / minha empresa: \n• Tipo de parceria que tenho em mente: \n• Como acho que podemos crescer juntos: ',
        icon: <Handshake className="h-5 w-5" aria-hidden="true" />,
        tone: 'text-teal-600 bg-teal-50 dark:text-teal-300 dark:bg-teal-950/30',
    },
];

const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [isMobileViewport, setIsMobileViewport] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mediaQuery = window.matchMedia('(max-width: 639px)');
        const sync = () => setIsMobileViewport(mediaQuery.matches);
        sync();
        mediaQuery.addEventListener('change', sync);
        return () => mediaQuery.removeEventListener('change', sync);
    }, []);

    // Carrega os dados da empresa/usuário ao abrir, para identificar o contato.
    useEffect(() => {
        if (!isOpen) return;
        let active = true;
        db.getUserInfo()
            .then(info => { if (active) setUserInfo(info ?? null); })
            .catch(() => { /* sem userInfo: cai no fallback do email */ });
        return () => { active = false; };
    }, [isOpen]);

    const contactName = [userInfo?.empresa, userInfo?.nome]
        .map(part => (part || '').trim())
        .filter(Boolean)
        .join(' — ') || (user?.email?.split('@')[0] ?? 'Usuário');
    const contactEmail = (userInfo?.email || user?.email || '').trim();
    const contactPhone = (userInfo?.telefone || '').trim();

    const buildMessage = (option: SupportOption): string => {
        const footerLines = [
            '———',
            `👤 ${contactName}`,
            contactEmail ? `✉️ ${contactEmail}` : '',
            contactPhone ? `📱 ${contactPhone}` : '',
            '_Enviado pelo app PelículasBR_',
        ].filter(Boolean);

        return [
            `*${option.category}*`,
            '',
            option.intro,
            '',
            ...footerLines,
        ].join('\n');
    };

    const handleSelect = (option: SupportOption) => {
        const url = `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(buildMessage(option))}`;
        window.open(url, '_blank', 'noopener,noreferrer');
        onClose();
    };

    const optionsList = (
        <div className="space-y-2">
            {SUPPORT_OPTIONS.map(option => (
                <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className="group flex w-full items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 text-left transition-colors hover:bg-[var(--surface-muted)] active:bg-[var(--surface-muted)]"
                >
                    <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[var(--radius-control)] ${option.tone}`}>
                        {option.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-[var(--text-strong)]">{option.label}</span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{option.description}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--text-soft)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
            ))}
        </div>
    );

    const intro = (
        <p className="mb-4 text-xs leading-relaxed text-[var(--text-muted)]">
            Escolha um assunto e abriremos o WhatsApp com uma mensagem pronta, já identificada com seus dados.
        </p>
    );

    if (isMobileViewport) {
        return (
            <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm" />
                    <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[10001] flex max-h-[88vh] flex-col rounded-t-[28px] border-t border-[var(--border-subtle)] bg-[var(--surface)] outline-none shadow-2xl">
                        <div className="flex-shrink-0 px-5 pb-2 pt-3">
                            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[var(--border-strong)]" />
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <Drawer.Title className="text-lg font-bold text-[var(--text-strong)]">
                                        Suporte PelículasBR
                                    </Drawer.Title>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Fechar"
                                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                >
                                    <X className="h-5 w-5" aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-1">
                            {intro}
                            {optionsList}
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Suporte PelículasBR">
            {intro}
            {optionsList}
        </Modal>
    );
};

export default SupportModal;
