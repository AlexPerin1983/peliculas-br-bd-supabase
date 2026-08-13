export const APP_TABS = [
    'dashboard',
    'client',
    'cliente_hub',
    'clients_list',
    'films',
    'settings',
    'history',
    'proposals',
    'agenda',
    'sales',
    'admin',
    'account',
    'estoque',
    'qr_code',
    'fornecedores',
    'saved_places',
] as const;

export type PersistedAppTab = typeof APP_TABS[number];

type ActiveTabStorage = Pick<Storage, 'getItem' | 'setItem'>;

const ACTIVE_TAB_STORAGE_KEY = 'peliculas-br-active-tab';
const VALID_APP_TABS = new Set<string>(APP_TABS);

const getBrowserStorage = (): ActiveTabStorage | null => {
    if (typeof window === 'undefined') return null;

    try {
        return window.localStorage;
    } catch {
        return null;
    }
};

export const isPersistedAppTab = (value: unknown): value is PersistedAppTab => (
    typeof value === 'string' && VALID_APP_TABS.has(value)
);

export const loadActiveTab = (
    storage: ActiveTabStorage | null = getBrowserStorage()
): PersistedAppTab | null => {
    if (!storage) return null;

    try {
        const savedTab = storage.getItem(ACTIVE_TAB_STORAGE_KEY);
        return isPersistedAppTab(savedTab) ? savedTab : null;
    } catch {
        return null;
    }
};

export const saveActiveTab = (
    tab: PersistedAppTab,
    storage: ActiveTabStorage | null = getBrowserStorage()
): void => {
    if (!storage) return;

    try {
        storage.setItem(ACTIVE_TAB_STORAGE_KEY, tab);
    } catch {
        // A navegacao continua funcional em memoria se o storage estiver bloqueado.
    }
};

export const resolveStartupTab = (
    explicitTab: PersistedAppTab | null,
    persistedTab: PersistedAppTab | null,
    firstMenuTab?: PersistedAppTab
): PersistedAppTab => explicitTab ?? persistedTab ?? firstMenuTab ?? 'dashboard';
