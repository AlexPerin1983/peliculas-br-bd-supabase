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

export const getDefaultReceiptDescription = (linkedPdf?: SavedPDF): string => {
    const films = Array.from(new Set(
        (linkedPdf?.measurements || []).map((item) => item.pelicula?.trim()).filter(Boolean) as string[]
    ));
    if (films.length) return `Serviço de fornecimento e aplicação de película: ${films.join(', ')}`;
    if (linkedPdf?.proposalOptionName?.trim()) return `Serviço de aplicação de películas — ${linkedPdf.proposalOptionName.trim()}`;
    return 'Serviço de fornecimento e aplicação de películas';
};

const receiptNumber = (agendamento: Agendamento): string => {
    const date = new Date(agendamento.end || agendamento.start);
    const day = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    return `REC-${day}-${String(agendamento.id || 0).padStart(5, '0')}`;
};

export const buildReceiptDetails = ({
    agendamento, client, linkedPdf, userInfo, amount, description, paymentMethod,
}: {
    agendamento: Agendamento;
    client?: Client;
    linkedPdf?: SavedPDF;
    userInfo?: UserInfo | null;
    amount: number;
    description?: string;
    paymentMethod?: string;
}): ReceiptDetails => ({
    receiptNumber: receiptNumber(agendamento),
    issuedAt: new Date().toISOString(),
    serviceDate: agendamento.end || agendamento.start,
    amount,
    amountInWords: amountToWordsBRL(amount),
    description: description?.trim() || getDefaultReceiptDescription(linkedPdf),
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
});

export const receiptFileName = (details: ReceiptDetails): string => {
    const safeName = details.client.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    return `recibo-${safeName || 'cliente'}-${details.receiptNumber.toLowerCase()}.pdf`;
};
