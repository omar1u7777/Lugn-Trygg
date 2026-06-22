import React, { useState, useEffect, useCallback } from 'react';
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

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

interface Question {
  id: string;
  text: string;
}

const PHQ9_QUESTIONS: Question[] = [
  { id: 'little_interest',  text: 'Litet intresse eller glädje av att göra saker' },
  { id: 'feeling_down',     text: 'Känt dig nedstämd, deprimerad eller hopplös' },
  { id: 'sleep_problems',   text: 'Svårt att somna eller sova för mycket' },
  { id: 'feeling_tired',    text: 'Känt dig trött eller haft för liten energi' },
  { id: 'appetite',         text: 'Dålig aptit eller ätit för mycket' },
  { id: 'feeling_bad',      text: 'Känt dig dålig om dig själv eller att du svikit' },
  { id: 'concentration',    text: 'Svårt att koncentrera dig' },
  { id: 'moving_slowly',    text: 'Rört dig eller talat långsamt, eller varit rastlös' },
  { id: 'self_harm',        text: 'Tankar att du hellre ville vara död eller skada dig själv' },
];

const GAD7_QUESTIONS: Question[] = [
  { id: 'feeling_nervous',     text: 'Känt dig nervös, ängslig eller på helspänn' },
  { id: 'cant_control_worry',  text: 'Inte kunnat sluta oroa dig eller kontrollera oron' },
  { id: 'worrying_too_much',   text: 'Oroat dig för mycket för olika saker' },
  { id: 'trouble_relaxing',    text: 'Haft svårt att koppla av' },
  { id: 'restless',            text: 'Varit så rastlös att du haft svårt att sitta stilla' },
  { id: 'easily_annoyed',      text: 'Blivit lätt irriterad eller retlig' },
  { id: 'afraid',              text: 'Känt dig rädd som om något hemskt skulle hända' },
];

const RESPONSE_OPTIONS = [
  { value: 0, label: 'Inte alls',                   description: '0 poäng' },
  { value: 1, label: 'Flera dagar',                 description: '1 poäng' },
  { value: 2, label: 'Mer än hälften av dagarna',   description: '2 poäng' },
  { value: 3, label: 'Nästan varje dag',             description: '3 poäng' },
];

const SEVERITY_LABELS: Record<string, string> = {
  minimal:          'Minimal',
  mild:             'Lindrig',
  moderate:         'Medelsvår',
  moderately_severe:'Medelsvår–svår',
  severe:           'Svår',
};

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

