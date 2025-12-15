import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Login } from './Login';
import { PAYMENT_LINK } from '../constants';

// Componente de contador regressivo
const CountdownTimer: React.FC = () => {
    const [timeLeft, setTimeLeft] = useState({
        hours: 2,
        minutes: 47,
        seconds: 33
    });

    useEffect(() => {
        // Recupera ou cria o tempo de expiração no localStorage
        let expirationTime = localStorage.getItem('offer_expiration');

        if (!expirationTime) {
            // Cria expiração para 3 horas a partir de agora
            const expiration = Date.now() + (3 * 60 * 60 * 1000);
            localStorage.setItem('offer_expiration', expiration.toString());
            expirationTime = expiration.toString();
        }

        const calculateTimeLeft = () => {
            const now = Date.now();
            const expiration = parseInt(expirationTime!);
            const difference = expiration - now;

            if (difference <= 0) {
                // Reinicia o contador (para não ficar zerado para sempre)
                const newExpiration = Date.now() + (3 * 60 * 60 * 1000);
                localStorage.setItem('offer_expiration', newExpiration.toString());
                return { hours: 3, minutes: 0, seconds: 0 };
            }

            return {
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / (1000 * 60)) % 60),
                seconds: Math.floor((difference / 1000) % 60)
            };
        };

        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        setTimeLeft(calculateTimeLeft());

        return () => clearInterval(timer);
    }, []);

    const padNumber = (num: number) => num.toString().padStart(2, '0');

    return (
        <div className="flex justify-center gap-1.5 sm:gap-2 text-center">
            <div className="bg-red-600 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 min-w-[42px] sm:min-w-[50px]">
                <div className="text-xl sm:text-2xl font-bold text-white">{padNumber(timeLeft.hours)}</div>
                <div className="text-[8px] sm:text-[10px] text-red-200 uppercase">Horas</div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-red-500 self-center">:</div>
            <div className="bg-red-600 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 min-w-[42px] sm:min-w-[50px]">
                <div className="text-xl sm:text-2xl font-bold text-white">{padNumber(timeLeft.minutes)}</div>
                <div className="text-[8px] sm:text-[10px] text-red-200 uppercase">Min</div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-red-500 self-center">:</div>
            <div className="bg-red-600 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 min-w-[42px] sm:min-w-[50px]">
                <div className="text-xl sm:text-2xl font-bold text-white">{padNumber(timeLeft.seconds)}</div>
                <div className="text-[8px] sm:text-[10px] text-red-200 uppercase">Seg</div>
            </div>
        </div>
    );
};

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { session, loading, isApproved, signOut } = useAuth();

    if (loading) {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!session) {
        return <Login />;
    }

    if (!isApproved) {
        return (
            <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-y-auto">
                <div className="min-h-[100dvh] flex flex-col justify-center px-3 sm:px-4 py-4 sm:py-8">
                    <div className="max-w-lg w-full mx-auto">
                        {/* Badge de urgência */}
                        <div className="text-center mb-2 sm:mb-4">
                            <span className="inline-flex items-center gap-1.5 sm:gap-2 bg-red-600/20 border border-red-500/50 text-red-400 text-xs sm:text-sm font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full animate-pulse">
                                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full"></span>
                                ⚠️ OFERTA LIMITADA
                            </span>
                        </div>

                        <div className="bg-slate-800 rounded-xl sm:rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
                            {/* Header com desconto */}
                            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-3 sm:p-4 text-center">
                                <p className="text-green-100 text-xs sm:text-sm font-medium">🎉 Você está a 1 passo do acesso!</p>
                                <p className="text-white text-lg sm:text-xl font-bold">Condição de Lançamento por tempo Limitado</p>
                            </div>

                            <div className="p-4 sm:p-6 text-center">
                                {/* Contador */}
                                <div className="mb-4 sm:mb-6">
                                    <p className="text-slate-400 text-xs sm:text-sm mb-2 sm:mb-3">Esta oferta expira em:</p>
                                    <CountdownTimer />
                                </div>

                                {/* Preço */}
                                <div className="mb-4 sm:mb-6">
                                    <p className="text-slate-500 text-xs sm:text-sm mb-0.5">De:</p>
                                    <p className="text-slate-500 text-xl sm:text-2xl line-through">R$ 297,00</p>
                                    <p className="text-green-400 text-xs sm:text-sm mt-1.5 sm:mt-2 mb-0.5">Por apenas:</p>
                                    <div className="flex items-baseline justify-center gap-0.5 sm:gap-1">
                                        <span className="text-green-400 text-xl sm:text-2xl">R$</span>
                                        <span className="text-white text-5xl sm:text-6xl font-extrabold">39</span>
                                        <span className="text-green-400 text-base sm:text-lg">,00</span>
                                    </div>
                                    <p className="text-slate-400 text-xs sm:text-sm mt-1.5 sm:mt-2">Pagamento único • Sem assinatura • Válido por 1 ano</p>
                                </div>

                                {/* Benefícios */}
                                <div className="bg-slate-900/50 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 text-left">
                                    <p className="text-white font-bold text-xs sm:text-sm mb-2 sm:mb-3 text-center">✅ O que você vai receber:</p>
                                    <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                                        <li className="flex items-center gap-1.5 sm:gap-2 text-slate-300">
                                            <span className="text-green-500 shrink-0">✓</span> Calculadora de orçamentos profissional
                                        </li>
                                        <li className="flex items-center gap-1.5 sm:gap-2 text-slate-300">
                                            <span className="text-green-500 shrink-0">✓</span> Otimizador de corte (economize até 30%)
                                        </li>
                                        <li className="flex items-center gap-1.5 sm:gap-2 text-slate-300">
                                            <span className="text-green-500 shrink-0">✓</span> Gestão de clientes e películas
                                        </li>
                                        <li className="flex items-center gap-1.5 sm:gap-2 text-slate-300">
                                            <span className="text-green-500 shrink-0">✓</span> IA que lê medidas de áudio/texto
                                        </li>
                                        <li className="flex items-center gap-1.5 sm:gap-2 text-slate-300">
                                            <span className="text-green-500 shrink-0">✓</span> Gerador de PDF profissional
                                        </li>
                                        <li className="flex items-center gap-1.5 sm:gap-2 text-slate-300">
                                            <span className="text-green-500 shrink-0">✓</span> Atualizações vitalícias
                                        </li>
                                    </ul>
                                </div>

                                {/* CTA Principal */}
                                <a
                                    href={PAYMENT_LINK}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white text-base sm:text-lg font-bold py-3.5 sm:py-4 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all transform hover:scale-105 active:scale-95 shadow-xl shadow-green-600/30 mb-3 sm:mb-4"
                                >
                                    🔓 LIBERAR MEU ACESSO AGORA
                                </a>

                                {/* Garantia */}
                                <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-slate-400 text-[10px] sm:text-xs mb-2 sm:mb-4">
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span>Compra segura • Acesso imediato • Garantia 7 dias</span>
                                </div>

                                {/* Métodos de pagamento */}
                                <div className="flex items-center justify-center gap-3 sm:gap-4 text-slate-500 text-[10px] sm:text-xs">
                                    <span>Pix</span>
                                    <span>•</span>
                                    <span>Cartão</span>
                                    <span>•</span>
                                    <span>Boleto</span>
                                </div>
                            </div>

                            {/* Footer compacto */}
                            <div className="bg-slate-900/50 px-4 py-2.5 sm:py-3 text-center border-t border-slate-700">
                                <button
                                    onClick={signOut}
                                    className="text-slate-400 hover:text-white text-[10px] sm:text-xs font-medium transition-colors"
                                >
                                    Usar outra conta
                                </button>
                            </div>
                        </div>

                        {/* Texto de escassez adicional */}
                        <p className="text-center text-red-400 text-[10px] sm:text-xs mt-2 sm:mt-4 animate-pulse">
                            ⚡ 23 pessoas estão vendo esta oferta agora
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
