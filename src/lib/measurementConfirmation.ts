import type { UIMeasurement } from '../../types';

export type MeasurementConfirmationShareResult = 'shared' | 'copied' | 'cancelled';

const parseMeasurementValue = (value: string | number): number => {
    const normalized = String(value ?? '').trim().replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatDecimal = (value: number): string => value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export const getMeasurementsForConfirmation = (measurements: UIMeasurement[]): UIMeasurement[] => (
    measurements.filter((measurement) => (
        measurement.active
        && parseMeasurementValue(measurement.largura) > 0
        && parseMeasurementValue(measurement.altura) > 0
        && Number(measurement.quantidade) > 0
    ))
);

interface BuildMeasurementConfirmationMessageParams {
    clientName?: string;
    measurements: UIMeasurement[];
}

export const buildMeasurementConfirmationMessage = ({
    clientName,
    measurements,
}: BuildMeasurementConfirmationMessageParams): string => {
    const shareableMeasurements = getMeasurementsForConfirmation(measurements);
    if (shareableMeasurements.length === 0) return '';

    let totalPieces = 0;
    let totalArea = 0;

    const measurementBlocks = shareableMeasurements.map((measurement, index) => {
        const width = parseMeasurementValue(measurement.largura);
        const height = parseMeasurementValue(measurement.altura);
        const quantity = Number(measurement.quantidade);
        const area = width * height * quantity;
        const location = (measurement.locationName || measurement.ambiente || '').trim() || 'Local não informado';
        const film = (measurement.pelicula || '').trim() || 'Não definida';

        totalPieces += quantity;
        totalArea += area;

        return [
            `${index + 1}. ${location}`,
            `Película: ${film}`,
            `Medida: ${formatDecimal(width)} × ${formatDecimal(height)} m`,
            `Quantidade: ${quantity} ${quantity === 1 ? 'peça' : 'peças'}`,
            `Área: ${formatDecimal(area)} m²`,
        ].join('\n');
    });

    const greeting = clientName?.trim() ? `Olá, ${clientName.trim()}!` : 'Olá!';

    return [
        greeting,
        'Pode confirmar se as medidas abaixo estão corretas?',
        '',
        '*CONFERÊNCIA DE MEDIDAS*',
        '',
        measurementBlocks.join('\n\n'),
        '',
        `*Total:* ${totalPieces} ${totalPieces === 1 ? 'peça' : 'peças'} • ${formatDecimal(totalArea)} m²`,
        '',
        'Por favor, responda *Confirmo* se estiver tudo correto ou envie os ajustes necessários.',
    ].join('\n');
};

const copyTextWithFallback = async (text: string): Promise<void> => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch (error) {
            console.warn('A cópia pela Clipboard API falhou; tentando o modo compatível.', error);
        }
    }

    if (typeof document === 'undefined') {
        throw new Error('Cópia indisponível neste dispositivo.');
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.setAttribute('aria-hidden', 'true');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    try {
        if (!document.execCommand('copy')) {
            throw new Error('O navegador recusou a cópia.');
        }
    } finally {
        textArea.remove();
    }
};

export const shareMeasurementConfirmation = async (
    message: string,
    clientName?: string,
): Promise<MeasurementConfirmationShareResult> => {
    if (!message) {
        throw new Error('Não há medidas válidas para compartilhar.');
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
        try {
            await navigator.share({
                title: clientName?.trim()
                    ? `Confirmação de medidas - ${clientName.trim()}`
                    : 'Confirmação de medidas',
                text: message,
            });
            return 'shared';
        } catch (error) {
            if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
                return 'cancelled';
            }

            console.warn('O compartilhamento do aparelho falhou; copiando o texto.', error);
        }
    }

    await copyTextWithFallback(message);
    return 'copied';
};
