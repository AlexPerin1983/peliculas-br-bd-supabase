import { Dispatch, SetStateAction, useCallback } from 'react';
import * as db from '../../services/db';
import { Film, Measurement } from '../../types';

interface UseFilmFlowParams {
    films: Film[];
    measurements: Measurement[];
    editingMeasurementIdForFilm: number | null;
    editingMeasurement: Measurement | null;
    filmToDeleteName: string | null;
    setEditingFilm: Dispatch<SetStateAction<Film | null>>;
    setIsFilmModalOpen: Dispatch<SetStateAction<boolean>>;
    setIsFilmSelectionModalOpen: Dispatch<SetStateAction<boolean>>;
    setIsApplyFilmToAllModalOpen: Dispatch<SetStateAction<boolean>>;
    setEditingMeasurementIdForFilm: Dispatch<SetStateAction<number | null>>;
    setFilmToDeleteName: Dispatch<SetStateAction<string | null>>;
    setFilmToApplyToAll: Dispatch<SetStateAction<string | null>>;
    setNewFilmName: Dispatch<SetStateAction<string>>;
    setEditingMeasurement: Dispatch<SetStateAction<Measurement | null>>;
    loadFilms: () => Promise<void>;
    handleMeasurementsChange: (measurements: Measurement[]) => void;
}

export function useFilmFlow({
    films,
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
    setEditingMeasurement,
    loadFilms,
    handleMeasurementsChange
}: UseFilmFlowParams) {
    const handleOpenFilmModal = useCallback((film: Film | null) => {
        setEditingFilm(film);
        setIsFilmModalOpen(true);
    }, [setEditingFilm, setIsFilmModalOpen]);

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

    const handleSaveFilm = useCallback(async (newFilmData: Film, originalFilm: Film | null) => {
        if (originalFilm && originalFilm.nome !== newFilmData.nome) {
            await db.deleteCustomFilm(originalFilm.nome);
        }

        await db.saveCustomFilm(newFilmData);
        await loadFilms();
        setIsFilmModalOpen(false);
        setEditingFilm(null);

        if (editingMeasurementIdForFilm !== null) {
            const updatedMeasurements = measurements.map(measurement =>
                measurement.id === editingMeasurementIdForFilm
                    ? { ...measurement, pelicula: newFilmData.nome }
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
        setEditingFilm,
        setEditingMeasurementIdForFilm,
        setIsFilmModalOpen
    ]);

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

        await db.deleteCustomFilm(filmToDeleteName);
        await loadFilms();
        setFilmToDeleteName(null);
    }, [filmToDeleteName, loadFilms, setFilmToDeleteName]);

    const handleSelectFilmForMeasurement = useCallback((filmName: string) => {
        if (editingMeasurementIdForFilm === null) return;

        const updatedMeasurements = measurements.map(measurement =>
            measurement.id === editingMeasurementIdForFilm
                ? { ...measurement, pelicula: filmName }
                : measurement
        );
        handleMeasurementsChange(updatedMeasurements);

        if (editingMeasurement && editingMeasurement.id === editingMeasurementIdForFilm) {
            setEditingMeasurement(previous => previous ? { ...previous, pelicula: filmName } : null);
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
            pelicula: filmName
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
        handleEditFilmFromSelection,
        handleSaveFilm,
        handleToggleFilmPin,
        handleDeleteFilm,
        handleRequestDeleteFilm,
        handleConfirmDeleteFilm,
        handleSelectFilmForMeasurement,
        handleApplyFilmToAll,
        handleAddNewFilmFromSelection
    };
}
