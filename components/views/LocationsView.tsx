import React from 'react';
import LocationManager from '../locations/LocationManager';

const LocationsView: React.FC = () => {
    return (
        <div className="p-4 pb-24 md:pb-4 max-w-4xl mx-auto w-full">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Locais e Medidas Padrão</h1>
            <LocationManager />
        </div>
    );
};

export default LocationsView;
