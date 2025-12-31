import { lazy } from 'react';
import type { FeatureName } from '@/components/PremiumGate';
import LoginForm from '@/components/Auth/LoginForm'; // Critical for LCP: load immediately
import RegisterForm from '@/components/Auth/RegisterForm';
import {
  DailyInsightsWrapper,
  CrisisAlertWrapper,
  OnboardingFlowWrapper,
  PrivacySettingsWrapper,
  WorldClassAIChatWrapper,
  WorldClassMoodLoggerWrapper,
  WorldClassGamificationWrapper,
  RelaxingSoundsWrapper,
  MoodLoggerBasicWrapper,
  MoodListWrapper,
} from '@/components/RouteWrappers';

const WorldClassDashboard = lazy(() => import('@/components/WorldClassDashboard'));
const SubscriptionForm = lazy(() => import('@/components/SubscriptionForm'));
const AIStories = lazy(() => import('@/components/AIStories'));
const MoodAnalytics = lazy(() => import('@/components/MoodAnalytics'));
const OAuthHealthIntegrations = lazy(() => import('@/components/Integrations/OAuthHealthIntegrations'));
const ReferralProgram = lazy(() => import('@/components/Referral/ReferralProgram'));
const FeedbackForm = lazy(() => import('@/components/Feedback/FeedbackForm'));
const ProfileHub = lazy(() => import('@/components/ProfileHub'));
const VoiceChat = lazy(() => import('@/components/VoiceChat'));
const StoryInsights = lazy(() => import('@/components/StoryInsights'));
const PerformanceDashboard = lazy(() => import('@/components/PerformanceDashboard'));
const MonitoringDashboard = lazy(() => import('@/components/MonitoringDashboard'));
const BadgeDisplay = lazy(() => import('@/components/BadgeDisplay'));
const AnalyticsDashboard = lazy(() => import('@/components/AnalyticsDashboard'));
const WeeklyAnalysis = lazy(() => import('@/components/WeeklyAnalysis'));
const Recommendations = lazy(() => import('@/components/Recommendations'));
const RewardsHub = lazy(() => import('@/components/RewardsHub'));
const SocialHub = lazy(() => import('@/components/SocialHub'));
const JournalHub = lazy(() => import('@/components/JournalHub'));
const InsightsHub = lazy(() => import('@/components/InsightsHub'));
const WellnessHub = lazy(() => import('@/components/WellnessHub'));
const TestPage = lazy(() => import('@/components/TestPage'));
const TestingStrategy = lazy(() => import('@/components/TestingStrategy'));
const UpgradePage = lazy(() => import('@/pages/UpgradePage'));
const HealthMonitoring = lazy(() => import('@/components/HealthMonitoring'));

export interface RouteDefinition {
  path: string;
  component: React.ComponentType;
  protected?: boolean;
  requireAdmin?: boolean;
  feature?: FeatureName;
  featureTitle?: string;
}

export const ROUTES: RouteDefinition[] = [
  { path: '/', component: LoginForm },
  { path: '/login', component: LoginForm },
  { path: '/register', component: RegisterForm },
  { path: '/upgrade', component: UpgradePage, protected: true },
  { path: '/dashboard', component: WorldClassDashboard, protected: true },
  { path: '/subscribe', component: SubscriptionForm, protected: true },
  { path: '/ai-stories', component: AIStories, protected: true, feature: 'aiStories', featureTitle: 'AI-berättelser är en Premium-funktion' },
  { path: '/analytics', component: MoodAnalytics, protected: true, feature: 'analytics', featureTitle: 'Analyser är en Premium-funktion' },
  { path: '/health-monitoring', component: HealthMonitoring, protected: true, requireAdmin: true },
  { path: '/admin/analytics-dashboard', component: AnalyticsDashboard, protected: true, requireAdmin: true },
  { path: '/integrations', component: OAuthHealthIntegrations, protected: true },
  { path: '/referral', component: ReferralProgram, protected: true },
  { path: '/feedback', component: FeedbackForm, protected: true },
  { path: '/wellness', component: WellnessHub, protected: true, feature: 'wellness', featureTitle: 'Välmåendehubben är en Premium-funktion' },
  { path: '/sounds', component: RelaxingSoundsWrapper, protected: true, feature: 'sounds', featureTitle: 'Lugnande ljud är en Premium-funktion' },
  { path: '/social', component: SocialHub, protected: true, feature: 'social', featureTitle: 'Sociala funktioner är Premium' },
  { path: '/journal', component: JournalHub, protected: true, feature: 'journal', featureTitle: 'Dagboken är en Premium-funktion' },
  { path: '/insights', component: InsightsHub, protected: true, feature: 'insights', featureTitle: 'Insikter är en Premium-funktion' },
  { path: '/rewards', component: RewardsHub, protected: true, feature: 'gamification', featureTitle: 'Belöningar är en Premium-funktion' },
  { path: '/profile', component: ProfileHub, protected: true },
  { path: '/ai-chat', component: WorldClassAIChatWrapper, protected: true },
  { path: '/voice-chat', component: VoiceChat, protected: true, feature: 'voiceChat', featureTitle: 'Röstchatt är en Premium-funktion' },
  { path: '/mood-logger', component: WorldClassMoodLoggerWrapper, protected: true },
  { path: '/mood-basic', component: MoodLoggerBasicWrapper, protected: true },
  { path: '/mood-list', component: MoodListWrapper, protected: true },
  { path: '/daily-insights', component: DailyInsightsWrapper, protected: true },
  { path: '/weekly-analysis', component: WeeklyAnalysis, protected: true },
  { path: '/recommendations', component: Recommendations, protected: true, feature: 'recommendations', featureTitle: 'Rekommendationer är en Premium-funktion' },
  { path: '/gamification', component: WorldClassGamificationWrapper, protected: true, feature: 'gamification', featureTitle: 'Gamification är en Premium-funktion' },
  { path: '/badges', component: BadgeDisplay, protected: true, feature: 'gamification', featureTitle: 'Badges är en del av Gamification (Premium)' },
  { path: '/story-insights', component: StoryInsights, protected: true },
  { path: '/admin/performance', component: PerformanceDashboard, protected: true, requireAdmin: true },
  { path: '/admin/monitoring', component: MonitoringDashboard, protected: true, requireAdmin: true },
  { path: '/crisis', component: CrisisAlertWrapper, protected: true },
  { path: '/onboarding', component: OnboardingFlowWrapper, protected: true },
  { path: '/privacy', component: PrivacySettingsWrapper, protected: true },
  { path: '/test', component: TestPage },
  { path: '/testing-strategy', component: TestingStrategy },
];
