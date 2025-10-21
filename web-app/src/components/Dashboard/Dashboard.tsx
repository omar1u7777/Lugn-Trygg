import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { getMoods } from "../../api/api";
import { extractDisplayName } from "../../utils/nameUtils";
import { debounce } from "lodash";
import { motion } from "framer-motion";
import MoodLogger from "../MoodLogger";
import MoodList from "../MoodList";
import MemoryRecorder from "../MemoryRecorder";
import MemoryList from "../MemoryList";
import RelaxingSounds from "../RelaxingSounds";
import Chatbot from "../Chatbot";
import CrisisAlert from "../CrisisAlert";
import BadgeDisplay from "../BadgeDisplay";
import MoodChart from "./MoodChart";
import MemoryChart from "./MemoryChart";
import OnboardingFlow from "../OnboardingFlow";
import NotificationPermission from "../NotificationPermission";
// import EmojiMoodSelector from "../EmojiMoodSelector";
// import JournalEntry from "../JournalEntry";
// import DailyInsights from "../DailyInsights";
import { useVoice } from "../../hooks/useVoice";
import { useOnboarding } from "../../hooks/useOnboarding";
import { trackEvent } from "../../services/analytics";

const DashboardErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return <div>{t('dashboard.error')}</div>;
  }

  return <>{children}</>;
};


