import React, { useMemo, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import {
    Check,
    Copy,
    ExternalLink,
    Facebook,
    Globe2,
    Instagram,
    Loader2,
    Mail,
    MapPin,
    MessageCircle,
    Share2,
    Star,
    X,
    Youtube,
} from 'lucide-react';
import type { UserInfo } from '../../types';
import {
    buildCompanyShareLinks,
    buildCompanyShareMessage,
    buildCompanyShareText,
    getCompanyPrimaryShareUrl,
    getCompanyShareName,
    type CompanyShareLink,
} from '../../src/lib/companyShare';

interface CompanyShareSheetProps {
    isOpen: boolean;
    onClose: () => void;
    companyInfo: Partial<UserInfo> | null;
    fallbackName?: string;
    fallbackEmail?: string;
}

const LINK_ICONS: Record<CompanyShareLink['id'], React.ReactNode> = {
    whatsapp: <MessageCircle className="h-4 w-4" aria-hidden="true" />,
    site: <Globe2 className="h-4 w-4" aria-hidden="true" />,
    email: <Mail className="h-4 w-4" aria-hidden="true" />,
    instagram: <Instagram className="h-4 w-4" aria-hidden="true" />,
    facebook: <Facebook className="h-4 w-4" aria-hidden="true" />,
    tiktok: <i className="fab fa-tiktok text-[15px]" aria-hidden="true" />,
    youtube: <Youtube className="h-4 w-4" aria-hidden="true" />,
    reviews: <Star className="h-4 w-4" aria-hidden="true" />,
    address: <MapPin className="h-4 w-4" aria-hidden="true" />,
};

const safeFileName = (value: string): string => (
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
    || 'empresa'
);

const copyText = async (text: string): Promise<void> => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
};

