import React, { FormEvent, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { bootstrapOrganization } from '../services/organizationSetupService';

interface OrganizationSetupProps {
    initialEmail: string;
    initialOwnerName?: string;
    onCompleted: (organizationName: string) => Promise<void> | void;
}

function deriveCompanyName(email: string) {
    if (!email) return '';

    const localPart = email.split('@')[0] || '';
    if (!localPart) return '';

    return localPart
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .trim();
}

export const OrganizationSetup: React.FC<OrganizationSetupProps> = ({
    initialEmail,
    initialOwnerName,
    onCompleted
}) => {
    const { signOut } = useAuth();
    const [companyName, setCompanyName] = useState(() => deriveCompanyName(initialEmail));
    const [ownerName, setOwnerName] = useState(initialOwnerName || '');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canSubmit = useMemo(() => {
        return companyName.trim().length >= 2 && ownerName.trim().length >= 2 && !loading;
    }, [companyName, ownerName, loading]);

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

        try {
            await onCompleted(result.organizationName);
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
                    <div className="mb-5 flex items-center gap-3 sm:mb-8">
                        <div className="shrink-0 rounded-2xl bg-slate-100 p-2.5 text-slate-700 sm:p-3">
                            <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                                Dados iniciais da empresa
                            </h2>
                            <p className="text-sm leading-5 text-slate-500">
                                Você poderá editar tudo depois em Configurações.
                            </p>
                        </div>
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
