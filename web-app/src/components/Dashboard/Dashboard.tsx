import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { getMoods } from "../../api/api";
import { extractDisplayName } from "../../utils/nameUtils";
import { debounce } from "lodash";

// Modern Layout Components
import { DashboardLayout, DashboardHeader, DashboardGrid, DashboardSection } from "./Layout";
import { BaseWidget, ActionCard } from "./Widgets";

// Feature Components
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
import ReferralWidget from "./ReferralWidget";
import FeedbackWidget from "./FeedbackWidget";
import AnalyticsWidget from "./AnalyticsWidget";
import QuickStatsWidget from "./QuickStatsWidget";
import ActivityFeed from "./ActivityFeed";
import QuickNavigation from "./QuickNavigation";
import IntegrationWidget from "./IntegrationWidget";
import OnboardingFlow from "../OnboardingFlow";
import NotificationPermission from "../NotificationPermission";

// Hooks & Services
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8">
          <span className="text-6xl mb-4 block">⚠️</span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {t('dashboard.error')}
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Något gick fel. Vänligen ladda om sidan.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toggleTheme } = useTheme();
  const { onboardingComplete, completeOnboarding } = useOnboarding(user?.user_id);

  // Modal States
  const [hasLoggedToday, setHasLoggedToday] = useState<boolean>(true);
  const [showMoodLogger, setShowMoodLogger] = useState<boolean>(false);
  const [showMoodList, setShowMoodList] = useState<boolean>(false);
  const [showMemoryRecorder, setShowMemoryRecorder] = useState<boolean>(false);
  const [showMemoryList, setShowMemoryList] = useState<boolean>(false);
  const [showChatbot, setShowChatbot] = useState<boolean>(false);
  const [showRelaxingSounds, setShowRelaxingSounds] = useState<boolean>(false);
  const [showCrisisAlert, setShowCrisisAlert] = useState<boolean>(false);
  const [crisisMoodScore, setCrisisMoodScore] = useState<number>(0);
  const [showNotificationPermission, setShowNotificationPermission] = useState<boolean>(false);
  const [, setAnalysisRefreshTrigger] = useState<number>(0);
  const notificationCloseHandledRef = useRef(false);

  const displayName = extractDisplayName(user?.email || '');

  // Crisis Detection Handler
  const handleCrisisDetected = (score: number) => {
    setCrisisMoodScore(score);
    setShowCrisisAlert(true);
  };

  // Check if user has logged mood today
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

  // Voice Commands
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
    isListening: true,
  });

  // Track first load
  useEffect(() => {
    if (!onboardingComplete && user?.user_id) {
      trackEvent('dashboard_loaded_first_time', { userId: user.user_id });
    }
  }, [user?.user_id, onboardingComplete]);

  // Show notification permission after onboarding
  useEffect(() => {
    let timer: number | undefined;
    if (onboardingComplete && !showNotificationPermission) {
      const PROMPT_FLAG_KEY = 'notifications_prompt_v1';
      const alreadyPrompted = typeof window !== 'undefined' && localStorage.getItem(PROMPT_FLAG_KEY);
      const canNotify = typeof window !== 'undefined' && 'Notification' in window;
      const permission: NotificationPermission | undefined = canNotify ? Notification.permission : undefined;

      if (!alreadyPrompted && canNotify && permission === 'default') {
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
      {/* Onboarding Flow */}
      {!onboardingComplete && (
        <OnboardingFlow 
          onComplete={() => {
            completeOnboarding();
            trackEvent('onboarding_completed_dashboard', { userId: user?.user_id });
          }}
          userId={user?.user_id || ''}
        />
      )}

      {/* Main Dashboard Content */}
      {onboardingComplete && (
        <DashboardLayout>
          {/* Header Section */}
          <DashboardHeader
            userName={displayName}
            title={t('dashboard.title')}
            subtitle={t('dashboard.welcome')}
            showReminder={!hasLoggedToday}
            reminderMessage={t('dashboard.moodReminder')}
          >
            {/* First time return message */}
            {!localStorage.getItem(`first_login_${user?.user_id}`) && (
              <div 
                className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-xl p-6 shadow-lg mb-6"
                onAnimationEnd={() => {
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
                      Du är nu redo att börja din resa med Lugn & Trygg.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Header Widgets */}
            {user?.user_id && (
              <>
                <div className="mb-4">
                  <ReferralWidget userId={user.user_id} />
                </div>
                <div className="mb-4">
                  <QuickStatsWidget userId={user.user_id} />
                </div>
                <QuickNavigation />
              </>
            )}
          </DashboardHeader>

          {/* Achievements Section */}
          <DashboardSection 
            title={t('dashboard.achievements', 'Dina Prestationer')}
            icon="🏆"
            delay={0.1}
          >
            <BadgeDisplay />
          </DashboardSection>

          {/* Quick Actions Section */}
          <DashboardSection 
            title="Snabbåtgärder" 
            icon="⚡"
            subtitle="Starta din dag rätt"
            delay={0.2}
          >
            <DashboardGrid columns={{ mobile: 1, tablet: 2, desktop: 4 }} gap="md">
              <ActionCard
                title={t('dashboard.logMood')}
                description="Spåra ditt känslotillstånd idag"
                icon="🎭"
                onClick={() => setShowMoodLogger(true)}
                variant="primary"
                buttonText={t('dashboard.openMoodLogger')}
                delay={0.25}
              />
              <ActionCard
                title={t('dashboard.recordMemory')}
                description="Dokumentera ett viktigt minne"
                icon="🎙️"
                onClick={() => setShowMemoryRecorder(true)}
                variant="secondary"
                buttonText={t('dashboard.openRecording')}
                delay={0.3}
              />
              <ActionCard
                title={t('dashboard.yourMoodLogs')}
                description="Se din humörhistorik"
                icon="📝"
                onClick={() => setShowMoodList(true)}
                variant="success"
                buttonText={t('dashboard.viewMoodLogs')}
                delay={0.35}
              />
              <ActionCard
                title={t('dashboard.yourMemories')}
                description="Utforska dina minnen"
                icon="💭"
                onClick={() => setShowMemoryList(true)}
                variant="warning"
                buttonText={t('dashboard.viewMemories')}
                delay={0.4}
              />
            </DashboardGrid>
          </DashboardSection>

          {/* Analytics Section */}
          <DashboardGrid columns={{ mobile: 1, tablet: 2, desktop: 2 }} gap="lg">
            {/* Mood Trends */}
            <BaseWidget
              title={t('dashboard.moodTrends')}
              icon="📊"
              variant="primary"
              size="lg"
              delay={0.45}
            >
              <MoodChart />
            </BaseWidget>

            {/* Memory Frequency */}
            <BaseWidget
              title={t('dashboard.memoryFrequency')}
              icon="🧠"
              variant="secondary"
              size="lg"
              delay={0.5}
            >
              <MemoryChart />
            </BaseWidget>
          </DashboardGrid>

          {/* Secondary Features Grid */}
          <DashboardGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }} gap="lg">
            {/* Activity Feed */}
            {user?.user_id && (
              <BaseWidget
                title="Senaste Aktivitet"
                icon="📝"
                size="md"
                delay={0.55}
              >
                <ActivityFeed userId={user.user_id} />
              </BaseWidget>
            )}

            {/* Feedback Widget */}
            {user?.user_id && (
              <BaseWidget
                title="Feedback"
                icon="💬"
                subtitle="Hjälp oss förbättras"
                size="md"
                delay={0.6}
              >
                <FeedbackWidget userId={user.user_id} />
              </BaseWidget>
            )}

            {/* Analytics Widget */}
            {user?.user_id && (
              <BaseWidget
                title="AI Analys"
                icon="🤖"
                subtitle="Personliga insikter"
                size="md"
                variant="primary"
                delay={0.65}
              >
                <AnalyticsWidget userId={user.user_id} />
              </BaseWidget>
            )}
          </DashboardGrid>

          {/* Additional Actions Section */}
          <DashboardSection 
            title="Mer Funktioner" 
            icon="🌟"
            delay={0.7}
          >
            <DashboardGrid columns={{ mobile: 1, tablet: 2, desktop: 4 }} gap="md">
              <ActionCard
                title={t('dashboard.relaxingSounds', 'Lugn Musik')}
                description="Avslappnande ljud och meditation"
                icon="🎵"
                onClick={() => setShowRelaxingSounds(true)}
                variant="success"
                buttonText="Lyssna"
                delay={0.75}
              />
              <ActionCard
                title={t('dashboard.aiTherapist')}
                description="Chatta med vår AI-terapeut"
                icon="🤖"
                onClick={() => setShowChatbot(true)}
                variant="gradient"
                buttonText={t('dashboard.openChat')}
                delay={0.8}
              />
              <ActionCard
                title="Referensprogram"
                description="Bjud in vänner och få belöningar"
                icon="🤝"
                onClick={() => window.location.href = '/referral'}
                variant="primary"
                buttonText="Visa min kod"
                delay={0.85}
              />
              {user?.user_id && (
                <BaseWidget
                  title="Hälsointegrationer"
                  icon="❤️"
                  size="sm"
                  delay={0.9}
                >
                  <IntegrationWidget userId={user.user_id} />
                </BaseWidget>
              )}
            </DashboardGrid>
          </DashboardSection>

          {/* Health Integration Promotion */}
          <DashboardSection 
            title="🎯 Koppla din hälsadata" 
            subtitle="För bättre insikter"
            delay={0.95}
          >
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-8 border-2 border-emerald-200 dark:border-emerald-800 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="text-4xl">💪</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mb-2">
                    Synkronisera din fysiska hälsa
                  </h3>
                  <p className="text-emerald-800 dark:text-emerald-200 mb-4">
                    Koppla Google Fit, Fitbit, Samsung Health eller Withings. Få personliga AI-drivna rekommendationer baserade på din aktivitet, hjärtfrekvens och sömn.
                  </p>
                  <DashboardGrid columns={{ mobile: 2, tablet: 4, desktop: 4 }} gap="sm">
                    <div className="text-center">
                      <p className="text-2xl mb-1">🏃</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">Aktivitet</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl mb-1">❤️</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">Hjärtfrekvens</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl mb-1">😴</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">Sömn</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl mb-1">🔥</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">Kalorier</p>
                    </div>
                  </DashboardGrid>
                  <a 
                    href="/integrations" 
                    className="inline-block mt-4 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    ➜ Anslut dina enheter
                  </a>
                </div>
              </div>
            </div>
          </DashboardSection>
        </DashboardLayout>
      )}

      {/* Modals */}
      {showMoodLogger && (
        <MoodLogger
          userEmail={user?.email || ""}
          onClose={() => {
            setShowMoodLogger(false);
            checkTodayMood();
          }}
          onMoodLogged={() => {
            setAnalysisRefreshTrigger(prev => prev + 1);
            checkTodayMood();
          }}
          onCrisisDetected={handleCrisisDetected}
        />
      )}

      {showMoodList && (
        <MoodList onClose={() => {
          setShowMoodList(false);
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
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" 
          onClick={() => setShowChatbot(false)}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden" 
            onClick={(e) => e.stopPropagation()}
          >
            <Chatbot />
          </div>
        </div>
      )}

      <CrisisAlert
        isOpen={showCrisisAlert}
        onClose={() => setShowCrisisAlert(false)}
        moodScore={crisisMoodScore}
      />

      {/* Notification Permission Dialog */}
      <NotificationPermission
        open={showNotificationPermission && onboardingComplete}
        onClose={(granted) => {
          if (notificationCloseHandledRef.current) return;
          notificationCloseHandledRef.current = true;

          setShowNotificationPermission(false);

          try {
            const PROMPT_FLAG_KEY = 'notifications_prompt_v1';
            localStorage.setItem(PROMPT_FLAG_KEY, granted ? 'granted' : 'dismissed');
          } catch {}

          if (granted) {
            trackEvent('notifications_enabled', { userId: user?.user_id });
          } else {
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
