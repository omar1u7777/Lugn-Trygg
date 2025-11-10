/**
 * Route Wrappers - Provides context and props to components requiring dependencies
 * This file makes all components accessible as standalone routes
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Helper function to get user ID from auth context
const getUserId = (user: any): string => {
  return (user as any)?.uid || (user as any)?.id || '';
};

// Import components that need wrapping
import WorldClassAIChat from './WorldClassAIChat';
import WorldClassMoodLogger from './WorldClassMoodLogger';
import WorldClassGamification from './WorldClassGamification';
import WorldClassAnalytics from './WorldClassAnalytics';
import DailyInsights from './DailyInsights';
import GamificationSystem from './GamificationSystem';
import Leaderboard from './Leaderboard';
import AchievementSharing from './AchievementSharing';
import GroupChallenges from './GroupChallenges';
import MemoryRecorder from './MemoryRecorder';
import MemoryList from './MemoryList';
import JournalEntry from './JournalEntry';
import RelaxingSounds from './RelaxingSounds';
import PeerSupportChat from './PeerSupportChat';
import CrisisAlert from './CrisisAlert';
import OnboardingFlow from './OnboardingFlow';
import PrivacySettings from './PrivacySettings';

// WorldClassAIChat Wrapper
export const WorldClassAIChatWrapper: React.FC = () => {
  const navigate = useNavigate();
  return <WorldClassAIChat onClose={() => navigate(-1)} />;
};

// WorldClassMoodLogger Wrapper
export const WorldClassMoodLoggerWrapper: React.FC = () => {
  const navigate = useNavigate();
  return <WorldClassMoodLogger onClose={() => navigate(-1)} />;
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

// DailyInsights Wrapper
export const DailyInsightsWrapper: React.FC = () => {
  const { user } = useAuth();
  const [moodData, setMoodData] = useState<any[]>([]);

  useEffect(() => {
    // Fetch mood data for user
    const fetchMoodData = async () => {
      try {
        const userId = getUserId(user);
        if (userId) {
          // This would normally fetch from backend
          // For now, use mock data
          setMoodData([]);
        }
      } catch (error) {
        console.error('Error fetching mood data:', error);
      }
    };
    fetchMoodData();
  }, [user]);

  return <DailyInsights userId={getUserId(user)} moodData={moodData} />;
};

// GamificationSystem Wrapper
export const GamificationSystemWrapper: React.FC = () => {
  const { user } = useAuth();
  const [gameData, setGameData] = useState<{
    userLevel: number;
    userXP: number;
    nextLevelXP: number;
    badges: any[];
    challenges: any[];
  }>({
    userLevel: 1,
    userXP: 0,
    nextLevelXP: 100,
    badges: [],
    challenges: [],
  });

  useEffect(() => {
    // Fetch gamification data
    const fetchGameData = async () => {
      try {
        const userId = getUserId(user);
        if (userId) {
          // Fetch from backend or use local state
          setGameData({
            userLevel: 1,
            userXP: 0,
            nextLevelXP: 100,
            badges: [],
            challenges: [],
          });
        }
      } catch (error) {
        console.error('Error fetching game data:', error);
      }
    };
    fetchGameData();
  }, [user]);

  return (
    <GamificationSystem
      userId={getUserId(user)}
      userLevel={gameData.userLevel}
      userXP={gameData.userXP}
      nextLevelXP={gameData.nextLevelXP}
      badges={gameData.badges}
      challenges={gameData.challenges}
    />
  );
};

// Leaderboard Wrapper
export const LeaderboardWrapper: React.FC = () => {
  const { user } = useAuth();
  return <Leaderboard userId={getUserId(user)} />;
};

// AchievementSharing Wrapper
export const AchievementSharingWrapper: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Mock achievement for demo
  const mockAchievement: any = {
    id: 'demo',
    title: 'Your Latest Achievement',
    name: 'Your Latest Achievement',
    description: 'Keep up the great work!',
    icon: '🏆',
    date: new Date().toISOString(),
    earnedAt: new Date().toISOString(),
    category: 'wellness',
  };

  return (
    <AchievementSharing
      achievement={mockAchievement}
      userId={getUserId(user)}
      onClose={() => navigate(-1)}
    />
  );
};

// GroupChallenges Wrapper
export const GroupChallengesWrapper: React.FC = () => {
  const { user } = useAuth();
  return (
    <GroupChallenges
      userId={getUserId(user)}
      username={(user as any)?.displayName || (user as any)?.email?.split('@')[0] || 'User'}
    />
  );
};

// MemoryRecorder Wrapper
export const MemoryRecorderWrapper: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <MemoryRecorder
      userId={getUserId(user)}
      onClose={() => navigate(-1)}
    />
  );
};

// MemoryList Wrapper
export const MemoryListWrapper: React.FC = () => {
  const navigate = useNavigate();
  return <MemoryList onClose={() => navigate(-1)} />;
};

// JournalEntry Wrapper
export const JournalEntryWrapper: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  const handleClose = () => {
    setOpen(false);
    navigate(-1);
  };

  const handleSubmit = async (entry: any) => {
    try {
      // Save journal entry to backend
      console.log('Saving journal entry:', entry);
      // TODO: Implement backend save
      handleClose();
    } catch (error) {
      console.error('Error saving journal entry:', error);
    }
  };

  return (
    <JournalEntry
      open={open}
      onClose={handleClose}
      onSubmit={handleSubmit}
    />
  );
};

// RelaxingSounds Wrapper
export const RelaxingSoundsWrapper: React.FC = () => {
  const navigate = useNavigate();
  return <RelaxingSounds onClose={() => navigate(-1)} />;
};

// PeerSupportChat Wrapper
export const PeerSupportChatWrapper: React.FC = () => {
  const { user } = useAuth();
  return (
    <PeerSupportChat
      userId={getUserId(user)}
      username={(user as any)?.displayName || (user as any)?.email?.split('@')[0] || 'User'}
    />
  );
};

// CrisisAlert Wrapper
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
      moodScore={3} // Default moderate mood score
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
