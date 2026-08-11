export type SavedPlaceCategory = 'almoco' | 'fornecedor' | 'ferramentas' | 'cliente' | 'outro';

export interface SavedPlace {
    id: string;
    name: string;
    category: SavedPlaceCategory;
    address: string;
    notes: string;
    latitude: number | null;
    longitude: number | null;
    createdAt: string;
    updatedAt: string;
}

export type SavedPlaceInput = Pick<
    SavedPlace,
    'name' | 'category' | 'address' | 'notes' | 'latitude' | 'longitude'
>;

const STORAGE_KEY = 'peliculas-br-saved-places-v1';
const CATEGORIES: SavedPlaceCategory[] = ['almoco', 'fornecedor', 'ferramentas', 'cliente', 'outro'];

const isFiniteCoordinate = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const normalizePlace = (value: unknown): SavedPlace | null => {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Partial<SavedPlace>;
    if (
        typeof candidate.id !== 'string' ||
        typeof candidate.name !== 'string' ||
        !CATEGORIES.includes(candidate.category as SavedPlaceCategory)
    ) {
        return null;
    }

    const hasCoordinates =
        isFiniteCoordinate(candidate.latitude) &&
        isFiniteCoordinate(candidate.longitude);

    return {
        id: candidate.id,
        name: candidate.name.trim(),
        category: candidate.category as SavedPlaceCategory,
        address: typeof candidate.address === 'string' ? candidate.address.trim() : '',
        notes: typeof candidate.notes === 'string' ? candidate.notes.trim() : '',
        latitude: hasCoordinates ? candidate.latitude as number : null,
        longitude: hasCoordinates ? candidate.longitude as number : null,
        createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
        updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString()
    };
};

const createId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `place-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const persist = (places: SavedPlace[]): void => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
};

export const getSavedPlaces = (): SavedPlace[] => {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map(normalizePlace)
            .filter((place): place is SavedPlace => Boolean(place?.name))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch {
        return [];
    }
};

export const savePlace = (input: SavedPlaceInput, id?: string): SavedPlace => {
    const now = new Date().toISOString();
    const places = getSavedPlaces();
    const existing = id ? places.find(place => place.id === id) : undefined;
    const place: SavedPlace = {
        id: existing?.id || createId(),
        name: input.name.trim(),
        category: input.category,
        address: input.address.trim(),
        notes: input.notes.trim(),
        latitude: isFiniteCoordinate(input.latitude) ? input.latitude : null,
        longitude: isFiniteCoordinate(input.longitude) ? input.longitude : null,
        createdAt: existing?.createdAt || now,
        updatedAt: now
    };

    const nextPlaces = existing
        ? places.map(item => item.id === existing.id ? place : item)
        : [place, ...places];

    persist(nextPlaces);
    return place;
};

export const deleteSavedPlace = (id: string): void => {
    persist(getSavedPlaces().filter(place => place.id !== id));
};

const getDestination = (place: SavedPlace): string => {
    if (isFiniteCoordinate(place.latitude) && isFiniteCoordinate(place.longitude)) {
        return `${place.latitude},${place.longitude}`;
    }
    return place.address;
};

export const buildDirectionsUrl = (place: SavedPlace): string =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(getDestination(place))}&travelmode=driving`;

export const buildMapUrl = (place: SavedPlace): string =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getDestination(place))}`;

export const buildAndroidNavigationUrl = (place: SavedPlace): string =>
    `google.navigation:q=${encodeURIComponent(getDestination(place))}&mode=d`;

export const buildAndroidMapUrl = (place: SavedPlace): string => {
    const destination = getDestination(place);
    const query = place.latitude != null && place.longitude != null
        ? `${destination}(${place.name})`
        : destination;

    return `geo:0,0?q=${encodeURIComponent(query)}`;
};

export const SAVED_PLACES_STORAGE_KEY = STORAGE_KEY;
