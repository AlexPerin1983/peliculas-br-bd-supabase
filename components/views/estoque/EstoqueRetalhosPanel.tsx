import React from 'react';
import { Retalho } from '../../../types';
import { QrCodeIcon, ScissorsIcon, TrashIcon } from './EstoqueIcons';

type EstoqueRetalhosPanelProps = {
    viewMode: 'grid' | 'list';
    filteredRetalhos: Retalho[];
    onShowQR: (type: 'retalho', item: Retalho) => void;
    onChangeStatus: (type: 'retalho', item: Retalho) => void;
    onDelete: (type: 'retalho', id: number) => void;
    getStatusLabel: (status: string) => string;
    getStatusColor: (status: string) => string;
};

export default function EstoqueRetalhosPanel({
    viewMode,
    filteredRetalhos,
    onShowQR,
    onChangeStatus,
    onDelete,
    getStatusLabel,
    getStatusColor,
}: EstoqueRetalhosPanelProps) {
    if (viewMode === 'grid') {
        return (
            <div className="estoque-list">
                {filteredRetalhos.length === 0 ? (
                    <div className="empty-state">
                        <ScissorsIcon />
                        <p className="empty-state-title">Nenhum retalho encontrado</p>
                        <p className="empty-hint">Ajuste os filtros ou cadastre um novo retalho.</p>
                    </div>
                ) : (
                    filteredRetalhos.map((retalho) => (
                        <div key={retalho.id} className="estoque-card">
                            <div className="card-header-row">
                                <h3 className="card-title">{retalho.filmId}</h3>
                                <div className="card-header-right">
                                    <span
                                        className="status-pill"
                                        style={{ backgroundColor: getStatusColor(retalho.status) }}
                                    >
                                        {getStatusLabel(retalho.status)}
                                    </span>
                                    <button
                                        className="qr-icon-btn"
                                        onClick={() => onShowQR('retalho', retalho)}
                                        title="QR Code"
                                    >
                                        <QrCodeIcon />
                                    </button>
                                </div>
                            </div>

                            {retalho.localizacao && (
                                <div className="card-location-row">
                                    {'\u{1F4CD}'} {retalho.localizacao}
                                </div>
                            )}

                            <div className="card-body">
                                <div className="main-metric">
                                    <div className="metric-value-group">
                                        <span className="metric-value">
                                            {retalho.areaM2?.toFixed(2) || ((retalho.larguraCm * retalho.comprimentoCm) / 10000).toFixed(2)}
                                        </span>
                                        <span className="metric-unit">m²</span>
                                    </div>
                                    <span className="metric-label">area total do retalho</span>
                                </div>

                                <div className="info-chips">
                                    <div className="info-chip">
                                        <span className="chip-value">{retalho.larguraCm}</span>
                                        <span className="chip-label">cm largura</span>
                                    </div>
                                    <div className="info-chip">
                                        <span className="chip-value">{retalho.comprimentoCm}</span>
                                        <span className="chip-label">cm comprimento</span>
                                    </div>
                                </div>
                            </div>

                            <div className="card-footer">
                                <button
                                    className="primary-action-btn"
                                    onClick={() => onChangeStatus('retalho', retalho)}
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
                        <th>Area</th>
                        <th>Status</th>
                        <th>Acoes</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredRetalhos.map((retalho) => (
                        <tr key={retalho.id}>
                            <td>#{retalho.id}</td>
                            <td>
                                <div className="table-film-info">
                                    <span className="film-id">{retalho.filmId}</span>
                                    {retalho.localizacao && <span className="film-loc">{'\u{1F4CD}'} {retalho.localizacao}</span>}
                                </div>
                            </td>
                            <td>{retalho.larguraCm}cm x {retalho.comprimentoCm}cm</td>
                            <td>{retalho.areaM2?.toFixed(2) || ((retalho.larguraCm * retalho.comprimentoCm) / 10000).toFixed(2)} m²</td>
                            <td>
                                <span
                                    className="status-badge small"
                                    style={{ backgroundColor: getStatusColor(retalho.status) }}
                                >
                                    {getStatusLabel(retalho.status)}
                                </span>
                            </td>
                            <td>
                                <div className="table-actions">
                                    <button onClick={() => onShowQR('retalho', retalho)} title="QR Code">
                                        <QrCodeIcon />
                                    </button>
                                    <button onClick={() => onChangeStatus('retalho', retalho)} title="Status">
                                        {'\u2699\uFE0F'}
                                    </button>
                                    <button onClick={() => onDelete('retalho', retalho.id!)} title="Excluir" className="text-red-500">
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
