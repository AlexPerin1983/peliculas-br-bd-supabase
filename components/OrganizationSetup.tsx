import React, { FormEvent, useMemo, useRef, useState } from 'react';
import { Building2, ImagePlus, Loader2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { bootstrapOrganization } from '../services/organizationSetupService';
import { processLogoImage } from '../services/imageProcessing';

interface OrganizationSetupProps {
    initialEmail: string;
    initialOwnerName?: string;
    onCompleted: (organizationName: string, logo?: string) => Promise<void> | void;
}

// Sugere "Empresa do {primeiro nome}" a partir do nome do dono. Sem nome
// utilizável, deixa vazio (o usuário digita; o botão fica travado até lá).
function suggestCompanyName(ownerName?: string) {
    const first = (ownerName || '').trim().split(/\s+/)[0] || '';
    if (!first || first.includes('@')) return '';
    const formatted = first.charAt(0).toUpperCase() + first.slice(1);
    return `Empresa do ${formatted}`;
}

// Iniciais da empresa para o avatar (logo provisória).
function getInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const OrganizationSetup: React.FC<OrganizationSetupProps> = ({
    initialEmail,
    initialOwnerName,
    onCompleted
}) => {
    const { signOut } = useAuth();
    const [companyName, setCompanyName] = useState(() => suggestCompanyName(initialOwnerName));
    const [ownerName, setOwnerName] = useState(initialOwnerName || '');
    const [phone, setPhone] = useState('');
    const [logo, setLogo] = useState('');
    const [logoLoading, setLogoLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setLogoLoading(true);
        setError(null);
        try {
            const optimized = await processLogoImage(file);
            setLogo(optimized);
        } catch (logoError) {
            setError(logoError instanceof Error ? logoError.message : 'Não foi possível usar essa imagem.');
        } finally {
            setLogoLoading(false);
        }
    };

    const canSubmit = useMemo(() => {
        return companyName.trim().length >= 2 && ownerName.trim().length >= 2 && !loading;
    }, [companyName, ownerName, loading]);

    const initials = useMemo(() => getInitials(companyName), [companyName]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!canSubmit) return;

        setLoading(true);
        setError(null);

        const result = await bootstrapOrganization({
            companyName: companyName.trim(),
            ownerName: ownerName.trim(),
            phone: phone.trim()
        });

        if (!result.success) {
            setError(result.error);
            setLoading(false);
            return;
        }

        (window as any).fbq?.('track', 'CompleteRegistration', {
            content_name: 'Onboarding Concluído',
            status: true
        });

        try {
            await onCompleted(result.organizationName, logo || undefined);
        } catch (completionError) {
            setError(
                completionError instanceof Error
                    ? completionError.message
                    : 'A empresa foi criada, mas não conseguimos atualizar a tela.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] w-full overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-3 py-3 sm:px-6 sm:py-6 lg:flex lg:items-center lg:justify-center lg:py-8">
            <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)] lg:rounded-[2rem]">
                <div className="flex flex-col px-5 py-6 sm:px-8 sm:py-10 sm:pb-[max(40px,env(safe-area-inset-bottom))]">
                    <div className="mb-5 flex flex-col items-center text-center sm:mb-7">
                        <div className="relative h-16 w-16">
                            <button
                                type="button"
                                onClick={() => logoInputRef.current?.click()}
                                disabled={logoLoading}
                                aria-label={logo ? 'Trocar logo' : 'Enviar logo'}
                                className="group flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-900 text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-wait"
                            >
                                {logo ? (
                                    <img src={logo} alt="Logo da empresa" className="h-full w-full object-contain" />
                                ) : initials ? (
                                    <span className="text-xl font-bold tracking-wide">{initials}</span>
                                ) : (
                                    <Building2 className="h-7 w-7" />
                                )}
                                <span className="absolute inset-0 flex items-center justify-center bg-slate-950/55 opacity-0 transition-opacity group-hover:opacity-100">
                                    {logoLoading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <ImagePlus className="h-5 w-5" />
                                    )}
                                </span>
                            </button>
                            {logo ? (
                                <button
                                    type="button"
                                    onClick={() => setLogo('')}
                                    aria-label="Remover logo"
                                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            ) : null}
                        </div>

                        <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={handleLogoChange}
                        />
                        <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={logoLoading}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
                        >
                            {logoLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <ImagePlus className="h-3.5 w-3.5" />
                            )}
                            {logo ? 'Trocar logo' : 'Enviar minha logo (opcional)'}
                        </button>
                        {!logo ? (
                            <p className="mt-0.5 text-[11px] text-slate-400">
                                Sem logo? Usamos as iniciais por enquanto.
                            </p>
                        ) : null}

                        <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                            Dados iniciais da empresa
                        </h2>
                        <p className="mt-1 max-w-sm text-sm leading-5 text-slate-500">
                            Esses dados aparecem nos seus orçamentos. Você poderá editar tudo depois em Configurações.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-1 flex-col space-y-4 sm:space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-900" htmlFor="setup-company-name">
                                Nome da empresa
                            </label>
                            <input
                                id="setup-company-name"
                                type="text"
                                value={companyName}
                                onChange={(event) => setCompanyName(event.target.value)}
                                placeholder="Ex: Películas Brasil"
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-900" htmlFor="setup-owner-name">
                                Seu nome
                            </label>
                            <input
                                id="setup-owner-name"
                                type="text"
                                value={ownerName}
                                onChange={(event) => setOwnerName(event.target.value)}
                                placeholder="Ex: Alex Lacerda"
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-900" htmlFor="setup-phone">
                                Telefone
                            </label>
                            <input
                                id="setup-phone"
                                type="tel"
                                value={phone}
                                onChange={(event) => setPhone(event.target.value)}
                                placeholder="(11) 11111-1111"
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-900" htmlFor="setup-email">
                                Email da conta
                            </label>
                            <input
                                id="setup-email"
                                type="email"
                                value={initialEmail}
                                disabled
                                className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none"
                            />
                        </div>

                        {error && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                {error}
                            </div>
                        )}

                        <div className="sticky bottom-0 -mx-5 mt-auto border-t border-slate-100 bg-white px-5 py-4 pt-4 sm:-mx-8 sm:px-8 sm:pb-[max(24px,env(safe-area-inset-bottom))]">
                            <div className="space-y-3">
                                <button
                                    type="submit"
                                    disabled={!canSubmit}
                                    className="flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {loading ? 'Criando empresa...' : 'Criar empresa e continuar'}
                                </button>

                                <button
                                    type="button"
                                    onClick={signOut}
                                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                                >
                                    Sair desta conta
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
