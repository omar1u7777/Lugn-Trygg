import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SparklesIcon, FaceFrownIcon, FaceSmileIcon, MinusCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import useAuth from '../hooks/useAuth';
import api from '../api/api';

interface QuickMood {
  emoji: string;
  label: string;
  valence: number;
  arousal: number;
  color: string;
}

const QUICK_MOODS: QuickMood[] = [
  { emoji: '😢', label: 'Mycket svårt', valence: -0.9, arousal: 0.3, color: 'rose' },
  { emoji: '😔', label: 'Nedstämd', valence: -0.6, arousal: 0.2, color: 'orange' },
  { emoji: '😐', label: 'Neutral', valence: 0.0, arousal: 0.5, color: 'slate' },
  { emoji: '🙂', label: 'Okej', valence: 0.4, arousal: 0.5, color: 'teal' },
  { emoji: '😊', label: 'Bra', valence: 0.7, arousal: 0.6, color: 'emerald' },
  { emoji: '🤩', label: 'Fantastiskt', valence: 0.95, arousal: 0.8, color: 'amber' },
];

export const AdvancedMoodLogger: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedMood, setSelectedMood] = useState<QuickMood | null>(null);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [nlpAnalysis, setNlpAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [smartPrompts, setSmartPrompts] = useState<string[]>([]);

  // Fetch smart prompts on mount
  React.useEffect(() => {
    fetchSmartPrompts();
  }, []);

  const fetchSmartPrompts = async () => {
    try {
      const response = await api.get('/advanced-mood/journal/smart-prompts');
      if (response.data?.success) {
        setSmartPrompts(response.data.data.prompts.map((p: any) => p.content));
      }
    } catch (e) {
      console.error('Failed to fetch smart prompts:', e);
    }
  };

  // Analyze text with Swedish BERT NLP
  const analyzeText = useCallback(async (text: string) => {
    if (!text || text.length < 3) return;
    
    try {
      const response = await api.post('/advanced-mood/analyze', { text });
      if (response.data?.success) {
        setNlpAnalysis(response.data.data);
        
        // Fetch tag suggestions
        const tagsResponse = await api.post('/advanced-mood/journal/suggest-tags', { 
          note: text,
          current_tags: tags 
        });
        if (tagsResponse.data?.success) {
          setSuggestedTags(tagsResponse.data.data.suggested_tags.map((t: any) => t.tag));
        }
      }
    } catch (e) {
      console.error('NLP analysis failed:', e);
    }
  }, [tags]);

  // Debounced text analysis
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (note) analyzeText(note);
    }, 500);
    return () => clearTimeout(timer);
  }, [note, analyzeText]);

  const handleMoodSelect = async (mood: QuickMood) => {
    setSelectedMood(mood);
    setLoading(true);
    
    try {
      await api.post('/mood/log', {
        valence: mood.valence,
        arousal: mood.arousal,
        intensity: 5,
        note: note || mood.label,
        tags,
        timestamp: new Date().toISOString()
      });
      
      // Reset form
      setSelectedMood(null);
      setNote('');
      setTags([]);
      setNlpAnalysis(null);
      
      // Refresh prompts for next time
      fetchSmartPrompts();
      
    } catch (e) {
      console.error('Failed to log mood:', e);
    } finally {
      setLoading(false);
    }
  };

  const getColorClasses = (color: string) => {
    const classes: Record<string, string> = {
      rose: 'bg-rose-100 hover:bg-rose-200 text-rose-800 border-rose-300',
      orange: 'bg-orange-100 hover:bg-orange-200 text-orange-800 border-orange-300',
      slate: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300',
      teal: 'bg-teal-100 hover:bg-teal-200 text-teal-800 border-teal-300',
      emerald: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300',
      amber: 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300',
    };
    return classes[color] || classes.slate;
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('mood.title', 'Hur mår du just nu?')}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {t('mood.subtitle', 'Välj den emoji som bäst beskriver ditt mående')}
        </p>
      </div>

      {/* Smart Prompts */}
      {smartPrompts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            💡 {t('mood.smart_prompts', 'Frågor att reflektera över')}
          </p>
          <div className="flex flex-wrap gap-2">
            {smartPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => setNote(prompt)}
                className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Mood Selector */}
      <div className="grid grid-cols-3 gap-3">
        {QUICK_MOODS.map((mood) => (
          <motion.button
            key={mood.label}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleMoodSelect(mood)}
            disabled={loading}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedMood?.label === mood.label
                ? 'border-indigo-500 ring-2 ring-indigo-200'
                : 'border-transparent'
            } ${getColorClasses(mood.color)}`}
          >
            <span className="text-3xl block mb-1">{mood.emoji}</span>
            <span className="text-xs font-medium">{mood.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Note Input */}
      <div className="space-y-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('mood.note_placeholder', 'Vill du lägga till något? (frivilligt)')}
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                     resize-none h-24"
        />
        
        {/* NLP Analysis Results */}
        <AnimatePresence>
          {nlpAnalysis && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <SparklesIcon className="w-4 h-4 text-indigo-600" />
                <span className="font-medium text-indigo-900 dark:text-indigo-300">
                  AI-analys
                </span>
              </div>
              <div className="space-y-1 text-xs text-indigo-700 dark:text-indigo-400">
                <p>Primär känsla: {nlpAnalysis.primary_emotion}</p>
                <p>Intensitet: {nlpAnalysis.intensity}/10</p>
                {nlpAnalysis.high_clinical_risk && (
                  <p className="text-rose-600 font-medium">
                    ⚠️ Vi ser tecken på att du har det svårt. Det finns hjälp tillgänglig.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Suggested Tags */}
      {suggestedTags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Föreslagna etiketter:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setTags(prev => 
                  prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                )}
                className={`text-xs px-2 py-1 rounded-full transition-colors ${
                  tags.includes(tag)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={() => selectedMood && handleMoodSelect(selectedMood)}
        disabled={!selectedMood || loading}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 
                   text-white font-medium rounded-lg transition-colors"
      >
        {loading ? 'Sparar...' : t('mood.save', 'Spara')}
      </button>
    </div>
  );
};

export default AdvancedMoodLogger;
