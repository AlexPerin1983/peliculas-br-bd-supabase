import React from 'react';
import { AlertTriangle, Car, ChevronRight, Plus } from 'lucide-react';
import ActionButton from '../ui/ActionButton';
import VehicleCategoryIcon from './VehicleCategoryIcon';
import type { AutomotiveVehicle } from '../../types';
import {
    describeVehicleGlass,
    describeVehiclePackage,
    getVehicleCategoryInfo,
    getVehicleLawWarnings,
    getVehicleTotal,
    describeVehicleNotes,
    sumAutomotiveVehicles,
} from '../../src/lib/automotive';

interface AutomotiveQuotePanelProps {
    vehicles: AutomotiveVehicle[];
    onAddVehicle: () => void;
    onEditVehicle: (vehicle: AutomotiveVehicle) => void;
}

const formatCurrencyBR = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

// Lista de carros da opção ativa (no lugar da lista de medidas quando a aba é Automotivo).
const AutomotiveQuotePanel: React.FC<AutomotiveQuotePanelProps> = ({ vehicles, onAddVehicle, onEditVehicle }) => {
    if (vehicles.length === 0) {
        return (
            <div className="rounded-[var(--radius-panel)] bg-[var(--surface-raised)] px-5 py-8 text-center">
                <div className="mx-auto mb-4 flex h-10 items-center justify-center text-[var(--text-muted)]">
                    <Car className="h-8 w-8" aria-hidden="true" />
                </div>
                <p className="text-xs text-[var(--text-muted)]">Orçamento automotivo</p>
                <h3 className="mt-2 text-xl font-semibold leading-tight text-[var(--text-strong)]">Adicione o primeiro carro</h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
                    Escolha a categoria, a película e o pacote. O preço vem da sua tabela e você pode mudar na hora.
                </p>
                <div className="mt-6 flex justify-center">
                    <ActionButton onClick={onAddVehicle} variant="primary" size="lg" className="shadow-none!" icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
                        Adicionar carro
                    </ActionButton>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
                <p className="text-sm font-semibold text-[var(--text-muted)]">
                    {vehicles.length} {vehicles.length === 1 ? 'carro' : 'carros'} · {formatCurrencyBR(sumAutomotiveVehicles(vehicles))}
                </p>
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]">
                {vehicles.map(vehicle => {
                    const category = getVehicleCategoryInfo(vehicle.categoria);
                    const glass = describeVehicleGlass(vehicle);
                    const hasLawWarning = getVehicleLawWarnings(vehicle).length > 0;
                    return (
                        <li key={vehicle.id}>
                            <button
                                type="button"
                                onClick={() => onEditVehicle(vehicle)}
                                className="flex w-full items-center gap-3 rounded-md px-1 py-4 text-left transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]"
                            >
                                <span className="flex h-12 w-14 shrink-0 items-center justify-center">
                                    <VehicleCategoryIcon category={vehicle.categoria} className="h-7 w-14 text-[var(--text-strong)]" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-[var(--text-strong)]">{vehicle.modelo || category.label}</span>
                                    <span className="block truncate text-xs text-[var(--text-muted)]">
                                        {category.label} · {vehicle.pelicula} · {describeVehiclePackage(vehicle).replace('Completo ', '').toLowerCase()}
                                    </span>
                                    {glass && <span className="block truncate text-xs text-[var(--text-muted)]">{glass}</span>}
                                    {describeVehicleNotes(vehicle) && <span className="block truncate text-xs text-[var(--text-muted)]">{describeVehicleNotes(vehicle)}</span>}
                                </span>
                                <span className="flex shrink-0 items-center gap-1.5">
                                    {hasLawWarning && <AlertTriangle className="h-4 w-4 text-orange-600" aria-label="Algum vidro abaixo do mínimo da lei" />}
                                    <span className="text-sm font-semibold text-[var(--text-strong)]">{formatCurrencyBR(getVehicleTotal(vehicle))}</span>
                                    <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            <ActionButton onClick={onAddVehicle} variant="ghost" size="lg" className="w-full" icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
                Adicionar outro carro
            </ActionButton>
        </div>
    );
};

export default AutomotiveQuotePanel;
