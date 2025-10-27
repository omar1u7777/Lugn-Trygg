import React from 'react';
import { motion } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  onClick?: () => void;
  delay?: number;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * StatCard - Display key metrics and statistics
 * Compact, consistent stat display with optional trend indicator
 */
const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  trendValue,
  color = 'primary',
  onClick,
  delay = 0,
  size = 'md',
}) => {
  const isClickable = !!onClick;
  const statClass = `stat-card stat-card--${color} stat-card--${size} ${isClickable ? 'stat-card--clickable' : ''}`;

  const trendIcon = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️';
  const trendClass = `stat-card__trend stat-card__trend--${trend || 'neutral'}`;

  return (
    <motion.div
      className={statClass}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={isClickable ? { scale: 1.02, y: -2 } : {}}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {/* Icon */}
      {icon && <div className="stat-card__icon">{icon}</div>}

      {/* Value */}
      <div className="stat-card__value">{value}</div>

      {/* Label */}
      <div className="stat-card__label">{label}</div>

      {/* Trend Indicator */}
      {trend && (
        <div className={trendClass}>
          <span className="stat-card__trend-icon">{trendIcon}</span>
          {trendValue && <span className="stat-card__trend-value">{trendValue}</span>}
        </div>
      )}
    </motion.div>
  );
};

export default StatCard;
