import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger';
import { neuroscienceArticleSections, neuroscienceQuiz } from '../constants/recommendations';

interface UseArticleReadingParams {
  userId?: string;
  announce: (message: string, politeness?: 'polite' | 'assertive') => void;
  updateProgress: (type: string, amount?: number) => void;
}

export function useArticleReading({ userId, announce, updateProgress }: UseArticleReadingParams) {
  const { t } = useTranslation();
  const [articleProgress, setArticleProgress] = useState(0);
  const [currentSection, setCurrentSection] = useState(0);
  const [readingTime, setReadingTime] = useState(0);
  const articleReadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [articleCompleted, setArticleCompleted] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  const startArticleReading = useCallback(() => {
    logger.debug('🧠 Starting neuroscience article reading');

    if (articleReadingTimerRef.current) {
      clearInterval(articleReadingTimerRef.current);
    }

    const timer = setInterval(() => {
      setReadingTime(prev => prev + 1);
    }, 1000);
    articleReadingTimerRef.current = timer;

    if (userId) {
      const saved = localStorage.getItem(`article_progress_focus-3_${userId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setArticleProgress(parsed.progress || 0);
          setCurrentSection(parsed.section || 0);
          setReadingTime(parsed.readingTime || 0);
          setArticleCompleted(parsed.completed || false);
          logger.debug('💾 Loaded article progress:', parsed);
        } catch (e) {
          logger.error('Failed to load article progress', e as Error);
        }
      }
    }
  }, [userId]);

  const updateArticleProgress = useCallback((section: number, progress: number) => {
    setCurrentSection(section);
    setArticleProgress(progress);

    if (userId) {
      const progressData = {
        progress,
        section,
        readingTime,
        completed: progress >= 100,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(`article_progress_focus-3_${userId}`, JSON.stringify(progressData));
      logger.debug('💾 Saved article progress:', progressData);
    }
  }, [userId, readingTime]);

  const completeArticle = useCallback(() => {
    logger.debug('✅ Neuroscience article completed');

    setArticleCompleted(true);
    setArticleProgress(100);

    if (articleReadingTimerRef.current) {
      clearInterval(articleReadingTimerRef.current);
      articleReadingTimerRef.current = null;
    }

    const totalWords = neuroscienceArticleSections.reduce((total, section) => {
      const textContent = section.content.replace(/<[^>]*>/g, '');
      return total + textContent.split(/\s+/).filter(word => word.length > 0).length;
    }, 0);

    const wordsPerMinute = readingTime > 0 ? Math.round((totalWords / readingTime) * 60) : 0;
    const readingSpeed = wordsPerMinute > 250 ? 'fast' : wordsPerMinute > 150 ? 'normal' : 'slow';

    logger.debug(`📊 Reading stats: ${totalWords} words in ${readingTime} s = ${wordsPerMinute} WPM (${readingSpeed})`);

    const baseMinutes = 7;
    const speedBonus = readingSpeed === 'fast' ? 2 : readingSpeed === 'normal' ? 1 : 0;
    updateProgress('article', baseMinutes + speedBonus);

    if (userId) {
      const completionData = {
        progress: 100,
        section: 4,
        readingTime,
        wordsPerMinute,
        readingSpeed,
        completed: true,
        completedAt: new Date().toISOString(),
      };
      localStorage.setItem(`article_progress_focus-3_${userId}`, JSON.stringify(completionData));
    }

    announce(t('recommendations.announce.articleCompleted', 'Artikeln om neurovetenskap och fokus är nu slutförd!'), 'polite');
  }, [userId, readingTime, updateProgress, announce, t]);

  const submitQuiz = useCallback(() => {
    let score = 0;

    neuroscienceQuiz.forEach((question, index) => {
      if (quizAnswers[index] === question.correct) {
        score++;
      }
    });

    setQuizScore(score);
    setShowQuiz(false);

    updateProgress('exercise', 5);

    announce(t('recommendations.announce.quizScore', 'Du fick {{score}} av {{total}} rätt på quizet', { score, total: neuroscienceQuiz.length }), 'polite');
  }, [quizAnswers, updateProgress, announce, t]);

  const resetArticleState = useCallback(() => {
    if (articleReadingTimerRef.current) {
      clearInterval(articleReadingTimerRef.current);
      articleReadingTimerRef.current = null;
    }
    setArticleProgress(0);
    setCurrentSection(0);
    setReadingTime(0);
    setArticleCompleted(false);
    setShowQuiz(false);
    setQuizAnswers({});
    setQuizScore(null);
  }, []);

  useEffect(() => {
    return () => {
      if (articleReadingTimerRef.current) {
        clearInterval(articleReadingTimerRef.current);
        articleReadingTimerRef.current = null;
      }
    };
  }, []);

  return {
    articleProgress,
    currentSection,
    readingTime,
    articleCompleted,
    quizAnswers,
    showQuiz,
    quizScore,
    setQuizAnswers,
    setShowQuiz,
    setCurrentSection,
    startArticleReading,
    updateArticleProgress,
    completeArticle,
    submitQuiz,
    resetArticleState,
  };
}
