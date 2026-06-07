// Gera uma logo padrão (placeholder) em PNG via canvas, usada nos PDFs
// enquanto o usuário ainda não enviou a logo da própria empresa.
// É um selo com as iniciais da empresa nas cores da marca.

const cache = new Map<string, string>();

function getInitials(label: string): string {
    const clean = (label || '').trim();
    if (!clean) return 'P';

    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Retorna um data URL (PNG) de uma logo placeholder com as iniciais da empresa.
 * Retorna null se o ambiente não tiver canvas (ex.: SSR).
 */
export function createDefaultLogo(label: string, primaryColor = '#155eef'): string | null {
    const key = `${label}|${primaryColor}`;
    const cached = cache.get(key);
    if (cached) return cached;

    if (typeof document === 'undefined') return null;

    const size = 240;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fundo arredondado com a cor da marca.
    const radius = 48;
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.arcTo(size, 0, size, radius, radius);
    ctx.lineTo(size, size - radius);
    ctx.arcTo(size, size, size - radius, size, radius);
    ctx.lineTo(radius, size);
    ctx.arcTo(0, size, 0, size - radius, radius);
    ctx.lineTo(0, radius);
    ctx.arcTo(0, 0, radius, 0, radius);
    ctx.closePath();
    ctx.fill();

    // Iniciais centralizadas em branco.
    const initials = getInitials(label);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${initials.length > 1 ? 104 : 128}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, size / 2, size / 2 + 6);

    const dataUrl = canvas.toDataURL('image/png');
    cache.set(key, dataUrl);
    return dataUrl;
}
