import React, { useState, useEffect } from 'react';
import { Box, Button, Card, CardContent, Typography } from '@mui/material';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Favorite, ThumbUp, Star, CheckCircle, Error, Warning } from '@mui/icons-material';
import { useAccessibility } from '../hooks/useAccessibility';

interface MicroInteractionsProps {
  children: React.ReactNode;
}

// Heart animation for likes/favorites
const HeartAnimation: React.FC<{
  isActive: boolean;
  onClick: () => void;
  size?: number;
}> = ({ isActive, onClick, size = 24 }) => {
  const controls = useAnimation();

  const handleClick = async () => {
    onClick();
    if (!isActive) {
      await controls.start({
        scale: [1, 1.3, 1],
        transition: { duration: 0.3 }
      });
    }
  };

  return (
    <motion.div
      animate={controls}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
    >
      <motion.div
        animate={isActive ? {
          scale: [1, 1.2, 1],
          rotate: [0, 10, -10, 0],
        } : {}}
        transition={{ duration: 0.5 }}
      >
        <Favorite
          sx={{
            fontSize: size,
            color: isActive ? '#ff4081' : '#666',
            cursor: 'pointer'
          }}
          onClick={handleClick}
        />
      </motion.div>
    </motion.div>
  );
};

// Success checkmark animation
const SuccessCheckmark: React.FC<{
  show: boolean;
  message?: string;
}> = ({ show, message = "Sparat!" }) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
          }}
        >
          <Card sx={{ minWidth: 200, textAlign: 'center' }}>
            <CardContent>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 500 }}
              >
                <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
              </motion.div>
              <Typography variant="h6" color="success.main">
                {message}
              </Typography>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Loading dots animation
const LoadingDots: React.FC<{
  size?: 'small' | 'medium' | 'large';
}> = ({ size = 'medium' }) => {
  const sizes = {
    small: 4,
    medium: 6,
    large: 8,
  };

  const dotSize = sizes[size];

  return (
    <Box display="flex" alignItems="center" gap={0.5}>
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: '#666',
          }}
          animate={{
            y: [0, -10, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: index * 0.2,
          }}
        />
      ))}
    </Box>
  );
};

// Pulse animation for notifications
const PulseNotification: React.FC<{
  count: number;
  children: React.ReactNode;
}> = ({ count, children }) => {
  return (
    <motion.div
      animate={count > 0 ? {
        scale: [1, 1.1, 1],
        boxShadow: [
          '0 0 0 0 rgba(25, 118, 210, 0.4)',
          '0 0 0 10px rgba(25, 118, 210, 0)',
          '0 0 0 0 rgba(25, 118, 210, 0)'
        ]
      } : {}}
      transition={{
        duration: 2,
        repeat: count > 0 ? Infinity : 0,
        repeatDelay: 3
      }}
    >
      {children}
    </motion.div>
  );
};

// Stagger animation for lists
const StaggerContainer: React.FC<{
  children: React.ReactNode;
  staggerDelay?: number;
}> = ({ children, staggerDelay = 0.1 }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};

