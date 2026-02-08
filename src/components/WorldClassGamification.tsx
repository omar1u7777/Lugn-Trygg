import React, { useState, useEffect, useCallback } from 'react'
import {
  TrophyIcon,
  FireIcon,
  SparklesIcon,
  HeartIcon,
  ArrowTrendingUpIcon,
  XMarkIcon,
  ShareIcon,
  LockClosedIcon,
  CheckCircleIcon,
  ChartBarIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import {
  StarIcon as StarIconSolid,
  FireIcon as FireIconSolid,
  ShieldCheckIcon
} from '@heroicons/react/24/solid';
import { useAccessibility } from '../hooks/useAccessibility';
import { analytics } from '../services/analytics';
import useAuth from '../hooks/useAuth';
import { getMoods, getWeeklyAnalysis } from '../api/api';
import '../styles/world-class-design.css';
import { Button } from './ui/tailwind'; // Keep generic components
import { colors } from '../theme/tokens';
import { logger } from '../utils/logger';


// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface WorldClassGamificationProps {
  onClose: () => void;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: 'mood' | 'streak' | 'social' | 'growth';
}

interface UserStats {
  level: number;
  xp: number;
  xpToNext: number;
  streakDays: number;
  totalMoods: number;
  totalChats: number;
  achievementsUnlocked: number;
  totalAchievements: number;
}

// ----------------------------------------------------------------------
// Components
// ----------------------------------------------------------------------

// Reusable Bento Card (Inline for now to avoid large refactors elsewhere)
const BentoCard: React.FC<{
  children?: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  onClick?: () => void;
}> = ({ children, className = '', title, subtitle, icon, accentColor = 'bg-primary-500', onClick }) => (
  <div
    onClick={onClick}
    className={`
      group relative overflow-hidden rounded-[2rem] bg-white dark:bg-slate-800 border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-slate-900/50 transition-all duration-500 cursor-pointer
      ${className}
    `}
  >
    <div className="relative z-10 p-6 h-full flex flex-col">
      {(icon || title) && (
        <div className="mb-auto flex justify-between items-start w-full">
          {icon && (
            <div className={`w-12 h-12 rounded-2xl ${accentColor} bg-opacity-10 text-primary-600 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:rotate-6 sm:w-14 sm:h-14`}>
              {React.cloneElement(icon as React.ReactElement, { className: `w-6 h-6 sm:w-7 sm:h-7` })}
            </div>
          )}
        </div>
      )}

      <div>
        {title && <h3 className="text-xl font-bold mb-1 text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">{title}</h3>}
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        {children}
      </div>
    </div>
  </div>
);

