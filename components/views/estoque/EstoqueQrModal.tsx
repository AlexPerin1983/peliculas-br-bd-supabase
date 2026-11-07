import React from 'react';
import { Download, ExternalLink, FileText, X } from 'lucide-react';
import { Bobina, Retalho } from '../../../types';
import { formatMetersFromCentimeters, formatStockMeters } from '../../../src/lib/estoqueDimensions';

type EstoqueQrModalProps = {
    showQRModal: { type: 'bobina' | 'retalho'; item: Bobina | Retalho } | null;
    qrCodeDataUrl: string;
    isGenerating: boolean;
    onClose: () => void;
    onSaveImage: () => void;
    onSavePDF: () => void;
};

// A janela mostra a etiqueta como ela sai na impressão (PDF de 8 × 10 cm):
// papel branco com o QR, o código, a película e a medida.
export default function EstoqueQrModal({
    showQRModal,
    qrCodeDataUrl,
    isGenerating,
    onClose,
    onSaveImage,
    onSavePDF,
}: EstoqueQrModalProps) {
    if (!showQRModal) return null;

    const { item, type } = showQRModal;
    const isBobina = type === 'bobina';
    const largura = formatMetersFromCentimeters(item.larguraCm);
    const comprimento = 'comprimentoTotalM' in item
        ? formatStockMeters(item.comprimentoTotalM)
        : formatMetersFromCentimeters((item as Retalho).comprimentoCm);
    const spinner = <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="estoque-qr-title"
                className="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
                    <div className="min-w-0">
                        <h2 id="estoque-qr-title" className="text-base font-semibold text-[var(--text-strong)]">
                            {isBobina ? 'Etiqueta da bobina' : 'Etiqueta do retalho'}
                        </h2>
                        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                            {item.filmId} · {isBobina ? 'Bobina' : 'Retalho'} #{item.id}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>

                {/* A etiqueta em papel, na proporção 8 × 10 cm. */}
                <div className="bg-[var(--surface-muted)] px-5 py-6">
                    <div className="mx-auto flex aspect-[4/5] w-[220px] flex-col items-center justify-center rounded-lg bg-white px-4 py-5 text-center shadow-[0_10px_30px_rgba(0,0,0,0.28)] ring-1 ring-black/5">
                        {qrCodeDataUrl ? (
                            <img src={qrCodeDataUrl} alt={`QR Code de ${item.filmId}`} className="h-36 w-36" />
                        ) : (
                            <span className="h-36 w-36 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                        )}
                        <p className="mt-2 font-mono text-[11px] tracking-wide text-slate-500">{item.codigoQr}</p>
                        <p className="mt-1.5 line-clamp-2 text-base font-semibold leading-tight text-slate-900">{item.filmId}</p>
                        <p className="mt-0.5 text-xs tabular-nums text-slate-500">{largura} m × {comprimento} m</p>
                    </div>
                    <p className="mt-4 text-center text-xs text-[var(--text-muted)]">É assim que a etiqueta sai na impressão (8 × 10 cm)</p>
                    {/* Mesmo endereço gravado no QR (generateQRCodeImage em useEstoqueOperations). */}
                    <a
                        href={`${window.location.origin}?qr=${encodeURIComponent(item.codigoQr)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mx-auto mt-2 flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-[var(--text-body)] underline-offset-4 transition-colors hover:text-[var(--text-strong)] hover:underline"
                    >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="text-xs font-medium">Abrir a página que o QR mostra</span>
                    </a>
                </div>

                <div className="flex gap-2 px-5 py-4">
                    <button
                        type="button"
                        onClick={onSaveImage}
                        disabled={isGenerating}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isGenerating ? spinner : <Download className="h-4 w-4" aria-hidden="true" />}
                        <span className="text-sm font-medium">Salvar imagem</span>
                    </button>
                    <button
                        type="button"
                        onClick={onSavePDF}
                        disabled={isGenerating}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--surface-inverse)] text-[var(--surface)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isGenerating ? spinner : <FileText className="h-4 w-4" aria-hidden="true" />}
                        <span className="text-sm font-semibold">Baixar PDF</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