const Dashboard: React.FC = () => {
  // ...existing code...
  // Add personalized welcome and progress tracking to dashboard UI
  // Place this at the top of the main dashboard render
  // Example:
  // <header aria-label="User Welcome" role="banner" className="dashboard-welcome">
  //   <h1 tabIndex={0}>{t('dashboard.welcome')}, {displayName}!</h1>
  //   <p tabIndex={0}>{t('dashboard.streak', { count: streak })}</p>
  //   {goals.length > 0 && (
  //     <ul aria-label="User Goals">
  //       {goals.map((goal: string, idx: number) => (
  //         <li key={idx} tabIndex={0}>{goal}</li>
  //       ))}
  //     </ul>
  //   )}
  // </header>
     const { t } = useTranslation();
     const { user } = useAuth();
     const { toggleTheme } = useTheme();
     const { onboardingComplete, completeOnboarding } = useOnboarding(user?.user_id);

   const [hasLoggedToday, setHasLoggedToday] = useState<boolean>(true);
   const [showMoodLogger, setShowMoodLogger] = useState<boolean>(false);
   const [showMoodList, setShowMoodList] = useState<boolean>(false);
   const [showMemoryRecorder, setShowMemoryRecorder] = useState<boolean>(false);
   const [showMemoryList, setShowMemoryList] = useState<boolean>(false);
   const [showChatbot, setShowChatbot] = useState<boolean>(false);
   const [showRelaxingSounds, setShowRelaxingSounds] = useState<boolean>(false);
   const [, setAnalysisRefreshTrigger] = useState<number>(0);
   const [showCrisisAlert, setShowCrisisAlert] = useState<boolean>(false);
   const [crisisMoodScore, setCrisisMoodScore] = useState<number>(0);
   const [showNotificationPermission, setShowNotificationPermission] = useState<boolean>(false);
   const notificationCloseHandledRef = useRef(false);
   
   // New state for expanded mood logging features (commented out - not used yet)
   // const [showEmojiMoodSelector, setShowEmojiMoodSelector] = useState<boolean>(false);
   // const [showJournalEntry, setShowJournalEntry] = useState<boolean>(false);
   // const [moodData, setMoodData] = useState<any[]>([]);

   // Personalized welcome message and ARIA attributes for accessibility (commented out - not used yet)
   // const displayName = user?.displayName || user?.email || t('dashboard.user');
   // const streak = user?.streak || 0;
   // const goals = user?.goals || [];

   const handleCrisisDetected = (score: number) => {
     setCrisisMoodScore(score);
     setShowCrisisAlert(true);
   };

   // Voice commands setup
   const voiceCommands = [
     {
       command: 'logMood',
       action: () => setShowMoodLogger(true),
       keywords: t('voice.commands.logMood', { returnObjects: true }) as string[],
     },
     {
       command: 'recordMemory',
       action: () => setShowMemoryRecorder(true),
       keywords: t('voice.commands.recordMemory', { returnObjects: true }) as string[],
     },
     {
       command: 'openChat',
       action: () => setShowChatbot(true),
       keywords: t('voice.commands.openChat', { returnObjects: true }) as string[],
     },
     {
       command: 'toggleTheme',
       action: toggleTheme,
       keywords: t('voice.commands.toggleTheme', { returnObjects: true }) as string[],
     },
     {
       command: 'viewMoods',
       action: () => setShowMoodList(true),
       keywords: t('voice.commands.viewMoods', { returnObjects: true }) as string[],
     },
     {
       command: 'viewMemories',
       action: () => setShowMemoryList(true),
       keywords: t('voice.commands.viewMemories', { returnObjects: true }) as string[],
     },
   ];

   useVoice({
     commands: voiceCommands,
     isListening: true, // Always listening for commands
   });


  const checkTodayMood = useCallback(async () => {
    if (!user?.email) return;

    try {
      const moods = await getMoods(user.user_id);
      console.log("📊 Kontrollerar dagens humör:", moods);
      
      const today = new Date().toDateString();
      const loggedToday = moods.some((mood: any) => {
        const timestamp = mood.timestamp;
        if (!timestamp) return false;
        try {
          // Handle Firestore Timestamp objects
          const moodDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
          if (isNaN(moodDate.getTime())) return false;
          return moodDate.toDateString() === today;
        } catch {
          return false;
        }
      });
      
      console.log("✅ Loggat idag:", loggedToday);
      setHasLoggedToday(loggedToday);
    } catch (error) {
      console.error('❌ Misslyckades att kontrollera dagens humör:', error);
      // Default to true to avoid excessive API calls and annoying reminders on errors
      setHasLoggedToday(true);
    }
  }, [user?.email, user?.user_id]);

  const debouncedCheckTodayMood = useCallback(
    debounce(checkTodayMood, 500),
    [checkTodayMood]
  );

  useEffect(() => {
    debouncedCheckTodayMood();
    return () => debouncedCheckTodayMood.cancel();
  }, [debouncedCheckTodayMood]);

  // Show onboarding on first visit
  useEffect(() => {
    if (!onboardingComplete && user?.user_id) {
      trackEvent('dashboard_loaded_first_time', { userId: user.user_id });
    }
  }, [user?.user_id, onboardingComplete]);

  // Show notification permission after onboarding is complete (only once, and only if not already granted/denied)
  // --- Notification Prompt Logic ---
  // The notification dialog is shown only if:
  //   - Onboarding is complete
  //   - Notification.permission is 'default' (not granted/denied)
  //   - No prior prompt flag exists in localStorage (notifications_prompt_v1)
  // When the dialog closes, we persist notifications_prompt_v1 as 'granted' or 'dismissed'.
  // This prevents the dialog from reopening on future visits.
  useEffect(() => {
    let timer: number | undefined;
    if (onboardingComplete && !showNotificationPermission) {
      // Avoid prompting if we've already handled this once
      const PROMPT_FLAG_KEY = 'notifications_prompt_v1';
      const alreadyPrompted = typeof window !== 'undefined' && localStorage.getItem(PROMPT_FLAG_KEY);

      // Only show if the Notification API exists and permission is still default
      const canNotify = typeof window !== 'undefined' && 'Notification' in window;
      const permission: NotificationPermission | undefined = canNotify ? Notification.permission : undefined;

      if (!alreadyPrompted && canNotify && permission === 'default') {
        // Delay to let onboarding animation finish
        timer = window.setTimeout(() => {
          setShowNotificationPermission(true);
        }, 500);
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [onboardingComplete, showNotificationPermission]);

  return (
    <DashboardErrorBoundary>
      {/* Show onboarding flow if not complete */}
      {!onboardingComplete && (
        <OnboardingFlow 
          onComplete={() => {
            completeOnboarding();
            trackEvent('onboarding_completed_dashboard', { userId: user?.user_id });
          }}
          userId={user?.user_id || ''}
        />
      )}

      {/* Main dashboard content (hidden during onboarding) */}
      {onboardingComplete && (
      <motion.div
        className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 pt-24 pb-8 px-4 sm:px-6 lg:px-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container-custom">
          <motion.header
            className="text-center mb-12"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              {t('dashboard.title')}
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 mb-6" aria-live="polite">
              {t('dashboard.welcome')}, {extractDisplayName(user?.email || '')}!
            </p>
           
            {/* First time return message (shown once after onboarding) */}
            {onboardingComplete && !localStorage.getItem(`first_login_${user?.user_id}`) && (
              <motion.div
                className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-xl p-6 max-w-2xl mx-auto shadow-lg mb-6"
                role="status"
                aria-live="polite"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                onAnimationComplete={() => {
                  // Mark first login as complete so this message doesn't show again
                  localStorage.setItem(`first_login_${user?.user_id}`, 'true');
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🎉</span>
                  <div>
                    <strong className="text-emerald-800 dark:text-emerald-200 font-semibold text-lg">
                      Välkommen tillbaka!
                    </strong>
                    <p className="text-emerald-700 dark:text-emerald-300 mt-1">
                      Du är nu redo att börja din resa med Lugn & Trygg. Börja genom att spåra din nuvarande humör eller utforska dina nya mål.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
           
            {!hasLoggedToday && (
             <motion.div
               className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl p-6 max-w-2xl mx-auto shadow-lg"
               role="alert"
               aria-live="assertive"
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               transition={{ delay: 0.3, duration: 0.3 }}
             >
               <div className="flex items-center gap-3">
                 <span className="text-2xl">💡</span>
                 <div>
                   <strong className="text-yellow-800 dark:text-yellow-300 font-semibold">
                     {t('dashboard.reminder')}
                   </strong>
                   <p className="text-yellow-700 dark:text-yellow-400 mt-1">
                     {t('dashboard.moodReminder')}
                   </p>
                 </div>
               </div>
             </motion.div>
           )}
          </motion.header>

          {/* Analytics Section - Stacked Layout */}
          <motion.section
            className="space-y-8 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {/* Achievements - Top */}
            <motion.div
              className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-soft border border-slate-200 dark:border-slate-700"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <BadgeDisplay />
            </motion.div>


            {/* Mood Trends - Bottom */}
            <motion.div
              className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-2xl p-8 border border-primary-200 dark:border-primary-700 shadow-soft"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
                <span className="text-primary-500">📊</span>
                {t('dashboard.moodTrends')}
              </h3>
              <MoodChart />
            </motion.div>
          </motion.section>

          {/* Action Buttons Section */}
          <motion.section
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <motion.div
              className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 rounded-2xl p-6 shadow-soft border border-primary-200 dark:border-primary-700 hover:shadow-medium transition-all duration-300"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7, duration: 0.3 }}
              whileHover={{ y: -2, scale: 1.02 }}
            >
              <div className="text-center mb-4">
                <div className="w-16 h-16 mx-auto mb-3 bg-primary-500 rounded-full flex items-center justify-center text-white text-2xl shadow-lg">
                  🎭
                </div>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 text-center">
                {t('dashboard.logMood')}
              </h3>
              <button
                className="btn btn-primary w-full py-3 text-base font-semibold bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-lg hover:shadow-xl transition-all duration-200"
                onClick={() => setShowMoodLogger(true)}
                aria-label={t('dashboard.openMoodLogger')}
              >
                <span className="mr-2">🎤</span>
                {t('dashboard.openMoodLogger')}
              </button>
            </motion.div>

            <motion.div
              className="bg-gradient-to-br from-secondary-50 to-secondary-100 dark:from-secondary-900/30 dark:to-secondary-800/30 rounded-2xl p-6 shadow-soft border border-secondary-200 dark:border-secondary-700 hover:shadow-medium transition-all duration-300"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.3 }}
              whileHover={{ y: -2, scale: 1.02 }}
            >
              <div className="text-center mb-4">
                <div className="w-16 h-16 mx-auto mb-3 bg-secondary-500 rounded-full flex items-center justify-center text-white text-2xl shadow-lg">
                  🎙️
                </div>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 text-center">
                {t('dashboard.recordMemory')}
              </h3>
              <button
                className="btn btn-primary w-full py-3 text-base font-semibold bg-gradient-to-r from-secondary-500 to-secondary-600 hover:from-secondary-600 hover:to-secondary-700 shadow-lg hover:shadow-xl transition-all duration-200"
                onClick={() => setShowMemoryRecorder(true)}
                aria-label={t('dashboard.openRecording')}
              >
                <span className="mr-2">🎬</span>
                {t('dashboard.openRecording')}
              </button>
            </motion.div>

            <motion.div
              className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 rounded-2xl p-6 shadow-soft border border-slate-300 dark:border-slate-600 hover:shadow-medium transition-all duration-300"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9, duration: 0.3 }}
              whileHover={{ y: -2, scale: 1.02 }}
            >
              <div className="text-center mb-4">
                <div className="w-16 h-16 mx-auto mb-3 bg-slate-500 rounded-full flex items-center justify-center text-white text-2xl shadow-lg">
                  📝
                </div>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 text-center">
                {t('dashboard.yourMoodLogs')}
              </h3>
              <button
                className="btn btn-secondary w-full py-3 text-base font-semibold bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 shadow-lg hover:shadow-xl transition-all duration-200"
                onClick={() => setShowMoodList(true)}
                aria-label={t('dashboard.viewMoodLogs')}
              >
                <span className="mr-2">📋</span>
                {t('dashboard.viewMoodLogs')}
              </button>
            </motion.div>

            <motion.div
              className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 rounded-2xl p-6 shadow-soft border border-slate-300 dark:border-slate-600 hover:shadow-medium transition-all duration-300"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.0, duration: 0.3 }}
              whileHover={{ y: -2, scale: 1.02 }}
            >
              <div className="text-center mb-4">
                <div className="w-16 h-16 mx-auto mb-3 bg-slate-500 rounded-full flex items-center justify-center text-white text-2xl shadow-lg">
                  💭
                </div>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 text-center">
                {t('dashboard.yourMemories')}
              </h3>
              <button
                className="btn btn-secondary w-full py-3 text-base font-semibold bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 shadow-lg hover:shadow-xl transition-all duration-200"
                onClick={() => setShowMemoryList(true)}
                aria-label={t('dashboard.viewMemories')}
              >
                <span className="mr-2">📚</span>
                {t('dashboard.viewMemories')}
              </button>
            </motion.div>
          </motion.section>

          {/* Additional Features Section */}
          <motion.section
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.5 }}
          >
            <motion.div
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-soft border border-slate-200 dark:border-slate-700"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2, duration: 0.5 }}
            >
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <span className="text-primary-500">🧠</span>
                {t('dashboard.memoryFrequency')}
              </h3>
              <MemoryChart />
            </motion.div>

            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.3, duration: 0.5 }}
            >
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-soft border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <span className="text-green-500">🎵</span>
                  {t('dashboard.relaxingSounds', 'Lugn Musik')}
                </h3>
                <button
                  className="btn btn-primary w-full py-3 text-base font-semibold"
                  onClick={() => setShowRelaxingSounds(true)}
                  aria-label={t('dashboard.openRelaxingSounds', 'Öppna lugn musik')}
                >
                  <span className="mr-2">🎵</span>
                  {t('dashboard.openRelaxingSounds', 'Öppna Musik')}
                </button>
              </div>

              <div className="bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-2xl p-6 border border-primary-200 dark:border-primary-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <span className="text-primary-500">🤖</span>
                  {t('dashboard.aiTherapist')}
                </h3>
                <button
                  className="btn btn-primary w-full py-3 text-base font-semibold"
                  onClick={() => setShowChatbot(true)}
                  aria-label={t('dashboard.openChat')}
                >
                  <span className="mr-2">💬</span>
                  {t('dashboard.openChat')}
                </button>
              </div>
            </motion.div>
          </motion.section>

          {/* Health Integration Promotion Section */}
          <motion.section
            className="mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.5 }}
          >
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-8 border-2 border-emerald-200 dark:border-emerald-800 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="text-4xl">💪</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mb-2">
                    🎯 Koppla din hälsadata för bättre insikter
                  </h3>
                  <p className="text-emerald-800 dark:text-emerald-200 mb-3">
                    Synkronisera din aktivitet, hjärtfrekvens och sömn från Google Fit, Fitbit, Samsung Health eller Withings. Kombinera din fysiska hälsa med din mentala välmående för att få personliga AI-drivna rekommendationer.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="text-center">
                      <p className="text-2xl">🏃</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">Aktivitet</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl">❤️</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">Hjärtfrekvens</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl">😴</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">Sömn</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl">🔥</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">Kalorier</p>
                    </div>
                  </div>
                  <a href="/integrations" className="inline-block px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors">
                    ➜ Anslut dina enheter
                  </a>
                </div>
              </div>
            </div>
          </motion.section>
        </div>

        {/* Modals */}
        {showMoodLogger && (
          <MoodLogger
            userEmail={user?.email || ""}
            onClose={() => {
              setShowMoodLogger(false);
              // Refresh mood check after closing
              checkTodayMood();
            }}
            onMoodLogged={() => {
              setAnalysisRefreshTrigger(prev => prev + 1);
              // Refresh mood check immediately after logging
              checkTodayMood();
            }}
            onCrisisDetected={handleCrisisDetected}
          />
        )}

        {showMoodList && (
          <MoodList onClose={() => {
            setShowMoodList(false);
            // Refresh mood check when closing list
            checkTodayMood();
          }} />
        )}

        {showMemoryRecorder && (
          <MemoryRecorder
            userId={user?.user_id || ""}
            onClose={() => setShowMemoryRecorder(false)}
          />
        )}

        {showMemoryList && (
          <MemoryList onClose={() => setShowMemoryList(false)} />
        )}

        {showRelaxingSounds && (
          <RelaxingSounds onClose={() => setShowRelaxingSounds(false)} />
        )}

        {showChatbot && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setShowChatbot(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <Chatbot />
            </div>
          </div>
        )}

        <CrisisAlert
          isOpen={showCrisisAlert}
          onClose={() => setShowCrisisAlert(false)}
          moodScore={crisisMoodScore}
        />
      </motion.div>
      )}

      {/* Notification permission dialog */}
  // --- NotificationPermission: onClose is guarded to run only once per mount to avoid duplicate analytics events.
  <NotificationPermission
        open={showNotificationPermission && onboardingComplete}
        onClose={(granted) => {
          // Ensure we only handle close once to avoid duplicate events
          if (notificationCloseHandledRef.current) return;
          notificationCloseHandledRef.current = true;

          setShowNotificationPermission(false);

          // Persist a one-time flag to avoid re-opening the dialog next visits
          try {
            const PROMPT_FLAG_KEY = 'notifications_prompt_v1';
            localStorage.setItem(PROMPT_FLAG_KEY, granted ? 'granted' : 'dismissed');
          } catch {}

          if (granted) {
            trackEvent('notifications_enabled', { userId: user?.user_id });
          } else {
            // Optional: track that user dismissed
            trackEvent('notifications_prompt_dismissed', { userId: user?.user_id });
          }
        }}
        {
          ...(user?.user_id
            ? ({ userId: user.user_id } as Pick<React.ComponentProps<typeof NotificationPermission>, 'userId'>)
            : {})
        }
      />
    </DashboardErrorBoundary>
  );
};

export default Dashboard;