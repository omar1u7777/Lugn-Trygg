import React, { useState, useEffect } from 'react';
import { Card } from './ui/tailwind';
import { useTranslation } from 'react-i18next';
import PeerSupportChat from './PeerSupportChat';
import GroupChallenges from './GroupChallenges';
import Leaderboard from './Leaderboard';
import useAuth from '../hooks/useAuth';
import { getLeaderboard, getReferralStats, getMoods } from '../api/api';
import {
  ChatBubbleLeftRightIcon,
  ShareIcon,
  TrophyIcon,
  UserGroupIcon,
  UsersIcon,
  ChartBarIcon
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
    id={`social-tabpanel-${index}`}
    aria-labelledby={`social-tab-${index}`}
  >
    {value === index && <div>{children}</div>}
  </div>
);

interface SocialStats {
  communityMembers: number;
  moodLogs: number;
  referrals: number;
  leaderboardRank: number;
}

const SocialHub: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [socialStats, setSocialStats] = useState<SocialStats>({
    communityMembers: 0,
    moodLogs: 0,
    referrals: 0,
    leaderboardRank: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSocialData = async () => {
      logger.debug('SocialHub mounted', { userId: user?.user_id });
      if (!user?.user_id) {
        logger.warn('SocialHub - No user ID');
        setLoading(false);
        return;
      }

      try {
        logger.debug('Fetching leaderboard, referrals, moods...');
        // Fetch leaderboard to get community size and user rank
        const leaderboardData = await getLeaderboard('xp');
        const communityMembers = leaderboardData.length;

        // Find user's rank
        const userRankEntry = leaderboardData.find(
          (entry: any) => entry.userId === user.user_id
        );
        const userRank = userRankEntry?.rank || 0;

        // Fetch referral stats
        const referralStats = await getReferralStats(user.user_id);
        const referrals = referralStats.successfulReferrals || 0;

        // Fetch moods to show real mood log count
        const moods = await getMoods(user.user_id);
        const moodLogs = moods.length;

        setSocialStats({
          communityMembers,
          moodLogs,
          referrals,
          leaderboardRank: userRank,
        });
        logger.debug('SocialHub stats calculated', { communityMembers, moodLogs, referrals, userRank });
      } catch (error) {
        logger.error('Failed to fetch social data:', error);
        // Keep default values on error
      } finally {
        setLoading(false);
      }
    };

    fetchSocialData();
  }, [user?.user_id]);

  const _handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    logger.debug('SocialHub tab changed', { newTab: newValue });
    setActiveTab(newValue);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-6 sm:mb-8">
        <div className="flex items-center justify-center mb-3 sm:mb-4">
          <UserGroupIcon aria-hidden="true" className="w-10 h-10 sm:w-12 sm:h-12 text-primary-600" />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 world-class-heading-1">
          {t('social.title')}
        </h1>
        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 world-class-body-large px-4">
          {t('social.subtitle')}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Card className="world-class-dashboard-card">
          <div className="p-4 sm:p-6">
            <UsersIcon aria-hidden="true" className="w-8 h-8 sm:w-10 sm:h-10 text-primary-600 mb-2 sm:mb-3" />
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
              {loading ? (
                <span className="inline-block w-16 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></span>
              ) : (
                socialStats.communityMembers.toLocaleString()
              )}
            </p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {t('social.communityMembers')}
            </p>
          </div>
        </Card>

        <Card className="world-class-dashboard-card">
          <div className="p-4 sm:p-6">
            <ChatBubbleLeftRightIcon aria-hidden="true" className="w-8 h-8 sm:w-10 sm:h-10 text-secondary-600 mb-2 sm:mb-3" />
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
              {loading ? (
                <span className="inline-block w-16 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></span>
              ) : (
                socialStats.moodLogs
              )}
            </p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {t('social.moodLogs')}
            </p>
          </div>
        </Card>

        <Card className="world-class-dashboard-card">
          <div className="p-4 sm:p-6">
            <TrophyIcon aria-hidden="true" className="w-8 h-8 sm:w-10 sm:h-10 text-success-600 mb-2 sm:mb-3" />
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
              {loading ? (
                <span className="inline-block w-16 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></span>
              ) : (
                socialStats.referrals
              )}
            </p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {t('social.referrals')}
            </p>
          </div>
        </Card>

        <Card className="world-class-dashboard-card">
          <div className="p-4 sm:p-6">
            <ChartBarIcon aria-hidden="true" className="w-8 h-8 sm:w-10 sm:h-10 text-accent-600 mb-2 sm:mb-3" />
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
              {loading ? (
                <span className="inline-block w-16 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></span>
              ) : (
                socialStats.leaderboardRank > 0 ? `#${socialStats.leaderboardRank}` : 'N/A'
              )}
            </p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {t('social.leaderboardRank')}
            </p>
          </div>
        </Card>
      </div>

      {/* Tabs for different social features */}
      <Card className="world-class-dashboard-card">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex overflow-x-auto" role="tablist" aria-label="Social features">
            {[
              { icon: <ChatBubbleLeftRightIcon className="w-5 h-5" />, label: t('social.tabs.supportChat'), index: 0 },
              { icon: <TrophyIcon className="w-5 h-5" />, label: t('social.tabs.challenges'), index: 1 },
              { icon: <ChartBarIcon className="w-5 h-5" />, label: t('social.tabs.leaderboard'), index: 2 },
              { icon: <ShareIcon className="w-5 h-5" />, label: t('social.tabs.shareAchievements'), index: 3 },
            ].map((tab) => (
              <button
                key={tab.index}
                onClick={() => setActiveTab(tab.index)}
                role="tab"
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${activeTab === tab.index
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                id={`social-tab-${tab.index}`}
                aria-controls={`social-tabpanel-${tab.index}`}
                aria-selected={activeTab === tab.index}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 sm:p-6">
          {/* Peer Support Chat Tab */}
          <TabPanel value={activeTab} index={0}>
            {user?.user_id ? (
              <PeerSupportChat
                userId={user.user_id}
                username={user.email?.split('@')[0] || 'Anonymous'}
              />
            ) : (
              <div className="text-center py-8 sm:py-12">
                <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300">
                  {t('social.loginRequired.supportChat')}
                </p>
              </div>
            )}
          </TabPanel>

          {/* Group Challenges Tab */}
          <TabPanel value={activeTab} index={1}>
            {user?.user_id ? (
              <GroupChallenges userId={user.user_id} username={user.email?.split('@')[0] || 'Anonymous'} />
            ) : (
              <div className="text-center py-8 sm:py-12">
                <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300">
                  {t('social.loginRequired.challenges')}
                </p>
              </div>
            )}
          </TabPanel>

          {/* Leaderboard Tab */}
          <TabPanel value={activeTab} index={2}>
            {user?.user_id ? (
              <Leaderboard userId={user.user_id} />
            ) : (
              <div className="text-center py-8 sm:py-12">
                <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300">
                  {t('social.loginRequired.leaderboard')}
                </p>
              </div>
            )}
          </TabPanel>

          {/* Share Achievements Tab */}
          <TabPanel value={activeTab} index={3}>
            {user?.user_id ? (
              <div className="text-center py-8">
                <div className="mb-6">
                  <div className="text-6xl mb-4">🏆</div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {t('social.shareTitle')}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                    {t('social.shareDesc')}
                  </p>
                </div>

                {/* Achievement cards based on real stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-6">
                  {socialStats.moodLogs > 0 && (
                    <Card className="p-4 text-left hover:shadow-lg transition-shadow cursor-pointer">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">📊</span>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {socialStats.moodLogs} Mood Logs
                          </p>
                          <p className="text-sm text-gray-500">{t('social.consistentTracking')}</p>
                        </div>
                      </div>
                    </Card>
                  )}

                  {socialStats.referrals > 0 && (
                    <Card className="p-4 text-left hover:shadow-lg transition-shadow cursor-pointer">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">🎯</span>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {socialStats.referrals} Referrals
                          </p>
                          <p className="text-sm text-gray-500">{t('social.helpedOthers')}</p>
                        </div>
                      </div>
                    </Card>
                  )}

                  {socialStats.leaderboardRank > 0 && (
                    <Card className="p-4 text-left hover:shadow-lg transition-shadow cursor-pointer">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">🏅</span>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            #{socialStats.leaderboardRank} Ranking
                          </p>
                          <p className="text-sm text-gray-500">{t('social.inLeaderboard')}</p>
                        </div>
                      </div>
                    </Card>
                  )}

                  <Card className="p-4 text-left hover:shadow-lg transition-shadow cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">⭐</span>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {t('social.activeMember')}
                        </p>
                        <p className="text-sm text-gray-500">{t('social.partOfUsers', { count: socialStats.communityMembers })}</p>
                      </div>
                    </div>
                  </Card>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('social.clickToShare')}
                </p>
              </div>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300">
                  {t('social.loginRequired.shareAchievements')}
                </p>
              </div>
            )}
          </TabPanel>
        </div>
      </Card>

      {/* Community Guidelines */}
      <div className="mt-6 sm:mt-8">
        <Card className="world-class-dashboard-card">
          <div className="p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 world-class-heading-3">
              {t('social.guidelines.title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="flex gap-3 sm:gap-4">
                <div className="text-3xl sm:text-4xl" role="img" aria-label="Supportive emoji">🤗</div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
                    {t('social.guidelines.supportive')}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('social.guidelines.supportiveDesc')}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4">
                <div className="text-3xl sm:text-4xl" role="img" aria-label="Respectful emoji">🤝</div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
                    {t('social.guidelines.respectful')}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('social.guidelines.respectfulDesc')}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4">
                <div className="text-3xl sm:text-4xl" role="img" aria-label="Privacy emoji">🔒</div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
                    {t('social.guidelines.privacy')}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('social.guidelines.privacyDesc')}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4">
                <div className="text-3xl sm:text-4xl" role="img" aria-label="Warning emoji">⚠️</div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
                    {t('social.guidelines.report')}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('social.guidelines.reportDesc')}
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
          {t('social.whyJoin')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="p-4 sm:p-6">
            <div className="text-5xl sm:text-6xl mb-3 sm:mb-4" role="img" aria-label="Strong emoji">💪</div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('social.benefits.motivation')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('social.benefits.motivationDesc')}
            </p>
          </div>

          <div className="p-4 sm:p-6">
            <div className="text-5xl sm:text-6xl mb-3 sm:mb-4" role="img" aria-label="Target emoji">🎯</div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('social.benefits.accountability')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('social.benefits.accountabilityDesc')}
            </p>
          </div>

          <div className="p-4 sm:p-6">
            <div className="text-5xl sm:text-6xl mb-3 sm:mb-4" role="img" aria-label="Star emoji">🌟</div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('social.benefits.sharedSuccess')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('social.benefits.sharedSuccessDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialHub;

