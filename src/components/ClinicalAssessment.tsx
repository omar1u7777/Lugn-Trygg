import React, { useState } from 'react';
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

export const ClinicalAssessment: React.FC = () => {
  const { t: _t } = useTranslation();
  const { user: _user } = useAuth();
  const [activeTab, setActiveTab] = useState<'phq9' | 'gad7'>('phq9');
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const questions = activeTab === 'phq9' ? PHQ9_QUESTIONS : GAD7_QUESTIONS;

  const handleResponse = (questionId: string, value: number) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const calculateScore = async () => {
    // Check all questions answered
    const unanswered = questions.filter(q => responses[q.id] === undefined);
    if (unanswered.length > 0) {
      alert(`Svara på alla frågor. ${unanswered.length} kvar.`);
      return;
    }

    setLoading(true);
    try {
      const endpoint = activeTab === 'phq9' ? '/advanced-mood/assess/phq9' : '/advanced-mood/assess/gad7';
      const res = await api.post(endpoint, { responses });
      
      if (res.data?.success) {
        setResult(res.data.data);
        setExpanded(false);
      }
    } catch (e) {
      console.error('Assessment failed:', e);
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
      </div>

      {/* Progress Bar */}
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
    </div>
  );
};

export default ClinicalAssessment;
