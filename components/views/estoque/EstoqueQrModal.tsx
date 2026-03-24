import React from 'react';
import { Bobina, Retalho } from '../../../types';
import { QrCodeIcon } from './EstoqueIcons';

type EstoqueQrModalProps = {
    showQRModal: { type: 'bobina' | 'retalho'; item: Bobina | Retalho } | null;
    qrCodeDataUrl: string;
    isGenerating: boolean;
    onClose: () => void;
    onSaveImage: () => void;
    onSavePDF: () => void;
};

export default function EstoqueQrModal({
    showQRModal,
    qrCodeDataUrl,
    isGenerating,
    onClose,
    onSaveImage,
    onSavePDF,
}: EstoqueQrModalProps) {
    if (!showQRModal) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <QrCodeIcon />
                        </div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {showQRModal.type === 'bobina' ? 'Bobina' : 'Retalho'}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 flex flex-col items-center">
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 mb-4">
                        {qrCodeDataUrl && (
                            <img src={qrCodeDataUrl} alt="QR Code" className="w-40 h-40" />
                        )}
                    </div>

                    <p className="font-mono text-sm text-slate-500 dark:text-slate-400 mb-2">
                        {showQRModal.item.codigoQr}
                    </p>

                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 text-center">
                        {showQRModal.item.filmId}
                    </h3>

                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        {showQRModal.item.larguraCm}cm x {'comprimentoTotalM' in showQRModal.item ? `${showQRModal.item.comprimentoTotalM}m` : `${(showQRModal.item as Retalho).comprimentoCm}cm`}
                    </p>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                    <button
                        onClick={onSaveImage}
                        disabled={isGenerating}
                        className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isGenerating ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                PNG
                            </>
                        )}
                    </button>
                    <button
                        onClick={onSavePDF}
                        disabled={isGenerating}
                        className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isGenerating ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                                PDF
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
