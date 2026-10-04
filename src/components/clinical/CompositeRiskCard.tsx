import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import type { ComprehensiveRiskResult, RiskFactorDetail } from '../../api/clinical';
import { CRISIS_NUMBERS, CRISIS_TEL } from '../../config/crisisResources';

/**
 * The combined PHQ-9 / GAD-7 / mood risk card on /mood/assessment.
 *
 * The UI audit (S-2) found it classifying the user as "Akut risk" and then
 * offering nothing to do: no number, no link, just the two "new assessment"
 * buttons. Its factors were backend English ("Suicidal ideation: PHQ-9 Q9=3"),
 * and its action list included orders meant for a clinician ("remove means
 * self harm", "urgent referral psychiatry").
 *
 * Now a crisis result leads with the people to call, a severe or moderate one
 * with healthcare, factors are translated from codes, and only actions the
 * person can take themselves are listed.
 */

// Used only when talking to a backend that predates patient_interventions:
// the codes a patient can act on. Everything else is a clinician's decision.
const PATIENT_SAFE_INTERVENTIONS = new Set([
  'CONTACT_CRISIS_SUPPORT', 'CONTACT_HEALTHCARE', 'CREATE_SAFETY_PLAN', 'INVOLVE_FAMILY_SUPPORT',
  'DAILY_MOOD_TRACKING', 'BEHAVIORAL_ACTIVATION', 'SLEEP_HYGIENE_PROTOCOL', 'SLEEP_INTERVENTION',
  'SOCIAL_RECONNECTION', 'SELF_HELP_CBT_MODULES', 'LIFESTYLE_INTERVENTIONS', 'PREVENTIVE_MAINTENANCE',
]);

type AssessmentType = 'phq9' | 'gad7';

// Instrument names are not translated.
const INSTRUMENT_NAME: Record<AssessmentType, string> = { phq9: 'PHQ-9', gad7: 'GAD-7' };

interface CompositeRiskCardProps {
  risk: ComprehensiveRiskResult;
  severityColor: (severity: string) => string;
  onRetake: (type: AssessmentType) => void;
}

