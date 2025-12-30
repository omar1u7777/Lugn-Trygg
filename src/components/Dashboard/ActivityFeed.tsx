import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion';
import { Typography, Card } from '../ui/tailwind';
import { api } from '../../api/api';

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
    if (userId) {
      loadActivities();
    }
  }, [userId]);

  const loadActivities = async () => {
    // CRITICAL FIX: Check userId before making API calls
    if (!userId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const allActivities: Activity[] = [];

      // Fetch moods
      try {
        const moodsResponse = await api.get(`/api/mood/get?user_id=${userId}`);
        // CRITICAL FIX: Better data extraction
        const moods = (moodsResponse.data?.moods || moodsResponse.data || []).slice(0, 5);
        moods.forEach((mood: any) => {
          try {
            const moodDate = mood.timestamp?.toDate ? mood.timestamp.toDate() : new Date(mood.timestamp);
            // CRITICAL FIX: Validate date
            if (isNaN(moodDate.getTime())) return;
            
            // Get mood text, handle encrypted data
            let moodText = mood.mood_text || 'Okänt';
            if (moodText.startsWith('U2FsdGVk')) {
              // Encrypted, use score-based label
              const s = mood.score ?? 5;
              if (s >= 8) moodText = 'Glad';
              else if (s >= 6) moodText = 'Bra';
              else if (s >= 4) moodText = 'Neutral';
              else if (s >= 2) moodText = 'Orolig';
              else moodText = 'Ledsen';
            }
            
            allActivities.push({
              id: `mood-${mood.id || Math.random()}`,
              type: 'mood',
              title: 'Humörloggning',
              description: `Loggade humör: ${moodText}`,
              timestamp: moodDate,
              icon: '😊',
              color: 'blue',
            });
          } catch (error) {
            console.warn('Error processing mood:', error);
          }
        });
      } catch (error) {
        // CRITICAL FIX: Better error handling
        console.log('Could not load moods for activity feed:', error);
      }

      // Fetch referrals
      try {
        const referralResponse = await api.get(`/api/referral/history?user_id=${userId}`);
        const referrals = (referralResponse.data?.referrals || referralResponse.data || []).slice(0, 3);
        referrals.forEach((ref: any) => {
          try {
            if (!ref.completed_at) return;
            const refDate = new Date(ref.completed_at);
            // CRITICAL FIX: Validate date
            if (isNaN(refDate.getTime())) return;
            
            allActivities.push({
              id: `referral-${ref.referred_user_id || ref.id || Math.random()}`,
              type: 'referral',
              title: 'Ny referens',
              description: `${ref.referred_email || 'Någon'} gick med via din kod!`,
              timestamp: refDate,
              icon: '🎁',
              color: 'purple',
            });
          } catch (error) {
            console.warn('Error processing referral:', error);
          }
        });
      } catch (error) {
        // CRITICAL FIX: Better error handling
        console.log('Could not load referrals for activity feed:', error);
      }

      // Fetch feedback
      try {
        const feedbackResponse = await api.get(`/api/feedback/my-feedback?user_id=${userId}`);
        const feedbacks = (feedbackResponse.data?.feedback || feedbackResponse.data || []).slice(0, 3);
        feedbacks.forEach((fb: any) => {
          try {
            if (!fb.timestamp && !fb.created_at) return;
            const fbDate = new Date(fb.timestamp || fb.created_at);
            // CRITICAL FIX: Validate date
            if (isNaN(fbDate.getTime())) return;
            
            allActivities.push({
              id: `feedback-${fb.id || Math.random()}`,
              type: 'feedback',
              title: 'Feedback skickad',
              description: `Kategori: ${fb.category || 'Okänd'}`,
              timestamp: fbDate,
              icon: '💬',
              color: 'green',
            });
          } catch (error) {
            console.warn('Error processing feedback:', error);
          }
        });
      } catch (error) {
        // CRITICAL FIX: Better error handling
        console.log('Could not load feedback for activity feed:', error);
      }

      // Sort by timestamp (newest first)
      // CRITICAL FIX: Better error handling for sorting
      allActivities.sort((a, b) => {
        try {
          return b.timestamp.getTime() - a.timestamp.getTime();
        } catch (error) {
          return 0;
        }
      });

      setActivities(allActivities.slice(0, 10)); // Show latest 10
    } catch (error: unknown) {
      // CRITICAL FIX: Better error handling
      console.error('Failed to load activity feed:', error);
      setActivities([]);
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

  const getColorStyles = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-700 dark:text-blue-300',
          iconBg: 'blue',
        };
      case 'purple':
        return {
          bg: 'bg-purple-50 dark:bg-purple-900/20',
          borderColor: 'border-purple-200 dark:border-purple-800',
          textColor: 'text-purple-700 dark:text-purple-300',
          iconBg: 'purple',
        };
      case 'green':
        return {
          bg: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          textColor: 'text-green-700 dark:text-green-300',
          iconBg: 'green',
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-800',
          borderColor: 'border-gray-200 dark:border-gray-700',
          textColor: 'text-gray-900 dark:text-gray-100',
          iconBg: 'gray',
        };
    }
  };

  if (loading) {
    return (
      <Card className="shadow-sm">
        <div className="p-6">
          <Typography variant="h6" className="font-semibold mb-4 flex items-center gap-2">
            <span>📋</span>
            Senaste aktivitet
          </Typography>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-4 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <div className="p-6">
        <Typography variant="h6" className="font-semibold mb-4 flex items-center gap-2">
          <span>📋</span>
          Senaste aktivitet
        </Typography>

        {activities.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4" aria-hidden="true">🌱</div>
            <Typography variant="body2" className="text-gray-600 dark:text-gray-400 mb-2">
              Ingen aktivitet än.
            </Typography>
            <Typography variant="caption" className="text-gray-500 dark:text-gray-500">
              Börja genom att logga ditt humör!
            </Typography>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity, index) => {
              const colors = getColorStyles(activity.color);
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    colors.iconBg === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                    colors.iconBg === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' :
                    colors.iconBg === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                    'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    <span className="text-xl">{activity.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Typography variant="body2" className={`font-semibold mb-1 truncate ${colors.textColor}`}>
                      {activity.title}
                    </Typography>
                    <Typography variant="caption" className="text-gray-600 dark:text-gray-400 block truncate mb-1">
                      {activity.description}
                    </Typography>
                    <Typography variant="caption" className="text-gray-500 dark:text-gray-500 text-xs">
                      {getTimeAgo(activity.timestamp)}
                    </Typography>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};

export default ActivityFeed;


