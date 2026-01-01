import React, { useState, useEffect, useCallback } from 'react';
import { Location } from '../../types';
import { locationService } from '../../services/locationService';
import { useAuth } from '../../contexts/AuthContext';
import { useError } from '../../src/contexts/ErrorContext';
import { CardSkeleton } from '../ui/Skeleton';
import LocationForm from './LocationForm';
import LocationMeasurements from './LocationMeasurements';

const LocationManager: React.FC = () => {
    const { user } = useAuth();
    const { showError } = useError();
    const [locations, setLocations] = useState<Location[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'form' | 'measurements'>('list');
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

    const loadLocations = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const data = await locationService.searchLocations(user.id, searchQuery);
            setLocations(data);
        } catch (error) {
            console.error('Erro ao carregar locais:', error);
            showError('Falha ao carregar locais.');
        } finally {
            setIsLoading(false);
        }
    }, [user, searchQuery, showError]);

    useEffect(() => {
        loadLocations();
    }, [loadLocations]);

    const handleCreateLocation = () => {
        setSelectedLocation(null);
        setViewMode('form');
    };

    const handleEditLocation = (location: Location) => {
        setSelectedLocation(location);
        setViewMode('form');
    };

    const handleManageMeasurements = (location: Location) => {
        setSelectedLocation(location);
        setViewMode('measurements');
    };

    const handleSaveLocation = async (locationData: Partial<Location>) => {
        if (!user) return;
        try {
            if (selectedLocation && selectedLocation.id) {
                await locationService.updateLocation(selectedLocation.id, locationData);
            } else {
                await locationService.createLocation({ ...locationData, user_id: user.id } as any);
            }
            setViewMode('list');
            loadLocations();
        } catch (error) {
            console.error('Erro ao salvar local:', error);
            showError('Falha ao salvar local.');
        }
    };

    const handleDeleteLocation = async (id: number) => {
        if (!window.confirm('Tem certeza que deseja excluir este local? Todas as medidas serão perdidas.')) return;
        try {
            await locationService.deleteLocation(id);
            loadLocations();
        } catch (error) {
            console.error('Erro ao excluir local:', error);
            showError('Falha ao excluir local.');
        }
    };

    const renderIcon = (type: string) => {
        switch (type) {
            case 'condominium': return <i className="fas fa-building text-lg"></i>;
            case 'company': return <i className="fas fa-map-marker-alt text-lg"></i>;
            default: return <i className="fas fa-home text-lg"></i>;
        }
    };

    if (viewMode === 'form') {
        return (
            <LocationForm
                initialData={selectedLocation}
                onSave={handleSaveLocation}
                onCancel={() => setViewMode('list')}
            />
        );
    }

    if (viewMode === 'measurements' && selectedLocation) {
        return (
            <LocationMeasurements
                location={selectedLocation}
                onBack={() => setViewMode('list')}
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                    <input
                        type="text"
                        placeholder="Buscar locais..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <button
                    onClick={handleCreateLocation}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <i className="fas fa-plus"></i>
                    <span className="hidden sm:inline">Novo Local</span>
                </button>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
            ) : locations.length === 0 ? (
                <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                    Nenhum local encontrado.
                </div>
            ) : (
                <div className="grid gap-4">
                    {locations.map((location) => (
                        <div
                            key={location.id}
                            className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => handleManageMeasurements(location)}>
                                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 w-10 h-10 flex items-center justify-center">
                                    {renderIcon(location.type)}
                                </div>
                                <div>
                                    <h3 className="font-medium text-gray-900 dark:text-white">{location.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {[location.logradouro, location.numero, location.bairro].filter(Boolean).join(', ')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleManageMeasurements(location)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full"
                                    title="Ver Medidas"
                                >
                                    <i className="fas fa-chevron-right"></i>
                                </button>
                                <button
                                    onClick={() => handleEditLocation(location)}
                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                                    title="Editar"
                                >
                                    <i className="fas fa-edit"></i>
                                </button>
                                <button
                                    onClick={() => handleDeleteLocation(location.id!)}
                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                                    title="Excluir"
                                >
                                    <i className="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LocationManager;
