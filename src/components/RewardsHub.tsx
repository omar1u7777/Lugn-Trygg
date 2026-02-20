import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button } from './ui/tailwind';
import { useTranslation } from 'react-i18next';
import BadgeDisplay from './BadgeDisplay';
import { WorldClassGamificationWrapper } from './RouteWrappers';
import useAuth from '../hooks/useAuth';
import {
  getMoods,
  getUserRewards,
  getRewardCatalog,
  claimReward,
  checkAchievements,
  type RewardItem,
  type UserReward
} from '../api/api';
import { getJournalEntries } from '../api/journaling';
import { getReferralStats } from '../api/social';
import {
  SparklesIcon,
  StarIcon,
  TrophyIcon,
  FireIcon,
  GiftIcon,
  ArrowPathIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { logger } from '../utils/logger';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`rewards-tabpanel-${index}`}
    aria-labelledby={`rewards-tab-${index}`}
  >
    {value === index && <div>{children}</div>}
  </div>
);

const RewardsHub: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [userRewards, setUserRewards] = useState<UserReward | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalPoints: 0,
    streakDays: 0,
    badges: 0,
    achievements: 0,
    level: 1,
    progressPercent: 0,
  });

  const loadRewardsData = useCallback(async () => {
    logger.debug('RewardsHub loading data', { userId: user?.user_id });
    if (!user?.user_id) {
      logger.warn('RewardsHub - No user ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [moods, userRewardsData, catalogData, journalResult, referralResult] = await Promise.all([
        getMoods(user.user_id).catch((error) => { console.error('Failed to fetch moods:', error); return []; }),
        getUserRewards().catch((error) => { console.error('Failed to fetch user rewards:', error); return null; }),
        getRewardCatalog().catch((error) => { console.error('Failed to fetch reward catalog:', error); return []; }),
        getJournalEntries(user.user_id, 1000).catch((error) => { console.error('Failed to fetch journal entries:', error); return []; }),
        getReferralStats(user.user_id).catch((error) => { console.error('Failed to fetch referral stats:', error); return { successful_referrals: 0 }; }),
      ]);

      setRewards(catalogData);
      setUserRewards(userRewardsData);

      // Calculate streak from moods
      const today = new Date();
      let streak = 0;
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const hasLog = moods.some((m: any) =>
          m.timestamp && m.timestamp.startsWith(dateStr)
        );
        if (hasLog) streak++;
        else if (i > 0) break;
      }

      // Check for new achievements based on real activity data
      const journalCount = Array.isArray(journalResult) ? journalResult.length : 0;
      const referralCount = referralResult?.successful_referrals ?? 0;
      const achievementCheck = await checkAchievements({
        mood_count: moods.length,
        streak: streak,
        journal_count: journalCount,
        referral_count: referralCount,
        meditation_count: 0 // No meditation tracking backend yet
      }).catch((error) => { console.error('Failed to check achievements:', error); return { newAchievements: [] }; });

      // Show notification if new achievements earned
      if (achievementCheck.newAchievements?.length > 0) {
        setSuccessMessage(`🎉 Nya achievements: ${achievementCheck.newAchievements.map((a: any) => a.title).join(', ')}`);
        // Refresh user rewards after earning achievements
        const updatedRewards = await getUserRewards().catch((error) => { console.error('Failed to refresh user rewards:', error); return null; });
        setUserRewards(updatedRewards);
      }

      // Update stats
      setStats({
        totalPoints: userRewardsData?.xp || 0,
        streakDays: streak,
        badges: userRewardsData?.badges?.length || 0,
        achievements: userRewardsData?.achievements?.length || 0,
        level: userRewardsData?.level || 1,
        progressPercent: userRewardsData?.progressPercent || 0,
      });

    } catch (err) {
      logger.error('Failed to load rewards data:', err);
      setError(t('rewards.loadError', 'Kunde inte ladda belöningar. Försök igen.'));
    } finally {
      setLoading(false);
    }
  }, [user?.user_id, t]);

  useEffect(() => {
    logger.debug('RewardsHub mounted', { userId: user?.user_id, activeTab });
    loadRewardsData();
  }, [loadRewardsData]);

  useEffect(() => {
    logger.debug('RewardsHub tab changed', { activeTab });
  }, [activeTab]);

  const handleClaimReward = async (rewardId: string) => {
    if (!user?.user_id) return;

    setClaiming(rewardId);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await claimReward(rewardId);

      if (result.message) {
        setSuccessMessage(`🎉 ${result.message}`);
        // Refresh data after claiming
        await loadRewardsData();
      }
    } catch (err: any) {
      setError(err.message || t('rewards.claimError', 'Kunde inte hämta belöning.'));
    } finally {
      setClaiming(null);
    }
  };

  const canAfford = (cost: number) => {
    return (userRewards?.xp || 0) >= cost;
  };

  const hasClaimedReward = (rewardId: string) => {
    return userRewards?.claimedRewards?.includes(rewardId) || false;
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4 animate-pulse" />
          <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded mx-auto mb-3 animate-pulse" />
          <div className="h-5 w-64 bg-gray-200 dark:bg-gray-700 rounded mx-auto animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 sm:p-6">
              <div className="space-y-3">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-6 sm:mb-8">
        <div className="flex items-center justify-center mb-3 sm:mb-4">
          <TrophyIcon aria-hidden="true" className="w-10 h-10 sm:w-12 sm:h-12 text-warning-600" />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 world-class-heading-1">
          🏆 Belöningar
        </h1>
        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 world-class-body-large px-4">
          Tjäna poäng, lås upp prestationer och få belöningar för din resa
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Card className="world-class-dashboard-card">
          <div className="p-4 sm:p-6">
            <StarIcon aria-hidden="true" className="w-8 h-8 sm:w-10 sm:h-10 text-warning-600 mb-2 sm:mb-3" />
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {stats.totalPoints.toLocaleString()}
            </p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
              Totalt intjänade poäng
            </p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-warning-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((stats.totalPoints / 2000) * 100, 100)}%` }}
                role="progressbar"
                aria-valuenow={Math.min((stats.totalPoints / 2000) * 100, 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        </Card>

        <Card className="world-class-dashboard-card">
          <div className="p-4 sm:p-6">
            <TrophyIcon aria-hidden="true" className="w-8 h-8 sm:w-10 sm:h-10 text-secondary-600 mb-2 sm:mb-3" />
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {stats.badges}
            </p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
              Upplåsta märken
            </p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-secondary-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((stats.badges / 25) * 100, 100)}%` }}
                role="progressbar"
                aria-valuenow={Math.min((stats.badges / 25) * 100, 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        </Card>

        <Card className="world-class-dashboard-card">
          <div className="p-4 sm:p-6">
            <SparklesIcon aria-hidden="true" className="w-8 h-8 sm:w-10 sm:h-10 text-success-600 mb-2 sm:mb-3" />
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
              Level {Math.floor(Math.sqrt(stats.totalPoints / 100)) + 1}
            </p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
              Nuvarande nivå
            </p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-success-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(((stats.totalPoints - ((Math.floor(Math.sqrt(stats.totalPoints / 100))) ** 2) * 100) / (((Math.floor(Math.sqrt(stats.totalPoints / 100)) + 1) ** 2) * 100 - ((Math.floor(Math.sqrt(stats.totalPoints / 100))) ** 2) * 100)) * 100, 100)}%` }}
                role="progressbar"
                aria-valuenow={(stats.totalPoints % 200) / 2}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        </Card>

        <Card className="world-class-dashboard-card">
          <div className="p-4 sm:p-6">
            <FireIcon aria-hidden="true" className="w-8 h-8 sm:w-10 sm:h-10 text-error-600 mb-2 sm:mb-3" />
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {stats.streakDays} 🔥
            </p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
              Dagssvit
            </p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-error-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((stats.streakDays / 30) * 100, 100)}%` }}
                role="progressbar"
                aria-valuenow={Math.min((stats.streakDays / 30) * 100, 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs for different rewards features */}
      <Card className="world-class-dashboard-card">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex overflow-x-auto" role="tablist" aria-label="Rewards features">
            {[
              { icon: <TrophyIcon className="w-5 h-5" />, label: 'Mina märken', index: 0 },
              { icon: <GiftIcon className="w-5 h-5" />, label: 'Belöningskatalog', index: 1 },
              { icon: <StarIcon className="w-5 h-5" />, label: 'Prestationer', index: 2 },
              { icon: <FireIcon className="w-5 h-5" />, label: 'Dagliga utmaningar', index: 3 },
            ].map((tab) => (
              <button
                key={tab.index}
                onClick={() => setActiveTab(tab.index)}
                role="tab"
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${activeTab === tab.index
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                id={`rewards-tab-${tab.index}`}
                aria-controls={`rewards-tabpanel-${tab.index}`}
                aria-selected={activeTab === tab.index}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 sm:p-6">
          {/* My Badges Tab */}
          <TabPanel value={activeTab} index={0}>
            {user?.user_id ? (
              <BadgeDisplay />
            ) : (
              <div className="text-center py-8 sm:py-12">
                <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300">
                  Logga in för att se dina märken
                </p>
              </div>
            )}
          </TabPanel>

          {/* Rewards Catalog Tab */}
          <TabPanel value={activeTab} index={1}>
            <div>
              {/* Success/Error Messages */}
              {successMessage && (
                <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-600" aria-hidden="true" />
                    <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
                  </div>
                </div>
              )}
              {error && (
                <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              {/* Current XP Display */}
              <div className="mb-6 p-4 bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StarIcon className="w-8 h-8 text-warning-600" aria-hidden="true" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Dina poäng</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{userRewards?.xp?.toLocaleString() || 0} XP</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadRewardsData}
                    className="flex items-center gap-2"
                  >
                    <ArrowPathIcon className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Uppdatera</span>
                  </Button>
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">
                {t('rewards.catalog', 'Belöningskatalog')}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-6">
                {t('rewards.catalogDesc', 'Spendera dina poäng på exklusiva belöningar och premium-funktioner')}
              </p>

              {rewards.length === 0 ? (
                <div className="text-center py-8">
                  <GiftIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {t('rewards.empty', 'Inga belöningar tillgängliga just nu')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {rewards.map((reward) => {
                    const claimed = hasClaimedReward(reward.id);
                    const affordable = canAfford(reward.cost);

                    return (
                      <Card key={reward.id} className={`p-4 sm:p-6 ${claimed ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between mb-3 sm:mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{reward.icon}</span>
                            <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                              {reward.title}
                            </h4>
                          </div>
                          <span className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-full whitespace-nowrap ml-2 ${affordable && !claimed
                            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
                            {reward.cost} XP
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          {reward.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="px-2 sm:px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {reward.type === 'premium_time' ? 'Premium' :
                              reward.type === 'badge' ? 'Badge' : 'Utseende'}
                          </span>
                          <Button
                            variant={claimed ? 'outline' : affordable ? 'primary' : 'outline'}
                            disabled={claimed || !affordable || claiming === reward.id}
                            onClick={() => handleClaimReward(reward.id)}
                            className="ml-auto flex items-center gap-2"
                          >
                            {claiming === reward.id ? (
                              <ArrowPathIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : claimed ? (
                              <>
                                <CheckCircleIcon className="w-4 h-4" aria-hidden="true" />
                                <span>{t('rewards.claimed', 'Hämtad')}</span>
                              </>
                            ) : affordable ? (
                              <span>{t('rewards.claim', 'Hämta')}</span>
                            ) : (
                              <span>{t('rewards.notEnough', 'Inte tillräckligt')}</span>
                            )}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabPanel>

          {/* Achievements Tab */}
          <TabPanel value={activeTab} index={2}>
            {user?.user_id ? (
              <WorldClassGamificationWrapper />
            ) : (
              <div className="text-center py-8 sm:py-12">
                <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300">
                  Logga in för att se dina prestationer
                </p>
              </div>
            )}
          </TabPanel>

          {/* Daily Challenges Tab */}
          <TabPanel value={activeTab} index={3}>
            {user?.user_id ? (
              <WorldClassGamificationWrapper />
            ) : (
              <div className="text-center py-8 sm:py-12">
                <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300">
                  Logga in för att se dagliga utmaningar
                </p>
              </div>
            )}
          </TabPanel>
        </div>
      </Card>

      {/* How to Earn Points */}
      <div className="mt-6 sm:mt-8">
        <Card className="world-class-dashboard-card">
          <div className="p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 world-class-heading-3">
              💰 Hur du tjänar poäng
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="flex gap-3 sm:gap-4">
                <div className="text-3xl sm:text-4xl" role="img" aria-label="Happy emoji">😊</div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
                    Logga ditt humör
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Tjäna 10 poäng för varje humörlogg
                  </p>
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4">
                <div className="text-3xl sm:text-4xl" role="img" aria-label="Fire emoji">🔥</div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
                    Dagssvit
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Tjäna 50 poäng för 7-dagars svit
                  </p>
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4">
                <div className="text-3xl sm:text-4xl" role="img" aria-label="Chat emoji">💬</div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
                    AI-samtal
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Tjäna 20 poäng per terapisession
                  </p>
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4">
                <div className="text-3xl sm:text-4xl" role="img" aria-label="Target emoji">🎯</div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
                    Slutför utmaningar
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Tjäna upp till 100 poäng per utmaning
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Benefits */}
      <div className="mt-6 sm:mt-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6 sm:mb-8 world-class-heading-2">
          Varför tjäna belöningar?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="p-4 sm:p-6">
            <div className="text-5xl sm:text-6xl mb-3 sm:mb-4" role="img" aria-label="Gift emoji">🎁</div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Exklusiva belöningar
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Lås upp premium-funktioner och innehåll
            </p>
          </div>

          <div className="p-4 sm:p-6">
            <div className="text-5xl sm:text-6xl mb-3 sm:mb-4" role="img" aria-label="Trophy emoji">🏆</div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Prestationssystem
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Följ dina framsteg med märken
            </p>
          </div>

          <div className="p-4 sm:p-6">
            <div className="text-5xl sm:text-6xl mb-3 sm:mb-4" role="img" aria-label="Target emoji">🎯</div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Håll dig motiverad
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Spelifiering håller dig engagerad
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RewardsHub;




