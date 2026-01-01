import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Drawer } from 'vaul';
import { Location, LocationMeasurement, UIMeasurement } from '../../types';
import { locationService } from '../../services/locationService';

interface LocationImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportMeasurements: (measurements: UIMeasurement[]) => void;
    currentFilm?: string;
}

const LocationImportModal: React.FC<LocationImportModalProps> = ({
    isOpen,
    onClose,
    onImportMeasurements,
    currentFilm = ''
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [measurements, setMeasurements] = useState<LocationMeasurement[]>([]);
    const [selectedMeasurements, setSelectedMeasurements] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMeasurements, setIsLoadingMeasurements] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Debounced search
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (searchQuery.length < 2) {
            setLocations([]);
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            setIsLoading(true);
            try {
                const results = await locationService.searchLocationsGlobal(searchQuery, 20);
                setLocations(results);
            } catch (error) {
                console.error('Erro ao buscar locais:', error);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery]);

    // Load measurements when location is selected
    const handleSelectLocation = async (location: Location) => {
        setSelectedLocation(location);
        setIsLoadingMeasurements(true);
        try {
            if (location.id) {
                const data = await locationService.getMeasurements(location.id);
                setMeasurements(data);
            }
        } catch (error) {
            console.error('Erro ao carregar medidas:', error);
        } finally {
            setIsLoadingMeasurements(false);
        }
    };

    const handleGoBack = () => {
        setSelectedLocation(null);
        setMeasurements([]);
        setSelectedMeasurements(new Set());
    };

    const handleToggleMeasurement = (id: number) => {
        setSelectedMeasurements(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedMeasurements.size === measurements.length) {
            setSelectedMeasurements(new Set());
        } else {
            setSelectedMeasurements(new Set(measurements.map(m => m.id!)));
        }
    };

    const handleImport = () => {
        const selectedItems = measurements.filter(m => selectedMeasurements.has(m.id!));

        const newMeasurements: UIMeasurement[] = selectedItems.map((m, index) => ({
            id: Date.now() + index,
            largura: m.largura,
            altura: m.altura,
            quantidade: m.quantidade,
            pelicula: currentFilm,
            ambiente: m.name || m.ambiente,
            tipoAplicacao: m.tipo_aplicacao || 'Desconhecido',
            active: true,
            isNew: false,
            locationId: selectedLocation?.id,
            locationName: selectedLocation?.name,
            // Store location reference in observation for display
            observation: `Importado de: ${selectedLocation?.name}`,
        }));

        onImportMeasurements(newMeasurements);
        onClose();

        // Reset state
        setSearchQuery('');
        setLocations([]);
        setSelectedLocation(null);
        setMeasurements([]);
        setSelectedMeasurements(new Set());
    };

    const formatLocationInfo = (location: Location & { measurements_count?: number }) => {
        const parts = [location.bairro, location.cidade, location.uf].filter(Boolean);
        return parts.join(', ') || 'Endereço não informado';
    };

    const formatFullAddress = (location: Location) => {
        let address = '';
        if (location.logradouro) {
            address = location.logradouro;
            if (location.numero) address += `, ${location.numero}`;
        }
        return address;
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'condominium': return 'fas fa-building';
            case 'company': return 'fas fa-briefcase';
            default: return 'fas fa-map-marker-alt';
        }
    };

    if (!isOpen) return null;

    return (
        <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]" />
                <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[9999] flex flex-col bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl max-h-[90vh] outline-none">
                    {/* Drag Handle */}
                    <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
                    </div>

                    {/* Header */}
                    <div className="px-4 pb-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            {selectedLocation ? (
                                <button
                                    onClick={handleGoBack}
                                    className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                                >
                                    <i className="fas fa-arrow-left"></i>
                                    <span>Voltar</span>
                                </button>
                            ) : (
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                                    <i className="fas fa-building mr-2"></i>
                                    Importar Medidas
                                </h3>
                            )}
                            <button
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        {selectedLocation && (
                            <div className="mt-2">
                                <h4 className="font-semibold text-slate-800 dark:text-white">{selectedLocation.name}</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{formatLocationInfo(selectedLocation)}</p>
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-grow overflow-y-auto p-4">
                        {!selectedLocation ? (
                            <>
                                {/* Search Input */}
                                <div className="mb-4">
                                    <div className="relative">
                                        <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"></i>
                                        <input
                                            type="text"
                                            placeholder="Digite o nome ou CEP do local..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">
                                        <i className="fas fa-lightbulb text-yellow-500"></i>
                                        <span>Dica: Buscar pelo <strong>CEP</strong> é mais preciso para encontrar o local correto!</span>
                                    </p>
                                </div>

                                {/* Results */}
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <i className="fas fa-spinner fa-spin text-2xl text-slate-400"></i>
                                    </div>
                                ) : locations.length > 0 ? (
                                    <>
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                            <i className="fas fa-exclamation-triangle"></i>
                                            <span>Verifique a cidade e empresa antes de importar - podem existir locais com nomes iguais!</span>
                                        </p>
                                        <div className="space-y-3">
                                            {locations.map((location: any) => (
                                                <button
                                                    key={location.id}
                                                    onClick={() => handleSelectLocation(location)}
                                                    className="w-full text-left p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 flex items-center justify-center flex-shrink-0">
                                                            <i className={`${getTypeIcon(location.type)} text-lg text-blue-600 dark:text-blue-400`}></i>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold text-slate-800 dark:text-white truncate">{location.name}</h4>
                                                                {location.measurements_count > 0 && (
                                                                    <span className="flex-shrink-0 px-2 py-0.5 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                                                        {location.measurements_count} medida{location.measurements_count !== 1 ? 's' : ''}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* CEP, Cidade e UF em destaque */}
                                                            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                                                <i className="fas fa-map-marker-alt mr-1"></i>
                                                                {location.cep && <span className="bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-xs mr-2">{location.cep}</span>}
                                                                {location.cidade || 'Cidade não informada'}{location.uf ? ` - ${location.uf}` : ''}
                                                            </p>

                                                            {/* Endereço completo */}
                                                            {(location.logradouro || location.bairro) && (
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                                    {formatFullAddress(location)}
                                                                    {location.bairro && ` • ${location.bairro}`}
                                                                </p>
                                                            )}

                                                            {/* Empresa que cadastrou */}
                                                            {location.created_by_company_name && (
                                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                                                                    <i className="fas fa-user-check text-green-500"></i>
                                                                    <span>Cadastrado por: <strong>{location.created_by_company_name}</strong></span>
                                                                </p>
                                                            )}
                                                        </div>
                                                        <i className="fas fa-chevron-right text-slate-400 mt-4"></i>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : searchQuery.length >= 2 ? (
                                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                                        <i className="fas fa-search text-4xl mb-3 opacity-50"></i>
                                        <p>Nenhum local encontrado</p>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                                        <i className="fas fa-building text-4xl mb-3 opacity-50"></i>
                                        <p>Digite pelo menos 2 caracteres</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Measurements */}
                                {isLoadingMeasurements ? (
                                    <div className="flex items-center justify-center py-8">
                                        <i className="fas fa-spinner fa-spin text-2xl text-slate-400"></i>
                                    </div>
                                ) : measurements.length > 0 ? (
                                    <>
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                                {selectedMeasurements.size} de {measurements.length} selecionadas
                                            </span>
                                            <button
                                                onClick={handleSelectAll}
                                                className="text-sm text-blue-600 dark:text-blue-400 font-medium"
                                            >
                                                {selectedMeasurements.size === measurements.length ? 'Desmarcar todas' : 'Selecionar todas'}
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {measurements.map((m) => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => handleToggleMeasurement(m.id!)}
                                                    className={`w-full text-left p-4 rounded-xl border transition-colors ${selectedMeasurements.has(m.id!)
                                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-500'
                                                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${selectedMeasurements.has(m.id!)
                                                            ? 'bg-blue-600 border-blue-600'
                                                            : 'border-slate-300 dark:border-slate-600'
                                                            }`}>
                                                            {selectedMeasurements.has(m.id!) && (
                                                                <i className="fas fa-check text-white text-xs"></i>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-semibold text-slate-800 dark:text-white">{m.name || m.ambiente}</h4>
                                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                                {m.largura} x {m.altura} m · Qtd: {m.quantidade}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                                        <i className="fas fa-ruler text-4xl mb-3 opacity-50"></i>
                                        <p>Nenhuma medida cadastrada neste local</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    {selectedLocation && measurements.length > 0 && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                            <button
                                onClick={handleImport}
                                disabled={selectedMeasurements.size === 0}
                                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
                            >
                                <i className="fas fa-download mr-2"></i>
                                Importar {selectedMeasurements.size} medida{selectedMeasurements.size !== 1 ? 's' : ''}
                            </button>
                        </div>
                    )}
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
};

export default LocationImportModal;
