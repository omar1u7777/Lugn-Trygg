/**
 * Circumplex Model Sliders
 * Bi-axial mood input: Valence (pleasantness) and Arousal (energy)
 * Based on Russell's Circumplex Model of Affect
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

interface CircumplexSlidersProps {
  valence: number;
  arousal: number;
  onValenceChange: (value: number) => void;
  onArousalChange: (value: number) => void;
  disabled?: boolean;
}

export const CircumplexSliders: React.FC<CircumplexSlidersProps> = ({
  valence,
  arousal,
  onValenceChange,
  onArousalChange,
  disabled = false
}) => {
  const { t } = useTranslation();

  const getValenceLabel = (value: number): string => {
    if (value <= 3) return t('mood.valence.unpleasant', 'Obehaglig');
    if (value <= 5) return t('mood.valence.neutral', 'Neutral');
    if (value <= 7) return t('mood.valence.pleasant', 'Behaglig');
    return t('mood.valence.veryPleasant', 'Mycket behaglig');
  };

  const getArousalLabel = (value: number): string => {
    if (value <= 3) return t('mood.arousal.calm', 'Lugn');
    if (value <= 5) return t('mood.arousal.moderate', 'Måttlig');
    if (value <= 7) return t('mood.arousal.energized', 'Energisk');
    return t('mood.arousal.excited', 'Upphetsad');
  };

  return (
    <div className="space-y-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="text-center mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
          {t('mood.circumplex.title', 'Circumplex Model')}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('mood.circumplex.description', 'Beskriv ditt känslotillstånd i två dimensioner')}
        </p>
      </div>

      {/* Valence Slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('mood.valence.label', 'Valens (Behaglig ↔ Obehaglig)')}
          </label>
          <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
            {valence}/10
          </span>
        </div>
        
        <input
          type="range"
          min="1"
          max="10"
          value={valence}
          onChange={(e) => onValenceChange(parseInt(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-gradient-to-r from-red-400 via-yellow-300 to-green-400 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(to right, 
              #f87171 0%, 
              #fbbf24 50%, 
              #4ade80 100%)`
          }}
        />
        
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{t('mood.valence.min', 'Obehaglig')}</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {getValenceLabel(valence)}
          </span>
          <span>{t('mood.valence.max', 'Behaglig')}</span>
        </div>
      </div>

      {/* Arousal Slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('mood.arousal.label', 'Arousal (Energi/Aktivering)')}
          </label>
          <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
            {arousal}/10
          </span>
        </div>
        
        <input
          type="range"
          min="1"
          max="10"
          value={arousal}
          onChange={(e) => onArousalChange(parseInt(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(to right, 
              #60a5fa 0%, 
              #c084fc 50%, 
              #fb923c 100%)`
          }}
        />
        
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{t('mood.arousal.min', 'Lugn')}</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {getArousalLabel(arousal)}
          </span>
          <span>{t('mood.arousal.max', 'Upphetsad')}</span>
        </div>
      </div>

      {/* Circumplex Quadrant Display */}
      <div className="mt-4 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('mood.circumplex.quadrant', 'Känslotillstånd')}
          </p>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {getCircumplexQuadrant(valence, arousal)}
          </p>
        </div>
      </div>
    </div>
  );
};

function getCircumplexQuadrant(valence: number, arousal: number): string {
  // High arousal (>5), High valence (>5) = Excited/Happy
  if (arousal > 5 && valence > 5) {
    return '😊 Glad & Energisk';
  }
  // High arousal (>5), Low valence (≤5) = Tense/Anxious
  if (arousal > 5 && valence <= 5) {
    return '😰 Spänd & Orolig';
  }
  // Low arousal (≤5), High valence (>5) = Calm/Relaxed
  if (arousal <= 5 && valence > 5) {
    return '😌 Lugn & Avslappnad';
  }
  // Low arousal (≤5), Low valence (≤5) = Sad/Depressed
  return '😔 Ledsen & Trött';
}
