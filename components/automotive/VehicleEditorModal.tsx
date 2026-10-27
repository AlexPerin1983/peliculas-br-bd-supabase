import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Search, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import VehicleCategoryPicker from './VehicleCategoryPicker';
import VehicleTopView from './VehicleTopView';
import type { AutomotiveSettings, AutomotiveVehicle, VehicleCategory, VehicleGlassPart, VehicleGlassShade } from '../../types';
import {
    AUTOMOTIVE_FILM_TYPES,
    SIDE_SHADES,
    formatMoneyInput,
    getAutomotiveFilmShortName,
    getDefaultRemovalPrice,
    getVehicleCategoryInfo,
    getVehicleRemovalPrice,
    getVehicleTotal,
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
    const [removalText, setRemovalText] = useState<string | undefined>(undefined);

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
        setRemovalText(undefined);
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
            setError(isGroupedGlass ? 'Marque pelo menos uma área.' : 'Marque pelo menos um vidro.');
            return;
        }
        if (!(draft.preco > 0)) {
            setError(isHeavyVehicle ? 'Digite o preço deste veículo.' : 'Digite o preço deste carro.');
            return;
        }
        // Guarda só o % dos vidros que levam película.
        const vidros = Object.fromEntries(
            Object.entries(draft.vidros || {}).filter(([part]) => appliedParts.includes(part as VehicleGlassPart))
        ) as AutomotiveVehicle['vidros'];
        const texto = draft.observacoes?.texto?.trim();
        const observacoes = draft.observacoes ? { ...draft.observacoes, texto: texto || undefined } : undefined;
        const hasNotes = Boolean(observacoes?.removerAntiga || observacoes?.riscoPrevio || observacoes?.texto);
        onSave({
            ...draft,
            modelo: draft.modelo.trim(),
            observacoes: hasNotes ? observacoes : undefined,
            vidros: vidros && Object.keys(vidros).length > 0 ? vidros : undefined,
        });
    };

    // Observações rápidas. Marcar a remoção já traz o valor sugerido da tabela.
    const notes = draft.observacoes || {};
    const updateNotes = (patch: Partial<NonNullable<AutomotiveVehicle['observacoes']>>) => {
        const next = { ...notes, ...patch };
        const hasNotes = next.removerAntiga || next.riscoPrevio || next.texto !== undefined;
        commit({ ...draft, observacoes: hasNotes ? next : undefined });
    };
    const handleToggleRemoval = () => {
        if (notes.removerAntiga) {
            updateNotes({ removerAntiga: false });
            return;
        }
        const value = notes.valorRemocao ?? getDefaultRemovalPrice(settings);
        setRemovalText(formatMoneyInput(value));
        updateNotes({ removerAntiga: true, valorRemocao: value });
    };
    const handleRemovalPriceChange = (value: string) => {
        setRemovalText(value);
        updateNotes({ valorRemocao: parseMoneyInput(value) ?? 0 });
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
    const categoryInfo = getVehicleCategoryInfo(draft.categoria);
    const categoryLabel = categoryInfo.label;
    const isGroupedGlass = categoryInfo.glassUnit === 'área';
    const isHeavyVehicle = ['onibus', 'caminhao', 'maquina'].includes(draft.categoria);
    const suggestedCategory = suggestVehicleCategory(draft.modelo);
    const removalPrice = getVehicleRemovalPrice(draft);
    const total = getVehicleTotal(draft);

    const applicationOptions: { id: Application; title: string; price: string }[] = [
        { id: 'completo', title: isHeavyVehicle ? 'Completo' : 'Carro completo', price: tableSem !== undefined ? formatCurrencyBR(tableSem) : 'sem preço na tabela' },
        { id: 'completo_parabrisa', title: '+ Para-brisa', price: tableCom !== undefined ? formatCurrencyBR(tableCom) : 'sem preço na tabela' },
        { id: 'partes', title: 'Por partes', price: isPartsMode ? formatCurrencyBR(draft.preco) : (isGroupedGlass ? 'valor por área' : 'valor por vidro') },
    ];

    const glassSummary = lawWarnings.length > 0
        ? `Abaixo da lei: ${lawWarnings.map(info => info.id.toUpperCase()).join(', ')}`
        : appliedParts.length === 0
            ? (isGroupedGlass ? 'Nenhuma área marcada' : 'Nenhum vidro marcado')
            : `${appliedParts.length} ${categoryInfo.glassUnit ? (appliedParts.length === 1 ? 'área' : 'áreas') : (appliedParts.length === 1 ? 'vidro' : 'vidros')} com película`;

    const noteChips: { id: 'remover' | 'risco' | 'texto'; label: string; checked: boolean; onToggle: () => void }[] = [
        { id: 'remover', label: 'Remover película antiga', checked: Boolean(notes.removerAntiga), onToggle: handleToggleRemoval },
        { id: 'risco', label: 'Vidro com risco ou trinca', checked: Boolean(notes.riscoPrevio), onToggle: () => updateNotes({ riscoPrevio: !notes.riscoPrevio }) },
        { id: 'texto', label: 'Observação', checked: notes.texto !== undefined, onToggle: () => updateNotes({ texto: notes.texto === undefined ? '' : undefined }) },
    ];

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
                    {isPartsMode ? (isGroupedGlass ? 'Total (soma das áreas)' : 'Total (soma dos vidros)') : (isHeavyVehicle ? 'Preço do veículo' : 'Preço do carro')}
                </span>
                <span className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-[var(--text-muted)]">R$</span>
                    {isPartsMode || removalPrice > 0 ? (
                        <span className="truncate text-2xl font-black tracking-tight text-[var(--text-strong)]">{formatMoneyInput(total)}</span>
                    ) : (
                        <input
                            type="text"
                            inputMode="decimal"
                            value={priceText}
                            onChange={event => handlePriceChange(event.target.value)}
                            placeholder="0,00"
                            aria-label={isHeavyVehicle ? 'Preço deste veículo' : 'Preço deste carro'}
                            className="w-full min-w-0 bg-transparent text-[var(--text-strong)] outline-none"
                            // Fixo no elemento: a regra global "input { font: inherit }" vence as classes de fonte.
                            style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.2 }}
                        />
                    )}
                </span>
                {removalPrice > 0 ? (
                    <span className="truncate text-[11px] text-[var(--text-muted)]">
                        vidros {formatCurrencyBR(draft.preco)} + remoção {formatCurrencyBR(removalPrice)}
                    </span>
                ) : !isPartsMode && isPriceTouched && tablePrice !== undefined && draft.preco !== tablePrice ? (
                    <button type="button" onClick={handleUseTablePrice} className="self-start text-[var(--brand-primary)]">
                        <span className="text-[11px] font-semibold">ajustado · usar tabela ({formatCurrencyBR(tablePrice)})</span>
                    </button>
                ) : null}
            </label>
            {isListOpen ? (
                <ActionButton variant="primary" size="lg" onClick={() => setIsListOpen(false)}><span className="text-sm font-bold">Pronto</span></ActionButton>
            ) : (
                <ActionButton variant="primary" size="lg" onClick={handleSave}><span className="text-sm font-bold">{vehicle ? 'Salvar' : 'Adicionar'}</span></ActionButton>
            )}
        </div>
    );

    const title = isListOpen ? (isGroupedGlass ? 'Área a área' : 'Vidro a vidro') : (
        <span className="block">
            <span className="block">{isHeavyVehicle ? (vehicle ? 'Editar veículo' : 'Novo veículo') : (vehicle ? 'Editar carro' : 'Novo carro')}</span>
            <span className="block text-xs font-normal text-[var(--text-muted)]">{categoryLabel} · {draft.pelicula}</span>
        </span>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
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
                        {isHeavyVehicle ? 'Voltar ao veículo' : 'Voltar ao carro'}
                    </button>
                    {appliedParts.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)]">{isGroupedGlass ? 'Nenhuma área com película. Toque no desenho para marcar.' : 'Nenhum vidro com película. Toque nos vidros do desenho para marcar.'}</p>
                    ) : (
                        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)]">
                            <div className="grid grid-cols-[minmax(0,1fr)_76px_104px] gap-2 bg-[var(--surface-muted)] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                                <span>{isGroupedGlass ? 'Área' : 'Vidro'}</span>
                                <span>%</span>
                                <span className="text-right">Valor</span>
                            </div>
                            {appliedParts.map(part => {
                                const label = getVehicleGlassPartInfo(part, draft.categoria).label;
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
                            ? (isGroupedGlass ? 'Valor de cada área dividido a partir da sua tabela (completo e para-brisa). Dá para mudar qualquer valor.' : 'Valor de cada vidro dividido a partir da sua tabela (carro completo e para-brisa). Dá para mudar qualquer valor.')
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
                <div className="-mx-1 -my-[5px] space-y-2">
                    <div className="ui-field flex h-10 items-center gap-2 px-3">
                        <Search className="h-4 w-4 shrink-0 text-[var(--text-soft)]" aria-hidden="true" />
                        <input
                            type="text"
                            value={draft.modelo}
                            onChange={event => handleModelChange(event.target.value)}
                            placeholder={isHeavyVehicle ? 'Veículo (modelo ou identificação)' : 'Carro (ex.: Jeep Compass 2022)'}
                            aria-label={isHeavyVehicle ? 'Veículo' : 'Carro'}
                            autoComplete="off"
                            className="min-w-0 flex-1 bg-transparent text-[var(--text-strong)] outline-none"
                            style={{ fontSize: 16, fontWeight: 650 }}
                        />
                        {suggestedCategory && suggestedCategory === draft.categoria && !isCategoryTouched && (
                            <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                {getVehicleCategoryInfo(suggestedCategory).shortLabel} sugerido
                            </span>
                        )}
                    </div>

                    <VehicleCategoryPicker value={draft.categoria} onChange={handleCategoryChange} />

                    <div className="grid gap-[3px] rounded-[var(--radius-control)] bg-slate-200/70 p-[3px] dark:bg-slate-800" style={{ gridTemplateColumns: `repeat(${filmOptions.length}, minmax(0, 1fr))` }} role="group" aria-label="Película">
                        {filmOptions.map(film => {
                            const isSelected = draft.pelicula === film;
                            return (
                                <button
                                    key={film}
                                    type="button"
                                    aria-pressed={isSelected}
                                    aria-label={film}
                                    onClick={() => handleBaseChange({ pelicula: film })}
                                    className={`h-8 truncate rounded-[calc(var(--radius-control)-3px)] px-1 transition-colors ${isSelected
                                        ? 'bg-[var(--surface-raised)] text-[var(--text-strong)] shadow-[0_1px_3px_rgba(15,23,42,0.15)]'
                                        : 'text-[var(--text-muted)]'}`}
                                >
                                    <span className="text-[12.5px] font-bold">{getAutomotiveFilmShortName(film)}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-stretch gap-3 py-2">
                        <div className="flex w-[164px] shrink-0 flex-col gap-2 max-[380px]:w-[148px]">
                            <VehicleTopView
                                categoria={draft.categoria}
                                parts={categoryParts}
                                vidros={draft.vidros}
                                applied={appliedParts}
                                onTogglePart={handleTogglePart}
                                width={164}
                            />
                            {categoryParts.includes('ts') && (
                                <button
                                    type="button"
                                    aria-pressed={appliedParts.includes('ts')}
                                    aria-label="Aplicar película no teto solar"
                                    onClick={() => handleTogglePart('ts')}
                                    className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border px-2 ${appliedParts.includes('ts')
                                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]'
                                        : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)]'}`}
                                >
                                    <span aria-hidden="true" className="text-sm leading-none">{appliedParts.includes('ts') ? '−' : '+'}</span>
                                    <span className="text-[11px] font-semibold">Teto solar</span>
                                </button>
                            )}
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-[7px] pt-3">
                            <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Aplicar</span>
                            {applicationOptions.map(option => {
                                const isSelected = application === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() => handleApplication(option.id)}
                                        className={`flex min-h-[46px] items-center justify-between gap-1.5 rounded-[var(--radius-control)] px-2 py-1 text-left transition-colors ${isSelected
                                            ? 'border-[1.5px] border-[var(--brand-primary)] bg-blue-50 dark:bg-blue-950/40'
                                            : 'border border-[var(--border-subtle)] bg-[var(--surface)]'}`}
                                    >
                                        <span className="min-w-0">
                                            <span className="block text-xs font-extrabold leading-tight text-[var(--text-strong)]">{option.title}</span>
                                            <span className={`block text-[11px] font-semibold ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-[var(--text-muted)]'}`}>{option.price}</span>
                                        </span>
                                        <span
                                            aria-hidden="true"
                                            className={`h-4 w-4 shrink-0 rounded-full bg-white dark:bg-slate-900 ${isSelected ? 'border-[5px] border-[var(--brand-primary)]' : 'border-[1.5px] border-slate-300 dark:border-slate-600'}`}
                                        />
                                    </button>
                                );
                            })}

                            <span className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Escurecimento</span>
                            <div className="grid grid-cols-3 gap-[5px]">
                                {SIDE_SHADES.map(shade => {
                                    const isSelected = sideParts.length > 0 && commonShade === shade;
                                    return (
                                        <button
                                            key={shade}
                                            type="button"
                                            aria-pressed={isSelected}
                                            disabled={sideParts.length === 0}
                                            onClick={() => handleShadeAll(shade)}
                                            className={`h-8 rounded-full border transition-colors disabled:opacity-40 ${isSelected
                                                ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                                                : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-strong)]'}`}
                                        >
                                            <span className="text-xs font-extrabold">{shade}%</span>
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => setIsListOpen(true)}
                                    className="h-8 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-body)]"
                                >
                                    <span className="text-[11.5px] font-bold">Ajustar</span>
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsListOpen(true)}
                                className={`mt-auto flex min-h-8 items-center gap-1 text-left ${lawWarnings.length > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-[var(--text-muted)]'}`}
                            >
                                {lawWarnings.length > 0 && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                                <span className="truncate text-[11px] font-semibold">{glassSummary}</span>
                                <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <span className="block text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Observações</span>
                        <div className="flex flex-wrap gap-1.5">
                            {noteChips.map(chip => (
                                <button
                                    key={chip.id}
                                    type="button"
                                    aria-pressed={chip.checked}
                                    onClick={chip.onToggle}
                                    className={`inline-flex h-8 items-center gap-1.5 rounded-full pl-2 pr-3 transition-colors ${chip.checked
                                        ? 'border-[1.5px] border-[var(--brand-primary)] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                        : 'border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]'}`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] ${chip.checked ? 'bg-[var(--brand-primary)] text-white' : 'border-[1.5px] border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'}`}
                                    >
                                        {chip.checked && <Check className="h-3 w-3" strokeWidth={3} />}
                                    </span>
                                    <span className="text-[12.5px] font-bold">{chip.label}</span>
                                </button>
                            ))}
                        </div>
                        {notes.removerAntiga && (
                            <label className="flex h-[38px] items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3">
                                <span className="flex-1 text-[12.5px] text-[var(--text-muted)]">Remoção (soma no preço)</span>
                                <span className="text-xs font-bold text-[var(--text-muted)]">+ R$</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={removalText ?? formatMoneyInput(notes.valorRemocao)}
                                    onChange={event => handleRemovalPriceChange(event.target.value)}
                                    placeholder="0,00"
                                    aria-label="Valor da remoção"
                                    className="w-20 bg-transparent text-right text-[var(--text-strong)] outline-none"
                                    style={{ fontSize: 16, fontWeight: 750 }}
                                />
                            </label>
                        )}
                        {notes.texto !== undefined && (
                            <input
                                type="text"
                                value={notes.texto}
                                onChange={event => updateNotes({ texto: event.target.value })}
                                placeholder="Ex.: não mexer no adesivo do vidro traseiro"
                                aria-label="Observação"
                                className="ui-field block h-[38px] w-full px-3 text-[13px]"
                            />
                        )}
                    </div>

                    {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
                </div>
            )}
        </Modal>
    );
};

export default VehicleEditorModal;
