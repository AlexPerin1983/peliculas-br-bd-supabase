import React, { lazy, Suspense } from 'react';
import { Bobina, Retalho } from '../../../types';
import { StatusDrawer } from '../../ui/StatusDrawer';

const QRScannerModal = lazy(() => import('../../modals/QRScannerModal'));

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
            {showScannerModal && (
                <Suspense fallback={null}>
                    <QRScannerModal
                        isOpen
                        onClose={() => setShowScannerModal(false)}
                        onDataUpdated={onDataUpdated}
                    />
                </Suspense>
            )}

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
