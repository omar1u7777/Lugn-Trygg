import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { analytics } from '../services/analytics';
import { useAccessibility } from './useAccessibility';
import useAuth from './useAuth';
import { getMeditationSessions } from '../api/meditation';
import { logger } from '../utils/logger';
import { Recommendation, RecommendationsProps } from '../types/recommendation';
import { getRecommendationsPool } from '../constants/recommendations';
import { EMPTY_WELLNESS_GOALS, type RecommendationFeedback } from '../constants/recommendationsConstants';

export const useRecommendations = ({ wellnessGoals = EMPTY_WELLNESS_GOALS }: RecommendationsProps) => {
  const _navigate = useNavigate();
  const { announceToScreenReader } = useAccessibility();
  const { _t } = useTranslation();
  const { user } = useAuth();
  
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [fcmTokenSaved, setFcmTokenSaved] = useState(false);
  const [meditationSessions, setMeditationSessions] = useState<{ id: string; date: string; duration: number }[]>([]);
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [feedback, setFeedback] = useState<Record<string, RecommendationFeedback>>({});
  const [savedRecommendations, setSavedRecommendations] = useState<Set<string>>(new Set());

  const loadRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const pool = getRecommendationsPool(wellnessGoals);
      const personalized = pool.filter(rec => {
        if (rec.type === 'wellness_goal' && wellnessGoals.length > 0) {
          return wellnessGoals.includes(rec.goalId || '');
        }
        return true;
      });
      
      setRecommendations(personalized.slice(0, 6));
    } catch (err) {
      logger.error('Failed to load recommendations:', err);
      setError('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, [wellnessGoals]);

  const handleRecommendationClick = useCallback((rec: Recommendation) => {
    setSelectedRecommendation(rec);
    analytics.track('recommendation_clicked', { type: rec.type, id: rec.id });
    announceToScreenReader(`Öppnar rekommendation: ${rec.title}`);
  }, [announceToScreenReader]);

  const handleFeedback = useCallback((recId: string, feedbackType: RecommendationFeedback) => {
    setFeedback(prev => ({ ...prev, [recId]: feedbackType }));
    analytics.track('recommendation_feedback', { recId, feedbackType });
  }, []);

  const handleSave = useCallback((recId: string) => {
    setSavedRecommendations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recId)) {
        newSet.delete(recId);
      } else {
        newSet.add(recId);
      }
      return newSet;
    });
    analytics.track('recommendation_saved', { recId, saved: !savedRecommendations.has(recId) });
  }, [savedRecommendations]);

  const handleShare = useCallback(async (rec: Recommendation) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: rec.title,
          text: rec.description,
          url: window.location.href,
        });
        analytics.track('recommendation_shared', { id: rec.id });
      } catch (err) {
        logger.error('Share failed:', err);
      }
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        try {
          const token = await saveFCMToken(user?.user_id || '');
          if (token) {
            setFcmTokenSaved(true);
            analytics.track('notification_permission_granted');
          }
        } catch (err) {
          logger.error('Failed to save FCM token:', err);
        }
      }
    }
  }, [user?.user_id]);

  const loadMeditationSessions = useCallback(async () => {
    try {
      const sessions = await getMeditationSessions(user?.user_id || '');
      setMeditationSessions(sessions);
    } catch (err) {
      logger.error('Failed to load meditation sessions:', err);
    }
  }, [user?.user_id]);

  return {
    recommendations,
    loading,
    error,
    notificationPermission,
    fcmTokenSaved,
    meditationSessions,
    selectedRecommendation,
    feedback,
    savedRecommendations,
    loadRecommendations,
    handleRecommendationClick,
    handleFeedback,
    handleSave,
    handleShare,
    requestNotificationPermission,
    loadMeditationSessions,
    setSelectedRecommendation,
  };
};
