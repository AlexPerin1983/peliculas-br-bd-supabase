import React, { useState, useEffect, FormEvent } from 'react';
import { UserInfo } from '../../types';
import Modal from '../ui/Modal';
import Input from '../ui/Input';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (userInfo: UserInfo) => void;
    userInfo: UserInfo;
    onOpenPaymentMethods: () => void;
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

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, onSave, userInfo, onOpenPaymentMethods }) => {
    const [formData, setFormData] = useState<UserInfo>(userInfo);
    const [logoPreview, setLogoPreview] = useState<string | undefined>(userInfo.logo);

    useEffect(() => {
        setFormData(userInfo);
        setLogoPreview(userInfo.logo);
    }, [userInfo, isOpen]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        if (id === 'telefone') {
            setFormData(prev => ({ ...prev, [id]: applyPhoneMask(value) }));
        } else {
            setFormData(prev => ({ ...prev, [id]: value }));
        }
    };
    
    const handleColorChange = (colorType: 'primaria' | 'secundaria', value: string) => {
        setFormData(prev => ({
            ...prev,
            cores: {
                ...(prev.cores || { primaria: '#4f46e5', secundaria: '#10b981' }),
                [colorType]: value
            }
        }));
    };
    
    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setFormData(prev => ({ ...prev, logo: base64String }));
                setLogoPreview(base64String);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleRemoveLogo = () => {
        setFormData(prev => ({ ...prev, logo: '' }));
        setLogoPreview('');
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const footer = (
        <>
            <button
                onClick={onOpenPaymentMethods}
                className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-semibold rounded-md hover:bg-slate-300"
                aria-label="Métodos de Pagamento"
            >
                <i className="fas fa-dollar-sign mr-2"></i>
                Pagamento
            </button>
            <div className="flex-grow"></div>
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-100">
                Cancelar
            </button>
            <button
                type="submit"
                form="userForm"
                className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-md hover:bg-slate-700"
            >
                Salvar
            </button>
        </>
    );

    const labelClass = "block text-sm font-medium text-slate-700";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Minha Empresa" footer={footer}>
            <form id="userForm" onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="logo-upload-input" className={labelClass}>Logotipo</label>
                    <div className="mt-1 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg">
                        <div className="space-y-1 text-center">
                            {logoPreview ? (
                                <>
                                    <img src={logoPreview} alt="Preview do logotipo" className="mx-auto max-h-24 w-auto rounded" />
                                    <div className="flex text-sm justify-center gap-4 pt-4">
                                        <label htmlFor="logo-upload-input" className="relative cursor-pointer bg-white rounded-md font-medium text-slate-700 hover:text-slate-900">
                                            <span>Alterar</span>
                                            <input id="logo-upload-input" name="logo-upload-input" type="file" className="sr-only" accept="image/*" onChange={handleLogoChange} />
                                        </label>
                                        <button type="button" onClick={handleRemoveLogo} className="font-medium text-red-600 hover:text-red-800">
                                            Remover
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <label htmlFor="logo-upload-input" className="relative cursor-pointer bg-white rounded-md font-medium text-slate-700 hover:text-slate-900">
                                        <span>Envie um arquivo</span>
                                        <input id="logo-upload-input" name="logo-upload-input" type="file" className="sr-only" accept="image/*" onChange={handleLogoChange} />
                                    </label>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div>
                    <label className={labelClass}>Cores do PDF</label>
                    <div className="flex items-center space-x-6 mt-2">
                        <div>
                            <span className="text-sm text-slate-600">Primária</span>
                            <input type="color" value={formData.cores?.primaria || '#4f46e5'} onChange={(e) => handleColorChange('primaria', e.target.value)} className="w-10 h-10 rounded-md border-slate-300 border cursor-pointer mt-1" />
                        </div>
                        <div>
                            <span className="text-sm text-slate-600">Secundária</span>
                            <input type="color" value={formData.cores?.secundaria || '#10b981'} onChange={(e) => handleColorChange('secundaria', e.target.value)} className="w-10 h-10 rounded-md border-slate-300 border cursor-pointer mt-1" />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input id="nome" label="Seu Nome" type="text" value={formData.nome} onChange={handleChange} required />
                    <Input id="empresa" label="Nome da Empresa" type="text" value={formData.empresa} onChange={handleChange} required />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input id="telefone" label="Telefone" type="tel" value={formData.telefone} onChange={handleChange} required placeholder="(XX) XXXXX-XXXX" maxLength={15} />
                    <Input id="email" label="Email" type="email" value={formData.email} onChange={handleChange} required />
                </div>
                <Input id="endereco" label="Endereço" type="text" value={formData.endereco} onChange={handleChange} required />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input id="cpfCnpj" label="CPF/CNPJ" type="text" value={formData.cpfCnpj} onChange={handleChange} required />
                    <Input id="site" label="Site" type="text" value={formData.site || ''} onChange={handleChange} placeholder="www.suaempresa.com.br" />
                </div>
            </form>
        </Modal>
    );
};

export default UserModal;