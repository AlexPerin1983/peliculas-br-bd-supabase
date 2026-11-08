// Detecta quando o app está aberto pelo aplicativo da Google Play (TWA
// br.com.peliculasbr.app). Nessa versão não mostramos planos, preços nem
// pagamento: a Google Play exige o faturamento dela para compras dentro do app.
//
// Regras (na dúvida, esconde):
// 1. O primeiro carregamento do TWA chega com document.referrer
//    "android-app://br.com.peliculasbr.app". Depois disso o referrer some, então a
//    marca fica gravada no localStorage e vale para sempre neste aparelho.
// 2. Android com o app instalado (display-mode standalone/fullscreen) também conta,
//    mesmo sem a marca: cobre o caso de o localStorage ter sido limpo.
// 3. Se o localStorage falhar, a marca fica guardada na memória desta aba.

export const PLAY_STORE_PACKAGE = 'br.com.peliculasbr.app';
export const PLAY_STORE_REFERRER = `android-app://${PLAY_STORE_PACKAGE}`;
export const PLAY_STORE_FLAG_KEY = 'pbr:play-store-app';

export interface PlayStoreEnvironment {
    referrer: string;
    userAgent: string;
    isInstalledDisplay: boolean;
    storage: Pick<Storage, 'getItem' | 'setItem'> | null;
}

let memoryFlag = false;

const readFlag = (storage: PlayStoreEnvironment['storage']): boolean => {
    if (memoryFlag) return true;
    try {
        return storage?.getItem(PLAY_STORE_FLAG_KEY) === '1';
    } catch {
        return false;
    }
};

const writeFlag = (storage: PlayStoreEnvironment['storage']) => {
    memoryFlag = true;
    try {
        storage?.setItem(PLAY_STORE_FLAG_KEY, '1');
    } catch {
        // Sem localStorage: a marca da memória vale enquanto a aba estiver aberta.
    }
};

export const detectPlayStoreApp = (env: PlayStoreEnvironment): boolean => {
    if (env.referrer.startsWith(PLAY_STORE_REFERRER)) {
        writeFlag(env.storage);
        return true;
    }
    if (readFlag(env.storage)) return true;
    if (/android/i.test(env.userAgent) && env.isInstalledDisplay) {
        writeFlag(env.storage);
        return true;
    }
    return false;
};

const readBrowserEnvironment = (): PlayStoreEnvironment => {
    let storage: PlayStoreEnvironment['storage'] = null;
    try {
        storage = window.localStorage;
    } catch {
        storage = null;
    }
    let isInstalledDisplay = false;
    try {
        isInstalledDisplay = ['standalone', 'fullscreen', 'minimal-ui'].some(
            (mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches
        );
    } catch {
        isInstalledDisplay = false;
    }
    return {
        referrer: typeof document !== 'undefined' ? document.referrer || '' : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent || '' : '',
        isInstalledDisplay,
        storage,
    };
};

let cachedResult: boolean | null = null;

/** true quando planos, preços e pagamento devem ficar escondidos. */
export const isPlayStoreApp = (): boolean => {
    if (cachedResult === true) return true;
    if (typeof window === 'undefined') return false;
    cachedResult = detectPlayStoreApp(readBrowserEnvironment());
    return cachedResult;
};

/** Só para testes. */
export const resetPlayStoreAppDetection = () => {
    cachedResult = null;
    memoryFlag = false;
};
