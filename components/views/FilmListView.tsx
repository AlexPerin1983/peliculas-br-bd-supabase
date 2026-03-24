import React, { useState, useRef, useEffect } from 'react';
import { Film } from '../../types';
import ActionButton from '../ui/ActionButton';
import ContentState from '../ui/ContentState';
import PageCollectionToolbar from '../ui/PageCollectionToolbar';

interface FilmListViewProps {
    films: Film[];
    onAdd: () => void;
    onEdit: (film: Film) => void;
    onDelete: (filmName: string) => void;
    onOpenGallery: (images: string[], initialIndex: number) => void;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const FilmCard: React.FC<{
    film: Film;
    onEdit: (film: Film) => void;
    onDelete: (filmName: string) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    swipedItemName: string | null;
    onSetSwipedItem: (name: string | null) => void;
    onOpenGallery: (images: string[], initialIndex: number) => void;
    index: number;
}> = ({ film, onEdit, onDelete, isExpanded, onToggleExpand, swipedItemName, onSetSwipedItem, onOpenGallery, index }) => {
    const swipeableRef = useRef<HTMLDivElement>(null);

    const handleImageClick = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (film.imagens && film.imagens.length > 0) {
            onOpenGallery(film.imagens, index);
        }
    };

    const hasTechnicalData = film.uv || film.ir || film.vtl || film.espessura || film.tser;
    const hasImages = (film.imagens?.length || 0) > 0;

    const TechIndicator: React.FC<{ label: string; value: number | undefined; unit: string; color: string }> = ({ label, value, unit, color }) => {
        if (value === undefined || value === 0) return null;
        return (
            <div className="flex flex-col items-center gap-1">
                <div className="relative w-12 h-12 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            cx="24" cy="24" r="20"
                            stroke="currentColor"
                            strokeWidth="3"
                            fill="transparent"
                            className="text-slate-100 dark:text-slate-700/50"
                        />
                        <circle
                            cx="24" cy="24" r="20"
                            stroke="currentColor"
                            strokeWidth="3"
                            fill="transparent"
                            strokeDasharray={125.6}
                            strokeDashoffset={125.6 - (125.6 * (value > 100 ? 100 : value)) / 100}
                            strokeLinecap="round"
                            className={color}
                        />
                    </svg>
                    <span className="absolute text-[10px] font-bold dark:text-slate-200">{value}{unit}</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">{label}</span>
            </div>
        );
    };

    const accentColor =
        (film.ir ?? 0) >= 80  ? 'from-rose-500 to-orange-400' :
        (film.uv ?? 0) >= 90  ? 'from-amber-400 to-yellow-300' :
        (film.vtl ?? 0) <= 20 ? 'from-slate-600 to-slate-400' :
                                 'from-blue-500 to-cyan-400';

