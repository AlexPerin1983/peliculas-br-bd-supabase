import { Agendamento, Client, SavedPDF, UserInfo } from '../../types';

export interface ReceiptDetails {
    receiptNumber: string;
    issuedAt: string;
    serviceDate: string;
    amount: number;
    amountInWords: string;
    description: string;
    paymentMethod?: string;
    client: { name: string; document?: string; address?: string; phone?: string };
    company: {
        name: string;
        responsible?: string;
        document?: string;
        address?: string;
        phone?: string;
        email?: string;
        logo?: string;
        signature?: string;
        primaryColor?: string;
    };
}

const ONES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const TEENS = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const HUNDREDS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

const underThousandToWords = (value: number): string => {
    if (value === 0) return '';
    if (value === 100) return 'cem';
    const parts: string[] = [];
    const hundred = Math.floor(value / 100);
    const remainder = value % 100;
    if (hundred) parts.push(HUNDREDS[hundred]);
    if (remainder) {
        const suffix = remainder < 10
            ? ONES[remainder]
            : remainder < 20
                ? TEENS[remainder - 10]
                : [TENS[Math.floor(remainder / 10)], remainder % 10 ? ONES[remainder % 10] : ''].filter(Boolean).join(' e ');
        parts.push(suffix);
    }
    return parts.join(' e ');
};

const integerToWords = (value: number): string => {
    if (value === 0) return 'zero';
    const groups = [
        { size: 1_000_000_000, singular: 'bilhão', plural: 'bilhões' },
        { size: 1_000_000, singular: 'milhão', plural: 'milhões' },
        { size: 1_000, singular: 'mil', plural: 'mil' },
        { size: 1, singular: '', plural: '' },
    ];
    const parts: string[] = [];
    let remainder = value;
    groups.forEach(({ size, singular, plural }) => {
        const count = Math.floor(remainder / size);
        if (!count) return;
        remainder %= size;
        if (size === 1_000 && count === 1) parts.push('mil');
        else parts.push(`${underThousandToWords(count)} ${count === 1 ? singular : plural}`.trim());
    });
    return parts.join(remainder > 0 && remainder < 100 ? ' e ' : ', ');
};

export const amountToWordsBRL = (amount: number): string => {
    const centsTotal = Math.round(Math.max(0, amount) * 100);
    const reais = Math.floor(centsTotal / 100);
    const cents = centsTotal % 100;
    const parts: string[] = [];
    if (reais || !cents) parts.push(`${integerToWords(reais)} ${reais === 1 ? 'real' : 'reais'}`);
    if (cents) parts.push(`${integerToWords(cents)} ${cents === 1 ? 'centavo' : 'centavos'}`);
    return parts.join(' e ');
};

export const formatReceiptCurrency = (value: number): string =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatReceiptDate = (iso: string): string =>
    new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(iso));

const clientAddress = (client?: Client): string | undefined => {
    if (!client) return undefined;
    const street = [client.logradouro, client.numero].filter(Boolean).join(', ');
    const city = [client.cidade, client.uf].filter(Boolean).join('/');
    return [street, client.complemento, client.bairro, city, client.cep].filter(Boolean).join(' - ') || undefined;
};

const DEFAULT_RECEIPT_DESCRIPTION = 'Serviço de fornecimento e aplicação de películas';
const MAX_RECEIPT_DESCRIPTION_LENGTH = 300;

const isMeaningfulReceiptText = (value?: string | null): value is string => {
    const normalized = value?.trim().toLocaleLowerCase('pt-BR');
    return Boolean(normalized && normalized !== 'desconhecido' && normalized !== 'não informado');
};

const uniqueReceiptValues = (values: Array<string | undefined>): string[] => {
    const seen = new Set<string>();
    return values.reduce<string[]>((result, value) => {
        if (!isMeaningfulReceiptText(value)) return result;
        const trimmed = value.trim().replace(/\s+/g, ' ');
        const key = trimmed.toLocaleLowerCase('pt-BR');
        if (!seen.has(key)) {
            seen.add(key);
            result.push(trimmed);
        }
        return result;
    }, []);
};

const joinReceiptValues = (values: string[]): string => {
    if (values.length <= 1) return values[0] || '';
    return `${values.slice(0, -1).join(', ')} e ${values[values.length - 1]}`;
};

const truncateReceiptDescription = (
    value: string,
    maxLength = MAX_RECEIPT_DESCRIPTION_LENGTH,
): string => {
    if (value.length <= maxLength) return value;

    const available = maxLength - 1;
    const candidate = value.slice(0, available + 1);
    const breakPoints = [candidate.lastIndexOf(';'), candidate.lastIndexOf(','), candidate.lastIndexOf(' ')];
    const naturalBreak = Math.max(...breakPoints);
    const cutAt = naturalBreak > 0 ? naturalBreak : available;
    const shortened = value
        .slice(0, cutAt)
        .trim()
        .replace(/[,:;—-]+$/u, '')
        .trimEnd();

    return `${shortened}…`;
};

