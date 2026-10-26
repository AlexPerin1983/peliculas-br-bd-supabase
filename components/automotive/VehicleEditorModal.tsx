import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import Input from '../ui/Input';
import VehicleCategoryIcon from './VehicleCategoryIcon';
import VehicleTopView from './VehicleTopView';
import type { AutomotiveSettings, AutomotiveVehicle, VehicleCategory, VehicleGlassPart, VehicleGlassShade } from '../../types';
import {
    AUTOMOTIVE_FILM_TYPES,
    SIDE_SHADES,
    VEHICLE_CATEGORIES,
    formatMoneyInput,
    getAutomotiveTablePrice,
    getShadeOptions,
    getVehicleAppliedParts,
    getVehicleGlassPartInfo,
    getVehicleGlassParts,
    getVehicleLawWarnings,
    matchPackage,
    normalizeVehicleGlass,
    parseMoneyInput,
    splitAutomotivePrice,
    suggestVehicleCategory,
    sumPartPrices,
} from '../../src/lib/automotive';

interface VehicleEditorModalProps {
    isOpen: boolean;
    vehicle: AutomotiveVehicle | null;
    settings?: AutomotiveSettings;
    onClose: () => void;
    onSave: (vehicle: AutomotiveVehicle) => void;
    onDelete?: (vehicleId: number) => void;
}

type Application = 'completo' | 'completo_parabrisa' | 'partes';

const formatCurrencyBR = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const optionButtonClass = (selected: boolean) => `rounded-[var(--radius-control)] font-semibold transition-colors active:scale-[0.99] ${selected
    ? 'border-2 border-[var(--brand-primary)] bg-blue-50 text-[var(--text-strong)] dark:bg-blue-950/40'
    : 'border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] hover:bg-[var(--surface-muted)]'}`;

const StepLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="ui-label block">{children}</span>
);

const getApplication = (vehicle: AutomotiveVehicle): Application => (
    vehicle.aplicacao === 'partes' ? 'partes' : vehicle.comParabrisa ? 'completo_parabrisa' : 'completo'
);

