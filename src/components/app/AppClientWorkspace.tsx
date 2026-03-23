import React, { ReactNode } from 'react';
import ClientBar from '../../../components/ClientBar';
import ProposalOptionsCarousel from '../../../components/ProposalOptionsCarousel';
import SummaryBar from '../../../components/SummaryBar';
import ActionsBar from '../../../components/ActionsBar';
import MobileFooter from '../../../components/MobileFooter';
import CuttingOptimizationPanel from '../../../components/CuttingOptimizationPanel';
import { Client, Film, ProposalOption, Totals, UIMeasurement } from '../../../types';

interface AppClientWorkspaceProps {
    clientsCount: number;
    selectedClient: Client | null;
    clientTransitionKey: number;
    proposalOptions: ProposalOption[];
    activeOptionId: number | null;
    selectedClientId: number | null;
    measurements: UIMeasurement[];
    films: Film[];
    totals: Totals;
    generalDiscount: { value: string; type: 'percentage' | 'fixed' };
    content: ReactNode;
    isGeneratingPdf: boolean;
    onSelectClientClick: () => void;
    onAddClient: () => void;
    onAddClientAI: () => void;
    onEditClient: () => void;
    onDeleteClient: () => void;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
    onSelectOption: (optionId: number) => void;
    onRenameOption: (optionId: number, newName: string) => void;
    onDeleteOption: (optionId: number) => void;
    onAddOption: () => void;
    onSwipeDirectionChange: (direction: 'left' | 'right' | null, distance: number) => void;
    onOpenGeneralDiscountModal: () => void;
    onUpdateGeneralDiscount: (discount: { value: string; type: 'percentage' | 'fixed' }) => void;
    onAddMeasurement: () => void;
    onDuplicateMeasurements: () => void;
    onGeneratePdf: () => void;
    onOpenAIModal: () => void;
}

export const AppClientWorkspace: React.FC<AppClientWorkspaceProps> = ({
    clientsCount,
    selectedClient,
    clientTransitionKey,
    proposalOptions,
    activeOptionId,
    selectedClientId,
    measurements,
    films,
    totals,
    generalDiscount,
    content,
    isGeneratingPdf,
    onSelectClientClick,
    onAddClient,
    onAddClientAI,
    onEditClient,
    onDeleteClient,
    onSwipeLeft,
    onSwipeRight,
    onSelectOption,
    onRenameOption,
    onDeleteOption,
    onAddOption,
    onSwipeDirectionChange,
    onOpenGeneralDiscountModal,
    onUpdateGeneralDiscount,
    onAddMeasurement,
    onDuplicateMeasurements,
    onGeneratePdf,
    onOpenAIModal
}) => {
    if (clientsCount === 0) {
        return (
            <div id="contentContainer" className="w-full min-h-[300px] animate-fade-in">
                {content}
            </div>
        );
    }

    return (
        <>
            <div className="bg-slate-100 dark:bg-slate-900 p-2 px-2 rounded-xl">
                <div className="relative z-20">
                    <ClientBar
                        key={clientTransitionKey}
                        selectedClient={selectedClient}
                        onSelectClientClick={onSelectClientClick}
                        onAddClient={onAddClient}
                        onAddClientAI={onAddClientAI}
                        onEditClient={onEditClient}
                        onDeleteClient={onDeleteClient}
                        onSwipeLeft={onSwipeLeft}
                        onSwipeRight={onSwipeRight}
                    />
                </div>

                {proposalOptions.length > 0 && activeOptionId && (
                    <ProposalOptionsCarousel
                        options={proposalOptions}
                        activeOptionId={activeOptionId}
                        onSelectOption={onSelectOption}
                        onRenameOption={onRenameOption}
                        onDeleteOption={onDeleteOption}
                        onAddOption={onAddOption}
                        onSwipeDirectionChange={onSwipeDirectionChange}
                    />
                )}

                <div id="contentContainer" className="w-full min-h-[300px] animate-fade-in pb-28 sm:pb-0">
                    {content}

                    {measurements.length > 0 && selectedClientId && (
                        <div className="mt-4 mb-4 sm:mb-0">
                            <CuttingOptimizationPanel
                                measurements={measurements}
                                clientId={selectedClientId ?? undefined}
                                optionId={activeOptionId ?? undefined}
                                films={films}
                            />
                        </div>
                    )}
                </div>
            </div>

            {selectedClientId && (
                <>
                    <div className="hidden sm:block mt-6 pt-6 border-t border-slate-200">
                        <SummaryBar
                            totals={totals}
                            generalDiscount={generalDiscount}
                            onOpenGeneralDiscountModal={onOpenGeneralDiscountModal}
                            isDesktop
                        />
                        <ActionsBar
                            onAddMeasurement={onAddMeasurement}
                            onDuplicateMeasurements={onDuplicateMeasurements}
                            onGeneratePdf={onGeneratePdf}
                            isGeneratingPdf={isGeneratingPdf}
                            onOpenAIModal={onOpenAIModal}
                        />
                    </div>

                    <MobileFooter
                        totals={totals}
                        generalDiscount={generalDiscount}
                        onOpenGeneralDiscountModal={onOpenGeneralDiscountModal}
                        onUpdateGeneralDiscount={onUpdateGeneralDiscount}
                        onAddMeasurement={onAddMeasurement}
                        onDuplicateMeasurements={onDuplicateMeasurements}
                        onGeneratePdf={onGeneratePdf}
                        isGeneratingPdf={isGeneratingPdf}
                        onOpenAIModal={onOpenAIModal}
                    />
                </>
            )}
        </>
    );
};
