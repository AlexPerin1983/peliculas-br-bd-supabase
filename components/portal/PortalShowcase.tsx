import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Quote, Star, X } from 'lucide-react';
import type { PublicPortalShowcase } from '../../supabase/functions/proposal-portal/portalShowcase';

const formatRating = (rating: number) => rating.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "★ 4,9 · 127 avaliações no Google" (logo abaixo do título da proposta). */
export const PortalRatingLine: React.FC<{ showcase?: PublicPortalShowcase | null }> = ({ showcase }) => {
    if (!showcase?.rating) return null;
    const content = (
        <>
            <span className="inline-flex items-center gap-0.5 text-amber-500" aria-hidden="true">
                {[1, 2, 3, 4, 5].map(value => (
                    <Star key={value} className="h-3.5 w-3.5" fill={value <= Math.round(showcase.rating!) ? 'currentColor' : 'none'} />
                ))}
            </span>
            <span className="font-semibold text-slate-900">{formatRating(showcase.rating)}</span>
            {showcase.reviewCount ? <span className="text-slate-500">· {showcase.reviewCount.toLocaleString('pt-BR')} avaliações no Google</span> : <span className="text-slate-500">no Google</span>}
        </>
    );
    return (
        <p className="mt-3 text-sm">
            {showcase.reviewsUrl ? (
                <a href={showcase.reviewsUrl} target="_blank" rel="noreferrer" className="inline-flex flex-wrap items-center gap-1.5 hover:underline" aria-label={`Nota ${formatRating(showcase.rating)} no Google`}>{content}</a>
            ) : (
                <span className="inline-flex flex-wrap items-center gap-1.5" aria-label={`Nota ${formatRating(showcase.rating)} no Google`}>{content}</span>
            )}
        </p>
    );
};

const Lightbox: React.FC<{ photos: PublicPortalShowcase['photos']; index: number; onChange: (index: number) => void; onClose: () => void }> = ({ photos, index, onChange, onClose }) => {
    const photo = photos[index];
    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowRight') onChange(Math.min(photos.length - 1, index + 1));
            if (event.key === 'ArrowLeft') onChange(Math.max(0, index - 1));
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [index, photos.length, onChange, onClose]);

    return (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="Foto do trabalho">
            <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80">
                <span className="tabular-nums">{index + 1} de {photos.length}</span>
                <button type="button" onClick={onClose} aria-label="Fechar foto" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
                <img src={photo.url} alt={photo.caption || `Trabalho ${index + 1}`} className="max-h-full max-w-full rounded-lg object-contain" />
                {index > 0 ? (
                    <button type="button" onClick={() => onChange(index - 1)} aria-label="Foto anterior" className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"><ChevronLeft className="h-5 w-5" /></button>
                ) : null}
                {index < photos.length - 1 ? (
                    <button type="button" onClick={() => onChange(index + 1)} aria-label="Próxima foto" className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"><ChevronRight className="h-5 w-5" /></button>
                ) : null}
            </div>
            <p className="min-h-12 px-5 py-4 text-center text-sm text-white/85" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>{photo.caption || ''}</p>
        </div>
    );
};

/** Trabalhos que a empresa já fez e o que os clientes dizem (prova social). */
export const PortalShowcaseSection: React.FC<{ showcase?: PublicPortalShowcase | null; companyName: string }> = ({ showcase, companyName }) => {
    const [openPhoto, setOpenPhoto] = useState<number | null>(null);
    if (!showcase || (showcase.photos.length === 0 && showcase.testimonials.length === 0)) return null;

    return (
        <section className="mt-10 space-y-8" aria-label={`Sobre a ${companyName}`}>
            {showcase.photos.length > 0 ? (
                <div aria-label="Trabalhos que já fizemos" role="region">
                    <h2 className="text-lg font-semibold tracking-[-0.01em] text-slate-950">Trabalhos que já fizemos</h2>
                    <div className="-mx-5 mt-3 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {showcase.photos.map((photo, index) => (
                            <button key={photo.url} type="button" onClick={() => setOpenPhoto(index)} aria-label={`Ver foto ${index + 1}${photo.caption ? `: ${photo.caption}` : ''}`}
                                className="w-44 shrink-0 snap-start text-left">
                                <span className="block aspect-[4/3] overflow-hidden rounded-xl bg-slate-200">
                                    <img src={photo.url} alt={photo.caption || `Trabalho ${index + 1}`} loading="lazy" className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]" />
                                </span>
                                {photo.caption ? <span className="mt-1.5 block truncate text-xs text-slate-500">{photo.caption}</span> : null}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}

            {showcase.testimonials.length > 0 ? (
                <div aria-label="O que dizem nossos clientes" role="region">
                    <div className="flex items-baseline justify-between gap-3">
                        <h2 className="text-lg font-semibold tracking-[-0.01em] text-slate-950">O que dizem nossos clientes</h2>
                        {showcase.reviewsUrl ? (
                            <a href={showcase.reviewsUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[var(--portal-brand)]">
                                Ver no Google <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        ) : null}
                    </div>
                    <div className="mt-3 space-y-3">
                        {showcase.testimonials.map((item, index) => (
                            <figure key={index} className="rounded-2xl border border-black/[0.07] bg-white px-5 py-4">
                                <Quote className="h-4 w-4 text-[var(--portal-brand)] opacity-60" aria-hidden="true" />
                                <blockquote className="mt-1.5 text-[15px] leading-6 text-slate-700">{item.text}</blockquote>
                                {item.name ? <figcaption className="mt-2 text-sm font-medium text-slate-900">{item.name}</figcaption> : null}
                            </figure>
                        ))}
                    </div>
                </div>
            ) : null}

            {openPhoto != null ? <Lightbox photos={showcase.photos} index={openPhoto} onChange={setOpenPhoto} onClose={() => setOpenPhoto(null)} /> : null}
        </section>
    );
};
