import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { VehicleCategory } from '../../types';
import { VEHICLE_CATEGORIES } from '../../src/lib/automotive';
import VehicleCategoryIcon from './VehicleCategoryIcon';

interface VehicleCategoryPickerProps {
    value: VehicleCategory;
    onChange: (category: VehicleCategory) => void;
}

const VehicleCategoryPicker: React.FC<VehicleCategoryPickerProps> = ({ value, onChange }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [edges, setEdges] = useState({ start: true, end: false });

    const updateEdges = () => {
        const list = scrollRef.current;
        if (!list) return;
        const start = list.scrollLeft <= 2;
        const end = list.scrollLeft + list.clientWidth >= list.scrollWidth - 2;
        setEdges(previous => previous.start === start && previous.end === end ? previous : { start, end });
    };

    useEffect(() => {
        const list = scrollRef.current;
        if (!list) return;
        updateEdges();
        const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updateEdges);
        observer?.observe(list);
        return () => observer?.disconnect();
    }, []);

    useEffect(() => {
        const selected = scrollRef.current?.querySelector<HTMLButtonElement>(`[data-category="${value}"]`);
        selected?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
        updateEdges();
    }, [value]);

    const scroll = (direction: -1 | 1) => {
        const list = scrollRef.current;
        if (!list) return;
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        list.scrollBy({ left: direction * list.clientWidth * 0.75, behavior: reduceMotion ? 'auto' : 'smooth' });
    };

    return (
        <div className="flex items-center gap-1">
            <button type="button" aria-label="Categorias anteriores" disabled={edges.start} onClick={() => scroll(-1)} className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] disabled:opacity-20">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <div ref={scrollRef} onScroll={updateEdges} role="group" aria-label="Categoria" className="flex min-w-0 flex-1 snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain px-0.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {VEHICLE_CATEGORIES.map(category => (
                    <button
                        key={category.id}
                        type="button"
                        data-category={category.id}
                        aria-label={category.label}
                        aria-pressed={value === category.id}
                        onClick={() => onChange(category.id)}
                        className={`flex h-[58px] w-[66px] shrink-0 snap-start flex-col items-center justify-center gap-1 border-b-2 px-1 transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] ${value === category.id
                            ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                            : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-strong)]'}`}
                    >
                        <VehicleCategoryIcon category={category.id} className="h-5 w-11" />
                        <span className="text-[11px] font-medium leading-tight">{category.shortLabel}</span>
                    </button>
                ))}
            </div>
            <button type="button" aria-label="Mais categorias" disabled={edges.end} onClick={() => scroll(1)} className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] disabled:opacity-20">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    );
};

export default VehicleCategoryPicker;
