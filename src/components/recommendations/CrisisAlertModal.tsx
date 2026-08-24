import React from 'react';
import { useTranslation } from 'react-i18next';
import { CRISIS_NUMBERS, CRISIS_TEL } from '../../config/crisisResources';

export const CrisisAlertModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-lg max-w-md w-full p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">🚨</div>
          <h3 className="text-xl font-bold text-red-700 dark:text-red-300 mb-4">
            {t('recommendations.crisis.title', 'Vi är oroliga för din säkerhet')}
          </h3>
          <p className="text-red-600 dark:text-red-400 mb-6 text-sm">
            {t('recommendations.crisis.body', 'Det låter som att du kan behöva omedelbar hjälp. Du är inte ensam, och det finns människor som vill hjälpa dig.')}
          </p>

          <div className="space-y-3 mb-6">
            <a
              href="tel:112"
              className="block w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              {t('recommendations.crisis.callEmergency', '🚨 Ring 112 (Akut)')}
            </a>
            <a
              href={CRISIS_TEL.suicideLine}
              className="block w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              {t('recommendations.crisis.suicideHotline', { suicideLine: CRISIS_NUMBERS.suicideLine })}
            </a>
            <a
              href="tel:1177"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              {t('recommendations.crisis.healthcare', '🏥 Vårdguiden: 1177')}
            </a>
          </div>

          <p className="text-xs text-red-500 dark:text-red-400 mb-4">
            {t('recommendations.crisis.footer', 'Om du är i omedelbar fara, ring 112 genast. Hjälplinjer är konfidentiella och tillgängliga dygnet runt.')}
          </p>

          <button
            onClick={onClose}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm underline"
          >
            {t('recommendations.crisis.continue', 'Fortsätt med övningen (rekommenderas inte)')}
          </button>
        </div>
      </div>
    </div>
  );
};
