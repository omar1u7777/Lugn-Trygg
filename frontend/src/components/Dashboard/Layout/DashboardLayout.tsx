import React from 'react';
import { motion } from 'framer-motion';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * DashboardLayout - Main container for dashboard pages
 * Provides consistent spacing, background, and animations
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <motion.div
      className="dashboard-layout"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container-custom">
        {children}
      </div>
    </motion.div>
  );
};

export default DashboardLayout;
