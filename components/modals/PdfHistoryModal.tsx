import React from 'react';
import { SavedPDF } from '../../types';
import Modal from '../ui/Modal';

interface PdfHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    pdfs: SavedPDF[];
    onDelete: (pdfId: number) => void;
    onDownload: (blob: Blob, filename: string) => void;
}

const formatNumberBR = (number: number) => {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
};

const PdfHistoryModal: React.FC<PdfHistoryModalProps> = ({ isOpen, onClose, pdfs, onDelete, onDownload }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Histórico de Orçamentos (PDF)">
            <div className="space-y-4">
                {pdfs.length > 0 ? (
                    pdfs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(pdf => (
                        <div key={pdf.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex-grow">
                                <p className="font-semibold text-slate-800">{new Date(pdf.date).toLocaleString('pt-BR')}</p>
                                <p className="text-sm text-slate-600">
                                    {formatNumberBR(pdf.totalM2)} m² - R$ {formatNumberBR(pdf.totalPreco)}
                                </p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => onDownload(pdf.pdfBlob, pdf.nomeArquivo)}
                                    className="p-2 text-slate-500 hover:text-indigo-600 transition-colors"
                                    aria-label="Baixar PDF"
                                >
                                    <i className="fas fa-download"></i>
                                </button>
                                <button
                                    onClick={() => onDelete(pdf.id!)}
                                    className="p-2 text-slate-500 hover:text-red-600 transition-colors"
                                    aria-label="Excluir PDF"
                                >
                                    <i className="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-slate-500 p-8">
                        <i className="fas fa-file-excel fa-3x mb-4 text-slate-400"></i>
                        <p>Nenhum PDF foi salvo para este cliente ainda.</p>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default PdfHistoryModal;