import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MeasurementHistoryModal, { consolidateMeasurementHistory } from './MeasurementHistoryModal';
import * as db from '../../services/db';

vi.mock('../../services/db', () => ({
    getProposalOptionsHistory: vi.fn(),
    restoreProposalOptionsVersion: vi.fn()
}));

const mockedDb = vi.mocked(db);

const currentOptions = [{
    id: 1,
    name: 'Atual',
    measurements: [],
    generalDiscount: { value: '', type: 'fixed' as const }
}];

const recoveredOptions = [{
    id: 1,
    name: 'Recuperada',
    measurements: [{
        id: 20,
        largura: '1,20',
        altura: '0,80',
        quantidade: 2,
        ambiente: 'Sala',
        tipoAplicacao: 'Interna',
        pelicula: 'Blackout',
        active: true
    }],
    generalDiscount: { value: '', type: 'fixed' as const }
}];

describe('MeasurementHistoryModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedDb.getProposalOptionsHistory.mockResolvedValue([
            {
                id: 2,
                clientId: 44,
                revision: 2,
                options: currentOptions,
                createdAt: '2026-08-16T15:00:00.000Z',
                createdBy: 'user-1',
                sourceDeviceId: 'device-a',
                isCurrentDevice: true
            },
            {
                id: 1,
                clientId: 44,
                revision: 1,
                options: recoveredOptions,
                createdAt: '2026-08-16T14:00:00.000Z',
                createdBy: 'user-1',
                sourceDeviceId: 'device-b',
                isCurrentDevice: false
            }
        ]);
        mockedDb.restoreProposalOptionsVersion.mockResolvedValue(recoveredOptions);
    });

    it('mostra as versoes, exige confirmacao e restaura como nova revisao', async () => {
        const onRestored = vi.fn();
        const onClose = vi.fn();

        render(
            <MeasurementHistoryModal
                isOpen
                clientId={44}
                clientName="Liane"
                onClose={onClose}
                onRestored={onRestored}
            />
        );

        expect(await screen.findByText('Versão 2')).toBeInTheDocument();
        expect(screen.getAllByText('Atual')).not.toHaveLength(0);

        fireEvent.click(screen.getByRole('button', { name: /Versão 1/i }));
        fireEvent.click(screen.getByRole('button', { name: /Restaurar esta versão/i }));

        expect(screen.getByText('Restaurar medidas?')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Sim, restaurar/i }));

        await waitFor(() => {
            expect(mockedDb.restoreProposalOptionsVersion).toHaveBeenCalledWith(44, recoveredOptions);
        });
        expect(onRestored).toHaveBeenCalledWith(recoveredOptions);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('consolida salvamentos consecutivos com o mesmo resumo sem apagar revisoes', () => {
        const baseEntry = {
            id: 4,
            clientId: 44,
            revision: 4,
            options: recoveredOptions,
            createdAt: '2026-08-16T14:04:00.000Z',
            createdBy: 'user-1',
            sourceDeviceId: 'device-a',
            isCurrentDevice: true
        };
        const history = [
            baseEntry,
            { ...baseEntry, id: 3, revision: 3, createdAt: '2026-08-16T14:03:00.000Z' },
            { ...baseEntry, id: 2, revision: 2, options: currentOptions, createdAt: '2026-08-16T14:02:00.000Z' },
            { ...baseEntry, id: 1, revision: 1, options: currentOptions, createdAt: '2026-08-16T14:01:00.000Z' }
        ];

        const consolidated = consolidateMeasurementHistory(history);

        expect(history).toHaveLength(4);
        expect(consolidated.map(entry => entry.revision)).toEqual([4, 2]);
    });
});
