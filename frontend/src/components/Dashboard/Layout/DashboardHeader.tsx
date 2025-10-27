import React from 'react';
import { motion } from 'framer-motion';

interface DashboardHeaderProps {
  userName?: string;
  title?: string;
  subtitle?: string;
  streak?: number;
  showReminder?: boolean;
  reminderMessage?: string;
  children?: React.ReactNode;
}

/**
 * DashboardHeader - Consistent header for dashboard
 * Shows welcome message, user info, and optional reminder
 */
const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName = '',
  title,
  subtitle,
  streak,
  showReminder = false,
  reminderMessage,
  children,
}) => {
  return (
    <motion.header
      className="dashboard-header"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.1, duration: 0.5 }}
    >
      {/* Title Section */}
      {title && (
        <h1 className="dashboard-header__title">
          {title}
        </h1>
      )}

      {/* Subtitle with user name */}
      {subtitle && (
        <p className="dashboard-header__subtitle" aria-live="polite">
          {subtitle}
          {userName && (
            <span className="dashboard-header__username">{userName}</span>
          )}
        </p>
      )}

      {/* Streak Badge */}
      {streak !== undefined && streak > 0 && (
        <motion.div
          className="dashboard-header__streak"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <span className="dashboard-header__streak-icon">🔥</span>
          <span className="dashboard-header__streak-text">
            {streak} {streak === 1 ? 'dag' : 'dagar'} i rad!
          </span>
        </motion.div>
      )}

      {/* Reminder Message */}
      {showReminder && reminderMessage && (
        <motion.div
          className="dashboard-header__reminder"
          role="alert"
          aria-live="assertive"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          <span className="dashboard-header__reminder-icon">💡</span>
          <div className="dashboard-header__reminder-content">
            <strong className="dashboard-header__reminder-title">Påminnelse</strong>
            <p className="dashboard-header__reminder-text">{reminderMessage}</p>
          </div>
        </motion.div>
      )}

      {/* Custom children (e.g., widgets in header) */}
      {children && (
        <div className="dashboard-header__widgets">
          {children}
        </div>
      )}
    </motion.header>
  );
};

export default DashboardHeader;
