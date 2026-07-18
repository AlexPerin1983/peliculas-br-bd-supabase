import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ImagePlus, Loader2, Sparkles, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { bootstrapOrganization } from '../services/organizationSetupService';
import { processLogoImage } from '../services/imageProcessing';
import { formatBrazilianPhone, isValidBrazilianPhone } from '../src/lib/phone';

interface OrganizationSetupProps {
    initialEmail: string;
    initialOwnerName?: string;
    onCompleted: (organizationName: string, logo?: string) => Promise<void> | void;
}

const PREPARATION_STEPS = [
    'Criando sua empresa',
    'Configurando seu espaço de trabalho',
    'Preparando exemplos para você começar'
];

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
    // O nome comercial é uma informação importante do PDF. Deixamos em branco
    // para o dono informar a marca real, em vez de salvar um nome provisório.
    const [companyName, setCompanyName] = useState('');
    const [ownerName, setOwnerName] = useState(initialOwnerName || '');
    const [phone, setPhone] = useState('');
    const [phoneTouched, setPhoneTouched] = useState(false);
    const [logo, setLogo] = useState('');
    const [logoLoading, setLogoLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [preparationStep, setPreparationStep] = useState(0);
    const [isTakingLonger, setIsTakingLonger] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const phoneInputRef = useRef<HTMLInputElement>(null);
    const submissionInFlightRef = useRef(false);

    useEffect(() => {
        if (!loading) {
            setPreparationStep(0);
            setIsTakingLonger(false);
            return;
        }

        const workspaceTimer = window.setTimeout(() => setPreparationStep(1), 1400);
        const examplesTimer = window.setTimeout(() => setPreparationStep(2), 3600);
        const longerTimer = window.setTimeout(() => setIsTakingLonger(true), 10000);

        return () => {
            window.clearTimeout(workspaceTimer);
            window.clearTimeout(examplesTimer);
            window.clearTimeout(longerTimer);
        };
    }, [loading]);

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
        return companyName.trim().length >= 2
            && ownerName.trim().length >= 2
            && isValidBrazilianPhone(phone)
            && !loading;
    }, [companyName, ownerName, phone, loading]);

    const phoneIsInvalid = phoneTouched && !isValidBrazilianPhone(phone);
    const phoneErrorMessage = phone.trim()
        ? 'Informe um telefone válido com DDD.'
        : 'Informe seu telefone para continuar.';

    const initials = useMemo(() => getInitials(companyName), [companyName]);
    const highlightPhoneField = () => {
        setPhoneTouched(true);
        phoneInputRef.current?.focus();
        phoneInputRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (submissionInFlightRef.current) return;
        if (!isValidBrazilianPhone(phone)) {
            highlightPhoneField();
            return;
        }
        if (!canSubmit) return;

        submissionInFlightRef.current = true;
        setLoading(true);
        setError(null);
        try {
            const result = await bootstrapOrganization({
                companyName: companyName.trim(),
                ownerName: ownerName.trim(),
                phone: phone.trim()
            });

            if (!result.success) {
                setError(result.error);
                return;
            }

            setPreparationStep(PREPARATION_STEPS.length);
            await onCompleted(result.organizationName, logo || undefined);
        } catch (completionError) {
            setError(
                completionError instanceof Error
                    ? completionError.message
                    : 'A empresa foi criada, mas não conseguimos atualizar a tela.'
            );
        } finally {
            submissionInFlightRef.current = false;
            setLoading(false);
        }
    };

    if (loading) {
        const preparationFinished = preparationStep >= PREPARATION_STEPS.length;

        return (
            <div className="flex min-h-[100dvh] w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-8">
                <div
                    className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/80 bg-white px-6 py-9 shadow-[0_30px_80px_rgba(15,23,42,0.14)] sm:px-10 sm:py-11"
                    role="status"
                    aria-live="polite"
                >
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_14px_35px_rgba(15,23,42,0.25)]">
                        {preparationFinished ? (
                            <Check className="h-8 w-8" aria-hidden="true" />
                        ) : (
                            <Sparkles className="h-7 w-7 animate-pulse" aria-hidden="true" />
                        )}
                    </div>

                    <div className="mt-6 text-center">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                            {preparationFinished ? 'Tudo pronto!' : 'Preparando seu espaço'}
                        </h2>
                        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                            {preparationFinished
                                ? 'Seu painel está sendo aberto automaticamente.'
                                : `Estamos deixando a ${companyName.trim()} pronta para você começar.`}
                        </p>
                    </div>

                    <div className="mt-8 space-y-3" aria-label="Etapas da preparação">
                        {PREPARATION_STEPS.map((step, index) => {
                            const isComplete = preparationStep > index;
                            const isActive = preparationStep === index;

                            return (
                                <div
                                    key={step}
                                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-500 ${
                                        isActive
                                            ? 'border-sky-200 bg-sky-50 text-slate-950 shadow-sm'
                                            : isComplete
                                                ? 'border-emerald-100 bg-emerald-50/70 text-slate-700'
                                                : 'border-slate-100 bg-slate-50/70 text-slate-400'
                                    }`}
                                >
                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                        isActive
                                            ? 'bg-sky-600 text-white'
                                            : isComplete
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-200 text-slate-500'
                                    }`}>
                                        {isActive ? (
                                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                        ) : isComplete ? (
                                            <Check className="h-4 w-4" aria-hidden="true" />
                                        ) : (
                                            <span className="text-xs font-bold">{index + 1}</span>
                                        )}
                                    </span>
                                    <span className="text-sm font-semibold">{step}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-7 min-h-12 text-center">
                        {isTakingLonger && !preparationFinished ? (
                            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-medium leading-5 text-amber-800">
                                Está levando um pouco mais que o normal, mas continuamos preparando tudo. Não feche esta tela.
                            </p>
                        ) : (
                            <p className="text-xs text-slate-400">Você será levado ao painel automaticamente.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

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
                                Telefone <span aria-hidden="true" className="text-red-600">*</span>
                            </label>
                            <input
                                ref={phoneInputRef}
                                id="setup-phone"
                                type="tel"
                                value={phone}
                                onChange={(event) => setPhone(formatBrazilianPhone(event.target.value))}
                                onBlur={() => setPhoneTouched(true)}
                                placeholder="(11) 11111-1111"
                                inputMode="numeric"
                                autoComplete="tel-national"
                                maxLength={19}
                                required
                                aria-invalid={phoneIsInvalid}
                                aria-describedby="setup-phone-help"
                                className={`w-full rounded-2xl border px-4 py-3 text-slate-900 outline-none transition focus:bg-white ${phoneIsInvalid
                                    ? 'border-2 border-red-500 bg-red-50 ring-4 ring-red-100 focus:border-red-600 focus:ring-4 focus:ring-red-100'
                                    : 'border-slate-200 focus:border-slate-400 focus:ring-slate-200'
                                    }`}
                            />
                            <p
                                id="setup-phone-help"
                                role={phoneIsInvalid ? 'alert' : undefined}
                                className={`text-xs ${phoneIsInvalid ? 'font-medium text-red-600' : 'text-slate-500'}`}
                            >
                                {phoneIsInvalid
                                    ? phoneErrorMessage
                                    : 'Digite o DDD e o número. A formatação é automática.'}
                            </p>
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
                                    disabled={loading}
                                    onClick={(event) => {
                                        if (!isValidBrazilianPhone(phone)) {
                                            event.preventDefault();
                                            highlightPhoneField();
                                        }
                                    }}
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
