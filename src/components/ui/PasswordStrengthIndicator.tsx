import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CheckCircleIcon,
  XCircleIcon 
} from '@heroicons/react/24/outline';

interface PasswordRequirement {
  regex: RegExp;
  label: string;
  key: string;
}

interface PasswordStrengthIndicatorProps {
  password: string;
  showStrength?: boolean;
  className?: string;
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ 
  password, 
  showStrength = true,
  className = '' 
}) => {
  const { t } = useTranslation();

  const requirements: PasswordRequirement[] = [
    { 
      regex: /.{8,}/, 
      label: t('password.requirement.length', '8+ tecken'), 
      key: 'length' 
    },
    { 
      regex: /[A-Z]/, 
      label: t('password.requirement.uppercase', 'Stor bokstav'), 
      key: 'uppercase' 
    },
    { 
      regex: /[a-z]/, 
      label: t('password.requirement.lowercase', 'Liten bokstav'), 
      key: 'lowercase' 
    },
    { 
      regex: /\d/, 
      label: t('password.requirement.number', 'Siffra'), 
      key: 'number' 
    },
    { 
      regex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 
      label: t('password.requirement.special', 'Specialtecken'), 
      key: 'special' 
    }
  ];

  const metRequirements = requirements.filter(req => req.regex.test(password));
  const strength = metRequirements.length / requirements.length;

  const getStrengthColor = () => {
    if (strength === 0) return 'bg-gray-300';
    if (strength <= 0.4) return 'bg-red-500';
    if (strength <= 0.6) return 'bg-amber-500';
    if (strength <= 0.8) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthLabel = () => {
    if (strength === 0) return t('password.strength.empty', '');
    if (strength <= 0.4) return t('password.strength.weak', 'Svagt');
    if (strength <= 0.6) return t('password.strength.fair', 'OK');
    if (strength <= 0.8) return t('password.strength.good', 'Starkt');
    return t('password.strength.strong', 'Mycket starkt');
  };

  const getStrengthTextColor = () => {
    if (strength === 0) return 'text-gray-400';
    if (strength <= 0.4) return 'text-red-600';
    if (strength <= 0.6) return 'text-amber-600';
    if (strength <= 0.8) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (!showStrength && password.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Strength bar */}
      {showStrength && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('password.strength.label', 'Lösenordsstyrka')}
            </span>
            <span className={`text-sm font-medium ${getStrengthTextColor()}`}>
              {getStrengthLabel()}
            </span>
          </div>
          <div className="flex gap-1">
            {requirements.map((_, i) => (
              <div 
                key={i} 
                className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                  i < metRequirements.length ? getStrengthColor() : 'bg-gray-300 dark:bg-gray-600'
                }`} 
              />
            ))}
          </div>
        </div>
      )}

      {/* Requirements list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {requirements.map((req) => {
          const isMet = req.regex.test(password);
          return (
            <div 
              key={req.key} 
              className={`flex items-center gap-2 text-sm transition-colors duration-200 ${
                isMet ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {isMet ? (
                <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
              ) : (
                <XCircleIcon className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{req.label}</span>
            </div>
          );
        })}
      </div>

      {/* Helpful tips */}
      {password.length > 0 && strength < 1 && (
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            💡 {t('password.tip', 'Tips: Använd en mening eller kombinera ord för ett starkt men minnesvärt lösenord.')}
          </p>
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;
