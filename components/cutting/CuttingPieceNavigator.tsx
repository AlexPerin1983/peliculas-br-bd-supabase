import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, LockKeyhole, Search, X } from 'lucide-react';

interface PieceEntry { id: string; number: number; room: string; size: string; locked: boolean }
interface Props {
    pieces: PieceEntry[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onClose: () => void;
}

export default function CuttingPieceNavigator({ pieces, selectedId, onSelect, onClose }: Props) {
    const [query, setQuery] = useState('');
    const panelRef = useRef<HTMLElement>(null);
    const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const filtered = pieces.filter(piece => normalize(`peça ${piece.number} ${piece.room} ${piece.size}`).includes(normalize(query.trim())));

    useEffect(() => {
        const previousFocus = document.activeElement as HTMLElement | null;
        panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
        return () => { previousFocus?.focus({ preventScroll: true }); };
    }, []);

    return <section ref={panelRef} className="cutting-navigator" role="dialog" aria-modal="true" aria-label="Localizar peça"
        onKeyDown={event => {
            if (event.key !== 'Tab') return;
            const targets = panelRef.current?.querySelectorAll<HTMLElement>('button, input');
            if (!targets?.length) return;
            const first = targets[0], last = targets[targets.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
        <header className="cutting-navigator-header">
            <button type="button" onClick={onClose} aria-label="Voltar ao mapa"><ArrowLeft size={21} /></button>
            <div><h2>Localizar peça</h2><p>Escolha uma peça para vê-la no mapa.</p></div>
        </header>
        <div className="cutting-navigator-search"><Search size={19} aria-hidden="true" />
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Número, ambiente ou medida" aria-label="Buscar peças" />
            {query && <button type="button" aria-label="Limpar busca" onClick={() => setQuery('')}><X size={18} /></button>}
        </div>
        <p className="cutting-navigator-count" role="status">{filtered.length} de {pieces.length} peças no plano <span>Medidas em metros</span></p>
        <div className="cutting-navigator-list">
            {filtered.map(piece => <button key={piece.id} type="button" className="cutting-navigator-piece" aria-pressed={selectedId === piece.id} onClick={() => onSelect(piece.id)}>
                <span className="cutting-navigator-number">{piece.number}</span>
                <span className="cutting-navigator-description"><strong>{piece.room}</strong><span>{piece.size} m</span></span>
                {piece.locked && <LockKeyhole size={16} aria-label="Posição travada" />}
                <ArrowUpRight size={20} aria-hidden="true" />
            </button>)}
            {!filtered.length && <div className="cutting-navigator-empty"><strong>Nenhuma peça encontrada</strong><p>Tente outro número, ambiente ou medida.</p><button type="button" onClick={() => setQuery('')}>Mostrar todas as peças</button></div>}
        </div>
    </section>;
}