// Hover lift effect
const HoverLift: React.FC<{
  children: React.ReactNode;
  liftAmount?: number;
}> = ({ children, liftAmount = 4 }) => {
  return (
    <motion.div
      whileHover={{
        y: -liftAmount,
        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      {children}
    </motion.div>
  );
};

// Progress bar animation
const AnimatedProgressBar: React.FC<{
  value: number;
  maxValue: number;
  color?: string;
  height?: number;
  showPercentage?: boolean;
}> = ({ value, maxValue, color = '#1976d2', height = 8, showPercentage = false }) => {
  const percentage = Math.min((value / maxValue) * 100, 100);

  return (
    <Box sx={{ width: '100%', position: 'relative' }}>
      <Box
        sx={{
          width: '100%',
          height,
          bgcolor: 'grey.300',
          borderRadius: height / 2,
          overflow: 'hidden',
        }}
      >
        <motion.div
          style={{
            height: '100%',
            backgroundColor: color,
            borderRadius: height / 2,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </Box>
      {showPercentage && (
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            top: -20,
            right: 0,
            color: color,
            fontWeight: 'bold',
          }}
        >
          {Math.round(percentage)}%
        </Typography>
      )}
    </Box>
  );
};

// Button with micro-interactions
const InteractiveButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'contained' | 'outlined' | 'text';
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
}> = ({
  children,
  onClick,
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
}) => {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    setIsClicked(true);
    onClick();

    setTimeout(() => setIsClicked(false), 150);
  };

  return (
    <motion.div
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      animate={isClicked ? { scale: 0.95 } : { scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Button
        variant={variant}
        color={color}
        size={size}
        onClick={handleClick}
        disabled={disabled || loading}
        sx={{
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 0,
            height: 0,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            transition: 'width 0.6s, height 0.6s',
            transform: 'translate(-50%, -50%)',
          },
          '&:active::before': {
            width: '300px',
            height: '300px',
          },
        }}
      >
        {loading ? <LoadingDots /> : children}
      </Button>
    </motion.div>
  );
};

// Export all components
export {
  HeartAnimation,
  SuccessCheckmark,
  LoadingDots,
  PulseNotification,
  StaggerContainer,
  HoverLift,
  AnimatedProgressBar,
  InteractiveButton,
  ToastNotification,
  PageTransition,
};

// Toast notification with animation
const ToastNotification: React.FC<{
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  show: boolean;
  onClose: () => void;
  autoHideDuration?: number;
}> = ({ message, type, show, onClose, autoHideDuration = 4000 }) => {
  const { announceToScreenReader } = useAccessibility();

  useEffect(() => {
    if (show) {
      announceToScreenReader(message, 'assertive');

      if (autoHideDuration > 0) {
        const timer = setTimeout(onClose, autoHideDuration);
        return () => clearTimeout(timer);
      }
    }
  }, [show, message, onClose, autoHideDuration, announceToScreenReader]);

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle sx={{ color: 'success.main' }} />;
      case 'error': return <Error sx={{ color: 'error.main' }} />;
      case 'warning': return <Warning sx={{ color: 'warning.main' }} />;
      case 'info': return <Star sx={{ color: 'info.main' }} />;
      default: return <Star sx={{ color: 'info.main' }} />;
    }
  };

  const getColor = () => {
    switch (type) {
      case 'success': return 'success.main';
      case 'error': return 'error.main';
      case 'warning': return 'warning.main';
      case 'info': return 'info.main';
      default: return 'info.main';
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: 300, scale: 0.3 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 300, scale: 0.5, transition: { duration: 0.2 } }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 1000,
            minWidth: 300,
          }}
        >
          <Card sx={{ borderLeft: 4, borderColor: getColor() }}>
            <CardContent sx={{ py: 2, px: 3 }}>
              <Box display="flex" alignItems="center" gap={2}>
                {getIcon()}
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {message}
                </Typography>
                <Button size="small" onClick={onClose}>
                  ✕
                </Button>
              </Box>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Page transition wrapper
const PageTransition: React.FC<{
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
}> = ({ children, direction = 'right' }) => {
  const getInitialPosition = () => {
    switch (direction) {
      case 'left': return { x: -100, opacity: 0 };
      case 'right': return { x: 100, opacity: 0 };
      case 'up': return { y: -100, opacity: 0 };
      case 'down': return { y: 100, opacity: 0 };
      default: return { x: 100, opacity: 0 };
    }
  };

  return (
    <motion.div
      initial={getInitialPosition()}
      animate={{ x: 0, y: 0, opacity: 1 }}
      exit={getInitialPosition()}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </motion.div>
  );
};

// Main micro-interactions wrapper
const MicroInteractions: React.FC<MicroInteractionsProps> = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
};

export default MicroInteractions;