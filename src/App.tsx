import { Routes, Route } from "react-router-dom";
import { useEffect, useState, Suspense } from "react";
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

// CRITICAL FIX: Direct imports instead of lazy loading to prevent React undefined errors
// This forces everything into single bundle, guaranteeing React instance is shared
import LoginForm from "./components/Auth/LoginForm";
import RegisterForm from "./components/Auth/RegisterForm";
import WorldClassDashboard from "./components/WorldClassDashboard";
import SubscriptionForm from "./components/SubscriptionForm";
import AIStories from "./components/AIStories";
import MoodAnalytics from "./components/MoodAnalytics";
import OAuthHealthIntegrations from "./components/Integrations/OAuthHealthIntegrations";
import ReferralProgram from "./components/Referral/ReferralProgram";
import FeedbackForm from "./components/Feedback/FeedbackForm";
import WellnessHub from "./components/WellnessHub";
import SocialHub from "./components/SocialHub";
import JournalHub from "./components/JournalHub";
import InsightsHub from "./components/InsightsHub";
import RewardsHub from "./components/RewardsHub";
import ProfileHub from "./components/ProfileHub";

// Additional feature components - making ALL components accessible
import WorldClassAIChat from "./components/WorldClassAIChat";
import WorldClassGamification from "./components/WorldClassGamification";
import WorldClassAnalytics from "./components/WorldClassAnalytics";
import WorldClassMoodLogger from "./components/WorldClassMoodLogger";
import Chatbot from "./components/Chatbot";
import ChatbotTherapist from "./components/ChatbotTherapist";
import MoodLogger from "./components/MoodLogger";
import RelaxingSounds from "./components/RelaxingSounds";
import MemoryRecorder from "./components/MemoryRecorder";
import MemoryList from "./components/MemoryList";
import GroupChallenges from "./components/GroupChallenges";
import DailyInsights from "./components/DailyInsights";
import Recommendations from "./components/Recommendations";
import VoiceChat from "./components/VoiceChat";
import Leaderboard from "./components/Leaderboard";
import PeerSupportChat from "./components/PeerSupportChat";
import CrisisAlert from "./components/CrisisAlert";
import WeeklyAnalysis from "./components/WeeklyAnalysis";
import HealthMonitoring from "./components/HealthMonitoring";
import StoryInsights from "./components/StoryInsights";
import PerformanceDashboard from "./components/PerformanceDashboard";
import MonitoringDashboard from "./components/MonitoringDashboard";
import Gamification from "./components/Gamification";
import GamificationSystem from "./components/GamificationSystem";
import BadgeDisplay from "./components/BadgeDisplay";
import AchievementSharing from "./components/AchievementSharing";
import OnboardingFlow from "./components/OnboardingFlow";
import PrivacySettings from "./components/PrivacySettings";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import MoodAnalyzer from "./components/MoodAnalyzer";
import JournalEntry from "./components/JournalEntry";

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
                    </ErrorBoundary>
                </div>
            </main>
            </div>
        </AppLayout>
    );
}

export default App;
