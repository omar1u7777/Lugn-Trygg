import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePMR } from '../../hooks/usePMR';
import { getMuscleGroups } from '../../constants/recommendations';

interface PMRExerciseProps {
  onComplete?: () => void;
  onSaveSession?: (sessionData: { type: string; duration: number; technique: string; completedCycles: number; notes: string }) => void;
  onUpdateProgress?: (type: string, duration: number) => void;
}

export const PMRExercise: React.FC<PMRExerciseProps> = ({
  onComplete,
  onSaveSession,
  onUpdateProgress,
}) => {
  const { t } = useTranslation();
  const translatedMuscleGroups = useMemo(() => getMuscleGroups(t), [t]);

  const [relaxationDifficulty, setRelaxationDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [customTiming, setCustomTiming] = useState({ tense: 5, relax: 10 });
  const [breathingSync, setBreathingSync] = useState(false);

  interface RelaxationSession {
    date: string;
    duration: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    muscleGroups: number;
  }
  const [sessionHistory, setSessionHistory] = useState<RelaxationSession[]>([]);

  const {
    isActive: isRelaxationActive,
    phase: relaxationPhase,
    currentMuscleGroupIndex: currentMuscleGroup,
    timeLeft: relaxationCount,
    start: startProgressiveRelaxation,
    stop: stopProgressiveRelaxation,
  } = usePMR({
    difficulty: relaxationDifficulty,
    customTiming,
    onComplete: (duration, count) => {
      // Save session to history
      const newSession = {
        date: new Date().toISOString(),
        duration: duration,
        difficulty: relaxationDifficulty,
        muscleGroups: count,
      };
      setSessionHistory(prev => [newSession, ...prev.slice(0, 9)]);

      // Update progress
      if (onUpdateProgress) {
        onUpdateProgress('meditation', duration);
      }

      // Save meditation session to backend
      if (onSaveSession) {
        const sessionData = {
          type: 'progressive_relaxation',
          duration: duration,
          technique: `Progressive Muscle Relaxation - ${relaxationDifficulty}`,
          completedCycles: count,
          notes: `Progressive muscle relaxation - ${relaxationDifficulty} level`
        };
        onSaveSession(sessionData);
      }
    },
  });

  return (
    <div className="bg-linear-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 mb-4 border-2 border-green-200 dark:border-green-800">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-center">
        💆 Progressiv Muskelavslappning
      </h3>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
        {t('pmr.guideDesc')}
      </p>

      {/* Progress Indicator */}
      <div className="flex justify-center mb-6">
        <div className="flex items-center space-x-1">
          {translatedMuscleGroups.map((group, index) => (
            <div
              key={group.name}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all duration-300 ${index < currentMuscleGroup
                ? 'bg-green-500 text-white shadow-lg'
                : index === currentMuscleGroup && isRelaxationActive
                  ? 'bg-blue-500 text-white animate-pulse shadow-lg scale-110'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                } `}
              title={group.name}
            >
              {group.image}
            </div>
          ))}
        </div>
      </div>

      {/* Settings Panel */}
      {!isRelaxationActive && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            ⚙️ Anpassa Övning
          </h4>
          <div className="space-y-3">
            {/* Difficulty Level */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Svårighetsgrad
              </label>
              <select
                value={relaxationDifficulty}
                onChange={(e) => {
                  const d = e.target.value as 'beginner' | 'intermediate' | 'advanced';
                  setRelaxationDifficulty(d);
                  const presets = { beginner: { tense: 5, relax: 10 }, intermediate: { tense: 7, relax: 15 }, advanced: { tense: 10, relax: 20 } };
                  setCustomTiming(presets[d]);
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="beginner">Nybörjare (5s spänn, 10s slappna)</option>
                <option value="intermediate">Medel (7s spänn, 15s slappna)</option>
                <option value="advanced">Avancerad (10s spänn, 20s slappna)</option>
              </select>
            </div>

            {/* Custom Timing */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Spänn (sekunder)
                </label>
                <input
                  type="number"
                  min="3"
                  max="15"
                  value={customTiming.tense}
                  onChange={(e) => setCustomTiming(prev => ({ ...prev, tense: parseInt(e.target.value) || 5 }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Slappna (sekunder)
                </label>
                <input
                  type="number"
                  min="5"
                  max="30"
                  value={customTiming.relax}
                  onChange={(e) => setCustomTiming(prev => ({ ...prev, relax: parseInt(e.target.value) || 10 }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Breathing Sync */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                🫁 Andningssynkronisering
              </label>
              <button
                onClick={() => setBreathingSync(!breathingSync)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${breathingSync ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  } `}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${breathingSync ? 'translate-x-6' : 'translate-x-1'
                    } `}
                />
              </button>
            </div>

            {/* Session History */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                📊 Tidigare Sessioner
              </label>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {sessionHistory.length > 0 ? (
                  <div className="space-y-1">
                    {sessionHistory.slice(-3).map((session) => (
                      <div key={session.date} className="flex justify-between">
                        <span>{new Date(session.date).toLocaleDateString()}</span>
                        <span>{session.duration}min</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span>Inga tidigare sessioner</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current Instruction */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-4">
          {relaxationPhase === 'prepare' && '🧘'}
          {relaxationPhase === 'tense' && '💪'}
          {relaxationPhase === 'relax' && '😌'}
          {relaxationPhase === 'completed' && '🎉'}
        </div>

        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {relaxationPhase === 'prepare' && t('pmr.prepare')}
          {relaxationPhase === 'tense' && `${t('pmr.tense')}: ${translatedMuscleGroups[currentMuscleGroup]?.name || t('pmr.muscles')} `}
          {relaxationPhase === 'relax' && `${t('pmr.relax')}: ${translatedMuscleGroups[currentMuscleGroup]?.name || t('pmr.muscles')} `}
          {relaxationPhase === 'completed' && t('pmr.completed')}
        </h4>

        <div className="text-center mb-4">
          {/* Visual representation */}
          {relaxationPhase === 'tense' && translatedMuscleGroups[currentMuscleGroup] && (
            <div className="mb-3">
              <div className="text-6xl mb-2 animate-pulse">
                {translatedMuscleGroups[currentMuscleGroup].image}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                {translatedMuscleGroups[currentMuscleGroup].visual}
              </p>
            </div>
          )}

          {/* Breathing Guide when enabled */}
          {breathingSync && isRelaxationActive && relaxationPhase !== 'completed' && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl">🫁</span>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {relaxationPhase === 'tense' ? 'Andas in när du spänner...' :
                    relaxationPhase === 'relax' ? 'Andas ut när du slappnar...' :
                      'Andas lugnt och naturligt...'}
                </span>
              </div>
              <div className="flex justify-center">
                <div className={`w-16 h-16 rounded-full border-4 transition-all duration-1000 ${relaxationPhase === 'tense' ? 'border-green-400 bg-green-100 scale-125' :
                  relaxationPhase === 'relax' ? 'border-blue-400 bg-blue-100 scale-90' :
                    'border-gray-300 bg-gray-50 scale-100'
                  } `}></div>
              </div>
            </div>
          )}

          <p className="text-gray-700 dark:text-gray-300">
            {relaxationPhase === 'prepare' && t('pmr.prepareDesc')}
            {relaxationPhase === 'tense' && translatedMuscleGroups[currentMuscleGroup]?.instruction}
            {relaxationPhase === 'relax' && t('pmr.relaxDesc')}
            {relaxationPhase === 'completed' && t('pmr.completedDesc')}
          </p>
        </div>

        {/* Timer */}
        {isRelaxationActive && relaxationPhase !== 'completed' && (
          <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-4">
            {relaxationCount}
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center gap-3">
        {!isRelaxationActive ? (
          <button
            onClick={startProgressiveRelaxation}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            🚀 Starta Muskelavslappning
          </button>
        ) : relaxationPhase !== 'completed' ? (
          <button
            onClick={stopProgressiveRelaxation}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            ⏹️ Stoppa
          </button>
        ) : (
          <button
            onClick={onComplete}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            🎉 Stäng
          </button>
        )}
      </div>
    </div>
  );
};

export default PMRExercise;
