
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { matchesSearch } from '../../src/lib/textSearch';
import { useIsMobile } from '../../src/hooks/useIsMobile';

interface SearchableSelectProps<T> {
    options: T[];
    value: T[keyof T] | null;
    onChange: (value: T[keyof T] | null) => void;
    displayField: keyof T;
    valueField: keyof T;
    placeholder: string;
    loadingPlaceholder?: string;
    disabled?: boolean;
    loading?: boolean;
    onFocus?: () => void;
    autoFocus?: boolean;
    renderNoResults?: (searchTerm: string) => React.ReactNode;
    /** Ação exibida após os resultados quando há uma busca (ex.: cadastrar outro cliente). */
    renderSearchAction?: (searchTerm: string, resultCount: number) => React.ReactNode;
    onMagicClick?: (searchTerm: string) => void;
    /** Conteúdo customizado de cada item (ex.: avatar + nome + telefone). */
    renderOption?: (option: T, isSelected: boolean) => React.ReactNode;
    /** Campos extras para a busca casar (padrão: só o displayField). */
    searchFields?: (keyof T)[];
    /** Rótulo fixo no topo da lista (ex.: "Favoritos e recentes"). */
    listHeader?: React.ReactNode;
}

const SearchableSelect = <T extends { [key: string]: any }>({
    options,
    value,
    onChange,
    displayField,
    valueField,
    placeholder,
    loadingPlaceholder,
    disabled = false,
    loading = false,
    onFocus,
    autoFocus = false,
    renderNoResults,
    renderSearchAction,
    onMagicClick,
    renderOption,
    searchFields,
    listHeader,
}: SearchableSelectProps<T>) => {
    const isMobile = useIsMobile();
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const sheetInputRef = useRef<HTMLInputElement>(null);
    // Área visível (acima do teclado) para o seletor mobile — via visualViewport.
    const [sheetViewport, setSheetViewport] = useState<{ top: number; height: number } | null>(null);

    const selectedOption = useMemo(() =>
        options.find(opt => opt[valueField] === value),
        [options, value, valueField]);

    // Texto exibido quando fechado / valor muda (somente no fluxo inline do desktop).
    useEffect(() => {
        if (!isOpen) {
            const displayValue = selectedOption ? String(selectedOption[displayField]) : '';
            setSearchTerm(displayValue);
            setDebouncedSearchTerm(displayValue);
        }
    }, [isOpen, selectedOption, displayField]);

    // Debounce da digitação.
    useEffect(() => {
        const timerId = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
        return () => clearTimeout(timerId);
    }, [searchTerm]);

    // Fechar ao clicar fora — só no dropdown inline (desktop). No mobile o
    // overlay tem o próprio fechamento (tocar fora / botão), então não atrapalha.
    useEffect(() => {
        if (isMobile) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMobile]);

    // Autofocus do input inline (desktop). No mobile não há input no mount, então
    // não abre nada sozinho — o seletor só abre quando o usuário toca no campo.
    useEffect(() => {
        if (!isMobile && autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus, isMobile]);

    // Foca a busca quando o bottom-sheet abre (após a animação de subida).
    useEffect(() => {
        if (isMobile && isOpen) {
            const t = setTimeout(() => sheetInputRef.current?.focus(), 60);
            return () => clearTimeout(t);
        }
    }, [isMobile, isOpen]);

    // Acompanha o teclado: o seletor mobile ocupa só a área visível (visualViewport),
    // mantendo a busca fixa no topo e a lista rolando acima do teclado.
    useEffect(() => {
        if (!isMobile || !isOpen) {
            setSheetViewport(null);
            return;
        }
        const vv = window.visualViewport;
        if (!vv) return;
        const update = () => setSheetViewport({ top: vv.offsetTop, height: vv.height });
        update();
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
        };
    }, [isMobile, isOpen]);

    const filteredOptions = useMemo(() => {
        if (!debouncedSearchTerm) return options;
        const fields = searchFields && searchFields.length ? searchFields : [displayField];
        return options.filter(option =>
            fields.some(field => matchesSearch(String(option[field] ?? ''), debouncedSearchTerm))
        );
    }, [options, debouncedSearchTerm, displayField, searchFields]);

    const handleSelect = (option: T) => {
        const displayValue = String(option[displayField]);
        onChange(option[valueField]);
        setSearchTerm(displayValue);
        setDebouncedSearchTerm(displayValue);
        setIsOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        if (!isOpen) setIsOpen(true);
    };

    // Foco NÃO abre a lista (evita cobrir o formulário no autoFocus ao abrir o
    // modal). A lista abre só por intenção do usuário: clicar no campo ou digitar.
    const handleInputFocus = () => {
        if (onFocus) onFocus();
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSearchTerm('');
        setDebouncedSearchTerm('');
        onChange(null);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const openSheet = () => {
        if (disabled || loading) return;
        setSearchTerm('');
        setDebouncedSearchTerm('');
        if (onFocus) onFocus();
        setIsOpen(true);
    };

    const currentPlaceholder = loading && loadingPlaceholder ? loadingPlaceholder : placeholder;

    // Itens da lista, reaproveitados no dropdown (desktop) e no sheet (mobile).
    const optionItems = (useClick: boolean): React.ReactNode => {
        if (loading) {
            return (
                <li className="flex items-center justify-center p-3 text-center text-slate-500">
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Carregando...
                </li>
            );
        }
        if (filteredOptions.length > 0) {
            return (
                <>
                    {listHeader && !debouncedSearchTerm && (
                        <li className="sticky top-0 z-10 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-900/80 dark:text-slate-500">
                            {listHeader}
                        </li>
                    )}
                    {filteredOptions.map(option => {
                        const isSelected = value === option[valueField];
                        const handlers = useClick
                            ? { onClick: () => handleSelect(option) }
                            : { onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); handleSelect(option); } };
                        return (
                            <li
                                key={String(option[valueField])}
                                {...handlers}
                                className={`cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-100 dark:border-slate-700/60 dark:hover:bg-slate-700 ${isSelected ? 'bg-blue-50 dark:bg-blue-950/30' : ''} ${renderOption ? '' : 'p-3 text-slate-700 dark:text-slate-300'}`}
                            >
                                {renderOption ? renderOption(option, isSelected) : String(option[displayField])}
                            </li>
                        );
                    })}
                    {debouncedSearchTerm && renderSearchAction?.(debouncedSearchTerm, filteredOptions.length)}
                </>
            );
        }
        return debouncedSearchTerm && renderNoResults
            ? renderNoResults(debouncedSearchTerm)
            : <li className="p-3 text-slate-500 dark:text-slate-400">Nenhum resultado encontrado</li>;
    };

    // ----- Mobile: campo que abre um seletor em tela cheia (bottom-sheet) -----
    if (isMobile) {
        return (
            <div className="relative flex-grow" ref={containerRef}>
                <button
                    type="button"
                    disabled={disabled || loading}
                    onClick={openSheet}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white p-3 text-left text-base text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-800"
                >
                    <span className={`truncate ${selectedOption ? '' : 'text-slate-400 dark:text-slate-500'}`}>
                        {selectedOption ? String(selectedOption[displayField]) : currentPlaceholder}
                    </span>
                    <span className="flex items-center gap-3 text-slate-400">
                        {selectedOption && !disabled && !loading && (
                            <span
                                role="button"
                                aria-label="Limpar seleção"
                                onClick={(e) => { e.stopPropagation(); onChange(null); }}
                                className="px-1 text-slate-400 hover:text-slate-600"
                            >
                                <i className="fas fa-times text-sm"></i>
                            </span>
                        )}
                        {loading
                            ? <i className="fas fa-spinner fa-spin"></i>
                            : <i className="fas fa-chevron-down text-xs pointer-events-none"></i>}
                    </span>
                </button>

                {isOpen && (
                    <div
                        className="animate-fade-in fixed left-0 right-0 z-[10050] flex flex-col bg-white shadow-2xl dark:bg-slate-900"
                        style={sheetViewport
                            ? { top: sheetViewport.top, height: sheetViewport.height }
                            : { top: 0, height: '100dvh' }}
                    >
                        {/* Cabeçalho fixo: busca + fechar (nunca sai da tela com o teclado) */}
                        <div className="flex flex-shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700/60">
                            <div className="relative flex-1">
                                <i className="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400"></i>
                                <input
                                    ref={sheetInputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={handleInputChange}
                                    placeholder={placeholder}
                                    autoComplete="off"
                                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-base text-slate-900 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                aria-label="Fechar"
                                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                                <i className="fas fa-times text-lg"></i>
                            </button>
                        </div>
                        <ul className="flex-1 overflow-y-auto overscroll-contain">
                            {optionItems(true)}
                        </ul>
                    </div>
                )}
            </div>
        );
    }

    // ----- Desktop: dropdown inline (comportamento original) -----
    return (
        <div className="relative flex-grow" ref={containerRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    onClick={() => { if (!isOpen) setIsOpen(true); }}
                    placeholder={currentPlaceholder}
                    className="w-full p-3 pr-12 text-base bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-1 focus:ring-slate-500 focus:border-slate-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                    disabled={disabled || loading}
                    autoComplete="off"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-2">
                    {searchTerm && !disabled && !loading && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-slate-400 hover:text-slate-600 focus:outline-none"
                            aria-label="Limpar seleção"
                        >
                            <i className="fas fa-times text-sm"></i>
                        </button>
                    )}
                    {searchTerm && onMagicClick && !disabled && !loading && (
                        <button
                            type="button"
                            onClick={() => onMagicClick(searchTerm)}
                            className="text-slate-400 hover:text-slate-600 focus:outline-none"
                            aria-label="Sugestão com IA"
                        >
                            <i className="fas fa-wand-magic-sparkles text-sm"></i>
                        </button>
                    )}
                    {loading ? (
                        <i className="fas fa-spinner fa-spin text-slate-400"></i>
                    ) : !searchTerm ? (
                        <button
                            type="button"
                            onClick={() => setIsOpen(o => !o)}
                            aria-label={isOpen ? 'Fechar lista' : 'Abrir lista'}
                            className="text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                            <i className={`fas fa-chevron-down text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}></i>
                        </button>
                    ) : null}
                </div>
            </div>
            {isOpen && (
                <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
                    {optionItems(false)}
                </ul>
            )}
        </div>
    );
};

export default SearchableSelect;
