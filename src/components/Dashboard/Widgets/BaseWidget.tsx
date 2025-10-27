import React from 'react';
import { motion } from 'framer-motion';

interface BaseWidgetProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  error?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning';
  delay?: number;
  className?: string;
}

/**
 * BaseWidget - Foundation for all dashboard widgets
 * Provides consistent styling, loading states, and error handling
 */
const BaseWidget: React.FC<BaseWidgetProps> = ({
  title,
  subtitle,
  icon,
  loading = false,
  error,
  children,
  actions,
  size = 'md',
  variant = 'default',
  delay = 0,
  className = '',
}) => {
  const widgetClass = `base-widget base-widget--${size} base-widget--${variant} ${className}`;

  return (
    <motion.div
      className={widgetClass}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -2 }}
    >
      {/* Widget Header */}
      {(title || actions) && (
        <div className="base-widget__header">
          <div className="base-widget__header-content">
            {icon && <span className="base-widget__icon">{icon}</span>}
            <div className="base-widget__header-text">
              {title && <h3 className="base-widget__title">{title}</h3>}
              {subtitle && <p className="base-widget__subtitle">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="base-widget__actions">{actions}</div>}
        </div>
      )}

      {/* Widget Body */}
      <div className="base-widget__body">
        {/* Loading State */}
        {loading && (
          <div className="base-widget__loading">
            <div className="skeleton skeleton--card">
              <div className="skeleton__line skeleton__line--title"></div>
              <div className="skeleton__line skeleton__line--text"></div>
              <div className="skeleton__line skeleton__line--text"></div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="base-widget__error">
            <span className="base-widget__error-icon">⚠️</span>
            <p className="base-widget__error-text">{error}</p>
          </div>
        )}

        {/* Content */}
        {!loading && !error && children}
      </div>
    </motion.div>
  );
};

export default BaseWidget;
