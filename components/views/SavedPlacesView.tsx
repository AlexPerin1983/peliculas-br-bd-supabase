import React, { useMemo, useRef, useState } from 'react';
import {
    BriefcaseBusiness,
    Check,
    ClipboardCopy,
    LocateFixed,
    Map as MapIcon,
    MapPin,
    Navigation,
    Pencil,
    Plus,
    Search,
    Share2,
    StickyNote,
    Store,
    Trash2,
    Utensils,
    Wrench,
    X
} from 'lucide-react';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import BottomSheet from '../ui/BottomSheet';
import ContentState from '../ui/ContentState';
import { useFeedback } from '../../src/contexts/FeedbackContext';
import { matchesSearch, normalizeSearchText } from '../../src/lib/textSearch';
import {
    buildAndroidMapUrl,
    buildAndroidNavigationUrl,
    buildDirectionsUrl,
    buildMapUrl,
    deleteSavedPlace,
    getSavedPlaces,
    savePlace,
    SavedPlace,
    SavedPlaceCategory,
    SavedPlaceInput
} from '../../services/savedPlacesService';

const EMPTY_FORM: SavedPlaceInput = {
    name: '',
    category: 'almoco',
    address: '',
    notes: '',
    latitude: null,
    longitude: null
};

// Texto que versões antigas gravavam no endereço quando o local era salvo só pelo GPS.
const LEGACY_GPS_ADDRESS = 'Local salvo pela posição atual';

