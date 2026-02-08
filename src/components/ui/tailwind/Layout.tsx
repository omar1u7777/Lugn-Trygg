import React from 'react';
import { cn } from '../../../utils/cn';

// Container - replaces MUI Container
interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  centered?: boolean;
}

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, maxWidth = 'xl', centered = true, children, ...props }, ref) => {
    const maxWidths = {
      sm: 'max-w-screen-sm',  // 640px
      md: 'max-w-screen-md',  // 768px
      lg: 'max-w-screen-lg',  // 1024px
      xl: 'max-w-screen-xl',  // 1280px
      '2xl': 'max-w-screen-2xl', // 1536px
      full: 'max-w-full',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'w-full px-4 sm:px-6 lg:px-8',
          maxWidths[maxWidth],
          centered && 'mx-auto',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Container.displayName = 'Container';

// Box - replaces MUI Box (just a flexible div wrapper)
interface BoxProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: keyof JSX.IntrinsicElements;
  // MUI compatibility props (ignored - just accepted for backward compatibility)
  display?: string;
  alignItems?: string;
  justifyContent?: string;
  flexDirection?: string;
  gap?: number | string;
  mb?: number;
  mt?: number;
  ml?: number;
  mr?: number;
  mx?: number;
  my?: number;
  p?: number;
  pt?: number;
  pb?: number;
  pl?: number;
  pr?: number;
  px?: number;
  py?: number;
  sx?: any;
}

export const Box = React.forwardRef<HTMLDivElement, BoxProps>(
  ({ 
    className, 
    as = 'div', 
    children,
    // MUI props - destructure to remove from DOM attributes
    display, // eslint-disable-line @typescript-eslint/no-unused-vars
    alignItems, // eslint-disable-line @typescript-eslint/no-unused-vars
    justifyContent, // eslint-disable-line @typescript-eslint/no-unused-vars
    flexDirection, // eslint-disable-line @typescript-eslint/no-unused-vars
    gap, // eslint-disable-line @typescript-eslint/no-unused-vars
    mb, mt, ml, mr, mx, my, // eslint-disable-line @typescript-eslint/no-unused-vars
    p, pt, pb, pl, pr, px, py, // eslint-disable-line @typescript-eslint/no-unused-vars
    sx, // eslint-disable-line @typescript-eslint/no-unused-vars
    ...props 
  }, ref) => {
    return React.createElement(
      as,
      {
        ref,
        className: cn(className),
        ...props
      },
      children
    );
  }
);

Box.displayName = 'Box';

// Stack - vertical or horizontal stack with spacing
interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'column';
  spacing?: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
}

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      className,
      direction = 'column',
      spacing = 4,
      align = 'stretch',
      justify = 'start',
      children,
      ...props
    },
    ref
  ) => {
    const directions = {
      row: 'flex-row',
      column: 'flex-col',
    };

    const alignments = {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
    };

    const justifications = {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
      around: 'justify-around',
    };

    // Convert spacing to gap class
    const gapClass = `gap-${spacing}`;

    return (
      <div
        ref={ref}
        className={cn(
          'flex',
          directions[direction],
          alignments[align],
          justifications[justify],
          gapClass,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Stack.displayName = 'Stack';

// Grid - CSS Grid layout
interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: number | { sm?: number; md?: number; lg?: number; xl?: number };
  gap?: number;
  // MUI compatibility props (ignored)
  container?: boolean;
  item?: boolean;
  spacing?: number;
  xs?: number | boolean;
  sm?: number | boolean;
  md?: number | boolean;
  lg?: number | boolean;
  xl?: number | boolean;
}

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  ({ 
    className, 
    cols = 1, 
    gap = 4, 
    children,
    // MUI props - destructure to remove from DOM
    container, // eslint-disable-line @typescript-eslint/no-unused-vars
    item, // eslint-disable-line @typescript-eslint/no-unused-vars
    spacing, // eslint-disable-line @typescript-eslint/no-unused-vars
    xs, sm, md, lg, xl, // eslint-disable-line @typescript-eslint/no-unused-vars
    ...props 
  }, ref) => {
    let gridCols = '';
    
    if (typeof cols === 'number') {
      gridCols = `grid-cols-${cols}`;
    } else {
      gridCols = [
        cols.sm && `sm:grid-cols-${cols.sm}`,
        cols.md && `md:grid-cols-${cols.md}`,
        cols.lg && `lg:grid-cols-${cols.lg}`,
        cols.xl && `xl:grid-cols-${cols.xl}`,
      ].filter(Boolean).join(' ');
    }

    const gapClass = `gap-${gap}`;

    return (
      <div
        ref={ref}
        className={cn('grid', gridCols, gapClass, className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Grid.displayName = 'Grid';
