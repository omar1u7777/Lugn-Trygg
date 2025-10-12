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
        className="dashboard"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.header
          className="dashboard-header"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <h1>{t('dashboard.title')}</h1>
          <p className="welcome-message" aria-live="polite">
            {t('dashboard.welcome')}, {extractDisplayName(user?.email || '')}!
          </p>
         {!hasLoggedToday && (
           <motion.div
             className="reminder-box"
             role="alert"
             aria-live="assertive"
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             transition={{ delay: 0.3, duration: 0.3 }}
           >
             <strong>{t('dashboard.reminder')}</strong> {t('dashboard.moodReminder')}
           </motion.div>
         )}
       </motion.header>

      <motion.main
        className="dashboard-grid"
        role="main"
        aria-label="Dashboard innehåll"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <motion.section
          className="dashboard-section"
          aria-labelledby="weekly-analysis"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <WeeklyAnalysis refreshTrigger={analysisRefreshTrigger} />
        </motion.section>

        <motion.section
          className="dashboard-section"
          aria-labelledby="achievements"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <BadgeDisplay />
        </motion.section>

        <motion.section
          className="dashboard-section"
          aria-labelledby="mood-trends"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <h3 id="mood-trends">{t('dashboard.moodTrends')}</h3>
          <MoodChart />
        </motion.section>

        <motion.section
          className="dashboard-section"
          aria-labelledby="memory-frequency"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <h3 id="memory-frequency">{t('dashboard.memoryFrequency')}</h3>
          <MemoryChart />
        </motion.section>

        <motion.section
          className="dashboard-section"
          aria-labelledby="relaxing-sounds"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <RelaxingSounds />
        </motion.section>

        <motion.section
          className="dashboard-section"
          aria-labelledby="log-mood"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <h3 id="log-mood">{t('dashboard.logMood')}</h3>
          <button
            className="dashboard-btn"
            onClick={() => setShowMoodLogger(true)}
            aria-label={t('dashboard.openMoodLogger')}
          >
            {t('dashboard.openMoodLogger')}
          </button>
        </motion.section>

        <motion.section
          className="dashboard-section"
          aria-labelledby="mood-logs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        >
          <h3 id="mood-logs">{t('dashboard.yourMoodLogs')}</h3>
          <button
            className="dashboard-btn"
            onClick={() => setShowMoodList(true)}
            aria-label={t('dashboard.viewMoodLogs')}
          >
            {t('dashboard.viewMoodLogs')}
          </button>
        </motion.section>

        <motion.section
          className="dashboard-section"
          aria-labelledby="record-memory"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.5 }}
        >
          <h3 id="record-memory">{t('dashboard.recordMemory')}</h3>
          <button
            className="dashboard-btn"
            onClick={() => setShowMemoryRecorder(true)}
            aria-label={t('dashboard.openRecording')}
          >
            {t('dashboard.openRecording')}
          </button>
        </motion.section>

        <motion.section
          className="dashboard-section"
          aria-labelledby="memories"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.5 }}
        >
          <h3 id="memories">{t('dashboard.yourMemories')}</h3>
          <button
            className="dashboard-btn"
            onClick={() => setShowMemoryList(true)}
            aria-label={t('dashboard.viewMemories')}
          >
            {t('dashboard.viewMemories')}
          </button>
        </motion.section>

        <motion.section
          className="dashboard-section"
          aria-labelledby="ai-therapist"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          <h3 id="ai-therapist">{t('dashboard.aiTherapist')}</h3>
          <button
            className="dashboard-btn"
            onClick={() => setShowChatbot(true)}
            aria-label={t('dashboard.openChat')}
          >
            {t('dashboard.openChat')}
          </button>
        </motion.section>
      </motion.main>

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

      {showChatbot && (
        <div className="modal-overlay" onClick={() => setShowChatbot(false)}>
          <div className="modal-content chatbot-modal" onClick={(e) => e.stopPropagation()}>
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