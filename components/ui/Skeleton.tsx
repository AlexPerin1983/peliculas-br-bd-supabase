import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
    width?: string | number;
    height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    variant = 'text',
    width,
    height
}) => {
    const baseClasses = "animate-pulse bg-slate-200 dark:bg-slate-700";

    const variantClasses = {
        text: "rounded",
        circular: "rounded-full",
        rectangular: "rounded-none",
        rounded: "rounded-lg",
    };

    const style = {
        width: width,
        height: height,
    };

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            style={style}
        />
    );
};

export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
    return (
        <div className="space-y-4 w-full">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                    <Skeleton variant="circular" width={40} height={40} className="mr-4 flex-shrink-0" />
                    <div className="flex-grow space-y-2">
                        <Skeleton variant="text" height={16} width="60%" />
                        <Skeleton variant="text" height={12} width="40%" />
                    </div>
                    <Skeleton variant="rounded" width={24} height={24} className="ml-4" />
                </div>
            ))}
        </div>
    );
};

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
    return (
        <div className="space-y-4 w-full">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                        <Skeleton variant="text" height={20} width="50%" />
                        <Skeleton variant="text" height={20} width="20%" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton variant="text" height={14} width="100%" />
                        <Skeleton variant="text" height={14} width="80%" />
                    </div>
                </div>
            ))}
        </div>
    );
};
