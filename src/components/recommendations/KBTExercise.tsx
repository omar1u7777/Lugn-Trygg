import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useKBTExercise } from '../../hooks/useKBTExercise';
import {
  KBT_MIN_NEGATIVE_LENGTH,
  KBT_MIN_EVIDENCE_LENGTH,
  KBT_MIN_ALTERNATIVE_LENGTH,
  KBT_MIN_ACTION_PLAN_LENGTH,
  KBT_MIN_OBSTACLE_PLAN_LENGTH,
  KBT_MIN_REHEARSAL_CONTEXT_LENGTH,
  KBT_MIN_EXPERIMENT_HYPOTHESIS_LENGTH,
  KBT_MIN_EXPERIMENT_MEASURE_LENGTH,
  KBT_MIN_SOCRATIC_REFLECTION_LENGTH,
  KBT_MIN_IF_THEN_PLAN_LENGTH,
  KBT_MIN_COPING_CARD_LENGTH,
  getKbtDistortionInsights,
  getKbtAdaptiveFeedback,
  getKbtStressFeedback,
  calculateKbtSessionQuality,
  getKbtStepFromPhase,
  KBT_TOTAL_STEPS,
} from '../../constants/recommendationsConstants';

interface KBTExerciseProps {
  userId?: string;
  onComplete?: () => void;
  onPhaseChange?: (phase: string) => void;
  initialBeliefBefore?: number | null;
  initialStressBefore?: number | null;
}

