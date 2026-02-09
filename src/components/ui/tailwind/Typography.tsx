import React from 'react';
import { cn } from '../../../utils/cn';

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body1' | 'body2' | 'caption' | 'overline';
  component?: keyof JSX.IntrinsicElements;
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'text.primary' | 'text.secondary';
  align?: 'left' | 'center' | 'right' | 'justify';
  textAlign?: 'left' | 'center' | 'right' | 'justify'; // MUI compatibility
  gutterBottom?: boolean;
  fontWeight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold';
  // MUI compatibility prop (ignored)
  sx?: any;
}

export const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  (
    {
      variant = 'body1',
      component,
      color,
      align,
      textAlign, // MUI compatibility
      gutterBottom,
      fontWeight,
      className,
      children,
      sx: _sx, // MUI prop - destructure to remove
      ...props
    },
    ref
  ) => {
    // Use textAlign as alias for align (MUI compatibility)
    const actualAlign = align || textAlign;
    // Map variants to HTML elements
    const elementMap = {
      h1: 'h1',
      h2: 'h2',
      h3: 'h3',
      h4: 'h4',
      h5: 'h5',
      h6: 'h6',
      body1: 'p',
      body2: 'p',
      caption: 'span',
      overline: 'span',
    };

    const Element = (component || elementMap[variant]) as keyof JSX.IntrinsicElements;

    // Variant styles
    const variantStyles = {
      h1: 'text-4xl md:text-5xl font-bold tracking-tight',
      h2: 'text-3xl md:text-4xl font-bold tracking-tight',
      h3: 'text-2xl md:text-3xl font-semibold',
      h4: 'text-xl md:text-2xl font-semibold',
      h5: 'text-lg md:text-xl font-medium',
      h6: 'text-base md:text-lg font-medium',
      body1: 'text-base',
      body2: 'text-sm',
      caption: 'text-xs',
      overline: 'text-xs uppercase tracking-wider',
    };

    // Color styles
    const colorStyles = {
      primary: 'text-primary-600 dark:text-primary-400',
      secondary: 'text-secondary-600 dark:text-secondary-400',
      success: 'text-success-600 dark:text-success-400',
      error: 'text-error-600 dark:text-error-400',
      warning: 'text-warning-600 dark:text-warning-400',
      'text.primary': 'text-gray-900 dark:text-gray-100',
      'text.secondary': 'text-gray-600 dark:text-gray-400',
    };

    // Alignment styles
    const alignStyles = {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
      justify: 'text-justify',
    };

    // Font weight styles
    const fontWeightStyles = {
      light: 'font-light',
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    };

    return React.createElement(
      Element,
      {
        ref,
        className: cn(
          variantStyles[variant],
          color && colorStyles[color],
          actualAlign && alignStyles[actualAlign],
          fontWeight && fontWeightStyles[fontWeight],
          gutterBottom && 'mb-4',
          className
        ),
        ...props,
      },
      children
    );
  }
);

Typography.displayName = 'Typography';