const CompanyShareSheet: React.FC<CompanyShareSheetProps> = ({
    isOpen,
    onClose,
    companyInfo,
    fallbackName = 'Minha empresa',
    fallbackEmail = '',
}) => {
    const cardRef = useRef<HTMLElement>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [copied, setCopied] = useState(false);
    const [status, setStatus] = useState('');
    const company = useMemo<Partial<UserInfo>>(() => ({
        ...(companyInfo || {}),
        email: companyInfo?.email || fallbackEmail,
    }), [companyInfo, fallbackEmail]);
    const name = getCompanyShareName(company, fallbackName);
    const message = buildCompanyShareMessage(company, fallbackName);
    const shareText = buildCompanyShareText(company, fallbackName);
    const primaryUrl = getCompanyPrimaryShareUrl(company);
    const links = buildCompanyShareLinks(company);
    const cardLinks = links.filter((link) => link.id !== 'address').slice(0, 5);
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    const primaryColor = /^#[0-9a-f]{6}$/i.test(company.cores?.primaria || '')
        ? company.cores!.primaria
        : '#2563eb';

    const createCardFile = async (): Promise<File | null> => {
        if (!cardRef.current) return null;
        try {
            const { toPng } = await import('html-to-image');
            const dataUrl = await toPng(cardRef.current, {
                cacheBust: true,
                pixelRatio: 2,
                backgroundColor: '#0b1324',
            });
            const blob = await (await fetch(dataUrl)).blob();
            return new File([blob], `${safeFileName(name)}-contato.png`, { type: 'image/png' });
        } catch (error) {
            console.warn('Não foi possível gerar a imagem da ficha; compartilhando em texto.', error);
            return null;
        }
    };

    const handleShare = async () => {
        if (isSharing) return;
        setIsSharing(true);
        setStatus('');

        try {
            const file = await createCardFile();
            if (navigator.share) {
                const data: ShareData = { title: name, text: shareText, url: primaryUrl };
                if (file && navigator.canShare?.({ files: [file] })) data.files = [file];
                await navigator.share(data);
                setStatus('Ficha compartilhada.');
            } else {
                await copyText(shareText);
                setCopied(true);
                setStatus('Informações copiadas para compartilhar.');
            }
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            console.error('Erro ao compartilhar ficha da empresa:', error);
            setStatus('Não foi possível compartilhar. Tente copiar as informações.');
        } finally {
            setIsSharing(false);
        }
    };

    const handleCopy = async () => {
        try {
            await copyText(shareText);
            setCopied(true);
            setStatus('Informações copiadas.');
            window.setTimeout(() => setCopied(false), 2200);
        } catch (error) {
            console.error('Erro ao copiar ficha da empresa:', error);
            setStatus('Não foi possível copiar as informações.');
        }
    };

    return (
        <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[10040] bg-slate-950/75 backdrop-blur-md" />
                <Drawer.Content className="fixed inset-x-0 bottom-0 z-[10041] flex max-h-[94dvh] flex-col rounded-t-[28px] border-t border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] shadow-[var(--shadow-elevated)] outline-none sm:left-1/2 sm:w-[min(560px,calc(100vw-24px))] sm:-translate-x-1/2 sm:rounded-[28px] sm:border">
                    <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-[var(--border-strong)]" />

                    <div className="min-h-0 overflow-y-auto px-4 pb-5 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}>
                        <header className="mx-auto flex max-w-md items-start justify-between gap-4 px-1">
                            <div>
                                <Drawer.Title className="text-xl font-black tracking-[-0.02em] text-[var(--text-strong)]">
                                    Compartilhar empresa
                                </Drawer.Title>
                                <Drawer.Description className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                                    Confira a ficha antes de enviar aos seus clientes.
                                </Drawer.Description>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Fechar ficha da empresa"
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-muted)]"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </header>

                        <article
                            ref={cardRef}
                            data-company-share-card
                            className="relative mx-auto mt-5 max-w-md overflow-hidden rounded-[24px] border border-white/12 bg-[#0b1324] p-5 text-white shadow-[0_20px_45px_rgba(2,6,23,0.35)]"
                            style={{ backgroundImage: `radial-gradient(circle at 92% 5%, ${primaryColor}55, transparent 42%), linear-gradient(145deg, #111d34 0%, #09111f 72%)` }}
                        >
                            <div className="absolute -right-12 -top-14 h-36 w-36 rounded-full border border-white/10" aria-hidden="true" />
                            <div className="absolute -right-4 -top-5 h-20 w-20 rounded-full border border-white/10" aria-hidden="true" />

                            <div className="relative flex items-center gap-3.5">
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-white/20 bg-white text-lg font-black text-slate-800 shadow-lg">
                                    {company.logo ? (
                                        <img src={company.logo} alt="" crossOrigin="anonymous" className="h-full w-full object-contain" />
                                    ) : initials}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-300">Nossa empresa</p>
                                    <h2 className="mt-1 break-words text-[21px] font-black leading-tight tracking-[-0.025em]">{name}</h2>
                                </div>
                            </div>

                            <p className="relative mt-5 text-[13px] font-medium leading-5 text-slate-200">{message}</p>

                            {cardLinks.length ? (
                                <div className="relative mt-5 space-y-2 border-t border-white/10 pt-4">
                                    {cardLinks.map((link) => (
                                        <div key={link.id} className="flex min-w-0 items-center gap-2.5 text-[11px] text-slate-200">
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/8 text-blue-300">
                                                {LINK_ICONS[link.id]}
                                            </span>
                                            <span className="truncate">{link.display}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            <div className="relative mt-5 flex items-center justify-between border-t border-white/10 pt-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                <span>Informações de contato</span>
                                <span style={{ color: primaryColor }}>Compartilhe</span>
                            </div>
                        </article>

                        {links.length ? (
                            <div className="mx-auto mt-4 max-w-md">
                                <p className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Links incluídos</p>
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                    {links.map((link) => (
                                        <a
                                            key={link.id}
                                            href={link.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex min-w-0 items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2.5 text-left"
                                        >
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                                                {LINK_ICONS[link.id]}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{link.label}</span>
                                                <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--text-strong)]">{link.display}</span>
                                            </span>
                                            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="mx-auto mt-4 max-w-md rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] px-4 py-3 text-center text-xs text-[var(--text-muted)]">
                                Cadastre telefone, site ou redes sociais nas Configurações para enriquecer esta ficha.
                            </p>
                        )}

                        <div className="mx-auto mt-5 grid max-w-md grid-cols-[1fr_1.35fr] gap-2.5">
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 text-sm font-bold text-[var(--text-strong)]"
                            >
                                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                {copied ? 'Copiado' : 'Copiar'}
                            </button>
                            <button
                                type="button"
                                onClick={handleShare}
                                disabled={isSharing}
                                className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-blue-600 px-3 text-sm font-black text-white shadow-[0_12px_26px_rgba(37,99,235,0.26)] transition-colors hover:bg-blue-500 disabled:cursor-wait disabled:opacity-70"
                            >
                                {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                                {isSharing ? 'Preparando...' : 'Compartilhar ficha'}
                            </button>
                        </div>
                        {status ? <p role="status" className="mx-auto mt-3 max-w-md text-center text-xs font-semibold text-[var(--text-muted)]">{status}</p> : null}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
};

export default CompanyShareSheet;
