import React from 'react';
import { motion } from 'framer-motion';

interface ActionCardProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'gradient';
  disabled?: boolean;
  delay?: number;
  buttonText?: string;
}

/**
 * ActionCard - Call-to-action card with icon and button
 * Used for primary user actions in dashboard
 */
const ActionCard: React.FC<ActionCardProps> = ({
  title,
  description,
  icon,
  onClick,
  variant = 'primary',
  disabled = false,
  delay = 0,
  buttonText = 'Öppna',
}) => {
  const cardClass = `action-card action-card--${variant} ${disabled ? 'action-card--disabled' : ''}`;

  return (
    <motion.div
      className={cardClass}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={!disabled ? { y: -4, scale: 1.02 } : {}}
    >
      {/* Icon Circle */}
      <div className="action-card__icon-wrapper">
        <div className="action-card__icon">{icon}</div>
      </div>

      {/* Content */}
      <div className="action-card__content">
        <h3 className="action-card__title">{title}</h3>
        {description && <p className="action-card__description">{description}</p>}
      </div>

      {/* Button */}
      <button
        className="action-card__button btn-pro"
        onClick={onClick}
        disabled={disabled}
        aria-label={`${buttonText}: ${title}`}
      >
        <span className="action-card__button-icon">▶</span>
        <span className="action-card__button-text">{buttonText}</span>
      </button>
    </motion.div>
  );
};

export default ActionCard;
