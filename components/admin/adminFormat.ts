// Helpers compartilhados do painel de Admin (engajamento, overview e drawer).

export const formatInt = (v: number): string => (v || 0).toLocaleString('pt-BR');

export const formatMoney = (v: number): string =>
    (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Monta o link wa.me a partir de um telefone brasileiro. Retorna null se não der pra discar.
export const buildWhatsappLink = (phone: string | null | undefined): string | null => {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return null; // sem DDD/número válido
    if (!digits.startsWith('55')) digits = `55${digits}`; // assume Brasil
    return `https://wa.me/${digits}`;
};

// "hoje" / "ontem" / "há N dias" / "há N meses" / "sem atividade"
export const relativeDays = (iso: string | null | undefined): string => {
    if (!iso) return 'sem atividade';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return 'hoje';
    if (diff === 1) return 'ontem';
    if (diff < 30) return `há ${diff} dias`;
    if (diff < 60) return 'há 1 mês';
    return `há ${Math.floor(diff / 30)} meses`;
};

// Rótulo curto de mês "jun/26" a partir de uma data ISO/date.
export const monthLabel = (iso: string): string => {
    const d = new Date(iso);
    const m = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const y = String(d.getFullYear()).slice(-2);
    return `${m}/${y}`;
};
