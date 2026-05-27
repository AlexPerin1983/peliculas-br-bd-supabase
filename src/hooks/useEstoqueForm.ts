import { useState } from 'react';

export function useEstoqueForm() {
    const [formFilmId, setFormFilmId] = useState('');
    const [formLargura, setFormLargura] = useState('');
    const [formComprimento, setFormComprimento] = useState('');
    const [formFornecedor, setFormFornecedor] = useState('');
    const [formLote, setFormLote] = useState('');
    const [formCusto, setFormCusto] = useState('');
    const [formLocalizacao, setFormLocalizacao] = useState('');
    const [formObservacao, setFormObservacao] = useState('');
    const [formBobinaId, setFormBobinaId] = useState<number | ''>('');
    const [formDeduzirDaBobina, setFormDeduzirDaBobina] = useState(false);
    const [formQuantidade, setFormQuantidade] = useState('1');

    return {
        form: {
            formFilmId,
            formLargura,
            formComprimento,
            formFornecedor,
            formLote,
            formCusto,
            formLocalizacao,
            formObservacao,
            formBobinaId,
            formDeduzirDaBobina,
            formQuantidade,
        },
        setters: {
            setFormFilmId,
            setFormLargura,
            setFormComprimento,
            setFormFornecedor,
            setFormLote,
            setFormCusto,
            setFormLocalizacao,
            setFormObservacao,
            setFormBobinaId,
            setFormDeduzirDaBobina,
            setFormQuantidade,
        },
    };
}
