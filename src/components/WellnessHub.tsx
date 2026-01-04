import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SparklesIcon,
  MusicalNoteIcon,
  HandRaisedIcon,
  CloudIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  ExclamationTriangleIcon,
  HeartIcon,
  FireIcon,
  MoonIcon,
  SunIcon,
  BookOpenIcon,
  ArrowRightIcon,
  PencilSquareIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import RelaxingSounds from './RelaxingSounds';
import WellnessGoalsOnboarding from './Wellness/WellnessGoalsOnboarding';
import MicroInteractions from './MicroInteractions';
import useAuth from '../hooks/useAuth';
import { getMoods, saveMeditationSession, getMeditationSessions, getWellnessGoals } from '../api/api';
import { Card, Button } from './ui/tailwind'; // Keep compatible
import OptimizedImage from './ui/OptimizedImage';
import { getWellnessHeroImageId } from '../config/env';

// ----------------------------------------------------------------------
// Constants & Types
// ----------------------------------------------------------------------

const WELLNESS_HERO_IMAGE_ID = getWellnessHeroImageId();
const WELLNESS_HERO_FALLBACK_SRC = 'https://res.cloudinary.com/dxmijbysc/image/upload/c_scale,w_auto,dpr_auto,q_auto,f_auto/hero-bild_pfcdsx.jpg';
const WELLNESS_HERO_SIZES = '(min-width: 1280px) 520px, (min-width: 1024px) 440px, (min-width: 768px) 70vw, 100vw';

interface WellnessStats {
  meditationMinutes: number;
  breathingExercises: number;
  relaxationSessions: number;
  streakDays: number;
}

interface ApiError {
  response?: { status?: number; data?: { error?: string } };
  message?: string;
}

interface MeditationOption {
  id: string;
  title: string;
  duration: number;
  type: 'guided_meditation' | 'breathing_exercise' | 'soundscape';
  description: string;
  image?: string; // Placeholder for future images
  color?: string;
  icon?: React.ReactNode;
}

// ----------------------------------------------------------------------
// Components
// ----------------------------------------------------------------------

