import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

interface ChatMetrics {
  totalMessages: number;
  userMessages: number;
  aiMessages: number;
  averageResponseTime: number;
  sessionDuration: number;
  sentimentDistribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
  topicFrequency: Record<string, number>;
  emotionalJourney: Array<{
    timestamp: Date;
    sentiment: string;
    emotion?: string;
  }>;
  engagementScore: number;
  breakthroughs: number;
}

interface ConversationPattern {
  timeOfDay: number[];
  messageLength: {
    average: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  responseStyle: 'brief' | 'detailed' | 'mixed';
  preferredTopics: string[];
}

export const useChatAnalytics = (userId: string) => {
  const [metrics, setMetrics] = useState<ChatMetrics | null>(null);
  const [patterns, setPatterns] = useState<ConversationPattern | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load analytics data
  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      // In real app, fetch from analytics service
      const cached = localStorage.getItem(`chat-analytics-${userId}`);
      if (cached) {
        const data = JSON.parse(cached);
        setMetrics(data.metrics);
        setPatterns(data.patterns);
      }
    } catch (error) {
      logger.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Track message event
  const trackMessage = useCallback((
    message: string,
    role: 'user' | 'assistant',
    metadata?: {
      sentiment?: string;
      emotions?: string[];
      responseTime?: number;
      topics?: string[];
    }
  ) => {
    if (!metrics) return;

    const newMetrics = { ...metrics };
    
    // Update counts
    newMetrics.totalMessages++;
    if (role === 'user') {
      newMetrics.userMessages++;
    } else {
      newMetrics.aiMessages++;
      
      // Track response time
      if (metadata?.responseTime) {
        const total = newMetrics.averageResponseTime * (newMetrics.aiMessages - 1) + metadata.responseTime;
        newMetrics.averageResponseTime = total / newMetrics.aiMessages;
      }
    }
    
    // Update sentiment distribution
    if (metadata?.sentiment) {
      if (metadata.sentiment === 'POSITIVE') newMetrics.sentimentDistribution.positive++;
      else if (metadata.sentiment === 'NEGATIVE') newMetrics.sentimentDistribution.negative++;
      else newMetrics.sentimentDistribution.neutral++;
    }
    
    // Update topic frequency
    if (metadata?.topics) {
      metadata.topics.forEach(topic => {
        newMetrics.topicFrequency[topic] = (newMetrics.topicFrequency[topic] || 0) + 1;
      });
    }
    
    // Track emotional journey
    if (role === 'assistant' && metadata?.sentiment) {
      newMetrics.emotionalJourney.push({
        timestamp: new Date(),
        sentiment: metadata.sentiment,
        emotion: metadata.emotions?.[0]
      });
      
      // Detect breakthroughs (significant positive shifts)
      const journey = newMetrics.emotionalJourney;
      if (journey.length > 2) {
        const prev = journey[journey.length - 2];
        const curr = journey[journey.length - 1];
        
        if (prev.sentiment === 'NEGATIVE' && curr.sentiment === 'POSITIVE') {
          newMetrics.breakthroughs++;
        }
      }
    }
    
    // Calculate engagement score
    newMetrics.engagementScore = calculateEngagementScore(newMetrics);
    
    setMetrics(newMetrics);
    
    // Save to localStorage
    try {
      localStorage.setItem(`chat-analytics-${userId}`, JSON.stringify({
        metrics: newMetrics,
        patterns,
        lastUpdated: new Date().toISOString()
      }));
    } catch (error) {
      logger.error('Failed to save analytics:', error);
    }
  }, [metrics, patterns, userId]);

  // Calculate engagement score
  const calculateEngagementScore = (metrics: ChatMetrics): number => {
    let score = 0;
    
    // Message frequency (0-30 points)
    const messageScore = Math.min(30, metrics.totalMessages * 0.5);
    score += messageScore;
    
    // Conversation depth (0-25 points)
    const avgLength = metrics.totalMessages > 0 ? 
      metrics.emotionalJourney.length / metrics.totalMessages * 100 : 0;
    score += Math.min(25, avgLength);
    
    // Emotional engagement (0-25 points)
    const emotionalRatio = metrics.emotionalJourney.length / metrics.aiMessages;
    score += emotionalRatio * 25;
    
    // Consistency (0-20 points)
    const consistency = metrics.sessionDuration > 0 ? 
      Math.min(20, metrics.sessionDuration / 60) : 0;
    score += consistency;
    
    return Math.round(score);
  };

  // Analyze conversation patterns
  const analyzePatterns = useCallback((messages: Array<{
    timestamp: Date;
    role: 'user' | 'assistant';
    content: string;
  }>) => {
    if (messages.length === 0) return;

    const timeOfDay: number[] = [];
    const messageLengths: number[] = [];
    const topics: Record<string, number> = {};

    messages.forEach(msg => {
      if (msg.role === 'user') {
        // Time of day pattern
        const hour = msg.timestamp.getHours();
        timeOfDay.push(hour);
        
        // Message length
        messageLengths.push(msg.content.length);
        
        // Simple topic extraction
        const content = msg.content.toLowerCase();
        if (content.includes('stress') || content.includes('ångest')) topics['stress'] = (topics['stress'] || 0) + 1;
        if (content.includes('sömn') || content.includes('sömnproblem')) topics['sleep'] = (topics['sleep'] || 0) + 1;
        if (content.includes('arbete') || content.includes('jobb')) topics['work'] = (topics['work'] || 0) + 1;
      }
    });

    // Calculate trends
    const avgLength = messageLengths.reduce((a, b) => a + b, 0) / messageLengths.length;
    const recentAvg = messageLengths.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, messageLengths.length);
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (recentAvg > avgLength * 1.2) trend = 'increasing';
    else if (recentAvg < avgLength * 0.8) trend = 'decreasing';

    // Determine response style
    let responseStyle: 'brief' | 'detailed' | 'mixed' = 'mixed';
    if (avgLength < 50) responseStyle = 'brief';
    else if (avgLength > 150) responseStyle = 'detailed';

    // Sort topics by frequency
    const preferredTopics = Object.entries(topics)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([topic]) => topic);

    const newPatterns: ConversationPattern = {
      timeOfDay,
      messageLength: {
        average: avgLength,
        trend
      },
      responseStyle,
      preferredTopics
    };

    setPatterns(newPatterns);
  }, []);

  // Get insights and recommendations
  const getInsights = useCallback(() => {
    if (!metrics || !patterns) return [];

    const insights = [];

    // Engagement insights
    if (metrics.engagementScore > 80) {
      insights.push({
        type: 'positive',
        title: 'Hög engagemang',
        description: 'Du är mycket aktiv i dina samtal. Fortsätt så!'
      });
    } else if (metrics.engagementScore < 40) {
      insights.push({
        type: 'suggestion',
        title: 'Öka engagemang',
        description: 'Försök att ställa fler frågor och utforska ämnen djupare.'
      });
    }

    // Emotional insights
    if (metrics.breakthroughs > 0) {
      insights.push({
        type: 'achievement',
        title: 'Emotionella genombrott',
        description: `Du har haft ${metrics.breakthroughs} positiva vändningar i samtalet.`
      });
    }

    // Pattern insights
    if (patterns.preferredTopics.length > 0) {
      insights.push({
        type: 'pattern',
        title: 'Vanliga ämnen',
        description: `Du pratar oftast om: ${patterns.preferredTopics.join(', ')}`
      });
    }

    // Time-based insights
    const peakHour = getMostFrequent(patterns.timeOfDay);
    if (peakHour !== undefined) {
      const timeStr = peakHour < 12 ? 'förmiddag' : peakHour < 17 ? 'eftermiddag' : 'kväll';
      insights.push({
        type: 'pattern',
        title: 'Vanligaste tid',
        description: `Du chattar oftast på ${timeStr}en.`
      });
    }

    return insights;
  }, [metrics, patterns]);

  // Helper to get most frequent value
  const getMostFrequent = (arr: number[]): number | undefined => {
    if (arr.length === 0) return undefined;
    
    const frequency: Record<number, number> = {};
    arr.forEach(val => {
      frequency[val] = (frequency[val] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)[0][0] as number;
  };

  // Export analytics data
  const exportData = useCallback(() => {
    if (!metrics || !patterns) return null;

    return {
      userId,
      exportDate: new Date().toISOString(),
      metrics,
      patterns,
      insights: getInsights()
    };
  }, [metrics, patterns, getInsights, userId]);

  // Reset analytics
  const resetAnalytics = useCallback(() => {
    const defaultMetrics: ChatMetrics = {
      totalMessages: 0,
      userMessages: 0,
      aiMessages: 0,
      averageResponseTime: 0,
      sessionDuration: 0,
      sentimentDistribution: {
        positive: 0,
        negative: 0,
        neutral: 0
      },
      topicFrequency: {},
      emotionalJourney: [],
      engagementScore: 0,
      breakthroughs: 0
    };

    setMetrics(defaultMetrics);
    setPatterns(null);
    
    localStorage.removeItem(`chat-analytics-${userId}`);
    logger.info('Analytics reset for user:', userId);
  }, [userId]);

  return {
    metrics,
    patterns,
    isLoading,
    loadAnalytics,
    trackMessage,
    analyzePatterns,
    getInsights,
    exportData,
    resetAnalytics
  };
};

export default useChatAnalytics;
