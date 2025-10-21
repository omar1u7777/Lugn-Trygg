import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/api';

interface ConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const ConsentModal: React.FC<ConsentModalProps> = ({ isOpen, onClose, userId }) => {
  const { t } = useTranslation();
  const [consents, setConsents] = useState({
    dataProcessing: true, // Required consent, default to true
    aiAnalysis: false,
    storage: true, // Required consent, default to true
    marketing: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConsentChange = (consentType: keyof typeof consents) => {
    setConsents(prev => ({
      ...prev,
      [consentType]: !prev[consentType]
    }));
  };

  const handleSubmit = async () => {
    // Require essential consents
    if (!consents.dataProcessing || !consents.storage) {
      alert(t('consent.requiredConsentError'));
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/auth/consent', {
        analytics_consent: consents.aiAnalysis,
        marketing_consent: consents.marketing,
        data_processing_consent: consents.dataProcessing
      });

      localStorage.setItem('consent_given', 'true');
      localStorage.setItem('consent_version', '1.0');
      onClose();
    } catch (error) {
      console.error('Failed to save consent:', error);
      alert(t('consent.saveError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {t('consent.title')}
          </h2>

          <div className="space-y-6 text-sm text-gray-700">
            <div>
              <h3 className="font-semibold text-lg mb-2">{t('consent.whatWeCollect')}</h3>
              <p>
                {t('consent.whatWeCollectText')}
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">{t('consent.howDataUsed')}</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>{t('consent.howDataUsedList.0')}</li>
                <li>{t('consent.howDataUsedList.1')}</li>
                <li>{t('consent.howDataUsedList.2')}</li>
                <li>{t('consent.howDataUsedList.3')}</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">{t('consent.gdprRights')}</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>{t('consent.gdprRightsList.0')}</li>
                <li>{t('consent.gdprRightsList.1')}</li>
                <li>{t('consent.gdprRightsList.2')}</li>
                <li>{t('consent.gdprRightsList.3')}</li>
                <li>{t('consent.gdprRightsList.4')}</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">{t('consent.consentTitle')}</h3>

              <div className="space-y-3">
                <label className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    checked={consents.dataProcessing}
                    onChange={() => handleConsentChange('dataProcessing')}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-medium">{t('consent.dataProcessing')} *</span>
                    <p className="text-xs text-gray-600 mt-1">
                      {t('consent.dataProcessingDesc')}
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    checked={consents.aiAnalysis}
                    onChange={() => handleConsentChange('aiAnalysis')}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-medium">{t('consent.aiAnalysis')}</span>
                    <p className="text-xs text-gray-600 mt-1">
                      {t('consent.aiAnalysisDesc')}
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    checked={consents.storage}
                    onChange={() => handleConsentChange('storage')}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-medium">{t('consent.storage')} *</span>
                    <p className="text-xs text-gray-600 mt-1">
                      {t('consent.storageDesc')}
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    checked={consents.marketing}
                    onChange={() => handleConsentChange('marketing')}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-medium">{t('consent.marketing')}</span>
                    <p className="text-xs text-gray-600 mt-1">
                      {t('consent.marketingDesc')}
                    </p>
                  </div>
                </label>
              </div>

              <p className="text-xs text-gray-500">
                {t('consent.requiredNote')}
              </p>
            </div>
          </div>

          <div className="flex space-x-4 mt-8">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !consents.dataProcessing || !consents.storage}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('consent.saving') : t('consent.acceptAndContinue')}
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {t('consent.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsentModal;