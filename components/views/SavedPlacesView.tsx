import React, { useMemo, useState } from 'react';
import {
    BriefcaseBusiness,
    Edit3,
    ExternalLink,
    Map,
    MapPin,
    Navigation,
    Plus,
    Search,
    Store,
    Trash2,
    Utensils,
    Wrench,
    X
} from 'lucide-react';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import ContentState from '../ui/ContentState';
import { useFeedback } from '../../src/contexts/FeedbackContext';
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

const inputClass =
    'h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm text-[var(--text-strong)] shadow-[var(--shadow-hairline)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-blue-500/10';

const SavedPlacesView: React.FC = () => {
    const { confirm, showAlert, showToast } = useFeedback();
    const [places, setPlaces] = useState<SavedPlace[]>(() => getSavedPlaces());
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<SavedPlaceInput>(EMPTY_FORM);
    const [isLocating, setIsLocating] = useState(false);
    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

    const filteredPlaces = useMemo(() => {
        const term = searchTerm.trim().toLocaleLowerCase('pt-BR');
        if (!term) return places;

        return places.filter(place => {
            const category = getCategory(place.category).label;
            return [place.name, place.address, place.notes, category]
                .some(value => value.toLocaleLowerCase('pt-BR').includes(term));
        });
    }, [places, searchTerm]);

    const closeForm = () => {
        if (isLocating) return;
        setIsFormOpen(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
    };

    const openNewPlace = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setIsFormOpen(true);
    };

    const openEditPlace = (place: SavedPlace) => {
        setEditingId(place.id);
        setForm({
            name: place.name,
            category: place.category,
            address: place.address,
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
                    longitude: position.coords.longitude,
                    address: current.address || 'Local salvo pela posição atual'
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

    const handleAddressChange = (address: string) => {
        setForm(current => ({ ...current, address }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        if (!form.name.trim()) {
            showToast('Dê um apelido para encontrar este local depois.', { tone: 'warning' });
            return;
        }
        if (!form.address.trim() && (form.latitude == null || form.longitude == null)) {
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
        const accepted = await confirm({
            title: 'Excluir local salvo?',
            message: <>O local <strong>{place.name}</strong> será removido somente deste aparelho.</>,
            confirmButtonText: 'Excluir local',
            cancelButtonText: 'Cancelar',
            confirmButtonVariant: 'danger'
        });
        if (!accepted) return;

        deleteSavedPlace(place.id);
        setPlaces(getSavedPlaces());
        showToast('Local excluído.', { tone: 'success' });
    };

    const formTitle = editingId ? 'Editar local salvo' : 'Salvar um local';

    return (
        <div className="mx-auto w-full max-w-4xl space-y-5 animate-fade-in">
            <section className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]">
                <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
                    <div>
                        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                            <Map className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <h2 className="text-xl font-bold tracking-[-0.02em] text-[var(--text-strong)] sm:text-2xl">
                            Seus lugares úteis, sempre à mão
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
                            Salve pelo GPS ou pelo endereço. Depois, toque em “Ir agora” para abrir a rota no mapa.
                        </p>
                    </div>
                    <ActionButton
                        onClick={openNewPlace}
                        variant="primary"
                        size="lg"
                        icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                        className="w-full sm:w-auto"
                    >
                        Salvar local
                    </ActionButton>
                </div>
                <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] px-5 py-3 text-xs text-[var(--text-muted)] sm:px-6">
                    <span className="inline-flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-[var(--brand-primary)]" aria-hidden="true" />
                        Os locais ficam somente neste aparelho e não usam o banco de dados da empresa.
                    </span>
                </div>
            </section>

            {places.length > 0 ? (
                <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-soft)]">
                        <Search className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <input
                        type="search"
                        value={searchTerm}
                        onChange={event => setSearchTerm(event.target.value)}
                        placeholder="Buscar por apelido, endereço ou categoria..."
                        aria-label="Buscar locais salvos"
                        className={`${inputClass} pl-10 pr-10`}
                    />
                    {searchTerm ? (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-soft)] hover:text-[var(--text-strong)]"
                            aria-label="Limpar busca"
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    ) : null}
                </div>
            ) : null}

            {filteredPlaces.length === 0 ? (
                searchTerm ? (
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
                        description="Salve aquele restaurante sem placa, uma loja de ferramentas ou qualquer ponto ao qual você queira voltar."
                        actionLabel="Salvar primeiro local"
                        onAction={openNewPlace}
                    />
                )
            ) : (
                <div className="grid gap-3 md:grid-cols-2">
                    {filteredPlaces.map(place => {
                        const category = getCategory(place.category);
                        const CategoryIcon = category.icon;
                        const usesGps = place.latitude != null && place.longitude != null;

                        return (
                            <article
                                key={place.id}
                                className="flex min-w-0 flex-col rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-hairline)] transition-shadow hover:shadow-[var(--shadow-soft)]"
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] ${category.color}`}>
                                        <CategoryIcon className="h-4 w-4" aria-hidden="true" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h3 className="truncate text-base font-bold text-[var(--text-strong)]">{place.name}</h3>
                                                <span className="text-[11px] font-semibold text-[var(--text-muted)]">{category.label}</span>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditPlace(place)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-soft)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                                    aria-label={`Editar ${place.name}`}
                                                >
                                                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleDelete(place)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-soft)] transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                                                    aria-label={`Excluir ${place.name}`}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--text-muted)]">
                                            {place.address || 'Local salvo pela posição GPS'}
                                        </p>
                                    </div>
                                </div>

                                {place.notes ? (
                                    <p className="mt-3 rounded-[var(--radius-control)] bg-[var(--surface-muted)] px-3 py-2 text-xs leading-relaxed text-[var(--text-muted)]">
                                        {place.notes}
                                    </p>
                                ) : null}

                                <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-soft)]">
                                        <MapPin className="h-3 w-3" aria-hidden="true" />
                                        {usesGps ? 'Posição exata' : 'Por endereço'}
                                    </span>
                                    <div className="flex gap-2">
                                        <a
                                            href={isAndroid ? buildAndroidMapUrl(place) : buildMapUrl(place)}
                                            target="_self"
                                            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition hover:text-[var(--brand-primary)]"
                                            aria-label={`Ver ${place.name} no mapa`}
                                            title="Ver no mapa"
                                        >
                                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                        </a>
                                        <a
                                            href={isAndroid ? buildAndroidNavigationUrl(place) : buildDirectionsUrl(place)}
                                            target="_self"
                                            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--brand-primary)] px-4 text-sm font-bold text-white shadow-[0_10px_22px_rgba(37,99,235,0.2)] transition hover:brightness-105"
                                            aria-label={`Abrir rota para ${place.name}`}
                                        >
                                            <Navigation className="h-4 w-4" aria-hidden="true" />
                                            Ir agora
                                        </a>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            <Modal
                isOpen={isFormOpen}
                onClose={closeForm}
                title={formTitle}
                disableClose={isLocating}
                footer={
                    <>
                        <ActionButton onClick={closeForm} variant="secondary" size="md" disabled={isLocating}>
                            Cancelar
                        </ActionButton>
                        <ActionButton
                            onClick={() => {
                                const formElement = document.getElementById('saved-place-form') as HTMLFormElement | null;
                                formElement?.requestSubmit();
                            }}
                            variant="primary"
                            size="md"
                            disabled={isLocating}
                        >
                            {editingId ? 'Salvar alterações' : 'Salvar local'}
                        </ActionButton>
                    </>
                }
            >
                <form id="saved-place-form" onSubmit={handleSubmit} className="space-y-5">
                    <button
                        type="button"
                        onClick={captureCurrentPosition}
                        disabled={isLocating}
                        className="flex w-full items-center gap-3 rounded-[var(--radius-panel)] border border-blue-200 bg-blue-50 p-4 text-left transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-wait disabled:opacity-70 dark:border-blue-400/20 dark:bg-blue-500/10 dark:hover:bg-blue-500/15"
                    >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-blue-600 text-white">
                            {isLocating ? <Navigation className="h-4 w-4 animate-pulse" /> : <MapPin className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-bold text-blue-800 dark:text-blue-200">
                                {isLocating ? 'Buscando sua posição...' : form.latitude != null ? 'Atualizar posição atual' : 'Usar onde estou agora'}
                            </span>
                            <span className="mt-0.5 block text-xs text-blue-700/75 dark:text-blue-300/70">
                                O celular pedirá permissão para acessar o GPS.
                            </span>
                        </span>
                    </button>

                    {form.latitude != null && form.longitude != null ? (
                        <div className="flex items-center gap-2 rounded-[var(--radius-control)] bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                            Posição exata capturada com sucesso
                        </div>
                    ) : null}

                    <div>
                        <label htmlFor="saved-place-name" className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">
                            Apelido do local
                        </label>
                        <input
                            id="saved-place-name"
                            value={form.name}
                            onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                            placeholder="Ex.: Almoço da sexta, Loja do João"
                            className={inputClass}
                            autoFocus
                        />
                    </div>

                    <fieldset>
                        <legend className="mb-2 block text-xs font-bold text-[var(--text-muted)]">Categoria</legend>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {CATEGORY_OPTIONS.map(option => {
                                const Icon = option.icon;
                                const selected = form.category === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setForm(current => ({ ...current, category: option.value }))}
                                        className={`flex h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] border px-3 text-xs font-bold transition ${
                                            selected
                                                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]'
                                                : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]'
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
                        <label htmlFor="saved-place-address" className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">
                            Endereço ou ponto de referência
                        </label>
                        <input
                            id="saved-place-address"
                            value={form.address}
                            onChange={event => handleAddressChange(event.target.value)}
                            placeholder="Rua, número, bairro, cidade..."
                            className={inputClass}
                        />
                        <p className="mt-1.5 text-[11px] text-[var(--text-soft)]">
                            Se você usar o GPS, este campo é opcional e serve apenas para ajudá-lo a reconhecer o lugar.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="saved-place-notes" className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">
                            Observação <span className="font-normal">(opcional)</span>
                        </label>
                        <textarea
                            id="saved-place-notes"
                            value={form.notes}
                            onChange={event => setForm(current => ({ ...current, notes: event.target.value }))}
                            placeholder="Ex.: prato feito bom, estacionar na rua lateral..."
                            rows={3}
                            className={`${inputClass} h-auto min-h-24 resize-y py-3`}
                        />
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default SavedPlacesView;
