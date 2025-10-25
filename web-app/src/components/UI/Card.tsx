/**
 * Card Component - Lugn & Trygg Design System
 * Consistent card styles with accessibility and theming support
 */

import React from 'react';
import { Card as MuiCard, CardProps as MuiCardProps, CardContent, CardHeader, Typography } from '@mui/material';

export interface CardProps {
  title?: string;
  subtitle?: string;
  elevation?: 'none' | 'low' | 'medium' | 'high';
  padding?: 'none' | 'small' | 'medium' | 'large';
  hover?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  elevation = 'low',
  padding = 'medium',
  hover = false,
  children,
  className = '',
  ...props
}) => {
  const getElevationClasses = () => {
    switch (elevation) {
      case 'none':
        return 'shadow-none';
      case 'medium':
        return 'shadow-md';
      case 'high':
        return 'shadow-lg';
      default:
        return 'shadow-sm';
    }
  };

  const getPaddingClasses = () => {
    switch (padding) {
      case 'none':
        return 'p-0';
      case 'small':
        return 'p-3';
      case 'large':
        return 'p-6';
      default:
        return 'p-4';
    }
  };

  const cardClasses = [
    'card',
    getElevationClasses(),
    getPaddingClasses(),
    hover ? 'hover:shadow-md transition-shadow duration-200' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <MuiCard className={cardClasses} {...props}>
      {(title || subtitle) && (
        <CardHeader
          title={title ? <Typography variant="h6" className="card-title">{title}</Typography> : undefined}
          subheader={subtitle ? <Typography variant="body2" className="text-gray-600">{subtitle}</Typography> : undefined}
          className="card-header"
        />
      )}
      <CardContent className="card-content">
        {children}
      </CardContent>
    </MuiCard>
  );
};

export default Card;