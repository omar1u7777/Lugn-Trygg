/**
 * Tag Selector Component
 * Multi-select tag system for mood logging
 * Enables correlation analysis between tags and mood scores
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface TagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  disabled?: boolean;
}

const PREDEFINED_TAGS = [
  { id: 'work', label: 'Arbete', emoji: '💼', color: 'blue' },
  { id: 'family', label: 'Familj', emoji: '👨‍👩‍👧', color: 'pink' },
  { id: 'friends', label: 'Vänner', emoji: '👥', color: 'purple' },
  { id: 'exercise', label: 'Träning', emoji: '🏃', color: 'green' },
  { id: 'sleep', label: 'Sömn', emoji: '😴', color: 'indigo' },
  { id: 'health', label: 'Hälsa', emoji: '🏥', color: 'red' },
  { id: 'stress', label: 'Stress', emoji: '😰', color: 'orange' },
  { id: 'relaxation', label: 'Avkoppling', emoji: '🧘', color: 'teal' },
  { id: 'social', label: 'Socialt', emoji: '🎉', color: 'yellow' },
  { id: 'alone', label: 'Ensam', emoji: '🚶', color: 'gray' },
  { id: 'nature', label: 'Natur', emoji: '🌳', color: 'emerald' },
  { id: 'creative', label: 'Kreativt', emoji: '🎨', color: 'violet' },
];

const COLOR_CLASSES = {
  blue: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  pink: 'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-700',
  purple: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
  green: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700',
  red: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
  orange: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
  teal: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
  gray: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
  violet: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700',
};

export const TagSelector: React.FC<TagSelectorProps> = ({
  selectedTags,
  onTagsChange,
  disabled = false
}) => {
  const { t } = useTranslation();
  const [customTag, setCustomTag] = useState('');

  const toggleTag = (tagId: string) => {
    if (disabled) return;
    
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter(t => t !== tagId));
    } else {
      if (selectedTags.length < 5) {
        onTagsChange([...selectedTags, tagId]);
      }
    }
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim().toLowerCase();
    if (!trimmed || selectedTags.length >= 5) return;
    
    if (!selectedTags.includes(trimmed)) {
      onTagsChange([...selectedTags, trimmed]);
    }
    setCustomTag('');
  };

  const removeTag = (tag: string) => {
    if (disabled) return;
    onTagsChange(selectedTags.filter(t => t !== tag));
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('mood.tags.label', 'Taggar (valfritt)')}
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            {selectedTags.length}/5
          </span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {t('mood.tags.description', 'Välj taggar för att analysera vad som påverkar ditt humör')}
        </p>

        {/* Predefined Tags */}
        <div className="flex flex-wrap gap-2 mb-3">
          {PREDEFINED_TAGS.map(tag => {
            const isSelected = selectedTags.includes(tag.id);
            const colorClass = COLOR_CLASSES[tag.color as keyof typeof COLOR_CLASSES];
            
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                disabled={disabled || (!isSelected && selectedTags.length >= 5)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                  border transition-all duration-200
                  ${isSelected 
                    ? `${colorClass} ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-gray-900` 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900
                `}
              >
                <span>{tag.emoji}</span>
                <span>{tag.label}</span>
                {isSelected && (
                  <XMarkIcon className="w-4 h-4 ml-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* Custom Tag Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
            placeholder={t('mood.tags.customPlaceholder', 'Egen tagg...')}
            disabled={disabled || selectedTags.length >= 5}
            maxLength={20}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     placeholder-gray-400 dark:placeholder-gray-500
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={addCustomTag}
            disabled={disabled || !customTag.trim() || selectedTags.length >= 5}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700
                     rounded-lg transition-colors duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            {t('mood.tags.add', 'Lägg till')}
          </button>
        </div>
      </div>

      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            {t('mood.tags.selected', 'Valda taggar')}:
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map(tag => {
              const predefinedTag = PREDEFINED_TAGS.find(t => t.id === tag);
              const colorClass = predefinedTag 
                ? COLOR_CLASSES[predefinedTag.color as keyof typeof COLOR_CLASSES]
                : COLOR_CLASSES.gray;
              
              return (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${colorClass}`}
                >
                  {predefinedTag && <span>{predefinedTag.emoji}</span>}
                  <span>{predefinedTag?.label || tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    disabled={disabled}
                    className="ml-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 transition-colors"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
