// Vitrine da empresa na página da proposta (nota do Google, depoimentos e fotos).
// Usado pelo app (configurações e página) e pela edge function: sem imports.

export interface PortalShowcaseTestimonial {
  name: string;
  text: string;
}

export interface PortalShowcasePhoto {
  // Caminho no bucket "portfolio" (ex.: "<owner_id>/<uuid>.jpg").
  path: string;
  caption?: string;
}

export interface PortalShowcase {
  googleRating?: number | null;
  googleReviewCount?: number | null;
  testimonials?: PortalShowcaseTestimonial[];
  photos?: PortalShowcasePhoto[];
}

export interface PublicPortalShowcase {
  rating: number | null;
  reviewCount: number | null;
  reviewsUrl: string | null;
  testimonials: PortalShowcaseTestimonial[];
  photos: Array<{ url: string; caption?: string }>;
}

export const MAX_SHOWCASE_TESTIMONIALS = 3;
export const MAX_SHOWCASE_PHOTOS = 8;

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export const sanitizeShowcase = (raw: unknown): PortalShowcase => {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const rating = Number(source.googleRating);
  const count = Number(source.googleReviewCount);
  return {
    googleRating: Number.isFinite(rating) && rating > 0 ? Math.min(5, Math.round(rating * 10) / 10) : null,
    googleReviewCount: Number.isFinite(count) && count > 0 ? Math.min(1_000_000, Math.round(count)) : null,
    testimonials: (Array.isArray(source.testimonials) ? source.testimonials : [])
      .map((item: any) => ({ name: text(item?.name, 60), text: text(item?.text, 400) }))
      .filter(item => item.text)
      .slice(0, MAX_SHOWCASE_TESTIMONIALS),
    photos: (Array.isArray(source.photos) ? source.photos : [])
      .map((item: any) => ({ path: text(item?.path, 300), caption: text(item?.caption, 80) || undefined }))
      .filter(item => item.path && !item.path.includes('..'))
      .slice(0, MAX_SHOWCASE_PHOTOS),
  };
};

const safeUrl = (value: unknown) => {
  const url = text(value, 500);
  return /^https:\/\//i.test(url) ? url : null;
};

// O que a página mostra; null quando não há nada para mostrar.
export const buildPublicShowcase = (
  raw: unknown,
  reviewsUrl: unknown,
  photoUrl: (path: string) => string,
): PublicPortalShowcase | null => {
  const showcase = sanitizeShowcase(raw);
  const result: PublicPortalShowcase = {
    rating: showcase.googleRating ?? null,
    reviewCount: showcase.googleReviewCount ?? null,
    reviewsUrl: safeUrl(reviewsUrl),
    testimonials: showcase.testimonials || [],
    photos: (showcase.photos || []).map(photo => ({ url: photoUrl(photo.path), caption: photo.caption })),
  };
  return result.rating || result.testimonials.length || result.photos.length ? result : null;
};