    return (
        <div
            className="group animate-stagger relative bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
            style={{ animationDelay: `${index * 0.1}s` }}
        >
            {/* Barra de acento no topo */}
            <div className={`h-1 w-full bg-gradient-to-r ${accentColor}`} />

            <div className="p-4">
                {/* Header: nome + preço */}
                <div className="flex justify-between items-start gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase truncate leading-tight">
                                {film.nome}
                            </h3>
                            {film.pinned && (
                                <i className="fas fa-thumbtack text-[10px] text-amber-500 rotate-45" title="Fixado" />
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {film.garantiaFabricante ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full uppercase">
                                    <i className="fas fa-shield-alt text-[8px]" />
                                    {film.garantiaFabricante} anos fabricante
                                </span>
                            ) : null}
                            {film.garantiaMaoDeObra ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full uppercase">
                                    <i className="fas fa-tools text-[8px]" />
                                    {film.garantiaMaoDeObra}d M.O.
                                </span>
                            ) : null}
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className="text-xl font-black text-slate-900 dark:text-slate-50 leading-none tabular-nums">
                            {formatCurrency(film.preco || 0)}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">por m²</p>
                        {film.maoDeObra ? (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                + {formatCurrency(film.maoDeObra)} M.O.
                            </p>
                        ) : null}
                    </div>
                </div>

                {/* Indicadores Técnicos */}
                {hasTechnicalData && (
                    <div className="flex justify-around items-center py-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/60 mb-4">
                        <TechIndicator label="VTL" value={film.vtl} unit="%" color="text-emerald-500" />
                        <TechIndicator label="UV"  value={film.uv}  unit="%" color="text-amber-500"  />
                        <TechIndicator label="IR"  value={film.ir}  unit="%" color="text-rose-500"   />
                        {film.tser ? <TechIndicator label="TSER" value={film.tser} unit="%" color="text-cyan-500" /> : null}
                    </div>
                )}

                {/* Imagens */}
                {hasImages && (
                    <div className="flex gap-2 overflow-x-auto pb-1 mb-4 no-scrollbar">
                        {film.imagens!.map((img, idx) => (
                            <div
                                key={idx}
                                onClick={(e) => handleImageClick(idx, e)}
                                className="w-12 h-12 rounded-lg overflow-hidden shrink-0 cursor-pointer border-2 border-transparent hover:border-blue-500 transition-all shadow-sm"
                            >
                                <img src={img} alt="" className="w-full h-full object-cover" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Rodapé de Ações */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/50">
                    <div className="flex gap-1.5">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(film); }}
                            className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1.5 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 transition-all text-xs font-semibold"
                            title="Editar"
                        >
                            <i className="fas fa-pen text-[10px]"></i>
                            Editar
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(film.nome); }}
                            className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-red-600 hover:text-white dark:hover:bg-red-600 transition-all"
                            title="Excluir"
                        >
                            <i className="fas fa-trash-alt text-[11px]"></i>
                        </button>
                    </div>

                    {(film.espessura || film.customFields) && (
                        <button
                            onClick={onToggleExpand}
                            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                            {isExpanded ? 'Menos' : 'Detalhes'}
                            <i className={`fas fa-chevron-down text-[9px] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Expansão de Detalhes */}
            <div className={`transition-all duration-300 ease-in-out bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/60 ${isExpanded ? 'max-h-48 opacity-100 py-3 px-4' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    {film.espessura && (
                        <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Espessura</span>
                            <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{film.espessura} mc</p>
                        </div>
                    )}
                    {film.customFields && Object.entries(film.customFields).map(([key, value]) => (
                        <div key={key}>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{key}</span>
                            <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{value}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const FilmListView: React.FC<FilmListViewProps> = ({ films, onAdd, onEdit, onDelete, onOpenGallery }) => {
    const [expandedFilmName, setExpandedFilmName] = useState<string | null>(null);
    const [swipedItemName, setSwipedItemName] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);

    const filteredFilms = React.useMemo(() => {
        if (!searchTerm.trim()) return films;
        const lowerTerm = searchTerm.toLowerCase().trim();
        return films.filter(film =>
            film.nome.toLowerCase().includes(lowerTerm) ||
            (film.preco && film.preco.toString().includes(lowerTerm)) ||
            (film.maoDeObra && film.maoDeObra.toString().includes(lowerTerm))
        );
    }, [films, searchTerm]);

    const displayedFilms = React.useMemo(() => {
        return filteredFilms.slice(0, visibleCount);
    }, [filteredFilms, visibleCount]);

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 10);
    };

    const handleToggleExpand = (filmName: string) => {
        setExpandedFilmName(prev => (prev === filmName ? null : filmName));
    };

    return (
        <div className="space-y-6">
            <PageCollectionToolbar
                search={searchTerm}
                onSearchChange={(value) => {
                    setSearchTerm(value);
                    setVisibleCount(10);
                }}
                onClearSearch={() => setSearchTerm('')}
                searchPlaceholder="Buscar película..."
                primaryActionLabel="Nova Película"
                onPrimaryAction={onAdd}
            />

            {displayedFilms.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {displayedFilms.map((film, idx) => (
                        <FilmCard
                            key={film.nome}
                            film={film}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            isExpanded={expandedFilmName === film.nome}
                            onToggleExpand={() => handleToggleExpand(film.nome)}
                            swipedItemName={swipedItemName}
                            onSetSwipedItem={setSwipedItemName}
                            onOpenGallery={onOpenGallery}
                            index={idx}
                        />
                    ))}

                    {visibleCount < filteredFilms.length && (
                        <div className="pt-4 flex justify-center">
                            <ActionButton
                                onClick={handleLoadMore}
                                variant="secondary"
                                size="md"
                                className="group rounded-full px-6"
                            >
                                Carregar mais
                            </ActionButton>
                        </div>
                    )}
                </div>
            ) : searchTerm ? (
                <ContentState
                    compact
                    iconClassName="fas fa-search"
                    title="Nenhuma película encontrada"
                    description="Tente buscar com outros termos."
                />
            ) : (
                <ContentState
                    iconClassName="fas fa-layer-group"
                    title="Nenhuma Película Cadastrada"
                    description="Adicione os tipos de películas com que você trabalha."
                    actionLabel="Adicionar Película"
                    onAction={onAdd}
                />
            )}
        </div>
    );
};

export default FilmListView;
