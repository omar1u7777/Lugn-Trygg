import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CBTExercise, CBTInsights, CBTModule, PersonalizedSession } from '../../api/cbt';
import { CRISIS_NUMBERS } from '../../config/crisisResources';

interface CBTSectionProps {
  cbtModules: CBTModule[];
  cbtExercises: CBTExercise[];
  cbtInsights: CBTInsights | null;
  cbtSession: PersonalizedSession | null;
  cbtLoading: boolean;
  cbtError: string | null;
  cbtCurrentMood: string;
  setCbtCurrentMood: (mood: string) => void;
  startCbtExercise: (exerciseId: string) => void;
  completeCbtExercise: (exerciseId: string, difficultyRating: number) => void;
  activeCbtExerciseId: string | null;
  setActiveCbtExerciseId: (id: string | null) => void;
  // Behavioral Activation state
  baStep: number;
  setBaStep: (step: number) => void;
  baActivities: string;
  setBaActivities: (v: string) => void;
  baSelectedActivity: string;
  setBaSelectedActivity: (v: string) => void;
  baBarriers: string;
  setBaBarriers: (v: string) => void;
  baPlan: string;
  setBaPlan: (v: string) => void;
  baPleasureRating: number | null;
  setBaPleasureRating: (n: number) => void;
  baReflection: string;
  setBaReflection: (v: string) => void;
  // Worry Time state
  wtStep: number;
  setWtStep: (step: number) => void;
  wtWorries: string;
  setWtWorries: (v: string) => void;
  wtScheduledTime: string;
  setWtScheduledTime: (v: string) => void;
  wtPostponeCommitted: boolean;
  setWtPostponeCommitted: (v: boolean) => void;
  wtReflection: string;
  setWtReflection: (v: string) => void;
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
}

