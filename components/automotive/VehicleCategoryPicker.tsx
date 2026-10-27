import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { VehicleCategory } from '../../types';
import { VEHICLE_CATEGORIES, getVehicleCategoryInfo } from '../../src/lib/automotive';
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
        <div className="space-y-1">
            <div className="flex min-h-8 items-center justify-between gap-2">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Categoria</span>
                <div className="flex min-w-0 items-center gap-1">
                    <span className="mr-1 truncate text-xs font-semibold text-[var(--text-body)]">{getVehicleCategoryInfo(value).label}</span>
                    <button type="button" aria-label="Categorias anteriores" disabled={edges.start} onClick={() => scroll(-1)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] disabled:opacity-30">
                        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button type="button" aria-label="Mais categorias" disabled={edges.end} onClick={() => scroll(1)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] disabled:opacity-30">
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                </div>
            </div>
            <div ref={scrollRef} onScroll={updateEdges} role="group" aria-label="Categoria" className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {VEHICLE_CATEGORIES.map(category => (
                    <button
                        key={category.id}
                        type="button"
                        data-category={category.id}
                        aria-label={category.label}
                        aria-pressed={value === category.id}
                        onClick={() => onChange(category.id)}
                        className={`flex h-[54px] w-[70px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] border px-1 transition-colors ${value === category.id
                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]'
                            : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]'}`}
                    >
                        <VehicleCategoryIcon category={category.id} className="h-5 w-11" />
                        <span className="text-[11px] font-bold leading-tight">{category.shortLabel}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default VehicleCategoryPicker;