const describeReceiptValues = (
    singularLabel: string,
    pluralLabel: string,
    values: string[],
): string | undefined => {
    if (!values.length) return undefined;
    return `${values.length > 1 ? pluralLabel : singularLabel}: ${joinReceiptValues(values)}`;
};

export function getDefaultReceiptDescription(linkedPdf?: SavedPDF): string;
export function getDefaultReceiptDescription(linkedPdfs?: readonly SavedPDF[]): string;
export function getDefaultReceiptDescription(linkedPdfOrPdfs?: SavedPDF | readonly SavedPDF[]): string;
export function getDefaultReceiptDescription(
    linkedPdfOrPdfs?: SavedPDF | readonly SavedPDF[],
): string {
    const linkedPdfs = Array.isArray(linkedPdfOrPdfs)
        ? linkedPdfOrPdfs
        : linkedPdfOrPdfs
            ? [linkedPdfOrPdfs as SavedPDF]
            : [];
    const measurements = linkedPdfs.flatMap((pdf) => pdf.measurements || []);
    const proposalNames = uniqueReceiptValues(linkedPdfs.map((pdf) => pdf.proposalOptionName));
    const applicationTypes = uniqueReceiptValues(measurements.map((item) => item.tipoAplicacao));
    const films = uniqueReceiptValues(measurements.map((item) => item.pelicula));
    const environments = uniqueReceiptValues(measurements.map((item) => item.ambiente));

    // Preserva o texto legado quando o orçamento possui apenas o nome da opção.
    if (!films.length && !applicationTypes.length && !environments.length) {
        if (proposalNames.length) {
            return truncateReceiptDescription(`Serviço de aplicação de películas — ${joinReceiptValues(proposalNames)}`);
        }
        return DEFAULT_RECEIPT_DESCRIPTION;
    }

    const base = films.length
        ? `Serviço de fornecimento e aplicação de película: ${films.join(', ')}`
        : DEFAULT_RECEIPT_DESCRIPTION;
    const context = [
        describeReceiptValues('Opção', 'Opções', proposalNames),
        describeReceiptValues('Aplicação', 'Aplicações', applicationTypes),
        describeReceiptValues('Ambiente', 'Ambientes', environments),
    ].filter((part): part is string => Boolean(part));

    return truncateReceiptDescription(context.length ? `${base} — ${context.join('; ')}` : base);
}

const receiptNumber = (agendamento: Agendamento): string => {
    const date = new Date(agendamento.end || agendamento.start);
    const day = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    return `REC-${day}-${String(agendamento.id || 0).padStart(5, '0')}`;
};

export const buildReceiptDetails = ({
    agendamento, client, linkedPdf, linkedPdfs, userInfo, amount, description, paymentMethod,
}: {
    agendamento: Agendamento;
    client?: Client;
    linkedPdf?: SavedPDF;
    linkedPdfs?: readonly SavedPDF[];
    userInfo?: UserInfo | null;
    amount: number;
    description?: string;
    paymentMethod?: string;
}): ReceiptDetails => {
    const receiptDescription = (agendamento as Agendamento & { receiptDescription?: string })
        .receiptDescription
        ?.trim();
    const automaticDescriptionSource = linkedPdfs?.length
        ? linkedPdfs
        : linkedPdf;

    return {
        receiptNumber: receiptNumber(agendamento),
        issuedAt: new Date().toISOString(),
        serviceDate: agendamento.end || agendamento.start,
        amount,
        amountInWords: amountToWordsBRL(amount),
        description: description?.trim()
            || receiptDescription
            || getDefaultReceiptDescription(automaticDescriptionSource),
        paymentMethod: paymentMethod?.trim() || undefined,
        client: {
            name: client?.nome || agendamento.clienteNome,
            document: client?.cpfCnpj?.trim() || undefined,
            address: clientAddress(client),
            phone: client?.telefone?.trim() || undefined,
        },
        company: {
            name: userInfo?.empresa?.trim() || userInfo?.nome?.trim() || 'Prestador de serviço',
            responsible: userInfo?.nome?.trim() || undefined,
            document: userInfo?.cpfCnpj?.trim() || undefined,
            address: userInfo?.endereco?.trim() || undefined,
            phone: userInfo?.telefone?.trim() || undefined,
            email: userInfo?.email?.trim() || undefined,
            logo: userInfo?.logo,
            signature: userInfo?.assinatura,
            primaryColor: userInfo?.cores?.primaria,
        },
    };
};

export const receiptFileName = (details: ReceiptDetails): string => {
    const safeName = details.client.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    return `recibo-${safeName || 'cliente'}-${details.receiptNumber.toLowerCase()}.pdf`;
};
