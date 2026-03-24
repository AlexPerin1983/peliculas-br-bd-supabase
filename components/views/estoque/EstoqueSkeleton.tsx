import React from 'react';
import { Skeleton } from '../../ui/Skeleton';

export const EstoqueSkeleton = () => (
    <div className="estoque-view space-y-6 animate-pulse p-4">
        <div className="stats-bar grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
                <div key={i} className="stat-pill bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl flex items-center gap-4">
                    <Skeleton variant="circular" width={48} height={48} className="flex-shrink-0" />
                    <div className="stat-pill-content space-y-2 flex-grow">
                        <Skeleton variant="text" height={24} width="30%" />
                        <Skeleton variant="text" height={14} width="60%" />
                    </div>
                </div>
            ))}
        </div>

        <div className="estoque-header flex flex-col items-center gap-4">
            <div className="segmented-tabs bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl flex gap-1 w-full max-w-xs">
                <Skeleton variant="rounded" height={44} width="50%" className="rounded-xl" />
                <Skeleton variant="rounded" height={44} width="50%" className="rounded-xl" />
            </div>
            <Skeleton variant="rounded" height={52} width="100%" className="rounded-2xl bg-blue-500/20" />
        </div>

        <div className="management-toolbar space-y-4">
            <Skeleton variant="rounded" height={52} width="100%" className="rounded-2xl" />
            <div className="flex gap-3">
                <Skeleton variant="rounded" height={52} width="100%" className="rounded-2xl" />
                <div className="flex gap-2">
                    <Skeleton variant="rounded" height={52} width={52} className="rounded-2xl" />
                    <Skeleton variant="rounded" height={52} width={52} className="rounded-2xl" />
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 space-y-5 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div className="space-y-2 flex-grow">
                            <Skeleton variant="text" height={28} width="60%" />
                            <div className="flex items-center gap-2">
                                <Skeleton variant="circular" width={14} height={14} />
                                <Skeleton variant="text" height={16} width="40%" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Skeleton variant="rounded" height={24} width={50} className="rounded-full" />
                            <Skeleton variant="circular" width={32} height={32} />
                        </div>
                    </div>

                    <div className="py-6 flex flex-col items-center space-y-2 border-b border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-baseline gap-1">
                            <Skeleton variant="text" height={56} width={80} />
                            <Skeleton variant="text" height={24} width={20} />
                        </div>
                        <Skeleton variant="text" height={16} width="50%" />
                    </div>

                    <div className="space-y-5">
                        <div className="space-y-2">
                            <Skeleton variant="rounded" height={10} width="100%" className="rounded-full" />
                            <div className="flex justify-center">
                                <Skeleton variant="text" height={14} width="25%" />
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-center gap-2">
                            <Skeleton variant="rounded" height={32} width={90} className="rounded-full" />
                            <Skeleton variant="rounded" height={32} width={100} className="rounded-full" />
                            <Skeleton variant="rounded" height={32} width={80} className="rounded-full" />
                        </div>
                    </div>

                    <div className="pt-2">
                        <Skeleton variant="rounded" height={48} width="100%" className="rounded-xl" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export default EstoqueSkeleton;
