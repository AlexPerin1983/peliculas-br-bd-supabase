export const PROPOSAL_MESSAGE_TAGS = [
    'primeiro_nome',
    'nome_cliente',
    'titulo_orcamento',
    'valor_final',
    'desconto_extra',
    'valor_especial',
    'observacao_comercial',
] as const;

export type ProposalMessageTag = (typeof PROPOSAL_MESSAGE_TAGS)[number];
export type ProposalMessageValues = Record<ProposalMessageTag, string>;

/** Modelo salvo no banco (global da organização). */
export interface ProposalMessageTemplate {
    id: number;
    title: string;
    text: string;
    sortOrder: number;
}

/** Semente usada só para popular a organização na primeira vez (sem id ainda). */
export interface ProposalMessageTemplateSeed {
    title: string;
    text: string;
}

export type FollowUpDiscountType = 'percentage' | 'fixed';

export interface FollowUpDiscountResult {
    discountValue: number;
    discountAmount: number;
    specialValue: number;
    formattedDiscount: string;
}

export const DEFAULT_PROPOSAL_MESSAGE_TEMPLATES: ProposalMessageTemplateSeed[] = [
    {
        title: 'Enviar proposta',
        text: `Oi, {{primeiro_nome}}. Tudo bem?

Acabei de preparar sua proposta.

O valor final ficou em {{valor_final}}.

Você quer que eu veja uma data disponível para instalação ou prefere tirar alguma dúvida antes?`,
    },
    {
        title: 'Confirmar se viu',
        text: `Oi, {{primeiro_nome}}. Tudo bem?

Passando só para confirmar se você conseguiu ver a proposta que te enviei.

Ficou alguma dúvida sobre o serviço, valor ou forma de pagamento?`,
    },
    {
        title: 'Entender decisão',
        text: `{{primeiro_nome}}, só para eu te orientar melhor:

O que mais pesa para você decidir agora?

1. Valor
2. Prazo para instalar
3. Tipo de película
4. Ainda está comparando
5. Vai deixar para outro momento

Qual desses pontos faz mais sentido para você?`,
    },
    {
        title: 'Condição especial',
        text: `{{primeiro_nome}}, consegui fazer um ajuste nessa proposta.

O valor original era {{valor_final}}.

Com o desconto de {{desconto_extra}}, consigo deixar por {{valor_especial}}.

Quer que eu veja uma data disponível para instalação?`,
    },
    {
        title: 'Encerramento',
        text: `{{primeiro_nome}}, vou deixar essa proposta em aberto por enquanto para não ficar te incomodando.

Mas antes queria confirmar:

Ainda pensa em fazer esse serviço ou prefere deixar para outro momento?`,
    },
];

const TAG_PATTERN = /{{\s*([^{}]+?)\s*}}/g;

export const fillProposalMessage = (template: string, values: ProposalMessageValues): string =>
    template.replace(TAG_PATTERN, (match, rawTag: string) => {
        const tag = rawTag.trim() as ProposalMessageTag;
        return PROPOSAL_MESSAGE_TAGS.includes(tag) ? (values[tag] ?? '') : match;
    });

export const findUnsupportedProposalTags = (template: string): string[] => {
    const unsupported = new Set<string>();
    for (const match of template.matchAll(TAG_PATTERN)) {
        const tag = match[1].trim();
        if (!PROPOSAL_MESSAGE_TAGS.includes(tag as ProposalMessageTag)) unsupported.add(tag);
    }
    return [...unsupported];
};

export const normalizeWhatsAppPhone = (phone?: string): string => {
    const digits = (phone ?? '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.startsWith('55') ? digits : `55${digits}`;
};

export const buildProposalWhatsAppUrl = (phone: string | undefined, message: string): string | null => {
    const normalizedPhone = normalizeWhatsAppPhone(phone);
    if (!normalizedPhone) return null;
    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
};

export const buildProposalWhatsAppAppUrl = (phone: string | undefined, message: string): string | null => {
    const normalizedPhone = normalizeWhatsAppPhone(phone);
    if (!normalizedPhone) return null;
    return `whatsapp://send?phone=${normalizedPhone}&text=${encodeURIComponent(message)}`;
};

export const buildProposalWhatsAppBusinessUrl = (
    phone: string | undefined,
    message: string,
    userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
): string | null => {
    const normalizedPhone = normalizeWhatsAppPhone(phone);
    if (!normalizedPhone) return null;
    const encodedMessage = encodeURIComponent(message);
    const webFallback = `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;

    if (/Android/i.test(userAgent)) {
        return `intent://send?phone=${normalizedPhone}&text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=${encodeURIComponent(webFallback)};end`;
    }

    if (/iPhone|iPad|iPod/i.test(userAgent)) {
        return `whatsapp-business://send?phone=${normalizedPhone}&text=${encodedMessage}`;
    }

    return webFallback;
};

const roundCurrency = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const formatPercentageBR = (value: number): string =>
    `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)}%`;

const formatCurrencyBR = (value: number): string =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const calculateFollowUpDiscount = (
    originalValue: number,
    rawDiscount: string,
    discountType: FollowUpDiscountType
): FollowUpDiscountResult => {
    const safeOriginalValue = Number.isFinite(originalValue) ? Math.max(0, originalValue) : 0;
    const parsedDiscount = Number(rawDiscount.replace(',', '.'));
    const safeDiscount = Number.isFinite(parsedDiscount) ? Math.max(0, parsedDiscount) : 0;
    const maximumDiscount = discountType === 'percentage' ? 100 : safeOriginalValue;
    const discountValue = Math.min(safeDiscount, maximumDiscount);
    const discountAmount = roundCurrency(
        discountType === 'percentage'
            ? safeOriginalValue * (discountValue / 100)
            : discountValue
    );
    const specialValue = roundCurrency(Math.max(0, safeOriginalValue - discountAmount));
    const formattedDiscount = rawDiscount.trim() === ''
        ? ''
        : discountType === 'percentage'
            ? formatPercentageBR(discountValue)
            : formatCurrencyBR(discountValue);

    return { discountValue, discountAmount, specialValue, formattedDiscount };
};
