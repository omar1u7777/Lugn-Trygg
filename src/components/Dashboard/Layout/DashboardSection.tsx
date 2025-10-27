import React from 'react';
import { motion } from 'framer-motion';

interface DashboardSectionProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  span?: 1 | 2 | 3 | 4;
  delay?: number;
  className?: string;
  actions?: React.ReactNode;
}

/**
 * DashboardSection - Reusable section wrapper with title and content
 * Provides consistent spacing and optional animations
 */
const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  subtitle,
  icon,
  children,
  span = 1,
  delay = 0,
  className = '',
  actions,
}) => {
  const sectionClass = `dashboard-section dashboard-section--span-${span} ${className}`;

  return (
    <motion.section
      className={sectionClass}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      {/* Section Header */}
      {(title || actions) && (
        <div className="dashboard-section__header">
          <div className="dashboard-section__header-content">
            {icon && <span className="dashboard-section__icon">{icon}</span>}
            <div>
              {title && <h2 className="dashboard-section__title">{title}</h2>}
              {subtitle && <p className="dashboard-section__subtitle">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="dashboard-section__actions">{actions}</div>}
        </div>
      )}

      {/* Section Content */}
      <div className="dashboard-section__content">
        {children}
      </div>
    </motion.section>
  );
};

export default DashboardSection;
