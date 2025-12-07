import React, { useState, useEffect, FormEvent, useRef, KeyboardEvent } from 'react';
import { Client } from '../../types';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Tooltip from '../ui/Tooltip';

interface ClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (client: Omit<Client, 'id'> | Client) => void;
    mode: 'add' | 'edit';
    client: Client | null;
    initialName?: string;
    aiData?: Partial<Client>;
    onOpenAIModal: () => void;
}

const applyPhoneMask = (value: string) => {
    if (!value) return "";
    let digitsOnly = value.replace(/\D/g, "");
    if (digitsOnly.length > 11) {
        digitsOnly = digitsOnly.slice(0, 11);
    }
    if (digitsOnly.length > 10) {
        return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 7)}-${digitsOnly.slice(7)}`;
    }
    if (digitsOnly.length > 6) {
        return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 6)}-${digitsOnly.slice(6)}`;
    }
    if (digitsOnly.length > 2) {
        return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2)}`;
    }
    if (digitsOnly.length > 0) {
        return `(${digitsOnly}`;
    }
    return "";
};

const applyCpfCnpjMask = (value: string) => {
    if (!value) return "";
    const digitsOnly = value.replace(/\D/g, "");
    if (digitsOnly.length <= 11) {
        return digitsOnly.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').slice(0, 14);
    } else {
        return digitsOnly.slice(0, 14).replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})/, '$1-$2');
    }
};

const applyCepMask = (value: string) => {
    if (!value) return "";
    const digitsOnly = value.replace(/\D/g, "");
    return digitsOnly.replace(/(\d{5})(\d{3})/, '$1-$2').slice(0, 9);
};

const popularDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com'];

const initialFormData: Omit<Client, 'id'> = {
    nome: '',
    telefone: '',
    email: '',
    cpfCnpj: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
};

const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, onSave, mode, client, initialName, aiData, onOpenAIModal }) => {
    const [formData, setFormData] = useState<Omit<Client, 'id'>>(initialFormData);
    const [isFetchingCep, setIsFetchingCep] = useState(false);
    const [isSearchingByAddress, setIsSearchingByAddress] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
    const numberInputRef = useRef<HTMLInputElement>(null);

    const handleCepBlur = async (cepValue?: string) => {
        const cep = cepValue || formData.cep?.replace(/\D/g, '');
        if (!cep || cep.length !== 8) {
            if (!cepValue) { // Só limpa se não foi chamado por IA
                setFormData(prev => ({ ...prev, logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' }));
            }
            return;
        }

        setIsFetchingCep(true);
        setError(null);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();

            if (data.erro) {
                setError("CEP não encontrado.");
                setFormData(prev => ({ ...prev, logradouro: '', bairro: '', cidade: '', uf: '' }));
            } else {
                setFormData(prev => ({
                    ...prev,
                    logradouro: data.logradouro || '',
                    bairro: data.bairro || '',
                    cidade: data.localidade || '',
                    uf: data.uf || '',
                }));
                // Foca no número após preencher o endereço
                numberInputRef.current?.focus();
            }
        } catch (e) {
            setError("Erro ao buscar CEP. Verifique sua conexão.");
            console.error(e);
        } finally {
            setIsFetchingCep(false);
        }
    };

    const handleAddressSearch = async () => {
        const fullAddress = `${formData.logradouro} ${formData.numero}, ${formData.bairro}, ${formData.cidade} - ${formData.uf}`;
        if (!fullAddress.trim() || fullAddress.length < 10) {
            setError("Preencha o máximo de campos de endereço possível para buscar o CEP.");
            return;
        }

        setIsSearchingByAddress(true);
        setError(null);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${formData.cidade}/${formData.uf}/${encodeURIComponent(formData.logradouro)}/${formData.numero}/json/`);
            const data = await response.json();

            if (data && data.length > 0) {
                const firstResult = data[0];
                setFormData(prev => ({
                    ...prev,
                    cep: firstResult.cep?.replace('-', ''),
                    logradouro: firstResult.logradouro || prev.logradouro,
                    bairro: firstResult.bairro || prev.bairro,
                    cidade: firstResult.localidade || prev.cidade,
                    uf: firstResult.uf || prev.uf,
                }));
                handleCepBlur(firstResult.cep?.replace('-', '')); // Tenta buscar detalhes com o CEP encontrado
            } else {
                setError("Endereço não encontrado via busca reversa. Tente inserir o CEP manualmente.");
            }
        } catch (e) {
            setError("Erro na busca reversa de endereço. Verifique sua conexão.");
            console.error(e);
        } finally {
            setIsSearchingByAddress(false);
        }
    };

    const updateEmailSuggestion = (value: string) => {
        const atIndex = value.indexOf('@');
        if (atIndex > 0) {
            const domain = value.substring(atIndex + 1);
            const potentialSuggestion = popularDomains.find(d => d.startsWith(domain) && d !== domain);
            if (potentialSuggestion) {
                setEmailSuggestion(`${value.substring(0, atIndex)}@${potentialSuggestion}`);
                return;
            }
        }
        setEmailSuggestion(null);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        let maskedValue = value;

        setError(null); // Clear errors on any change

        switch (id) {
            case 'telefone':
                maskedValue = applyPhoneMask(value);
                break;
            case 'cpfCnpj':
                maskedValue = applyCpfCnpjMask(value); // Aplica máscara
                break;
            case 'cep':
                maskedValue = applyCepMask(value);
                break;
            case 'email':
                updateEmailSuggestion(value);
                break;
        }
        setFormData(prev => ({ ...prev, [id]: maskedValue }));
    };

    useEffect(() => {
        if (isOpen) {
            setError(null);
            setEmailSuggestion(null);

            let baseData: Omit<Client, 'id'> = initialFormData;

            if (mode === 'edit' && client) {
                baseData = { ...initialFormData, ...client };
            } else {
                baseData = { ...initialFormData, nome: initialName || '' };
            }

            // 1. Aplica dados base e máscaras
            const initialFormState = {
                ...baseData,
                cpfCnpj: applyCpfCnpjMask(baseData.cpfCnpj || ''),
                telefone: applyPhoneMask(baseData.telefone || ''),
                cep: applyCepMask(baseData.cep || ''),
            };

            // 2. Aplica dados da IA (que já devem estar limpos/mascarados no App.tsx)
            let finalFormState = initialFormState;
            let cepToSearch: string | undefined;

            if (aiData) {
                // Aplica os dados da IA, garantindo que os campos de endereço sejam strings vazias se nulos
                finalFormState = {
                    ...initialFormState,
                    ...aiData,
                    // Reaplicar máscaras nos dados da IA, pois a IA retorna apenas dígitos
                    telefone: applyPhoneMask(aiData.telefone || ''),
                    cpfCnpj: applyCpfCnpjMask(aiData.cpfCnpj || ''),
                    cep: applyCepMask(aiData.cep || ''),
                    logradouro: aiData.logradouro || '',
                    numero: aiData.numero || '',
                    complemento: aiData.complemento || '',
                    bairro: aiData.bairro || '',
                    cidade: aiData.cidade || '',
                    uf: aiData.uf || '',
                };
                cepToSearch = aiData.cep;
            }

            setFormData(finalFormState);

            // 3. Se houver CEP (do cliente existente ou da IA), aciona a busca do ViaCEP
            if (cepToSearch || (mode === 'edit' && client?.cep)) {
                const cep = cepToSearch || client?.cep;
                if (cep) {
                    // Usamos setTimeout para garantir que o estado inicial do formData seja aplicado antes de buscar
                    setTimeout(() => handleCepBlur(cep.replace(/\D/g, '')), 0);
                }
            }
        }
    }, [mode, client, isOpen, initialName, aiData]);

    const handleEmailSuggestionClick = () => { if (emailSuggestion) { setFormData(prev => ({ ...prev, email: emailSuggestion })); setEmailSuggestion(null); } };
    const handleDomainTagClick = (domain: string) => { let currentValue = formData.email; const atIndex = currentValue.indexOf('@'); if (atIndex !== -1) { currentValue = currentValue.substring(0, atIndex); } const newValue = `${currentValue}@${domain}`; setFormData(prev => ({ ...prev, email: newValue })); setEmailSuggestion(null); };
    const handleEmailKeyDown = (e: KeyboardEvent<HTMLInputElement>) => { if ((e.key === 'Tab' || e.key === 'Enter') && emailSuggestion) { e.preventDefault(); setFormData(prev => ({ ...prev, email: emailSuggestion })); setEmailSuggestion(null); } };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const modalTitle = (
        <div className="flex justify-between items-center w-full">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white">
                {mode === 'add' ? (aiData ? 'Confirmar Dados da IA' : 'Adicionar Novo Cliente') : 'Editar Cliente'}
            </h2>
            {mode === 'add' && !aiData && (
                <Tooltip text="Preencher com IA">
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); onOpenAIModal(); }}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-2 text-sm"
                        aria-label="Preencher formulário com Inteligência Artificial"
                    >
                        <i className="fas fa-robot"></i>
                        <span className="hidden sm:inline">com IA</span>
                    </button>
                </Tooltip>
            )}
        </div>
    );

    const footerContent = (
        <button
            type="submit"
            form="clientForm"
            disabled={isFetchingCep || isSearchingByAddress}
            className="w-full p-3 bg-slate-800 dark:bg-slate-700 text-white rounded-md hover:bg-slate-700 dark:hover:bg-slate-600 transition duration-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:bg-slate-500 disabled:cursor-wait"
        >
            {isFetchingCep || isSearchingByAddress ? 'Processando...' : 'Salvar Cliente'}
        </button>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} footer={footerContent}>
            <form id="clientForm" onSubmit={handleSubmit} className="space-y-4">
                <fieldset disabled={isFetchingCep || isSearchingByAddress} className="space-y-4">
                    <Input id="nome" label="Nome do Cliente" type="text" value={formData.nome} onChange={handleChange} required placeholder="Ex: João da Silva" />
                    <Input id="telefone" label="Telefone" type="tel" value={formData.telefone} onChange={handleChange} placeholder="(XX) XXXXX-XXXX" maxLength={15} />
                    <Input
                        id="cpfCnpj"
                        label="CPF/CNPJ"
                        type="text"
                        inputMode="numeric"
                        value={formData.cpfCnpj}
                        onChange={handleChange}
                        maxLength={18}
                        // REMOVIDO: required
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    />

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                        <div className="relative">
                            <Input id="cep" label="CEP" type="tel" value={formData.cep || ''} onChange={handleChange} onBlur={() => handleCepBlur()} maxLength={9} placeholder="00000-000" />
                            {isFetchingCep && <i className="fas fa-spinner fa-spin absolute right-3 top-[38px] text-slate-400"></i>}
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3">
                        <p className="text-sm text-slate-600 dark:text-slate-400 -mt-1">Não sabe o CEP? Preencha os campos abaixo para buscar.</p>
                        <Input id="logradouro" label="Rua / Logradouro" type="text" value={formData.logradouro || ''} onChange={handleChange} placeholder="Ex: Av. Principal, 1234" />
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <Input id="cidade" label="Cidade" type="text" value={formData.cidade || ''} onChange={handleChange} placeholder="Ex: São Paulo" />
                            </div>
                            <div className="col-span-1">
                                <Input id="uf" label="UF" type="text" value={formData.uf || ''} onChange={handleChange} maxLength={2} placeholder="Ex: SP" />
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleAddressSearch}
                            disabled={isSearchingByAddress}
                            className="w-full h-12 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isSearchingByAddress ?
                                <><i className="fas fa-spinner fa-spin mr-2"></i> Buscando...</> :
                                <><i className="fas fa-search mr-2"></i> Buscar CEP por Endereço</>
                            }
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                            <Input id="numero" label="Número" type="text" value={formData.numero || ''} onChange={handleChange} ref={numberInputRef as React.Ref<HTMLInputElement>} placeholder="Ex: 123" />
                        </div>
                        <div className="col-span-2">
                            <Input id="complemento" label="Complemento" type="text" value={formData.complemento || ''} onChange={handleChange} placeholder="Ex: Apto 101, Bloco B" />
                        </div>
                    </div>
                    <Input id="bairro" label="Bairro" type="text" value={formData.bairro || ''} onChange={handleChange} placeholder="Ex: Centro" />

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                        <Input id="email" label="Email" type="email" value={formData.email} onChange={handleChange} onKeyDown={handleEmailKeyDown} autoComplete="off" placeholder="Ex: cliente@exemplo.com" />
                        {emailSuggestion && <div className="mt-1 text-left"><button type="button" onClick={handleEmailSuggestionClick} className="text-sm text-slate-500 hover:text-slate-800 transition-colors p-1 rounded">Sugestão: <span className="font-semibold">{emailSuggestion}</span></button></div>}
                        <div className="mt-2 flex flex-wrap gap-1.5">{popularDomains.map(domain => <button key={domain} type="button" onClick={() => handleDomainTagClick(domain)} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">@{domain}</button>)}</div>
                    </div>
                </fieldset>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-md" role="alert">
                        {error}
                    </div>
                )}
            </form>
        </Modal>
    );
};

export default ClientModal;