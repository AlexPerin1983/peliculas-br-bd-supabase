import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import Input from '../ui/Input';
import VehicleCategoryIcon from './VehicleCategoryIcon';
import VehicleTopView from './VehicleTopView';
import type { AutomotiveSettings, AutomotiveVehicle, VehicleCategory, VehicleGlassGroup, VehicleGlassShade } from '../../types';
import {
    AUTOMOTIVE_FILM_TYPES,
    VEHICLE_CATEGORIES,
    describeVehicleGlass,
    formatGlassShade,
    formatMoneyInput,
    getAutomotiveTablePrice,
    getVehicleCategoryInfo,
    getVehicleGlassGroupInfo,
    getVehicleGlassGroups,
    getVehicleLawWarnings,
    parseMoneyInput,
    suggestVehicleCategory,
} from '../../src/lib/automotive';

interface VehicleEditorModalProps {
    isOpen: boolean;
    vehicle: AutomotiveVehicle | null;
    settings?: AutomotiveSettings;
    onClose: () => void;
    onSave: (vehicle: AutomotiveVehicle) => void;
    onDelete?: (vehicleId: number) => void;
}

const formatCurrencyBR = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const optionButtonClass = (selected: boolean) => `rounded-[var(--radius-control)] font-semibold transition-colors active:scale-[0.99] ${selected
    ? 'border-2 border-[var(--brand-primary)] bg-blue-50 text-[var(--text-strong)] dark:bg-blue-950/40'
    : 'border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] hover:bg-[var(--surface-muted)]'}`;

