// Preparação dos arquivos enviados à IA: fotos grandes são reduzidas e PDFs seguem como estão.

export const AI_MAX_FILES = 5;
// O proxy aceita 12 MB de JSON; em base64 o arquivo cresce ~33%, então 8 MB de arquivos cabem com folga.
export const AI_MAX_TOTAL_BYTES = 8 * 1024 * 1024;
export const AI_MAX_PDF_BYTES = 6 * 1024 * 1024;

const IMAGE_MAX_SIDE = 2048;
const IMAGE_RESIZE_ABOVE_BYTES = 1.5 * 1024 * 1024;

export type AIFileKind = 'image' | 'pdf';

export const getAIFileKind = (file: File): AIFileKind | null => {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf';
    if (file.type.startsWith('image/')) return 'image';
    return null;
};

export const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
};

const loadImage = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem ilegível')); };
    image.src = url;
});

/**
 * Reduz fotos grandes para no máximo 2048px no maior lado (JPEG 85%).
 * Medidas escritas continuam legíveis e o envio fica bem menor.
 * Se o navegador não conseguir abrir a imagem (ex.: HEIC), devolve o arquivo original.
 */
export const prepareAIFile = async (file: File): Promise<File> => {
    if (getAIFileKind(file) !== 'image' || file.size <= IMAGE_RESIZE_ABOVE_BYTES) return file;
    try {
        const image = await loadImage(file);
        const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        const context = canvas.getContext('2d');
        if (!context) return file;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        if (!blob || blob.size >= file.size) return file;
        const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
    } catch {
        return file;
    }
};
