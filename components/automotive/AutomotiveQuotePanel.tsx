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
            <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 text-center shadow-[var(--shadow-soft)]">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
                    <Car className="h-8 w-8" aria-hidden="true" />
                </div>
                <p className="ui-kicker">Orçamento automotivo</p>
                <h3 className="mt-2 text-2xl font-bold leading-tight text-[var(--text-strong)]">Adicione o primeiro carro</h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
                    Escolha a categoria, a película e o pacote. O preço vem da sua tabela e você pode mudar na hora.
                </p>
                <div className="mt-6 flex justify-center">
                    <ActionButton onClick={onAddVehicle} variant="primary" size="lg" icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
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
            <ul className="space-y-2">
                {vehicles.map(vehicle => {
                    const category = getVehicleCategoryInfo(vehicle.categoria);
                    const glass = describeVehicleGlass(vehicle);
                    const hasLawWarning = getVehicleLawWarnings(vehicle).length > 0;
                    return (
                        <li key={vehicle.id}>
                            <button
                                type="button"
                                onClick={() => onEditVehicle(vehicle)}
                                className="flex w-full items-center gap-3 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 text-left shadow-[var(--shadow-hairline)] transition-colors hover:bg-[var(--surface-muted)] active:scale-[0.99]"
                            >
                                <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface-muted)]">
                                    <VehicleCategoryIcon category={vehicle.categoria} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-bold text-[var(--text-strong)]">{vehicle.modelo || category.label}</span>
                                    <span className="block truncate text-xs text-[var(--text-muted)]">
                                        {category.label} · {vehicle.pelicula} · {describeVehiclePackage(vehicle).replace('Completo ', '')}
                                    </span>
                                    {glass && <span className="block truncate text-xs text-[var(--text-muted)]">{glass}</span>}
                                </span>
                                <span className="flex shrink-0 items-center gap-1.5">
                                    {hasLawWarning && <AlertTriangle className="h-4 w-4 text-orange-600" aria-label="Algum vidro abaixo do mínimo da lei" />}
                                    <span className="text-sm font-black text-[var(--text-strong)]">{formatCurrencyBR(vehicle.preco)}</span>
                                    <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            <ActionButton onClick={onAddVehicle} variant="secondary" size="lg" className="w-full" icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
                Adicionar outro carro
            </ActionButton>
        </div>
    );
};

export default AutomotiveQuotePanel;
