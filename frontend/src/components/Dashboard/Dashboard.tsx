import React, { useEffect, useState, useCallback } from "react";
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
import WeeklyAnalysis from "../WeeklyAnalysis";
import RelaxingSounds from "../RelaxingSounds";
import Chatbot from "../Chatbot";
import CrisisAlert from "../CrisisAlert";
import BadgeDisplay from "../BadgeDisplay";
import MoodChart from "./MoodChart";
import MemoryChart from "./MemoryChart";
import { useVoice } from "../../hooks/useVoice";

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
     const { t } = useTranslation();
     const { user } = useAuth();
     const { toggleTheme } = useTheme();
   const [hasLoggedToday, setHasLoggedToday] = useState<boolean>(true);
   const [showMoodLogger, setShowMoodLogger] = useState<boolean>(false);
   const [showMoodList, setShowMoodList] = useState<boolean>(false);
   const [showMemoryRecorder, setShowMemoryRecorder] = useState<boolean>(false);
   const [showMemoryList, setShowMemoryList] = useState<boolean>(false);
   const [showChatbot, setShowChatbot] = useState<boolean>(false);
   const [showRelaxingSounds, setShowRelaxingSounds] = useState<boolean>(false);
   const [analysisRefreshTrigger, setAnalysisRefreshTrigger] = useState<number>(0);
   const [showCrisisAlert, setShowCrisisAlert] = useState<boolean>(false);
   const [crisisMoodScore, setCrisisMoodScore] = useState<number>(0);

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

   const { isSupported: voiceSupported, error: voiceError } = useVoice({
     commands: voiceCommands,
     isListening: true, // Always listening for commands
   });


  const checkTodayMood = useCallback(async () => {
    if (!user?.email) return;

    try {
      const moods = await getMoods(user.user_id);
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
      setHasLoggedToday(loggedToday);
    } catch (error) {
      console.error('Failed to check today mood:', error);
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

  return (
    <DashboardErrorBoundary>
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
        </div>

        {/* Modals */}
        {showMoodLogger && (
          <MoodLogger
            userEmail={user?.email || ""}
            onClose={() => setShowMoodLogger(false)}
            onMoodLogged={() => setAnalysisRefreshTrigger(prev => prev + 1)}
            onCrisisDetected={handleCrisisDetected}
          />
        )}

        {showMoodList && (
          <MoodList onClose={() => setShowMoodList(false)} />
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
    </DashboardErrorBoundary>
  );
};

export default Dashboard;