import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { setWellnessGoals, getDashboardSummary, getWellnessGoals } from '../../api/api';
import { analytics } from '../../services/analytics';
import { logger } from '../../utils/logger';

interface WellnessGoalsOnboardingProps {
  userId?: string;
  onComplete?: (goals: string[]) => void;
  onSkip?: () => void;
  initialGoals?: string[];
}

const WELLNESS_GOAL_OPTIONS = [
  { id: 'Hantera stress', label: 'Hantera stress', icon: '🍃', description: 'Tekniker för lugn och balans' },
  { id: 'Bättre sömn', label: 'Bättre sömn', icon: '😴', description: 'Sov djupare och vakna utvilad' },
  { id: 'Ökad fokusering', label: 'Ökad fokus', icon: '🎯', description: 'Skärp din koncentration' },
  { id: 'Mental klarhet', label: 'Mental klarhet', icon: '✨', description: 'Rensa tankarna' },
  { id: 'Mindfulness', label: 'Mindfulness', icon: '🧘', description: 'Bli mer närvarande' },
  { id: 'Ångesthantering', label: 'Ångesthantering', icon: '🛡️', description: 'Verktyg för trygghet' },
  { id: 'Emotionell balans', label: 'Emotionell balans', icon: '⚖️', description: 'Förstå dina känslor' },
  { id: 'Energi', label: 'Mer energi', icon: '⚡', description: 'Hitta din drivkraft' },
];

const WellnessGoalsOnboarding: React.FC<WellnessGoalsOnboardingProps> = ({
  userId,
  onComplete,
  onSkip,
  initialGoals = []
}) => {
  const { t } = useTranslation();
  const [selectedGoals, setSelectedGoals] = useState<string[]>(initialGoals);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialGoals.length > 0) setSelectedGoals(initialGoals);
  }, [initialGoals]);

  const toggleGoal = (goalId: string) => {
    setSelectedGoals(prev => {
      if (prev.includes(goalId)) {
        return prev.filter(g => g !== goalId);
      } else {
        if (prev.length < 3) {
          return [...prev, goalId];
        }
        return prev;
      }
    });
  };

  const handleSave = async () => {
    if (selectedGoals.length === 0) {
      setError('Välj minst ett mål för att fortsätta');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (userId) {
        await setWellnessGoals(userId, selectedGoals);
        // Refresh dashboard data
        await getDashboardSummary(userId, true);

        analytics.track('Wellness Goals Set', {
          userId,
          goals: selectedGoals,
          count: selectedGoals.length,
        });
      }

      if (onComplete) {
        onComplete(selectedGoals);
      }
    } catch (err: any) {
      logger.error('Failed to save goals:', err);
      setError('Kunde inte spara målen. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-8">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
          Vad vill du fokusera på?
        </h2>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
          Välj upp till 3 mål så anpassar vi din upplevelse för just dina behov.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {WELLNESS_GOAL_OPTIONS.map(goal => {
          const isSelected = selectedGoals.includes(goal.id);
          return (
            <button
              key={goal.id}
              onClick={() => toggleGoal(goal.id)}
              className={`
                relative p-6 rounded-[1.5rem] text-left transition-all duration-300 border-2
                ${isSelected
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-xl shadow-primary-500/10 scale-[1.02]'
                  : 'border-transparent bg-white dark:bg-slate-800 shadow-sm hover:shadow-md hover:scale-[1.02]'}
              `}
            >
              <div className="flex flex-col h-full">
                <span className="text-4xl mb-4 block filter drop-shadow-sm">{goal.icon}</span>
                <h3 className={`font-bold text-lg mb-1 ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
                  {goal.label}
                </h3>
                <p className={`text-sm ${isSelected ? 'text-primary-600/80 dark:text-primary-400/80' : 'text-gray-500 dark:text-gray-400'}`}>
                  {goal.description}
                </p>

                {isSelected && (
                  <div className="absolute top-4 right-4 text-primary-500 animate-fade-in">
                    <CheckCircleIcon className="w-6 h-6" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-8 text-center p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg max-w-md mx-auto">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        {onSkip && (
          <button
            onClick={onSkip}
            disabled={loading}
            className="w-full sm:w-auto px-8 py-3 text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            Hoppa över
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={loading || selectedGoals.length === 0}
          className={`
            w-full sm:w-auto px-10 py-3.5 rounded-xl font-bold text-white shadow-lg shadow-primary-500/30 transition-all
            ${loading || selectedGoals.length === 0
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-primary-600 to-indigo-600 hover:scale-105 hover:shadow-xl hover:shadow-primary-500/40'}
          `}
        >
          {loading ? 'Sparar...' : `Fortsätt (${selectedGoals.length}/3)`}
        </button>
      </div>
    </div>
  );
};

export default WellnessGoalsOnboarding;
