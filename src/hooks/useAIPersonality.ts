import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

interface PersonalityProfile {
  name: string;
  traits: {
    empathy: number; // 0-1
    formality: number; // 0-1
    humor: number; // 0-1
    directness: number; // 0-1
    encouragement: number; // 0-1
  };
  responseStyle: 'gentle' | 'direct' | 'encouraging' | 'analytical';
  preferredTopics: string[];
  avoidedTopics: string[];
}

interface MessageAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  topics: string[];
  emotionalState: 'calm' | 'stressed' | 'excited' | 'sad' | 'anxious';
  communicationStyle: 'brief' | 'detailed' | 'questioning' | 'declarative';
}

const DEFAULT_PERSONALITIES: Record<string, PersonalityProfile> = {
  gentle_coach: {
    name: 'Gentle Coach',
    traits: {
      empathy: 0.9,
      formality: 0.3,
      humor: 0.2,
      directness: 0.4,
      encouragement: 0.8
    },
    responseStyle: 'gentle',
    preferredTopics: ['wellness', 'mindfulness', 'self-care'],
    avoidedTopics: ['trauma', 'crisis']
  },
  analytical_guide: {
    name: 'Analytical Guide',
    traits: {
      empathy: 0.6,
      formality: 0.6,
      humor: 0.3,
      directness: 0.8,
      encouragement: 0.5
    },
    responseStyle: 'analytical',
    preferredTopics: ['patterns', 'strategies', 'solutions'],
    avoidedTopics: []
  },
  supportive_friend: {
    name: 'Supportive Friend',
    traits: {
      empathy: 0.8,
      formality: 0.1,
      humor: 0.6,
      directness: 0.5,
      encouragement: 0.9
    },
    responseStyle: 'encouraging',
    preferredTopics: ['daily_life', 'relationships', 'achievements'],
    avoidedTopics: []
  }
};

