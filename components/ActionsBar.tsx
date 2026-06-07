import React from 'react';
import { Copy, FileText, Loader2, Plus, Sparkles } from 'lucide-react';

interface ActionsBarProps {
    onAddMeasurement: () => void;
    onDuplicateMeasurements: () => void;
    onGeneratePdf: () => void;
    isGeneratingPdf: boolean;
    onOpenAIModal: () => void;
    layout?: 'grid' | 'stacked';
}

const ActionsBar: React.FC<ActionsBarProps> = ({
    onAddMeasurement,
    onDuplicateMeasurements,
    onGeneratePdf,
    isGeneratingPdf,
    onOpenAIModal,
    layout = 'grid'
}) => {
    const addMeasurementButton = (
        <button
            onClick={onAddMeasurement}
            className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-slate-950 font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.16)] transition-all hover:bg-slate-800 active:scale-[0.99] dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white sm:col-span-1"
        >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Adicionar Medida</span>
        </button>
    );

    const aiButton = (
        <button
            onClick={onOpenAIModal}
            className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-blue-100 bg-blue-50 font-semibold text-blue-700 shadow-[var(--shadow-hairline)] transition-all hover:bg-blue-100 active:scale-[0.99] dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300"
        >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>Com IA</span>
        </button>
    );

    const duplicateButton = (
        <button
            onClick={onDuplicateMeasurements}
            className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] font-semibold text-[var(--text-body)] shadow-[var(--shadow-hairline)] transition-all hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] active:scale-[0.99]"
        >
            <Copy className="h-4 w-4" aria-hidden="true" />
            <span>Duplicar</span>
        </button>
    );

    const pdfButton = (
        <button
            data-tour="generate-pdf"
            onClick={onGeneratePdf}
            className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-emerald-600 font-semibold text-white shadow-[0_12px_24px_rgba(5,150,105,0.18)] transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70 sm:col-span-1"
            disabled={isGeneratingPdf}
        >
            {isGeneratingPdf ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Gerando...</span>
                </>
            ) : (
                <>
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    <span>Gerar PDF</span>
                </>
            )}
        </button>
    );

    if (layout === 'stacked') {
        return (
            <div className="space-y-2">
                {addMeasurementButton}
                {pdfButton}
                <div className="grid grid-cols-2 gap-2">
                    {aiButton}
                    {duplicateButton}
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)] sm:items-center">
            {addMeasurementButton}
            {aiButton}
            {duplicateButton}
            {pdfButton}
        </div>
    );
};

export default React.memo(ActionsBar);
