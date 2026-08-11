export const DEFAULT_MENU_ORDER = [
    'dashboard',
    'clients_list',
    'client',
    'proposals',
    'history',
    'films',
    'agenda',
    'saved_places',
    'estoque',
    'qr_code',
    'fornecedores'
] as const;

export type MenuTabId = typeof DEFAULT_MENU_ORDER[number];

type MenuStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const MENU_ORDER_STORAGE_PREFIX = 'peliculas-br-menu-order-v1';
const VALID_MENU_TABS = new Set<string>(DEFAULT_MENU_ORDER);

const getBrowserStorage = (): MenuStorage | null => {
    if (typeof window === 'undefined') return null;

    try {
        return window.localStorage;
    } catch {
        return null;
    }
};

export const getMenuOrderStorageKey = (userId: string): string =>
    `${MENU_ORDER_STORAGE_PREFIX}:${userId}`;

/**
 * Mantem somente itens conhecidos, remove repeticoes e acrescenta novas telas
 * que tenham entrado no menu depois que a preferencia foi salva.
 */
export const normalizeMenuOrder = (value: unknown): MenuTabId[] => {
    const normalized: MenuTabId[] = [];
    const seen = new Set<MenuTabId>();

    if (Array.isArray(value)) {
        value.forEach(item => {
            if (typeof item !== 'string' || !VALID_MENU_TABS.has(item)) return;

            const tabId = item as MenuTabId;
            if (seen.has(tabId)) return;

            seen.add(tabId);
            normalized.push(tabId);
        });
    }

    DEFAULT_MENU_ORDER.forEach(tabId => {
        if (!seen.has(tabId)) normalized.push(tabId);
    });

    return normalized;
};

export const loadMenuOrder = (
    userId?: string | null,
    storage: MenuStorage | null = getBrowserStorage()
): MenuTabId[] => {
    if (!userId || !storage) return [...DEFAULT_MENU_ORDER];

    try {
        const saved = storage.getItem(getMenuOrderStorageKey(userId));
        return saved ? normalizeMenuOrder(JSON.parse(saved)) : [...DEFAULT_MENU_ORDER];
    } catch {
        return [...DEFAULT_MENU_ORDER];
    }
};

export const saveMenuOrder = (
    userId: string | null | undefined,
    order: readonly MenuTabId[],
    storage: MenuStorage | null = getBrowserStorage()
): MenuTabId[] => {
    const normalized = normalizeMenuOrder(order);
    if (!userId || !storage) return normalized;

    try {
        storage.setItem(getMenuOrderStorageKey(userId), JSON.stringify(normalized));
    } catch {
        // A interface continua funcional em memoria quando o storage esta bloqueado.
    }

    return normalized;
};

export const resetMenuOrder = (
    userId: string | null | undefined,
    storage: MenuStorage | null = getBrowserStorage()
): MenuTabId[] => {
    if (userId && storage) {
        try {
            storage.removeItem(getMenuOrderStorageKey(userId));
        } catch {
            // O estado em memoria ainda pode ser restaurado para o padrao.
        }
    }

    return [...DEFAULT_MENU_ORDER];
};

export const moveMenuItem = (
    order: readonly MenuTabId[],
    tabId: MenuTabId,
    direction: -1 | 1
): MenuTabId[] => {
    const normalized = normalizeMenuOrder(order);
    const currentIndex = normalized.indexOf(tabId);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= normalized.length) {
        return normalized;
    }

    const next = [...normalized];
    [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
    return next;
};

export const moveMenuItemToIndex = (
    order: readonly MenuTabId[],
    tabId: MenuTabId,
    targetIndex: number
): MenuTabId[] => {
    const normalized = normalizeMenuOrder(order);
    const currentIndex = normalized.indexOf(tabId);

    if (currentIndex < 0 || !Number.isFinite(targetIndex)) return normalized;

    const boundedTargetIndex = Math.max(
        0,
        Math.min(normalized.length - 1, Math.trunc(targetIndex))
    );

    if (currentIndex === boundedTargetIndex) return normalized;

    const next = [...normalized];
    const [movedItem] = next.splice(currentIndex, 1);
    next.splice(boundedTargetIndex, 0, movedItem);
    return next;
};

export const getPreferredStartTab = (
    userId?: string | null,
    storage: MenuStorage | null = getBrowserStorage()
): MenuTabId => loadMenuOrder(userId, storage)[0] ?? DEFAULT_MENU_ORDER[0];
