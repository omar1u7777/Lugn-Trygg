import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Card } from './ui/tailwind';
import OptimizedImage from './ui/OptimizedImage';
import { useTranslation } from 'react-i18next';
import useAuth from '../hooks/useAuth';
import { getMoods, getMemories, saveJournalEntry, getJournalEntries } from '../api/api';
import {
  HeartIcon,
  BookOpenIcon,
  SparklesIcon,
  ChartBarIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { getJournalHeroImageId } from '../config/env';
import { logger } from '../utils/logger';

const JournalList = lazy(() => import('./JournalList'));
const MoodList = lazy(() => import('./MoodList'));
const MemoryRecorder = lazy(() => import('./MemoryRecorder'));
const MemoryList = lazy(() => import('./MemoryList'));

const JOURNAL_HERO_IMAGE_ID = getJournalHeroImageId();
const JOURNAL_HERO_FALLBACK_SRC = 'https://res.cloudinary.com/dxmijbysc/image/upload/c_scale,w_auto,dpr_auto,q_auto,f_auto/hero-bild_pfcdsx.jpg';
const JOURNAL_HERO_SIZES = '(min-width: 1280px) 520px, (min-width: 1024px) 420px, (min-width: 768px) 65vw, 100vw';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`journal-tabpanel-${index}`}
    aria-labelledby={`journal-tab-${index}`}
    className={value === index ? "min-h-[800px]" : ""}
  >
    {value === index && <div>{children}</div>}
  </div>
);

const PanelFallback = ({ label }: { label: string }) => (
  <div className="min-h-[200px] flex items-center justify-center text-sm text-gray-600 dark:text-gray-400">
    <span className="animate-pulse">{label}</span>
  </div>
);

