/**
 * Group Challenges Component
 * Team-based wellness challenges for community engagement
 * REAL IMPLEMENTATION - Uses backend API
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Card, Button, Dialog } from './ui/tailwind';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { trackEvent } from '../services/analytics';
import {
  getChallenges,
  joinChallenge,
  leaveChallenge,
  getUserChallenges,
  type Challenge
} from '../api/api';
import {
  ClockIcon,
  TrophyIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XMarkIcon,
  PlusIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { logger } from '../utils/logger';

interface GroupChallengesProps {
  userId: string;
  username: string;
}

export const GroupChallenges: React.FC<GroupChallengesProps> = ({ userId }) => {
  const { t } = useTranslation();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userChallenges, setUserChallenges] = useState<string[]>([]);
  const [userProgress, setUserProgress] = useState<Record<string, { current_value: number; completed: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch challenges from backend
  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allChallenges, userData] = await Promise.all([
        getChallenges(false),
        getUserChallenges(userId)
      ]);

      setChallenges(allChallenges);
      setUserChallenges(userData.challenges?.map((c: Challenge) => c.id) || []);
      setUserProgress(userData.progress || {});
    } catch (err) {
      logger.error('Failed to fetch challenges:', err);
      setError(t('challenges.loadError', 'Kunde inte ladda utmaningar. Försök igen.'));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const getDifficultyColor = (type: string) => {
    switch (type) {
      case 'mood_logging': return '#4CAF50';
      case 'meditation': return '#9C27B0';
      case 'journaling': return '#2196F3';
      case 'social': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getTimeRemaining = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return t('challenges.ended', 'Avslutad');

    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (days > 0) return `${days}d ${hours}h kvar`;
    return `${hours}h kvar`;
  };

  const handleJoinChallenge = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setShowJoinDialog(true);
  };

  const confirmJoinChallenge = async () => {
    if (!selectedChallenge) return;

    setJoining(selectedChallenge.id);
    try {
      await joinChallenge(selectedChallenge.id);

      trackEvent('group_challenge_joined', {
        userId,
        challengeId: selectedChallenge.id,
        challengeTitle: selectedChallenge.title,
      });

      // Refresh data
      await fetchChallenges();
      setShowJoinDialog(false);
    } catch (err) {
      logger.error('Failed to join challenge:', err);
      setError(t('challenges.joinError', 'Kunde inte gå med i utmaningen.'));
    } finally {
      setJoining(null);
    }
  };

  const handleLeaveChallenge = async (challengeId: string) => {
    try {
      await leaveChallenge(challengeId);

      trackEvent('group_challenge_left', {
        userId,
        challengeId,
      });

      await fetchChallenges();
    } catch (err) {
      logger.error('Failed to leave challenge:', err);
      setError(t('challenges.leaveError', 'Kunde inte lämna utmaningen.'));
    }
  };

  const isUserInChallenge = (challengeId: string) => {
    return userChallenges.includes(challengeId);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Card className="border border-gray-200 dark:border-gray-700">
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-7 h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border border-gray-200 dark:border-gray-700">
              <div className="p-4 sm:p-6 space-y-4">
                <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-2.5 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <UserGroupIcon className="w-6 h-6 sm:w-7 sm:h-7 text-primary-600" aria-hidden="true" />
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {t('challenges.groupTitle', 'Gruppurmaningar')}
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchChallenges}
              className="flex items-center gap-2"
            >
              <ArrowPathIcon className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('common.refresh', 'Uppdatera')}</span>
            </Button>
          </div>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {t('challenges.subtitle', 'Tävla med andra för att uppnå wellness-mål tillsammans!')}
          </p>
        </div>
      </Card>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
        </div>
      )}

      {/* Info Alert */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          {t('challenges.info', 'Gå med i en gruppurtianing för att tjäna bonus XP och exklusiva badges. Jobba tillsammans för att nå målet!')}
        </p>
      </div>

      {/* Empty State */}
      {challenges.length === 0 && (
        <Card className="border border-gray-200 dark:border-gray-700">
          <div className="p-8 text-center">
            <TrophyIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('challenges.empty', 'Inga aktiva utmaningar')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('challenges.emptyDesc', 'Det finns inga aktiva gruppurmaningar just nu. Kom tillbaka snart!')}
            </p>
          </div>
        </Card>
      )}

      {/* Challenges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {challenges.map((challenge, index) => {
          const isJoined = isUserInChallenge(challenge.id);
          const progress = userProgress[challenge.id];
          const participantCount = challenge.participants?.length || 0;
          const progressPercent = progress
            ? Math.min(100, (progress.current_value / challenge.target_value) * 100)
            : 0;

          return (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="border border-gray-200 dark:border-gray-700 h-full">
                <div className="p-4 sm:p-6 flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-3">
                        {challenge.title}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: getDifficultyColor(challenge.type) }}
                        >
                          {challenge.type.replace('_', ' ')}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          <ClockIcon className="w-3.5 h-3.5" aria-hidden="true" />
                          {getTimeRemaining(challenge.end_date)}
                        </span>
                        {isJoined && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            <CheckCircleIcon className="w-3.5 h-3.5" aria-hidden="true" />
                            Deltager
                          </span>
                        )}
                      </div>
                    </div>
                    <TrophyIcon className="w-6 h-6 text-warning-600 flex-shrink-0" aria-hidden="true" />
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {challenge.description}
                  </p>

                  {/* Progress Section */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {isJoined ? t('challenges.yourProgress', 'Din Progress') : t('challenges.goal', 'Mål')}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                        {isJoined && progress
                          ? `${progress.current_value} / ${challenge.target_value}`
                          : `0 / ${challenge.target_value}`
                        }
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${progressPercent}%`,
                          backgroundColor: getDifficultyColor(challenge.type)
                        }}
                        role="progressbar"
                        aria-valuenow={progress?.current_value || 0}
                        aria-valuemin={0}
                        aria-valuemax={challenge.target_value}
                      />
                    </div>
                  </div>

                  {/* Team Info */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('challenges.participants', 'Deltagare')}
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {participantCount} {t('challenges.people', 'personer')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('challenges.duration', 'Varaktighet')}
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {challenge.duration_days} {t('challenges.days', 'dagar')}
                      </p>
                    </div>
                  </div>

                  {/* Reward */}
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {t('challenges.reward', 'Belöning:')}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {challenge.xp_reward} XP {challenge.badge_reward && `+ ${challenge.badge_reward}`}
                    </p>
                  </div>

                  {/* Action Button */}
                  {isJoined ? (
                    <Button
                      variant="outline"
                      onClick={() => handleLeaveChallenge(challenge.id)}
                      className="w-full min-h-[44px] flex items-center justify-center gap-2 mt-auto text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                    >
                      <XMarkIcon className="w-5 h-5" aria-hidden="true" />
                      <span>{t('challenges.leave', 'Lämna Utmaning')}</span>
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => handleJoinChallenge(challenge)}
                      disabled={joining === challenge.id}
                      className="w-full min-h-[44px] flex items-center justify-center gap-2 mt-auto"
                    >
                      {joining === challenge.id ? (
                        <ArrowPathIcon className="w-5 h-5 animate-spin" aria-hidden="true" />
                      ) : (
                        <PlusIcon className="w-5 h-5" aria-hidden="true" />
                      )}
                      <span>{t('challenges.join', 'Gå Med')}</span>
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Join Challenge Dialog */}
      <Dialog open={showJoinDialog} onClose={() => setShowJoinDialog(false)}>
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {t('challenges.joinTitle', 'Gå Med i Utmaning')}
            </h2>
            <button
              onClick={() => setShowJoinDialog(false)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Stäng dialog"
            >
              <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
            </button>
          </div>

          {selectedChallenge && (
            <div className="space-y-6">
              {/* Challenge Info */}
              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {selectedChallenge.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedChallenge.description}
                </p>
              </div>

              {/* Commitment Message */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  {t('challenges.commitment', 'Genom att gå med förbinder du dig att bidra till gruppens mål. Varje åtgärd räknas!')}
                </p>
              </div>

              {/* Details */}
              <div>
                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                  {t('challenges.details', 'Utmaningsdetaljer:')}
                </h4>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li>• <strong>{t('challenges.goal', 'Mål:')}</strong> {selectedChallenge.target_value} {selectedChallenge.type.replace('_', ' ')}</li>
                  <li>• <strong>{t('challenges.timeLeft', 'Tid kvar:')}</strong> {getTimeRemaining(selectedChallenge.end_date)}</li>
                  <li>• <strong>{t('challenges.reward', 'Belöning:')}</strong> {selectedChallenge.xp_reward} XP</li>
                  <li>• <strong>{t('challenges.participants', 'Deltagare:')}</strong> {selectedChallenge.participants?.length || 0}</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                <Button
                  onClick={() => setShowJoinDialog(false)}
                  variant="outline"
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  {t('common.cancel', 'Avbryt')}
                </Button>
                <Button
                  onClick={confirmJoinChallenge}
                  disabled={joining === selectedChallenge.id}
                  variant="primary"
                  className="w-full sm:flex-1 min-h-[44px] flex items-center justify-center gap-2"
                >
                  {joining === selectedChallenge.id ? (
                    <ArrowPathIcon className="w-5 h-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <UserGroupIcon className="w-5 h-5" aria-hidden="true" />
                  )}
                  <span>{t('challenges.confirmJoin', 'Gå Med i Team')}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};

export default GroupChallenges;