const CompositeRiskCard: React.FC<CompositeRiskCardProps> = ({ risk, severityColor, onRetake }) => {
  const { t, i18n } = useTranslation();
  const level = risk.composite_risk;

  const factorText = (detail: RiskFactorDetail): string => {
    const params: Record<string, unknown> = { ...detail.params };
    if (typeof params.severity === 'string') {
      params.severity = t(`clinicalAssessment.severity.${params.severity}`, { defaultValue: params.severity });
    }
    if (detail.code === 'NEGATIVE_STREAK') params.count = params.days;
    return t(`clinicalAssessment.factors.${detail.code}`, params);
  };

  const riskFactors = risk.risk_factor_details?.map(factorText) ?? risk.risk_factors;
  const protectiveFactors = risk.protective_factor_details?.map(factorText) ?? risk.protective_factors;
  const actions = risk.patient_interventions
    ?? risk.suggested_interventions.filter(code => PATIENT_SAFE_INTERVENTIONS.has(code));

  const formatDate = (value: string | undefined) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
  };

  const badgeSeverity = level === 'none' ? 'minimal' : level === 'crisis' ? 'severe' : level;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">
        {t('clinicalAssessment.compositeRisk.title')}
      </h3>
      <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium mb-4 ${severityColor(badgeSeverity)}`}>
        {t(`clinicalAssessment.compositeRisk.${level}`)}
      </div>

      {level === 'crisis' && (
        <section
          role="alert"
          className="mb-4 rounded-lg border-2 border-red-400 bg-red-50 dark:bg-red-900/30 dark:border-red-600 p-4"
        >
          <p className="font-semibold text-red-900 dark:text-red-100">
            {t('clinicalAssessment.compositeRisk.crisisTitle')}
          </p>
          <p className="mt-1 text-sm text-red-800 dark:text-red-200">
            {t('clinicalAssessment.compositeRisk.crisisText')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={CRISIS_TEL.emergency}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 min-h-[44px] text-sm font-semibold text-white hover:bg-red-700"
            >
              <PhoneIcon className="w-4 h-4" aria-hidden="true" />
              {t('clinicalAssessment.compositeRisk.callEmergency', { number: CRISIS_NUMBERS.emergency })}
            </a>
            <a
              href={CRISIS_TEL.suicideLine}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 min-h-[44px] text-sm font-semibold text-white hover:bg-rose-700"
            >
              <PhoneIcon className="w-4 h-4" aria-hidden="true" />
              {t('clinicalAssessment.compositeRisk.callSuicideLine', { number: CRISIS_NUMBERS.suicideLine })}
            </a>
            <Link
              to="/crisis"
              className="inline-flex items-center rounded-lg border border-red-400 px-4 py-2 min-h-[44px] text-sm font-medium text-red-800 dark:text-red-100 hover:bg-red-100 dark:hover:bg-red-900/50"
            >
              {t('clinicalAssessment.compositeRisk.openCrisisPage')}
            </Link>
          </div>
        </section>
      )}

      {(level === 'severe' || level === 'moderate') && (
        <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4">
          <p className="font-semibold text-amber-900 dark:text-amber-100">
            {t('clinicalAssessment.compositeRisk.careTitle')}
          </p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            {t('clinicalAssessment.compositeRisk.careText', { number: CRISIS_NUMBERS.healthcare })}
          </p>
          <a
            href={CRISIS_TEL.healthcare}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 min-h-[44px] text-sm font-semibold text-white hover:bg-amber-700"
          >
            <PhoneIcon className="w-4 h-4" aria-hidden="true" />
            {t('clinicalAssessment.compositeRisk.callHealthcare', { number: CRISIS_NUMBERS.healthcare })}
          </a>
        </section>
      )}

      {(risk.stale_assessments ?? []).map(stale => (
        <div
          key={stale.type}
          className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3 text-sm text-gray-700 dark:text-gray-300"
        >
          <p>
            {t('clinicalAssessment.compositeRisk.stale', {
              type: INSTRUMENT_NAME[stale.type],
              date: formatDate(stale.timestamp),
              days: risk.assessment_window_days ?? 30,
            })}
          </p>
          <button
            type="button"
            onClick={() => onRetake(stale.type)}
            className="mt-2 inline-flex items-center rounded-lg bg-teal-600 px-3 py-2 min-h-[44px] text-sm font-medium text-white hover:bg-teal-700"
          >
            {t('clinicalAssessment.compositeRisk.retake', { type: INSTRUMENT_NAME[stale.type] })}
          </button>
        </div>
      ))}

      {riskFactors.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{t('clinicalAssessment.compositeRisk.riskFactors')}</p>
          <ul className="space-y-1">
            {riskFactors.map((factor, i) => (
              <li key={i} className="text-xs text-orange-700 dark:text-orange-400 flex items-start gap-1.5">
                <ExclamationTriangleIcon className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" /> {factor}
              </li>
            ))}
          </ul>
        </div>
      )}
      {protectiveFactors.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{t('clinicalAssessment.compositeRisk.protectiveFactors')}</p>
          <ul className="space-y-1">
            {protectiveFactors.map((factor, i) => (
              <li key={i} className="text-xs text-green-700 dark:text-green-400 flex items-start gap-1.5">
                <CheckCircleIcon className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" /> {factor}
              </li>
            ))}
          </ul>
        </div>
      )}
      {actions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{t('clinicalAssessment.compositeRisk.interventions')}</p>
          <ul className="space-y-1">
            {actions.map(code => (
              <li key={code} className="text-xs text-indigo-700 dark:text-indigo-400 flex items-start gap-1.5">
                <InformationCircleIcon className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />
                {t(`clinicalAssessment.interventions.${code}`, {
                  defaultValue: code.replace(/_/g, ' ').toLowerCase(),
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CompositeRiskCard;
