```typescript
import React, { useState, useEffect, useRef } from 'react';
import {
  XMarkIcon,
  MicrophoneIcon,
  StopIcon,
  PlayIcon,
  SparklesIcon,
  ArrowRightIcon,
  ArrowLeftIcon, // Added ArrowLeftIcon
  CheckCircleIcon // Added appropriate icon
} from '@heroicons/react/24/outline'; // Correct import source
import { useAccessibility } from '../hooks/useAccessibility';
import { analytics } from '../services/analytics';
import { logMood, analyzeText } from '../api/api';
import { clearDashboardCache } from '../hooks/useDashboardData';
import useAuth from '../hooks/useAuth';
import { useSubscription } from '../contexts/SubscriptionContext';
import '../styles/world-class-design.css';

// ----------------------------------------------------------------------
// Types & Constants
// ----------------------------------------------------------------------

interface WorldClassMoodLoggerProps {
  onClose: () => void;
}

interface MoodOption {
  id: string;
  emoji: string;
  label: string;
  score: number;
  color: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  { id: 'ecstatic', emoji: '🤩', label: 'Fantastiskt', score: 10, color: 'from-yellow-300 to-amber-500' },
  { id: 'happy', emoji: '😊', label: 'Bra', score: 8, color: 'from-green-300 to-emerald-500' },
  { id: 'neutral', emoji: '😐', label: 'Helt okej', score: 5, color: 'from-gray-300 to-slate-400' },
  { id: 'anxious', emoji: '😰', label: 'Orolig', score: 4, color: 'from-orange-300 to-red-400' },
  { id: 'sad', emoji: '😢', label: 'Nere', score: 3, color: 'from-blue-300 to-indigo-500' },
  { id: 'angry', emoji: '😠', label: 'Arg', score: 2, color: 'from-red-400 to-rose-600' },
];

const FACTORS = [
  { id: 'sleep', label: 'Sömn', icon: '😴' },
  { id: 'work', label: 'Jobb/Skola', icon: '💼' },
  { id: 'family', label: 'Familj', icon: '👨‍👩‍👧' },
  { id: 'friends', label: 'Vänner', icon: '👯‍♀️' },
  { id: 'health', label: 'Hälsa', icon: '❤️' },
  { id: 'exercise', label: 'Träning', icon: '💪' },
  { id: 'food', label: 'Mat', icon: '🥗' },
  { id: 'weather', label: 'Väder', icon: '🌤️' },
];

// ----------------------------------------------------------------------
// Component: Step 1 - Mood Selection (3D Emojis)
// ----------------------------------------------------------------------

const MoodSelectionStep: React.FC<{
  selectedMood: MoodOption | null;
  onSelect: (mood: MoodOption) => void;
}> = ({ selectedMood, onSelect }) => {
  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="text-center">
        <h2 className="world-class-heading-2 mb-2">Hur känns det just nu?</h2>
        <p className="text-gray-500 dark:text-gray-400">Välj det som passar bäst</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {MOOD_OPTIONS.map((mood, index) => {
          const isSelected = selectedMood?.id === mood.id;
          return (
            <button
              key={mood.id}
              onClick={() => onSelect(mood)}
              className={`group relative p - 6 rounded - [2rem] transition - all duration - 300 border - 2
                ${
  isSelected
    ? 'border-primary-500 bg-white dark:bg-slate-800 shadow-xl scale-105'
    : 'border-transparent bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg hover:scale-105'
}
`}
              style={{ animationDelay: `${ index * 50 } ms` }}
            >
              <div 
                className={`text - 6xl mb - 4 transition - transform duration - 500 
                  ${ isSelected ? 'scale-125 rotate-6' : 'group-hover:scale-110 group-hover:rotate-6' }
                  filter drop - shadow - md
  `}
              >
                {mood.emoji}
              </div>
              <div className="font-bold text-gray-900 dark:text-gray-100">{mood.label}</div>
              
              {/* Active Indicator */}
              {isSelected && (
                <div className="absolute top-4 right-4 text-primary-500">
                  <CheckCircleIcon className="w-6 h-6" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// Component: Step 2 - Factors (Chips)
// ----------------------------------------------------------------------

const FactorsStep: React.FC<{
  selectedFactors: string[];
  toggleFactor: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}> = ({ selectedFactors, toggleFactor, onNext, onBack }) => {
  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="text-center">
        <h2 className="world-class-heading-2 mb-2">Vad har påverkat dig?</h2>
        <p className="text-gray-500 dark:text-gray-400">Välj en eller flera (valfritt)</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {FACTORS.map((factor, index) => {
          const isSelected = selectedFactors.includes(factor.id);
          return (
            <button
              key={factor.id}
              onClick={() => toggleFactor(factor.id)}
              className={`flex items - center gap - 2 px - 6 py - 3 rounded - full text - base font - medium transition - all duration - 200
                ${
  isSelected
    ? 'bg-primary-600 text-white shadow-md transform scale-105'
    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-gray-700'
}
`}
              style={{ animationDelay: `${ index * 50 } ms` }}
            >
              <span>{factor.icon}</span>
              <span>{factor.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between pt-8">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Tillbaka
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-full font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
        >
          Nästa
          <ArrowRightIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// Component: Step 3 - Elaborate (Text & Voice)
// ----------------------------------------------------------------------

const ElaborateStep: React.FC<{
  note: string;
  setNote: (note: string) => void;
  onSave: () => void;
  isSaving: boolean;
  onBack: () => void;
}> = ({ note, setNote, onSave, isSaving, onBack }) => {
  return (
    <div className="space-y-6 animate-fade-in-up">
       <div className="text-center">
        <h2 className="world-class-heading-2 mb-2">Vill du berätta mer?</h2>
        <p className="text-gray-500 dark:text-gray-400">Sätt ord på dina känslor (valfritt)</p>
      </div>

      <div className="glass-panel rounded-[2rem] p-6">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Skriv dina tankar här..."
          className="w-full h-40 bg-transparent border-none focus:ring-0 text-lg placeholder-gray-400 dark:placeholder-gray-600 resize-none"
        />
        
        <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
           <button className="p-3 text-primary-600 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 rounded-full transition-colors" title="Röstinspelning (Kommer snart)">
             <MicrophoneIcon className="w-6 h-6" />
           </button>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Tillbaka
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-8 py-3 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-full font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Sparar...' : 'Spara Logg'}
          {!isSaving && <CheckCircleIcon className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

const WorldClassMoodLogger: React.FC<WorldClassMoodLoggerProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { announceToScreenReader } = useAccessibility();
  const { incrementMoodLog, canLogMood } = useSubscription();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedMood, setSelectedMood] = useState<MoodOption | null>(null);
  const [selectedFactors, setSelectedFactors] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sound effects refs (omitted for brevity, assume implementation)

  const handleMoodSelect = (mood: MoodOption) => {
    setSelectedMood(mood);
    // Subtle delay for visual feedback before auto-advance
    setTimeout(() => setStep(2), 300);
  };

  const toggleFactor = (id: string) => {
    setSelectedFactors(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
                  </h4>
                  <p className="text-sm">
                    {analysis.emotion || 'Din text visar på följande känslor:'}
                    {analysis.sentiment && (
                      <span
                        className={`ml - 2 inline - flex items - center px - 2.5 py - 0.5 rounded - full text - xs font - medium ${
  analysis.sentiment === 'POSITIVE'
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
} `}
                      >
                        {analysis.sentiment}
                      </span>
                    )}
                  </p>
                </div>
              </Alert>
            </div>
          )}

          {/* Voice Analysis */}
          {voiceAnalysis && (
            <div className="mb-12">
              <Alert variant="info">
                <div>
                  <h4 className="text-lg font-semibold mb-2">
                    🎤 AI-analys av röst
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Känsla från röst:</strong> {voiceAnalysis.emotion || 'Analyseras...'}
                      {voiceAnalysis.sentiment && (
                        <span
                          className={`ml - 2 inline - flex items - center px - 2.5 py - 0.5 rounded - full text - xs font - medium ${
  voiceAnalysis.sentiment === 'POSITIVE'
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    : voiceAnalysis.sentiment === 'NEGATIVE'
      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
} `}
                        >
                          {voiceAnalysis.sentiment}
                        </span>
                      )}
                    </p>
                    {voiceAnalysis.confidence && (
                      <p>
                        <strong>Konfidens:</strong> {Math.round(voiceAnalysis.confidence * 100)}%
                      </p>
                    )}
                    {voiceAnalysis.intensity && (
                      <p>
                        <strong>Intensitet:</strong> {Math.round(voiceAnalysis.intensity * 100)}%
                      </p>
                    )}
                    {voiceAnalysis.suggested_mood_score && (
                      <p>
                        <strong>Föreslagen humör-poäng:</strong> {voiceAnalysis.suggested_mood_score}/10
                        <span className="text-xs text-gray-500 ml-2">
                          (baserat på röstanalys)
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </Alert>
            </div>
          )}

          {/* Recommendations */}
          {selectedMood && (
            <div className="mb-12">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 world-class-heading-3">
                💡 Rekommendationer
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {getRecommendations().map((rec, index) => (
                  <Card
                    key={index}
                    className="p-4 border border-gray-200 dark:border-gray-700 transition-all hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-3">
                      <div style={{ color: colors.primary.main }}>
                        {rec.icon}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {rec.text}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* HONEST transparency - ONLY show in development/debug mode */}
          {process.env.NODE_ENV === 'development' && (
            <Alert variant="info" className="mb-6">
              <div className="text-sm">
                <p className="font-semibold mb-2">🔍 DEV MODE: Vad händer när du sparar:</p>
                <div className="space-y-1 text-xs">
                  <p>• Humör-poäng ({useCustomScore ? customMoodScore : selectedMood?.score || 'X'}/10) sparas exakt</p>
                  <p>• Text sparas ordagrant - INGA ändringar</p>
                  {recordedAudio && <p>• Röst: AI-analys med fallback till neutral</p>}
                  <p>• Timestamp: {new Date().toLocaleString('sv-SE')}</p>
                  <p>• Lagringsplats: Firebase Firestore</p>
                  <p>• AI: OpenAI med fallback</p>
                  <p>• Cache: Rensas för omedelbar synkronisering</p>
                </div>
              </div>
            </Alert>
          )}

          {/* Save Button */}
          <div className="text-center">
            <Button
              onClick={handleSave}
              disabled={(!selectedMood && !useCustomScore) || (useCustomScore && !customMoodScore) || loading}
              variant="primary"
              size="lg"
              className="world-class-btn-primary px-12 py-3 text-lg rounded-2xl"
            >
              <CheckIcon className="w-5 h-5 mr-2" />
              {loading ? 'Sparar...' : 'Spara humör'}
            </Button>

            {loading && (
              <div className="mt-4">
                <div className="w-full rounded-full h-2 overflow-hidden" style={{ backgroundColor: colors.background.default }}>
                  <div className="h-full animate-pulse" style={{ width: '100%', backgroundColor: colors.primary.main }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default WorldClassMoodLogger;
