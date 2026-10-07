import { Dispatch, SetStateAction, useCallback } from 'react';
import * as db from '../../services/db';
import { renameFilmInStock } from '../../services/estoqueDb';
import { Film, Measurement } from '../../types';
import { buildFilmDuplicate, prepareFilmForSave } from '../lib/filmCatalog';

interface UseFilmFlowParams {
    films: Film[];
    setFilms: Dispatch<SetStateAction<Film[]>>;
    measurements: Measurement[];
    editingMeasurementIdForFilm: number | null;
    editingMeasurement: Measurement | null;
    filmToDeleteName: string | null;
    setIsDeletingFilm: Dispatch<SetStateAction<boolean>>;
    setEditingFilm: Dispatch<SetStateAction<Film | null>>;
    setIsFilmModalOpen: Dispatch<SetStateAction<boolean>>;
    setIsFilmSelectionModalOpen: Dispatch<SetStateAction<boolean>>;
    setIsApplyFilmToAllModalOpen: Dispatch<SetStateAction<boolean>>;
    setEditingMeasurementIdForFilm: Dispatch<SetStateAction<number | null>>;
    setFilmToDeleteName: Dispatch<SetStateAction<string | null>>;
    setFilmToApplyToAll: Dispatch<SetStateAction<string | null>>;
    setNewFilmName: Dispatch<SetStateAction<string>>;
    setAiFilmData: Dispatch<SetStateAction<Partial<Film> | undefined>>;
    setDuplicatingFilm: Dispatch<SetStateAction<Film | null>>;
    setEditingMeasurement: Dispatch<SetStateAction<Measurement | null>>;
    loadFilms: () => Promise<void>;
    handleMeasurementsChange: (measurements: Measurement[]) => void;
    handleShowInfo: (message: string, title?: string) => void;
}

