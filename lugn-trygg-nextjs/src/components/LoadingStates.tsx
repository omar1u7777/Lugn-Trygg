import React from 'react';
import { CircularProgress, Skeleton, Box, Typography } from '@mui/material';
//

interface LoadingProps {
  isLoading: boolean;
  children?: React.ReactNode;
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export const LoadingSpinner: React.FC<LoadingProps> = ({
  isLoading,
  children,
  message = 'Laddar...',
  size = 'medium',
}) => {
  if (!isLoading) return <>{children}</>;
  const sizeMap = { small: 30, medium: 50, large: 70 };
  return (
    <Box role="status" aria-live="polite" aria-atomic="true">
      <CircularProgress size={sizeMap[size]} aria-hidden="true" />
      {message && <Typography>{message}</Typography>}
    </Box>
  );
};

export const SkeletonLoader: React.FC<{
  count?: number;
  type?: 'text' | 'card' | 'list';
}> = ({ count = 3, type = 'text' }) => {
  const items = Array.from({ length: count });
  if (type === 'card') {
    return (
      <Box>
        {items.map((_, idx) => (
          <Box key={idx}>
            <Skeleton variant="rectangular" height={200} />
            <Skeleton variant="text" height={30} style={{ marginTop: '10px' }} />
            <Skeleton variant="text" height={20} style={{ marginTop: '5px' }} />
          </Box>
        ))}
      </Box>
    );
  }
  if (type === 'list') {
    return (
      <Box>
        {items.map((_, idx) => (
          <Box key={idx} style={{ display: 'flex', alignItems: 'center' }}>
            <Skeleton variant="circular" width={40} height={40} />
            <Box style={{ flex: 1, marginLeft: '10px' }}>
              <Skeleton variant="text" height={20} />
              <Skeleton variant="text" height={16} width="80%" />
            </Box>
          </Box>
        ))}
      </Box>
    );
  }
  return (
    <Box>
      {items.map((_, idx) => (
        <Skeleton key={idx} variant="text" height={20} style={{ marginBottom: '8px' }} />
      ))}
    </Box>
  );
};

export const LoadingOverlay: React.FC<LoadingProps> = ({
  isLoading,
  message = 'Bearbeitung...',
}) => {
  if (!isLoading) return null;
  return (
    <Box role="status" aria-live="polite" aria-atomic="true" aria-label={message} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box>
        <CircularProgress aria-hidden="true" />
        <Typography>{message}</Typography>
      </Box>
    </Box>
  );
};

export const PulseLoader: React.FC<{ size?: number }> = ({ size = 30 }) => {
  // No animation for SSR safety
  return (
    <Box style={{ width: size, height: size, background: '#e0e0e0', borderRadius: '50%' }} role="status" aria-label="Loading" aria-live="polite" />
  );
};

export const ProgressiveLoad: React.FC<{
  isLoading: boolean;
  children: React.ReactNode;
  skeletonCount?: number;
}> = ({ isLoading, children, skeletonCount = 3 }) => {
  if (isLoading) {
    return <SkeletonLoader count={skeletonCount} />;
  }
  return <>{children}</>;
};

export default {
  LoadingSpinner,
  SkeletonLoader,
  LoadingOverlay,
  PulseLoader,
  ProgressiveLoad,
};
