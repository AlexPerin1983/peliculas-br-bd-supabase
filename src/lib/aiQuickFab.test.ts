import { isAIQuickFabEnabled } from './aiQuickFab';

describe('isAIQuickFabEnabled', () => {
    it('vem ligado para quem tem a IA liberada e nunca mexeu na opção', () => {
        expect(isAIQuickFabEnabled(undefined, true)).toBe(true);
        expect(isAIQuickFabEnabled({ provider: 'gemini', apiKey: '' }, true)).toBe(true);
    });

    it('respeita quem desligou', () => {
        expect(isAIQuickFabEnabled({ provider: 'gemini', apiKey: '', quickFab: false }, true)).toBe(false);
    });

    it('sem a IA liberada fica desligado, a não ser que a pessoa tenha ligado', () => {
        expect(isAIQuickFabEnabled({ provider: 'gemini', apiKey: '' }, false)).toBe(false);
        expect(isAIQuickFabEnabled({ provider: 'gemini', apiKey: '', quickFab: true }, false)).toBe(true);
    });
});