export const KBTExercise: React.FC<KBTExerciseProps> = ({ 
  userId, 
  onComplete, 
  onPhaseChange,
  initialBeliefBefore = null,
  initialStressBefore = null
}) => {
  const { t } = useTranslation();
  const {
    phase,
    thoughts,
    updateThoughts,
    timeLeft,
    isActive,
    start,
    nextPhase,
    stop,
  } = useKBTExercise({});

  const [showInsights, setShowInsights] = useState(false);
  const [kbtBeliefBefore, setKbtBeliefBefore] = useState<number | null>(initialBeliefBefore);
  const [kbtBeliefAfter, setKbtBeliefAfter] = useState<number | null>(null);
  const [kbtStressBefore, setKbtStressBefore] = useState<number | null>(initialStressBefore);
  const [kbtStressAfter, setKbtStressAfter] = useState<number | null>(null);
  const [kbtActionPlan, setKbtActionPlan] = useState('');
  const [kbtExperimentHypothesis, setKbtExperimentHypothesis] = useState('');
  const [kbtExperimentMeasure, setKbtExperimentMeasure] = useState('');
  const [kbtSocraticReflection, setKbtSocraticReflection] = useState('');
  const [kbtIfThenPlan, setKbtIfThenPlan] = useState('');
  const [kbtCopingCard, setKbtCopingCard] = useState('');
  const [kbtExecutionConfidenceAfter, setKbtExecutionConfidenceAfter] = useState<number | null>(null);
  const [kbtObstaclePlan, setKbtObstaclePlan] = useState('');
  const [kbtFollowUpWindow, setKbtFollowUpWindow] = useState('I morgon bitti');
  const [kbtRehearsalContext, setKbtRehearsalContext] = useState('');

  const distortionInsights = useMemo(() => getKbtDistortionInsights(thoughts.negative, t), [thoughts.negative, t]);
  const activeKbtStep = useMemo(() => getKbtStepFromPhase(phase), [phase]);
  const kbtProgressPercentage = useMemo(() => phase === 'complete' ? 100 : (activeKbtStep / KBT_TOTAL_STEPS) * 100, [phase, activeKbtStep]);

  const renderPhase = useCallback(() => {
    switch (phase) {
      case 'identify':
        return (
          <div className="text-center">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              📝 Steg 1: Identifiera negativa tankar
            </h4>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Skriv ner en specifik stressig tanke som du har just nu. Vad säger din inre röst som skapar ångest?
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4 text-left">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Exempel på negativa tankar:</p>
              <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <li>• "Jag kommer att göra bort mig helt"</li>
                <li>• "Ingen kommer att gilla det jag säger"</li>
                <li>• "Jag är inte tillräckligt bra för detta"</li>
                <li>• "Allt kommer att gå fel"</li>
              </ul>
            </div>

            <textarea
              value={thoughts.negative}
              onChange={(e) => updateThoughts('negative', e.target.value)}
              placeholder="Skriv din negativa tanke här... (t.ex. 'Jag kommer att misslyckas')"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
              minLength={KBT_MIN_NEGATIVE_LENGTH}
              required
            />
            {thoughts.negative.trim().length < KBT_MIN_NEGATIVE_LENGTH && thoughts.negative.trim().length > 0 && (
              <p className="text-red-500 text-sm mt-1">Skriv minst {KBT_MIN_NEGATIVE_LENGTH} tecken för att fortsätta</p>
            )}
          </div>
        );

      case 'challenge':
        return (
          <div className="text-center">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              🔍 Steg 2: Utmana tanken med evidens
            </h4>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Analysera din tanke objektivt. Vilka konkreta bevis finns för och emot den?
            </p>

            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg mb-4">
              <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Din negativa tanke:</p>
              <p className="text-red-600 dark:text-red-400 italic">"{thoughts.negative}"</p>
            </div>

            {distortionInsights.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg mb-4 text-left border border-yellow-100 dark:border-yellow-800">
                <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 mb-2">Möjliga tankefeller att utforska:</p>
                {distortionInsights.map((insight) => (
                  <div key={insight.key} className="mb-2 last:mb-0">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300"><strong>{insight.label}:</strong> {insight.hint}</p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">Fråga: {insight.reframeQuestion}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg mb-4 text-left">
              <label htmlFor="kbt-belief-before" className="text-sm font-medium text-purple-700 dark:text-purple-300 block mb-1">
                Hur trovärdig känns den negativa tanken just nu? ({kbtBeliefBefore ?? 0}%)
              </label>
              <input
                id="kbt-belief-before"
                type="range"
                min={0}
                max={100}
                step={5}
                value={kbtBeliefBefore ?? 0}
                onChange={(e) => setKbtBeliefBefore(Number(e.target.value))}
                className="w-full accent-purple-600"
              />
            </div>

            <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-lg mb-4 text-left">
              <label htmlFor="kbt-stress-before" className="text-sm font-medium text-rose-700 dark:text-rose-300 block mb-1">
                Hur stark är stressen i kroppen just nu? ({kbtStressBefore ?? 0}/100)
              </label>
              <input
                id="kbt-stress-before"
                type="range"
                min={0}
                max={100}
                step={5}
                value={kbtStressBefore ?? 0}
                onChange={(e) => setKbtStressBefore(Number(e.target.value))}
                className="w-full accent-rose-600"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">✅ För tanken:</p>
                <p className="text-xs text-green-600 dark:text-green-400">Vilka bevis stödjer denna tanke?</p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                <p className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-2">❌ Emot tanken:</p>
                <p className="text-xs text-orange-600 dark:text-orange-400">Vilka bevis motsäger denna tanke?</p>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4 text-left">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Exempel på evidens-analys:</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                <strong>För:</strong> "Jag har misslyckats tidigare" <br />
                <strong>Emot:</strong> "Jag har också lyckats många gånger och lärt mig av misstagen. De flesta människor misslyckas ibland."
              </p>
            </div>

            <textarea
              value={thoughts.evidence}
              onChange={(e) => updateThoughts('evidence', e.target.value)}
              placeholder={`Analysera tanken "${thoughts.negative || '...'}" med strukturen:\nFör: ...\nEmot: ...`}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={5}
              minLength={KBT_MIN_EVIDENCE_LENGTH}
              required
            />
            {thoughts.evidence.trim().length < KBT_MIN_EVIDENCE_LENGTH && thoughts.evidence.trim().length > 0 && (
              <p className="text-red-500 text-sm mt-1">Beskriv minst {KBT_MIN_EVIDENCE_LENGTH} tecken för att fortsätta</p>
            )}
            {thoughts.evidence.trim().length >= KBT_MIN_EVIDENCE_LENGTH && !/(för:|for:)/i.test(thoughts.evidence) && (
              <p className="text-amber-600 text-sm mt-1">Tips: Lägg till "För:" för tydlig struktur.</p>
            )}
            {thoughts.evidence.trim().length >= KBT_MIN_EVIDENCE_LENGTH && !/(emot:|against:)/i.test(thoughts.evidence) && (
              <p className="text-amber-600 text-sm mt-1">Tips: Lägg till "Emot:" för att balansera analysen.</p>
            )}

            <div className="mt-4 bg-sky-50 dark:bg-sky-900/20 p-3 rounded-lg text-left">
              <label htmlFor="kbt-socratic-reflection" className="text-sm font-medium text-sky-700 dark:text-sky-300 block mb-1">
                Sokratisk fråga: Om en vän hade samma tanke, vad skulle du säga till hen utifrån bevisen?
              </label>
              <textarea
                id="kbt-socratic-reflection"
                value={kbtSocraticReflection}
                onChange={(e) => setKbtSocraticReflection(e.target.value)}
                placeholder="Skriv ett kort, medkännande och faktabaserat svar som du själv kan använda."
                className="w-full p-3 border border-sky-200 dark:border-sky-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                rows={3}
                minLength={KBT_MIN_SOCRATIC_REFLECTION_LENGTH}
              />
              {kbtSocraticReflection.trim().length > 0 && kbtSocraticReflection.trim().length < KBT_MIN_SOCRATIC_REFLECTION_LENGTH && (
                <p className="text-red-500 text-sm mt-1">
                  Skriv minst {KBT_MIN_SOCRATIC_REFLECTION_LENGTH} tecken för att förankra en hjälpsam inre dialog.
                </p>
              )}
            </div>
          </div>
        );

      case 'replace':
        return (
          <div className="text-center">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              ✨ Steg 3: Ersätt med balanserad tanke
            </h4>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Skapa en mer balanserad och hjälpsam tanke baserat på bevisen från föregående steg.
            </p>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Din negativa tanke:</p>
                  <p className="text-red-600 dark:text-red-400 text-sm italic">"{thoughts.negative}"</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Din evidens-analys:</p>
                  <p className="text-blue-600 dark:text-blue-400 text-sm line-clamp-3">{thoughts.evidence || 'Ingen analys angiven'}</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg mb-4 text-left">
              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">Exempel på balanserade tankar:</p>
              <ul className="text-xs text-green-600 dark:text-green-400 space-y-1">
                <li>• "Jag gör mitt bästa och det räcker ofta"</li>
                <li>• "Misslyckanden är lärande tillfällen"</li>
                <li>• "Jag har både styrkor och utmaningar, som alla andra"</li>
                <li>• "Jag kan hantera utmaningar ett steg i taget"</li>
              </ul>
            </div>

            {distortionInsights.length > 0 && (
              <div className="bg-teal-50 dark:bg-teal-900/20 p-3 rounded-lg mb-4 text-left border border-teal-100 dark:border-teal-800">
                <p className="text-sm font-semibold text-teal-700 dark:text-teal-300 mb-1">Riktad omformuleringsöversikt</p>
                <p className="text-sm text-teal-700 dark:text-teal-300">Utgå från: <strong>{distortionInsights[0]?.label}</strong></p>
                <p className="text-xs text-teal-700 dark:text-teal-300 mt-1">Prova att besvara: {distortionInsights[0]?.reframeQuestion}</p>
              </div>
            )}

            <textarea
              value={thoughts.alternative}
              onChange={(e) => updateThoughts('alternative', e.target.value)}
              placeholder={`Skriv en balanserad tanke som svarar på:\n"${thoughts.negative || 'din tanke'}"\nmed stöd av evidensen ovan.`}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={4}
              minLength={KBT_MIN_ALTERNATIVE_LENGTH}
              required
            />
            {thoughts.alternative.trim().length < KBT_MIN_ALTERNATIVE_LENGTH && thoughts.alternative.trim().length > 0 && (
              <p className="text-red-500 text-sm mt-1">Skriv minst {KBT_MIN_ALTERNATIVE_LENGTH} tecken för att fortsätta</p>
            )}
          </div>
        );

      case 'practice':
        return (
          <div className="text-center">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              🧘 Steg 4: Öva den nya tanken
            </h4>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Upprepa din balanserade tanke flera gånger. Känn hur den känns.
            </p>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <p className="text-lg font-medium text-purple-700 dark:text-purple-300 mb-2">
                "{thoughts.alternative || 'Din balanserade tanke kommer här...'}"
              </p>
              <p className="text-sm text-purple-600 dark:text-purple-400">
                Upprepa denna tanke och känn skillnaden i ditt sinne.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Utgångstanke</p>
                <p className="text-sm text-red-600 dark:text-red-400 italic">"{thoughts.negative || 'Ingen negativ tanke angiven'}"</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Din evidens</p>
                <p className="text-sm text-blue-600 dark:text-blue-400 line-clamp-4">{thoughts.evidence || 'Ingen evidensanalys angiven'}</p>
              </div>
            </div>

            <div className="mt-4 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-left">
              <label htmlFor="kbt-belief-after" className="text-sm font-medium text-green-700 dark:text-green-300 block mb-1">
                Hur trovärdig känns den nya tanken nu? ({kbtBeliefAfter ?? 0}%)
              </label>
              <input
                id="kbt-belief-after"
                type="range"
                min={0}
                max={100}
                step={5}
                value={kbtBeliefAfter ?? 0}
                onChange={(e) => setKbtBeliefAfter(Number(e.target.value))}
                className="w-full accent-green-600"
              />
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                När du klickar "Nästa steg" sparas detta som din efter-skattning.
              </p>
            </div>

            <div className="mt-4 bg-rose-50 dark:bg-rose-900/20 p-3 rounded-lg text-left">
              <label htmlFor="kbt-stress-after" className="text-sm font-medium text-rose-700 dark:text-rose-300 block mb-1">
                Hur stark är stressen nu efter övningen? ({kbtStressAfter ?? 0}/100)
              </label>
              <input
                id="kbt-stress-after"
                type="range"
                min={0}
                max={100}
                step={5}
                value={kbtStressAfter ?? 0}
                onChange={(e) => setKbtStressAfter(Number(e.target.value))}
                className="w-full accent-rose-600"
              />
            </div>

            <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg text-left">
              <label htmlFor="kbt-execution-confidence-after" className="text-sm font-medium text-emerald-700 dark:text-emerald-300 block mb-1">
                Hur trygg är du att faktiskt genomföra planen i vardagen? ({kbtExecutionConfidenceAfter ?? 0}%)
              </label>
              <input
                id="kbt-execution-confidence-after"
                type="range"
                min={0}
                max={100}
                step={5}
                value={kbtExecutionConfidenceAfter ?? 0}
                onChange={(e) => setKbtExecutionConfidenceAfter(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
            </div>

            <div className="mt-4 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg text-left">
              <label htmlFor="kbt-action-plan" className="text-sm font-medium text-indigo-700 dark:text-indigo-300 block mb-1">
                Vad är ett konkret mikro-steg du kan göra inom 24 timmar?
              </label>
              <textarea
                id="kbt-action-plan"
                value={kbtActionPlan}
                onChange={(e) => setKbtActionPlan(e.target.value)}
                placeholder="Exempel: När stressen kommer på jobbet, tar jag 2 minuter och skriver en För/Emot-lista innan jag agerar."
                className="w-full p-3 border border-indigo-200 dark:border-indigo-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={3}
                minLength={KBT_MIN_ACTION_PLAN_LENGTH}
              />
              {kbtActionPlan.trim().length > 0 && kbtActionPlan.trim().length < KBT_MIN_ACTION_PLAN_LENGTH && (
                <p className="text-red-500 text-sm mt-1">
                  Skriv minst {KBT_MIN_ACTION_PLAN_LENGTH} tecken för ett tydligt handlingssteg.
                </p>
              )}
            </div>

            <div className="mt-4 bg-violet-50 dark:bg-violet-900/20 p-3 rounded-lg text-left">
              <label htmlFor="kbt-experiment-hypothesis" className="text-sm font-medium text-violet-700 dark:text-violet-300 block mb-1">
                Beteendeexperiment: Vad tror du händer om du följer den nya tanken?
              </label>
              <textarea
                id="kbt-experiment-hypothesis"
                value={kbtExperimentHypothesis}
                onChange={(e) => setKbtExperimentHypothesis(e.target.value)}
                placeholder="Exempel: Om jag genomför uppgiften stegvis kommer stressen minska inom 10 minuter."
                className="w-full p-3 border border-violet-200 dark:border-violet-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                rows={3}
                minLength={KBT_MIN_EXPERIMENT_HYPOTHESIS_LENGTH}
              />
              {kbtExperimentHypothesis.trim().length > 0 && kbtExperimentHypothesis.trim().length < KBT_MIN_EXPERIMENT_HYPOTHESIS_LENGTH && (
                <p className="text-red-500 text-sm mt-1">
                  Skriv minst {KBT_MIN_EXPERIMENT_HYPOTHESIS_LENGTH} tecken för en testbar hypotes.
                </p>
              )}

              <label htmlFor="kbt-experiment-measure" className="text-sm font-medium text-violet-700 dark:text-violet-300 block mt-3 mb-1">
                Vad observerar du för att se om hypotesen stämmer?
              </label>
              <textarea
                id="kbt-experiment-measure"
                value={kbtExperimentMeasure}
                onChange={(e) => setKbtExperimentMeasure(e.target.value)}
                placeholder="Exempel: Jag skattar stress var 5:e minut och noterar om jag faktiskt fortsätter uppgiften."
                className="w-full p-3 border border-violet-200 dark:border-violet-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                rows={2}
                minLength={KBT_MIN_EXPERIMENT_MEASURE_LENGTH}
              />
              {kbtExperimentMeasure.trim().length > 0 && kbtExperimentMeasure.trim().length < KBT_MIN_EXPERIMENT_MEASURE_LENGTH && (
                <p className="text-red-500 text-sm mt-1">
                  Skriv minst {KBT_MIN_EXPERIMENT_MEASURE_LENGTH} tecken för ett tydligt observationsmått.
                </p>
              )}
            </div>

            <div className="mt-4 bg-cyan-50 dark:bg-cyan-900/20 p-3 rounded-lg text-left">
              <label htmlFor="kbt-if-then-plan" className="text-sm font-medium text-cyan-700 dark:text-cyan-300 block mb-1">
                Om-så plan: Om stressen slår till, vad gör du då direkt?
              </label>
              <textarea
                id="kbt-if-then-plan"
                value={kbtIfThenPlan}
                onChange={(e) => setKbtIfThenPlan(e.target.value)}
                placeholder="Exempel: Om jag fastnar i oro, så tar jag tre lugna andetag och gör första 2-minuterssteget i uppgiften."
                className="w-full p-3 border border-cyan-200 dark:border-cyan-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                rows={3}
                minLength={KBT_MIN_IF_THEN_PLAN_LENGTH}
              />
              {kbtIfThenPlan.trim().length > 0 && kbtIfThenPlan.trim().length < KBT_MIN_IF_THEN_PLAN_LENGTH && (
                <p className="text-red-500 text-sm mt-1">
                  Skriv minst {KBT_MIN_IF_THEN_PLAN_LENGTH} tecken för en tydlig om-så plan.
                </p>
              )}
            </div>

            <div className="mt-4 bg-lime-50 dark:bg-lime-900/20 p-3 rounded-lg text-left">
              <label htmlFor="kbt-coping-card" className="text-sm font-medium text-lime-700 dark:text-lime-300 block mb-1">
                Coping-kort: Skriv en kort mening du kan läsa när stressen stiger.
              </label>
              <textarea
                id="kbt-coping-card"
                value={kbtCopingCard}
                onChange={(e) => setKbtCopingCard(e.target.value)}
                placeholder="Exempel: Jag tar ett steg i taget, och jag behöver inte vara perfekt för att göra framsteg."
                className="w-full p-3 border border-lime-200 dark:border-lime-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                rows={2}
                minLength={KBT_MIN_COPING_CARD_LENGTH}
              />
              {kbtCopingCard.trim().length > 0 && kbtCopingCard.trim().length < KBT_MIN_COPING_CARD_LENGTH && (
                <p className="text-red-500 text-sm mt-1">
                  Skriv minst {KBT_MIN_COPING_CARD_LENGTH} tecken för ett användbart coping-kort.
                </p>
              )}
            </div>

            <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg text-left">
              <label htmlFor="kbt-obstacle-plan" className="text-sm font-medium text-amber-700 dark:text-amber-300 block mb-1">
                Vilket hinder är mest sannolikt, och hur svarar du om det uppstår?
              </label>
              <textarea
                id="kbt-obstacle-plan"
                value={kbtObstaclePlan}
                onChange={(e) => setKbtObstaclePlan(e.target.value)}
                placeholder="Exempel: Om jag undviker uppgiften efter lunch, då tar jag 5 minuter och börjar med minsta möjliga delsteg."
                className="w-full p-3 border border-amber-200 dark:border-amber-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                rows={3}
                minLength={KBT_MIN_OBSTACLE_PLAN_LENGTH}
              />
              {kbtObstaclePlan.trim().length > 0 && kbtObstaclePlan.trim().length < KBT_MIN_OBSTACLE_PLAN_LENGTH && (
                <p className="text-red-500 text-sm mt-1">
                  Skriv minst {KBT_MIN_OBSTACLE_PLAN_LENGTH} tecken för en tydlig hinderplan.
                </p>
              )}
            </div>

            <div className="mt-4 bg-sky-50 dark:bg-sky-900/20 p-3 rounded-lg text-left">
              <label htmlFor="kbt-follow-up-window" className="text-sm font-medium text-sky-700 dark:text-sky-300 block mb-1">
                När repeterar du den balanserade tanken nästa gång?
              </label>
              <select
                id="kbt-follow-up-window"
                value={kbtFollowUpWindow}
                onChange={(e) => setKbtFollowUpWindow(e.target.value)}
                className="w-full p-2 border border-sky-200 dark:border-sky-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="I kväll">I kväll</option>
                <option value="I morgon bitti">I morgon bitti</option>
                <option value="Inom 48 timmar">Inom 48 timmar</option>
              </select>

              <label htmlFor="kbt-rehearsal-context" className="text-sm font-medium text-sky-700 dark:text-sky-300 block mt-3 mb-1">
                Var eller i vilken situation gör du repetitionen?
              </label>
              <textarea
                id="kbt-rehearsal-context"
                value={kbtRehearsalContext}
                onChange={(e) => setKbtRehearsalContext(e.target.value)}
                placeholder="På bussen till jobbet, eller innan första mötet på morgonen."
                className="w-full p-3 border border-sky-200 dark:border-sky-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                rows={2}
                minLength={KBT_MIN_REHEARSAL_CONTEXT_LENGTH}
              />
              {kbtRehearsalContext.trim().length > 0 && kbtRehearsalContext.trim().length < KBT_MIN_REHEARSAL_CONTEXT_LENGTH && (
                <p className="text-red-500 text-sm mt-1">
                  Skriv minst {KBT_MIN_REHEARSAL_CONTEXT_LENGTH} tecken för tydligt sammanhang.
                </p>
              )}
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center">
            {(() => {
              const adaptiveFeedback = getKbtAdaptiveFeedback(kbtBeliefBefore, kbtBeliefAfter, t);
              const stressFeedback = getKbtStressFeedback(kbtStressBefore, kbtStressAfter, t);
              const quality = calculateKbtSessionQuality({
                beliefBefore: kbtBeliefBefore,
                beliefAfter: kbtBeliefAfter,
                negativeThoughtLength: thoughts.negative.length,
                evidenceLength: thoughts.evidence.length,
                alternativeLength: thoughts.alternative.length,
                actionPlanLength: kbtActionPlan.length,
              });
              return (
                <>
                  {adaptiveFeedback && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-3 text-left border border-blue-100 dark:border-blue-800">
                      <p className="text-sm text-blue-700 dark:text-blue-300">{adaptiveFeedback}</p>
                    </div>
                  )}
                  <div className="bg-sky-50 dark:bg-sky-900/20 p-4 rounded-lg mb-4 text-left border border-sky-100 dark:border-sky-800">
                    <p className="text-sm font-semibold text-sky-700 dark:text-sky-300 mb-1">Kvalitet: {quality}/10</p>
                  </div>
                  {stressFeedback && (
                    <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-lg mb-4 text-left border border-rose-100 dark:border-rose-800">
                      <p className="text-sm text-rose-700 dark:text-rose-300">{stressFeedback}</p>
                    </div>
                  )}
                </>
              );
            })()}
            <h4 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-2">
              ✅ KBT-övning Slutförd!
            </h4>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Bra jobbat! Du har framgångsrikt utmanat och ersatt en stressig tanke.
            </p>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h5 className="font-semibold text-green-700 dark:text-green-300 mb-2">Dina framsteg:</h5>
              <p className="text-sm text-green-600 dark:text-green-400">
                <strong>Negativ tanke:</strong> {thoughts.negative || 'Ingen angiven'}<br />
                <strong>Balanserad tanke:</strong> {thoughts.alternative || 'Ingen angiven'}
              </p>
              {typeof kbtBeliefBefore === 'number' && typeof kbtBeliefAfter === 'number' && (
                <p className="text-sm text-green-700 dark:text-green-300 mt-3">
                  <strong>Skattning:</strong> Från {kbtBeliefBefore}% till {kbtBeliefAfter}% ({kbtBeliefAfter - kbtBeliefBefore >= 0 ? '+' : ''}{kbtBeliefAfter - kbtBeliefBefore} procentenheter)
                </p>
              )}
              {typeof kbtStressBefore === 'number' && typeof kbtStressAfter === 'number' && (
                <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                  <strong>Stressnivå:</strong> Från {kbtStressBefore}/100 till {kbtStressAfter}/100 ({kbtStressAfter - kbtStressBefore <= 0 ? '' : '+'}{kbtStressAfter - kbtStressBefore})
                </p>
              )}
              {typeof kbtExecutionConfidenceAfter === 'number' && (
                <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                  <strong>Genomförandetillit:</strong> {kbtExecutionConfidenceAfter}%
                </p>
              )}
              <p className="text-sm text-green-700 dark:text-green-300 mt-3">
                <strong>Ditt nästa steg:</strong> {kbtActionPlan || 'Inget handlingssteg angivet'}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                <strong>Din hinderplan:</strong> {kbtObstaclePlan || 'Ingen hinderplan angiven'}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                <strong>Experimenthypotes:</strong> {kbtExperimentHypothesis || 'Ingen hypotes angiven'}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                <strong>Vad du observerar:</strong> {kbtExperimentMeasure || 'Inget observationsmått angivet'}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                <strong>Sokratisk reflektion:</strong> {kbtSocraticReflection || 'Ingen reflektion angiven'}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                <strong>Om-så plan:</strong> {kbtIfThenPlan || 'Ingen om-så plan angiven'}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                <strong>Coping-kort:</strong> {kbtCopingCard || 'Inget coping-kort angivet'}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                <strong>Uppföljning:</strong> {kbtFollowUpWindow} ({kbtRehearsalContext || 'Sammanhang ej angiven'})
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  }, [phase, thoughts, kbtBeliefBefore, kbtBeliefAfter, kbtStressBefore, kbtStressAfter, kbtActionPlan, kbtExperimentHypothesis, kbtExperimentMeasure, kbtSocraticReflection, kbtIfThenPlan, kbtCopingCard, kbtExecutionConfidenceAfter, kbtObstaclePlan, kbtFollowUpWindow, kbtRehearsalContext, t]);

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg p-6 mb-4 border-2 border-purple-200 dark:border-purple-800">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
        Steg-för-steg guide för att hantera stressiga tankar genom kognitiv beteendeterapi
      </p>

      {/* Progress Indicator */}
      <div className="mb-6">
        <p className="text-center text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">
          {phase === 'complete' ? 'KBT-övning klar' : `Steg ${activeKbtStep} av ${KBT_TOTAL_STEPS}`}
        </p>
        <div className="w-full h-2 bg-purple-100 dark:bg-purple-900/40 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-purple-500 transition-all duration-500"
            style={{ width: `${kbtProgressPercentage}%` }}
          />
        </div>
        <div className="flex justify-center items-center space-x-2">
          {['identify', 'challenge', 'replace', 'practice'].map((phaseName, index) => (
            <div
              key={phaseName}
              className={`w-3 h-3 rounded-full ${index < activeKbtStep
                ? 'bg-purple-500'
                : 'bg-gray-300'
                } `}
            />
          ))}
        </div>
      </div>

      {/* Timer */}
      {isActive && timeLeft > 0 && (
        <div className="text-center mb-4">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {timeLeft}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">kvar på detta steg</p>
        </div>
      )}

      {/* KBT Content */}
      <div className="space-y-4">
        {renderPhase()}
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center gap-3 mt-6">
        {!isActive ? (
          <button
            onClick={start}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            🚀 Starta KBT-övning
          </button>
        ) : phase !== 'complete' ? (
          <>
            <button
              onClick={nextPhase}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
            >
              Nästa Steg →
            </button>
            <button
              onClick={stop}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
            >
              ⏹️ Avbryt
            </button>
          </>
        ) : (
          <button
            onClick={() => { stop(); onComplete?.(); }}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            ✅ Stäng
          </button>
        )}
      </div>
    </div>
  );
};
