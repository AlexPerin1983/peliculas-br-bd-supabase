import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ClientServicesSection from './ClientServicesSection';

describe('ClientServicesSection', () => {
    it('oferece agendar por voz ao lado de agendar serviço', () => {
        const onSchedule = vi.fn();
        const onScheduleByVoice = vi.fn();
        render(<ClientServicesSection agendamentos={[]} onOpen={vi.fn()} onSchedule={onSchedule} onScheduleByVoice={onScheduleByVoice} />);

        fireEvent.click(screen.getByRole('button', { name: /Por voz/ }));
        expect(onScheduleByVoice).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: /Agendar serviço/ }));
        expect(onSchedule).toHaveBeenCalledTimes(1);
    });

    it('sem a ação de voz, mostra só agendar serviço', () => {
        render(<ClientServicesSection agendamentos={[]} onOpen={vi.fn()} onSchedule={vi.fn()} />);
        expect(screen.queryByRole('button', { name: /Por voz/ })).not.toBeInTheDocument();
    });
});
