import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { grantBulkConsents, mapFrontendConsentsToBackend } from '../../api/consent';
import { logger } from '../../utils/logger';
import { Dialog } from '../ui/tailwind/Dialog';
import { Button } from '../ui/tailwind/Button';
import { Alert } from '../ui/tailwind/Feedback';

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

// Build initial consents from configuration (pure function, called once)
const buildInitialConsents = (): Consents =>
  CONSENT_ITEMS.reduce((acc, item) => {
    acc[item.key] = item.defaultChecked;
    return acc;
  }, {} as Consents);

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
  const navigate = useNavigate();

  const [consents, setConsents] = useState<Consents>(buildInitialConsents);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens to prevent stale data from previous sessions
  useEffect(() => {
    if (isOpen) {
      setConsents(buildInitialConsents());
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

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
    } catch (err) {
      logger.error('Failed to save consent:', err);
      setError(getErrorMessage(err, t));
    } finally {
      setIsSubmitting(false);
    }
  }, [consents, t, onClose]);

  const handleCancel = useCallback(() => {
    // Navigate home via React Router instead of full page reload
    navigate('/');
  }, [navigate]);

  // Check if all required consents are given for submit button
  const canSubmit = !isSubmitting && CONSENT_ITEMS.every(item => !item.required || consents[item.key]);

  return (
    <Dialog
      open={isOpen}
      onClose={handleCancel}
      size="lg"
      titleId="consent-title"
    >
      <div className="p-6">
        <h2 id="consent-title" className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {t('consent.title')}
        </h2>

        <div className="space-y-6 text-sm text-gray-700 dark:text-gray-300">
          {/* Information sections */}
          <section>
            <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100">{t('consent.whatWeCollect')}</h3>
            <p>{t('consent.whatWeCollectText')}</p>
          </section>

          <section>
            <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100">{t('consent.howDataUsed')}</h3>
            <ul className="list-disc list-inside space-y-1">
              {Array.from({ length: 4 }, (_, i) => (
                <li key={i}>{t(`consent.howDataUsedList.${i}`)}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100">{t('consent.gdprRights')}</h3>
            <ul className="list-disc list-inside space-y-1">
              {Array.from({ length: 5 }, (_, i) => (
                <li key={i}>{t(`consent.gdprRightsList.${i}`)}</li>
              ))}
            </ul>
          </section>

          {/* Consent checkboxes */}
          <section className="space-y-4">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{t('consent.consentTitle')}</h3>

            <div className="space-y-3" role="group" aria-label={t('consent.consentTitle')}>
              {CONSENT_ITEMS.map(item => (
                <label key={item.key} className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consents[item.key]}
                    onChange={() => handleConsentChange(item.key)}
                    className="mt-1 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    aria-describedby={`${item.key}-desc`}
                  />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {t(item.labelKey)}
                      {item.required && <span className="text-error-500 ml-1">*</span>}
                    </span>
                    <p id={`${item.key}-desc`} className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {t(item.descKey)}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">{t('consent.requiredNote')}</p>
          </section>
        </div>

        {/* Error display */}
        {error && (
          <Alert
            id="consent-error"
            variant="error"
            role="alert"
            aria-live="assertive"
            className="mt-4"
          >
            {error}
          </Alert>
        )}

        {/* Action buttons */}
        <div className="flex space-x-4 mt-8">
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={isSubmitting}
            className="flex-1"
            aria-describedby={error ? 'consent-error' : undefined}
          >
            {isSubmitting ? t('consent.saving') : t('consent.acceptAndContinue')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleCancel}
          >
            {t('consent.cancel')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default ConsentModal;
