import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  InformationCircleIcon,
  ArrowRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import {
  submitPHQ9,
  submitGAD7,
  getAssessmentHistory,
  type PHQ9Result,
  type GAD7Result,
  type AssessmentHistoryEntry,
  type AssessmentType,
} from '../api/clinical';
import { logger } from '../utils/logger';
import { useMountedRef } from '../hooks/useMountedRef';

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

interface Question {
  id: string;
}

const PHQ9_QUESTIONS: Question[] = [
  { id: 'little_interest' },
  { id: 'feeling_down' },
  { id: 'sleep_problems' },
  { id: 'feeling_tired' },
  { id: 'appetite' },
  { id: 'feeling_bad' },
  { id: 'concentration' },
  { id: 'moving_slowly' },
  { id: 'self_harm' },
];

const GAD7_QUESTIONS: Question[] = [
  { id: 'feeling_nervous' },
  { id: 'cant_control_worry' },
  { id: 'worrying_too_much' },
  { id: 'trouble_relaxing' },
  { id: 'restless' },
  { id: 'easily_annoyed' },
  { id: 'afraid' },
];

const RESPONSE_VALUES = [0, 1, 2, 3];

// PHQ-9 max = 27; GAD-7 max = 21
const MAX_SCORE: Record<AssessmentType, number> = { phq9: 27, gad7: 21 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSeverityColor(severity: string): string {
  const map: Record<string, string> = {
    minimal:          'text-teal-700 bg-teal-50 dark:text-teal-300 dark:bg-teal-900/20',
    mild:             'text-indigo-700 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-900/20',
    moderate:         'text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-900/20',
    moderately_severe:'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/20',
    severe:           'text-red-800 bg-red-100 dark:text-red-200 dark:bg-red-900/40',
  };
  return map[severity] ?? 'text-gray-600 bg-gray-50 dark:text-gray-300 dark:bg-gray-800';
}

function severityLabel(severity: string, t: (key: string) => string): string {
  const key = `clinicalAssessment.severity.${severity}`;
  const label = t(key);
  return label !== key ? label : severity.replace('_', ' ');
}

/** Render a tiny SVG sparkline from an array of numeric values (0..max). */
function Sparkline({ values, max, className }: { values: number[]; max: number; className?: string }) {
  if (values.length < 2) return null;
  const w = 80, h = 24, pad = 2;
  const xs = values.map((_, i) => pad + (i / (values.length - 1)) * (w - pad * 2));
  const ys = values.map(v => h - pad - ((v / max) * (h - pad * 2)));
  return (
    <svg width={w} height={h} className={className} aria-hidden="true">
      <polyline points={xs.map((x, i) => `${x},${ys[i]}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2.5" fill="currentColor" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ClinicalAssessment: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isMountedRef = useMountedRef();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [activeTab, setActiveTab] = useState<AssessmentType | 'history'>('phq9');
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [result, setResult] = useState<PHQ9Result | GAD7Result | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const [history, setHistory] = useState<AssessmentHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Derive locale and question-text prefix from i18n language
  const locale = i18n.language === 'sv' ? 'sv-SE' : i18n.language === 'no' ? 'nb-NO' : 'en-US';
  const questionPrefix = activeTab === 'phq9' ? 'clinicalAssessment.phq9Questions' : 'clinicalAssessment.gad7Questions';
  const responseLabels = t('clinicalAssessment.responseOptions.labels', { returnObjects: true }) as string[];
  const responseDescriptions = t('clinicalAssessment.responseOptions.descriptions', { returnObjects: true }) as string[];

  const questions = useMemo(() => activeTab === 'phq9'
    ? PHQ9_QUESTIONS
    : activeTab === 'gad7'
      ? GAD7_QUESTIONS
      : [], [activeTab]);

  // Guard division by zero — only relevant when questions.length > 0
  const answeredCount = Object.keys(responses).length;
  const progress = questions.length > 0 ? answeredCount / questions.length : 0;

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Load history
  // ---------------------------------------------------------------------------
  const loadHistory = useCallback(async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await getAssessmentHistory({ limit: 30, signal });
      if (!isMountedRef.current) return;
      setHistory(data.history ?? []);
    } catch (err) {
      if (!isMountedRef.current || signal.aborted) return;
      logger.error('Assessment history load failed', err as Error);
      setHistoryError(t('clinicalAssessment.historyError'));
    } finally {
      if (isMountedRef.current) setHistoryLoading(false);
    }
  }, [t, isMountedRef]);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab, loadHistory]);

  // ---------------------------------------------------------------------------
  // Submit assessment
  // ---------------------------------------------------------------------------
  const calculateScore = useCallback(async () => {
    const unanswered = questions.filter(q => responses[q.id] === undefined);
    if (unanswered.length > 0) {
      setAssessmentError(t('clinicalAssessment.unansweredError', { count: unanswered.length }));
      return;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);
    setAssessmentError(null);
    try {
      const res = activeTab === 'phq9'
        ? await submitPHQ9(responses, signal)
        : await submitGAD7(responses, signal);
      if (!isMountedRef.current || signal.aborted) return;
      setResult(res);
      setExpanded(false);
    } catch (e: unknown) {
      if (!isMountedRef.current || signal.aborted) return;
      logger.error('Assessment submission failed', e as Error);
      setAssessmentError(e instanceof Error ? e.message : t('clinicalAssessment.genericError'));
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [questions, responses, activeTab, t, isMountedRef]);

  // ---------------------------------------------------------------------------
  // Reset to a new assessment (same or different scale)
  // ---------------------------------------------------------------------------
  const resetAssessment = useCallback((tab: AssessmentType) => {
    setActiveTab(tab);
    setResponses({});
    setResult(null);
    setAssessmentError(null);
    setExpanded(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Derived history stats for sparklines
  // ---------------------------------------------------------------------------
  const phq9History = history.filter(e => e.type === 'phq9').slice(0, 10).reverse();
  const gad7History = history.filter(e => e.type === 'gad7').slice(0, 10).reverse();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('clinicalAssessment.title')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('clinicalAssessment.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['phq9', 'gad7'] as AssessmentType[]).map(tab => (
          <button
            key={tab}
            onClick={() => resetAssessment(tab)}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors text-sm ${
              activeTab === tab
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {tab === 'phq9' ? t('clinicalAssessment.tabs.phq9') : t('clinicalAssessment.tabs.gad7')}
          </button>
        ))}
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors text-sm ${
            activeTab === 'history'
              ? 'bg-teal-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {t('clinicalAssessment.tabs.history')}
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* History tab                                                         */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'history' && (
        <div>
          {/* Sparkline summary cards */}
          {!historyLoading && !historyError && (phq9History.length > 1 || gad7History.length > 1) && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              {phq9History.length > 1 && (() => {
                const lastEntry = phq9History.at(-1);
                if (!lastEntry) return null;
                return (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{t('clinicalAssessment.phq9Trend', { count: phq9History.length })}</p>
                    <Sparkline values={phq9History.map(e => e.total_score)} max={MAX_SCORE.phq9} className="text-violet-500" />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {t('clinicalAssessment.latest')}: <strong className="text-gray-700 dark:text-gray-300">{lastEntry.total_score} {t('clinicalAssessment.points')}</strong>
                      {' — '}{severityLabel(lastEntry.severity ?? 'unknown', t)}
                    </p>
                  </div>
                );
              })()}
              {gad7History.length > 1 && (() => {
                const lastEntry = gad7History.at(-1);
                if (!lastEntry) return null;
                return (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{t('clinicalAssessment.gad7Trend', { count: gad7History.length })}</p>
                    <Sparkline values={gad7History.map(e => e.total_score)} max={MAX_SCORE.gad7} className="text-teal-500" />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {t('clinicalAssessment.latest')}: <strong className="text-gray-700 dark:text-gray-300">{lastEntry.total_score} {t('clinicalAssessment.points')}</strong>
                      {' — '}{severityLabel(lastEntry.severity ?? 'unknown', t)}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Refresh button */}
          <div className="flex justify-end mb-3">
            <button
              onClick={loadHistory}
              disabled={historyLoading}
              className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 hover:underline disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-3 h-3 ${historyLoading ? 'animate-spin' : ''}`} />
              {t('clinicalAssessment.refresh')}
            </button>
          </div>

          <div className="space-y-3">
            {historyLoading && (
              <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400 text-sm">
                <ArrowPathIcon className="animate-spin w-4 h-4 mr-2" />
                {t('clinicalAssessment.historyLoading')}
              </div>
            )}

            {!historyLoading && historyError && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400 flex items-center justify-between">
                <span>{historyError}</span>
                <button onClick={loadHistory} className="ml-3 underline text-xs min-h-[44px] min-w-[44px] px-2 py-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors">{t('clinicalAssessment.retry')}</button>
              </div>
            )}

            {!historyLoading && !historyError && history.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">
                  {t('clinicalAssessment.emptyHistory')}
                </p>
                <button
                  onClick={() => resetAssessment('phq9')}
                  className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors"
                >
                  {t('clinicalAssessment.firstPhq9')}
                </button>
              </div>
            )}

            {!historyLoading && history.map(entry => (
              <div
                key={entry.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl" aria-hidden="true">{entry.type === 'phq9' ? '🧠' : '😰'}</span>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {entry.type === 'phq9' ? t('clinicalAssessment.historyType.phq9') : t('clinicalAssessment.historyType.gad7')}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(entry.timestamp).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getSeverityColor(entry.severity)}`}>
                    {entry.total_score} {t('clinicalAssessment.points')} — {severityLabel(entry.severity, t)}
                  </span>
                  {entry.type === 'phq9' && (entry as AssessmentHistoryEntry).suicidal_ideation && (
                    <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                      <ExclamationTriangleIcon className="w-3 h-3" /> {t('clinicalAssessment.risk')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA to start new assessment */}
          {!historyLoading && history.length > 0 && (
            <div className="mt-6 flex gap-3 justify-center">
              <button onClick={() => resetAssessment('phq9')} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors">
                {t('clinicalAssessment.newPhq9')}
              </button>
              <button onClick={() => resetAssessment('gad7')} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors">
                {t('clinicalAssessment.newGad7')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Assessment UI — phq9 / gad7                                        */}
      {/* ------------------------------------------------------------------ */}
      {activeTab !== 'history' && (
        <>
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>{t('clinicalAssessment.progress')}</span>
              <span>{answeredCount} / {questions.length}</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-teal-600"
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {assessmentError && (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400"
              role="alert"
              aria-live="polite"
            >
              {assessmentError}
            </div>
          )}

          {/* Questions */}
          <AnimatePresence mode="wait">
            {expanded && (
              <motion.div
                key="questions"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                  {t('clinicalAssessment.instruction')}
                </p>

                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className={`rounded-lg p-4 shadow-sm border transition-colors ${
                      responses[q.id] !== undefined
                        ? 'bg-teal-50 dark:bg-teal-900/10 border-teal-200 dark:border-teal-700'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <p className="font-medium text-gray-900 dark:text-white mb-3 text-sm">
                      {idx + 1}. {t(`${questionPrefix}.${q.id}`)}
                      {q.id === 'self_harm' && (
                        <span className="ml-2 text-xs text-red-600 dark:text-red-400 font-normal">{t('clinicalAssessment.selfHarmNote')}</span>
                      )}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {RESPONSE_VALUES.map(value => (
                        <button
                          key={value}
                          onClick={() => setResponses(prev => ({ ...prev, [q.id]: value }))}
                          className={`p-2 rounded-lg text-left text-sm transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                            responses[q.id] === value
                              ? 'bg-teal-600 text-white ring-2 ring-teal-400'
                              : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <span className="font-medium">{responseLabels[value]}</span>
                          <span className="text-xs opacity-75 block">{responseDescriptions[value]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <button
                  onClick={calculateScore}
                  disabled={loading || answeredCount < questions.length}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 dark:disabled:bg-gray-600
                           text-white font-medium rounded-lg transition-colors flex items-center
                           justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      {t('clinicalAssessment.calculating')}
                    </>
                  ) : (
                    <>
                      {t('clinicalAssessment.calculate')}
                      <ArrowRightIcon className="w-5 h-5" />
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence>
            {result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Result header */}
                <div className={`p-6 ${getSeverityColor(result.severity)}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-75">{t('clinicalAssessment.totalScore')}</p>
                      <p className="text-4xl font-bold">{result.total_score}</p>
                      <p className="text-xs opacity-60 mt-0.5">
                        {t('clinicalAssessment.maxScore', { max: activeTab === 'phq9' ? 27 : 21 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm opacity-75">{t('clinicalAssessment.severityLabel')}</p>
                      <p className="text-xl font-semibold">
                        {severityLabel(result.severity, t)}
                      </p>
                    </div>
                  </div>

                  {/* PHQ-9 suicidal ideation alert */}
                  {'suicidal_ideation' in result && result.suicidal_ideation && (
                    <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded-lg">
                      <div className="flex items-start gap-2">
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-700 dark:text-red-300 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-red-800 dark:text-red-200">{t('clinicalAssessment.immediateRiskTitle')}</p>
                          <p className="text-sm text-red-700 dark:text-red-300">
                            {t('clinicalAssessment.immediateRiskText')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Interpretation */}
                <div className="p-5 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-gray-700 dark:text-gray-300 text-sm">{result.interpretation}</p>
                </div>

                {/* Recommendations */}
                <div className="px-5 pb-5">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2 text-sm">
                    <InformationCircleIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    {t('clinicalAssessment.recommendations')}
                  </h4>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action row */}
                <div className="border-t border-gray-200 dark:border-gray-700 flex">
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex-1 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700
                             transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    {expanded ? t('clinicalAssessment.hideQuestions') : t('clinicalAssessment.showQuestions')}
                    {expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                  </button>
                  <div className="w-px bg-gray-200 dark:bg-gray-700" />
                  <button
                    onClick={() => { resetAssessment(activeTab as AssessmentType); }}
                    className="flex-1 py-3 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20
                             transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                    {t('clinicalAssessment.newAssessment')}
                  </button>
                  <div className="w-px bg-gray-200 dark:bg-gray-700" />
                  <button
                    onClick={() => setActiveTab('history')}
                    className="flex-1 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700
                             transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    {t('clinicalAssessment.viewHistory')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default ClinicalAssessment;
