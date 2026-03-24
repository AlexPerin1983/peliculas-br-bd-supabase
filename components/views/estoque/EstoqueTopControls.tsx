import React from 'react';
import { StatusFilterDropdown } from '../../ui/StatusFilterDropdown';
import { PackageIcon, PlusIcon, QrCodeIcon, ScissorsIcon, SearchIcon } from './EstoqueIcons';

interface EstoqueTopControlsProps {
    activeTab: 'bobinas' | 'retalhos';
    bobinasCount: number;
    retalhosCount: number;
    onChangeTab: (tab: 'bobinas' | 'retalhos') => void;
    onAdd: () => void;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    statusFilter: string;
    onStatusFilterChange: (value: string) => void;
    viewMode: 'grid' | 'list';
    onViewModeChange: (mode: 'grid' | 'list') => void;
    onScan: () => void;
}

const EstoqueTopControls: React.FC<EstoqueTopControlsProps> = ({
    activeTab,
    bobinasCount,
    retalhosCount,
    onChangeTab,
    onAdd,
    searchTerm,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    viewMode,
    onViewModeChange,
    onScan,
}) => {
    return (
        <>
            <div className="estoque-header">
                <div className="segmented-tabs">
                    <button
                        className={`segment ${activeTab === 'bobinas' ? 'active' : ''}`}
                        onClick={() => onChangeTab('bobinas')}
                    >
                        <PackageIcon />
                        <span>Bobinas</span>
                        <span className="segment-count">{bobinasCount}</span>
                    </button>
                    <button
                        className={`segment ${activeTab === 'retalhos' ? 'active' : ''}`}
                        onClick={() => onChangeTab('retalhos')}
                    >
                        <ScissorsIcon />
                        <span>Retalhos</span>
                        <span className="segment-count">{retalhosCount}</span>
                    </button>
                </div>
                <button className="btn-add-primary" onClick={onAdd}>
                    <PlusIcon />
                    <span className="btn-text">Nova {activeTab === 'bobinas' ? 'Bobina' : 'Retalho'}</span>
                </button>
            </div>

            <div className="management-toolbar">
                <div className="search-container">
                    <SearchIcon />
                    <input
                        type="text"
                        placeholder={`Buscar ${activeTab === 'bobinas' ? 'bobina' : 'retalho'} por ID, filme ou localizacao...`}
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>

                <div className="filters-container">
                    <StatusFilterDropdown
                        value={statusFilter}
                        onChange={onStatusFilterChange}
                        options={
                            activeTab === 'bobinas'
                                ? [
                                    { value: 'todos', label: 'Status', emoji: '📦' },
                                    { value: 'ativa', label: 'Ativa', emoji: '🟢' },
                                    { value: 'finalizada', label: 'Finalizada', emoji: '🔵' },
                                    { value: 'descartada', label: 'Descartada', emoji: '🔴' },
                                ]
                                : [
                                    { value: 'todos', label: 'Status', emoji: '✂️' },
                                    { value: 'disponivel', label: 'Disponivel', emoji: '🟢' },
                                    { value: 'reservado', label: 'Reservado', emoji: '🟡' },
                                    { value: 'usado', label: 'Usado', emoji: '🟠' },
                                    { value: 'descartado', label: 'Descartado', emoji: '🔴' },
                                ]
                        }
                    />

                    <div className="view-toggle">
                        <button
                            className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                            onClick={() => onViewModeChange('grid')}
                            title="Visualizacao em grade"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => onViewModeChange('list')}
                            title="Visualizacao em lista"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
            </div>

            <button className="fab-scan" onClick={onScan} title="Escanear QR Code">
                <QrCodeIcon />
            </button>
        </>
    );
};

export default EstoqueTopControls;
