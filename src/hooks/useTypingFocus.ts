import { useEffect, useState } from 'react';

// Campos que abrem o teclado do celular.
const TEXT_ENTRY = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]):not([type="file"]), textarea, select, [contenteditable="true"]';

const isTextEntry = (element: Element | null) => element instanceof HTMLElement && element.matches(TEXT_ENTRY);

/**
 * true enquanto um campo de digitação está focado (teclado aberto no celular).
 * Serve para esconder o menu fixo do rodapé, que ficaria por cima do campo.
 */
export function useTypingFocus() {
    const [typing, setTyping] = useState(() => (typeof document !== 'undefined' ? isTextEntry(document.activeElement) : false));

    useEffect(() => {
        let timer = 0;
        const onFocusIn = (event: FocusEvent) => {
            if (!isTextEntry(event.target as Element | null)) return;
            window.clearTimeout(timer);
            setTyping(true);
        };
        // Ao pular de um campo para o outro o foco sai e volta: espera um instante antes de liberar.
        const onFocusOut = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => setTyping(isTextEntry(document.activeElement)), 80);
        };
        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('focusin', onFocusIn);
            document.removeEventListener('focusout', onFocusOut);
        };
    }, []);

    return typing;
}
