import React, { useState, useEffect, useCallback } from 'react';
import { Location, LocationMeasurement } from '../../types';
import { locationService } from '../../services/locationService';
import { useError } from '../../src/contexts/ErrorContext';

interface LocationMeasurementsProps {
    location: Location;
    onBack: () => void;
}

const LocationMeasurements: React.FC<LocationMeasurementsProps> = ({ location, onBack }) => {
    const { showError } = useError();
    const [measurements, setMeasurements] = useState<LocationMeasurement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<Partial<LocationMeasurement>>({});

    const loadMeasurements = useCallback(async () => {
        if (!location.id) return;
        setIsLoading(true);
        try {
            const data = await locationService.getMeasurements(location.id);
            setMeasurements(data);
        } catch (error) {
            console.error('Erro ao carregar medidas:', error);
            showError('Falha ao carregar medidas.');
        } finally {
            setIsLoading(false);
        }
    }, [location.id, showError]);

    useEffect(() => {
        loadMeasurements();
    }, [loadMeasurements]);

    const handleAddNew = () => {
        setEditingId(-1); // -1 indicates new item
        setEditForm({
            name: '',
            largura: '',
            altura: '',
            quantidade: 1,
            ambiente: '',
            tipo_aplicacao: '',
            observacao: ''
        });
    };

    const handleEdit = (measurement: LocationMeasurement) => {
        setEditingId(measurement.id!);
        setEditForm(measurement);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const handleSave = async () => {
        if (!location.id) return;

        try {
            if (editingId === -1) {
                await locationService.addMeasurement({
                    ...editForm as any,
                    location_id: location.id
                });
            } else if (editingId) {
                await locationService.updateMeasurement(editingId, editForm);
            }
            setEditingId(null);
            loadMeasurements();
        } catch (error) {
            console.error('Erro ao salvar medida:', error);
            showError('Falha ao salvar medida.');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Tem certeza que deseja excluir esta medida?')) return;
        try {
            await locationService.deleteMeasurement(id);
            loadMeasurements();
        } catch (error) {
            console.error('Erro ao excluir medida:', error);
            showError('Falha ao excluir medida.');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditForm(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300"
                >
                    <i className="fas fa-arrow-left text-xl"></i>
                </button>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{location.name}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Gerenciar Medidas Padrão</p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                    <h3 className="font-medium text-gray-700 dark:text-gray-300">Lista de Medidas</h3>
                    <button
                        onClick={handleAddNew}
                        disabled={editingId !== null}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        <i className="fas fa-plus"></i>
                        Adicionar
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
                            <tr>
                                <th className="px-4 py-3 font-medium">Nome/Ambiente</th>
                                <th className="px-4 py-3 font-medium w-24">Largura</th>
                                <th className="px-4 py-3 font-medium w-24">Altura</th>
                                <th className="px-4 py-3 font-medium w-16">Qtd</th>
                                <th className="px-4 py-3 font-medium w-24">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {editingId === -1 && (
                                <tr className="bg-blue-50 dark:bg-blue-900/20">
                                    <td className="px-4 py-3">
                                        <input
                                            type="text"
                                            name="name"
                                            value={editForm.name || ''}
                                            onChange={handleChange}
                                            placeholder="Nome (ex: Sala)"
                                            className="w-full p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                            autoFocus
                                        />
                                        <input
                                            type="text"
                                            name="ambiente"
                                            value={editForm.ambiente || ''}
                                            onChange={handleChange}
                                            placeholder="Ambiente"
                                            className="w-full p-1 mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="text"
                                            name="largura"
                                            value={editForm.largura || ''}
                                            onChange={handleChange}
                                            className="w-full p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="text"
                                            name="altura"
                                            value={editForm.altura || ''}
                                            onChange={handleChange}
                                            className="w-full p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="number"
                                            name="quantidade"
                                            value={editForm.quantidade || 1}
                                            onChange={handleChange}
                                            className="w-full p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2">
                                            <button onClick={handleSave} className="text-green-600 hover:bg-green-100 p-1 rounded"><i className="fas fa-save"></i></button>
                                            <button onClick={handleCancelEdit} className="text-red-600 hover:bg-red-100 p-1 rounded"><i className="fas fa-times"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {measurements.map((m) => (
                                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    {editingId === m.id ? (
                                        <>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    name="name"
                                                    value={editForm.name || ''}
                                                    onChange={handleChange}
                                                    className="w-full p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                                />
                                                <input
                                                    type="text"
                                                    name="ambiente"
                                                    value={editForm.ambiente || ''}
                                                    onChange={handleChange}
                                                    className="w-full p-1 mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    name="largura"
                                                    value={editForm.largura || ''}
                                                    onChange={handleChange}
                                                    className="w-full p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    name="altura"
                                                    value={editForm.altura || ''}
                                                    onChange={handleChange}
                                                    className="w-full p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    name="quantidade"
                                                    value={editForm.quantidade || 1}
                                                    onChange={handleChange}
                                                    className="w-full p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    <button onClick={handleSave} className="text-green-600 hover:bg-green-100 p-1 rounded"><i className="fas fa-save"></i></button>
                                                    <button onClick={handleCancelEdit} className="text-red-600 hover:bg-red-100 p-1 rounded"><i className="fas fa-times"></i></button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900 dark:text-white">{m.name}</div>
                                                <div className="text-xs text-gray-500">{m.ambiente}</div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{m.largura}</td>
                                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{m.altura}</td>
                                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{m.quantidade}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleEdit(m)} className="text-blue-600 hover:bg-blue-100 p-1 rounded"><i className="fas fa-edit"></i></button>
                                                    <button onClick={() => handleDelete(m.id!)} className="text-red-600 hover:bg-red-100 p-1 rounded"><i className="fas fa-trash-alt"></i></button>
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                            {measurements.length === 0 && editingId !== -1 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                        Nenhuma medida cadastrada para este local.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LocationMeasurements;