function severityLabel(severity: string): string {
  return SEVERITY_LABELS[severity] ?? severity.replace('_', ' ');
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
  const [activeTab, setActiveTab] = useState<AssessmentType | 'history'>('phq9');
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [result, setResult] = useState<PHQ9Result | GAD7Result | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const [history, setHistory] = useState<AssessmentHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const questions = activeTab === 'phq9'
    ? PHQ9_QUESTIONS
    : activeTab === 'gad7'
      ? GAD7_QUESTIONS
      : [];

  // Guard division by zero — only relevant when questions.length > 0
  const answeredCount = Object.keys(responses).length;
  const progress = questions.length > 0 ? answeredCount / questions.length : 0;

  // ---------------------------------------------------------------------------
  // Load history
  // ---------------------------------------------------------------------------
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await getAssessmentHistory({ limit: 30 });
      setHistory(data.history ?? []);
    } catch (err) {
      logger.error('Assessment history load failed', err as Error);
      setHistoryError('Kunde inte hämta historik. Försök igen.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab, loadHistory]);

  // ---------------------------------------------------------------------------
  // Submit assessment
  // ---------------------------------------------------------------------------
  const calculateScore = async () => {
    const unanswered = questions.filter(q => responses[q.id] === undefined);
    if (unanswered.length > 0) {
      setAssessmentError(`Svara på alla frågor. ${unanswered.length} frågor kvar.`);
      return;
    }

    setLoading(true);
    setAssessmentError(null);
    try {
      const res = activeTab === 'phq9'
        ? await submitPHQ9(responses)
        : await submitGAD7(responses);
      setResult(res);
      setExpanded(false);
    } catch (e: unknown) {
      logger.error('Assessment submission failed', e as Error);
      setAssessmentError(e instanceof Error ? e.message : 'Ett fel uppstod vid beräkning.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Reset to a new assessment (same or different scale)
  // ---------------------------------------------------------------------------
  const resetAssessment = (tab: AssessmentType) => {
    setActiveTab(tab);
    setResponses({});
    setResult(null);
    setAssessmentError(null);
    setExpanded(true);
  };

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
          Klinisk självbedömning
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Validerade skalor för depression (PHQ-9) och ångest (GAD-7)
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
            {tab === 'phq9' ? 'PHQ-9 (Depression)' : 'GAD-7 (Ångest)'}
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
          Historik
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
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">PHQ-9 trend (senaste {phq9History.length})</p>
                    <Sparkline values={phq9History.map(e => e.total_score)} max={MAX_SCORE.phq9} className="text-violet-500" />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Senast: <strong className="text-gray-700 dark:text-gray-300">{lastEntry.total_score} p</strong>
                      {' — '}{severityLabel(lastEntry.severity ?? 'unknown')}
                    </p>
                  </div>
                );
              })()}
              {gad7History.length > 1 && (() => {
                const lastEntry = gad7History.at(-1);
                if (!lastEntry) return null;
                return (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">GAD-7 trend (senaste {gad7History.length})</p>
                    <Sparkline values={gad7History.map(e => e.total_score)} max={MAX_SCORE.gad7} className="text-teal-500" />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Senast: <strong className="text-gray-700 dark:text-gray-300">{lastEntry.total_score} p</strong>
                      {' — '}{severityLabel(lastEntry.severity ?? 'unknown')}
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
              Uppdatera
            </button>
          </div>

          <div className="space-y-3">
            {historyLoading && (
              <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400 text-sm">
                <ArrowPathIcon className="animate-spin w-4 h-4 mr-2" />
                Hämtar historik…
              </div>
            )}

            {!historyLoading && historyError && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400 flex items-center justify-between">
                <span>{historyError}</span>
                <button onClick={loadHistory} className="ml-3 underline text-xs min-h-[44px] min-w-[44px] px-2 py-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors">Försök igen</button>
              </div>
            )}

            {!historyLoading && !historyError && history.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">
                  Inga tidigare bedömningar hittades.
                </p>
                <button
                  onClick={() => resetAssessment('phq9')}
                  className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Gör din första PHQ-9
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
                      {entry.type === 'phq9' ? 'PHQ-9 Depression' : 'GAD-7 Ångest'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(entry.timestamp).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getSeverityColor(entry.severity)}`}>
                    {entry.total_score} p — {severityLabel(entry.severity)}
                  </span>
                  {entry.type === 'phq9' && (entry as AssessmentHistoryEntry).suicidal_ideation && (
                    <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                      <ExclamationTriangleIcon className="w-3 h-3" /> Risk
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
                Ny PHQ-9
              </button>
              <button onClick={() => resetAssessment('gad7')} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors">
                Ny GAD-7
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
              <span>Framsteg</span>
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
                  Under de senaste 2 veckorna, hur ofta har du besvärats av följande?
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
                      {idx + 1}. {q.text}
                      {q.id === 'self_harm' && (
                        <span className="ml-2 text-xs text-red-600 dark:text-red-400 font-normal">(Fråga om tankar på självskada)</span>
                      )}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {RESPONSE_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={() => setResponses(prev => ({ ...prev, [q.id]: option.value }))}
                          className={`p-2 rounded-lg text-left text-sm transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                            responses[q.id] === option.value
                              ? 'bg-teal-600 text-white ring-2 ring-teal-400'
                              : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <span className="font-medium">{option.label}</span>
                          <span className="text-xs opacity-75 block">{option.description}</span>
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
                      Beräknar…
                    </>
                  ) : (
                    <>
                      Beräkna resultat
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
                      <p className="text-sm opacity-75">Total poäng</p>
                      <p className="text-4xl font-bold">{result.total_score}</p>
                      <p className="text-xs opacity-60 mt-0.5">
                        max {activeTab === 'phq9' ? 27 : 21} poäng
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm opacity-75">Svårighetsgrad</p>
                      <p className="text-xl font-semibold">
                        {severityLabel(result.severity)}
                      </p>
                    </div>
                  </div>

                  {/* PHQ-9 suicidal ideation alert */}
                  {'suicidal_ideation' in result && result.suicidal_ideation && (
                    <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded-lg">
                      <div className="flex items-start gap-2">
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-700 dark:text-red-300 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-red-800 dark:text-red-200">⚠️ Omedelbar risk upptäckt</p>
                          <p className="text-sm text-red-700 dark:text-red-300">
                            Du angav tankar om att skada dig själv. Kontakta psykiatrisk akutmottagning eller ring{' '}
                            <a href="tel:112" className="font-bold underline">112</a> eller krisstöd{' '}
                            <a href="tel:90101" className="font-bold underline">90101</a> (dygnet runt).
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
                    Rekommendationer
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
                    {expanded ? 'Dölj frågor' : 'Visa frågor igen'}
                    {expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                  </button>
                  <div className="w-px bg-gray-200 dark:bg-gray-700" />
                  <button
                    onClick={() => { resetAssessment(activeTab as AssessmentType); }}
                    className="flex-1 py-3 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20
                             transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                    Gör ny bedömning
                  </button>
                  <div className="w-px bg-gray-200 dark:bg-gray-700" />
                  <button
                    onClick={() => setActiveTab('history')}
                    className="flex-1 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700
                             transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    Se historik
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