const JournalHub: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState({
    moodCount: 0,
    memoryCount: 0,
    journalCount: 0,
    weekStreak: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [lastJournalEntry, setLastJournalEntry] = useState<{ text: string; prompt: string; tags: string[] } | null>(null);

  // Inline journal form state
  const [journalText, setJournalText] = useState('');
  const [journalPrompt, setJournalPrompt] = useState('');
  const [selectedJournalTags, setSelectedJournalTags] = useState<string[]>([]);
  const [isSubmittingJournal, setIsSubmittingJournal] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  /* Zen Mode State */
  const [zenMode, setZenMode] = useState(false);

  useEffect(() => {
    logger.debug('JournalHub mounted', { userId: user?.user_id, activeTab });
    loadJournalStats();
  }, [user?.user_id]);

  useEffect(() => {
    logger.debug('Tab changed', { activeTab });
  }, [activeTab]);

  /* Keyboard shortcut for Zen Mode (Esc to exit) */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zenMode) {
        setZenMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zenMode]);

  const loadJournalStats = async () => {
    // ... (keep existing implementation)
    logger.debug('Loading journal stats', { userId: user?.user_id });
    if (!user?.user_id) {
      logger.warn('JournalHub - No user ID');
      setStatsLoading(false);
      return;
    }

    setStatsLoading(true);

    try {
      const [moodsResult, memoriesResult, journalsResult] = await Promise.allSettled([
        getMoods(user.user_id),
        getMemories(user.user_id),
        getJournalEntries(),
      ]);

      const moods = moodsResult.status === 'fulfilled' ? moodsResult.value : [];
      const memories = memoriesResult.status === 'fulfilled' ? memoriesResult.value : [];
      const journals = journalsResult.status === 'fulfilled' ? journalsResult.value : [];

      setStats({
        moodCount: moods.length,
        memoryCount: memories.length,
        journalCount: journals.length,
        weekStreak: calculateStreak(moods),
      });
    } catch (error) {
      console.error('❌ Failed to load journal stats:', error);
      setStats({ moodCount: 0, memoryCount: 0, journalCount: 0, weekStreak: 0 });
    } finally {
      setStatsLoading(false);
    }
  };

  const calculateStreak = (moods: any[]) => {
    if (!moods.length) return 0;
    const today = new Date();
    let streak = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const hasLog = moods.some((m: any) =>
        m.timestamp && m.timestamp.startsWith(dateStr)
      );
      if (hasLog) streak++;
      else break;
    }
    return streak;
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleJournalSubmit = async (entry: { text: string; prompt: string; tags: string[] }) => {
    // ... (keep existing implementation)
  };

  const handleInlineJournalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedText = journalText.trim();
    const wordCount = trimmedText.split(/\s+/).filter(Boolean).length;

    if (!trimmedText) {
      setSubmitMessage({ type: 'error', text: 'Dagboksanteckningen kan inte vara tom' });
      setTimeout(() => setSubmitMessage(null), 5000);
      return;
    }

    if (wordCount < 3) {
      setSubmitMessage({ type: 'error', text: 'Dagboksanteckningen måste innehålla minst 3 ord' });
      setTimeout(() => setSubmitMessage(null), 5000);
      return;
    }

    if (!user?.user_id) {
      setSubmitMessage({ type: 'error', text: 'Du måste vara inloggad för att spara' });
      setTimeout(() => setSubmitMessage(null), 5000);
      return;
    }

    setIsSubmittingJournal(true);

    try {
      await saveJournalEntry(journalText, undefined, selectedJournalTags);
      setLastJournalEntry({ text: journalText, prompt: journalPrompt, tags: selectedJournalTags });
      setStats(prev => ({ ...prev, journalCount: prev.journalCount + 1 }));
      setJournalText('');
      setJournalPrompt('');
      setSelectedJournalTags([]);
      await loadJournalStats();
      setSubmitMessage({ type: 'success', text: 'Dagboksanteckning sparad framgångsrikt! 🎉' });
      setTimeout(() => setSubmitMessage(null), 5000);
      if (zenMode) setZenMode(false); // Exit Zen mode on submit
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ett fel uppstod';
      setSubmitMessage({ type: 'error', text: `Kunde inte spara: ${errorMessage}` });
      setTimeout(() => setSubmitMessage(null), 8000);
    } finally {
      setIsSubmittingJournal(false);
    }
  };

  const toggleJournalTag = (tag: string) => {
    setSelectedJournalTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className={`transition-all duration-500 ${zenMode ? 'fixed inset-0 z-50 bg-stone-50 dark:bg-stone-900 overflow-y-auto' : 'p-4 sm:p-6 md:p-8 max-w-7xl mx-auto'}`}>

      {/* Zen Mode Header */}
      {zenMode && (
        <div className="sticky top-0 z-40 flex items-center justify-between p-6 bg-stone-50/90 dark:bg-stone-900/90 backdrop-blur-md border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-stone-200 dark:bg-stone-800 rounded-full">
              <span role="img" aria-label="Zen" className="text-xl">🧘</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-800 dark:text-stone-200">Zen Mode</h2>
              <p className="text-xs text-stone-500">Fokusera på dina tankar</p>
            </div>
          </div>
          <button
            onClick={() => setZenMode(false)}
            className="px-4 py-2 text-sm font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-lg transition-colors"
          >
            Avsluta (Esc)
          </button>
        </div>
      )}

      {/* Hero Section (Hidden in Zen Mode) */}
      {!zenMode && (
        <section className="mb-8">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-50 to-stone-100 dark:from-slate-900 dark:to-stone-900 border border-white/50 dark:border-white/5 shadow-2xl p-8 sm:p-12">
            <div className="relative z-10 flex flex-col lg:flex-row items-center gap-10">
              <div className="flex-1 text-center lg:text-left space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/40 dark:bg-white/5 backdrop-blur-md border border-indigo-100 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium text-sm">
                  <SparklesIcon className="w-4 h-4" />
                  <span>Din personliga fristad</span>
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-800 dark:text-white">
                  Digital <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">Dagbok</span>
                </h1>

                <p className="text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  Fånga dina tankar, känslor och minnen i en miljö designad för reflektion och lugn.
                </p>

                <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                  <button
                    onClick={() => { setActiveTab(0); setZenMode(true); }}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                  >
                    <BookOpenIcon className="w-5 h-5" />
                    Skriv i Zen Mode
                  </button>
                  <button
                    onClick={() => setActiveTab(1)}
                    className="px-6 py-3 bg-white dark:bg-white/10 text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-white/20 transition-all"
                  >
                    Visa Historik
                  </button>
                </div>
              </div>

              <div className="w-full max-w-md lg:w-1/2 relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 blur-3xl rounded-full animate-pulse-slow" />
                <div className="relative transform rotate-3 hover:rotate-0 transition-transform duration-700">
                  <OptimizedImage
                    src={JOURNAL_HERO_IMAGE_ID}
                    alt="Digital Journaling"
                    width={520}
                    height={420}
                    className="rounded-3xl shadow-2xl border-4 border-white/50 dark:border-white/10 backdrop-blur-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Stats Bento Grid (Hidden in Zen Mode) */}
      {!zenMode && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          {[
            { label: 'Dagboksanteckningar', value: stats.journalCount, icon: BookOpenIcon, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
            { label: 'Humörloggar', value: stats.moodCount, icon: HeartIcon, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
            { label: 'Sparade Minnen', value: stats.memoryCount, icon: SparklesIcon, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            { label: 'Dagar i rad', value: stats.weekStreak, icon: ChartBarIcon, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          ].map((stat, idx) => (
            <div key={idx} className="group bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                {idx === 3 && <span className="text-lg">🔥</span>}
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {statsLoading ? '-' : stat.value}
                </p>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      <div className={`bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 ${zenMode ? 'shadow-none border-none rounded-none bg-stone-50 dark:bg-stone-900 min-h-screen' : ''}`}>
        {!zenMode && (
          <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            <nav className="flex p-2 gap-2 min-w-max">
              {[
                { label: 'Skriv', icon: BookOpenIcon },
                { label: 'Historik', icon: DocumentTextIcon },
                { label: 'Humör', icon: HeartIcon },
                { label: 'Spara Minne', icon: SparklesIcon },
                { label: 'Galleri', icon: ChartBarIcon },
              ].map((tab, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveTab(idx)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === idx
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        )}

        <div className={`${zenMode ? 'max-w-3xl mx-auto pt-10 px-6 pb-20' : 'p-6 sm:p-8'}`}>
          <TabPanel value={activeTab} index={0}>
            <div className={`${!zenMode ? 'max-w-4xl mx-auto' : ''}`}>
              <div className="mb-8 text-center space-y-2">
                <h2 className="text-2xl sm:text-3xl font-serif italic text-slate-800 dark:text-stone-200">
                  {zenMode ? 'Låt tankarna flöda...' : 'Skriv en dagboksanteckning'}
                </h2>
                {!zenMode && <p className="text-slate-500">Dela dina tankar, känslor och upplevelser</p>}
              </div>

              {/* Prompts */}
              <div className="mb-8">
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    'Vad gjorde dig glad idag?',
                    'Vad är du tacksam för just nu?',
                    'Vilka känslor kände du mest idag?',
                    'Vad ser du fram emot?'
                  ].map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => setJournalPrompt(prompt)}
                      className="px-4 py-2 rounded-full text-sm bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors border border-indigo-100 dark:border-indigo-800"
                    >
                      ✨ {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Journal Form */}
              <form onSubmit={handleInlineJournalSubmit} className="space-y-6">
                {journalPrompt && (
                  <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800 flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <div>
                      <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Vald Prompt</p>
                      <p className="text-indigo-800 dark:text-indigo-300">{journalPrompt}</p>
                    </div>
                    <button type="button" onClick={() => setJournalPrompt('')} className="ml-auto text-indigo-400 hover:text-indigo-600">✕</button>
                  </div>
                )}

                <div className="relative">
                  <textarea
                    rows={zenMode ? 20 : 12}
                    className={`w-full p-6 text-lg leading-relaxed rounded-2xl border transition-all focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none resize-none ${zenMode
                      ? 'bg-transparent border-none shadow-none text-stone-800 dark:text-stone-300 placeholder-stone-400 font-serif'
                      : 'bg-stone-50 dark:bg-slate-900 border-stone-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-inner'
                      }`}
                    placeholder="Börja skriva här..."
                    value={journalText}
                    onChange={(e) => setJournalText(e.target.value)}
                    autoFocus={zenMode}
                  />
                  {!zenMode && <div className="absolute bottom-4 right-4 text-xs text-slate-400 font-medium bg-white/50 px-2 py-1 rounded-md backdrop-blur-sm">
                    {journalText.trim().split(/\s+/).filter(Boolean).length} ord
                  </div>}
                </div>

                {/* Emotion Tags */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {['Glad', 'Ledsen', 'Stressad', 'Tacksam', 'Energisk', 'Hoppfull', 'Lugn'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleJournalTag(tag)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedJournalTags.includes(tag)
                        ? 'bg-slate-800 text-white shadow-lg scale-105'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                <div className="flex justify-center pt-4 pb-20 sm:pb-0">
                  <button
                    type="submit"
                    disabled={!journalText.trim() || isSubmittingJournal}
                    className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/30 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
                  >
                    {isSubmittingJournal ? <span className="animate-spin">⏳</span> : <BookOpenIcon className="w-6 h-6" />}
                    {isSubmittingJournal ? 'Sparar...' : 'Spara i Dagboken'}
                  </button>
                </div>

                {submitMessage && (
                  <div className={`mt-4 p-4 rounded-xl text-center font-medium animate-fade-in ${submitMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {submitMessage.text}
                  </div>
                )}

              </form>
            </div>
          </TabPanel>

          {/* Other Tabs (Keep existing imports but wrapped) */}
          <TabPanel value={activeTab} index={1}>
            <Suspense fallback={<div className="h-64 flex items-center justify-center"><div className="animate-spin text-3xl">⏳</div></div>}>
              <JournalList refreshTrigger={stats.journalCount} />
            </Suspense>
          </TabPanel>
          <TabPanel value={activeTab} index={2}>
            <Suspense fallback={<div className="h-64 flex items-center justify-center"><div className="animate-spin text-3xl">⏳</div></div>}>
              <MoodList onClose={() => { }} inline={true} />
            </Suspense>
          </TabPanel>
          <TabPanel value={activeTab} index={3}>
            <Suspense fallback={<div className="h-64 flex items-center justify-center"><div className="animate-spin text-3xl">⏳</div></div>}>
              <MemoryRecorder userId={user?.user_id || ''} onClose={() => { }} inline={true} />
            </Suspense>
          </TabPanel>
          <TabPanel value={activeTab} index={4}>
            <Suspense fallback={<div className="h-64 flex items-center justify-center"><div className="animate-spin text-3xl">⏳</div></div>}>
              <MemoryList onClose={() => { }} inline={true} />
            </Suspense>
          </TabPanel>
        </div>
      </div>
    </div>
  );
};

export default JournalHub;

