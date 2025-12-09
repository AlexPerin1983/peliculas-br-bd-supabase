import React from 'react';

const SalesPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-50 font-sans selection:bg-blue-500 selection:text-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
                            FilmManager AI
                        </span>
                    </div>
                    <nav className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Funcionalidades</a>
                        <a href="#ai" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">IA</a>
                        <a href="#benefits" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Benefícios</a>
                        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-full transition-all shadow-lg shadow-blue-500/20">
                            Começar Agora
                        </button>
                    </nav>
                </div>
            </header>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
                    <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
                </div>

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 mb-8 backdrop-blur-sm">
                        <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
                        <span className="text-xs font-medium text-slate-300">Nova Versão com IA Disponível</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
                        Gestão de Películas <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400">
                            Reinventada com IA
                        </span>
                    </h1>

                    <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                        A solução definitiva para instaladores, vidraçarias e arquitetos.
                        Orçamentos em segundos, gestão de clientes e inteligência artificial
                        que trabalha por você.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-xl shadow-blue-500/20 transform hover:-translate-y-1">
                            Experimentar Grátis
                        </button>
                        <button className="w-full sm:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-700 hover:border-slate-600">
                            Ver Demonstração
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 bg-slate-800/30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Tudo que você precisa</h2>
                        <p className="text-slate-400 max-w-2xl mx-auto">
                            Ferramentas poderosas projetadas especificamente para o seu fluxo de trabalho.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<UsersIcon />}
                            title="Gestão de Clientes"
                            description="Cadastro completo, histórico de orçamentos e busca automática de endereço por CEP."
                        />
                        <FeatureCard
                            icon={<RulerIcon />}
                            title="Orçamentos Precisos"
                            description="Cálculo automático de área e preço. Múltiplos ambientes e opções de proposta."
                        />
                        <FeatureCard
                            icon={<FilmIcon />}
                            title="Catálogo Digital"
                            description="Gerencie suas películas com especificações técnicas (IR, UV, VLT) e galeria de fotos."
                        />
                        <FeatureCard
                            icon={<FileTextIcon />}
                            title="Propostas em PDF"
                            description="Gere documentos profissionais com sua marca, assinatura digital e envie por WhatsApp."
                        />
                        <FeatureCard
                            icon={<WalletIcon />}
                            title="Financeiro"
                            description="Controle formas de pagamento, parcelamento e chaves Pix integradas."
                        />
                        <FeatureCard
                            icon={<CalendarIcon />}
                            title="Agenda Inteligente"
                            description="Organize instalações e vincule diretamente aos orçamentos aprovados."
                        />
                    </div>
                </div>
            </section>

            {/* AI Section */}
            <section id="ai" className="py-24 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-gradient-to-br from-blue-900/50 to-slate-900 border border-blue-500/30 rounded-3xl p-8 md:p-16 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>

                        <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
                            <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 mb-6">
                                    <SparklesIcon className="w-4 h-4 text-blue-400" />
                                    <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Powered by AI</span>
                                </div>
                                <h2 className="text-3xl md:text-5xl font-bold mb-6">
                                    A Inteligência Artificial <br />
                                    <span className="text-blue-400">que trabalha por você</span>
                                </h2>
                                <ul className="space-y-4">
                                    <li className="flex items-start gap-3">
                                        <div className="mt-1 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                            <CheckIcon className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <p className="text-slate-300">
                                            <strong className="text-white">Leitura de Medidas:</strong> A IA lê mensagens de texto ou áudio e preenche a planilha automaticamente.
                                        </p>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="mt-1 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                            <CheckIcon className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <p className="text-slate-300">
                                            <strong className="text-white">Cadastro por Foto:</strong> Tire foto de um cartão de visita e a IA cadastra o cliente para você.
                                        </p>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="mt-1 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                            <CheckIcon className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <p className="text-slate-300">
                                            <strong className="text-white">Integração Flexível:</strong> Suporte para Google Gemini e OpenAI.
                                        </p>
                                    </li>
                                </ul>
                            </div>
                            <div className="relative">
                                <div className="aspect-square rounded-2xl bg-slate-800/50 border border-slate-700 p-6 flex flex-col gap-4 shadow-2xl">
                                    {/* Mock UI for AI Chat */}
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-700 shrink-0"></div>
                                        <div className="bg-slate-700/50 rounded-2xl rounded-tl-none p-3 text-sm text-slate-300">
                                            Orçamento para João Silva, janela da sala 2.5x1.5 e porta 2.1x0.8 com película G5.
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 flex-row-reverse">
                                        <div className="w-8 h-8 rounded-full bg-blue-600 shrink-0 flex items-center justify-center">
                                            <SparklesIcon className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="bg-blue-600/20 border border-blue-500/30 rounded-2xl rounded-tr-none p-3 text-sm text-blue-100">
                                            <p className="mb-2">Entendido! Criei o orçamento:</p>
                                            <div className="bg-slate-900/50 rounded p-2 text-xs font-mono space-y-1">
                                                <div className="flex justify-between"><span>Sala (Janela)</span> <span>2.50 x 1.50m</span></div>
                                                <div className="flex justify-between"><span>Sala (Porta)</span> <span>2.10 x 0.80m</span></div>
                                                <div className="border-t border-slate-700 pt-1 mt-1 text-blue-300">Total: 5.43m² • Película G5</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Target Audience */}
            <section id="benefits" className="py-24 bg-slate-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Feito para Profissionais</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <AudienceCard title="Instaladores" subtitle="Automotivo e Arquitetônico" />
                        <AudienceCard title="Vidraçarias" subtitle="Gestão completa de obras" />
                        <AudienceCard title="Comunicação Visual" subtitle="Orçamentos rápidos" />
                        <AudienceCard title="Arquitetos" subtitle="Especificação técnica" />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-950 py-12 border-t border-slate-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-4 gap-8 mb-8">
                        <div className="col-span-1 md:col-span-2">
                            <span className="text-xl font-bold text-white mb-4 block">FilmManager AI</span>
                            <p className="text-slate-400 max-w-xs">
                                A ferramenta essencial para quem busca profissionalismo e agilidade no mercado de películas.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-4">Produto</h4>
                            <ul className="space-y-2 text-sm text-slate-400">
                                <li><a href="#" className="hover:text-blue-400">Funcionalidades</a></li>
                                <li><a href="#" className="hover:text-blue-400">Preços</a></li>
                                <li><a href="#" className="hover:text-blue-400">Atualizações</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-4">Legal</h4>
                            <ul className="space-y-2 text-sm text-slate-400">
                                <li><a href="#" className="hover:text-blue-400">Termos de Uso</a></li>
                                <li><a href="#" className="hover:text-blue-400">Privacidade</a></li>
                                <li><a href="#" className="hover:text-blue-400">Contato</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-slate-900 pt-8 text-center text-sm text-slate-500">
                        &copy; 2024 FilmManager AI. Todos os direitos reservados.
                    </div>
                </div>
            </footer>
        </div>
    );
};

// Subcomponents
const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
    <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl hover:bg-slate-800 transition-colors group">
        <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600/20 group-hover:text-blue-400 transition-colors text-slate-300">
            {icon}
        </div>
        <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
        <p className="text-slate-400 leading-relaxed">{description}</p>
    </div>
);

const AudienceCard = ({ title, subtitle }: { title: string, subtitle: string }) => (
    <div className="bg-slate-800/30 border border-slate-800 p-6 rounded-xl text-center hover:border-blue-500/50 transition-colors">
        <h3 className="font-bold text-lg text-white mb-1">{title}</h3>
        <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
);

// Icons (Simple SVG components to avoid dependencies)
const UsersIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);

const RulerIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
);

const FilmIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
);

const FileTextIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const WalletIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
);

export default SalesPage;
