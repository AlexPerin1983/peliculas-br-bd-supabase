// Botão voltar do celular: telas abertas por cima (ex.: ficha do cliente) fecham
// antes de o app tratar o voltar (sair da tela ou do app).
type BackHandler = () => void;

const handlers: BackHandler[] = [];

/** Registra quem fecha com o voltar; devolve a função que tira o registro. */
export const registerBackHandler = (handler: BackHandler) => {
    handlers.push(handler);
    return () => {
        const index = handlers.lastIndexOf(handler);
        if (index >= 0) handlers.splice(index, 1);
    };
};

/** Fecha a tela aberta por último. Retorna true quando o voltar foi usado. */
export const consumeBackButton = () => {
    const handler = handlers[handlers.length - 1];
    if (!handler) return false;
    handler();
    return true;
};
