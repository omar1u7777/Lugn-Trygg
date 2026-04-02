/**
 * Route Wrappers - Provides context and props to components requiring dependencies
 * This file makes all components accessible as standalone routes
 */
import React, { useState, useEffect, lazy } from 'react';
import useAuth from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';
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
const GamificationSystem = lazy(() => import('./GamificationSystem'));
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

// SuperMoodLogger Wrapper (replaces WorldClassMoodLogger)
export const WorldClassMoodLoggerWrapper: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-6">
      <SuperMoodLogger showRecentMoods={true} enableVoiceRecording={false} />
    </div>
  );
};

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

// DailyInsights Wrapper - 100% HONEST: Actually fetches real data or shows honest message
export const DailyInsightsWrapper: React.FC = () => {
  const { user } = useAuth();
  const [moodData, setMoodData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // HONEST: Actually try to fetch real mood data
    const fetchMoodData = async () => {
      try {
        setLoading(true);
        const userId = getUserId(user);
        if (userId) {
          // Try to fetch real data from API
          const { getMoods } = await import('../api/api');
          const realMoodData = await getMoods(userId);
          setMoodData(realMoodData || []);
        } else {
          setMoodData([]);
        }
      } catch (error) {
        logger.error('Error fetching mood data:', error);
        setError('Kunde inte hämta humördata');
        setMoodData([]); // HONEST: Empty array, not fake data
      } finally {
        setLoading(false);
      }
    };
    fetchMoodData();
  }, [user]);

  // HONEST: Show loading state while fetching
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Hämtar dina insikter...</p>
        </div>
      </div>
    );
  }

  // HONEST: Show error if fetching failed
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <span className="text-red-500 text-xl">⚠️</span>
          <div>
            <h3 className="text-red-800 dark:text-red-300 font-semibold">Fel vid hämtning</h3>
            <p className="text-red-700 dark:text-red-400 text-sm mt-1">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <DailyInsights userId={getUserId(user)} moodData={moodData} />;
};

// GamificationSystem Wrapper - Uses real RewardsHub with API
export const GamificationSystemWrapper: React.FC = () => {
  const { user } = useAuth();
  const userId = getUserId(user);
  
  // GamificationSystem is now handled by RewardsHub which uses real API
  // Import and use the real component
  return <GamificationSystem userId={userId} />;
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
