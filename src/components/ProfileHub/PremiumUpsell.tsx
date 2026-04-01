import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../ui/tailwind';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { 
  StarIcon,
  ClockIcon,
  FireIcon,
  ChartBarIcon,
  SparklesIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

interface PremiumUpsellProps {
  usage: any;
  stats: {
    totalMoods: number;
    totalConversations: number;
    totalMemories: number;
    accountAge: number;
  };
  className?: string;
}

const PremiumUpsell: React.FC<PremiumUpsellProps> = ({ 
  usage, 
  stats, 
  className = '' 
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { plan } = useSubscription();
  const [timeLeft, setTimeLeft] = useState('');
  const [showUpsell, setShowUpsell] = useState(false);
  const [upsellType, setUpsellType] = useState<'usage' | 'engagement' | 'streak' | 'limit'>('usage');

  // Calculate time until daily reset
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const diff = tomorrow.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setTimeLeft(`${hours}h ${minutes}m`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Determine if and when to show upsell
  useEffect(() => {
    const shouldShow = () => {
      // Don't show if already premium
      if (plan?.name === 'premium') return false;

      const usagePercentage = {
        moods: (usage.moodLogs / plan.limits.moodLogsPerDay) * 100,
        chats: (usage.chatMessages / plan.limits.chatMessagesPerDay) * 100,
      };

      // Trigger conditions with psychological timing
      if (usagePercentage.moods >= 80 || usagePercentage.chats >= 80) {
        setUpsellType('limit');
        return true; // Near limit - scarcity effect
      }

      if (stats.totalMoods >= 5 || stats.totalConversations >= 3) {
        setUpsellType('engagement');
        return true; // Engaged user - investment principle
      }

      if (stats.accountAge >= 3 && stats.totalMoods > 0) {
        setUpsellType('streak');
        return true; // Building streak - loss aversion
      }

      if (usagePercentage.moods >= 50 || usagePercentage.chats >= 50) {
        setUpsellType('usage');
        return true; // Halfway through usage
      }

      return false;
    };

    setShowUpsell(shouldShow());
  }, [usage, stats, plan]);

  const getUpsellContent = () => {
    switch (upsellType) {
      case 'limit':
        return {
          title: t('premiumUpsell.limitTitle', 'Nästan slut på användning?'),
          subtitle: t('premiumUpsell.limitSubtitle', 'Få obegränsat med Premium'),
          message: t('premiumUpsell.limitMessage', 'Du har {{moods}}/{{max}} humörloggningar kvar idag. Förlora inte din momentum!'),
          benefits: [
            t('premiumUpsell.benefitUnlimited', 'Obegränsade humörloggningar'),
            t('premiumUpsell.benefitChats', 'Obegränsade AI-samtal'),
            t('premiumUpsell.benefitHistory', 'Alltid tillgång till din historik'),
          ],
          urgency: t('premiumUpsell.limitUrgency', 'Återställning om {{timeLeft}}'),
          cta: t('premiumUpsell.unlockNow', 'Lås upp obegränsat -20%'),
        };

      case 'engagement':
        return {
          title: t('premiumUpsell.engagementTitle', 'Du bygger en bra vana!'),
          subtitle: t('premiumUpsell.engagementSubtitle', 'Skydda dina framsteg'),
          message: t('premiumUpsell.engagementMessage', 'Med {{moods}} loggade stämningar och {{chats}} samtal är du på god väg.'),
          benefits: [
            t('premiumUpsell.benefitInsights', 'Djupare insikter om dina mönster'),
            t('premiumUpsell.benefitTrends', 'Långsiktiga trender och analyser'),
            t('premiumUpsell.benefitExport', 'Exportera all din data'),
          ],
          urgency: t('premiumUpsell.engagementUrgency', 'Begränsat erbjudande för engagerade användare'),
          cta: t('premiumUpsell.continueJourney', 'Fortsätt din resa'),
        };

      case 'streak':
        return {
          title: t('premiumUpsell.streakTitle', '{{days}} dagar av kontinuitet!'),
          subtitle: t('premiumUpsell.streakSubtitle', 'Bryt inte kedjan'),
          message: t('premiumUpsell.streakMessage', 'Du har byggt en vana. Se till att du kan fortsätta.'),
          benefits: [
            t('premiumUpsell.benefitStreakProtection', 'Aldrig mer begränsningar'),
            t('premiumUpsell.benefitReminders', 'Smartare påminnelser'),
            t('premiumUpsell.benefitGoals', 'Personliga mål och utmaningar'),
          ],
          urgency: t('premiumUpsell.streakUrgency', '{{streakUsers}} användare har skyddat sin streak'),
          cta: t('premiumUpsell.protectStreak', 'Skydda din streak'),
        };

      default:
        return {
          title: t('premiumUpsell.defaultTitle', 'Uppgradera din upplevelse'),
          subtitle: t('premiumUpsell.defaultSubtitle', 'Upptäck Premium-funktioner'),
          message: t('premiumUpsell.defaultMessage', 'Få mer från din välmåenderesa.'),
          benefits: [
            t('premiumUpsell.benefitUnlimited', 'Obegränsade humörloggningar'),
            t('premiumUpsell.benefitChats', 'Obegränsade AI-samtal'),
            t('premiumUpsell.benefitInsights', 'Djupare insikter'),
          ],
          urgency: t('premiumUpsell.defaultUrgency', 'Starta din 14-dagars provperiod'),
          cta: t('premiumUpsell.tryPremium', 'Prova Premium gratis'),
        };
    }
  };

  if (!showUpsell) return null;

  const content = getUpsellContent();

  const getIcon = () => {
    switch (upsellType) {
      case 'limit': return <ClockIcon className="w-5 h-5 text-amber-600" />;
      case 'engagement': return <FireIcon className="w-5 h-5 text-orange-600" />;
      case 'streak': return <ChartBarIcon className="w-5 h-5 text-green-600" />;
      default: return <SparklesIcon className="w-5 h-5 text-purple-600" />;
    }
  };

  const getGradient = () => {
    switch (upsellType) {
      case 'limit': return 'from-amber-50 to-orange-50 border-amber-200 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-800';
      case 'engagement': return 'from-orange-50 to-red-50 border-orange-200 dark:from-orange-900/20 dark:to-red-900/20 dark:border-orange-800';
      case 'streak': return 'from-green-50 to-emerald-50 border-green-200 dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-800';
      default: return 'from-purple-50 to-pink-50 border-purple-200 dark:from-purple-900/20 dark:to-pink-900/20 dark:border-purple-800';
    }
  };

  return (
    <Card className={`${getGradient()} ${className} transform transition-all duration-500 hover:scale-[1.02]`}>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              {getIcon()}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                {content.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {content.subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <StarIcon className="w-5 h-5" />
            <span className="text-sm font-semibold">PREMIUM</span>
          </div>
        </div>

        {/* Personalized message */}
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          {content.message}
          {upsellType === 'limit' && (
            <span className="ml-1 font-semibold text-amber-600 dark:text-amber-400">
              {t('premiumUpsell.remaining', '{{remaining}} kvar', {
                remaining: plan.limits.moodLogsPerDay - usage.moodLogs
              })}
            </span>
          )}
        </p>

        {/* Benefits */}
        <div className="space-y-2 mb-4">
          {content.benefits.map((benefit, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
              {benefit}
            </div>
          ))}
        </div>

        {/* Urgency indicator */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            {content.urgency.replace('{{timeLeft}}', timeLeft)}
          </p>
          {upsellType === 'engagement' && (
            <div className="flex -space-x-2">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-6 h-6 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-xs font-bold"
                >
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA Button */}
        <Button
          variant="primary"
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          onClick={() => navigate('/upgrade')}
        >
          {content.cta}
          <ArrowRightIcon className="w-4 h-4 ml-2" />
        </Button>

        {/* Trust indicator */}
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {t('premiumUpsell.trust', 'Ingen bindningstid. Avbryt när som helst.')}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default PremiumUpsell;
