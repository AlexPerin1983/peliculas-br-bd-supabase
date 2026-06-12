import type { FocusEvent } from 'react';

// Em telas de toque, texto selecionado faz o Android exibir a barra nativa
// (Traduzir/Recortar/Copiar) por cima do campo. Para manter o "tocar e
// digitar por cima" sem essa barra, no celular o campo é limpo ao focar
// (o valor antigo vira placeholder) e restaurado no blur se nada for digitado.
// No desktop o comportamento continua sendo selecionar tudo.

const isTouchScreen = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

// Atribui o valor pelo setter nativo do protótipo (fora do tracker do React)
// e dispara 'input' para que inputs controlados sincronizem o estado.
const setValueAndNotify = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
        setter.call(input, value);
    } else {
        input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
};

export function selectAllForOverwrite(input: HTMLInputElement | HTMLTextAreaElement) {
    if (!isTouchScreen()) {
        input.select();
        return;
    }

    const previousValue = input.value;
    if (previousValue === '') return;

    const previousPlaceholder = input.placeholder;
    setValueAndNotify(input, '');
    input.placeholder = previousValue;

    // O evento nativo 'blur' dispara antes do onBlur do React (focusout),
    // então handlers de blur dos componentes já leem o valor restaurado.
    const restoreOnBlur = () => {
        input.removeEventListener('blur', restoreOnBlur);
        input.placeholder = previousPlaceholder;
        if (input.value === '') {
            setValueAndNotify(input, previousValue);
        }
    };
    input.addEventListener('blur', restoreOnBlur);
}

export const selectAllOnFocus = (
    e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>
) => selectAllForOverwrite(e.target);
