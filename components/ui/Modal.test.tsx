import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

// Como no vaul (Radix): com deferred, o portal só mostra o conteúdo depois de montar.
const portalState = vi.hoisted(() => ({ deferred: false }));

vi.mock('vaul', async () => {
    const { useLayoutEffect, useState } = await import('react');
    const Portal = ({ children }: any) => {
        const [mounted, setMounted] = useState(!portalState.deferred);
        useLayoutEffect(() => setMounted(true), []);
        return mounted ? <>{children}</> : null;
    };
    return {
        Drawer: {
            Root: ({ open, children }: any) => open ? <>{children}</> : null,
            Portal,
            Overlay: (props: any) => <div {...props} />,
            Content: ({ children, onInteractOutside: _onInteractOutside, ...props }: any) => (
                <div {...props}>{children}</div>
            ),
            Title: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
        },
    };
});

const mobileState = vi.hoisted(() => ({ value: true }));

vi.mock('../../src/hooks/useIsMobile', () => ({
    useIsMobile: () => mobileState.value,
}));

class VisualViewportMock extends EventTarget {
    height = 800;
    width = 400;
    offsetLeft = 0;
    offsetTop = 0;
    pageLeft = 0;
    pageTop = 0;
    scale = 1;
    onresize = null;
    onscroll = null;
}

const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
let visualViewport: VisualViewportMock;

const renderModal = (keyboardAwareFooter?: boolean) => render(
    <Modal
        isOpen
        onClose={vi.fn()}
        title="Modal de teste"
        footer={<button type="button">Continuar</button>}
        keyboardAwareFooter={keyboardAwareFooter}
    >
        <textarea aria-label="Conteúdo" />
    </Modal>
);

const getDrawerContent = () => (
    screen.getByRole('button', { name: 'Continuar' }).parentElement?.parentElement
);

describe('Modal keyboardAwareFooter', () => {
    beforeEach(() => {
        mobileState.value = true;
        portalState.deferred = false;
        visualViewport = new VisualViewportMock();
        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            value: visualViewport as unknown as VisualViewport,
        });
    });

    afterEach(() => {
        cleanup();
        if (originalVisualViewport) {
            Object.defineProperty(window, 'visualViewport', originalVisualViewport);
        } else {
            delete (window as any).visualViewport;
        }
    });

    it('enquadra o Drawer inteiro na área visível acima do teclado', () => {
        renderModal(true);
        const drawerContent = getDrawerContent();

        expect(drawerContent?.style.height).toBe('800px');
        expect(drawerContent?.style.top).toBe('0px');
        expect(drawerContent?.style.bottom).toBe('auto');

        visualViewport.height = 500;
        act(() => visualViewport.dispatchEvent(new Event('resize')));

        expect(drawerContent?.style.height).toBe('500px');
        expect(drawerContent?.style.maxHeight).toBe('500px');
        expect(screen.getByRole('button', { name: 'Continuar' }).parentElement?.style.transform).toBe('');
    });

    it('mantém o Drawer legado sem dimensão inline quando a opção não é informada', () => {
        renderModal();

        expect(getDrawerContent()?.style.height).toBe('');
    });

    it('também enquadra o diálogo em celulares com viewport larga', () => {
        mobileState.value = false;
        renderModal(true);

        const dialog = screen.getByRole('dialog', { name: 'Modal de teste' });
        const viewportFrame = dialog.parentElement;
        expect(viewportFrame?.style.height).toBe('800px');

        visualViewport.height = 420;
        act(() => visualViewport.dispatchEvent(new Event('resize')));

        expect(viewportFrame?.style.height).toBe('420px');
        expect(dialog.style.maxHeight).toBe('90%');
        expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
    });

    it('campo em foco sobe para o topo da área visível, com o rótulo (mesmo com o conteúdo montado depois de abrir)', async () => {
        portalState.deferred = true;
        render(
            <Modal isOpen onClose={vi.fn()} title="Formulário" footer={<button type="button">Salvar</button>}>
                <div>
                    <label htmlFor="quantidade">Quantidade</label>
                    <input id="quantidade" inputMode="numeric" />
                </div>
            </Modal>
        );
        const input = screen.getByLabelText('Quantidade');
        const container = input.closest('.overflow-y-auto') as HTMLElement;
        const box = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 375, width: 375, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
        // Teclado aberto: a área rolável vai de 76 a 387 e o campo (358–408) ficaria atrás do rodapé.
        container.getBoundingClientRect = () => box(76, 311);
        input.getBoundingClientRect = () => box(358, 50);
        input.parentElement!.getBoundingClientRect = () => box(330, 78);
        Object.defineProperty(container, 'clientHeight', { configurable: true, value: 311 });
        visualViewport.height = 470;

        act(() => input.focus());
        await act(async () => { await new Promise(resolve => window.requestAnimationFrame(() => resolve(null))); });

        // O bloco do campo (rótulo + campo) fica 12px abaixo do topo da área.
        expect(container.scrollTop).toBe(330 - (76 + 12));
        // Espaço no fim para rolar até lá, menor que a área (o rodapé não sai do lugar).
        expect(parseInt(container.style.paddingBottom, 10)).toBeGreaterThan(0);
        expect(parseInt(container.style.paddingBottom, 10)).toBeLessThan(311);
    });
});
