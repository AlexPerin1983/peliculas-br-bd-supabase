import React, { useState, useEffect, useRef } from 'react';
import { UserInfo, Film, Client } from '../../types';
import {
    ServicoPrestado,
    gerarCodigoServico,
    criarSnapshotEmpresa,
    criarDetalhesFilme,
    saveServicoPrestado,
    gerarUrlServico
} from '../../services/servicosService';
import { QRCodeSVG } from 'qrcode.react';
import ClientSelectionModal from './ClientSelectionModal';

interface ServicoQrModalProps {
    isOpen: boolean;
    onClose: () => void;
    userInfo: UserInfo | null;
    films: Film[];
    clients: Client[];
    isClientsLoading?: boolean;
    onTogglePin?: (id: number) => void;
    onAddNewClient?: (clientName: string) => void;
    onSuccess?: (servico: ServicoPrestado) => void;
}

const ServicoQrModal: React.FC<ServicoQrModalProps> = ({
    isOpen,
    onClose,
    userInfo,
    films,
    clients,
    isClientsLoading = false,
    onTogglePin,
    onAddNewClient,
    onSuccess
}) => {
    const [step, setStep] = useState<'form' | 'preview'>('form');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedServico, setSavedServico] = useState<ServicoPrestado | null>(null);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);

    // Form state
    const [clienteNome, setClienteNome] = useState('');
    const [endereco, setEndereco] = useState('');
    const [cidade, setCidade] = useState('');
    const [uf, setUf] = useState('');
    const [tipoLocal, setTipoLocal] = useState<'residencial' | 'comercial' | 'condominio' | 'empresa' | 'outros'>('residencial');
    const [filmeAplicado, setFilmeAplicado] = useState('');
    const [metrosAplicados, setMetrosAplicados] = useState('');
    const [dataServico, setDataServico] = useState(new Date().toISOString().split('T')[0]);
    const [observacoes, setObservacoes] = useState('');

    const printRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Handler para quando um cliente é selecionado do modal
    const handleClientSelect = (clientId: number | null) => {
        if (clientId === null) return;

        const selectedClient = clients.find(c => c.id === clientId);
        if (selectedClient) {
            // Preencher os campos do formulário com os dados do cliente
            setClienteNome(selectedClient.nome || '');

            // Montar endereço completo a partir dos campos do cliente
            const enderecoCompleto = [
                selectedClient.logradouro,
                selectedClient.numero,
                selectedClient.complemento,
                selectedClient.bairro
            ].filter(Boolean).join(', ');

            setEndereco(enderecoCompleto || '');
            setCidade(selectedClient.cidade || '');
            setUf(selectedClient.uf || '');
        }

        setIsClientModalOpen(false);
    };

    useEffect(() => {
        if (isOpen) {
            // Reset form
            setStep('form');
            setError(null);
            setSavedServico(null);
            setClienteNome('');
            setEndereco('');
            setCidade('');
            setUf('');
            setTipoLocal('residencial');
            setFilmeAplicado(films[0]?.nome || '');
            setMetrosAplicados('');
            setDataServico(new Date().toISOString().split('T')[0]);
            setObservacoes('');
            // Foca no primeiro campo
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, films]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!clienteNome.trim()) {
            setError('Nome do cliente/local é obrigatório');
            return;
        }
        if (!filmeAplicado) {
            setError('Selecione uma película');
            return;
        }
        if (!userInfo) {
            setError('Configure os dados da empresa primeiro');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const codigoQr = gerarCodigoServico();
            const selectedFilm = films.find(f => f.nome === filmeAplicado);
            const empresaSnapshot = criarSnapshotEmpresa(userInfo);

            const servico: ServicoPrestado = {
                codigo_qr: codigoQr,
                cliente_nome: clienteNome.trim(),
                endereco: endereco.trim() || undefined,
                cidade: cidade.trim() || undefined,
                uf: uf.trim().toUpperCase() || undefined,
                tipo_local: tipoLocal,
                filme_aplicado: filmeAplicado,
                filme_detalhes: selectedFilm ? criarDetalhesFilme(selectedFilm) : undefined,
                metros_aplicados: metrosAplicados ? parseFloat(metrosAplicados.replace(',', '.')) : undefined,
                data_servico: new Date(dataServico).toISOString(),
                observacoes: observacoes.trim() || undefined,
                empresa_nome: empresaSnapshot.empresa_nome || userInfo.empresa || userInfo.nome,
                empresa_telefone: empresaSnapshot.empresa_telefone,
                empresa_email: empresaSnapshot.empresa_email,
                empresa_site: empresaSnapshot.empresa_site,
                empresa_endereco: empresaSnapshot.empresa_endereco,
                empresa_logo: empresaSnapshot.empresa_logo,
                empresa_cores: empresaSnapshot.empresa_cores
            };

            const saved = await saveServicoPrestado(servico);

            if (saved) {
                setSavedServico(saved);
                setStep('preview');
                onSuccess?.(saved);
            } else {
                setError('Erro ao salvar serviço. Tente novamente.');
            }
        } catch (err: any) {
            console.error('Erro ao criar serviço:', err);
            setError(err.message || 'Erro desconhecido');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            setError('Por favor, permita pop-ups para imprimir');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Etiqueta QR - ${savedServico?.cliente_nome}</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        justify-content: center;
                        padding: 20px;
                    }
                    .etiqueta {
                        width: 80mm;
                        padding: 10mm;
                        border: 2px dashed #ccc;
                        text-align: center;
                    }
                    .empresa-nome {
                        font-size: 14pt;
                        font-weight: 700;
                        margin-bottom: 3mm;
                        color: #1e293b;
                    }
                    .tipo-servico {
                        font-size: 10pt;
                        color: #64748b;
                        margin-bottom: 5mm;
                    }
                    .qr-container {
                        margin: 5mm 0;
                    }
                    .qr-container svg {
                        width: 40mm !important;
                        height: 40mm !important;
                    }
                    .local-nome {
                        font-size: 11pt;
                        font-weight: 600;
                        margin-bottom: 2mm;
                        color: #334155;
                    }
                    .filme {
                        font-size: 9pt;
                        color: #64748b;
                        margin-bottom: 3mm;
                    }
                    .contato {
                        font-size: 8pt;
                        color: #64748b;
                        border-top: 1px solid #e2e8f0;
                        padding-top: 3mm;
                        margin-top: 3mm;
                    }
                    .instrucao {
                        font-size: 7pt;
                        color: #94a3b8;
                        margin-top: 3mm;
                        font-style: italic;
                    }
                    @media print {
                        body { padding: 0; }
                        .etiqueta { border: none; }
                    }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };

    if (!isOpen) return null;

    const qrUrl = savedServico ? gerarUrlServico(savedServico.codigo_qr) : '';

    return (
        <div className="fixed inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-[10000] flex flex-col animate-fade-in">
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky top-0">
                <div className="flex items-center justify-between gap-4 max-w-3xl mx-auto">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                        {step === 'form' ? '📋 Registrar Serviço' : '🎫 Etiqueta Pronta'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>
            </div>

            {step === 'form' ? (
                <>
                    {/* Content - Formulário */}
                    <div className="flex-grow overflow-y-auto p-4">
                        <form id="servicoForm" onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
                            <fieldset disabled={isLoading} className="space-y-6">
                                {error && (
                                    <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm flex items-center gap-2">
                                        <i className="fas fa-exclamation-circle"></i>
                                        {error}
                                    </div>
                                )}

                                {/* Seção: Local do Serviço */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <i className="fas fa-map-marker-alt"></i>
                                        Local do Serviço
                                    </h3>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Nome do Local / Cliente *
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                value={clienteNome}
                                                onChange={e => setClienteNome(e.target.value)}
                                                placeholder="Ex: Condomínio Solar, Empresa XYZ..."
                                                className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                style={{ touchAction: 'manipulation' }}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setIsClientModalOpen(true)}
                                                className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2 shadow-md"
                                                title="Selecionar cliente existente"
                                            >
                                                <i className="fas fa-address-book"></i>
                                                <span className="hidden sm:inline">Buscar</span>
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            Clique em "Buscar" para selecionar um cliente já cadastrado
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Tipo de Local
                                        </label>
                                        <select
                                            value={tipoLocal}
                                            onChange={e => setTipoLocal(e.target.value as any)}
                                            className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            style={{ touchAction: 'manipulation' }}
                                        >
                                            <option value="residencial">🏠 Residência</option>
                                            <option value="comercial">🏢 Comercial</option>
                                            <option value="condominio">🏘️ Condomínio</option>
                                            <option value="empresa">🏭 Empresa</option>
                                            <option value="outros">📍 Outros</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Endereço
                                        </label>
                                        <input
                                            type="text"
                                            value={endereco}
                                            onChange={e => setEndereco(e.target.value)}
                                            placeholder="Rua, número"
                                            className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            style={{ touchAction: 'manipulation' }}
                                        />
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                Cidade
                                            </label>
                                            <input
                                                type="text"
                                                value={cidade}
                                                onChange={e => setCidade(e.target.value)}
                                                placeholder="Cidade"
                                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                style={{ touchAction: 'manipulation' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                UF
                                            </label>
                                            <input
                                                type="text"
                                                value={uf}
                                                onChange={e => setUf(e.target.value)}
                                                placeholder="SP"
                                                maxLength={2}
                                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center uppercase"
                                                style={{ touchAction: 'manipulation' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Seção: Serviço Realizado */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <i className="fas fa-film"></i>
                                        Serviço Realizado
                                    </h3>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Película Aplicada *
                                        </label>
                                        <select
                                            value={filmeAplicado}
                                            onChange={e => setFilmeAplicado(e.target.value)}
                                            required
                                            className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            style={{ touchAction: 'manipulation' }}
                                        >
                                            <option value="">Selecione...</option>
                                            {films.map(film => (
                                                <option key={film.nome} value={film.nome}>
                                                    {film.nome}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                Área Aplicada (m²)
                                            </label>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={metrosAplicados}
                                                onChange={e => setMetrosAplicados(e.target.value)}
                                                placeholder="12,50"
                                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                style={{ touchAction: 'manipulation' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                Data do Serviço
                                            </label>
                                            <input
                                                type="date"
                                                value={dataServico}
                                                onChange={e => setDataServico(e.target.value)}
                                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                style={{ touchAction: 'manipulation' }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Observações
                                        </label>
                                        <textarea
                                            value={observacoes}
                                            onChange={e => setObservacoes(e.target.value)}
                                            placeholder="Informações adicionais sobre o serviço..."
                                            rows={3}
                                            className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                            style={{ touchAction: 'manipulation' }}
                                        />
                                    </div>
                                </div>
                            </fieldset>
                        </form>
                    </div>

                    {/* Footer - Botões */}
                    <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky bottom-0">
                        <div className="max-w-3xl mx-auto flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 p-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition duration-300"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="servicoForm"
                                disabled={isLoading}
                                className="flex-1 p-3 bg-slate-800 dark:bg-blue-600 text-white font-semibold rounded-lg hover:bg-slate-700 dark:hover:bg-blue-500 transition duration-300 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-check"></i>
                                        Gerar Etiqueta QR
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* Content - Preview */}
                    <div className="flex-grow overflow-y-auto p-4">
                        <div className="max-w-3xl mx-auto space-y-4">
                            <div className="bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 p-3 rounded-lg text-sm text-center flex items-center justify-center gap-2">
                                <i className="fas fa-check-circle"></i>
                                Serviço registrado com sucesso!
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg mx-auto max-w-sm border border-slate-200 dark:border-slate-700" ref={printRef}>
                                <div className="etiqueta text-center">
                                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">
                                        {savedServico?.empresa_nome}
                                    </div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                        Aplicação de Película
                                    </div>

                                    <div className="flex justify-center my-4">
                                        <QRCodeSVG
                                            value={qrUrl}
                                            size={160}
                                            level="H"
                                            includeMargin={true}
                                        />
                                    </div>

                                    <div className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-1">
                                        {savedServico?.cliente_nome}
                                    </div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                                        Película: {savedServico?.filme_aplicado}
                                    </div>

                                    {savedServico?.empresa_telefone && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                                            📞 {savedServico.empresa_telefone}
                                        </div>
                                    )}

                                    <div className="text-xs text-slate-400 mt-2 italic">
                                        Escaneie para ver detalhes e solicitar orçamento
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 flex items-center gap-2 max-w-sm mx-auto">
                                <span className="text-slate-500 dark:text-slate-400 text-sm whitespace-nowrap">URL:</span>
                                <code className="flex-1 text-slate-700 dark:text-slate-300 text-xs truncate">{qrUrl}</code>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(qrUrl);
                                    }}
                                    className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    title="Copiar URL"
                                >
                                    <i className="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer - Botões */}
                    <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky bottom-0">
                        <div className="max-w-3xl mx-auto flex gap-3">
                            {/* Botão Fechar - apenas desktop */}
                            <button
                                type="button"
                                onClick={onClose}
                                className="hidden md:flex flex-1 p-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition duration-300 items-center justify-center"
                            >
                                Fechar
                            </button>
                            {/* Botão Salvar como Imagem */}
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        setIsLoading(true);
                                        const { toPng } = await import('html-to-image');

                                        // 1. Criar container invisível
                                        const container = document.createElement('div');
                                        container.style.position = 'fixed';
                                        container.style.top = '-10000px';
                                        container.style.left = '-10000px';
                                        document.body.appendChild(container);

                                        // 2. Construir a etiqueta "na mão" com estilos inline para garantir que saia perfeita
                                        // Isso evita problemas com Tailwind, Dark Mode e CORS de fontes
                                        const card = document.createElement('div');
                                        card.style.width = '320px';
                                        card.style.padding = '30px 20px';
                                        card.style.backgroundColor = '#ffffff';
                                        card.style.color = '#000000';
                                        card.style.fontFamily = 'sans-serif';
                                        card.style.textAlign = 'center';
                                        card.style.display = 'flex';
                                        card.style.flexDirection = 'column';
                                        card.style.alignItems = 'center';
                                        card.style.border = '1px solid #e2e8f0';
                                        card.style.borderRadius = '12px';

                                        // Título da Empresa
                                        const empresa = document.createElement('h2');
                                        empresa.textContent = savedServico?.empresa_nome || 'Empresa';
                                        empresa.style.fontSize = '18px';
                                        empresa.style.fontWeight = 'bold';
                                        empresa.style.margin = '0 0 5px 0';
                                        empresa.style.color = '#1e293b';
                                        card.appendChild(empresa);

                                        // Subtítulo
                                        const sub = document.createElement('p');
                                        sub.textContent = 'Aplicação de Película';
                                        sub.style.fontSize = '12px';
                                        sub.style.color = '#64748b';
                                        sub.style.margin = '0 0 20px 0';
                                        card.appendChild(sub);

                                        // QR Code (Clonar o SVG gerado na tela para não precisar gerar de novo)
                                        const qrOriginal = printRef.current?.querySelector('svg');
                                        if (qrOriginal) {
                                            const qrClone = qrOriginal.cloneNode(true) as SVGElement;
                                            qrClone.style.width = '160px';
                                            qrClone.style.height = '160px';
                                            qrClone.style.margin = '0 auto 20px auto';
                                            qrClone.style.display = 'block';
                                            card.appendChild(qrClone);
                                        }

                                        // Nome do Cliente
                                        const cliente = document.createElement('h3');
                                        cliente.textContent = savedServico?.cliente_nome || 'Cliente';
                                        cliente.style.fontSize = '16px';
                                        cliente.style.fontWeight = '600';
                                        cliente.style.margin = '0 0 5px 0';
                                        cliente.style.color = '#334155';
                                        card.appendChild(cliente);

                                        // Filme
                                        const filme = document.createElement('p');
                                        filme.textContent = `Película: ${savedServico?.filme_aplicado || '-'}`;
                                        filme.style.fontSize = '13px';
                                        filme.style.color = '#64748b';
                                        filme.style.margin = '0 0 15px 0';
                                        card.appendChild(filme);

                                        // Telefone (se houver)
                                        if (savedServico?.empresa_telefone) {
                                            const tel = document.createElement('p');
                                            tel.textContent = `📞 ${savedServico.empresa_telefone}`;
                                            tel.style.fontSize = '11px';
                                            tel.style.color = '#64748b';
                                            tel.style.borderTop = '1px solid #e2e8f0';
                                            tel.style.paddingTop = '10px';
                                            tel.style.marginTop = '10px';
                                            tel.style.width = '100%';
                                            card.appendChild(tel);
                                        }

                                        // Footer
                                        const footer = document.createElement('p');
                                        footer.textContent = 'Escaneie para ver detalhes';
                                        footer.style.fontSize = '10px';
                                        footer.style.color = '#94a3b8';
                                        footer.style.fontStyle = 'italic';
                                        footer.style.marginTop = '5px';
                                        card.appendChild(footer);

                                        container.appendChild(card);

                                        // Pequeno delay para renderização
                                        await new Promise(resolve => setTimeout(resolve, 100));

                                        // 3. Gerar Imagem
                                        const dataUrl = await toPng(card, {
                                            backgroundColor: '#ffffff',
                                            pixelRatio: 2, // Qualidade boa, mas não exagerada
                                            cacheBust: true,
                                            // Ignorar folhas de estilo externas para evitar erros de CORS
                                            filter: (node) => node.tagName !== 'LINK',
                                        });

                                        // 4. Limpar e Download
                                        document.body.removeChild(container);

                                        const link = document.createElement('a');
                                        link.download = `etiqueta-${savedServico?.cliente_nome?.replace(/\s+/g, '-') || 'servico'}.png`;
                                        link.href = dataUrl;
                                        link.click();

                                    } catch (err) {
                                        console.error('Erro ao gerar imagem:', err);
                                        setError('Erro ao gerar imagem. Tente novamente.');
                                    } finally {
                                        setIsLoading(false);
                                    }
                                }}
                                className="flex-1 p-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition duration-300 shadow-md flex items-center justify-center gap-2"
                            >
                                <i className="fas fa-image"></i>
                                <span className="hidden sm:inline">Salvar</span> Imagem
                            </button>
                            {/* Botão Imprimir */}
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="flex-1 p-3 bg-slate-800 dark:bg-blue-600 text-white font-semibold rounded-lg hover:bg-slate-700 dark:hover:bg-blue-500 transition duration-300 shadow-md flex items-center justify-center gap-2"
                            >
                                <i className="fas fa-print"></i>
                                <span className="hidden sm:inline">Imprimir</span> Etiqueta
                            </button>
                        </div>
                    </div>
                </>
            )}

            <style jsx>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out forwards;
                }
            `}</style>

            {/* Modal de Seleção de Cliente */}
            <ClientSelectionModal
                isOpen={isClientModalOpen}
                onClose={() => setIsClientModalOpen(false)}
                clients={clients}
                onClientSelect={handleClientSelect}
                isLoading={isClientsLoading}
                onAddNewClient={onAddNewClient || (() => { })}
                onTogglePin={onTogglePin || (() => { })}
            />
        </div>
    );
};

export default ServicoQrModal;
