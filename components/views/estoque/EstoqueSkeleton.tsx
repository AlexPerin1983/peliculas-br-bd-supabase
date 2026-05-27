import React from 'react';
import { Skeleton } from '../../ui/Skeleton';

export const EstoqueSkeleton = () => (
    <div className="estoque-view flex flex-col gap-4 p-4">
        <div className="order-1 rounded-[24px] border border-slate-200/80 bg-white/96 p-3.5 shadow-[0_14px_32px_rgba(15,23,42,0.05)] sm:order-2 sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton variant="text" height={26} width="34%" />
                    <Skeleton variant="text" height={14} width="44%" />
                </div>
                <div className="flex gap-2">
                    <Skeleton variant="rounded" width={36} height={36} className="rounded-[13px]" />
                    <Skeleton variant="rounded" width={36} height={36} className="rounded-[13px]" />
                    <Skeleton variant="rounded" width={36} height={36} className="rounded-[13px] sm:hidden" />
                    <Skeleton variant="rounded" width={116} height={40} className="hidden rounded-[14px] sm:block" />
                </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4">
                <Skeleton variant="rounded" height={60} width="100%" className="rounded-[16px]" />
                <Skeleton variant="rounded" height={60} width="100%" className="rounded-[16px]" />
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 sm:hidden">
                <Skeleton variant="rounded" height={32} width={128} className="rounded-full" />
                <Skeleton variant="rounded" height={40} width={84} className="rounded-[12px]" />
            </div>

            <div className="mt-2 sm:hidden">
                <Skeleton variant="rounded" height={40} width="100%" className="rounded-[14px]" />
            </div>

            <div className="mt-4 hidden gap-3 sm:flex">
                <Skeleton variant="rounded" height={44} width="100%" className="rounded-[16px]" />
                <Skeleton variant="rounded" height={44} width={180} className="rounded-[16px]" />
                <Skeleton variant="rounded" height={42} width={88} className="rounded-[14px]" />
            </div>
        </div>

        <div className="order-2 overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/96 shadow-[0_14px_32px_rgba(15,23,42,0.05)] sm:order-3">
            {[1, 2, 3].map((item) => (
                <div key={item} className={`px-3.5 py-3.5 sm:px-5 sm:py-4 ${item > 1 ? 'border-t border-slate-200/80' : ''}`}>
                    <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton variant="text" height={20} width="42%" />
                                <Skeleton variant="text" height={13} width="58%" />
                                <Skeleton variant="text" height={13} width="44%" />
                            </div>
                            <div className="space-y-1 text-right">
                                <Skeleton variant="text" height={10} width={54} />
                                <Skeleton variant="text" height={20} width={56} />
                            </div>
                        </div>
                        <Skeleton variant="rounded" height={8} width="100%" className="rounded-full" />
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex-1">
                                <Skeleton variant="text" height={12} width="72%" />
                            </div>
                            <div className="flex gap-2">
                                <Skeleton variant="rounded" height={32} width={32} className="rounded-[12px]" />
                                <Skeleton variant="rounded" height={32} width={68} className="rounded-[12px]" />
                                <Skeleton variant="rounded" height={32} width={32} className="rounded-[12px]" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>

        <div className="order-3 sm:order-1">
            <div className="sm:hidden">
                <div className="flex gap-2 overflow-hidden">
                    {[1, 2, 3].map((item) => (
                        <div
                            key={item}
                            className="min-w-[138px] rounded-[18px] border border-slate-200/80 bg-white/96 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1 space-y-2">
                                    <Skeleton variant="text" height={10} width="70%" />
                                    <Skeleton variant="text" height={24} width="42%" />
                                </div>
                                <Skeleton variant="rounded" width={32} height={32} className="rounded-[12px]" />
                            </div>
                            <div className="mt-2">
                                <Skeleton variant="text" height={12} width="66%" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="hidden gap-2.5 sm:grid sm:grid-cols-2 xl:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                    <div
                        key={item}
                        className="rounded-[20px] border border-slate-200/80 bg-white/96 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton variant="text" height={12} width="48%" />
                                <Skeleton variant="text" height={28} width="34%" />
                                <Skeleton variant="text" height={14} width="56%" />
                            </div>
                            <Skeleton variant="rounded" width={40} height={40} className="rounded-[14px]" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export default EstoqueSkeleton;
