import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { grantBulkConsents, mapFrontendConsentsToBackend } from '../../api/consent';

// Define consent types for type safety and maintainability
const CONSENT_TYPES = {
  dataProcessing: 'dataProcessing',
  aiAnalysis: 'aiAnalysis',
  storage: 'storage',
  marketing: 'marketing',
  termsOfService: 'termsOfService',
  privacyPolicy: 'privacyPolicy',
} as const;

type ConsentType = typeof CONSENT_TYPES[keyof typeof CONSENT_TYPES];

interface Consents {
  [CONSENT_TYPES.dataProcessing]: boolean;
  [CONSENT_TYPES.aiAnalysis]: boolean;
  [CONSENT_TYPES.storage]: boolean;
  [CONSENT_TYPES.marketing]: boolean;
  [CONSENT_TYPES.termsOfService]: boolean;
  [CONSENT_TYPES.privacyPolicy]: boolean;
}

interface ConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Removed unused userId prop for cleaner interface
}

interface ConsentItem {
  key: ConsentType;
  labelKey: string;
  descKey: string;
  required: boolean;
  defaultChecked: boolean;
}

// Define consent items configuration for better maintainability
const CONSENT_ITEMS: ConsentItem[] = [
  {
    key: CONSENT_TYPES.termsOfService,
    labelKey: 'consent.termsOfService',
    descKey: 'consent.termsOfServiceDesc',
    required: true,
    defaultChecked: false,
  },
  {
    key: CONSENT_TYPES.privacyPolicy,
    labelKey: 'consent.privacyPolicy',
    descKey: 'consent.privacyPolicyDesc',
    required: true,
    defaultChecked: false,
  },
  {
    key: CONSENT_TYPES.dataProcessing,
    labelKey: 'consent.dataProcessing',
    descKey: 'consent.dataProcessingDesc',
    required: true,
    defaultChecked: false,
  },
  {
    key: CONSENT_TYPES.aiAnalysis,
    labelKey: 'consent.aiAnalysis',
    descKey: 'consent.aiAnalysisDesc',
    required: false,
    defaultChecked: false,
  },
  {
    key: CONSENT_TYPES.storage,
    labelKey: 'consent.storage',
    descKey: 'consent.storageDesc',
    required: true,
    defaultChecked: false,
  },
  {
    key: CONSENT_TYPES.marketing,
    labelKey: 'consent.marketing',
    descKey: 'consent.marketingDesc',
    required: false,
    defaultChecked: false,
  },
];

// Utility function for extracting error messages
const getErrorMessage = (error: unknown, t: (key: string) => string): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as any;
    if (axiosError.response?.data?.error) {
      return String(axiosError.response.data.error);
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return t('consent.saveError') || 'Kunde inte spara samtycke. Försök igen.';
};

const ConsentModal: React.FC<ConsentModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  // Initialize consents state from configuration
  const initialConsents = CONSENT_ITEMS.reduce((acc, item) => {
    acc[item.key] = item.defaultChecked;
    return acc;
  }, {} as Consents);

  const [consents, setConsents] = useState<Consents>(initialConsents);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize handlers to prevent unnecessary re-renders
  const handleConsentChange = useCallback((consentType: ConsentType) => {
    setConsents(prev => ({
      ...prev,
      [consentType]: !prev[consentType],
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    // Validate required consents
    const requiredConsents = CONSENT_ITEMS.filter(item => item.required);
    const missingRequired = requiredConsents.some(item => !consents[item.key]);

    if (missingRequired) {
      setError(t('consent.requiredConsentError') || 'Du måste godkänna nödvändiga samtycken för att fortsätta.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const backendConsents = mapFrontendConsentsToBackend(consents);
      await grantBulkConsents(backendConsents);

      // Store consent status in localStorage
      localStorage.setItem('consent_given', 'true');
      localStorage.setItem('consent_version', '1.0');
      onClose();
    } catch (error) {
      console.error('Failed to save consent:', error);
      setError(getErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  }, [consents, t, onClose]);

  const handleCancel = useCallback(() => {
    // Redirect to home instead of using onClose to ensure user exits the flow
    window.location.href = '/';
  }, []);

  if (!isOpen) return null;

  // Check if all required consents are given for submit button
  const canSubmit = !isSubmitting && CONSENT_ITEMS.every(item => !item.required || consents[item.key]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 id="consent-title" className="text-2xl font-bold text-gray-900 mb-4">
            {t('consent.title')}
          </h2>

          <div className="space-y-6 text-sm text-gray-700">
            {/* Information sections */}
            <section>
              <h3 className="font-semibold text-lg mb-2">{t('consent.whatWeCollect')}</h3>
              <p>{t('consent.whatWeCollectText')}</p>
            </section>

            <section>
              <h3 className="font-semibold text-lg mb-2">{t('consent.howDataUsed')}</h3>
              <ul className="list-disc list-inside space-y-1">
                {Array.from({ length: 4 }, (_, i) => (
                  <li key={i}>{t(`consent.howDataUsedList.${i}`)}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-lg mb-2">{t('consent.gdprRights')}</h3>
              <ul className="list-disc list-inside space-y-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <li key={i}>{t(`consent.gdprRightsList.${i}`)}</li>
                ))}
              </ul>
            </section>

            {/* Consent checkboxes */}
            <section className="space-y-4">
              <h3 className="font-semibold text-lg">{t('consent.consentTitle')}</h3>

              <form className="space-y-3">
                {CONSENT_ITEMS.map(item => (
                  <label key={item.key} className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={consents[item.key]}
                      onChange={() => handleConsentChange(item.key)}
                      className="mt-1"
                      aria-describedby={`${item.key}-desc`}
                    />
                    <div>
                      <span className="font-medium">
                        {t(item.labelKey)}
                        {item.required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                      <p id={`${item.key}-desc`} className="text-xs text-gray-600 mt-1">
                        {t(item.descKey)}
                      </p>
                    </div>
                  </label>
                ))}
              </form>

              <p className="text-xs text-gray-500">{t('consent.requiredNote')}</p>
            </section>
          </div>

          {/* Error display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md" role="alert">
              <p className="text-sm text-red-800 dark:text-red-300">
                <span className="mr-2" aria-hidden="true">⚠️</span>
                {error}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex space-x-4 mt-8">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-describedby={error ? 'error-message' : undefined}
            >
              {isSubmitting ? t('consent.saving') : t('consent.acceptAndContinue')}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
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
