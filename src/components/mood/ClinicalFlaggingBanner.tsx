/**
 * Clinical Flagging Banner Component
 * Displays warnings when concerning mood patterns are detected
 * Provides resources and professional support recommendations
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExclamationTriangleIcon, PhoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getClinicalFlags, type ClinicalFlagsResponse } from '../../api/moodAnalytics';
import { logger } from '../../utils/logger';

export const ClinicalFlaggingBanner: React.FC = () => {
  const { t } = useTranslation();
  const [flags, setFlags] = useState<ClinicalFlagsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadFlags();
  }, []);

  const loadFlags = async () => {
    try {
      setLoading(true);
      const result = await getClinicalFlags();
      setFlags(result);
    } catch (err) {
      logger.error('Failed to load clinical flags:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !flags || !flags.flagged || dismissed) {
    return null;
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
      case 'high':
        return 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 text-red-900 dark:text-red-100';
      case 'medium':
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-800 text-orange-900 dark:text-orange-100';
      default:
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100';
    }
  };

  const getRiskIcon = (level: string) => {
    return level === 'critical' || level === 'high' ? '🚨' : '⚠️';
  };

  return (
    <div className={`relative p-6 rounded-lg border-2 ${getRiskColor(flags.risk_level)} mb-6`}>
      {/* Dismiss Button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
        aria-label={t('common.dismiss', 'Stäng')}
      >
        <XMarkIcon className="w-5 h-5" />
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <span className="text-3xl">{getRiskIcon(flags.risk_level)}</span>
        <div className="flex-1">
          <h3 className="text-lg font-bold mb-1">
            {t('mood.clinical.alertTitle', 'Viktigt meddelande om ditt mående')}
          </h3>
          <p className="text-sm opacity-90">
            {t('mood.clinical.alertSubtitle', 'Vi har upptäckt mönster som kan behöva uppmärksamhet')}
          </p>
        </div>
      </div>

      {/* Flags */}
      <div className="space-y-3 mb-4">
        {flags.flags.map((flag, idx) => (
          <div key={idx} className="p-4 bg-white/50 dark:bg-black/20 rounded-lg">
            <h4 className="font-semibold mb-1">{flag.title}</h4>
            <p className="text-sm opacity-90">{flag.description}</p>
            {flag.date_range && (
              <p className="text-xs mt-2 opacity-75">
                {new Date(flag.date_range.start).toLocaleDateString('sv-SE')} - {new Date(flag.date_range.end).toLocaleDateString('sv-SE')}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {flags.recommendations && flags.recommendations.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm mb-2">
            {t('mood.clinical.recommendations', 'Rekommendationer')}:
          </h4>
          {flags.recommendations.map((rec, idx) => (
            <div key={idx} className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-current/20">
              <div className="flex items-start gap-2 mb-2">
                {rec.priority === 'high' && <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <h5 className="font-semibold mb-1">{rec.title}</h5>
                  <p className="text-sm opacity-90">{rec.description}</p>
                </div>
              </div>

              {/* Resources */}
              {rec.resources && rec.resources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-current/20">
                  <p className="text-xs font-semibold mb-2">
                    {t('mood.clinical.resources', 'Kontaktuppgifter')}:
                  </p>
                  <div className="space-y-2">
                    {rec.resources.map((resource, ridx) => (
                      <a
                        key={ridx}
                        href={resource.phone ? `tel:${resource.phone}` : '#'}
                        className="flex items-center gap-2 text-sm hover:underline"
                      >
                        <PhoneIcon className="w-4 h-4" />
                        <span className="font-medium">{resource.name}</span>
                        {resource.phone && (
                          <span className="font-mono">{resource.phone}</span>
                        )}
                        {resource.available && (
                          <span className="text-xs opacity-75">({resource.available})</span>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-current/20 text-xs opacity-75">
        <p>
          {t('mood.clinical.disclaimer', 'Detta är en automatisk analys baserad på dina humörloggningar. Vid akut kris, ring alltid 112 eller kontakta närmaste akutmottagning.')}
        </p>
      </div>
    </div>
  );
};
