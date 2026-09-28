import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTypingFocus } from './useTypingFocus';

const Probe: React.FC = () => {
    const typing = useTypingFocus();
    return (
        <div>
            <input aria-label="texto" />
            <input aria-label="marcar" type="checkbox" />
            <button type="button">botão</button>
            <p>{typing ? 'digitando' : 'parado'}</p>
        </div>
    );
};

describe('useTypingFocus', () => {
    afterEach(() => vi.useRealTimers());

    it('liga ao focar um campo de texto e desliga ao sair (checkbox e botão não contam)', () => {
        vi.useFakeTimers();
        render(<Probe />);
        expect(screen.getByText('parado')).toBeInTheDocument();

        act(() => screen.getByLabelText('texto').focus());
        expect(screen.getByText('digitando')).toBeInTheDocument();

        act(() => {
            screen.getByRole('button', { name: 'botão' }).focus();
            vi.advanceTimersByTime(100);
        });
        expect(screen.getByText('parado')).toBeInTheDocument();

        act(() => {
            screen.getByLabelText('marcar').focus();
            vi.advanceTimersByTime(100);
        });
        expect(screen.getByText('parado')).toBeInTheDocument();
    });
});
