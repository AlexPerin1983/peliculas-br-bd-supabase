import React from 'react';
import { Bobina, Retalho } from '../../../types';
import QRScannerModal from '../../modals/QRScannerModal';
import { StatusDrawer } from '../../ui/StatusDrawer';

type StatusModalState = { type: 'bobina' | 'retalho'; item: Bobina | Retalho } | null;

type EstoqueStatusAndScannerFlowProps = {
    showScannerModal: boolean;
    setShowScannerModal: (value: boolean) => void;
    onDataUpdated: () => Promise<void>;
    showStatusModal: StatusModalState;
    setShowStatusModal: (value: StatusModalState) => void;
    getStatusOptions: (type: 'bobina' | 'retalho') => Array<{
        value: string;
        label: string;
        emoji: string;
        color: string;
    }>;
    onStatusChange: (newStatus: string) => Promise<void>;
    onDelete: (type: 'bobina' | 'retalho', id: number) => void;
    getStatusLabel: (status: string) => string;
    getStatusColor: (status: string) => string;
};

export default function EstoqueStatusAndScannerFlow({
    showScannerModal,
    setShowScannerModal,
    onDataUpdated,
    showStatusModal,
    setShowStatusModal,
    getStatusOptions,
    onStatusChange,
    onDelete,
    getStatusLabel,
    getStatusColor,
}: EstoqueStatusAndScannerFlowProps) {
    return (
        <>
            <QRScannerModal
                isOpen={showScannerModal}
                onClose={() => setShowScannerModal(false)}
                onDataUpdated={onDataUpdated}
            />

            {showStatusModal && (
                <StatusDrawer
                    isOpen={true}
                    onClose={() => setShowStatusModal(null)}
                    type={showStatusModal.type}
                    item={showStatusModal.item}
                    currentStatus={showStatusModal.item.status}
                    statusOptions={getStatusOptions(showStatusModal.type)}
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
                    getStatusLabel={getStatusLabel}
                    getStatusColor={getStatusColor}
                />
            )}
        </>
    );
}
