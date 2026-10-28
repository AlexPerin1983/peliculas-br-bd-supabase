// Sem internet, o Supabase não consegue renovar o login vencido (a cada 1 hora)
// e avisa "sem sessão", mas mantém o login guardado no aparelho. Nesse caso o
// app continua na conta; só sai quando o login guardado some (saída de verdade).

export const shouldKeepSessionWhileOffline = (input: {
    event?: string;
    incomingSession: unknown;
    hasPersistedSession: boolean;
}): boolean => (
    !input.incomingSession
    && input.event !== 'SIGNED_OUT'
    && input.hasPersistedSession
);
