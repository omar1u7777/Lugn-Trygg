/**
 * Route Wrappers - Provides context and props to components requiring dependencies
 * This file makes all components accessible as standalone routes
 */
import React, { useState, lazy } from 'react';
import useAuth from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { SuperMoodLogger } from './SuperMoodLogger';

type AuthUserLike = {
  user_id?: string;
  uid?: string;
  id?: string;
};

// Helper function to get user ID from auth context
const getUserId = (user: unknown): string => {
  if (!user || typeof user !== 'object') {
    return '';
  }

  const authUser = user as AuthUserLike;
  return authUser.user_id || authUser.uid || authUser.id || '';
};

// Lazy-load feature surfaces so browsers only download them on demand
const WorldClassAIChat = lazy(() => import('./WorldClassAIChat'));
const WorldClassGamification = lazy(() => import('./WorldClassGamification'));
const WorldClassAnalytics = lazy(() => import('./WorldClassAnalytics'));
const DailyInsights = lazy(() => import('./DailyInsights'));
const Leaderboard = lazy(() => import('./Leaderboard'));
const GroupChallenges = lazy(() => import('./GroupChallenges'));
const MoodList = lazy(() => import('./MoodList'));
const RelaxingSounds = lazy(() => import('./RelaxingSounds'));
const PeerSupportChat = lazy(() => import('./PeerSupportChat'));
const CrisisAlert = lazy(() => import('./CrisisAlert'));
const OnboardingFlow = lazy(() => import('./OnboardingFlow'));
const PrivacySettings = lazy(() => import('./PrivacySettings'));
const CrisisPage = lazy(() => import('../pages/CrisisPage'));

// WorldClassAIChat Wrapper
export const WorldClassAIChatWrapper: React.FC = () => {
  const navigate = useNavigate();
  return <WorldClassAIChat onClose={() => navigate(-1)} />;
};

// [D6] WorldClassMoodLoggerWrapper removed — was identical to MoodLoggerBasicWrapper.
// Both rendered <SuperMoodLogger showRecentMoods={true} enableVoiceRecording={false} />.
// Use /mood-basic and MoodLoggerBasicWrapper instead.

// WorldClassGamification Wrapper
export const WorldClassGamificationWrapper: React.FC = () => {
  const navigate = useNavigate();
  return <WorldClassGamification onClose={() => navigate(-1)} />;
};

// WorldClassAnalytics Wrapper
export const WorldClassAnalyticsWrapper: React.FC = () => {
  const navigate = useNavigate();
  return <WorldClassAnalytics onClose={() => navigate(-1)} />;
};

// DailyInsights Wrapper - DailyInsights handles its own data fetching,
// loading and error states via the v2 insights API. The wrapper only
// supplies the authenticated user id.
export const DailyInsightsWrapper: React.FC = () => {
  const { user } = useAuth();
  const userId = getUserId(user);

  if (!userId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600 dark:text-slate-400">Logga in för att se dina insikter.</p>
      </div>
    );
  }

  return <DailyInsights userId={userId} />;
};

// Leaderboard Wrapper - Uses real Leaderboard component
export const LeaderboardWrapper: React.FC = () => {
  return <Leaderboard />;
};

// AchievementSharing Wrapper - HONEST: Shows this is demo/placeholder
export const AchievementSharingWrapper: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div className="text-center">
        <div className="text-4xl mb-4">🏆</div>
        <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-2">
          Achievement Sharing
        </h3>
        <p className="text-blue-700 dark:text-blue-300 mb-4">
          🧪 <strong>ÄRLIG INFO:</strong> Detta är en demo/placeholder. Ingen riktig achievement-sharing finns implementerad än.
        </p>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          Kommer snart med möjlighet att dela achievements med vänner!
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          Tillbaka
        </button>
      </div>
    </div>
  );
};

// GroupChallenges Wrapper - Uses real GroupChallenges component with API
export const GroupChallengesWrapper: React.FC = () => {
  const { user } = useAuth();
  return <GroupChallenges userId={getUserId(user)} />;
};

// MoodLogger basic wrapper - uses SuperMoodLogger
export const MoodLoggerBasicWrapper: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-6">
      <SuperMoodLogger 
        showRecentMoods={true} 
        enableVoiceRecording={false}
      />
    </div>
  );
};

export const MoodListWrapper: React.FC = () => {
  const navigate = useNavigate();
  return <MoodList onClose={() => navigate(-1)} />;
};


// RelaxingSounds Wrapper - Uses real RelaxingSounds component with streaming audio
export const RelaxingSoundsWrapper: React.FC = () => {
  const navigate = useNavigate();
  return <RelaxingSounds onClose={() => navigate(-1)} />;
};

// PeerSupportChat Wrapper - Uses real PeerSupportChat component with Firebase
export const PeerSupportChatWrapper: React.FC = () => {
  const { user } = useAuth();
  return <PeerSupportChat userId={getUserId(user)} />;
};

// CrisisAlert Wrapper - 100% HONEST: Shows crisis resources without fake mood score
export const CrisisAlertWrapper: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => {
    setIsOpen(false);
    navigate(-1);
  };

  return (
    <CrisisAlert
      isOpen={isOpen}
      onClose={handleClose}
      moodScore={0} // HONEST: Neutral score - shows all resources equally
    />
  );
};

// OnboardingFlow Wrapper
export const OnboardingFlowWrapper: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleComplete = () => {
    navigate('/dashboard');
  };

  return (
    <OnboardingFlow
      onComplete={handleComplete}
      userId={getUserId(user)}
    />
  );
};

// PrivacySettings Wrapper
export const PrivacySettingsWrapper: React.FC = () => {
  const { user } = useAuth();
  return <PrivacySettings userId={getUserId(user)} />;
};

// CrisisPage Wrapper - Full standalone crisis support page
export const CrisisPageWrapper: React.FC = () => {
  return <CrisisPage />;
};