const VehicleEditorModal: React.FC<VehicleEditorModalProps> = ({ isOpen, vehicle, settings, onClose, onSave, onDelete }) => {
    const [draft, setDraft] = useState<AutomotiveVehicle | null>(null);
    const [priceText, setPriceText] = useState('');
    // Preço do pacote digitado à mão deixa de seguir a tabela.
    const [isPriceTouched, setIsPriceTouched] = useState(false);
    const [isCategoryTouched, setIsCategoryTouched] = useState(false);
    // Texto digitado no valor de cada vidro (por partes), para aceitar "62," enquanto digita.
    const [partTexts, setPartTexts] = useState<Partial<Record<VehicleGlassPart, string>>>({});
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const initial: AutomotiveVehicle = vehicle ? { ...vehicle, vidros: normalizeVehicleGlass(vehicle.vidros) } : {
            id: Date.now(),
            modelo: '',
            categoria: 'hatch',
            pelicula: AUTOMOTIVE_FILM_TYPES[0],
            comParabrisa: false,
            preco: getAutomotiveTablePrice(settings, AUTOMOTIVE_FILM_TYPES[0], 'hatch', false) ?? 0,
        };
        setDraft(initial);
        setPriceText(formatMoneyInput(initial.preco || undefined));
        setIsPriceTouched(Boolean(vehicle));
        setIsCategoryTouched(Boolean(vehicle));
        setPartTexts({});
        setError('');
        // Só ao abrir: mudar a tabela com o modal aberto não reinicia o rascunho.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, vehicle]);

    if (!draft) return null;

    const application = getApplication(draft);
    const categoryParts = getVehicleGlassParts(draft);
    const appliedParts = getVehicleAppliedParts(draft);
    const lawWarnings = getVehicleLawWarnings(draft);
    const tableSem = getAutomotiveTablePrice(settings, draft.pelicula, draft.categoria, false);
    const tableCom = getAutomotiveTablePrice(settings, draft.pelicula, draft.categoria, true);
    const tablePrice = draft.comParabrisa ? tableCom : tableSem;
    const suggestedCategory = suggestVehicleCategory(draft.modelo);

    const commit = (next: AutomotiveVehicle) => {
        setDraft(next);
        setError('');
    };

    // Pacote: o preço acompanha a tabela até ser digitado à mão.
    const toPackage = (base: AutomotiveVehicle, comParabrisa: boolean): AutomotiveVehicle => {
        const next: AutomotiveVehicle = { ...base, comParabrisa, aplicacao: undefined, partes: undefined, precoPartes: undefined };
        if (!isPriceTouched) {
            const price = getAutomotiveTablePrice(settings, next.pelicula, next.categoria, comParabrisa);
            next.preco = price ?? 0;
            setPriceText(formatMoneyInput(price));
        } else {
            next.preco = parseMoneyInput(priceText) ?? 0;
        }
        return next;
    };

    // Por partes: cada vidro com o valor sugerido (ou o que já foi digitado nele); o preço é a soma.
    const toParts = (base: AutomotiveVehicle, parts: VehicleGlassPart[], keepTyped: boolean): AutomotiveVehicle => {
        const suggested = splitAutomotivePrice(settings, base.pelicula, base.categoria);
        const precoPartes = Object.fromEntries(parts.map(part => [
            part,
            keepTyped && base.precoPartes?.[part] !== undefined ? base.precoPartes[part]! : (suggested[part] ?? 0),
        ])) as AutomotiveVehicle['precoPartes'];
        if (!keepTyped) setPartTexts({});
        return {
            ...base,
            aplicacao: 'partes',
            partes: parts,
            precoPartes,
            comParabrisa: parts.includes('pb'),
            preco: sumPartPrices(parts, precoPartes),
        };
    };

    // Vidros marcados viram pacote quando batem com ele; senão, é por partes.
    const withParts = (base: AutomotiveVehicle, parts: VehicleGlassPart[], keepTyped: boolean) => {
        const pkg = matchPackage(base.categoria, parts);
        return pkg === undefined ? toParts(base, parts, keepTyped) : toPackage(base, pkg);
    };

    const handleApplication = (kind: Application) => {
        if (kind === 'partes') {
            commit(toParts(draft, appliedParts, false));
        } else {
            commit(toPackage(draft, kind === 'completo_parabrisa'));
        }
    };

    const handleTogglePart = (part: VehicleGlassPart) => {
        const nextParts = appliedParts.includes(part)
            ? appliedParts.filter(item => item !== part)
            : categoryParts.filter(item => item === part || appliedParts.includes(item));
        if (nextParts.length === 0) {
            commit(toParts(draft, [], true));
            return;
        }
        commit(withParts(draft, nextParts, true));
    };

    // Trocou película ou categoria: valores voltam aos sugeridos da tabela.
    const handleBaseChange = (patch: Partial<AutomotiveVehicle>) => {
        const base = { ...draft, ...patch };
        if (application === 'partes') {
            const parts = getVehicleGlassParts(base).filter(part => appliedParts.includes(part));
            commit(parts.length > 0 ? withParts(base, parts, false) : toPackage(base, false));
        } else {
            commit(toPackage(base, draft.comParabrisa));
        }
    };

    const handleModelChange = (modelo: string) => {
        const suggestion = suggestVehicleCategory(modelo);
        if (!isCategoryTouched && suggestion && suggestion !== draft.categoria) {
            handleBaseChange({ modelo, categoria: suggestion });
        } else {
            commit({ ...draft, modelo });
        }
    };

    const handleCategoryChange = (categoria: VehicleCategory) => {
        setIsCategoryTouched(true);
        handleBaseChange({ categoria });
    };

    const handlePriceChange = (value: string) => {
        setPriceText(value);
        setIsPriceTouched(true);
        commit({ ...draft, preco: parseMoneyInput(value) ?? 0 });
    };

    const handleUseTablePrice = () => {
        if (tablePrice === undefined) return;
        setIsPriceTouched(false);
        setPriceText(formatMoneyInput(tablePrice));
        commit({ ...draft, preco: tablePrice });
    };

    const handlePartPriceChange = (part: VehicleGlassPart, value: string) => {
        setPartTexts(previous => ({ ...previous, [part]: value }));
        const precoPartes = { ...draft.precoPartes, [part]: parseMoneyInput(value) ?? 0 };
        commit({ ...draft, precoPartes, preco: sumPartPrices(appliedParts, precoPartes) });
    };

    // O mesmo % em todos os vidros com película (o para-brisa tem as opções dele, na lista).
    const handleShadeAll = (shade: VehicleGlassShade) => {
        const vidros = { ...draft.vidros };
        appliedParts.filter(part => part !== 'pb').forEach(part => { vidros[part] = shade; });
        commit({ ...draft, vidros });
    };

    const handlePartShade = (part: VehicleGlassPart, shade: string) => {
        const vidros = { ...draft.vidros };
        if (shade) vidros[part] = shade as VehicleGlassShade;
        else delete vidros[part];
        commit({ ...draft, vidros });
    };

    const handleSave = () => {
        if (appliedParts.length === 0) {
            setError('Marque pelo menos um vidro.');
            return;
        }
        if (!(draft.preco > 0)) {
            setError('Digite o preço deste carro.');
            return;
        }
        // Guarda só o % dos vidros que levam película.
        const vidros = Object.fromEntries(
            Object.entries(draft.vidros || {}).filter(([part]) => appliedParts.includes(part as VehicleGlassPart))
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
    const sideParts = appliedParts.filter(part => part !== 'pb');
    const isPartsMode = application === 'partes';

    const applicationOptions: { id: Application; title: string; hint: string; price: string }[] = [
        { id: 'completo', title: 'Carro completo', hint: 'Todos os vidros, sem para-brisa', price: tableSem !== undefined ? formatCurrencyBR(tableSem) : '' },
        { id: 'completo_parabrisa', title: 'Completo + para-brisa', hint: 'Todos os vidros e o para-brisa', price: tableCom !== undefined ? formatCurrencyBR(tableCom) : '' },
        { id: 'partes', title: 'Só algumas partes', hint: 'Ex.: só o para-brisa ou só as laterais', price: isPartsMode ? formatCurrencyBR(draft.preco) : 'por vidro' },
    ];

    const footer = (
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
                {vehicle ? `Salvar · ${formatCurrencyBR(draft.preco)}` : `Adicionar · ${formatCurrencyBR(draft.preco)}`}
            </ActionButton>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={vehicle ? 'Editar carro' : 'Novo carro'}
            footer={footer}
            keyboardAwareFooter
        >
            <div className="space-y-6">
                <div className="space-y-3">
                    <Input
                        id="vehicleModel"
                        label="1. Carro"
                        type="text"
                        value={draft.modelo}
                        onChange={event => handleModelChange(event.target.value)}
                        placeholder="Ex.: Jeep Compass 2022"
                        autoComplete="off"
                    />
                    <div>
                        <div className="flex items-baseline justify-between gap-2">
                            <StepLabel>Categoria</StepLabel>
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
                                        className={`${optionButtonClass(isSelected)} flex min-h-[76px] flex-col items-center justify-center gap-1 px-1 py-2 text-xs ${isSelected ? 'text-blue-700 dark:text-blue-300' : ''}`}
                                    >
                                        <VehicleCategoryIcon category={category.id} />
                                        <span className="text-center leading-tight">{category.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div>
                    <StepLabel>2. Película</StepLabel>
                    <div className="mt-1.5 grid grid-cols-2 gap-2" role="group" aria-label="Película">
                        {filmOptions.map(film => (
                            <button
                                key={film}
                                type="button"
                                aria-pressed={draft.pelicula === film}
                                onClick={() => handleBaseChange({ pelicula: film })}
                                className={`${optionButtonClass(draft.pelicula === film)} min-h-12 px-2 text-sm`}
                            >
                                {film}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <StepLabel>3. O que vai aplicar?</StepLabel>
                    <div className="mt-1.5 space-y-2">
                        {applicationOptions.map(option => (
                            <button
                                key={option.id}
                                type="button"
                                aria-pressed={application === option.id}
                                onClick={() => handleApplication(option.id)}
                                className={`${optionButtonClass(application === option.id)} flex min-h-[60px] w-full items-center justify-between gap-3 px-3.5 py-2 text-left`}
                            >
                                <span className="min-w-0">
                                    <span className="block text-sm font-bold text-[var(--text-strong)]">{option.title}</span>
                                    <span className="block text-xs font-normal text-[var(--text-muted)]">{option.hint}</span>
                                </span>
                                <span className="shrink-0 text-sm font-black text-[var(--text-strong)]">{option.price}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-xs text-[var(--text-muted)]">Azul = vai película. Toque num vidro para tirar ou colocar.</p>
                    <VehicleTopView
                        categoria={draft.categoria}
                        parts={categoryParts}
                        vidros={draft.vidros}
                        applied={appliedParts}
                        onTogglePart={handleTogglePart}
                    />
                </div>

                {sideParts.length > 0 && (
                    <div>
                        <StepLabel>4. Escurecimento (mesmo % em todos)</StepLabel>
                        <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                            {SIDE_SHADES.map(shade => {
                                const isSelected = sideParts.every(part => draft.vidros?.[part] === shade);
                                return (
                                    <button
                                        key={shade}
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() => handleShadeAll(shade)}
                                        className={`h-11 rounded-full border-2 text-[13px] font-bold transition-colors ${isSelected
                                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                                            : 'border-blue-200 bg-[var(--surface)] text-blue-700 dark:border-blue-800 dark:text-blue-300'}`}
                                    >
                                        {shade}%
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {appliedParts.length > 0 && (
                    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)]">
                        <div className="grid grid-cols-[minmax(0,1fr)_76px_104px] gap-2 bg-[var(--surface-muted)] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                            <span>Vidro</span>
                            <span>%</span>
                            <span className="text-right">Valor</span>
                        </div>
                        {appliedParts.map(part => {
                            const label = getVehicleGlassPartInfo(part).label;
                            return (
                                <div key={part} className="grid grid-cols-[minmax(0,1fr)_76px_104px] items-center gap-2 border-t border-[var(--border-subtle)] px-3 py-1.5">
                                    <span className="truncate text-sm font-semibold text-[var(--text-strong)]">{label}</span>
                                    <select
                                        value={draft.vidros?.[part] ?? ''}
                                        onChange={event => handlePartShade(part, event.target.value)}
                                        aria-label={`% do ${label}`}
                                        className="ui-field h-9 w-full px-1.5 text-sm font-bold"
                                    >
                                        <option value="">—</option>
                                        {getShadeOptions(part).map(shade => (
                                            <option key={shade} value={shade}>{shade === 'faixa' ? 'faixa' : `${shade}%`}</option>
                                        ))}
                                    </select>
                                    {isPartsMode ? (
                                        <label className="flex h-9 items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-2 text-xs text-[var(--text-muted)]">
                                            <span>R$</span>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={partTexts[part] ?? formatMoneyInput(draft.precoPartes?.[part])}
                                                onChange={event => handlePartPriceChange(part, event.target.value)}
                                                placeholder="0,00"
                                                aria-label={`Valor do ${label}`}
                                                className="min-w-0 flex-1 bg-transparent text-right text-sm font-bold text-[var(--text-strong)] outline-none"
                                            />
                                        </label>
                                    ) : (
                                        <span className="text-right text-xs text-[var(--text-muted)]">no pacote</span>
                                    )}
                                </div>
                            );
                        })}
                        <p className="border-t border-[var(--border-subtle)] px-3 py-2 text-xs leading-relaxed text-[var(--text-muted)]">
                            {isPartsMode
                                ? 'Valor de cada vidro dividido a partir da sua tabela (carro completo e para-brisa). Dá para mudar qualquer valor.'
                                : 'Preço de pacote da sua tabela. Para cobrar por vidro, escolha "Só algumas partes" ou toque num vidro.'}
                        </p>
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

                {!isPartsMode && (
                    <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5">
                        <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-[var(--text-muted)]">Preço do carro</span>
                            {tablePrice !== undefined && isPriceTouched && draft.preco !== tablePrice ? (
                                <button type="button" onClick={handleUseTablePrice} className="min-h-9 font-semibold text-[var(--brand-primary)]">
                                    Usar tabela ({formatCurrencyBR(tablePrice)})
                                </button>
                            ) : tablePrice === undefined ? (
                                <span className="text-xs text-[var(--text-muted)]">sem preço na tabela</span>
                            ) : null}
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
                )}

                {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
            </div>
        </Modal>
    );
};

export default VehicleEditorModal;
