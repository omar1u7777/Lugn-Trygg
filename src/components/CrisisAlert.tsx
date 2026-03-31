import React from 'react';
import { useTranslation } from 'react-i18next';

interface CrisisAlertProps {
  isOpen: boolean;
  onClose: () => void;
  moodScore: number;
}

const CrisisAlert: React.FC<CrisisAlertProps> = ({ isOpen, onClose, moodScore }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const isSevere = moodScore < -0.5;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-red-600">
              {isSevere ? t('crisis.titleSevere') : t('crisis.titleMild')}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close crisis alert"
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-4 text-sm text-gray-700">
            <p>
              🚨 <strong>{t('crisis.importantInfo')}</strong> {t('crisis.infoText')}
            </p>
            <p className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-2 rounded">
              💡 <strong>{t('crisis.honestAdvice')}</strong> {t('crisis.adviceText')}
            </p>

            <div className="space-y-3">
              <div className="border-l-4 border-red-500 pl-4">
                <h3 className="font-semibold text-red-600">{t('crisis.line1Name')}</h3>
                <p className="text-xs text-gray-600 mb-2">
                  {t('crisis.line1Desc')}
                </p>
                <a
                  href="tel:90101"
                  className="inline-block bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm font-medium"
                >
                  📞 Ring 90101
                </a>
              </div>

              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-blue-600">{t('crisis.line2Name')}</h3>
                <p className="text-xs text-gray-600 mb-2">
                  {t('crisis.line2Desc')}
                </p>
                <a
                  href="tel:112"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  📞 Ring 112
                </a>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-green-600">{t('crisis.line3Name')}</h3>
                <p className="text-xs text-gray-600 mb-2">
                  {t('crisis.line3Desc')}
                </p>
                <a
                  href="tel:1177"
                  className="inline-block bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-medium"
                >
                  📞 Ring 1177
                </a>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="font-semibold text-purple-600">{t('crisis.line4Name')}</h3>
                <p className="text-xs text-gray-600 mb-2">
                  {t('crisis.line4Desc')}
                </p>
                <a
                  href="https://www.mind.se/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm font-medium"
                >
                  🌐 {t('crisis.visitWebsite', { site: 'Mind.se' })}
                </a>
              </div>

              <div className="border-l-4 border-orange-500 pl-4">
                <h3 className="font-semibold text-orange-600">{t('crisis.line5Name')}</h3>
                <p className="text-xs text-gray-600 mb-2">
                  {t('crisis.line5Desc')}
                </p>
                <a
                  href="tel:116111"
                  className="inline-block bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 text-sm font-medium mr-2"
                >
                  📞 Ring 116 111
                </a>
                <a
                  href="https://www.bris.se/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 text-sm font-medium"
                >
                  🌐 BRIS.se
                </a>
              </div>

              <div className="border-l-4 border-teal-500 pl-4">
                <h3 className="font-semibold text-teal-600">{t('crisis.line6Name')}</h3>
                <p className="text-xs text-gray-600 mb-2">
                  {t('crisis.line6Desc')}
                </p>
                <a
                  href="https://www.spes.se/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700 text-sm font-medium"
                >
                  🌐 SPES.se
                </a>
              </div>

              <div className="border-l-4 border-indigo-500 pl-4">
                <h3 className="font-semibold text-indigo-600">{t('crisis.line7Name')}</h3>
                <p className="text-xs text-gray-600 mb-2">
                  {t('crisis.line7Desc')}
                </p>
                <a
                  href="tel:08-7020020"
                  className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium"
                >
                  📞 Ring 08-702 00 20
                </a>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-4">
              <p className="text-xs text-yellow-800">
                <strong>{t('crisis.remember')}</strong> {t('crisis.reminder')}
              </p>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrisisAlert;