export function useFilmFlow({
    films,
    setFilms,
    measurements,
    editingMeasurementIdForFilm,
    editingMeasurement,
    filmToDeleteName,
    setEditingFilm,
    setIsFilmModalOpen,
    setIsFilmSelectionModalOpen,
    setIsApplyFilmToAllModalOpen,
    setEditingMeasurementIdForFilm,
    setFilmToDeleteName,
    setFilmToApplyToAll,
    setNewFilmName,
    setAiFilmData,
    setDuplicatingFilm,
    setEditingMeasurement,
    setIsDeletingFilm,
    loadFilms,
    handleMeasurementsChange,
    handleShowInfo
}: UseFilmFlowParams) {
    const handleOpenFilmModal = useCallback((film: Film | null) => {
        setAiFilmData(undefined);
        setDuplicatingFilm(null);
        setEditingFilm(film);
        setIsFilmModalOpen(true);
    }, [setAiFilmData, setDuplicatingFilm, setEditingFilm, setIsFilmModalOpen]);

    const handleDuplicateFilm = useCallback((film: Film) => {
        setAiFilmData(undefined);
        setNewFilmName('');
        setEditingFilm(null);
        setDuplicatingFilm(buildFilmDuplicate(film, films));
        setIsFilmModalOpen(true);
    }, [films, setAiFilmData, setDuplicatingFilm, setEditingFilm, setIsFilmModalOpen, setNewFilmName]);

    const handleEditFilmFromSelection = useCallback((film: Film) => {
        setIsFilmSelectionModalOpen(false);
        setIsApplyFilmToAllModalOpen(false);
        setEditingMeasurementIdForFilm(null);
        handleOpenFilmModal(film);
    }, [
        handleOpenFilmModal,
        setEditingMeasurementIdForFilm,
        setIsApplyFilmToAllModalOpen,
        setIsFilmSelectionModalOpen
    ]);

    const handleSaveFilm = useCallback(async (formFilmData: Film, originalFilm: Film | null) => {
        const newFilmData = prepareFilmForSave(formFilmData, originalFilm);
        const renamedFrom = originalFilm && originalFilm.nome !== newFilmData.nome ? originalFilm.nome : null;

        if (renamedFrom) {
            await db.deleteCustomFilm(renamedFrom);
        }

        await db.saveCustomFilm(newFilmData);

        if (renamedFrom) {
            // Melhor esforço: o catálogo já resolve o nome antigo; o estoque só
            // atualiza com internet e não deve impedir o salvamento.
            renameFilmInStock(renamedFrom, newFilmData.nome).catch(error => {
                console.warn('[Películas] Não foi possível renomear a película no estoque:', error);
            });
        }

        await loadFilms();
        setIsFilmModalOpen(false);
        setEditingFilm(null);
        setNewFilmName('');
        setAiFilmData(undefined);
        setDuplicatingFilm(null);

        if (editingMeasurementIdForFilm !== null) {
            const updatedMeasurements = measurements.map(measurement =>
                measurement.id === editingMeasurementIdForFilm
                    ? { ...measurement, pelicula: newFilmData.nome, aiFilmSuggestion: undefined }
                    : measurement
            );
            handleMeasurementsChange(updatedMeasurements);
            setEditingMeasurementIdForFilm(null);
        }
    }, [
        editingMeasurementIdForFilm,
        handleMeasurementsChange,
        loadFilms,
        measurements,
        setAiFilmData,
        setDuplicatingFilm,
        setEditingFilm,
        setEditingMeasurementIdForFilm,
        setIsFilmModalOpen,
        setNewFilmName
    ]);

    // Reajuste em lote (e o "Desfazer" dele): mesmos nomes, só preços mudam.
    const handleSaveFilms = useCallback(async (filmsToSave: Film[]) => {
        for (const film of filmsToSave) {
            await db.saveCustomFilm(film);
        }
        await loadFilms();
    }, [loadFilms]);

    const handleToggleFilmPin = useCallback(async (filmName: string) => {
        const film = films.find(item => item.nome === filmName);
        if (!film) return;

        const isPinned = !film.pinned;
        const updatedFilm = {
            ...film,
            pinned: isPinned,
            pinnedAt: isPinned ? Date.now() : undefined
        };

        await db.saveCustomFilm(updatedFilm);
        await loadFilms();
    }, [films, loadFilms]);

    const handleDeleteFilm = useCallback((filmName: string) => {
        setFilmToDeleteName(filmName);
    }, [setFilmToDeleteName]);

    const handleRequestDeleteFilm = useCallback((filmName: string) => {
        setIsFilmSelectionModalOpen(false);
        setFilmToDeleteName(filmName);
    }, [setFilmToDeleteName, setIsFilmSelectionModalOpen]);

    const handleConfirmDeleteFilm = useCallback(async () => {
        if (filmToDeleteName === null) return;

        setIsDeletingFilm(true);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        try {
            await db.deleteCustomFilm(filmToDeleteName);
            setFilms(previous => previous.filter(film => film.nome !== filmToDeleteName));
            setFilmToDeleteName(null);
        } catch (error) {
            console.error('Erro ao excluir película:', error);
            handleShowInfo('Não foi possível excluir a película. Tente novamente.');
        } finally {
            setIsDeletingFilm(false);
        }
    }, [filmToDeleteName, setFilms, setFilmToDeleteName, setIsDeletingFilm, handleShowInfo]);

    const handleSelectFilmForMeasurement = useCallback((filmName: string) => {
        if (editingMeasurementIdForFilm === null) return;

        const updatedMeasurements = measurements.map(measurement =>
            measurement.id === editingMeasurementIdForFilm
                ? { ...measurement, pelicula: filmName, aiFilmSuggestion: undefined }
                : measurement
        );
        handleMeasurementsChange(updatedMeasurements);

        if (editingMeasurement && editingMeasurement.id === editingMeasurementIdForFilm) {
            setEditingMeasurement(previous => previous ? { ...previous, pelicula: filmName, aiFilmSuggestion: undefined } : null);
        }

        setIsFilmSelectionModalOpen(false);
        setEditingMeasurementIdForFilm(null);
    }, [
        editingMeasurement,
        editingMeasurementIdForFilm,
        handleMeasurementsChange,
        measurements,
        setEditingMeasurement,
        setEditingMeasurementIdForFilm,
        setIsFilmSelectionModalOpen
    ]);

    const handleApplyFilmToAll = useCallback((filmName: string | null) => {
        if (!filmName) return;

        const updatedMeasurements = measurements.map(measurement => ({
            ...measurement,
            pelicula: filmName,
            aiFilmSuggestion: undefined
        }));

        handleMeasurementsChange(updatedMeasurements);
        setFilmToApplyToAll(null);
        setIsApplyFilmToAllModalOpen(false);
    }, [
        handleMeasurementsChange,
        measurements,
        setFilmToApplyToAll,
        setIsApplyFilmToAllModalOpen
    ]);

    const handleAddNewFilmFromSelection = useCallback((filmName: string) => {
        setIsFilmSelectionModalOpen(false);
        setNewFilmName(filmName);
        handleOpenFilmModal(null);
    }, [handleOpenFilmModal, setIsFilmSelectionModalOpen, setNewFilmName]);

    return {
        handleOpenFilmModal,
        handleDuplicateFilm,
        handleEditFilmFromSelection,
        handleSaveFilm,
        handleSaveFilms,
        handleToggleFilmPin,
        handleDeleteFilm,
        handleRequestDeleteFilm,
        handleConfirmDeleteFilm,
        handleSelectFilmForMeasurement,
        handleApplyFilmToAll,
        handleAddNewFilmFromSelection
    };
}
