import React, { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, LoaderCircle, Plus, Star, Trash2, X } from 'lucide-react';
import {
    deletePortfolioPhoto,
    getPortalShowcase,
    getPortfolioPhotoUrl,
    savePortalShowcase,
    uploadPortfolioPhoto,
} from '../../services/supabaseDb';
import {
    MAX_SHOWCASE_PHOTOS,
    MAX_SHOWCASE_TESTIMONIALS,
    type PortalShowcase,
} from '../../supabase/functions/proposal-portal/portalShowcase';

type Status = 'loading' | 'idle' | 'saving' | 'saved' | 'error';

const PHOTO_MAX_SIDE = 1600;

const loadImage = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível abrir esta imagem. Use JPG ou PNG.')); };
    image.src = url;
});

// Fotos do celular chegam com vários MB: reduz para 1600px (JPEG 82%) antes de enviar.
const preparePhoto = async (file: File): Promise<Blob> => {
    const image = await loadImage(file);
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a imagem.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) throw new Error('Não foi possível preparar a imagem.');
    return blob;
};

const parseRating = (value: string) => {
    const number = Number(value.replace(',', '.'));
    return Number.isFinite(number) && number > 0 ? Math.min(5, number) : null;
};

/** Vitrine da empresa na página da proposta: nota do Google, depoimentos e fotos de trabalhos. */
const PortalShowcaseSettings: React.FC = () => {
    const [showcase, setShowcase] = useState<PortalShowcase>({ testimonials: [], photos: [] });
    const [ratingText, setRatingText] = useState('');
    const [status, setStatus] = useState<Status>('loading');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let active = true;
        getPortalShowcase()
            .then(data => {
                if (!active) return;
                setShowcase({ ...data, testimonials: data.testimonials || [], photos: data.photos || [] });
                setRatingText(data.googleRating ? String(data.googleRating).replace('.', ',') : '');
                setStatus('idle');
            })
            .catch(err => { console.error('[PortalShowcaseSettings] Falha ao carregar:', err); if (active) { setStatus('error'); setError('Não foi possível carregar a vitrine.'); } });
        return () => { active = false; };
    }, []);

    const persist = async (next: PortalShowcase) => {
        setStatus('saving');
        setError('');
        try {
            await savePortalShowcase(next);
            setStatus('saved');
            window.setTimeout(() => setStatus(current => (current === 'saved' ? 'idle' : current)), 1800);
        } catch (err) {
            console.error('[PortalShowcaseSettings] Falha ao salvar:', err);
            setStatus('error');
            setError('Não foi possível salvar. Tente novamente.');
        }
    };

    const withRating = (): PortalShowcase => ({ ...showcase, googleRating: parseRating(ratingText) });
    const testimonials = showcase.testimonials || [];
    const photos = showcase.photos || [];

    const updateTestimonial = (index: number, field: 'name' | 'text', value: string) =>
        setShowcase(current => ({ ...current, testimonials: (current.testimonials || []).map((item, position) => (position === index ? { ...item, [field]: value } : item)) }));

    // Fotos: enviar e remover já salvam a vitrine (o arquivo e a lista ficam sempre juntos).
    const addPhotos = async (files: FileList | null) => {
        if (!files?.length) return;
        const room = MAX_SHOWCASE_PHOTOS - photos.length;
        const selected = Array.from(files).slice(0, Math.max(0, room));
        if (selected.length === 0) return;
        setUploading(true);
        setError('');
        try {
            const added: Array<{ path: string }> = [];
            for (const file of selected) {
                const blob = await preparePhoto(file);
                added.push({ path: await uploadPortfolioPhoto(blob) });
            }
            const next = { ...withRating(), photos: [...photos, ...added] };
            setShowcase(next);
            await persist(next);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível enviar a foto.');
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const removePhoto = async (path: string) => {
        const next = { ...withRating(), photos: photos.filter(photo => photo.path !== path) };
        setShowcase(next);
        await persist(next);
        deletePortfolioPhoto(path).catch(err => console.warn('[PortalShowcaseSettings] Foto não apagada do armazenamento:', err));
    };

    if (status === 'loading') {
        return <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando…</p>;
    }

    return (
        <div className="space-y-6 text-sm">
            <p className="text-[13px] leading-5 text-[var(--text-muted)]">
                Aparece na página que o cliente abre pelo link da proposta. Prova de que outros clientes ficaram satisfeitos ajuda muito na decisão.
            </p>

            <section className="space-y-2" aria-label="Avaliações no Google">
                <h4 className="flex items-center gap-1.5 font-semibold text-[var(--text-strong)]"><Star className="h-4 w-4 text-amber-500" aria-hidden="true" /> Avaliações no Google</h4>
                <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                        <span className="text-xs text-[var(--text-muted)]">Nota (0 a 5)</span>
                        <input value={ratingText} onChange={event => setRatingText(event.target.value)} inputMode="decimal" placeholder="4,9" aria-label="Nota no Google"
                            style={{ fontSize: 16 }} className="ui-field mt-1 h-11 w-full px-3" />
                    </label>
                    <label className="block">
                        <span className="text-xs text-[var(--text-muted)]">Quantas avaliações</span>
                        <input value={showcase.googleReviewCount ?? ''} onChange={event => setShowcase(current => ({ ...current, googleReviewCount: Number(event.target.value.replace(/\D/g, '')) || null }))}
                            inputMode="numeric" placeholder="127" aria-label="Quantidade de avaliações no Google" style={{ fontSize: 16 }} className="ui-field mt-1 h-11 w-full px-3" />
                    </label>
                </div>
                <p className="text-xs text-[var(--text-muted)]">Use os números do seu perfil no Google. O link "Ver no Google" usa o link de avaliação cadastrado em Redes Sociais.</p>
            </section>

            <section className="space-y-2" aria-label="Depoimentos">
                <h4 className="font-semibold text-[var(--text-strong)]">Depoimentos de clientes</h4>
                <p className="text-xs text-[var(--text-muted)]">Copie avaliações reais do Google ou do WhatsApp (com o nome que o cliente autorizou).</p>
                {testimonials.map((item, index) => (
                    <div key={index} className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                        <div className="flex items-center gap-2">
                            <input value={item.name} onChange={event => updateTestimonial(index, 'name', event.target.value)} placeholder="Nome (ex.: Maria S.)" aria-label={`Nome do depoimento ${index + 1}`}
                                style={{ fontSize: 16 }} className="ui-field h-10 min-w-0 flex-1 px-3" />
                            <button type="button" onClick={() => setShowcase(current => ({ ...current, testimonials: (current.testimonials || []).filter((_, position) => position !== index) }))}
                                aria-label={`Remover depoimento ${index + 1}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-red-600">
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                        <textarea value={item.text} onChange={event => updateTestimonial(index, 'text', event.target.value)} rows={3} maxLength={400} placeholder="O que o cliente disse"
                            aria-label={`Texto do depoimento ${index + 1}`} style={{ fontSize: 16 }} className="ui-field w-full resize-y p-3 leading-6" />
                    </div>
                ))}
                {testimonials.length < MAX_SHOWCASE_TESTIMONIALS ? (
                    <div className="text-xs font-semibold">
                        <button type="button" onClick={() => setShowcase(current => ({ ...current, testimonials: [...(current.testimonials || []), { name: '', text: '' }] }))}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-subtle)] px-3 text-[var(--brand-primary)]">
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Adicionar depoimento
                        </button>
                    </div>
                ) : null}
            </section>

            <section className="space-y-2" aria-label="Fotos de trabalhos">
                <h4 className="font-semibold text-[var(--text-strong)]">Fotos de trabalhos ({photos.length}/{MAX_SHOWCASE_PHOTOS})</h4>
                <p className="text-xs text-[var(--text-muted)]">Antes e depois, fachadas, salas e carros. Evite mostrar placas de rua ou o número da casa do cliente.</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {photos.map((photo, index) => (
                        <div key={photo.path} className="space-y-1">
                            <div className="relative aspect-square overflow-hidden rounded-xl bg-[var(--surface-muted)]">
                                <img src={getPortfolioPhotoUrl(photo.path)} alt={photo.caption || `Trabalho ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
                                <button type="button" onClick={() => void removePhoto(photo.path)} aria-label={`Remover foto ${index + 1}`}
                                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                            </div>
                            <input value={photo.caption || ''} onChange={event => setShowcase(current => ({ ...current, photos: (current.photos || []).map(item => (item.path === photo.path ? { ...item, caption: event.target.value } : item)) }))}
                                placeholder="Legenda" aria-label={`Legenda da foto ${index + 1}`} style={{ fontSize: 16 }} className="ui-field h-9 w-full px-2" />
                        </div>
                    ))}
                    {photos.length < MAX_SHOWCASE_PHOTOS ? (
                        <label className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border-subtle)] text-xs font-semibold text-[var(--brand-primary)] ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
                            {uploading ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-5 w-5" aria-hidden="true" />}
                            {uploading ? 'Enviando…' : 'Adicionar'}
                            <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" aria-label="Adicionar fotos de trabalhos" onChange={event => void addPhotos(event.target.files)} />
                        </label>
                    ) : null}
                </div>
            </section>

            {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}

            <div className="flex items-center justify-end gap-3 text-sm font-semibold">
                {status === 'saved' ? <span className="inline-flex items-center gap-1 text-emerald-600"><Check className="h-4 w-4" aria-hidden="true" /> Salvo</span> : null}
                <button type="button" disabled={status === 'saving' || uploading} onClick={() => void persist(withRating())}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 text-white disabled:opacity-60">
                    {status === 'saving' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null} Salvar página da proposta
                </button>
            </div>
        </div>
    );
};

export default PortalShowcaseSettings;
