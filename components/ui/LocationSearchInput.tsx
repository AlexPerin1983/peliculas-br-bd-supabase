import React, { useState, useEffect, useRef } from 'react';
import { Location } from '../../types';
import { locationService } from '../../services/locationService';
import { useAuth } from '../../contexts/AuthContext';

interface LocationSearchInputProps {
    value?: number;
    locationName?: string;
    onChange: (location: Location | null) => void;
    placeholder?: string;
    disabled?: boolean;
    companyName?: string;
    onFormStateChange?: (isOpen: boolean) => void;
    onShareChange?: (shouldShare: boolean) => void;
}

interface NewLocationFormData {
    name: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
    type: 'condominium' | 'company' | 'other';
    observacao: string; // Observações públicas para compartilhar com outros aplicadores
}

const LocationSearchInput: React.FC<LocationSearchInputProps> = ({
    value,
    locationName,
    onChange,
    placeholder = "Buscar condomínio ou empresa...",
    disabled = false,
    companyName,
    onFormStateChange,
    onShareChange
}) => {
    const { user } = useAuth();
    const [query, setQuery] = useState(locationName || '');
    const [results, setResults] = useState<Location[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [showNewLocationForm, setShowNewLocationForm] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [shareWithAll, setShareWithAll] = useState(true); // Compartilhar com todos por padrão
    const [formData, setFormData] = useState<NewLocationFormData>({
        name: '',
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        uf: '',
        type: 'condominium',
        observacao: ''
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setQuery(locationName || '');
    }, [locationName]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = async (searchQuery: string) => {
        setQuery(searchQuery);

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (searchQuery.length < 2) {
            setResults([]);
            setShowResults(false);
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const data = await locationService.searchLocationsGlobal(searchQuery, 10);
                setResults(data);
                setShowResults(true);
            } catch (error) {
                console.error('Erro ao buscar locais:', error);
            } finally {
                setIsSearching(false);
            }
        }, 300);
    };

    const handleSelect = (location: Location) => {
        setQuery(location.name);
        setShowResults(false);
        onChange(location);
    };

    const handleClear = () => {
        setQuery('');
        setResults([]);
        setShowResults(false);
        onChange(null);
    };

    const formatLocationInfo = (location: Location) => {
        const parts = [location.bairro, location.cidade, location.uf].filter(Boolean);
        return parts.join(', ') || 'Endereço não informado';
    };

    const handleOpenNewLocationForm = () => {
        setFormData({
            name: query,
            cep: '',
            logradouro: '',
            numero: '',
            complemento: '',
            bairro: '',
            cidade: '',
            uf: '',
            type: 'condominium',
            observacao: ''
        });
        setShowResults(false);
        setShowNewLocationForm(true);
        onFormStateChange?.(true);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Se mudou o CEP ou nome, limpa as verificações
        if (name === 'cep' || name === 'name') {
            setExistingLocations([]);
            setExactDuplicate(null);
        }
    };

    // Estado para armazenar locais existentes no mesmo CEP (sugestões)
    const [existingLocations, setExistingLocations] = useState<(Location & { measurements_count?: number })[]>([]);
    // Estado para indicar se há duplicata exata (mesmo nome + CEP)
    const [exactDuplicate, setExactDuplicate] = useState<(Location & { measurements_count?: number }) | null>(null);

    const handleCepBlur = async () => {
        if (formData.cep?.length >= 5) {
            try {
                // Buscar todos os locais com esse CEP (para sugestões)
                const locationsInCep = await locationService.getLocationsByCep(formData.cep);
                setExistingLocations(locationsInCep);

                // Verificar se há duplicata exata (mesmo nome + CEP)
                if (formData.name.trim()) {
                    const duplicate = await locationService.checkExistingByCepAndName(formData.cep, formData.name);
                    setExactDuplicate(duplicate);
                } else {
                    setExactDuplicate(null);
                }

                // Buscar endereço no ViaCEP se tiver 8 dígitos
                if (formData.cep.replace(/\D/g, '').length === 8) {
                    const cleanCep = formData.cep.replace(/\D/g, '');
                    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
                    const data = await response.json();
                    if (!data.erro) {
                        setFormData(prev => ({
                            ...prev,
                            cep: cleanCep,
                            logradouro: data.logradouro,
                            bairro: data.bairro,
                            cidade: data.localidade,
                            uf: data.uf
                        }));
                    }
                }
            } catch (error) {
                console.error('Erro ao buscar CEP:', error);
            }
        }
    };

    // Verificar duplicata quando muda o nome também
    const handleNameBlur = async () => {
        if (formData.name.trim() && formData.cep?.length >= 5) {
            const duplicate = await locationService.checkExistingByCepAndName(formData.cep, formData.name);
            setExactDuplicate(duplicate);
        } else {
            setExactDuplicate(null);
        }
    };

    const handleUseExistingLocation = (location: Location & { measurements_count?: number }) => {
        setQuery(location.name);
        setShowNewLocationForm(false);
        onFormStateChange?.(false);
        setExistingLocations([]);
        setExactDuplicate(null);
        onChange(location);
    };

    const handleSaveNewLocation = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validação de campos obrigatórios
        if (!formData.name.trim() || !formData.cep.trim() || !formData.bairro.trim() || !formData.cidade.trim() || !formData.uf.trim() || !user) {
            alert('Por favor, preencha todos os campos obrigatórios (Nome, CEP, Bairro, Cidade e UF).');
            return;
        }

        // BLOQUEAR apenas se existe local com MESMO CEP E MESMO NOME
        if (exactDuplicate) {
            alert('Já existe um local cadastrado com este nome e CEP. Use o botão "Usar este local" para vincular ao local existente.');
            return;
        }

        setIsSaving(true);
        try {
            // Verificar novamente antes de salvar
            if (formData.cep && formData.cep.length >= 5 && formData.name.trim()) {
                const duplicate = await locationService.checkExistingByCepAndName(formData.cep, formData.name);
                if (duplicate) {
                    setExactDuplicate(duplicate);
                    setIsSaving(false);
                    alert('Já existe um local cadastrado com este nome e CEP. Use o botão "Usar este local" para vincular ao local existente.');
                    return;
                }
            }

            const newLocation = await locationService.createLocation({
                ...formData,
                // Só inclui observação se estiver compartilhando
                observacao: shareWithAll ? formData.observacao : undefined,
                user_id: user.id,
                created_by_company_name: companyName
            });

            if (newLocation) {
                setQuery(newLocation.name);
                setShowNewLocationForm(false);
                onFormStateChange?.(false);
                setExistingLocations([]);
                setExactDuplicate(null);
                onChange(newLocation);
                // Propagar a opção de compartilhar
                if (shareWithAll && onShareChange) {
                    onShareChange(true);
                }
            }
        } catch (error) {
            console.error('Erro ao criar local:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelNewLocation = () => {
        setShowNewLocationForm(false);
        onFormStateChange?.(false);
        setFormData({
            name: '',
            cep: '',
            logradouro: '',
            numero: '',
            complemento: '',
            bairro: '',
            cidade: '',
            uf: '',
            type: 'condominium',
            observacao: ''
        });
    };

    const inputClasses = "w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500";

    // Formulário de novo local
    if (showNewLocationForm) {
        return (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <i className="fas fa-plus-circle text-blue-500"></i>
                        Cadastrar Novo Local
                    </h3>
                    <button
                        onClick={handleCancelNewLocation}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <form onSubmit={handleSaveNewLocation} className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nome do Local *</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleFormChange}
                            onBlur={handleNameBlur}
                            required
                            className={inputClasses}
                            placeholder="Ex: Condomínio Solar"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Tipo</label>
                            <select
                                name="type"
                                value={formData.type}
                                onChange={handleFormChange}
                                className={inputClasses}
                            >
                                <option value="condominium">Condomínio</option>
                                <option value="company">Empresa</option>
                                <option value="other">Outro</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">CEP *</label>
                            <input
                                type="text"
                                name="cep"
                                value={formData.cep}
                                onChange={handleFormChange}
                                onBlur={handleCepBlur}
                                maxLength={8}
                                className={inputClasses}
                                placeholder="00000000"
                            />
                        </div>
                    </div>

                    {/* Alerta de duplicata exata (mesmo nome + CEP) */}
                    {exactDuplicate && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                            <div className="flex items-start gap-3">
                                <i className="fas fa-ban text-red-600 dark:text-red-400 mt-0.5"></i>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                        Este local já está cadastrado!
                                    </p>
                                    <div className="mt-2 p-2 bg-white dark:bg-slate-800 rounded-lg">
                                        <p className="font-semibold text-slate-800 dark:text-white">{exactDuplicate.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {exactDuplicate.cidade}{exactDuplicate.uf ? ` - ${exactDuplicate.uf}` : ''}
                                        </p>
                                        {exactDuplicate.measurements_count && exactDuplicate.measurements_count > 0 && (
                                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                                <i className="fas fa-ruler mr-1"></i>
                                                {exactDuplicate.measurements_count} medida{exactDuplicate.measurements_count !== 1 ? 's' : ''}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleUseExistingLocation(exactDuplicate)}
                                        className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                                    >
                                        <i className="fas fa-check mr-2"></i>
                                        Usar este local
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sugestões de locais no mesmo CEP (não é erro, apenas informativo) */}
                    {existingLocations.length > 0 && !exactDuplicate && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg">
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                                <i className="fas fa-info-circle mr-1"></i>
                                Locais já cadastrados neste CEP:
                            </p>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                                {existingLocations.map(loc => (
                                    <button
                                        key={loc.id}
                                        type="button"
                                        onClick={() => handleUseExistingLocation(loc)}
                                        className="w-full text-left p-2 bg-white dark:bg-slate-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                    >
                                        <p className="font-semibold text-slate-800 dark:text-white text-sm">{loc.name}</p>
                                        {loc.measurements_count && loc.measurements_count > 0 && (
                                            <span className="text-xs text-green-600 dark:text-green-400">
                                                {loc.measurements_count} medida{loc.measurements_count !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                                Se o seu local é diferente, pode continuar cadastrando normalmente.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Logradouro</label>
                            <input
                                type="text"
                                name="logradouro"
                                value={formData.logradouro}
                                onChange={handleFormChange}
                                className={inputClasses}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Número</label>
                            <input
                                type="text"
                                name="numero"
                                value={formData.numero}
                                onChange={handleFormChange}
                                className={inputClasses}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Bairro *</label>
                            <input
                                type="text"
                                name="bairro"
                                value={formData.bairro}
                                onChange={handleFormChange}
                                className={inputClasses}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Cidade *</label>
                            <input
                                type="text"
                                name="cidade"
                                value={formData.cidade}
                                onChange={handleFormChange}
                                className={inputClasses}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">UF *</label>
                            <input
                                type="text"
                                name="uf"
                                value={formData.uf}
                                onChange={handleFormChange}
                                maxLength={2}
                                className={`${inputClasses} uppercase`}
                            />
                        </div>
                    </div>

                    {/* Checkbox compartilhar com todos */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="share-with-all"
                                checked={shareWithAll}
                                onChange={(e) => setShareWithAll(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                            <label htmlFor="share-with-all" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-2">
                                <i className="fas fa-globe text-blue-500"></i>
                                Compartilhar com todos os aplicadores
                            </label>
                        </div>

                        {/* Campo de observações públicas - aparece quando compartilhar está ativo */}
                        {shareWithAll && (
                            <div className="pl-6 animate-fade-in">
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                    Observações para outros aplicadores
                                </label>
                                <textarea
                                    name="observacao"
                                    value={formData.observacao}
                                    onChange={(e) => setFormData(prev => ({ ...prev, observacao: e.target.value }))}
                                    className={`${inputClasses} resize-none`}
                                    rows={3}
                                    placeholder="Ex: Esquadria de alumínio, precisa de escada, vidro com película antiga..."
                                />
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                    <i className="fas fa-info-circle mr-1"></i>
                                    Informações úteis: acabamento, acesso, estado do vidro, etc.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={handleCancelNewLocation}
                            className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                            disabled={isSaving}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                            disabled={isSaving || !formData.name.trim() || !formData.cep.trim() || !formData.bairro.trim() || !formData.cidade.trim() || !formData.uf.trim()}
                        >
                            {isSaving ? (
                                <>
                                    <i className="fas fa-spinner fa-spin"></i>
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-save"></i>
                                    Salvar
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className="relative" ref={containerRef}>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"></i>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        onFocus={() => query.length >= 2 && setShowResults(true)}
                        placeholder={placeholder}
                        disabled={disabled}
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {query && !disabled && (
                        <button
                            onClick={handleClear}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <i className="fas fa-times-circle"></i>
                        </button>
                    )}
                </div>
                <button
                    onClick={handleOpenNewLocationForm}
                    disabled={disabled}
                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Cadastrar novo local"
                >
                    <i className="fas fa-plus"></i>
                </button>
            </div>


            {showResults && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-72 overflow-y-auto">
                    {isSearching ? (
                        <div className="p-4 text-center text-slate-500">
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Buscando...
                        </div>
                    ) : results.length > 0 ? (
                        <div className="py-1">
                            {results.map((location) => (
                                <button
                                    key={location.id}
                                    onClick={() => handleSelect(location)}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b last:border-0 border-slate-100 dark:border-slate-700 transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        <i className="fas fa-building text-slate-400 mt-1"></i>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-slate-800 dark:text-white truncate">
                                                {location.name}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                {formatLocationInfo(location)}
                                            </div>
                                            {location.created_by_company_name && (
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    <i className="fas fa-user-check mr-1"></i>
                                                    {location.created_by_company_name}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {/* Botão para cadastrar novo local */}
                            <button
                                onClick={handleOpenNewLocationForm}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-t border-slate-200 dark:border-slate-700 transition-colors"
                            >
                                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                                    <i className="fas fa-plus-circle"></i>
                                    <span className="font-medium">Cadastrar "{query}" como novo local</span>
                                </div>
                            </button>
                        </div>
                    ) : query.length >= 2 ? (
                        <div className="py-1">
                            <div className="p-4 text-center text-slate-500 text-sm">
                                Nenhum local encontrado
                            </div>
                            {/* Botão para cadastrar novo local quando não há resultados */}
                            <button
                                onClick={handleOpenNewLocationForm}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-t border-slate-200 dark:border-slate-700 transition-colors"
                            >
                                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                                    <i className="fas fa-plus-circle"></i>
                                    <span className="font-medium">Cadastrar "{query}" como novo local</span>
                                </div>
                            </button>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default LocationSearchInput;
