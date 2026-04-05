import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  ExclamationTriangleIcon, 
  CheckCircleIcon, 
  ChevronDownIcon, 
  ChevronUpIcon,
  InformationCircleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import useAuth from '../hooks/useAuth';
import api from '../api/api';
import { logger } from '../utils/logger';

interface Question {
  id: string;
  text: string;
}

const PHQ9_QUESTIONS: Question[] = [
  { id: 'little_interest', text: 'Litet intresse eller glädje av att göra saker' },
  { id: 'feeling_down', text: 'Känt dig nedstämd, deprimerad eller hopplös' },
  { id: 'sleep_problems', text: 'Svårt att somna eller sova för mycket' },
  { id: 'feeling_tired', text: 'Känt dig trött eller haft för liten energi' },
  { id: 'appetite', text: 'Dålig aptit eller ätit för mycket' },
  { id: 'feeling_bad', text: 'Känt dig dålig om dig själv eller att du svikit' },
  { id: 'concentration', text: 'Svårt att koncentrera dig' },
  { id: 'moving_slowly', text: 'Rört dig eller talat långsamt, eller varit rastlös' },
  { id: 'self_harm', text: 'Tankar att du hellre ville vara död eller skada dig själv' },
];

const GAD7_QUESTIONS: Question[] = [
  { id: 'feeling_nervous', text: 'Känt dig nervös, ängslig eller på helspänn' },
  { id: 'cant_control_worry', text: 'Inte kunnat sluta oroa dig eller kontrollera oron' },
  { id: 'worrying_too_much', text: 'Oroat dig för mycket för olika saker' },
  { id: 'trouble_relaxing', text: 'Haft svårt att koppla av' },
  { id: 'restless', text: 'Varit så rastlös att du haft svårt att sitta stilla' },
  { id: 'easily_annoyed', text: 'Blivit lätt irriterad eller retlig' },
  { id: 'afraid', text: 'Känt dig rädd som om något hemskt skulle hända' },
];

const RESPONSE_OPTIONS = [
  { value: 0, label: 'Inte alls', description: '0 poäng' },
  { value: 1, label: 'Flera dagar', description: '1 poäng' },
  { value: 2, label: 'Mer än hälften av dagarna', description: '2 poäng' },
  { value: 3, label: 'Nästan varje dag', description: '3 poäng' },
];

interface AssessmentResult {
  score: number;
  severity: string;
  interpretation: string;
  questions_analyzed?: number;
  recommendations?: string[];
}

interface HistoryEntry {
  id: string;
  type: 'phq9' | 'gad7';
  total_score: number;
  severity: string;
  risk_level: string;
  timestamp: string;
}