const CATEGORY_OPTIONS: Array<{
    value: SavedPlaceCategory;
    label: string;
    icon: typeof Utensils;
    color: string;
}> = [
    { value: 'almoco', label: 'Almoço', icon: Utensils, color: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' },
    { value: 'fornecedor', label: 'Fornecedor', icon: Store, color: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
    { value: 'ferramentas', label: 'Ferramentas', icon: Wrench, color: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
    { value: 'cliente', label: 'Cliente', icon: BriefcaseBusiness, color: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' },
    { value: 'outro', label: 'Outro', icon: MapPin, color: 'bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-300' }
];

const getCategory = (category: SavedPlaceCategory) =>
    CATEGORY_OPTIONS.find(option => option.value === category) || CATEGORY_OPTIONS[4];

const hasGps = (place: Pick<SavedPlace, 'latitude' | 'longitude'>) => place.latitude != null && place.longitude != null;

const getPlaceAddress = (place: SavedPlace) =>
    place.address && place.address !== LEGACY_GPS_ADDRESS ? place.address : '';

const isAndroidDevice = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

// No Android abre o app de mapas direto; no resto, o Google Maps em outra aba (sem sair do app).
const routeLink = (place: SavedPlace) => isAndroidDevice()
    ? { href: buildAndroidNavigationUrl(place), target: '_self' }
    : { href: buildDirectionsUrl(place), target: '_blank' };

const mapLink = (place: SavedPlace) => isAndroidDevice()
    ? { href: buildAndroidMapUrl(place), target: '_self' }
    : { href: buildMapUrl(place), target: '_blank' };

const CategoryTile: React.FC<{ category: SavedPlaceCategory; size?: 'md' | 'lg' }> = ({ category, size = 'md' }) => {
    const option = getCategory(category);
    const Icon = option.icon;
    return (
        <span aria-hidden="true" className={`flex shrink-0 items-center justify-center ${option.color} ${size === 'lg' ? 'h-14 w-14 rounded-2xl' : 'h-11 w-11 rounded-xl'}`}>
            <Icon className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} />
        </span>
    );
};

/** Linha da lista no padrão de Clientes e Fornecedores: toque abre a ficha, rota direto ao lado. */
const PlaceRow: React.FC<{ place: SavedPlace; onOpen: (place: SavedPlace) => void }> = ({ place, onOpen }) => {
    const category = getCategory(place.category);
    const subtitle = [category.label, getPlaceAddress(place) || (hasGps(place) ? 'Posição pelo GPS' : '')].filter(Boolean).join(' · ');
    const route = routeLink(place);

    return (
        <li className="flex items-center gap-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] pr-1.5 shadow-[var(--shadow-hairline)] transition-colors hover:border-[var(--border-strong)]">
            <button
                type="button"
                onClick={() => onOpen(place)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-l-2xl py-3 pl-3 text-left transition-opacity active:opacity-60"
            >
                <CategoryTile category={place.category} />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-[var(--text-strong)]">{place.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{subtitle}</span>
                </span>
            </button>
            <a
                href={route.href}
                target={route.target}
                rel="noopener noreferrer"
                aria-label={`Abrir rota para ${place.name}`}
                title="Abrir rota"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--brand-primary)] transition hover:bg-blue-50 active:bg-blue-100 dark:hover:bg-blue-950/30"
            >
                <Navigation className="h-[18px] w-[18px]" aria-hidden="true" />
            </a>
        </li>
    );
};

const quickActionClassName = (primary = false) => `flex h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl font-semibold transition-colors ${
    primary
        ? 'bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-strong)]'
        : 'bg-[var(--surface-muted)] text-[var(--text-body)] hover:bg-[var(--border-subtle)]'
}`;

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode; action?: React.ReactNode }> = ({ icon, label, children, action }) => (
    <div className="flex items-start gap-3 px-3.5 py-3">
        <span className="mt-0.5 shrink-0 text-[var(--text-soft)]">{icon}</span>
        <div className="min-w-0 flex-1">
            <p className="text-xs text-[var(--text-muted)]">{label}</p>
            <div className="mt-0.5 break-words text-sm text-[var(--text-strong)]">{children}</div>
        </div>
        {action}
    </div>
);

/** Ficha do local: rota, mapa e compartilhar em cima; endereço e observação; editar/excluir embaixo. */
const PlaceDetailSheet: React.FC<{
    place: SavedPlace | null;
    onClose: () => void;
    onEdit: (place: SavedPlace) => void;
    onDelete: (place: SavedPlace) => void;
}> = ({ place, onClose, onEdit, onDelete }) => {
    const { showToast } = useFeedback();
    const [copied, setCopied] = useState(false);

    if (!place) return null;

    const category = getCategory(place.category);
    const address = getPlaceAddress(place);
    const route = routeLink(place);
    const map = mapLink(place);

    const copyText = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            return false;
        }
    };

    const handleCopyAddress = async () => {
        if (!address || !(await copyText(address))) return;
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    // Manda o local para alguém da equipe (WhatsApp, etc.) com o link do mapa.
    const handleShare = async () => {
        const url = buildMapUrl(place);
        const text = address ? `${place.name} - ${address}` : place.name;
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            try {
                await navigator.share({ title: place.name, text, url });
                return;
            } catch (error) {
                if ((error as Error)?.name === 'AbortError') return;
            }
        }
        if (await copyText(`${text}\n${url}`)) {
            showToast('Link do local copiado. Cole na conversa.', { tone: 'success', duration: 2600 });
        } else {
            showToast('Não foi possível compartilhar agora.', { tone: 'error' });
        }
    };

    return (
        <BottomSheet
            isOpen
            onClose={onClose}
            title={place.name}
            width="md"
            bodyClassName="mt-3 space-y-4 px-2"
            footer={(
                <div className="flex w-full gap-2">
                    <ActionButton onClick={() => onEdit(place)} variant="secondary" size="md" icon={<Pencil className="h-4 w-4" aria-hidden="true" />} className="flex-1">
                        Editar
                    </ActionButton>
                    <button
                        type="button"
                        onClick={() => onDelete(place)}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Excluir
                    </button>
                </div>
            )}
        >
            <>
                <div className="flex items-center gap-3">
                    <CategoryTile category={place.category} size="lg" />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-strong)]">{category.label}</p>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {hasGps(place) ? 'Posição exata pelo GPS' : 'Pelo endereço'}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    <a href={route.href} target={route.target} rel="noopener noreferrer" className={quickActionClassName(true)}>
                        <Navigation className="h-5 w-5" aria-hidden="true" />
                        {/* Tamanho no texto (não no link): uma regra global faz botões herdarem a fonte do pai. */}
                        <span className="text-xs font-semibold">Rota</span>
                    </a>
                    <a href={map.href} target={map.target} rel="noopener noreferrer" className={quickActionClassName()}>
                        <MapIcon className="h-5 w-5" aria-hidden="true" />
                        <span className="text-xs font-semibold">Ver no mapa</span>
                    </a>
                    <button type="button" onClick={() => void handleShare()} className={quickActionClassName()}>
                        <Share2 className="h-5 w-5" aria-hidden="true" />
                        <span className="text-xs font-semibold">Compartilhar</span>
                    </button>
                </div>

                {address || place.notes ? (
                    <div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
                        {address ? (
                            <DetailRow
                                icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                                label="Endereço"
                                action={(
                                    <button
                                        type="button"
                                        onClick={() => void handleCopyAddress()}
                                        aria-label={copied ? 'Endereço copiado' : 'Copiar endereço'}
                                        title={copied ? 'Endereço copiado' : 'Copiar endereço'}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                    >
                                        {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <ClipboardCopy className="h-4 w-4" aria-hidden="true" />}
                                    </button>
                                )}
                            >
                                {address}
                            </DetailRow>
                        ) : null}
                        {place.notes ? (
                            <DetailRow icon={<StickyNote className="h-4 w-4" aria-hidden="true" />} label="Observação">
                                <span className="whitespace-pre-line">{place.notes}</span>
                            </DetailRow>
                        ) : null}
                    </div>
                ) : null}
            </>
        </BottomSheet>
    );
};

