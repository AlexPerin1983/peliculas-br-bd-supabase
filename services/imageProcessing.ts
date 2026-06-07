// Processa a logo no próprio navegador: valida, redimensiona e comprime antes
// de salvar como dataURL. Isso mantém o app/banco leves (evita base64 enormes,
// que pesam no egress do Supabase) sem precisar de tratamento no backend.

const MAX_DIMENSION = 480; // lado maior da logo, em pixels
const MAX_SOURCE_BYTES = 12 * 1024 * 1024; // recusa fontes absurdas (>12 MB)
const PNG_FALLBACK_LIMIT = 400 * 1024; // se o PNG passar disso, cai para JPEG

function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
        reader.readAsDataURL(file);
    });
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
        img.src = src;
    });
}

/**
 * Recebe um arquivo de imagem e devolve um dataURL otimizado (lado máximo de
 * 480px, comprimido). Lança Error com mensagem amigável em caso de problema.
 */
export async function processLogoImage(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) {
        throw new Error('Selecione um arquivo de imagem (PNG ou JPG).');
    }
    if (file.size > MAX_SOURCE_BYTES) {
        throw new Error('Imagem muito grande. Escolha uma de até 12 MB.');
    }

    const sourceDataUrl = await readFileAsDataURL(file);
    const img = await loadImage(sourceDataUrl);

    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Não foi possível processar a imagem.');
    }
    ctx.drawImage(img, 0, 0, width, height);

    // PNG preserva transparência (ideal para logos). Se ficar muito grande
    // (provável foto), refaz em JPEG com fundo branco para garantir leveza.
    let output = canvas.toDataURL('image/png');
    if (output.length > PNG_FALLBACK_LIMIT) {
        const jpegCanvas = document.createElement('canvas');
        jpegCanvas.width = width;
        jpegCanvas.height = height;
        const jpegCtx = jpegCanvas.getContext('2d');
        if (jpegCtx) {
            jpegCtx.fillStyle = '#ffffff';
            jpegCtx.fillRect(0, 0, width, height);
            jpegCtx.drawImage(img, 0, 0, width, height);
            output = jpegCanvas.toDataURL('image/jpeg', 0.82);
        }
    }

    return output;
}
