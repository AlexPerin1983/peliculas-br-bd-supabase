import React from 'react';
import { Bobina } from '../../../types';
import { PackageIcon, QrCodeIcon, TrashIcon } from './EstoqueIcons';

type EstoqueBobinasPanelProps = {
    viewMode: 'grid' | 'list';
    filteredBobinas: Bobina[];
    onShowQR: (type: 'bobina', item: Bobina) => void;
    onChangeStatus: (type: 'bobina', item: Bobina) => void;
    onDelete: (type: 'bobina', id: number) => void;
    getStatusLabel: (status: string) => string;
    getStatusColor: (status: string) => string;
};

export default function EstoqueBobinasPanel({
    viewMode,
    filteredBobinas,
    onShowQR,
    onChangeStatus,
    onDelete,
    getStatusLabel,
    getStatusColor,
}: EstoqueBobinasPanelProps) {
    if (viewMode === 'grid') {
        return (
            <div className="estoque-list">
                {filteredBobinas.length === 0 ? (
                    <div className="empty-state">
                        <PackageIcon />
                        <p className="empty-state-title">Nenhuma bobina encontrada</p>
                        <p className="empty-hint">Ajuste os filtros ou cadastre uma nova bobina.</p>
                    </div>
                ) : (
                    filteredBobinas.map((bobina) => (
                        <div key={bobina.id} className="estoque-card">
                            <div className="card-header-row">
                                <h3 className="card-title">{bobina.filmId}</h3>
                                <div className="card-header-right">
                                    <span
                                        className="status-pill"
                                        style={{ backgroundColor: getStatusColor(bobina.status) }}
                                    >
                                        {getStatusLabel(bobina.status)}
                                    </span>
                                    <button
                                        className="qr-icon-btn"
                                        onClick={() => onShowQR('bobina', bobina)}
                                        title="QR Code"
                                    >
                                        <QrCodeIcon />
                                    </button>
                                </div>
                            </div>

                            {bobina.localizacao && (
                                <div className="card-location-row">
                                    {'\u{1F4CD}'} {bobina.localizacao}
                                </div>
                            )}

                            <div className="card-body">
                                <div className="main-metric">
                                    <div className="metric-value-group">
                                        <span className="metric-value">{bobina.comprimentoRestanteM.toFixed(1)}</span>
                                        <span className="metric-unit">m</span>
                                    </div>
                                    <span className="metric-label">restantes de {bobina.comprimentoTotalM}m</span>
                                </div>

                                <div className="progress-section">
                                    <div className="progress-bar-thin">
                                        <div
                                            className="progress-fill"
                                            style={{
                                                width: `${(bobina.comprimentoRestanteM / bobina.comprimentoTotalM) * 100}%`,
                                                background:
                                                    bobina.comprimentoRestanteM / bobina.comprimentoTotalM > 0.5
                                                        ? '#22c55e'
                                                        : bobina.comprimentoRestanteM / bobina.comprimentoTotalM > 0.2
                                                          ? '#f59e0b'
                                                          : '#ef4444',
                                            }}
                                        />
                                    </div>
                                    <span className="usage-text">
                                        {((1 - bobina.comprimentoRestanteM / bobina.comprimentoTotalM) * 100).toFixed(0)}% usado
                                    </span>
                                </div>

                                <div className="info-chips">
                                    <div className="info-chip">
                                        <span className="chip-value">{bobina.larguraCm}</span>
                                        <span className="chip-label">cm largura</span>
                                    </div>
                                    {bobina.fornecedor && (
                                        <div className="info-chip">
                                            <span className="chip-value">{bobina.fornecedor}</span>
                                            <span className="chip-label">fornecedor</span>
                                        </div>
                                    )}
                                    {bobina.lote && (
                                        <div className="info-chip">
                                            <span className="chip-value">{bobina.lote}</span>
                                            <span className="chip-label">lote</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="card-footer">
                                <button
                                    className="primary-action-btn"
                                    onClick={() => onChangeStatus('bobina', bobina)}
                                >
                                    {'\u2699\uFE0F'} Gerenciar
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        );
    }

    return (
        <div className="estoque-table-container">
            <table className="estoque-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Filme</th>
                        <th>Medidas</th>
                        <th>Restante</th>
                        <th>Status</th>
                        <th>Acoes</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredBobinas.map((bobina) => (
                        <tr key={bobina.id}>
                            <td>#{bobina.id}</td>
                            <td>
                                <div className="table-film-info">
                                    <span className="film-id">{bobina.filmId}</span>
                                    {bobina.localizacao && <span className="film-loc">{'\u{1F4CD}'} {bobina.localizacao}</span>}
                                </div>
                            </td>
                            <td>{bobina.larguraCm}cm x {bobina.comprimentoTotalM}m</td>
                            <td>
                                <div className="table-progress">
                                    <div className="table-progress-bar">
                                        <div
                                            className="table-progress-fill"
                                            style={{
                                                width: `${(bobina.comprimentoRestanteM / bobina.comprimentoTotalM) * 100}%`,
                                                backgroundColor: getStatusColor(bobina.status),
                                            }}
                                        />
                                    </div>
                                    <span>{bobina.comprimentoRestanteM.toFixed(1)}m</span>
                                </div>
                            </td>
                            <td>
                                <span
                                    className="status-badge small"
                                    style={{ backgroundColor: getStatusColor(bobina.status) }}
                                >
                                    {getStatusLabel(bobina.status)}
                                </span>
                            </td>
                            <td>
                                <div className="table-actions">
                                    <button onClick={() => onShowQR('bobina', bobina)} title="QR Code">
                                        <QrCodeIcon />
                                    </button>
                                    <button onClick={() => onChangeStatus('bobina', bobina)} title="Status">
                                        {'\u2699\uFE0F'}
                                    </button>
                                    <button onClick={() => onDelete('bobina', bobina.id!)} title="Excluir" className="text-red-500">
                                        <TrashIcon />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