// Rarity Badge Component
const RarityBadge: React.FC<{ rarity: Achievement['rarity'] }> = ({ rarity }) => {
  const colors = {
    common: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    rare: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
    epic: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300',
    legendary: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300',
  };

  const labels = {
    common: 'Vanlig',
    rare: 'Sällsynt',
    epic: 'Episk',
    legendary: 'Legendarisk'
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${colors[rarity]}`}>
      {labels[rarity]}
    </span>
  );
};

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

const WorldClassGamification: React.FC<WorldClassGamificationProps> = ({ onClose }) => {
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();

  const [stats, setStats] = useState<UserStats>({
    level: 1, xp: 0, xpToNext: 100, streakDays: 0, totalMoods: 0, totalChats: 0, achievementsUnlocked: 0, totalAchievements: 0,
  });

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGamificationData = useCallback(async () => {
    if (!user?.user_id) { setLoading(false); return; }

    try {
      setLoading(true);
      const [moodsData, weeklyAnalysisData] = await Promise.all([
        getMoods(user.user_id).catch(() => []),
        getWeeklyAnalysis(user.user_id).catch(() => ({})),
      ]);

      const totalMoods = Array.isArray(moodsData) ? moodsData.length : 0;

      // Calculate streak from mood data: consecutive days counting back from today
      const now = new Date();
      const daySet = new Set(
        (Array.isArray(moodsData) ? moodsData : []).map((m: any) => new Date(m.timestamp).toDateString())
      );
      let streakDays = 0;
      for (let i = 0; i < 365; i++) {
        const checkDate = new Date(now);
        checkDate.setDate(now.getDate() - i);
        if (daySet.has(checkDate.toDateString())) {
          streakDays++;
        } else if (i > 0) {
          break;
        }
      }

      // totalChats not available from weekly analysis — use totalMoods as chat proxy
      const totalChats = weeklyAnalysisData.totalMoods || 0;

      // Logic for Stats
      const moodXp = totalMoods * 10;
      const streakBonus = streakDays * 5;
      const chatXp = totalChats * 15;
      const totalXp = moodXp + streakBonus + chatXp;
      const currentLevel = Math.floor(totalXp / 100) + 1;
      const xpInLevel = totalXp % 100;

      // Achievements Data
      const realAchievements: Achievement[] = [
        {
          id: 'first-mood', title: 'Första steget', description: 'Logga ditt första humör',
          icon: <HeartIcon />, unlocked: totalMoods >= 1, progress: Math.min(totalMoods, 1), maxProgress: 1, rarity: 'common', category: 'mood',
        },
        {
          id: 'week-streak', title: 'Veckovinnare', description: 'Logga humör 7 dagar i rad',
          icon: <FireIconSolid />, unlocked: streakDays >= 7, progress: Math.min(streakDays, 7), maxProgress: 7, rarity: 'rare', category: 'streak',
        },
        {
          id: 'mood-explorer', title: 'Humörutforskare', description: 'Logga 10 humör totalt',
          icon: <SparklesIcon />, unlocked: totalMoods >= 10, progress: Math.min(totalMoods, 10), maxProgress: 10, rarity: 'rare', category: 'mood',
        },
        {
          id: 'conversation-starter', title: 'Samtalsinitiatör', description: 'Ha 10 AI-samtal',
          icon: <ChartBarIcon />, unlocked: totalChats >= 10, progress: Math.min(totalChats, 10), maxProgress: 10, rarity: 'common', category: 'growth',
        },
        {
          id: 'consistency-king', title: 'Konsekvenskung', description: 'Logga humör 30 dagar i rad',
          icon: <StarIconSolid />, unlocked: streakDays >= 30, progress: Math.min(streakDays, 30), maxProgress: 30, rarity: 'legendary', category: 'streak',
        },
        {
          id: 'mood-master', title: 'Humörmästare', description: 'Logga 50 humör totalt',
          icon: <ArrowTrendingUpIcon />, unlocked: totalMoods >= 50, progress: Math.min(totalMoods, 50), maxProgress: 50, rarity: 'epic', category: 'mood',
        },
      ];

      const unlockedCount = realAchievements.filter(a => a.unlocked).length;

      setStats({
        level: currentLevel, xp: xpInLevel, xpToNext: 100, streakDays, totalMoods, totalChats, achievementsUnlocked: unlockedCount, totalAchievements: realAchievements.length,
      });
      setAchievements(realAchievements);
      announceToScreenReader(`${unlockedCount} achievements upplåsta`, 'polite');

    } catch (error) {
      logger.error('❌ Failed to load gamification data:', error);
    } finally {
      setLoading(false);
    }
  }, [announceToScreenReader, user]);

  useEffect(() => { loadGamificationData(); }, [loadGamificationData]);

  if (loading) {
    return (
      <div className="p-12 text-center animate-pulse">
        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4" />
        <div className="h-6 w-1/3 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
      </div>
    );
  }

  const unlockedList = achievements.filter(a => a.unlocked);
  const lockedList = achievements.filter(a => !a.unlocked);

  return (
    <div className="w-full min-h-screen bg-[#fdfdfd] dark:bg-[#0b1121] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2 font-display">
              Min Resa 🏆
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Fira dina framsteg och din personliga utveckling.
            </p>
          </div>
          <button onClick={onClose} className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-gray-700" aria-label="Stäng">
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </header>

        {/* Hero Section - Level & Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Level Card - Main Feature */}
          <div className="lg:col-span-2">
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-2xl shadow-indigo-500/20 h-full p-8 sm:p-10 flex flex-col justify-between group">
              <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform duration-700 ease-in-out" />

              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold mb-4 border border-white/20 uppercase tracking-widest">
                    Nivå {stats.level}
                  </span>
                  <h3 className="text-4xl sm:text-5xl font-bold mb-2">Mental Mästare</h3>
                  <p className="text-indigo-100 text-lg max-w-md">Fortsätt din resa mot inre lugn. Du gör fantastiska framsteg!</p>
                </div>
                <div className="hidden sm:flex w-24 h-24 bg-white/20 backdrop-blur-md rounded-3xl items-center justify-center border border-white/20 shadow-inner">
                  <StarIconSolid className="w-12 h-12 text-yellow-300 drop-shadow-lg" />
                </div>
              </div>

              <div className="relative z-10 mt-8 sm:mt-0">
                <div className="flex justify-between text-sm font-medium mb-2 opacity-90">
                  <span>XP: {stats.xp} / {stats.xpToNext}</span>
                  <span>{Math.round((stats.xp / stats.xpToNext) * 100)}% till nivå {stats.level + 1}</span>
                </div>
                <div className="h-4 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
                  <div
                    className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                    style={{ width: `${(stats.xp / stats.xpToNext) * 100}%` }}
                  >
                    <div className="absolute inset-0 bg-white/30 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Bento */}
          <div className="grid grid-rows-2 gap-6 h-full">
            <BentoCard
              title={`${stats.streakDays} Dagar`}
              subtitle="Nuvarande Streak"
              icon={<FireIconSolid />}
              accentColor="bg-orange-500"
              className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-100 dark:border-orange-800/30"
            />
            <BentoCard
              title={`${stats.achievementsUnlocked}/${stats.totalAchievements}`}
              subtitle="Upplåsta Achievements"
              icon={<TrophyIcon />}
              accentColor="bg-yellow-500"
              className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-100 dark:border-yellow-800/30"
            />
          </div>
        </div>

        {/* Stats Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: 'Humör incheckningar', value: stats.totalMoods, icon: <HeartIcon className="text-pink-500" />, bg: 'bg-pink-50' },
            { label: 'AI Samtal', value: stats.totalChats, icon: <UserGroupIcon className="text-blue-500" />, bg: 'bg-blue-50' },
            { label: 'Totala XP', value: (stats.level - 1) * 100 + stats.xp, icon: <SparklesIcon className="text-purple-500" />, bg: 'bg-purple-50' },
            { label: 'Ranking', value: 'Topp 10%', icon: <ArrowTrendingUpIcon className="text-green-500" />, bg: 'bg-green-50' }
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm flex flex-col items-center text-center hover:scale-[1.02] transition-transform">
              <div className={`mb-3 p-3 rounded-2xl ${stat.bg} dark:bg-opacity-10`}>
                {React.cloneElement(stat.icon as React.ReactElement, { className: "w-6 h-6 " + stat.icon.props.className })}
              </div>
              <span className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stat.value}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Achievements Section */}
        <section className="mb-12">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <TrophyIcon className="w-6 h-6 text-yellow-500" />
            Dina Utmärkelser
          </h3>

          {unlockedList.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {unlockedList.map(ach => (
                <div key={ach.id} className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-gray-100 dark:border-gray-700/50 shadow-lg relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-16 bg-gradient-to-bl from-yellow-400/20 to-transparent rounded-bl-full transform translate-x-1/2 -translate-y-1/2" />
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 flex items-center justify-center shadow-inner">
                        {React.cloneElement(ach.icon as React.ReactElement, { className: 'w-7 h-7' })}
                      </div>
                      <RarityBadge rarity={ach.rarity} />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{ach.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{ach.description}</p>
                    <div className="flex items-center gap-2 text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-3 py-1.5 rounded-full w-fit">
                      <CheckCircleIcon className="w-4 h-4" />
                      Upplåst
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-gray-50 dark:bg-slate-800/50 rounded-[2rem] border border-dashed border-gray-200 dark:border-gray-700">
              <p className="text-gray-500">Du har inga utmärkelser än. Fortsätt din resa!</p>
            </div>
          )}
        </section>

        {/* Locked Achievements */}
        {lockedList.length > 0 && (
          <section>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2 opacity-80">
              <LockClosedIcon className="w-6 h-6 text-gray-400" />
              Kommande Utmaningar
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {lockedList.map(ach => (
                <div key={ach.id} className="bg-gray-50 dark:bg-slate-800/40 rounded-3xl p-6 border border-gray-200 dark:border-gray-700/50 opacity-70 hover:opacity-100 transition-opacity">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-400 flex items-center justify-center">
                      <LockClosedIcon className="w-6 h-6" />
                    </div>
                  </div>
                  <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-1">{ach.title}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{ach.description}</p>

                  {/* Progress Bar */}
                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                      <span className="text-xs font-semibold inline-block text-gray-600 dark:text-gray-400">
                        {ach.progress} / {ach.maxProgress}
                      </span>
                    </div>
                    <div className="overflow-hidden h-2 mb-4 text-xs flex rounded-full bg-gray-200 dark:bg-gray-700">
                      <div style={{ width: `${(ach.progress / ach.maxProgress) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500 transition-all duration-500"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default WorldClassGamification;
