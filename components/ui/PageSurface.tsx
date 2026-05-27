import React from 'react';

interface PageSurfaceProps {
    children: React.ReactNode;
    className?: string;
}

const PageSurface: React.FC<PageSurfaceProps> = ({ children, className = '' }) => {
    return (
        <section
            className={`ui-surface p-4 backdrop-blur-sm sm:p-5 ${className}`.trim()}
        >
            {children}
        </section>
    );
};

export default PageSurface;
