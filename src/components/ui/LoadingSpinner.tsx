import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3'
  };

  return (
    <div
      className={`${sizeClasses[size]} border-gray-300 border-t-[#2c8374] rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Laddar..."
    >
      <span className="sr-only">Laddar...</span>
    </div>
  );
};

export default LoadingSpinner;
