import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunityAccessGate } from './CommunityAccessGate';

const rpcMock = vi.hoisted(() => vi.fn());

const createMatchMedia = (query: string, matches: boolean): MediaQueryList => ({
    media: query,
    matches,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
});

vi.mock('../services/supabaseClient', () => ({
    supabase: {
        rpc: rpcMock
    }
}));

vi.mock('vaul', () => ({
    Drawer: {
        Root: ({ open, children }: any) => open ? <>{children}</> : null,
        Portal: ({ children }: any) => <>{children}</>,
        Overlay: (props: any) => <div {...props} />,
        Content: ({ children, onInteractOutside: _onInteractOutside, ...props }: any) => (
            <div role="dialog" {...props}>{children}</div>
        ),
        Title: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
    },
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

describe('CommunityAccessGate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('oferece um caminho direto para quem ja tem o codigo', () => {
        render(<CommunityAccessGate onGranted={vi.fn()} onSignOut={vi.fn()} />);

        expect(screen.getByText(/Aplicativo 100% gratuito/i)).toBeInTheDocument();
        expect(screen.getByText(/Sem cobrança, assinatura ou cadastro de cartão/i)).toBeInTheDocument();
        expect(screen.getByText(/link para abrir e instalar o aplicativo/i)).toBeInTheDocument();
        expect(screen.queryByLabelText('Código do grupo')).not.toBeInTheDocument();

        const gate = screen.getByRole('main');
        expect(gate.parentElement).toHaveClass('items-start');
        expect(gate.querySelectorAll('.lucide-message-circle')).toHaveLength(1);

        const groupLink = screen.getByRole('link', { name: /Receber meu acesso gratuito/i });
        expect(groupLink).toHaveAttribute('href', 'https://chat.whatsapp.com/L7lDpi6vxD0BYLO3vaE0fW');
        expect(groupLink).toHaveAttribute('target', '_blank');

        fireEvent.click(screen.getByRole('button', { name: /Já tenho o código/i }));

        const codeInput = screen.getByLabelText('Código do grupo');
        expect(codeInput).toBeInTheDocument();
        expect(codeInput).toHaveFocus();
    });

    it('usa a mesma janela no mobile sem abrir o teclado junto com o grupo', () => {
        const matchMediaMock = vi.spyOn(window, 'matchMedia').mockImplementation((query) => (
            createMatchMedia(query, true)
        ));
        const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
        const visualViewport = new VisualViewportMock();
        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            value: visualViewport as unknown as VisualViewport,
        });
        let unmount = () => {};

        try {
            ({ unmount } = render(<CommunityAccessGate onGranted={vi.fn()} onSignOut={vi.fn()} />));

            const groupLink = screen.getByRole('link', { name: /Receber meu acesso gratuito/i });
            expect(groupLink).not.toHaveAttribute('target');
            expect(screen.queryByLabelText('Código do grupo')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: /Já tenho o código/i }));
            expect(screen.getByLabelText('Código do grupo')).toHaveFocus();

            const submitButton = screen.getByRole('button', { name: 'Liberar meu acesso' });
            const drawerContent = submitButton.parentElement?.parentElement;
            expect(drawerContent?.style.height).toBe('800px');

            visualViewport.height = 420;
            act(() => visualViewport.dispatchEvent(new Event('resize')));

            expect(drawerContent?.style.height).toBe('420px');
            expect(drawerContent).toContainElement(submitButton);
        } finally {
            unmount();
            matchMediaMock.mockRestore();
            if (originalVisualViewport) {
                Object.defineProperty(window, 'visualViewport', originalVisualViewport);
            } else {
                delete (window as any).visualViewport;
            }
        }
    });

    it('fecha com Escape e devolve o foco ao botao que abriu o codigo', () => {
        render(<CommunityAccessGate onGranted={vi.fn()} onSignOut={vi.fn()} />);

        const openButton = screen.getByRole('button', { name: /Já tenho o código/i });
        openButton.focus();
        fireEvent.click(openButton);

        expect(screen.getByRole('dialog', { name: /Digite o código de acesso/i })).toHaveAttribute('aria-modal', 'true');
        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.queryByLabelText('Código do grupo')).not.toBeInTheDocument();
        expect(openButton).toHaveFocus();
    });

    it('libera a conta quando o servidor aceita o codigo', async () => {
        const onGranted = vi.fn().mockResolvedValue(undefined);
        rpcMock.mockResolvedValue({ data: { success: true }, error: null });
        render(<CommunityAccessGate onGranted={onGranted} onSignOut={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: /Já tenho o código/i }));
        fireEvent.change(screen.getByLabelText('Código do grupo'), { target: { value: 'aplicador25' } });
        const submitButton = screen.getByRole('button', { name: 'Liberar meu acesso' });
        expect(submitButton).toHaveAttribute('form', 'community-access-code-form');
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(rpcMock).toHaveBeenCalledWith('redeem_community_access', { p_code: 'APLICADOR25' });
            expect(onGranted).toHaveBeenCalledTimes(1);
        });
    });

    it('mantem o bloqueio quando o codigo esta incorreto', async () => {
        rpcMock.mockResolvedValue({ data: { success: false, reason: 'invalid_code' }, error: null });
        render(<CommunityAccessGate onGranted={vi.fn()} onSignOut={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: /Já tenho o código/i }));
        fireEvent.change(screen.getByLabelText('Código do grupo'), { target: { value: 'ERRADO' } });
        fireEvent.click(screen.getByRole('button', { name: 'Liberar meu acesso' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Código incorreto');
    });
});