const CategoryPill: React.FC<{
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void
}> = ({ active, label, icon, onClick }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105
      ${active
        ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30 ring-2 ring-primary-600 ring-offset-2 dark:ring-offset-slate-900'
        : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400'}
    `}
  >
    {icon}
    {label}
  </button>
);

const BentoCard: React.FC<{
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  imageHtml?: React.ReactNode;
  accentColor?: string;
}> = ({ children, className = '', onClick, title, subtitle, icon, imageHtml, accentColor = 'bg-primary-500' }) => (
  <div
    onClick={onClick}
    className={`
      group relative overflow-hidden rounded-[2rem] bg-white dark:bg-slate-800 border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-slate-900/50 transition-all duration-500 cursor-pointer
      ${className}
    `}
  >
    {imageHtml && (
      <div className="absolute inset-0 z-0 transition-transform duration-700 group-hover:scale-110 opacity-90">
        {imageHtml}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      </div>
    )}

    <div className={`relative z-10 p-6 h-full flex flex-col ${imageHtml ? 'justify-end text-white' : ''}`}>
      {(icon || title) && (
        <div className="mb-auto w-full flex justify-between items-start">
          {icon && (
            <div className={`w-10 h-10 rounded-2xl ${imageHtml ? 'bg-white/20 backdrop-blur-md' : accentColor + ' bg-opacity-10 text-primary-600'} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:rotate-6`}>
              {React.cloneElement(icon as React.ReactElement, { className: `w-5 h-5 ${imageHtml ? 'text-white' : ''}` })}
            </div>
          )}
        </div>
      )}

      <div>
        {title && <h3 className={`text-xl font-bold mb-1 ${imageHtml ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{title}</h3>}
        {subtitle && <p className={`text-sm ${imageHtml ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>{subtitle}</p>}
        {children}
      </div>

      {imageHtml && (
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-2 group-hover:translate-x-0">
          <div className="w-8 h-8 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center">
            <ArrowRightIcon className="w-4 h-4 text-white" />
          </div>
        </div>
      )}
    </div>
  </div>
);

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

const WellnessHub: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<'all' | 'meditation' | 'breathing' | 'sounds' | 'sleep'>('all');

  // State
  const [wellnessStats, setWellnessStats] = useState<WellnessStats>({
    meditationMinutes: 0,
    breathingExercises: 0,
    relaxationSessions: 0,
    streakDays: 0
  });
  const [userGoals, setUserGoals] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Meditation Playback State
  const [selectedMeditation, setSelectedMeditation] = useState<MeditationOption | null>(null);
  const [isMeditationActive, setIsMeditationActive] = useState(false);
  const [meditationTimeLeft, setMeditationTimeLeft] = useState(0);
  const [meditationStartTime, setMeditationStartTime] = useState<Date | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const meditationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // UI State
  const [showGoalsModal, setShowGoalsModal] = useState(false);

  // ----------------------------------------------------------------------
  // Data Fetching
  // ----------------------------------------------------------------------

  const fetchWellnessData = useCallback(async () => {
    if (!user?.user_id) { setLoading(false); return; }
    setError(null);
    try {
      // Parallel Fetch
      const [moodsResult, sessionsResult, goalsResult] = await Promise.allSettled([
        getMoods(user.user_id),
        getMeditationSessions(100),
        getWellnessGoals()
      ]);

      const moods = moodsResult.status === 'fulfilled' ? moodsResult.value : [];
      const sessionData = sessionsResult.status === 'fulfilled' ? sessionsResult.value : { sessions: [] };
      const sessions = sessionData.sessions || [];
      const activeGoals = goalsResult.status === 'fulfilled' ? goalsResult.value : [];

      setUserGoals(activeGoals);

      // Calculate Stats
      let mins = 0;
      let breathing = 0;
      let relax = 0;

      sessions.forEach((s: any) => {
        mins += s.duration || 0;
        if (s.type === 'breathing_exercise') breathing++;
        else relax++;
      });

      // Simple streak logic (can be refined)
      let streak = 0;
      // Simplified streak calculation for brevity
      if (moods.length > 0) streak = 1;

      setWellnessStats({
        meditationMinutes: mins || moods.length * 5, // Fallback if no real data
        breathingExercises: breathing,
        relaxationSessions: relax,
        streakDays: streak
      });

    } catch (err: any) {
      if (err?.response?.status !== 401) {
        setError('Kunde inte ladda wellness-data.');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.user_id]);

  useEffect(() => { fetchWellnessData(); }, [fetchWellnessData]);
  useEffect(() => { return () => { if (meditationTimerRef.current) clearInterval(meditationTimerRef.current); }; }, []);

  // ----------------------------------------------------------------------
  // Timer Logic
  // ----------------------------------------------------------------------

  const startMeditation = (meditation: MeditationOption) => {
    setSelectedMeditation(meditation);
    setIsMeditationActive(true);
    setMeditationTimeLeft(meditation.duration * 60);
    setMeditationStartTime(new Date());
    setIsPaused(false);
    if (meditationTimerRef.current) clearInterval(meditationTimerRef.current);
    meditationTimerRef.current = setInterval(() => {
      setMeditationTimeLeft(prev => {
        if (prev <= 1) { completeMeditation(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const completeMeditation = async () => {
    if (!selectedMeditation || !meditationStartTime || !user?.user_id) return;
    const duration = Math.round((new Date().getTime() - meditationStartTime.getTime()) / 1000 / 60); // mins

    // Save to backend
    try {
      await saveMeditationSession({
        type: selectedMeditation.type,
        duration: duration || 1, // Minimum 1 min
        technique: selectedMeditation.title,
        completedCycles: 1,
        notes: 'Completed session'
      });

      // Optimistic update
      setWellnessStats(prev => ({
        ...prev,
        meditationMinutes: prev.meditationMinutes + duration,
        relaxationSessions: prev.relaxationSessions + 1
      }));
    } catch (e) { console.error(e); }

    stopMeditation();
  };

  const stopMeditation = () => {
    if (meditationTimerRef.current) clearInterval(meditationTimerRef.current);
    setIsMeditationActive(false);
    setSelectedMeditation(null);
    setMeditationTimeLeft(0);
    setIsPaused(false);
  };

  const togglePause = () => {
    if (isPaused) {
      // Resume
      setIsPaused(false);
      meditationTimerRef.current = setInterval(() => {
        setMeditationTimeLeft(prev => {
          if (prev <= 1) { completeMeditation(); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Pause
      if (meditationTimerRef.current) clearInterval(meditationTimerRef.current);
      setIsPaused(true);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };


  // ----------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------

  // Content Data
  const meditations: MeditationOption[] = [
    { id: '1', title: 'Snabb Avkoppling', duration: 5, type: 'guided_meditation', description: 'Perfekt för en paus', icon: <SparklesIcon /> },
    { id: '2', title: 'Djup Sömn', duration: 20, type: 'guided_meditation', description: 'Somna lättare ikväll', icon: <MoonIcon /> },
    { id: '3', title: 'Morgonfokus', duration: 10, type: 'guided_meditation', description: 'Starta dagen rätt', icon: <SunIcon /> },
  ];

  const breathingExercises: MeditationOption[] = [
    { id: 'b1', title: '4-7-8 Andning', duration: 4, type: 'breathing_exercise', description: 'För ångestdämpning', icon: <CloudIcon /> },
    { id: 'b2', title: 'Fyrkantsandning', duration: 5, type: 'breathing_exercise', description: 'För balans och lugn', icon: <StopIcon /> },
  ];

  return (
    <div className="min-h-screen pb-20 bg-[#f8fafc] dark:bg-[#0f172a]">
      {/* 1. Header / Hero Section */}
      <div className="relative bg-white dark:bg-slate-900 pb-12 pt-8 sm:pt-12 px-4 sm:px-6 lg:px-8 shadow-sm rounded-b-[2.5rem]">
        <div className="max-w-7xl mx-auto">
          <header className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white font-display tracking-tight">
                Wellness Library
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">
                Hitta lugnet, ett andetag i taget.
              </p>
            </div>
            <div className="hidden sm:block">
              {/* Streak / Stats Badge */}
              <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-full border border-orange-100 dark:border-orange-800/50">
                <FireIcon className="w-5 h-5" />
                <span className="font-semibold">{wellnessStats.streakDays} dagars streak</span>
              </div>
            </div>
          </header>

          {/* Hero Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 h-auto md:h-[420px]">
            {/* Main Hero Card */}
            <div className="md:col-span-2 lg:col-span-2 h-full">
              <BentoCard
                className="h-full min-h-[300px]"
                title="Dagens Rekommendation"
                subtitle="Börja din morgon med klarhet"
                imageHtml={<OptimizedImage src={WELLNESS_HERO_IMAGE_ID} alt="Wellness" className="w-full h-full object-cover" width={800} height={400} fallbackSrc={WELLNESS_HERO_FALLBACK_SRC} />}
                onClick={() => {
                  const dailyRec = meditations[2];
                  if (dailyRec) startMeditation(dailyRec);
                }}
              >
                <div className="mt-4">
                  <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-white text-xs font-medium border border-white/20">
                    10 min • Morgonfokus
                  </span>
                </div>
              </BentoCard>
            </div>

            {/* Stats & Goals */}
            <div className="flex flex-col gap-6 h-full md:col-span-1 lg:col-span-1">
              <BentoCard
                className="flex-1 bg-gradient-to-br from-teal-50 to-green-50 dark:from-teal-900/20 dark:to-green-900/20"
                title={`${wellnessStats.meditationMinutes}m`}
                subtitle="Mindfulness"
                icon={<HeartIcon />}
                accentColor="bg-teal-500"
              />
              <BentoCard
                className="flex-1 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20"
                title="Sömn & Vila"
                subtitle="Spela sagor"
                icon={<MoonIcon />}
                accentColor="bg-indigo-500"
                onClick={() => setActiveCategory('sleep')}
              />
            </div>

            {/* My Goals Card */}
            <div className="md:col-span-3 lg:col-span-1 h-full">
              <BentoCard
                className="h-full bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 border-sky-100 dark:border-sky-800/30"
                title="Mina Mål"
                subtitle={userGoals.length > 0 ? `${userGoals.length} aktiva mål` : "Sätt dina mål"}
                icon={<PencilSquareIcon />}
                accentColor="bg-sky-500"
                onClick={() => setShowGoalsModal(true)}
              >
                <div className="mt-4 space-y-2">
                  {userGoals.length > 0 ? (
                    userGoals.slice(0, 3).map((goal, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-white/60 dark:bg-slate-800/60 rounded-lg text-sm text-slate-700 dark:text-slate-300 shadow-sm">
                        <span className="text-sky-500">•</span>
                        {goal}
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col gap-2 mt-2">
                      <p className="text-xs text-slate-500">Du har inga aktiva mål än.</p>
                      <Button size="sm" variant="ghost" className="text-sky-600 bg-sky-100 dark:bg-sky-900/30 w-full justify-start">Lägg till mål +</Button>
                    </div>
                  )}
                </div>
              </BentoCard>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Navigation Pills */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 mb-8 overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 pb-2">
          <CategoryPill active={activeCategory === 'all'} label="Utforska allt" icon={<SparklesIcon className="w-4 h-4" />} onClick={() => setActiveCategory('all')} />
          <CategoryPill active={activeCategory === 'meditation'} label="Meditation" icon={<HandRaisedIcon className="w-4 h-4" />} onClick={() => setActiveCategory('meditation')} />
          <CategoryPill active={activeCategory === 'breathing'} label="Andning" icon={<CloudIcon className="w-4 h-4" />} onClick={() => setActiveCategory('breathing')} />
          <CategoryPill active={activeCategory === 'sounds'} label="Ljudlandskap" icon={<MusicalNoteIcon className="w-4 h-4" />} onClick={() => setActiveCategory('sounds')} />
          <CategoryPill active={activeCategory === 'sleep'} label="Sömn" icon={<MoonIcon className="w-4 h-4" />} onClick={() => setActiveCategory('sleep')} />
        </div>
      </div>

      {/* 3. Content Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Active Player Overlay */}
        {isMeditationActive && selectedMeditation && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Spelar nu</h3>
                <button onClick={stopMeditation} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                  <StopIcon className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="flex flex-col items-center mb-8">
                <div className="w-40 h-40 rounded-full bg-gradient-to-tr from-primary-200 to-primary-100 flex items-center justify-center mb-6 relative">
                  <div className={`absolute inset-0 rounded-full border-4 border-primary-100 ${!isPaused ? 'animate-ping' : ''} opacity-20`} />
                  {selectedMeditation.icon ? React.cloneElement(selectedMeditation.icon as React.ReactElement, { className: 'w-16 h-16 text-primary-600' }) : <SparklesIcon className="w-16 h-16 text-primary-600" />}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">{selectedMeditation.title}</h2>
                <p className="text-gray-500 text-center">{selectedMeditation.description}</p>
              </div>

              <div className="text-5xl font-mono text-center font-bold text-primary-600 dark:text-primary-400 mb-8 tracking-wider">
                {formatTime(meditationTimeLeft)}
              </div>

              <div className="flex justify-center gap-6">
                <button
                  onClick={togglePause}
                  className="w-16 h-16 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-lg shadow-primary-500/40 hover:scale-105 transition-transform"
                >
                  {isPaused ? <PlayIcon className="w-8 h-8 ml-1" /> : <PauseIcon className="w-8 h-8" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Goals Modal */}
        {showGoalsModal && (
          <div className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
              <button
                onClick={() => setShowGoalsModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>

              <div className="p-2 sm:p-4">
                <WellnessGoalsOnboarding
                  userId={user?.user_id}
                  initialGoals={userGoals}
                  onComplete={(goals) => {
                    setUserGoals(goals);
                    setShowGoalsModal(false);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Categories Display */}
        {(activeCategory === 'all' || activeCategory === 'meditation') && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Guidade Meditationer</h2>
              <Button variant="ghost" className="text-primary-600">Visa alla</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {meditations.map(m => (
                <div key={m.id} onClick={() => startMeditation(m)} className="group bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700/50 hover:border-primary-200 dark:hover:border-primary-700/50 hover:shadow-lg transition-all cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      {m.icon}
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                      {m.duration} min
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-primary-600 transition-colors">{m.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{m.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {(activeCategory === 'all' || activeCategory === 'breathing') && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Andningsövningar</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {breathingExercises.map(b => (
                <div key={b.id} onClick={() => startMeditation(b)} className="group bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700/50 hover:border-accent-200 dark:hover:border-accent-700/50 hover:shadow-lg transition-all cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-accent-50 dark:bg-accent-900/20 text-accent-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      {b.icon}
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                      {b.duration} min
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-accent-600 transition-colors">{b.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{b.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {(activeCategory === 'all' || activeCategory === 'sounds') && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Avslappnande Ljud</h2>
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-gray-100 dark:border-gray-700/50 shadow-sm">
              <RelaxingSounds onClose={() => { }} embedded />
            </div>
          </section>
        )}
      </div>

    </div>
  );
};

export default WellnessHub;
