import React from 'react';

interface DashboardGridProps {
  children: React.ReactNode;
  columns?: {
    mobile?: 1 | 2;
    tablet?: 2 | 3 | 4;
    desktop?: 2 | 3 | 4;
  };
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * DashboardGrid - Responsive grid system for dashboard content
 * Auto-adjusts columns based on screen size
 */
const DashboardGrid: React.FC<DashboardGridProps> = ({
  children,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 'md',
  className = '',
}) => {
  const gridClass = `dashboard-grid dashboard-grid--gap-${gap} dashboard-grid--mobile-${columns.mobile} dashboard-grid--tablet-${columns.tablet} dashboard-grid--desktop-${columns.desktop} ${className}`;

  return (
    <div className={gridClass}>
      {children}
    </div>
  );
};

export default DashboardGrid;
