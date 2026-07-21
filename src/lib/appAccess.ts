const ADMIN_ONLY_TABS = new Set(['assistentes']);

export const canAccessAppTab = (tab: string, isAdmin: boolean): boolean => (
    isAdmin || !ADMIN_ONLY_TABS.has(tab)
);