const VehicleEditorModal: React.FC<VehicleEditorModalProps> = ({ isOpen, vehicle, settings, onClose, onSave, onDelete }) => {
    const [draft, setDraft] = useState<AutomotiveVehicle | null>(null);
    const [priceText, setPriceText] = useState('');
    // Preço digitado à mão deixa de seguir a tabela.
    const [isPriceTouched, setIsPriceTouched] = useState(false);
    const [isCategoryTouched, setIsCategoryTouched] = useState(false);
    const [step, setStep] = useState<'dados' | 'vidros'>('dados');
    const [selectedGroup, setSelectedGroup] = useState<VehicleGlassGroup | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const initial: AutomotiveVehicle = vehicle ?? {
            id: Date.now(),
            modelo: '',
            categoria: 'hatch',
            pelicula: AUTOMOTIVE_FILM_TYPES[0],
            comParabrisa: false,
            preco: 0,
        };
        const tablePrice = vehicle ? undefined : getAutomotiveTablePrice(settings, initial.pelicula, initial.categoria, initial.comParabrisa);
        setDraft(vehicle ? initial : { ...initial, preco: tablePrice ?? 0 });
        setPriceText(vehicle ? formatMoneyInput(vehicle.preco) : formatMoneyInput(tablePrice));
        setIsPriceTouched(Boolean(vehicle));
        setIsCategoryTouched(Boolean(vehicle));
        setStep('dados');
        setSelectedGroup(null);
        setError('');
        // Só ao abrir: mudar a tabela com o modal aberto não reinicia o rascunho.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, vehicle]);

    const tablePrice = draft ? getAutomotiveTablePrice(settings, draft.pelicula, draft.categoria, draft.comParabrisa) : undefined;
    const suggestedCategory = draft ? suggestVehicleCategory(draft.modelo) : undefined;
    const glassGroups = useMemo(() => (draft ? getVehicleGlassGroups(draft) : []), [draft]);
    const lawWarnings = draft ? getVehicleLawWarnings(draft) : [];

    if (!draft) return null;

    // Mudou película, categoria ou pacote: o preço acompanha a tabela até ser digitado à mão.
    const updateDraft = (patch: Partial<AutomotiveVehicle>) => {
        const next = { ...draft, ...patch };
        if (!isPriceTouched) {
            const nextTablePrice = getAutomotiveTablePrice(settings, next.pelicula, next.categoria, next.comParabrisa);
            next.preco = nextTablePrice ?? 0;
            setPriceText(formatMoneyInput(nextTablePrice));
        }
        setDraft(next);
        setError('');
    };

    const handleModelChange = (modelo: string) => {
        const suggestion = suggestVehicleCategory(modelo);
        updateDraft(!isCategoryTouched && suggestion ? { modelo, categoria: suggestion } : { modelo });
    };

    const handleCategoryChange = (categoria: VehicleCategory) => {
        setIsCategoryTouched(true);
        updateDraft({ categoria });
    };

    const handlePriceChange = (value: string) => {
        setPriceText(value);
        setIsPriceTouched(true);
        setDraft(previous => previous ? { ...previous, preco: parseMoneyInput(value) ?? 0 } : previous);
        setError('');
    };

    const handleUseTablePrice = () => {
        if (tablePrice === undefined) return;
        setIsPriceTouched(false);
        setPriceText(formatMoneyInput(tablePrice));
        setDraft(previous => previous ? { ...previous, preco: tablePrice } : previous);
    };

    const handleShadeChange = (group: VehicleGlassGroup, shade: VehicleGlassShade) => {
        setDraft(previous => previous ? { ...previous, vidros: { ...previous.vidros, [group]: shade } } : previous);
    };

    const handleSave = () => {
        if (!draft.pelicula) {
            setError('Escolha a película.');
            return;
        }
        if (!(draft.preco > 0)) {
            setError('Digite o preço deste carro.');
            return;
        }
        // Guarda só os vidros que existem nesta categoria e pacote.
        const vidros = Object.fromEntries(
            Object.entries(draft.vidros || {}).filter(([group]) => glassGroups.includes(group as VehicleGlassGroup))
        ) as AutomotiveVehicle['vidros'];
        onSave({
            ...draft,
            modelo: draft.modelo.trim(),
            vidros: vidros && Object.keys(vidros).length > 0 ? vidros : undefined,
        });
    };

    // Carro salvo com outra película (nome antigo) continua aparecendo para não perder a escolha.
    const filmOptions = draft.pelicula && !AUTOMOTIVE_FILM_TYPES.includes(draft.pelicula)
        ? [draft.pelicula, ...AUTOMOTIVE_FILM_TYPES]
        : AUTOMOTIVE_FILM_TYPES;
    const glassSummary = describeVehicleGlass(draft);
    const activeGroup = selectedGroup && glassGroups.includes(selectedGroup) ? selectedGroup : glassGroups[0];

    const footer = step === 'vidros' ? (
        <ActionButton variant="primary" size="lg" className="w-full" onClick={() => setStep('dados')}>
            Pronto
        </ActionButton>
    ) : (
        <div className="flex w-full items-center gap-2">
            {vehicle && onDelete && (
                <ActionButton
                    variant="ghost"
                    size="lg"
                    iconOnly
                    aria-label="Excluir carro"
                    icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                    onClick={() => onDelete(vehicle.id)}
                />
            )}
            <ActionButton variant="ghost" size="lg" onClick={onClose}>Cancelar</ActionButton>
            <ActionButton variant="primary" size="lg" className="flex-1" onClick={handleSave}>
                {vehicle ? 'Salvar carro' : `Adicionar · ${formatCurrencyBR(draft.preco)}`}
            </ActionButton>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={step === 'vidros' ? `Vidros · ${getVehicleCategoryInfo(draft.categoria).label}` : (vehicle ? 'Editar carro' : 'Novo carro')}
            footer={footer}
            keyboardAwareFooter
        >
            {step === 'vidros' ? (
                <div className="space-y-4">
                    <button
                        type="button"
                        onClick={() => setStep('dados')}
                        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--brand-primary)]"
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        Voltar ao carro
                    </button>
                    <div className="flex items-start gap-3">
                        <VehicleTopView groups={glassGroups} vidros={draft.vidros} selectedGroup={activeGroup} className="h-64 w-32 shrink-0" />
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                            {glassGroups.map(group => (
                                <button
                                    key={group}
                                    type="button"
                                    aria-pressed={group === activeGroup}
                                    onClick={() => setSelectedGroup(group)}
                                    className={`${optionButtonClass(group === activeGroup)} flex min-h-11 items-center justify-between gap-2 px-3 text-left text-sm`}
                                >
                                    <span>{getVehicleGlassGroupInfo(group).label}</span>
                                    <span className="font-bold">{formatGlassShade(draft.vidros?.[group])}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    {activeGroup && (
                        <div className="space-y-2">
                            <p className="ui-label">{getVehicleGlassGroupInfo(activeGroup).label}</p>
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                                {getVehicleGlassGroupInfo(activeGroup).shades.map(shade => {
                                    const isSelected = draft.vidros?.[activeGroup] === shade;
                                    return (
                                        <button
                                            key={shade}
                                            type="button"
                                            aria-pressed={isSelected}
                                            onClick={() => handleShadeChange(activeGroup, shade)}
                                            className={`h-12 rounded-full border-2 text-sm font-bold transition-colors ${isSelected
                                                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                                                : 'border-blue-300 bg-[var(--surface)] text-blue-700 dark:border-blue-800 dark:text-blue-300'}`}
                                        >
                                            {shade === 'sem' ? 'sem' : shade === 'faixa' ? 'faixa' : `${shade}%`}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {lawWarnings.length > 0 && (
                        <div className="flex gap-2.5 rounded-[var(--radius-control)] border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-800/70 dark:bg-orange-950/40 dark:text-orange-100">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <p>
                                {lawWarnings.map(info => `${info.label} abaixo de ${info.lawMinimum}%`).join(' · ')}.
                                {' '}Fica abaixo do mínimo da lei de trânsito (Contran 960/2022). É só um aviso: o orçamento sai normalmente.
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-5">
                    <Input
                        id="vehicleModel"
                        label="Carro"
                        type="text"
                        value={draft.modelo}
                        onChange={event => handleModelChange(event.target.value)}
                        placeholder="Ex.: Jeep Compass 2022"
                        autoComplete="off"
                    />

                    <div>
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="ui-label">Categoria</span>
                            {suggestedCategory && suggestedCategory === draft.categoria && !isCategoryTouched && (
                                <span className="text-xs font-semibold text-[var(--brand-primary)]">Sugerida pelo modelo</span>
                            )}
                        </div>
                        <div className="mt-1.5 grid grid-cols-3 gap-2">
                            {VEHICLE_CATEGORIES.map(category => {
                                const isSelected = draft.categoria === category.id;
                                return (
                                    <button
                                        key={category.id}
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() => handleCategoryChange(category.id)}
                                        className={`${optionButtonClass(isSelected)} flex min-h-[76px] flex-col items-center justify-center gap-1 px-1 py-2 text-xs`}
                                    >
                                        <VehicleCategoryIcon category={category.id} selected={isSelected} />
                                        <span className="text-center leading-tight">{category.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <span className="ui-label block">Película</span>
                        <div className="mt-1.5 grid grid-cols-2 gap-2" role="group" aria-label="Película">
                            {filmOptions.map(film => (
                                <button
                                    key={film}
                                    type="button"
                                    aria-pressed={draft.pelicula === film}
                                    onClick={() => updateDraft({ pelicula: film })}
                                    className={`${optionButtonClass(draft.pelicula === film)} min-h-12 px-2 text-sm`}
                                >
                                    {film}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {[false, true].map(comParabrisa => (
                            <button
                                key={String(comParabrisa)}
                                type="button"
                                aria-pressed={draft.comParabrisa === comParabrisa}
                                onClick={() => updateDraft({ comParabrisa })}
                                className={`${optionButtonClass(draft.comParabrisa === comParabrisa)} flex min-h-16 flex-col items-center justify-center gap-0.5 px-2`}
                            >
                                <span className="text-sm font-bold">Completo</span>
                                <span className="text-xs text-[var(--text-muted)]">{comParabrisa ? 'com para-brisa' : 'sem para-brisa'}</span>
                            </button>
                        ))}
                    </div>

                    <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5">
                        <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-[var(--text-muted)]">
                                Preço da tabela ({getVehicleCategoryInfo(draft.categoria).label})
                            </span>
                            {tablePrice !== undefined ? (
                                isPriceTouched && draft.preco !== tablePrice ? (
                                    <button type="button" onClick={handleUseTablePrice} className="min-h-9 font-semibold text-[var(--brand-primary)]">
                                        Usar {formatCurrencyBR(tablePrice)}
                                    </button>
                                ) : (
                                    <span className="font-semibold text-[var(--text-body)]">{formatCurrencyBR(tablePrice)}</span>
                                )
                            ) : (
                                <span className="text-xs text-[var(--text-muted)]">sem preço na tabela</span>
                            )}
                        </div>
                        <label className="mt-2 flex h-14 items-center gap-2 rounded-[var(--radius-control)] border-2 border-[var(--text-strong)] px-3.5">
                            <span className="text-base font-bold text-[var(--text-muted)]">R$</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={priceText}
                                onChange={event => handlePriceChange(event.target.value)}
                                placeholder="0,00"
                                aria-label="Preço deste carro"
                                className="min-w-0 flex-1 bg-transparent text-2xl font-black text-[var(--text-strong)] outline-none"
                            />
                            {isPriceTouched && tablePrice !== undefined && draft.preco !== tablePrice && (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">ajustado</span>
                            )}
                        </label>
                    </div>

                    <button
                        type="button"
                        onClick={() => setStep('vidros')}
                        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3.5 text-left hover:bg-[var(--surface-muted)]"
                    >
                        <span className="min-w-0">
                            <span className="block text-sm font-bold text-[var(--text-strong)]">Vidros e percentual</span>
                            <span className="block truncate text-xs text-[var(--text-muted)]">{glassSummary || 'Opcional: escolha o % de cada vidro'}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                            {lawWarnings.length > 0 && <AlertTriangle className="h-4 w-4 text-orange-600" aria-label="Abaixo do mínimo da lei" />}
                            <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                        </span>
                    </button>

                    {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
                </div>
            )}
        </Modal>
    );
};

export default VehicleEditorModal;
