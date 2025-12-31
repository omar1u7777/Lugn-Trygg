/**
 * Predictive Analytics Dashboard Component
 * Shows mood predictions, trends, and crisis risk assessment
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  CalendarIcon,
  ChartBarIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import { predictiveService, MoodPrediction, CrisisRiskAssessment } from '../../services/predictiveService';
import { useAccessibility } from '../../hooks/useAccessibility';
import { ScreenReaderAnnouncer } from '../Accessibility/ScreenReader';

const PredictiveDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();

  const [predictions, setPredictions] = useState<MoodPrediction[]>([]);
  const [crisisRisk, setCrisisRisk] = useState<CrisisRiskAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d'>('7d');

  useEffect(() => {
    loadPredictiveData();
  }, []);

  const loadPredictiveData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load predictions
      const predictionResult = await predictiveService.getPredictions(7);
      if (predictionResult.success) {
        setPredictions(predictionResult.predictions);
        announceToScreenReader(`Laddade ${predictionResult.predictions.length} humörprediktioner`, 'polite');
      }

      // Load crisis risk assessment
      const crisisResult = await predictiveService.checkCrisisRisk();
      if (crisisResult.success) {
        setCrisisRisk(crisisResult.data);

        // Alert if high risk
        if (predictiveService.needsImmediateAttention(crisisResult.data)) {
          announceToScreenReader(
            'Varning: Hög risk för kris upptäckt. Överväg att kontakta professionell hjälp.',
            'assertive'
          );
        }
      }

    } catch (err) {
      console.error('Error loading predictive data:', err);
      setError('Kunde inte ladda prediktiva data');
      announceToScreenReader('Fel vid laddning av prediktiva data', 'assertive');
    } finally {
      setLoading(false);
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high':
        return <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />;
      case 'medium':
        return <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500" />;
      case 'low':
        return <HeartIcon className="w-6 h-6 text-green-500" />;
      default:
        return <HeartIcon className="w-6 h-6 text-gray-400" />;
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'improving':
        return <ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />;
      case 'declining':
        return <ArrowTrendingDownIcon className="w-5 h-5 text-red-500" />;
      default:
        return <ChartBarIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
          <div>
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-300">
              {t('predictive.error.title', 'Fel vid laddning')}
            </h3>
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ScreenReaderAnnouncer
        message="Prediktiv analys dashboard laddad"
        politeness="polite"
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <LightBulbIcon className="w-8 h-8 text-primary-500" />
            {t('predictive.title', 'Prediktiv Analys')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {t('predictive.subtitle', 'AI-driven insikter om ditt humör och välmående')}
          </p>
        </div>
        <button
          onClick={loadPredictiveData}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors duration-200"
          aria-label={t('predictive.refresh', 'Uppdatera data')}
        >
          {t('predictive.refresh', 'Uppdatera')}
        </button>
      </div>

      {/* Crisis Risk Alert */}
      {crisisRisk && predictiveService.needsImmediateAttention(crisisRisk) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-500 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-300">
                {t('predictive.crisis.highRisk', 'Hög Krishändelse Risk')}
              </h3>
              <p className="text-red-600 dark:text-red-400 mt-1">
                {t('predictive.crisis.recommendation', 'Vi rekommenderar att du kontaktar professionell hjälp omedelbart.')}
              </p>
              <div className="mt-3 space-y-1">
                {crisisRisk.recommendations.slice(0, 2).map((rec, index) => (
                  <p key={index} className="text-sm text-red-700 dark:text-red-300">
                    • {rec}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Mood Predictions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary-500" />
              {t('predictive.predictions.title', 'Kommande Dagar')}
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('predictive.confidence', 'Konfidens')}
            </span>
          </div>

          <div className="space-y-3">
            {predictions.slice(0, 7).map((prediction, index) => (
              <motion.div
                key={prediction.date}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: predictiveService.getMoodColor(prediction.mood_category) }}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {new Date(prediction.date).toLocaleDateString('sv-SE', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {predictiveService.formatMoodCategory(prediction.mood_category)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {predictiveService.formatConfidence(prediction.confidence)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Score: {prediction.predicted_score.toFixed(1)}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Crisis Risk Assessment */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              {getRiskIcon(crisisRisk?.risk_level || 'unknown')}
              {t('predictive.crisis.title', 'Krisrisk Utvärdering')}
            </h2>
            <span
              className="px-2 py-1 text-xs font-medium rounded-full"
              style={{
                backgroundColor: predictiveService.getRiskColor(crisisRisk?.risk_level || 'unknown') + '20',
                color: predictiveService.getRiskColor(crisisRisk?.risk_level || 'unknown')
              }}
            >
              {crisisRisk?.risk_level === 'high' && t('predictive.crisis.high', 'Hög')}
              {crisisRisk?.risk_level === 'medium' && t('predictive.crisis.medium', 'Medel')}
              {crisisRisk?.risk_level === 'low' && t('predictive.crisis.low', 'Låg')}
              {crisisRisk?.risk_level === 'unknown' && t('predictive.crisis.unknown', 'Okänd')}
            </span>
          </div>

          {crisisRisk && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('predictive.confidence', 'Konfidens')}:
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {predictiveService.formatConfidence(crisisRisk.confidence)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('predictive.crisis.analyzed', 'Analyserades')}:
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {crisisRisk.analyzed_entries} {t('predictive.entries', 'inlägg')}
                </span>
              </div>

              {crisisRisk.indicators.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {t('predictive.crisis.indicators', 'Riskindikatorer')}:
                  </h3>
                  <ul className="space-y-1">
                    {crisisRisk.indicators.map((indicator, index) => (
                      <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                        <span className="text-red-500 mt-1">•</span>
                        {indicator}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {crisisRisk.recommendations.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {t('predictive.crisis.recommendations', 'Rekommendationer')}:
                  </h3>
                  <ul className="space-y-1">
                    {crisisRisk.recommendations.slice(0, 3).map((rec, index) => (
                      <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                        <span className="text-green-500 mt-1">✓</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 lg:col-span-2"
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
            <ChartBarIcon className="w-5 h-5 text-primary-500" />
            {t('predictive.stats.title', 'Snabbstatistik')}
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {predictions.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {t('predictive.stats.predictions', 'Prediktioner')}
              </div>
            </div>

            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {predictions.filter(p => p.confidence > 0.7).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {t('predictive.stats.highConfidence', 'Hög Konfidens')}
              </div>
            </div>

            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {crisisRisk?.analyzed_entries || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {t('predictive.stats.analyzed', 'Analyserades')}
              </div>
            </div>

            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div
                className="text-2xl font-bold"
                style={{ color: predictiveService.getRiskColor(crisisRisk?.risk_level || 'unknown') }}
              >
                {crisisRisk?.risk_level === 'high' && 'H'}
                {crisisRisk?.risk_level === 'medium' && 'M'}
                {crisisRisk?.risk_level === 'low' && 'L'}
                {crisisRisk?.risk_level === 'unknown' && '?'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {t('predictive.stats.riskLevel', 'Risknivå')}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PredictiveDashboard;
