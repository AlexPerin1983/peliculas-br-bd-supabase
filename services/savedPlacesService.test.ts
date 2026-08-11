import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildAndroidMapUrl,
    buildAndroidNavigationUrl,
    buildDirectionsUrl,
    deleteSavedPlace,
    getSavedPlaces,
    savePlace,
    SAVED_PLACES_STORAGE_KEY
} from './savedPlacesService';

describe('savedPlacesService', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it('salva, atualiza e exclui um local somente no localStorage', () => {
        const created = savePlace({
            name: '  Almoço de sexta  ',
            category: 'almoco',
            address: 'Rua das Flores, 123',
            notes: 'Prato feito',
            latitude: null,
            longitude: null
        });

        expect(getSavedPlaces()).toEqual([
            expect.objectContaining({
                id: created.id,
                name: 'Almoço de sexta',
                address: 'Rua das Flores, 123'
            })
        ]);
        expect(window.localStorage.getItem(SAVED_PLACES_STORAGE_KEY)).toContain('Almoço de sexta');

        savePlace({ ...created, name: 'Almoço rápido' }, created.id);
        expect(getSavedPlaces()).toHaveLength(1);
        expect(getSavedPlaces()[0].name).toBe('Almoço rápido');

        deleteSavedPlace(created.id);
        expect(getSavedPlaces()).toEqual([]);
    });

    it('monta a rota com coordenadas quando a posição GPS existe', () => {
        const place = savePlace({
            name: 'Sem placa',
            category: 'outro',
            address: 'Perto da praça',
            notes: '',
            latitude: -3.731862,
            longitude: -38.526669
        });

        expect(buildDirectionsUrl(place)).toBe(
            'https://www.google.com/maps/dir/?api=1&destination=-3.731862%2C-38.526669&travelmode=driving'
        );
        expect(buildAndroidNavigationUrl(place)).toBe(
            'google.navigation:q=-3.731862%2C-38.526669&mode=d'
        );
        expect(buildAndroidMapUrl(place)).toBe(
            'geo:0,0?q=-3.731862%2C-38.526669(Sem%20placa)'
        );
    });

    it('ignora conteúdo local inválido sem quebrar a tela', () => {
        window.localStorage.setItem(SAVED_PLACES_STORAGE_KEY, '{conteudo-invalido');
        expect(getSavedPlaces()).toEqual([]);
    });
});
