/**
 * Card Component - Lugn & Trygg Design System
 * Unified Material-UI card with consistent styling
 */

import React from 'react';
import { 
  Card as MuiCard, 
  CardProps as MuiCardProps, 
  CardContent, 
  CardHeader, 
  Typography 
} from '@mui/material';

export interface CardProps extends Omit<MuiCardProps, 'elevation'> {
  title?: string;
  subtitle?: string;
  elevation?: number;
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  elevation = 2,
  children,
  ...props
}) => {
  return (
    <MuiCard elevation={elevation} {...props}>
      {(title || subtitle) && (
        <CardHeader
          title={title ? <Typography variant="h6">{title}</Typography> : undefined}
          subheader={subtitle ? <Typography variant="body2" color="text.secondary">{subtitle}</Typography> : undefined}
        />
      )}
      {children && (
        <CardContent>
          {children}
        </CardContent>
      )}
    </MuiCard>
  );
};

export default Card;