import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from 'vaul';
import {
    Bolt,
    Contact,
    Edit3,
    MapPin,
    MessageCircle,
    MoreHorizontal,
    Phone,
    Repeat2,
    Trash2,
    UserPlus,
    WandSparkles,
    X,
} from 'lucide-react';
import { Client } from '../types';
import { useIsMobile } from '../src/hooks/useIsMobile';

interface ClientBarProps {
    selectedClient: Client | null;
    onSelectClientClick: () => void;
    onOpenClientHub?: () => void;
    onAddClient: () => void;
    onAddClientAI?: () => void;
    onQuickProposalAI?: () => void;
    onEditClient: () => void;
    onDeleteClient: () => void;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
}

const formatAddress = (client: Client): string => {
    const parts = [
        client.logradouro,
        client.numero,
        client.bairro,
        client.cidade,
        client.uf
    ].filter(Boolean);
    return parts.join(', ');
};

const ClientBar: React.FC<ClientBarProps> = ({
    selectedClient,
    onSelectClientClick,
    onOpenClientHub,
    onAddClient,
    onAddClientAI,
    onQuickProposalAI,
    onEditClient,
    onDeleteClient,
    onSwipeLeft,
    onSwipeRight,
}) => {
    const isMobile = useIsMobile();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState<React.CSSProperties | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const menuPanelRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);

    const fullAddress = selectedClient ? formatAddress(selectedClient) : '';
    const compactLocation = selectedClient ? selectedClient.bairro || selectedClient.cidade || fullAddress : '';

    const updateMenuPosition = () => {
        if (typeof window === 'undefined' || !menuButtonRef.current) {
            return;
        }

        const viewportPadding = 16;
        const buttonRect = menuButtonRef.current.getBoundingClientRect();
        const width = Math.min(352, window.innerWidth - viewportPadding * 2);
        const left = Math.min(
            Math.max(buttonRect.right - width, viewportPadding),
            window.innerWidth - viewportPadding - width
        );
        const top = buttonRect.bottom + 8;
        const maxHeight = Math.max(220, window.innerHeight - top - viewportPadding);

        setMenuPosition({
            left,
            top,
            width,
            maxHeight,
        });
    };

    useEffect(() => {
        if (!isMenuOpen || isMobile) {
            return;
        }

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const isInsideTrigger = menuRef.current?.contains(target);
            const isInsidePanel = menuPanelRef.current?.contains(target);

            if (!isInsideTrigger && !isInsidePanel) {
                setIsMenuOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsMenuOpen(false);
            }
        };

        updateMenuPosition();
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        window.addEventListener('resize', updateMenuPosition);
        window.addEventListener('scroll', updateMenuPosition, true);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
            window.removeEventListener('resize', updateMenuPosition);
            window.removeEventListener('scroll', updateMenuPosition, true);
        };
    }, [isMenuOpen, isMobile]);

    const handleTouchStart = (event: React.TouchEvent) => {
        touchStartX.current = event.targetTouches[0].clientX;
    };

    const handleTouchMove = (event: React.TouchEvent) => {
        touchEndX.current = event.targetTouches[0].clientX;
    };

    const handleTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return;

        const distance = touchStartX.current - touchEndX.current;
        if (distance > 50) {
            onSwipeLeft();
        } else if (distance < -50) {
            onSwipeRight();
        }

        touchStartX.current = null;
        touchEndX.current = null;
    };

    const handleOpenWhatsApp = () => {
        if (!selectedClient?.telefone) return;

        let phoneNumber = selectedClient.telefone.replace(/\D/g, '');
        if (!phoneNumber.startsWith('55')) {
            phoneNumber = `55${phoneNumber}`;
        }

        const message = `Olá ${selectedClient.nome}, estou entrando em contato sobre o orçamento de películas.`;
        window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleCall = () => {
        if (!selectedClient?.telefone) return;
        window.open(`tel:${selectedClient.telefone}`, '_self');
    };

    const handleOpenMaps = () => {
        if (!fullAddress) return;
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`, '_blank');
    };

    const MenuItem: React.FC<{
        onClick: () => void;
        icon: React.ReactNode;
        label: string;
        description?: string;
        disabled?: boolean;
        isDestructive?: boolean;
        isWhatsApp?: boolean;
    }> = ({ onClick, icon, label, description, disabled = false, isDestructive = false, isWhatsApp = false }) => (
        <button
            type="button"
            onClick={() => {
                onClick();
                setIsMenuOpen(false);
            }}
            disabled={disabled}
            className={`group flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-left transition-colors ${disabled
                ? 'cursor-not-allowed opacity-45'
                : 'hover:bg-[var(--surface-muted)] active:bg-[var(--surface-muted)]'
                } ${isDestructive
                    ? 'text-red-600 dark:text-red-400'
                    : isWhatsApp
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-[var(--text-body)] hover:text-[var(--text-strong)]'
                }`}
        >
            <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-control)] ${isDestructive
                ? 'bg-red-50 dark:bg-red-950/30'
                : isWhatsApp
                    ? 'bg-emerald-50 dark:bg-emerald-950/30'
                    : 'bg-[var(--surface-muted)] text-[var(--text-muted)] group-hover:text-[var(--text-strong)]'
                }`}>
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{label}</span>
                {description && <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{description}</span>}
            </span>
        </button>
    );

    const ClientActionsMenu = () => (
        <div className="space-y-1">
            {onOpenClientHub && (
                <MenuItem
                    onClick={onOpenClientHub}
                    icon={<Contact className="h-4 w-4" aria-hidden="true" />}
                    label="Ver ficha do cliente"
                    description="Histórico, orçamentos e agenda"
                    disabled={!selectedClient}
                />
            )}
            <MenuItem
                onClick={onSelectClientClick}
                icon={<Repeat2 className="h-4 w-4" aria-hidden="true" />}
                label="Trocar cliente"
                description="Selecionar outro cadastro"
            />
            <MenuItem
                onClick={handleOpenWhatsApp}
                icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
                label="Enviar WhatsApp"
                description={selectedClient?.telefone || 'Telefone não informado'}
                disabled={!selectedClient?.telefone}
                isWhatsApp
            />
            <MenuItem
                onClick={handleCall}
                icon={<Phone className="h-4 w-4" aria-hidden="true" />}
                label="Ligar"
                description="Chamada pelo aparelho"
                disabled={!selectedClient?.telefone}
            />
            <MenuItem
                onClick={handleOpenMaps}
                icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                label="Ver endereço"
                description={compactLocation || 'Endereço não informado'}
                disabled={!fullAddress}
            />
            <div className="my-1 h-px bg-[var(--border-subtle)]" />
            <MenuItem
                onClick={onEditClient}
                icon={<Edit3 className="h-4 w-4" aria-hidden="true" />}
                label="Editar dados"
                description="Nome, contato e endereço"
                disabled={!selectedClient}
            />
            <MenuItem
                onClick={onAddClient}
                icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
                label="Novo cliente"
                description="Cadastrar outra pessoa"
            />
            {onAddClientAI && (
                <MenuItem
                    onClick={onAddClientAI}
                    icon={<WandSparkles className="h-4 w-4" aria-hidden="true" />}
                    label="Cliente com IA"
                    description="Criar cadastro assistido"
                />
            )}
            {onQuickProposalAI && (
                <MenuItem
                    onClick={onQuickProposalAI}
                    icon={<Bolt className="h-4 w-4" aria-hidden="true" />}
                    label="Proposta IA"
                    description="Criar cliente e medidas"
                />
            )}
            <div className="my-1 h-px bg-[var(--border-subtle)]" />
            <MenuItem
                onClick={onDeleteClient}
                icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                label="Excluir cliente"
                description="Remover permanentemente"
                disabled={!selectedClient}
                isDestructive
            />
        </div>
    );

    // Mobile: bottom sheet em tela cheia com arrastar-para-fechar (igual ao Totais).
    const clientActionsMenuMobile = (
        <Drawer.Root open={isMenuOpen && isMobile} onOpenChange={(open) => !open && setIsMenuOpen(false)}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[9998] bg-black/40" />
                <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[9999] flex h-[100dvh] max-h-[100dvh] flex-col border-t border-[var(--border-subtle)] bg-[var(--surface)] outline-none">
                    <div
                        className="flex-1 overflow-y-auto overscroll-contain p-4"
                        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
                    >
                        <div className="mx-auto mb-5 h-1.5 w-12 flex-shrink-0 rounded-full bg-[var(--border-strong)]" />
                        <div className="mx-auto w-full max-w-md">
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">Ações do cliente</span>
                                    <h2 className="truncate text-lg font-bold text-[var(--text-strong)]">
                                        {selectedClient?.nome || 'Cliente'}
                                    </h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                    aria-label="Fechar"
                                >
                                    <X className="h-5 w-5" aria-hidden="true" />
                                </button>
                            </div>
                            <ClientActionsMenu />
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );

    // Desktop: dropdown posicionado abaixo do botão.
    const clientActionsMenuDesktop = isMenuOpen && !isMobile && typeof document !== 'undefined'
        ? createPortal(
            <>
                <button
                    type="button"
                    aria-label="Fechar menu de acoes do cliente"
                    className="fixed inset-0 z-[9998] cursor-default bg-transparent"
                    onClick={() => setIsMenuOpen(false)}
                />
                <div
                    ref={menuPanelRef}
                    role="menu"
                    className="fixed z-[9999] overflow-y-auto overscroll-contain rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-elevated)] animate-fade-in-scale"
                    style={menuPosition || undefined}
                >
                    <ClientActionsMenu />
                </div>
            </>,
            document.body
        )
        : null;

    return (
        <div className="relative mb-4">
            <div
                ref={menuRef}
                className="relative"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ touchAction: 'pan-y' }}
            >
                {selectedClient ? (
                    <div className="relative rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2.5 shadow-[var(--shadow-soft)] animate-fade-in-scale">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onSelectClientClick}
                                className="min-w-0 flex-1 rounded-[var(--radius-control)] px-1 py-1 text-left transition-colors hover:bg-[var(--surface-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                aria-label="Trocar de cliente"
                            >
                                <h2 className="truncate text-[15px] font-bold leading-tight text-[var(--text-strong)] sm:text-base lg:text-lg">
                                    {selectedClient.nome}
                                </h2>
                                <div className="mt-1 flex min-w-0 items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
                                    {selectedClient.telefone && (
                                        <span className="inline-flex max-w-[58%] min-w-0 items-center gap-1 whitespace-nowrap text-[var(--brand-primary)]">
                                            <Phone className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                                            <span className="truncate">{selectedClient.telefone}</span>
                                        </span>
                                    )}
                                    {compactLocation && (
                                        <span className="inline-flex min-w-0 items-center gap-1 truncate">
                                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                                            <span className="truncate">{compactLocation}</span>
                                        </span>
                                    )}
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onAddClient();
                                }}
                                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--brand-primary)] text-white shadow-[0_10px_18px_rgba(21,94,239,0.18)] transition-colors hover:bg-[var(--brand-primary-strong)] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                aria-label="Cadastrar novo cliente"
                            >
                                <UserPlus className="h-5 w-5" aria-hidden="true" />
                            </button>
                            <button
                                ref={menuButtonRef}
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (!isMenuOpen) {
                                        updateMenuPosition();
                                    }
                                    setIsMenuOpen(open => !open);
                                }}
                                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] shadow-[var(--shadow-hairline)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                aria-label="Abrir acoes do cliente"
                                aria-haspopup="menu"
                                aria-expanded={isMenuOpen}
                            >
                                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="relative rounded-[var(--radius-panel)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-soft)] animate-fade-in">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onSelectClientClick}
                                className="min-w-0 flex-1 rounded-[var(--radius-control)] px-1 py-1 text-left transition-colors hover:bg-[var(--brand-primary-soft)] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Cliente</span>
                                <h2 className="truncate text-base font-bold text-[var(--text-strong)]">Selecionar cliente</h2>
                            </button>
                            <button
                                type="button"
                                onClick={onAddClient}
                                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--brand-primary)] text-white shadow-[0_10px_18px_rgba(21,94,239,0.18)] transition-colors hover:bg-[var(--brand-primary-strong)]"
                                aria-label="Adicionar cliente"
                            >
                                <UserPlus className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {clientActionsMenuDesktop}
            {clientActionsMenuMobile}

            <style>{`
                @keyframes fade-in-scale {
                    from { opacity: 0; transform: scale(0.96); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in-scale {
                    animation: fade-in-scale 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default React.memo(ClientBar);
