import type { UserInfo } from '../../types';

/**
 * Botão flutuante de IA no celular: vem ligado para quem tem a IA liberada.
 * Só fica desligado se a pessoa desligar em Configurações (quickFab: false).
 */
export const isAIQuickFabEnabled = (aiConfig: UserInfo['aiConfig'] | undefined, hasIA: boolean): boolean =>
    aiConfig?.quickFab ?? hasIA;
