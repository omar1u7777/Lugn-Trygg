import { Routes, Route } from "react-router-dom";
import { useEffect, useState, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import ProtectedRoute from "./components/Layout/ProtectedRoute";
import NavigationPro from "./components/Layout/NavigationPro";
import FeatureNavigationHub from "./components/FeatureNavigationHub";
import AppLayout from "./components/AppLayout";
import TestPage from "./components/TestPage";
import TestingStrategy from "./components/TestingStrategy";
import { usePageTracking } from "./hooks/useAnalytics";
import { LoadingSpinner } from "./components/LoadingStates";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles/styles.css";
import "./styles/responsive.css"; // Enhanced responsive design system
import "./styles/design-system.css"; // Professional design system v2.0
import "./styles/animations.css"; // Professional animations & micro-interactions
import "./styles/world-class-design.css"; // WORLD-CLASS UNIFIED DESIGN SYSTEM

// Lazy load route components for code splitting with error boundaries
const LoginForm = lazy(() => import(/* webpackChunkName: "auth" */ "./components/Auth/LoginForm"));
const RegisterForm = lazy(() => import(/* webpackChunkName: "auth" */ "./components/Auth/RegisterForm"));
const WorldClassDashboard = lazy(() => import(/* webpackChunkName: "dashboard" */ "./components/WorldClassDashboard"));
const SubscriptionForm = lazy(() => import(/* webpackChunkName: "subscription" */ "./components/SubscriptionForm"));
const AIStories = lazy(() => import(/* webpackChunkName: "ai-stories" */ "./components/AIStories"));
const MoodAnalytics = lazy(() => import(/* webpackChunkName: "analytics" */ "./components/MoodAnalytics"));
const OAuthHealthIntegrations = lazy(() => import(/* webpackChunkName: "integrations" */ "./components/Integrations/OAuthHealthIntegrations"));
const ReferralProgram = lazy(() => import(/* webpackChunkName: "referral" */ "./components/Referral/ReferralProgram"));
const FeedbackForm = lazy(() => import(/* webpackChunkName: "feedback" */ "./components/Feedback/FeedbackForm"));
const WellnessHub = lazy(() => import(/* webpackChunkName: "wellness" */ "./components/WellnessHub"));
const SocialHub = lazy(() => import(/* webpackChunkName: "social" */ "./components/SocialHub"));
const JournalHub = lazy(() => import(/* webpackChunkName: "journal" */ "./components/JournalHub"));
const InsightsHub = lazy(() => import(/* webpackChunkName: "insights" */ "./components/InsightsHub"));
const RewardsHub = lazy(() => import(/* webpackChunkName: "rewards" */ "./components/RewardsHub"));
const ProfileHub = lazy(() => import(/* webpackChunkName: "profile" */ "./components/ProfileHub"));

// Additional feature components - making ALL components accessible
const WorldClassAIChat = lazy(() => import(/* webpackChunkName: "ai-chat" */ "./components/WorldClassAIChat"));
const WorldClassGamification = lazy(() => import(/* webpackChunkName: "gamification" */ "./components/WorldClassGamification"));
const WorldClassAnalytics = lazy(() => import(/* webpackChunkName: "analytics-pro" */ "./components/WorldClassAnalytics"));
const WorldClassMoodLogger = lazy(() => import(/* webpackChunkName: "mood-logger" */ "./components/WorldClassMoodLogger"));
const Chatbot = lazy(() => import(/* webpackChunkName: "chatbot" */ "./components/Chatbot"));
const ChatbotTherapist = lazy(() => import(/* webpackChunkName: "therapist" */ "./components/ChatbotTherapist"));
const MoodLogger = lazy(() => import(/* webpackChunkName: "mood-basic" */ "./components/MoodLogger"));
const RelaxingSounds = lazy(() => import(/* webpackChunkName: "sounds" */ "./components/RelaxingSounds"));
const MemoryRecorder = lazy(() => import(/* webpackChunkName: "memory" */ "./components/MemoryRecorder"));
const MemoryList = lazy(() => import(/* webpackChunkName: "memory-list" */ "./components/MemoryList"));
const GroupChallenges = lazy(() => import(/* webpackChunkName: "challenges" */ "./components/GroupChallenges"));
const DailyInsights = lazy(() => import(/* webpackChunkName: "daily" */ "./components/DailyInsights"));
const Recommendations = lazy(() => import(/* webpackChunkName: "recommendations" */ "./components/Recommendations"));
const VoiceChat = lazy(() => import(/* webpackChunkName: "voice" */ "./components/VoiceChat"));
const Leaderboard = lazy(() => import(/* webpackChunkName: "leaderboard" */ "./components/Leaderboard"));
const PeerSupportChat = lazy(() => import(/* webpackChunkName: "peer-support" */ "./components/PeerSupportChat"));
const CrisisAlert = lazy(() => import(/* webpackChunkName: "crisis" */ "./components/CrisisAlert"));
const WeeklyAnalysis = lazy(() => import(/* webpackChunkName: "weekly" */ "./components/WeeklyAnalysis"));
const HealthMonitoring = lazy(() => import(/* webpackChunkName: "health-monitor" */ "./components/HealthMonitoring"));
const StoryInsights = lazy(() => import(/* webpackChunkName: "story-insights" */ "./components/StoryInsights"));
const PerformanceDashboard = lazy(() => import(/* webpackChunkName: "performance" */ "./components/PerformanceDashboard"));
const MonitoringDashboard = lazy(() => import(/* webpackChunkName: "monitoring" */ "./components/MonitoringDashboard"));
const Gamification = lazy(() => import(/* webpackChunkName: "gamification-basic" */ "./components/Gamification"));
const GamificationSystem = lazy(() => import(/* webpackChunkName: "gamification-system" */ "./components/GamificationSystem"));
const BadgeDisplay = lazy(() => import(/* webpackChunkName: "badges" */ "./components/BadgeDisplay"));
const AchievementSharing = lazy(() => import(/* webpackChunkName: "achievements" */ "./components/AchievementSharing"));
const OnboardingFlow = lazy(() => import(/* webpackChunkName: "onboarding" */ "./components/OnboardingFlow"));
const PrivacySettings = lazy(() => import(/* webpackChunkName: "privacy" */ "./components/PrivacySettings"));
const AnalyticsDashboard = lazy(() => import(/* webpackChunkName: "analytics-dashboard" */ "./components/AnalyticsDashboard"));
const MoodAnalyzer = lazy(() => import(/* webpackChunkName: "mood-analyzer" */ "./components/MoodAnalyzer"));
const JournalEntry = lazy(() => import(/* webpackChunkName: "journal-entry" */ "./components/JournalEntry"));

// Route wrappers for components that require props
import {
  WorldClassAIChatWrapper,
  WorldClassMoodLoggerWrapper,
  WorldClassGamificationWrapper,
  WorldClassAnalyticsWrapper,
  DailyInsightsWrapper,
  GamificationSystemWrapper,
  LeaderboardWrapper,
  AchievementSharingWrapper,
  GroupChallengesWrapper,
  MemoryRecorderWrapper,
  MemoryListWrapper,
  JournalEntryWrapper,
  RelaxingSoundsWrapper,
  PeerSupportChatWrapper,
  CrisisAlertWrapper,
  OnboardingFlowWrapper,
  PrivacySettingsWrapper,
} from './components/RouteWrappers';

function App() {
    const { t } = useTranslation();
    const [offlineMode, setOfflineMode] = useState<boolean>(!navigator.onLine);

    // Auto track page views
    usePageTracking();

    // 🌐 Lyssna på ändringar i internetstatus
    useEffect(() => {
        const handleOfflineStatus = () => setOfflineMode(!navigator.onLine);

        // Kontrollera initial status
        setOfflineMode(!navigator.onLine);

        window.addEventListener("online", handleOfflineStatus);
        window.addEventListener("offline", handleOfflineStatus);

        return () => {
            window.removeEventListener("online", handleOfflineStatus);
            window.removeEventListener("offline", handleOfflineStatus);
        };
    }, []);

    // 🚫 Offline-läge - Visa ett meddelande och en återanslutningsknapp
    if (offlineMode) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 px-4">
                <div className="text-center max-w-md mx-auto">
                    <div className="text-6xl mb-6">📡</div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                        {t('common.offlineTitle')}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg">
                        {t('common.offlineMessage')}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn btn-primary px-8 py-3 text-lg font-semibold"
                    >
                        <span className="mr-2">🔄</span>
                        {t('common.retry')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <AppLayout>
            <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
                {/* 📌 Navigation visas på alla sidor */}
                <NavigationPro />
                
                {/* 🌟 Feature Hub - Access all 85+ components */}
                <FeatureNavigationHub />

                <main className="pt-20 pb-8 px-4 sm:px-6 lg:px-8">
                <div className="container-custom">
                    <ErrorBoundary>
                        <Suspense fallback={
                          <div className="min-h-[60vh] flex items-center justify-center">
                            <LoadingSpinner isLoading={true} message="Laddar sida..." />
                          </div>
                        }>
                            <Routes>
                                <Route path="/" element={<LoginForm />} />
                                <Route path="/login" element={<LoginForm />} />
                                <Route path="/register" element={<RegisterForm />} />
                                <Route
                                    path="/dashboard"
                                    element={
                                        <ProtectedRoute>
                                            <WorldClassDashboard />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/mood-tracker"
                                    element={
                                        <ProtectedRoute>
                                            <WorldClassDashboard />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/subscribe"
                                    element={
                                        <ProtectedRoute>
                                            <SubscriptionForm />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/ai-stories"
                                    element={
                                        <ProtectedRoute>
                                            <AIStories />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/analytics"
                                    element={
                                        <ProtectedRoute>
                                            <MoodAnalytics />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/integrations"
                                    element={
                                        <ProtectedRoute>
                                            <OAuthHealthIntegrations />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/referral"
                                    element={
                                        <ProtectedRoute>
                                            <ReferralProgram />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/health-sync"
                                    element={
                                        <ProtectedRoute>
                                            <OAuthHealthIntegrations />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/feedback"
                                    element={
                                        <ProtectedRoute>
                                            <FeedbackForm />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/wellness"
                                    element={
                                        <ProtectedRoute>
                                            <WellnessHub />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/social"
                                    element={
                                        <ProtectedRoute>
                                            <SocialHub />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/journal"
                                    element={
                                        <ProtectedRoute>
                                            <JournalHub />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/insights"
                                    element={
                                        <ProtectedRoute>
                                            <InsightsHub />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/rewards"
                                    element={
                                        <ProtectedRoute>
                                            <RewardsHub />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/profile"
                                    element={
                                        <ProtectedRoute>
                                            <ProfileHub />
                                        </ProtectedRoute>
                                    }
                                />
                                
                                {/* AI & Chat Features */}
                                <Route
                                    path="/ai-chat"
                                    element={
                                        <ProtectedRoute>
                                            <WorldClassAIChatWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/chatbot"
                                    element={
                                        <ProtectedRoute>
                                            <Chatbot />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/therapist"
                                    element={
                                        <ProtectedRoute>
                                            <ChatbotTherapist />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/voice-chat"
                                    element={
                                        <ProtectedRoute>
                                            <VoiceChat />
                                        </ProtectedRoute>
                                    }
                                />
                                
                                {/* Mood & Mental Health */}
                                <Route
                                    path="/mood-logger"
                                    element={
                                        <ProtectedRoute>
                                            <WorldClassMoodLoggerWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/mood-basic"
                                    element={
                                        <ProtectedRoute>
                                            <MoodLogger />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/mood-analyzer"
                                    element={
                                        <ProtectedRoute>
                                            <MoodAnalyzer />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/daily-insights"
                                    element={
                                        <ProtectedRoute>
                                            <DailyInsightsWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/weekly-analysis"
                                    element={
                                        <ProtectedRoute>
                                            <WeeklyAnalysis />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/recommendations"
                                    element={
                                        <ProtectedRoute>
                                            <Recommendations />
                                        </ProtectedRoute>
                                    }
                                />
                                
                                {/* Gamification & Engagement */}
                                <Route
                                    path="/gamification"
                                    element={
                                        <ProtectedRoute>
                                            <WorldClassGamificationWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/gamification-basic"
                                    element={
                                        <ProtectedRoute>
                                            <Gamification />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/gamification-system"
                                    element={
                                        <ProtectedRoute>
                                            <GamificationSystemWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/leaderboard"
                                    element={
                                        <ProtectedRoute>
                                            <LeaderboardWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/badges"
                                    element={
                                        <ProtectedRoute>
                                            <BadgeDisplay />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/achievements"
                                    element={
                                        <ProtectedRoute>
                                            <AchievementSharingWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/challenges"
                                    element={
                                        <ProtectedRoute>
                                            <GroupChallengesWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                
                                {/* Memory & Journaling */}
                                <Route
                                    path="/memories"
                                    element={
                                        <ProtectedRoute>
                                            <MemoryRecorderWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/memory-list"
                                    element={
                                        <ProtectedRoute>
                                            <MemoryListWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/journal-entry"
                                    element={
                                        <ProtectedRoute>
                                            <JournalEntryWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/story-insights"
                                    element={
                                        <ProtectedRoute>
                                            <StoryInsights />
                                        </ProtectedRoute>
                                    }
                                />
                                
                                {/* Wellness & Relaxation */}
                                <Route
                                    path="/sounds"
                                    element={
                                        <ProtectedRoute>
                                            <RelaxingSoundsWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/health-monitoring"
                                    element={
                                        <ProtectedRoute>
                                            <HealthMonitoring />
                                        </ProtectedRoute>
                                    }
                                />
                                
                                {/* Social & Support */}
                                <Route
                                    path="/peer-support"
                                    element={
                                        <ProtectedRoute>
                                            <PeerSupportChatWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/crisis"
                                    element={
                                        <ProtectedRoute>
                                            <CrisisAlertWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                
                                {/* Analytics & Monitoring */}
                                <Route
                                    path="/analytics-pro"
                                    element={
                                        <ProtectedRoute>
                                            <WorldClassAnalyticsWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/analytics-dashboard"
                                    element={
                                        <ProtectedRoute>
                                            <AnalyticsDashboard />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/performance"
                                    element={
                                        <ProtectedRoute>
                                            <PerformanceDashboard />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/monitoring"
                                    element={
                                        <ProtectedRoute>
                                            <MonitoringDashboard />
                                        </ProtectedRoute>
                                    }
                                />
                                
                                {/* Settings & Onboarding */}
                                <Route
                                    path="/onboarding"
                                    element={
                                        <ProtectedRoute>
                                            <OnboardingFlowWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/privacy"
                                    element={
                                        <ProtectedRoute>
                                            <PrivacySettingsWrapper />
                                        </ProtectedRoute>
                                    }
                                />
                                
                                {/* Testing & Development */}
                                <Route
                                    path="/test"
                                    element={<TestPage />}
                                />
                                <Route
                                    path="/testing-strategy"
                                    element={<TestingStrategy />}
                                />
                                <Route
                                    path="*"
                                    element={
                                        <div className="min-h-[60vh] flex items-center justify-center">
                                            <div className="text-center">
                                                <div className="text-8xl mb-6">🔍</div>
                                                <h2 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                                                    {t('common.pageNotFound')}
                                                </h2>
                                                <p className="text-slate-600 dark:text-slate-400 text-lg mb-8">
                                                    Sidan du letar efter finns inte.
                                                </p>
                                                <button
                                                    onClick={() => window.history.back()}
                                                    className="btn btn-primary px-6 py-3"
                                                >
                                                    <span className="mr-2">⬅️</span>
                                                    Gå tillbaka
                                                </button>
                                            </div>
                                        </div>
                                    }
                                />
                            </Routes>
                        </Suspense>
                    </ErrorBoundary>
                </div>
            </main>
            </div>
        </AppLayout>
    );
}

export default App;
