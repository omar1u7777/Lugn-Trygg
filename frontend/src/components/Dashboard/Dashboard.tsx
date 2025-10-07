import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { getMoods } from "../../api/api";
import { extractDisplayName } from "../../utils/nameUtils";
import { debounce } from "lodash";
import MoodLogger from "../MoodLogger";
import MoodList from "../MoodList";
import MemoryRecorder from "../MemoryRecorder";
import MemoryList from "../MemoryList";
import WeeklyAnalysis from "../WeeklyAnalysis";
import RelaxingSounds from "../RelaxingSounds";
import Chatbot from "../Chatbot";
import CrisisAlert from "../CrisisAlert";
import MoodChart from "./MoodChart";
import MemoryChart from "./MemoryChart";

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
     <div className="dashboard">
       <header className="dashboard-header">
         <h1>{t('dashboard.title')}</h1>
         <p className="welcome-message" aria-live="polite">
           {t('dashboard.welcome')}, {extractDisplayName(user?.email || '')}!
         </p>
        {!hasLoggedToday && (
          <div className="reminder-box" role="alert" aria-live="assertive">
            <strong>{t('dashboard.reminder')}</strong> {t('dashboard.moodReminder')}
          </div>
        )}
      </header>

      <main className="dashboard-grid" role="main" aria-label="Dashboard innehåll">
        <section className="dashboard-section" aria-labelledby="weekly-analysis">
          <WeeklyAnalysis refreshTrigger={analysisRefreshTrigger} />
        </section>

        <section className="dashboard-section" aria-labelledby="mood-trends">
          <h3 id="mood-trends">{t('dashboard.moodTrends')}</h3>
          <MoodChart />
        </section>

        <section className="dashboard-section" aria-labelledby="memory-frequency">
          <h3 id="memory-frequency">{t('dashboard.memoryFrequency')}</h3>
          <MemoryChart />
        </section>

        <section className="dashboard-section" aria-labelledby="relaxing-sounds">
          <RelaxingSounds />
        </section>

        <section className="dashboard-section" aria-labelledby="log-mood">
          <h3 id="log-mood">{t('dashboard.logMood')}</h3>
          <button
            className="dashboard-btn"
            onClick={() => setShowMoodLogger(true)}
            aria-label={t('dashboard.openMoodLogger')}
          >
            {t('dashboard.openMoodLogger')}
          </button>
        </section>

        <section className="dashboard-section" aria-labelledby="mood-logs">
          <h3 id="mood-logs">{t('dashboard.yourMoodLogs')}</h3>
          <button
            className="dashboard-btn"
            onClick={() => setShowMoodList(true)}
            aria-label={t('dashboard.viewMoodLogs')}
          >
            {t('dashboard.viewMoodLogs')}
          </button>
        </section>

        <section className="dashboard-section" aria-labelledby="record-memory">
          <h3 id="record-memory">{t('dashboard.recordMemory')}</h3>
          <button
            className="dashboard-btn"
            onClick={() => setShowMemoryRecorder(true)}
            aria-label={t('dashboard.openRecording')}
          >
            {t('dashboard.openRecording')}
          </button>
        </section>

        <section className="dashboard-section" aria-labelledby="memories">
          <h3 id="memories">{t('dashboard.yourMemories')}</h3>
          <button
            className="dashboard-btn"
            onClick={() => setShowMemoryList(true)}
            aria-label={t('dashboard.viewMemories')}
          >
            {t('dashboard.viewMemories')}
          </button>
        </section>

        <section className="dashboard-section" aria-labelledby="ai-therapist">
          <h3 id="ai-therapist">{t('dashboard.aiTherapist')}</h3>
          <button
            className="dashboard-btn"
            onClick={() => setShowChatbot(true)}
            aria-label={t('dashboard.openChat')}
          >
            {t('dashboard.openChat')}
          </button>
        </section>
      </main>

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
      </div>
    </DashboardErrorBoundary>
  );
};

export default Dashboard;