import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { useAccessibility } from '../hooks/useAccessibility';
import { 
  CheckCircleIcon, 
  ExclamationCircleIcon, 
  ExclamationTriangleIcon, 
  StarIcon,
  HeartIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

interface MicroInteractionsProps {
  children: React.ReactNode;
}

// Heart animation for likes/favorites
const HeartAnimation = ({
  isActive,
  onClick,
  size = 24,
}: {
  isActive: boolean;
  onClick: () => void;
  size?: number;
}) => {
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
    <motion.button
      animate={controls}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={handleClick}
      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-full p-2"
      aria-label={isActive ? "Unlike" : "Like"}
    >
      <motion.div
        animate={isActive ? {
          scale: [1, 1.2, 1],
          rotate: [0, 10, -10, 0],
        } : {}}
        transition={{ duration: 0.5 }}
      >
        {isActive ? (
          <HeartIconSolid 
            className="text-error-500" 
            style={{ width: size, height: size }}
          />
        ) : (
          <HeartIcon 
            className="text-gray-500 dark:text-gray-400"
            style={{ width: size, height: size }}
          />
        )}
      </motion.div>
    </motion.button>
  );
};

// Success checkmark animation
const SuccessCheckmark = ({
  show,
  message = "Sparat!",
}: {
  show: boolean;
  message?: string;
}) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000]"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-xl flex flex-col items-center gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 500 }}
            >
              <CheckCircleIcon className="w-16 h-16 text-success-500" />
            </motion.div>
            <p className="text-xl font-bold text-success-600 dark:text-success-400">
              {message}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Loading dots animation
const LoadingDots = ({
  size = 'medium',
}: {
  size?: 'small' | 'medium' | 'large';
}) => {
  const sizeClasses = {
    small: 'w-1 h-1',
    medium: 'w-1.5 h-1.5',
    large: 'w-2 h-2',
  };

  const dotClass = sizeClasses[size];

  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={`${dotClass} rounded-full bg-gray-600 dark:bg-gray-400`}
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
    </div>
  );
};

// Pulse animation for notifications
const PulseNotification = ({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) => {
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
const StaggerContainer = ({
  children,
  staggerDelay = 0.1,
}: {
  children: React.ReactNode;
  staggerDelay?: number;
}) => {
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
      {children}
    </motion.div>
  );
};

// Hover lift effect
const HoverLift = ({
  children,
  liftAmount = 4,
}: {
  children: React.ReactNode;
  liftAmount?: number;
}) => {
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
const AnimatedProgressBar = ({
  value,
  maxValue,
  color = '#1976d2',
  height = 8,
  showPercentage = false,
}: {
  value: number;
  maxValue: number;
  color?: string;
  height?: number;
  showPercentage?: boolean;
}) => {
  const percentage = Math.min((value / maxValue) * 100, 100);

  return (
    <div>
      <div 
        className="w-full bg-gray-200 dark:bg-gray-700 overflow-hidden"
        style={{ height, borderRadius: height / 2 }}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
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
      </div>
      {showPercentage && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          {Math.round(percentage)}%
        </p>
      )}
    </div>
  );
};

// Button with micro-interactions
const InteractiveButton = ({
  children,
  onClick,
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'contained' | 'outlined' | 'text';
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
}) => {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    setIsClicked(true);
    onClick();
    setTimeout(() => setIsClicked(false), 150);
  };

  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg',
  };

  const variantClasses = {
    contained: {
      primary: 'bg-primary-600 hover:bg-primary-700 text-white',
      secondary: 'bg-secondary-600 hover:bg-secondary-700 text-white',
      success: 'bg-success-700 hover:bg-success-800 text-white',
      error: 'bg-error-600 hover:bg-error-700 text-white',
      warning: 'bg-warning-600 hover:bg-warning-700 text-white',
    },
    outlined: {
      primary: 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20',
      secondary: 'border-2 border-secondary-600 text-secondary-600 hover:bg-secondary-50 dark:hover:bg-secondary-900/20',
      success: 'border-2 border-success-600 text-success-600 hover:bg-success-50 dark:hover:bg-success-900/20',
      error: 'border-2 border-error-600 text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20',
      warning: 'border-2 border-warning-600 text-warning-600 hover:bg-warning-50 dark:hover:bg-warning-900/20',
    },
    text: {
      primary: 'text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20',
      secondary: 'text-secondary-600 hover:bg-secondary-50 dark:hover:bg-secondary-900/20',
      success: 'text-success-600 hover:bg-success-50 dark:hover:bg-success-900/20',
      error: 'text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20',
      warning: 'text-warning-600 hover:bg-warning-50 dark:hover:bg-warning-900/20',
    },
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      animate={isClicked ? { scale: 0.95 } : { scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      onClick={handleClick}
      disabled={disabled || loading}
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant][color]}
        font-medium rounded-lg transition-colors 
        focus:outline-none focus-visible:ring-2 focus-visible:ring-${color}-500 
        disabled:opacity-50 disabled:cursor-not-allowed
        relative overflow-hidden
        min-h-[44px]
      `}
    >
      {loading ? <LoadingDots size="small" /> : children}
    </motion.button>
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
const ToastNotification = ({
  message,
  type,
  show,
  onClose,
  autoHideDuration = 4000,
}: {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  show: boolean;
  onClose: () => void;
  autoHideDuration?: number;
}) => {
  const { announceToScreenReader } = useAccessibility();

  useEffect(() => {
    if (show) {
      announceToScreenReader(message, 'assertive');

      if (autoHideDuration > 0) {
        const timer = setTimeout(onClose, autoHideDuration);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [show, message, onClose, autoHideDuration, announceToScreenReader]);

  const getIcon = () => {
    const iconClass = {
      success: 'text-success-600 dark:text-success-400',
      error: 'text-error-600 dark:text-error-400',
      warning: 'text-warning-600 dark:text-warning-400',
      info: 'text-info-600 dark:text-info-400',
    };

    const Icon = {
      success: CheckCircleIcon,
      error: ExclamationCircleIcon,
      warning: ExclamationTriangleIcon,
      info: StarIcon,
    }[type];

    return <Icon className={`w-6 h-6 ${iconClass[type]}`} />;
  };

  const bgClass = {
    success: 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800',
    error: 'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800',
    warning: 'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800',
    info: 'bg-info-50 dark:bg-info-900/20 border-info-200 dark:border-info-800',
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: 300, scale: 0.3 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 300, scale: 0.5, transition: { duration: 0.2 } }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="fixed top-4 right-4 z-[1000] min-w-[300px] max-w-md"
          role="alert"
          aria-live="assertive"
        >
          <div className={`${bgClass[type]} border rounded-lg shadow-lg p-4`}>
            <div className="flex items-center gap-3">
              {getIcon()}
              <p className="text-sm text-gray-900 dark:text-white flex-1">
                {message}
              </p>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label="Close notification"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Page transition wrapper
const PageTransition = ({
  children,
  direction = 'right',
}: {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
}) => {
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
const MicroInteractions = ({ children }: MicroInteractionsProps) => {
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

