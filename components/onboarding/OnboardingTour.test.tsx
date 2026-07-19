import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingTour from './OnboardingTour';

describe('OnboardingTour', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });

    it('mostra um caminho curto de quatro passos para uma conta nova', () => {
        const onNavigate = vi.fn();
        render(<OnboardingTour onNavigate={onNavigate} />);

        act(() => vi.advanceTimersByTime(700));

        expect(screen.getByText('Passo 1 de 4')).toBeInTheDocument();
        expect(screen.getByText(/crie seu primeiro orçamento real/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /próximo/i }));

        expect(screen.getByText('Passo 2 de 4')).toBeInTheDocument();
        expect(screen.getByText(/cadastre um cliente real/i)).toBeInTheDocument();
        expect(onNavigate).toHaveBeenCalledWith('client');
    });

    it('não reinicia para quem já concluiu a versão atual', () => {
        localStorage.setItem('peliculas-br-onboarding-v1', 'done');
        render(<OnboardingTour onNavigate={vi.fn()} />);

        act(() => vi.advanceTimersByTime(700));
        expect(screen.queryByRole('dialog', { name: /guia de primeiros passos/i })).not.toBeInTheDocument();
    });
});
