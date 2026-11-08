import { afterEach, describe, expect, it } from 'vitest';
import {
    PLAY_STORE_FLAG_KEY,
    detectPlayStoreApp,
    resetPlayStoreAppDetection,
    type PlayStoreEnvironment,
} from './playStoreApp';

const memoryStorage = () => {
    const data = new Map<string, string>();
    return {
        data,
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, value); },
    };
};

const env = (overrides: Partial<PlayStoreEnvironment> = {}): PlayStoreEnvironment => ({
    referrer: '',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130',
    isInstalledDisplay: false,
    storage: memoryStorage(),
    ...overrides,
});

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';

describe('detectPlayStoreApp', () => {
    afterEach(() => resetPlayStoreAppDetection());

    it('reconhece a abertura pelo app da Google Play e grava a marca', () => {
        const storage = memoryStorage();
        expect(detectPlayStoreApp(env({ referrer: 'android-app://br.com.peliculasbr.app/', storage }))).toBe(true);
        expect(storage.data.get(PLAY_STORE_FLAG_KEY)).toBe('1');
    });

    it('continua escondendo nas navegações seguintes, quando o referrer já sumiu', () => {
        const storage = memoryStorage();
        detectPlayStoreApp(env({ referrer: 'android-app://br.com.peliculasbr.app', storage }));
        resetPlayStoreAppDetection();
        expect(detectPlayStoreApp(env({ referrer: '', storage }))).toBe(true);
    });

    it('esconde no Android com o app instalado mesmo sem a marca', () => {
        expect(detectPlayStoreApp(env({ userAgent: ANDROID_UA, isInstalledDisplay: true }))).toBe(true);
    });

    it('mantém a marca na memória quando o localStorage falha', () => {
        const broken = {
            getItem: () => { throw new Error('bloqueado'); },
            setItem: () => { throw new Error('bloqueado'); },
        };
        expect(detectPlayStoreApp(env({ referrer: 'android-app://br.com.peliculasbr.app', storage: broken }))).toBe(true);
        expect(detectPlayStoreApp(env({ storage: broken }))).toBe(true);
    });

    it('não esconde no navegador do computador nem no Chrome comum do Android', () => {
        expect(detectPlayStoreApp(env())).toBe(false);
        expect(detectPlayStoreApp(env({ userAgent: ANDROID_UA, isInstalledDisplay: false }))).toBe(false);
    });

    it('não confunde com outro app Android', () => {
        expect(detectPlayStoreApp(env({ referrer: 'android-app://com.whatsapp/' }))).toBe(false);
    });
});