export const ClinicalAssessment: React.FC = () => {
  const { t: _t } = useTranslation();
  const { user: _user } = useAuth();
  const [activeTab, setActiveTab] = useState<'phq9' | 'gad7' | 'history'>('phq9');
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const questions = activeTab === 'phq9' ? PHQ9_QUESTIONS : activeTab === 'gad7' ? GAD7_QUESTIONS : [];

  // Load history whenever the history tab is selected
  useEffect(() => {
    if (activeTab !== 'history') return;
    let mounted = true;
    setHistoryLoading(true);
    setHistoryError(null);
    api.get('/advanced-mood/assess/history')
      .then(res => {
        if (mounted && res.data?.success) {
          setHistory(res.data.data.history ?? []);
        }
      })
      .catch(err => {
        logger.error('Assessment history load failed', err as Error);
        if (mounted) setHistoryError('Kunde inte hämta historik');
      })
      .finally(() => { if (mounted) setHistoryLoading(false); });
    return () => { mounted = false; };
  }, [activeTab]);

  const handleResponse = (questionId: string, value: number) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const calculateScore = async () => {
    // Check all questions answered
    const unanswered = questions.filter(q => responses[q.id] === undefined);
    if (unanswered.length > 0) {
      setAssessmentError(`Svara på alla frågor. ${unanswered.length} kvar.`);
      return;
    }

    setLoading(true);
    setAssessmentError(null);
    try {
      const endpoint = activeTab === 'phq9' ? '/advanced-mood/assess/phq9' : '/advanced-mood/assess/gad7';
      const res = await api.post(endpoint, { responses });
      
      if (res.data?.success) {
        setResult(res.data.data);
        setExpanded(false);
      } else {
        setAssessmentError('Kunde inte beräkna resultatet. Försök igen.');
      }
    } catch (e: unknown) {
      logger.error('Assessment failed', e as Error);
      const errorMessage = e instanceof Error ? e.message : 'Ett fel uppstod vid beräkning.';
      setAssessmentError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      minimal: 'text-green-600 bg-green-50',
      mild: 'text-yellow-600 bg-yellow-50',
      moderate: 'text-orange-600 bg-orange-50',
      moderately_severe: 'text-red-600 bg-red-50',
      severe: 'text-red-700 bg-red-100',
    };
    return colors[severity] || 'text-gray-600 bg-gray-50';
  };

  const progress = Object.keys(responses).length / questions.length;

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Klinisk självbedömning
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Validerade skalor för depression (PHQ-9) och ångest (GAD-7)
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setActiveTab('phq9'); setResponses({}); setResult(null); }}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            activeTab === 'phq9'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          PHQ-9 (Depression)
        </button>
        <button
          onClick={() => { setActiveTab('gad7'); setResponses({}); setResult(null); }}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            activeTab === 'gad7'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          GAD-7 (Ångest)
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Historik
        </button>
      </div>

      {/* Progress Bar */}
      {/* History tab */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {historyLoading && (
            <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400 text-sm">
              <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Hämtar historik…
            </div>
          )}
          {!historyLoading && historyError && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
              {historyError}
            </div>
          )}
          {!historyLoading && !historyError && history.length === 0 && (
            <p className="text-center text-gray-400 dark:text-gray-500 py-12 text-sm">
              Inga tidigare bedömningar hittades. Gör en PHQ-9 eller GAD-7 för att börja spåra din utveckling.
            </p>
          )}
          {!historyLoading && history.map(entry => (
            <div
              key={entry.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{entry.type === 'phq9' ? '🧠' : '😰'}</span>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white text-sm">
                    {entry.type === 'phq9' ? 'PHQ-9 Depression' : 'GAD-7 Ångest'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(entry.timestamp).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getSeverityColor(entry.severity)}`}>
                  {entry.total_score} p — {entry.severity.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assessment UI — only for phq9/gad7 tabs */}
      {activeTab !== 'history' && (<>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Framsteg</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-indigo-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {assessmentError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert" aria-live="polite">
          {assessmentError}
        </div>
      )}

      {/* Questions */}
      <AnimatePresence mode="wait">
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700"
              >
                <p className="font-medium text-gray-900 dark:text-white mb-3">
                  {idx + 1}. {q.text}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {RESPONSE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleResponse(q.id, option.value)}
                      className={`p-2 rounded-lg text-left text-sm transition-colors ${
                        responses[q.id] === option.value
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs opacity-75 block">{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Submit Button */}
            <button
              onClick={calculateScore}
              disabled={loading || Object.keys(responses).length < questions.length}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 
                       text-white font-medium rounded-lg transition-colors flex items-center 
                       justify-center gap-2"
            >
              {loading ? 'Beräknar...' : 'Beräkna resultat'}
              <ArrowRightIcon className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 
                     dark:border-gray-700 overflow-hidden"
          >
            {/* Result Header */}
            <div className={`p-6 ${getSeverityColor(result.severity)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-75">Total poäng</p>
                  <p className="text-3xl font-bold">{result.total_score}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-75">Svårighetsgrad</p>
                  <p className="text-xl font-semibold capitalize">
                    {result.severity.replace('_', ' ')}
                  </p>
                </div>
              </div>
              
              {result.suicidal_ideation && (
                <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">⚠️ Omedelbar risk upptäckt</p>
                      <p className="text-sm text-red-700">
                        Kontakta psykiatrisk akutmottagning eller ring 112
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Interpretation */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-gray-700 dark:text-gray-300">{result.interpretation}</p>
            </div>

            {/* Recommendations */}
            <div className="px-6 pb-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <InformationCircleIcon className="w-5 h-5 text-indigo-600" />
                Rekommendationer
              </h4>
              <ul className="space-y-2">
                {result.recommendations.map((rec: string, idx: number) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
                  >
                    <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Expand/Collapse */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full py-3 border-t border-gray-200 dark:border-gray-700 
                       text-gray-600 dark:text-gray-400 hover:bg-gray-50 
                       dark:hover:bg-gray-700 transition-colors flex items-center 
                       justify-center gap-2"
            >
              {expanded ? 'Dölj frågor' : 'Visa frågor igen'}
              {expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      </>)}
    </div>
  );
};

export default ClinicalAssessment;
