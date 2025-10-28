import React, { useState, useEffect, FormEvent, useRef, KeyboardEvent } from 'react';
import { Client } from '../../types';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Tooltip from '../ui/Tooltip';

interface ClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (client: Omit<Client, 'id'>) => void;
    mode: 'add' | 'edit';
    client: Client | null;
    initialName?: string;
    aiData?: Partial<Client>; // Novo campo para dados preenchidos pela IA
    onOpenAIModal: () => void; // Novo prop para abrir o modal de IA
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
    return value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 9);
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
    const isInitialLoadRef = useRef(true); // Para controlar o primeiro useEffect

    const handleCepBlur = async (cepValue?: string) => {
        const cep = (cepValue || formData.cep)?.replace(/\D/g, '');
        if (cep && cep.length === 8) {
            setIsFetchingCep(true);
            setError(null);
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                if (!response.ok) throw new Error('CEP não encontrado.');
                const data = await response.json();
                if (data.erro) throw new Error('CEP inválido.');
                
                setFormData(prev => ({
                    ...prev,
                    logradouro: data.logradouro,
                    bairro: data.bairro,
                    cidade: data.localidade,
                    uf: data.uf,
                    cep: applyCepMask(cep), // Garante que o CEP esteja mascarado
                }));
                // Se não estiver em modo de edição/AI, foca no número
                if (!cepValue && !aiData) {
                    numberInputRef.current?.focus();
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Erro ao buscar CEP.');
            } finally {
                setIsFetchingCep(false);
            }
        }
    };

    useEffect(() => {
        if (isOpen) {
            setError(null);
            setEmailSuggestion(null);
            let baseData = initialFormData;
            
            if (mode === 'edit' && client) {
                baseData = { ...initialFormData, ...client };
            } else {
                baseData = { ...initialFormData, nome: initialName || '' };
            }
            
            let cepToSearch: string | undefined;

            // Apply AI data if available
            if (aiData) {
                baseData = {
                    ...baseData,
                    ...aiData,
                    // Apply masks to AI data fields
                    telefone: applyPhoneMask(aiData.telefone || ''),
                    cpfCnpj: applyCpfCnpjMask(aiData.cpfCnpj || ''),
                    cep: applyCepMask(aiData.cep || ''),
                };
                cepToSearch = aiData.cep;
            }
            
            setFormData(baseData);
            isInitialLoadRef.current = true;

            // Se houver CEP da IA, aciona a busca do ViaCEP para validar e preencher o endereço
            if (cepToSearch) {
                // Usamos setTimeout para garantir que o estado inicial do formData seja aplicado antes de buscar
                setTimeout(() => handleCepBlur(cepToSearch), 0);
            }
        }
    }, [mode, client, isOpen, initialName, aiData]);

    const handleAddressSearch = async () => {
        const { logradouro, cidade, uf } = formData;
        if (!logradouro || !cidade || !uf || logradouro.length < 3) {
            setError("Preencha Rua, Cidade e UF para buscar o CEP.");
            return;
        }
        setIsSearchingByAddress(true);
        setError(null);
        try {
            // Using encodeURIComponent to handle spaces and special characters in street names
            const response = await fetch(`https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(cidade)}/${encodeURIComponent(logradouro)}/json/`);
            if (!response.ok) throw new Error('Falha na busca por endereço.');
            const data = await response.json();
            
            if (data.erro || (Array.isArray(data) && data.length === 0)) {
                throw new Error("Endereço não encontrado.");
            }
            // The API can return an array if the address is ambiguous. We'll take the first result.
            const result = Array.isArray(data) ? data[0] : data;

            if (result && result.cep) {
                setFormData(prev => ({
                    ...prev,
                    cep: applyCepMask(result.cep),
                    bairro: prev.bairro || result.bairro,
                }));
            } else {
                 throw new Error("CEP não retornado para este endereço.");
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao buscar endereço.');
        } finally {
            setIsSearchingByAddress(false);
        }
    };

    const updateEmailSuggestion = (value: string) => {
        if (value.includes('@')) {
            const [localPart, domainPart] = value.split('@');
            if (localPart && domainPart.length > 0) {
                const match = popularDomains.find(domain => domain.startsWith(domainPart));
                if (match && match !== domainPart) {
                    setEmailSuggestion(`${localPart}@${match}`);
                    return;
                }
            }
        }
        setEmailSuggestion(null);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        let maskedValue = value;
        
        setError(null); // Clear errors on any change

        switch (id) {
            case 'telefone':
                maskedValue = applyPhoneMask(value);
                break;
            case 'cpfCnpj':
                maskedValue = applyCpfCnpjMask(value);
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
    
    const handleSubmit = (e: FormEvent) => { e.preventDefault(); onSave(formData); };
    const handleEmailSuggestionClick = () => { if (emailSuggestion) { setFormData(prev => ({ ...prev, email: emailSuggestion })); setEmailSuggestion(null); } };
    const handleDomainTagClick = (domain: string) => { let currentValue = formData.email; const atIndex = currentValue.indexOf('@'); if (atIndex !== -1) { currentValue = currentValue.substring(0, atIndex); } const newValue = `${currentValue}@${domain}`; setFormData(prev => ({ ...prev, email: newValue })); setEmailSuggestion(null); };
    const handleEmailKeyDown = (e: KeyboardEvent<HTMLInputElement>) => { if ((e.key === 'Tab' || e.key === 'Enter') && emailSuggestion) { e.preventDefault(); setFormData(prev => ({ ...prev, email: emailSuggestion })); setEmailSuggestion(null); } };
    
    const modalTitle = (
        <div className="flex items-center justify-between w-full">
            <span className="truncate pr-2">{mode === 'add' ? 'Adicionar Novo Cliente' : 'Editar Cliente'}</span>
            {mode === 'add' && (
                <Tooltip text="Preencher com IA">
                    <button
                        type="button"
                        onClick={onOpenAIModal}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 transition-colors"
                        aria-label="Preencher com IA"
                    >
                        <i className="fas fa-robot text-lg"></i>
                    </button>
                </Tooltip>
            )}
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
            <form id="clientForm" onSubmit={handleSubmit} className="space-y-4">
                 <fieldset disabled={isFetchingCep || isSearchingByAddress} className="space-y-4">
                    <Input id="nome" label="Nome do Cliente" type="text" value={formData.nome} onChange={handleChange} required />
                    <Input id="telefone" label="Telefone" type="tel" value={formData.telefone} onChange={handleChange} placeholder="(XX) XXXXX-XXXX" maxLength={15} />
                    <Input id="cpfCnpj" label="CPF/CNPJ" type="tel" inputMode="numeric" value={formData.cpfCnpj} onChange={handleChange} maxLength={18} />
                    
                    <div className="pt-4 border-t border-slate-200">
                        <div className="relative">
                            <Input id="cep" label="CEP" type="tel" value={formData.cep || ''} onChange={handleChange} onBlur={() => handleCepBlur()} maxLength={9} />
                            {isFetchingCep && <i className="fas fa-spinner fa-spin absolute right-3 top-[38px] text-slate-400"></i>}
                        </div>
                    </div>
                    
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                        <p className="text-sm text-slate-600 -mt-1">Não sabe o CEP? Preencha os campos abaixo para buscar.</p>
                        <Input id="logradouro" label="Rua / Logradouro" type="text" value={formData.logradouro || ''} onChange={handleChange} />
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <Input id="cidade" label="Cidade" type="text" value={formData.cidade || ''} onChange={handleChange} />
                            </div>
                            <div className="col-span-1">
                                <Input id="uf" label="UF" type="text" value={formData.uf || ''} onChange={handleChange} maxLength={2} />
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleAddressSearch}
                            disabled={isSearchingByAddress}
                            className="w-full h-12 bg-slate-200 text-slate-700 font-semibold rounded-lg flex items-center justify-center hover:bg-slate-300 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isSearchingByAddress ? 
                                <><i className="fas fa-spinner fa-spin mr-2"></i> Buscando...</> : 
                                <><i className="fas fa-search mr-2"></i> Buscar CEP por Endereço</>
                            }
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                            <Input id="numero" label="Número" type="text" value={formData.numero || ''} onChange={handleChange} ref={numberInputRef as React.Ref<HTMLInputElement>} />
                        </div>
                        <div className="col-span-2">
                            <Input id="complemento" label="Complemento" type="text" value={formData.complemento || ''} onChange={handleChange} />
                        </div>
                    </div>
                    <Input id="bairro" label="Bairro" type="text" value={formData.bairro || ''} onChange={handleChange} />
                    
                    <div className="pt-4 border-t border-slate-200">
                        <Input id="email" label="Email" type="email" value={formData.email} onChange={handleChange} onKeyDown={handleEmailKeyDown} autoComplete="off" />
                        {emailSuggestion && <div className="mt-1 text-left"><button type="button" onClick={handleEmailSuggestionClick} className="text-sm text-slate-500 hover:text-slate-800 transition-colors p-1 rounded">Sugestão: <span className="font-semibold">{emailSuggestion}</span></button></div>}
                        <div className="mt-2 flex flex-wrap gap-1.5">{popularDomains.map(domain => <button key={domain} type="button" onClick={() => handleDomainTagClick(domain)} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full hover:bg-slate-200 transition-colors">@{domain}</button>)}</div>
                    </div>
                </fieldset>

                {error && (
                    <div className="mt-4 bg-red-50 p-3 rounded-lg border border-red-200 text-sm text-red-800" role="alert">
                        <div className="flex">
                            <div className="flex-shrink-0"><i className="fas fa-exclamation-triangle text-red-500 h-5 w-5" aria-hidden="true"></i></div>
                            <div className="ml-3"><p>{error}</p></div>
                        </div>
                    </div>
                )}
                
                <div className="pt-4">
                    <button type="submit" disabled={isFetchingCep || isSearchingByAddress} className="w-full p-3 bg-slate-800 text-white rounded-md hover:bg-slate-700 transition duration-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:bg-slate-500 disabled:cursor-wait">
                        {isFetchingCep || isSearchingByAddress ? 'Processando...' : 'Salvar Cliente'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ClientModal;