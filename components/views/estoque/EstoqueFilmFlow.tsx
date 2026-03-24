import React from 'react';
import { Film } from '../../../types';
import FilmSelectionModal from '../../modals/FilmSelectionModal';
import FilmModal from '../../modals/FilmModal';
import { saveCustomFilm } from '../../../services/db';

type EstoqueFilmFlowProps = {
    films: Film[];
    showFilmSelectionModal: boolean;
    setShowFilmSelectionModal: (value: boolean) => void;
    showFilmModal: boolean;
    setShowFilmModal: (value: boolean) => void;
    editingFilm: Film | null;
    setEditingFilm: (value: Film | null) => void;
    filmNameToAdd: string;
    setFilmNameToAdd: (value: string) => void;
    setFormFilmId: (value: string) => void;
    onReloadData: () => Promise<void>;
};

export default function EstoqueFilmFlow({
    films,
    showFilmSelectionModal,
    setShowFilmSelectionModal,
    showFilmModal,
    setShowFilmModal,
    editingFilm,
    setEditingFilm,
    filmNameToAdd,
    setFilmNameToAdd,
    setFormFilmId,
    onReloadData,
}: EstoqueFilmFlowProps) {
    return (
        <>
            <FilmSelectionModal
                isOpen={showFilmSelectionModal}
                onClose={() => setShowFilmSelectionModal(false)}
                films={films}
                onSelect={(filmName) => {
                    setFormFilmId(filmName);
                    setShowFilmSelectionModal(false);
                }}
                onAddNewFilm={(filmName) => {
                    setFilmNameToAdd(filmName);
                    setEditingFilm(null);
                    setShowFilmModal(true);
                }}
                onEditFilm={(film) => {
                    setEditingFilm(film);
                    setShowFilmModal(true);
                }}
                onDeleteFilm={(filmName) => {
                    console.log('Deletar pelicula:', filmName);
                }}
                onTogglePin={(filmName) => {
                    console.log('Toggle pin:', filmName);
                }}
            />

            {showFilmModal && (
                <FilmModal
                    isOpen={showFilmModal}
                    onClose={() => {
                        setShowFilmModal(false);
                        setEditingFilm(null);
                        setFilmNameToAdd('');
                    }}
                    onSave={async (film) => {
                        try {
                            await saveCustomFilm(film);
                            setFormFilmId(film.nome);
                            await onReloadData();
                            setShowFilmModal(false);
                            setEditingFilm(null);
                            setFilmNameToAdd('');
                        } catch (error) {
                            console.error('Erro ao salvar pelicula:', error);
                        }
                    }}
                    onDelete={async () => {
                        setShowFilmModal(false);
                        setEditingFilm(null);
                        await onReloadData();
                    }}
                    film={editingFilm}
                    initialName={filmNameToAdd}
                    films={films}
                />
            )}
        </>
    );
}
