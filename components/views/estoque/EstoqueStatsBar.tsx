import React from 'react';
import { EstoqueStats } from '../../../services/estoqueDb';
import { PackageIcon, ScissorsIcon } from './EstoqueIcons';

interface EstoqueStatsBarProps {
    stats: EstoqueStats;
}

const EstoqueStatsBar: React.FC<EstoqueStatsBarProps> = ({ stats }) => {
    return (
        <div className="stats-bar">
            <div className="stat-pill">
                <div className="stat-pill-icon">
                    <PackageIcon />
                </div>
                <div className="stat-pill-content">
                    <span className="stat-pill-value">{stats.totalBobinasAtivas}</span>
                    <span className="stat-pill-label">Bobinas</span>
                </div>
            </div>
            <div className="stat-pill">
                <div className="stat-pill-icon primary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                </div>
                <div className="stat-pill-content">
                    <span className="stat-pill-value">{stats.totalMetrosDisponiveis.toFixed(1)}m</span>
                    <span className="stat-pill-label">Estoque</span>
                </div>
            </div>
            <div className="stat-pill">
                <div className="stat-pill-icon success">
                    <ScissorsIcon />
                </div>
                <div className="stat-pill-content">
                    <span className="stat-pill-value">{stats.totalRetalhoDisponivel}</span>
                    <span className="stat-pill-label">Retalhos</span>
                </div>
            </div>
            <div className="stat-pill">
                <div className="stat-pill-icon warning">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20V10" />
                        <path d="M18 20V4" />
                        <path d="M6 20v-4" />
                    </svg>
                </div>
                <div className="stat-pill-content">
                    <span className="stat-pill-value">{stats.consumoUltimos30Dias.toFixed(1)}m</span>
                    <span className="stat-pill-label">30 dias</span>
                </div>
            </div>
        </div>
    );
};

export default EstoqueStatsBar;