const fieldClassName = 'ui-field h-11 w-full px-3 text-base sm:text-sm';

const SavedPlacesView: React.FC = () => {
    const { confirm, showAlert, showToast } = useFeedback();
    const [places, setPlaces] = useState<SavedPlace[]>(() => getSavedPlaces());
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<SavedPlaceCategory | 'all'>('all');
    const [openPlaceId, setOpenPlaceId] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<SavedPlaceInput>(EMPTY_FORM);
    const [isLocating, setIsLocating] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    const categoryCounts = useMemo(() => {
        const counts: Partial<Record<SavedPlaceCategory, number>> = {};
        places.forEach(place => { counts[place.category] = (counts[place.category] || 0) + 1; });
        return counts;
    }, [places]);
    const usedCategories = CATEGORY_OPTIONS.filter(option => categoryCounts[option.value]);

    const filteredPlaces = useMemo(() => {
        const term = normalizeSearchText(searchTerm);
        return places.filter(place => {
            if (categoryFilter !== 'all' && place.category !== categoryFilter) return false;
            if (!term) return true;
            return [place.name, getPlaceAddress(place), place.notes, getCategory(place.category).label]
                .some(value => matchesSearch(value, term));
        });
    }, [categoryFilter, places, searchTerm]);

    const openPlace = places.find(place => place.id === openPlaceId) || null;
    const isFiltering = Boolean(searchTerm.trim()) || categoryFilter !== 'all';

    const closeForm = () => {
        if (isLocating) return;
        setIsFormOpen(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
    };

    const openNewPlace = () => {
        setEditingId(null);
        setForm(categoryFilter !== 'all' ? { ...EMPTY_FORM, category: categoryFilter } : EMPTY_FORM);
        setIsFormOpen(true);
    };

    const openEditPlace = (place: SavedPlace) => {
        setOpenPlaceId(null);
        setEditingId(place.id);
        setForm({
            name: place.name,
            category: place.category,
            address: getPlaceAddress(place),
            notes: place.notes,
            latitude: place.latitude,
            longitude: place.longitude
        });
        setIsFormOpen(true);
    };

    const captureCurrentPosition = () => {
        if (!navigator.geolocation) {
            showAlert({
                title: 'Localização indisponível',
                message: 'Este aparelho ou navegador não oferece acesso à localização. Você ainda pode digitar o endereço.',
                tone: 'warning'
            });
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            position => {
                setForm(current => ({
                    ...current,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                }));
                setIsLocating(false);
                showToast('Posição atual capturada.', { tone: 'success' });
            },
            error => {
                setIsLocating(false);
                const permissionDenied = error.code === error.PERMISSION_DENIED;
                showAlert({
                    title: permissionDenied ? 'Permissão de localização negada' : 'Não foi possível obter sua posição',
                    message: permissionDenied
                        ? 'Libere a localização para este aplicativo nas configurações do celular ou digite o endereço manualmente.'
                        : 'Tente novamente em uma área com melhor sinal de GPS ou digite o endereço.',
                    tone: 'warning'
                });
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
        );
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        if (!form.name.trim()) {
            showToast('Dê um apelido para encontrar este local depois.', { tone: 'warning' });
            return;
        }
        if (!form.address.trim() && !hasGps(form)) {
            showToast('Use sua posição atual ou digite um endereço.', { tone: 'warning' });
            return;
        }

        const saved = savePlace(form, editingId || undefined);
        setPlaces(getSavedPlaces());
        closeForm();
        showToast(editingId ? `"${saved.name}" foi atualizado.` : `"${saved.name}" foi salvo neste aparelho.`, {
            tone: 'success'
        });
    };

    const handleDelete = async (place: SavedPlace) => {
        setOpenPlaceId(null);
        const accepted = await confirm({
            title: 'Excluir local salvo?',
            message: <>O local <strong>{place.name}</strong> será removido somente deste aparelho.</>,
            confirmButtonText: 'Excluir local',
            cancelButtonText: 'Cancelar',
            confirmButtonVariant: 'danger'
        });
        if (!accepted) return;

        deleteSavedPlace(place.id);
        const next = getSavedPlaces();
        setPlaces(next);
        if (categoryFilter !== 'all' && !next.some(item => item.category === categoryFilter)) setCategoryFilter('all');
        showToast('Local excluído.', { tone: 'success' });
    };

    const subtitle = places.length === 0
        ? 'Lugares que você quer achar de novo'
        : `${places.length} ${places.length === 1 ? 'local' : 'locais'} · salvos neste aparelho`;

    return (
        <div className="mx-auto w-full max-w-3xl space-y-4 pb-28 animate-fade-in sm:pb-0">
            <header className="flex items-end justify-between gap-3 px-1 pt-1">
                <div className="min-w-0">
                    <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">Meus locais</h1>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>
                </div>
                <ActionButton onClick={openNewPlace} variant="primary" size="md" icon={<Plus className="h-4 w-4" aria-hidden="true" />} className="shrink-0">
                    Novo<span className="hidden sm:inline"> local</span>
                </ActionButton>
            </header>

            {places.length > 0 ? (
                <div className="space-y-2">
                    <label className="relative block">
                        <span className="sr-only">Buscar locais salvos</span>
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)]" aria-hidden="true" />
                        <input
                            ref={searchRef}
                            type="search"
                            value={searchTerm}
                            onChange={event => setSearchTerm(event.target.value)}
                            placeholder="Buscar apelido, endereço ou observação"
                            aria-label="Buscar locais salvos"
                            autoComplete="off"
                            style={{ fontSize: 16 }}
                            className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] pl-10 pr-10 text-[var(--text-strong)] shadow-[var(--shadow-hairline)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-blue-500/10 [&::-webkit-search-cancel-button]:hidden"
                        />
                        {searchTerm ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm('');
                                    searchRef.current?.focus();
                                }}
                                aria-label="Limpar busca"
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-soft)] transition-colors hover:text-[var(--text-strong)]"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        ) : null}
                    </label>

                    {/* Mesmo formato dos filtros de Clientes; só aparecem quando há mais de uma categoria. */}
                    {usedCategories.length > 1 ? (
                        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 text-xs font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar por categoria">
                            {[{ value: 'all' as const, label: 'Todos', count: places.length }, ...usedCategories.map(option => ({ value: option.value, label: option.label, count: categoryCounts[option.value] || 0 }))].map(chip => {
                                const isActive = categoryFilter === chip.value;
                                return (
                                    <button
                                        key={chip.value}
                                        type="button"
                                        aria-pressed={isActive}
                                        onClick={() => setCategoryFilter(chip.value)}
                                        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 transition-colors ${isActive ? 'border-blue-600 bg-blue-600 text-white' : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]'}`}
                                    >
                                        {chip.label} <span className={`tabular-nums ${isActive ? 'text-white/80' : 'opacity-70'}`}>{chip.count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}

                    {isFiltering ? (
                        <p className="px-1 text-xs text-[var(--text-muted)]" aria-live="polite">
                            {filteredPlaces.length === 1 ? '1 encontrado' : `${filteredPlaces.length} encontrados`}
                        </p>
                    ) : null}
                </div>
            ) : null}

            {filteredPlaces.length > 0 ? (
                <ul className="space-y-2">
                    {filteredPlaces.map(place => (
                        <PlaceRow key={place.id} place={place} onOpen={item => setOpenPlaceId(item.id)} />
                    ))}
                </ul>
            ) : isFiltering ? (
                <ContentState
                    compact
                    icon={<Search className="h-7 w-7" aria-hidden="true" />}
                    title="Nenhum local encontrado"
                    description="Tente buscar por outro apelido, endereço ou categoria."
                />
            ) : (
                <ContentState
                    icon={<MapPin className="h-7 w-7" aria-hidden="true" />}
                    title="Nenhum local salvo ainda"
                    description="Salve aquele restaurante sem placa, a loja de ferramentas ou a obra de um cliente. Depois é só um toque para abrir a rota."
                    actionLabel="Salvar primeiro local"
                    onAction={openNewPlace}
                />
            )}

            <PlaceDetailSheet
                place={openPlace}
                onClose={() => setOpenPlaceId(null)}
                onEdit={openEditPlace}
                onDelete={place => void handleDelete(place)}
            />

            <Modal
                isOpen={isFormOpen}
                onClose={closeForm}
                title={editingId ? 'Editar local' : 'Novo local'}
                disableClose={isLocating}
                keyboardAwareFooter
                footer={(
                    <button
                        type="submit"
                        form="saved-place-form"
                        disabled={isLocating}
                        className="flex h-12 w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] text-[15px] font-semibold text-white transition-colors hover:bg-[var(--brand-primary-strong)] disabled:cursor-wait disabled:opacity-70 sm:ml-auto sm:w-auto sm:min-w-[200px] sm:px-6"
                    >
                        {editingId ? 'Salvar alterações' : 'Salvar local'}
                    </button>
                )}
            >
                <form id="saved-place-form" onSubmit={handleSubmit} className="space-y-4">
                    {hasGps(form) ? (
                        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                                <Check className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-emerald-800 dark:text-emerald-200">Posição exata salva</span>
                                <span className="block text-xs text-emerald-700/80 dark:text-emerald-300/80">A rota leva direto para este ponto.</span>
                            </span>
                            <button
                                type="button"
                                onClick={captureCurrentPosition}
                                disabled={isLocating}
                                className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                            >
                                {isLocating ? 'Buscando...' : 'Atualizar'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setForm(current => ({ ...current, latitude: null, longitude: null }))}
                                disabled={isLocating}
                                aria-label="Remover posição do GPS"
                                className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:bg-emerald-100 disabled:opacity-60 dark:hover:bg-emerald-500/20"
                            >
                                Remover
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={captureCurrentPosition}
                            disabled={isLocating}
                            className="flex w-full items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-left transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-wait disabled:opacity-70 dark:border-blue-400/20 dark:bg-blue-500/10 dark:hover:bg-blue-500/15"
                        >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary)] text-white">
                                <LocateFixed className={`h-5 w-5 ${isLocating ? 'animate-pulse' : ''}`} aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold text-blue-800 dark:text-blue-200">
                                    {isLocating ? 'Buscando sua posição...' : 'Usar onde estou agora'}
                                </span>
                                <span className="mt-0.5 block text-xs text-blue-700/80 dark:text-blue-300/80">
                                    Salva o ponto exato pelo GPS. O celular pede permissão.
                                </span>
                            </span>
                        </button>
                    )}

                    <div>
                        <label htmlFor="saved-place-name" className="ui-label mb-1.5 block">Apelido do local</label>
                        <input
                            id="saved-place-name"
                            value={form.name}
                            onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                            placeholder="Ex.: Almoço da sexta, Loja do João"
                            className={fieldClassName}
                        />
                    </div>

                    <fieldset>
                        <legend className="ui-label mb-1.5 block">Categoria</legend>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORY_OPTIONS.map(option => {
                                const Icon = option.icon;
                                const selected = form.category === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setForm(current => ({ ...current, category: option.value }))}
                                        className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition ${
                                            selected
                                                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                                                : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] hover:bg-[var(--surface-muted)]'
                                        }`}
                                        aria-pressed={selected}
                                    >
                                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>

                    <div>
                        <label htmlFor="saved-place-address" className="mb-1.5 flex items-baseline justify-between gap-2">
                            <span className="ui-label">Endereço ou ponto de referência</span>
                            {hasGps(form) ? <span className="text-xs text-[var(--text-soft)]">Opcional</span> : null}
                        </label>
                        <input
                            id="saved-place-address"
                            value={form.address}
                            onChange={event => setForm(current => ({ ...current, address: event.target.value }))}
                            placeholder="Rua, número, bairro, cidade"
                            autoComplete="street-address"
                            className={fieldClassName}
                        />
                    </div>

                    <div>
                        <label htmlFor="saved-place-notes" className="mb-1.5 flex items-baseline justify-between gap-2">
                            <span className="ui-label">Observação</span>
                            <span className="text-xs text-[var(--text-soft)]">Opcional</span>
                        </label>
                        <textarea
                            id="saved-place-notes"
                            value={form.notes}
                            onChange={event => setForm(current => ({ ...current, notes: event.target.value }))}
                            placeholder="Ex.: prato feito bom, estacionar na rua lateral"
                            rows={3}
                            className="ui-field w-full resize-none px-3 py-2.5 text-base sm:text-sm"
                        />
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default SavedPlacesView;
