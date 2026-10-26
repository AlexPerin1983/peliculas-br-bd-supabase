import React, { useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import VehicleCategoryIcon from './VehicleCategoryIcon';
import VehicleTopView from './VehicleTopView';
import type { AutomotiveSettings, AutomotiveVehicle, VehicleCategory, VehicleGlassPart, VehicleGlassShade } from '../../types';
import {
    AUTOMOTIVE_FILM_TYPES,
    SIDE_SHADES,
    VEHICLE_CATEGORIES,
    formatMoneyInput,
    getAutomotiveFilmShortName,
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
    // Lista vidro a vidro (% e valor de cada um), aberta só quando o usuário pede.
    const [isListOpen, setIsListOpen] = useState(false);

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
        setIsListOpen(false);
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
    const commonShade = sideParts.length > 0 && sideParts.every(part => draft.vidros?.[part] === draft.vidros?.[sideParts[0]])
        ? draft.vidros?.[sideParts[0]]
        : undefined;

    const applicationOptions: { id: Application; title: string; price: string }[] = [
        { id: 'completo', title: 'Carro completo', price: tableSem !== undefined ? formatCurrencyBR(tableSem) : 'sem preço na tabela' },
        { id: 'completo_parabrisa', title: 'Completo + para-brisa', price: tableCom !== undefined ? formatCurrencyBR(tableCom) : 'sem preço na tabela' },
        { id: 'partes', title: 'Só algumas partes', price: isPartsMode ? formatCurrencyBR(draft.preco) : 'valor por vidro' },
    ];

    const glassSummary = appliedParts.length === 0
        ? 'Nenhum vidro com película'
        : `${appliedParts.length} ${appliedParts.length === 1 ? 'vidro' : 'vidros'} com película${commonShade ? ` · ${commonShade === 'faixa' ? 'faixa' : `${commonShade}%`}` : sideParts.length > 0 && sideParts.some(part => draft.vidros?.[part]) ? ' · % por vidro' : ''}`;
    const lawSummary = lawWarnings.length > 0
        ? `Abaixo da lei: ${lawWarnings.map(info => info.label).join(', ')}`
        : 'Toque para ver vidro a vidro';

    const footer = (
        <div className="flex w-full items-center gap-2">
            {vehicle && onDelete && !isListOpen && (
                <ActionButton
                    variant="ghost"
                    size="lg"
                    iconOnly
                    aria-label="Excluir carro"
                    icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                    onClick={() => onDelete(vehicle.id)}
                />
            )}
            <label className="flex min-w-0 flex-1 flex-col">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {isPartsMode ? 'Total (soma dos vidros)' : 'Preço do carro'}
                </span>
                <span className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-[var(--text-muted)]">R$</span>
                    {isPartsMode ? (
                        <span className="truncate text-2xl font-black text-[var(--text-strong)]">{formatMoneyInput(draft.preco)}</span>
                    ) : (
                        <input
                            type="text"
                            inputMode="decimal"
                            value={priceText}
                            onChange={event => handlePriceChange(event.target.value)}
                            placeholder="0,00"
                            aria-label="Preço deste carro"
                            className="w-full min-w-0 bg-transparent text-[var(--text-strong)] outline-none"
                            // Fixo no elemento: a regra global "input { font: inherit }" vence as classes de fonte.
                            style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.2 }}
                        />
                    )}
                </span>
                {!isPartsMode && isPriceTouched && tablePrice !== undefined && draft.preco !== tablePrice && (
                    <button type="button" onClick={handleUseTablePrice} className="self-start text-[var(--brand-primary)]">
                        <span className="text-[11px] font-semibold">ajustado · usar tabela ({formatCurrencyBR(tablePrice)})</span>
                    </button>
                )}
            </label>
            {isListOpen ? (
                <ActionButton variant="primary" size="lg" onClick={() => setIsListOpen(false)}>Pronto</ActionButton>
            ) : (
                <ActionButton variant="primary" size="lg" onClick={handleSave}>{vehicle ? 'Salvar' : 'Adicionar'}</ActionButton>
            )}
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isListOpen ? 'Vidro a vidro' : (vehicle ? 'Editar carro' : 'Novo carro')}
            footer={footer}
            keyboardAwareFooter
        >
            {isListOpen ? (
                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={() => setIsListOpen(false)}
                        className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[var(--brand-primary)]"
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        Voltar ao carro
                    </button>
                    {appliedParts.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)]">Nenhum vidro com película. Toque nos vidros do desenho para marcar.</p>
                    ) : (
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
                        </div>
                    )}
                    <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                        {isPartsMode
                            ? 'Valor de cada vidro dividido a partir da sua tabela (carro completo e para-brisa). Dá para mudar qualquer valor.'
                            : 'No pacote vale o preço da tabela. Toque num vidro do desenho para cobrar por partes.'}
                    </p>
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
                <div className="space-y-3">
                    <input
                        type="text"
                        value={draft.modelo}
                        onChange={event => handleModelChange(event.target.value)}
                        placeholder="Carro (ex.: Jeep Compass 2022)"
                        aria-label="Carro"
                        autoComplete="off"
                        className="ui-field block h-11 w-full px-3 text-[15px] font-semibold"
                    />

                    <div className="grid grid-cols-6 gap-1" role="group" aria-label="Categoria">
                        {VEHICLE_CATEGORIES.map(category => {
                            const isSelected = draft.categoria === category.id;
                            return (
                                <button
                                    key={category.id}
                                    type="button"
                                    aria-pressed={isSelected}
                                    aria-label={category.label}
                                    title={category.label}
                                    onClick={() => handleCategoryChange(category.id)}
                                    className={`flex h-[58px] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] px-0.5 transition-colors active:scale-[0.98] ${isSelected
                                        ? 'border-2 border-[var(--brand-primary)] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                        : 'border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-strong)]'}`}
                                >
                                    <VehicleCategoryIcon category={category.id} className="h-[22px] w-[46px]" />
                                    <span className="text-[10.5px] font-bold leading-tight">{category.shortLabel}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="grid gap-[3px] rounded-[var(--radius-control)] bg-[var(--surface-muted)] p-[3px]" style={{ gridTemplateColumns: `repeat(${filmOptions.length}, minmax(0, 1fr))` }} role="group" aria-label="Película">
                        {filmOptions.map(film => {
                            const isSelected = draft.pelicula === film;
                            return (
                                <button
                                    key={film}
                                    type="button"
                                    aria-pressed={isSelected}
                                    aria-label={film}
                                    onClick={() => handleBaseChange({ pelicula: film })}
                                    className={`h-9 truncate rounded-[calc(var(--radius-control)-3px)] px-1 text-[13px] font-bold transition-colors ${isSelected
                                        ? 'bg-[var(--surface-raised)] text-[var(--text-strong)] shadow-[var(--shadow-hairline)]'
                                        : 'text-[var(--text-muted)]'}`}
                                >
                                    {getAutomotiveFilmShortName(film)}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-start gap-2.5">
                        <div className="flex shrink-0 flex-col items-center gap-0.5">
                            <VehicleTopView
                                categoria={draft.categoria}
                                parts={categoryParts}
                                vidros={draft.vidros}
                                applied={appliedParts}
                                onTogglePart={handleTogglePart}
                                width={150}
                            />
                            <span className="text-[10.5px] text-[var(--text-muted)]">Toque no vidro</span>
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Aplicar</span>
                            {applicationOptions.map(option => {
                                const isSelected = application === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() => handleApplication(option.id)}
                                        className={`${optionButtonClass(isSelected)} flex min-h-[50px] flex-col items-start justify-center px-2.5 py-1 text-left`}
                                    >
                                        <span className="text-[13px] font-extrabold leading-tight text-[var(--text-strong)]">{option.title}</span>
                                        <span className={`text-xs font-semibold ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-[var(--text-muted)]'}`}>{option.price}</span>
                                    </button>
                                );
                            })}

                            <span className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Escurecimento</span>
                            <div className="grid grid-cols-3 gap-1.5">
                                {SIDE_SHADES.map(shade => {
                                    const isSelected = sideParts.length > 0 && commonShade === shade;
                                    return (
                                        <button
                                            key={shade}
                                            type="button"
                                            aria-pressed={isSelected}
                                            disabled={sideParts.length === 0}
                                            onClick={() => handleShadeAll(shade)}
                                            className={`h-[34px] rounded-full border-[1.5px] text-[12.5px] font-extrabold transition-colors disabled:opacity-40 ${isSelected
                                                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                                                : 'border-blue-200 bg-[var(--surface)] text-blue-700 dark:border-blue-800 dark:text-blue-300'}`}
                                        >
                                            {shade}%
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => setIsListOpen(true)}
                                    className="h-[34px] rounded-full border-[1.5px] border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]"
                                >
                                    <span className="text-xs font-bold">Ajustar</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsListOpen(true)}
                        className="flex min-h-12 w-full items-center gap-2.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1.5 text-left"
                    >
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-bold text-[var(--text-strong)]">{glassSummary}</span>
                            <span className={`block truncate text-[11.5px] ${lawWarnings.length > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-[var(--text-muted)]'}`}>{lawSummary}</span>
                        </span>
                        {lawWarnings.length > 0 && <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600" aria-hidden="true" />}
                        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                    </button>

                    {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
                </div>
            )}
        </Modal>
    );
};

export default VehicleEditorModal;
