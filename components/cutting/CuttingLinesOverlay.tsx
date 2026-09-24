import React from 'react';
import type { CutLine } from '../../utils/straightCuts';

interface CuttingLinesOverlayProps {
    lines: CutLine[];
    scale: number;
    // Mapa girado (tela cheia na horizontal): o comprimento da bobina vai para o eixo x.
    landscape?: boolean;
}

const meters = (value: number) => (value / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/** Desenha as linhas de corte por cima do mapa, sem capturar toques. */
export default function CuttingLinesOverlay({ lines, scale, landscape = false }: CuttingLinesOverlayProps) {
    // Espaço na tela até o corte principal vizinho: decide o tamanho da etiqueta.
    const numbered = lines.filter(line => line.order !== undefined).sort((a, b) => a.position - b.position);
    const labelRoom = (line: CutLine) => {
        const index = numbered.indexOf(line);
        const neighbours = [numbered[index - 1], numbered[index + 1]].filter(Boolean);
        return Math.min(Infinity, ...neighbours.map(other => Math.abs(other.position - line.position) * scale));
    };

    return (
        <div className="cutting-lines" aria-hidden="true">
            {lines.map((line, index) => {
                // No mapa normal, 'across' é horizontal; girado, vira vertical.
                const horizontal = (line.direction === 'across') !== landscape;
                const style: React.CSSProperties = horizontal
                    ? { left: line.from * scale, top: line.position * scale, width: (line.to - line.from) * scale }
                    : { left: line.position * scale, top: line.from * scale, height: (line.to - line.from) * scale };

                return (
                    <div key={index} className="cutting-line" style={style}
                        data-horizontal={horizontal} data-level={Math.min(line.level, 3)} data-end={!!line.isEnd}>
                        {line.order !== undefined && (() => {
                            // Linha deitada: a etiqueta precisa de ~20px de altura; em pé, de largura para o texto.
                            const room = labelRoom(line);
                            if (room < (horizontal ? 20 : 22)) return null;
                            const showMeters = horizontal || room >= 96;
                            return (
                                <span className="cutting-line-label" title={`Corte ${line.isEnd ? 'final' : line.order} em ${meters(line.position)} m`}>
                                    <b>{line.isEnd ? '✂ fim' : `✂ ${line.order}`}</b>{showMeters && `${meters(line.position)} m`}
                                </span>
                            );
                        })()}
                    </div>
                );
            })}
        </div>
    );
}