export const CBTSection: React.FC<CBTSectionProps> = ({
  cbtModules,
  cbtExercises,
  cbtInsights,
  cbtSession,
  cbtLoading,
  cbtError,
  cbtCurrentMood,
  setCbtCurrentMood,
  startCbtExercise,
  completeCbtExercise,
  activeCbtExerciseId,
  setActiveCbtExerciseId,
  baStep, setBaStep,
  baActivities, setBaActivities,
  baSelectedActivity, setBaSelectedActivity,
  baBarriers, setBaBarriers,
  baPlan, setBaPlan,
  baPleasureRating, setBaPleasureRating,
  baReflection, setBaReflection,
  wtStep, setWtStep,
  wtWorries, setWtWorries,
  wtScheduledTime, setWtScheduledTime,
  wtPostponeCommitted, setWtPostponeCommitted,
  wtReflection, setWtReflection,
  announceToScreenReader,
}) => {
  const { t } = useTranslation();

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6 sm:mb-8">
      {/* Disclaimer at top */}
      <div className="mb-4 p-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800 text-xs text-yellow-800 dark:text-yellow-300">
        <strong>{t('recommendations.cbt.disclaimerPrefix', '⚠️ Viktigt:')}</strong> {t('recommendations.cbt.disclaimerBody', {
          emergency: CRISIS_NUMBERS.emergency,
          suicideLine: CRISIS_NUMBERS.suicideLine,
          healthcare: CRISIS_NUMBERS.healthcare,
        })}
      </div>

      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('recommendations.cbt.modulesTitle', 'KBT-moduler (Kognitiv Beteendeterapi)')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('recommendations.cbt.modulesSubtitle', 'Evidensbaserade övningar anpassade till din nuvarande situation.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {cbtLoading && <span className="text-sm text-blue-600 dark:text-blue-300">{t('recommendations.cbt.loading', 'Laddar...')}</span>}
          <select
            value={cbtCurrentMood}
            onChange={(e) => setCbtCurrentMood(e.target.value)}
            className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-1 focus:ring-2 focus:ring-primary-500"
            aria-label={t('recommendations.cbt.selectMood', 'Välj ditt nuvarande mående')}
          >
            <option value="neutral">{t('recommendations.cbt.mood.neutral', 'Neutralt mående')}</option>
            <option value="high_anxiety">{t('recommendations.cbt.mood.highAnxiety', 'Hög ångest')}</option>
            <option value="low_mood">{t('recommendations.cbt.mood.lowMood', 'Nedstämd')}</option>
            <option value="depression">{t('recommendations.cbt.mood.depression', 'Depression')}</option>
            <option value="stress">{t('recommendations.cbt.mood.stress', 'Stress')}</option>
            <option value="good">{t('recommendations.cbt.mood.good', 'Mår bra')}</option>
          </select>
        </div>
      </div>

      {cbtError && (
        <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300 text-sm">
          {cbtError}
        </div>
      )}

      {/* Progress stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('recommendations.cbt.modules', 'Moduler')}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{cbtModules.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('recommendations.cbt.exercisesDone', 'Övningar gjorda')}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{cbtInsights?.exercisesCompleted ?? 0}</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('recommendations.cbt.dayStreak', 'Dagstreak')}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{cbtInsights?.streak.current ?? 0} 🔥</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('recommendations.cbt.totalProgress', 'Total progress')}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{Math.round((cbtInsights?.overallProgress ?? 0) * 100)}%</p>
        </div>
      </div>

      {/* Personalized session guidance */}
      {cbtSession && (
        <div className="mb-5 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 p-4">
          <p className="text-sm font-semibold text-teal-800 dark:text-teal-300 mb-1">{t('recommendations.cbt.recommendedSession', '🎯 Rekommenderad session för dig just nu')}</p>
          <p className="text-sm text-teal-700 dark:text-teal-300 mb-2">{cbtSession.guidance}</p>
          {cbtSession.motivationalElements.length > 0 && (
            <p className="text-xs text-indigo-600 dark:text-indigo-400 italic">{cbtSession.motivationalElements[0]}</p>
          )}
        </div>
      )}

      {/* Module list with exercises */}
      <div className="space-y-4">
        {cbtModules.map((module) => {
          const moduleExercises = cbtExercises.filter(ex => ex.moduleId === module.moduleId);
          const diffBadge = module.difficultyLevel === 'beginner' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
            module.difficultyLevel === 'intermediate' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
          return (
            <div key={module.moduleId} className={`rounded-lg border p-4 ${module.isLocked ? 'border-gray-200 dark:border-gray-700 opacity-60' : module.isCompleted ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{module.title}</h3>
                    {module.isCompleted && <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">{t('recommendations.cbt.completed', '✅ Klar')}</span>}
                    {module.isLocked && <span className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 px-2 py-0.5 rounded-full">{t('recommendations.cbt.locked', '🔒 Kräver förkunskaper')}</span>}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{module.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diffBadge}`}>{module.difficultyLevel}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{module.estimatedDuration} min</span>
                </div>
              </div>
              {moduleExercises.length > 0 && !module.isLocked && (
                <div className="space-y-2 mt-3">
                  {moduleExercises.map((ex) => (
                    <div key={ex.exerciseId} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{ex.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{ex.type.replace(/_/g, ' ')} • {ex.duration} min</p>
                      </div>
                      {ex.exerciseId === 'thought_record_basic' ? (
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{t('recommendations.cbt.seeExerciseBelow', '↓ Se KBT-övning nedan')}</span>
                      ) : (
                        <button
                          onClick={() => startCbtExercise(ex.exerciseId)}
                          disabled={activeCbtExerciseId !== null}
                          className="text-xs px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                        >
                          {activeCbtExerciseId === ex.exerciseId ? t('recommendations.cbt.inProgress', 'Pågår...') : t('recommendations.cbt.startBtn', 'Starta')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {module.isLocked && module.prerequisites.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {t('recommendations.cbt.prerequisites', 'Slutför först:')} {module.prerequisites.join(', ')}
                </p>
              )}
            </div>
          );
        })}
        {!cbtLoading && cbtModules.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">{t('recommendations.cbt.requiresPremium', 'Moduler kräver premium-prenumeration.')}</p>
        )}
      </div>

      {/* Behavioral Activation interactive exercise */}
      {activeCbtExerciseId === 'behavioral_activation' && (
        <div className="mt-6 rounded-xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-200">{t('recommendations.cbt.ba.title', '🌱 Beteendeaktivering')}</h3>
            <button onClick={() => setActiveCbtExerciseId(null)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 min-h-[44px] min-w-[44px] px-3 py-2 rounded-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">{t('recommendations.cbt.cancel', 'Avbryt')}</button>
          </div>
          <div className="mb-3 flex gap-1">
            {[1,2,3,4].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${baStep >= s ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-600'}`} />
            ))}
          </div>

          {baStep === 1 && (
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">{t('recommendations.cbt.ba.step1Title', 'Steg 1 av 4 — Identifiera aktiviteter')}</p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                {t('recommendations.cbt.ba.step1Body', 'Skriv ner 2–3 aktiviteter du brukade gilla eller som gav dig en känsla av prestation, glädje eller lugn — även om du inte känt för dem på länge.')}
              </p>
              <textarea
                value={baActivities}
                onChange={(e) => setBaActivities(e.target.value)}
                placeholder={t('recommendations.cbt.ba.step1Placeholder', 'T.ex. promenera i parken, laga mat, ringa en vän, läsa, lyssna på musik...')}
                className="w-full p-3 min-h-[100px] rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-400 resize-none"
              />
              <button
                onClick={() => baActivities.trim().length >= 10 ? setBaStep(2) : announceToScreenReader(t('recommendations.announce.baWriteActivity', 'Skriv minst en aktivitet'), 'assertive')}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
              >{t('recommendations.cbt.next', 'Nästa →')}</button>
            </div>
          )}

          {baStep === 2 && (
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">{t('recommendations.cbt.ba.step2Title', 'Steg 2 av 4 — Välj en aktivitet')}</p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                {t('recommendations.cbt.ba.step2Body', 'Välj EN aktivitet att fokusera på. Vad kan hindra dig från att göra den? Skriv ner dina tankar och hinder.')}
              </p>
              <input
                value={baSelectedActivity}
                onChange={(e) => setBaSelectedActivity(e.target.value)}
                placeholder={t('recommendations.cbt.ba.step2ActivityPlaceholder', 'Vilken aktivitet väljer du?')}
                className="w-full p-3 mb-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-400"
              />
              <textarea
                value={baBarriers}
                onChange={(e) => setBaBarriers(e.target.value)}
                placeholder={t('recommendations.cbt.ba.step2BarrierPlaceholder', 'Vad hindrar dig? T.ex. "Jag känner inte för det", "Det tar för lång tid", "Ingen mening"...')}
                className="w-full p-3 min-h-[80px] rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-400 resize-none"
              />
              <div className="flex gap-2 mt-3">
                <button onClick={() => setBaStep(1)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg">{t('recommendations.cbt.back', '← Tillbaka')}</button>
                <button
                  onClick={() => baSelectedActivity.trim().length >= 3 ? setBaStep(3) : announceToScreenReader(t('recommendations.announce.baSelectActivity', 'Välj en aktivitet'), 'assertive')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
                >{t('recommendations.cbt.next', 'Nästa →')}</button>
              </div>
            </div>
          )}

          {baStep === 3 && (
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">{t('recommendations.cbt.ba.step3Title', 'Steg 3 av 4 — Planera konkret')}</p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                {t('recommendations.cbt.ba.step3Body', 'Planera aktiviteten specifikt: NÄR? VAR? HUR länge? Konkreta planer ökar sannolikheten att du faktiskt gör det.')}
              </p>
              <textarea
                value={baPlan}
                onChange={(e) => setBaPlan(e.target.value)}
                placeholder={`Jag ska ${baSelectedActivity || 'aktiviteten'} på [dag] kl [tid] på [plats] i [X] minuter.`}
                className="w-full p-3 min-h-[100px] rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-400 resize-none"
              />
              <div className="flex gap-2 mt-3">
                <button onClick={() => setBaStep(2)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg">{t('recommendations.cbt.back', '← Tillbaka')}</button>
                <button
                  onClick={() => baPlan.trim().length >= 15 ? setBaStep(4) : announceToScreenReader(t('recommendations.announce.baDescribePlan', 'Beskriv planen med minst 15 tecken'), 'assertive')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
                >{t('recommendations.cbt.next', 'Nästa →')}</button>
              </div>
            </div>
          )}

          {baStep === 4 && (
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">{t('recommendations.cbt.ba.step4Title', 'Steg 4 av 4 — Förväntan och reflektion')}</p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                {t('recommendations.cbt.ba.step4Body', 'Hur nöjd tror du att du kommer att vara efter aktiviteten? (Kom ihåg: Vår förväntan är ofta lägre än verkligheten vid depression.)')}
              </p>
              <div className="mb-4">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('recommendations.cbt.ba.expectedSatisfaction', 'Förväntad nöjdhet (1 = låg, 10 = hög)')}</p>
                <div className="flex gap-1 flex-wrap">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} onClick={() => setBaPleasureRating(n)}
                      className={`min-h-[44px] min-w-[44px] rounded-full text-sm font-medium transition-colors ${baPleasureRating === n ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={baReflection}
                onChange={(e) => setBaReflection(e.target.value)}
                placeholder={t('recommendations.cbt.ba.step4ReflectionPlaceholder', 'Vad hindrade dig eller vad lärde du dig av att planera denna aktivitet?')}
                className="w-full p-3 min-h-[80px] rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-400 resize-none"
              />
              <div className="flex gap-2 mt-3">
                <button onClick={() => setBaStep(3)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg">{t('recommendations.cbt.back', '← Tillbaka')}</button>
                <button
                  onClick={() => {
                    if (!baPleasureRating) { announceToScreenReader(t('recommendations.announce.baSelectPleasure', 'Välj en förväntad nöjdhet'), 'assertive'); return; }
                    completeCbtExercise('behavioral_activation', 2);
                    setBaStep(0);
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg"
                >{t('recommendations.cbt.saveExercise', '✅ Spara övning')}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Worry Time interactive exercise */}
      {activeCbtExerciseId === 'worry_time' && (
        <div className="mt-6 rounded-xl border-2 border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-purple-900 dark:text-purple-200">{t('recommendations.cbt.wt.title', '⏰ Bekymmelsetid')}</h3>
            <button onClick={() => setActiveCbtExerciseId(null)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 min-h-[44px] min-w-[44px] px-3 py-2 rounded-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">{t('recommendations.cbt.cancel', 'Avbryt')}</button>
          </div>
          <div className="mb-3 flex gap-1">
            {[1,2,3,4].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${wtStep >= s ? 'bg-purple-500' : 'bg-gray-200 dark:bg-gray-600'}`} />
            ))}
          </div>

          {wtStep === 1 && (
            <div>
              <p className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-2">{t('recommendations.cbt.wt.step1Title', 'Steg 1 av 4 — Skriv ner dina bekymmer')}</p>
              <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                {t('recommendations.cbt.wt.step1Body', 'Skriv ner alla bekymmer som dyker upp just nu. Att externalisera dem minskar deras känslomässiga laddning.')}
              </p>
              <textarea
                value={wtWorries}
                onChange={(e) => setWtWorries(e.target.value)}
                placeholder={t('recommendations.cbt.wt.step1Placeholder', 'T.ex. "Jag är orolig för ekonomin", "Jag vet inte om jobbet går bra", "Familjen mår inte bra"...')}
                className="w-full p-3 min-h-[110px] rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-400 resize-none"
              />
              <button
                onClick={() => wtWorries.trim().length >= 10 ? setWtStep(2) : announceToScreenReader(t('recommendations.announce.wtWriteWorries', 'Skriv minst ett bekymmer'), 'assertive')}
                className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg"
              >{t('recommendations.cbt.next', 'Nästa →')}</button>
            </div>
          )}

          {wtStep === 2 && (
            <div>
              <p className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-2">{t('recommendations.cbt.wt.step2Title', 'Steg 2 av 4 — Schemalägg din bekymmelsetid')}</p>
              <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                {t('recommendations.cbt.wt.step2Body', 'Välj en fast tid (20 min) varje dag att tillåta dig att bekymra dig. Utanför denna tid skjuter du upp bekymren. Forskning (Borkovec et al.) visar att detta minskar spontan oro med 30–50%.')}
              </p>
              <input
                value={wtScheduledTime}
                onChange={(e) => setWtScheduledTime(e.target.value)}
                placeholder={t('recommendations.cbt.wt.step2Placeholder', 'T.ex. kl 18:00 varje kväll i vardagsrummet')}
                className="w-full p-3 rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-400"
              />
              <div className="flex gap-2 mt-3">
                <button onClick={() => setWtStep(1)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg">{t('recommendations.cbt.back', '← Tillbaka')}</button>
                <button
                  onClick={() => wtScheduledTime.trim().length >= 3 ? setWtStep(3) : announceToScreenReader(t('recommendations.announce.wtSpecifyTime', 'Ange en tid'), 'assertive')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg"
                >{t('recommendations.cbt.next', 'Nästa →')}</button>
              </div>
            </div>
          )}

          {wtStep === 3 && (
            <div>
              <p className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-2">{t('recommendations.cbt.wt.step3Title', 'Steg 3 av 4 — Övning i uppskjutning')}</p>
              <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                {t('recommendations.cbt.wt.step3Body', 'När ett bekymmer dyker upp utanför din bekymmelsetid, påminn dig: "Det tar jag upp kl [tid]." Bekymret är noterat — du behöver inte tänka på det nu.')}
              </p>
              <div className="p-3 bg-purple-100 dark:bg-purple-800/30 rounded-lg mb-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wtPostponeCommitted}
                    onChange={(e) => setWtPostponeCommitted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded-sm border-gray-300 text-purple-600 focus:ring-purple-400"
                  />
                  <span className="text-sm text-purple-800 dark:text-purple-200">
                    {t('recommendations.cbt.wt.commitmentText', 'Jag förbinder mig att skjuta upp bekymmer till min schemalagda tid och påminna mig att de redan är noterade.')}
                  </span>
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setWtStep(2)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg">{t('recommendations.cbt.back', '← Tillbaka')}</button>
                <button
                  onClick={() => wtPostponeCommitted ? setWtStep(4) : announceToScreenReader(t('recommendations.announce.wtCheckboxRequired', 'Bocka i rutan för att fortsätta'), 'assertive')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg"
                >{t('recommendations.cbt.next', 'Nästa →')}</button>
              </div>
            </div>
          )}

          {wtStep === 4 && (
            <div>
              <p className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-2">{t('recommendations.cbt.wt.step4Title', 'Steg 4 av 4 — Reflektion')}</p>
              <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                {t('recommendations.cbt.wt.step4Body', 'Har du provat att hålla din bekymmelsetid? Vilka bekymmer löste sig av sig självt? Ofta inser vi att de flesta bekymmer antingen inte inträffar eller löser sig utan aktiv insats.')}
              </p>
              <textarea
                value={wtReflection}
                onChange={(e) => setWtReflection(e.target.value)}
                placeholder={t('recommendations.cbt.wt.step4Placeholder', 'Vad lärde du dig? Vilka bekymmer försvann? Hur kändes det att skjuta upp dem?')}
                className="w-full p-3 min-h-[90px] rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-400 resize-none"
              />
              <div className="flex gap-2 mt-3">
                <button onClick={() => setWtStep(3)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg">{t('recommendations.cbt.back', '← Tillbaka')}</button>
                <button
                  onClick={() => {
                    if (wtReflection.trim().length < 10) { announceToScreenReader(t('recommendations.announce.wtWriteReflection', 'Skriv en kort reflektion'), 'assertive'); return; }
                    completeCbtExercise('worry_time', 3);
                    setWtStep(0);
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg"
                >{t('recommendations.cbt.saveExercise', '✅ Spara övning')}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Insights footer */}
      {cbtInsights && cbtInsights.recommendedNextSteps.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('recommendations.cbt.recommendedNextSteps', '💡 Rekommenderade nästa steg:')}</p>
          <ul className="space-y-1">
            {cbtInsights.recommendedNextSteps.map((step, i) => (
              <li key={i} className="text-xs text-gray-600 dark:text-gray-400">• {step}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
