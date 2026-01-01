import type { Location, LocationMeasurement } from '../types';
import { supabase } from './supabaseClient';

export interface LocationWithMeasurements extends Location {
    measurements?: LocationMeasurement[];
}

export const locationService = {
    // =====================================================
    // FUNÇÕES AUXILIARES DE NORMALIZAÇÃO E SIMILARIDADE
    // =====================================================

    // Remove acentos, converte para minúsculo, remove espaços extras
    normalizeText(text: string): string {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
            .replace(/\s+/g, ' ') // Normaliza espaços
            .trim();
    },

    // Calcula similaridade entre duas strings (algoritmo de distância de Levenshtein)
    calculateSimilarity(str1: string, str2: string): number {
        const s1 = this.normalizeText(str1);
        const s2 = this.normalizeText(str2);

        if (s1 === s2) return 1;
        if (s1.length === 0 || s2.length === 0) return 0;

        // Se um contém o outro, alta similaridade
        if (s1.includes(s2) || s2.includes(s1)) {
            const longerLen = Math.max(s1.length, s2.length);
            const shorterLen = Math.min(s1.length, s2.length);
            return shorterLen / longerLen;
        }

        // Distância de Levenshtein
        const matrix: number[][] = [];
        for (let i = 0; i <= s1.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= s2.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= s1.length; i++) {
            for (let j = 1; j <= s2.length; j++) {
                if (s1[i - 1] === s2[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        const distance = matrix[s1.length][s2.length];
        const maxLen = Math.max(s1.length, s2.length);
        return 1 - distance / maxLen;
    },

    // =====================================================
    // LOCATIONS - User's own locations
    // =====================================================

    async getLocations(userId: string): Promise<Location[]> {
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .eq('user_id', userId)
            .order('name');

        if (error) throw error;
        return data || [];
    },

    async searchLocations(userId: string, query: string): Promise<Location[]> {
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .eq('user_id', userId)
            .ilike('name', `%${query}%`)
            .order('name');

        if (error) throw error;
        return data || [];
    },

    async getLocationById(id: number): Promise<Location | null> {
        const { data, error } = await supabase
            .from('locations')
            .select('*, measurements:location_measurements(*)')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    async createLocation(location: Omit<Location, 'id' | 'created_at'>): Promise<Location> {
        const { data, error } = await supabase
            .from('locations')
            .insert(location)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateLocation(id: number, updates: Partial<Location>): Promise<Location> {
        const { data, error } = await supabase
            .from('locations')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteLocation(id: number): Promise<void> {
        const { error } = await supabase
            .from('locations')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // =====================================================
    // VERIFICAÇÃO DE DUPLICIDADE
    // =====================================================

    // Verificar se já existe um local com o mesmo CEP E Nome similar
    // Considera duplicata se:
    // - Nome exatamente igual (após normalização)
    // - Nome com 85%+ de similaridade (detecta erros de digitação)
    async checkExistingByCepAndName(cep: string, name: string): Promise<(Location & { measurements_count?: number; similarity?: number }) | null> {
        if (!cep || cep.length < 5 || !name || name.length < 2) return null;

        const cleanCep = cep.replace(/\D/g, '');
        const normalizedInputName = this.normalizeText(name);

        const { data, error } = await supabase
            .from('locations')
            .select('*, location_measurements(count)')
            .eq('cep', cleanCep);

        if (error) {
            console.error('Erro ao verificar CEP:', error);
            return null;
        }

        // Verificar similaridade com cada local existente
        let bestMatch: { location: any; similarity: number } | null = null;

        for (const location of data || []) {
            const normalizedExistingName = this.normalizeText(location.name);

            // Verificação exata após normalização
            if (normalizedExistingName === normalizedInputName) {
                return {
                    ...location,
                    measurements_count: location.location_measurements?.[0]?.count || 0,
                    similarity: 1
                };
            }

            // Verificação por similaridade
            const similarity = this.calculateSimilarity(location.name, name);

            // Se 85%+ similar, considera potencial duplicata
            if (similarity >= 0.85) {
                if (!bestMatch || similarity > bestMatch.similarity) {
                    bestMatch = { location, similarity };
                }
            }
        }

        if (bestMatch) {
            return {
                ...bestMatch.location,
                measurements_count: bestMatch.location.location_measurements?.[0]?.count || 0,
                similarity: bestMatch.similarity
            };
        }

        return null;
    },

    // Buscar locais com o mesmo CEP (para mostrar sugestões)
    async getLocationsByCep(cep: string): Promise<(Location & { measurements_count?: number })[]> {
        if (!cep || cep.length < 5) return [];

        const cleanCep = cep.replace(/\D/g, '');

        const { data, error } = await supabase
            .from('locations')
            .select('*, location_measurements(count)')
            .eq('cep', cleanCep)
            .order('name');

        if (error) {
            console.error('Erro ao buscar locais por CEP:', error);
            return [];
        }

        return (data || []).map(location => ({
            ...location,
            measurements_count: location.location_measurements?.[0]?.count || 0
        }));
    },

    // =====================================================
    // GLOBAL SEARCH - All locations (read-only)
    // Busca por nome OU por CEP
    // =====================================================

    async searchLocationsGlobal(query: string, limit: number = 20): Promise<(Location & { measurements_count?: number })[]> {
        if (!query || query.length < 2) return [];

        // Verificar se a busca parece ser um CEP (apenas números, 5-8 dígitos)
        const cleanQuery = query.replace(/\D/g, '');
        const isCepSearch = cleanQuery.length >= 5 && cleanQuery.length <= 8;

        let queryBuilder = supabase
            .from('locations')
            .select('*, location_measurements(count)');

        if (isCepSearch) {
            // Busca por CEP (parcial ou completo)
            queryBuilder = queryBuilder.ilike('cep', `${cleanQuery}%`);
        } else {
            // Busca por nome
            queryBuilder = queryBuilder.ilike('name', `%${query}%`);
        }

        const { data, error } = await queryBuilder
            .order('name')
            .limit(limit);

        if (error) throw error;

        // Mapear para incluir a contagem de medidas
        return (data || []).map(location => ({
            ...location,
            measurements_count: location.location_measurements?.[0]?.count || 0
        }));
    },

    async getLocationWithMeasurementsGlobal(id: number): Promise<LocationWithMeasurements | null> {
        const { data, error } = await supabase
            .from('locations')
            .select('*, measurements:location_measurements(*)')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    // =====================================================
    // MEASUREMENTS
    // =====================================================

    async getMeasurements(locationId: number): Promise<LocationMeasurement[]> {
        const { data, error } = await supabase
            .from('location_measurements')
            .select('*')
            .eq('location_id', locationId)
            .order('created_at');

        if (error) throw error;
        return data || [];
    },

    async addMeasurement(measurement: Omit<LocationMeasurement, 'id' | 'created_at'>): Promise<LocationMeasurement> {
        const { data, error } = await supabase
            .from('location_measurements')
            .insert(measurement)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateMeasurement(id: number, updates: Partial<LocationMeasurement>): Promise<LocationMeasurement> {
        const { data, error } = await supabase
            .from('location_measurements')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteMeasurement(id: number): Promise<void> {
        const { error } = await supabase
            .from('location_measurements')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