export const useAIPersonality = (userId: string) => {
  const [currentPersonality, setCurrentPersonality] = useState<PersonalityProfile>(DEFAULT_PERSONALITIES.gentle_coach);
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [adaptationHistory, setAdaptationHistory] = useState<Array<{
    timestamp: Date;
    from: string;
    to: string;
    reason: string;
  }>>([]);

  // Load user's personality preference
  useEffect(() => {
    const loadPersonality = () => {
      try {
        const saved = localStorage.getItem(`ai-personality-${userId}`);
        if (saved) {
          const pref = JSON.parse(saved);
          setUserPreferences(pref);
          
          // Apply saved personality or default
          if (pref.personalityType && DEFAULT_PERSONALITIES[pref.personalityType]) {
            setCurrentPersonality(DEFAULT_PERSONALITIES[pref.personalityType]);
          }
        }
      } catch (error) {
        logger.error('Failed to load personality preference:', error);
      }
    };

    loadPersonality();
  }, [userId]);

  // Analyze message to understand user preferences
  const analyzeMessage = useCallback((message: string, messageHistory: any[] = []): MessageAnalysis => {
    // Simple sentiment analysis (in real app, use NLP service)
    const positiveWords = ['glad', 'happy', 'bra', 'rolig', 'fantastisk'];
    const negativeWords = ['sad', 'ledsen', 'orolig', 'stressad', 'dålig'];
    const questionWords = ['?', 'hur', 'varför', 'när', 'vad'];
    
    const lowerMessage = message.toLowerCase();
    
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (positiveWords.some(word => lowerMessage.includes(word))) sentiment = 'positive';
    else if (negativeWords.some(word => lowerMessage.includes(word))) sentiment = 'negative';
    
    // Detect communication style
    let communicationStyle: 'brief' | 'detailed' | 'questioning' | 'declarative' = 'declarative';
    if (questionWords.some(word => lowerMessage.includes(word))) communicationStyle = 'questioning';
    else if (message.length < 50) communicationStyle = 'brief';
    else if (message.length > 200) communicationStyle = 'detailed';
    
    // Detect emotional state (simplified)
    let emotionalState: 'calm' | 'stressed' | 'excited' | 'sad' | 'anxious' = 'calm';
    if (lowerMessage.includes('stress')) emotionalState = 'stressed';
    else if (lowerMessage.includes('ledsen')) emotionalState = 'sad';
    else if (lowerMessage.includes('orolig')) emotionalState = 'anxious';
    else if (lowerMessage.includes('exalterad' || 'jätteglad')) emotionalState = 'excited';
    
    // Extract topics (simplified)
    const topics = [];
    if (lowerMessage.includes('sömn') || lowerMessage.includes('sova')) topics.push('sleep');
    if (lowerMessage.includes('arbete') || lowerMessage.includes('jobba')) topics.push('work');
    if (lowerMessage.includes('relation') || lowerMessage.includes('vän')) topics.push('relationships');
    
    return {
      sentiment,
      topics,
      emotionalState,
      communicationStyle
    };
  }, []);

  // Adapt personality based on user interaction
  const adaptPersonality = useCallback((
    analysis: MessageAnalysis,
    userFeedback?: 'positive' | 'negative'
  ) => {
    let newPersonality = { ...currentPersonality };
    let adaptationReason = '';
    
    // Adapt based on emotional state
    if (analysis.emotionalState === 'stressed' || analysis.emotionalState === 'anxious') {
      if (currentPersonality.name !== 'gentle_coach') {
        newPersonality = DEFAULT_PERSONALITIES.gentle_coach;
        adaptationReason = 'User appears stressed - switching to gentle approach';
      }
    } else if (analysis.communicationStyle === 'direct' && analysis.emotionalState === 'calm') {
      if (currentPersonality.name !== 'analytical_guide') {
        newPersonality = DEFAULT_PERSONALITIES.analytical_guide;
        adaptationReason = 'User prefers direct communication - switching to analytical approach';
      }
    } else if (analysis.sentiment === 'positive' && analysis.emotionalState === 'excited') {
      if (currentPersonality.name !== 'supportive_friend') {
        newPersonality = DEFAULT_PERSONALITIES.supportive_friend;
        adaptationReason = 'User is excited - switching to friendly approach';
      }
    }
    
    // Fine-tune traits based on feedback
    if (userFeedback === 'positive') {
      // Reinforce current traits slightly
      newPersonality.traits = {
        ...newPersonality.traits,
        empathy: Math.min(1, newPersonality.traits.empathy + 0.05),
        encouragement: Math.min(1, newPersonality.traits.encouragement + 0.05)
      };
    } else if (userFeedback === 'negative') {
      // Adjust traits
      if (newPersonality.traits.directness > 0.5) {
        newPersonality.traits.directness -= 0.1;
        newPersonality.traits.empathy += 0.1;
        adaptationReason = 'User feedback negative - becoming less direct, more empathetic';
      }
    }
    
    // Apply changes if different
    if (newPersonality.name !== currentPersonality.name) {
      setCurrentPersonality(newPersonality);
      
      const adaptation = {
        timestamp: new Date(),
        from: currentPersonality.name,
        to: newPersonality.name,
        reason: adaptationReason
      };
      
      setAdaptationHistory(prev => [...prev.slice(-9), adaptation]);
      
      // Save to localStorage
      try {
        localStorage.setItem(`ai-personality-${userId}`, JSON.stringify({
          personalityType: newPersonality.name,
          traits: newPersonality.traits,
          lastAdapted: new Date().toISOString()
        }));
      } catch (error) {
        logger.error('Failed to save personality preference:', error);
      }
      
      logger.info('AI Personality adapted:', adaptation);
    }
    
    return newPersonality;
  }, [currentPersonality, userId]);

  // Get personality-aware response prefix
  const getResponsePrefix = useCallback((analysis: MessageAnalysis) => {
    const { traits, responseStyle } = currentPersonality;
    
    switch (responseStyle) {
      case 'gentle':
        if (analysis.emotionalState === 'stressed') {
          return 'Ta ett djupt andetag. ';
        } else if (analysis.emotionalState === 'sad') {
          return 'Jag är här för dig. ';
        }
        return 'Jag hör dig. ';
        
      case 'analytical':
        if (analysis.topics.length > 0) {
          return `Låt oss analysera ${analysis.topics[0]}. `;
        }
        return 'Låt oss bryta ner detta. ';
        
      case 'encouraging':
        return 'Du klarar detta! ';
        
      case 'direct':
        return 'Här är vad jag tänker: ';
        
      default:
        return '';
    }
  }, [currentPersonality]);

  // Get personality-adjusted temperature for AI
  const getAITemperature = useCallback(() => {
    const { traits } = currentPersonality;
    
    // Higher temperature = more creative
    // Lower temperature = more focused
    
    let temperature = 0.7; // Default
    
    if (traits.humor > 0.5) temperature += 0.1;
    if (traits.empathy > 0.7) temperature += 0.1;
    if (traits.directness > 0.7) temperature -= 0.1;
    if (traits.formality > 0.5) temperature -= 0.1;
    
    return Math.min(1, Math.max(0, temperature));
  }, [currentPersonality]);

  // Manual personality selection
  const selectPersonality = useCallback((type: keyof typeof DEFAULT_PERSONALITIES) => {
    const personality = DEFAULT_PERSONALITIES[type];
    setCurrentPersonality(personality);
    
    // Save selection
    try {
      localStorage.setItem(`ai-personality-${userId}`, JSON.stringify({
        personalityType: type,
        traits: personality.traits,
        manuallySelected: true,
        selectedAt: new Date().toISOString()
      }));
    } catch (error) {
      logger.error('Failed to save personality selection:', error);
    }
    
    logger.info('AI Personality manually selected:', type);
  }, [userId]);

  return {
    currentPersonality,
    adaptationHistory,
    analyzeMessage,
    adaptPersonality,
    getResponsePrefix,
    getAITemperature,
    selectPersonality,
    availablePersonalities: DEFAULT_PERSONALITIES
  };
};

export default useAIPersonality;
