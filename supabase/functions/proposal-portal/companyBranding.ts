import { buildPublicShowcase } from './portalShowcase.ts';

export interface CompanyOrganizationSource {
  name?: string | null;
  owner_id?: string | null;
}

export interface CompanyUserInfoSource {
  user_id?: string | null;
  empresa?: string | null;
  telefone?: string | null;
  email?: string | null;
  logo?: string | null;
  cores?: unknown;
  portal_showcase?: unknown;
  social_links?: { googleReviews?: unknown } | null;
}

export const selectCompanyBranding = (
  organization: CompanyOrganizationSource | null,
  infos: CompanyUserInfoSource[] = [],
  createdBy?: string | null,
  // Endereço público de uma foto da vitrine (bucket "portfolio").
  photoUrl: (path: string) => string = path => path,
) => {
  const ownerInfo = infos.find(info => info.user_id === organization?.owner_id);
  const creatorInfo = infos.find(info => info.user_id === createdBy);
  const showcaseInfo = ownerInfo?.portal_showcase ? ownerInfo : creatorInfo?.portal_showcase ? creatorInfo : ownerInfo;

  // A marca pertence ao tenant. Dados do criador servem somente de fallback
  // para portais legados em que o owner ainda nao possuia user_info.
  return {
    name: ownerInfo?.empresa || creatorInfo?.empresa || organization?.name || 'Empresa',
    phone: ownerInfo?.telefone || creatorInfo?.telefone || null,
    email: ownerInfo?.email || creatorInfo?.email || null,
    logo: ownerInfo?.logo || creatorInfo?.logo || null,
    colors: ownerInfo?.cores || creatorInfo?.cores || null,
    showcase: buildPublicShowcase(
      showcaseInfo?.portal_showcase,
      ownerInfo?.social_links?.googleReviews || creatorInfo?.social_links?.googleReviews,
      photoUrl,
    ),
  };
};
