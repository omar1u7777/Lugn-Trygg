import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../../api/api';

interface ActivityFeedProps {
  userId: string;
}

interface Activity {
  id: string;
  type: 'mood' | 'memory' | 'referral' | 'feedback';
  title: string;
  description: string;
  timestamp: Date;
  icon: string;
  color: string;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ userId }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [userId]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const allActivities: Activity[] = [];

      // Fetch moods
      try {
        const moodsResponse = await api.get(`/api/mood?user_id=${userId}`);
        const moods = (moodsResponse.data || []).slice(0, 5);
        moods.forEach((mood: any) => {
          const moodDate = mood.timestamp?.toDate ? mood.timestamp.toDate() : new Date(mood.timestamp);
          allActivities.push({
            id: `mood-${mood.id || Math.random()}`,
            type: 'mood',
            title: 'Humörloggning',
            description: `Loggade humör: ${mood.mood_text || 'Okänt'}`,
            timestamp: moodDate,
            icon: '😊',
            color: 'blue',
          });
        });
      } catch (error) {
        console.log('Could not load moods for activity feed');
      }

      // Fetch referrals
      try {
        const referralResponse = await api.get('/api/referral/history');
        const referrals = (referralResponse.data?.referrals || []).slice(0, 3);
        referrals.forEach((ref: any) => {
          allActivities.push({
            id: `referral-${ref.referred_user_id}`,
            type: 'referral',
            title: 'Ny referens',
            description: `${ref.referred_email} gick med via din kod!`,
            timestamp: new Date(ref.completed_at),
            icon: '🎁',
            color: 'purple',
          });
        });
      } catch (error) {
        console.log('Could not load referrals for activity feed');
      }

      // Fetch feedback
      try {
        const feedbackResponse = await api.get('/api/feedback/my-feedback');
        const feedbacks = (feedbackResponse.data?.feedback || []).slice(0, 3);
        feedbacks.forEach((fb: any) => {
          allActivities.push({
            id: `feedback-${fb.id}`,
            type: 'feedback',
            title: 'Feedback skickad',
            description: `Kategori: ${fb.category}`,
            timestamp: new Date(fb.timestamp),
            icon: '💬',
            color: 'green',
          });
        });
      } catch (error) {
        console.log('Could not load feedback for activity feed');
      }

      // Sort by timestamp (newest first)
      allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setActivities(allActivities.slice(0, 10)); // Show latest 10
    } catch (error) {
      console.error('Failed to load activity feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min sedan`;
    if (diffHours < 24) return `${diffHours} timmar sedan`;
    return `${diffDays} dagar sedan`;
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-900 dark:text-blue-100',
          icon: 'bg-blue-500',
        };
      case 'purple':
        return {
          bg: 'bg-purple-50 dark:bg-purple-900/20',
          border: 'border-purple-200 dark:border-purple-800',
          text: 'text-purple-900 dark:text-purple-100',
          icon: 'bg-purple-500',
        };
      case 'green':
        return {
          bg: 'bg-green-50 dark:bg-green-900/20',
          border: 'border-green-200 dark:border-green-800',
          text: 'text-green-900 dark:text-green-100',
          icon: 'bg-green-500',
        };
      default:
        return {
          bg: 'bg-slate-50 dark:bg-slate-800',
          border: 'border-slate-200 dark:border-slate-700',
          text: 'text-slate-900 dark:text-slate-100',
          icon: 'bg-slate-500',
        };
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-soft">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span>📋</span>
          Senaste aktivitet
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-soft">
      <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <span>📋</span>
        Senaste aktivitet
      </h3>

      {activities.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">🌱</div>
          <p className="text-slate-600 dark:text-slate-400">Ingen aktivitet än.</p>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
            Börja genom att logga ditt humör!
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {activities.map((activity, index) => {
            const colors = getColorClasses(activity.color);
            return (
              <motion.div
                key={activity.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${colors.bg} ${colors.border}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className={`w-10 h-10 ${colors.icon} rounded-full flex items-center justify-center text-white text-xl flex-shrink-0`}>
                  {activity.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`font-semibold ${colors.text} text-sm`}>
                    {activity.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                    {activity.description}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                    {getTimeAgo(activity.timestamp)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
