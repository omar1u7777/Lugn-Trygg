/**
 * Predictive Analytics Service for Lugn & Trygg Frontend
 * Handles mood prediction, trend analysis, and crisis detection
 */

import axios from 'axios';
import { API_BASE_URL } from '../api/api';

export interface MoodPrediction {
  date: string;
  predicted_score: number;
  mood_category: string;
  confidence: number;
}

export interface CrisisRiskAssessment {
  risk_level: 'low' | 'medium' | 'high' | 'unknown';
  confidence: number;
  indicators: string[];
  recommendations: string[];
  trend_score: number;
  analyzed_entries: number;
}

export interface PersonalInsight {
  insights: string[];
  recommendations: string[];
  data_points: number;
  analysis_period: string;
}

export interface TrendAnalysis {
  period: string;
  average_mood: number;
  trend_direction: 'improving' | 'stable' | 'declining';
  volatility: number;
  patterns: string[];
  recommendations: string[];
}

export interface ModelTrainingResult {
  success: boolean;
  model_path?: string;
  performance?: {
    mse: number;
    r2_score: number;
    training_samples: number;
    test_samples: number;
  };
  features_used?: string[];
  error?: string;
}

class PredictiveAnalyticsService {
  /**
   * Train predictive model for user's mood data
   */
  async trainModel(): Promise<ModelTrainingResult> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/predictive/train`);
      return response.data.data;
    } catch (error: any) {
      console.error('Error training predictive model:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to train model'
      };
    }
  }

  /**
   * Get mood predictions for upcoming days
   */
  async getPredictions(daysAhead: number = 7): Promise<{
    success: boolean;
    predictions: MoodPrediction[];
    model_info?: any;
    error?: string;
  }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/predictive/predict`, {
        params: { days: daysAhead }
      });
      return response.data.data;
    } catch (error: any) {
      console.error('Error getting predictions:', error);
      return {
        success: false,
        predictions: [],
        error: error.response?.data?.message || 'Failed to get predictions'
      };
    }
  }

  /**
   * Check for potential crisis situations
   */
  async checkCrisisRisk(): Promise<{
    success: boolean;
    data: CrisisRiskAssessment;
    error?: string;
  }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/predictive/crisis-check`);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      console.error('Error checking crisis risk:', error);
      return {
        success: false,
        data: {
          risk_level: 'unknown',
          confidence: 0,
          indicators: [],
          recommendations: ['Kontakta support om du mår dåligt'],
          trend_score: 3,
          analyzed_entries: 0
        },
        error: error.response?.data?.message || 'Failed to check crisis risk'
      };
    }
  }

  /**
   * Get personalized insights based on mood patterns
   */
  async getPersonalInsights(): Promise<{
    success: boolean;
    data: PersonalInsight;
    error?: string;
  }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/predictive/insights`);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      console.error('Error getting personal insights:', error);
      return {
        success: false,
        data: {
          insights: [],
          recommendations: ['Logga fler humörinlägg för personliga insikter'],
          data_points: 0,
          analysis_period: 'unknown'
        },
        error: error.response?.data?.message || 'Failed to get insights'
      };
    }
  }

  /**
   * Get detailed mood trend analysis
   */
  async getTrendAnalysis(period: '7d' | '30d' | '90d' | '1y' = '30d'): Promise<{
    success: boolean;
    data: TrendAnalysis;
    error?: string;
  }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/predictive/trends`, {
        params: { period }
      });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      console.error('Error getting trend analysis:', error);
      return {
        success: false,
        data: {
          period,
          average_mood: 3,
          trend_direction: 'stable',
          volatility: 0,
          patterns: [],
          recommendations: ['Behöver mer data för trendanalys']
        },
        error: error.response?.data?.message || 'Failed to get trend analysis'
      };
    }
  }

  /**
   * Format mood category for display
   */
  formatMoodCategory(category: string): string {
    const translations: { [key: string]: string } = {
      'excellent': 'Utmärkt',
      'very_good': 'Mycket bra',
      'good': 'Bra',
      'neutral': 'Neutral',
      'okay': 'Okej',
      'bad': 'Dålig',
      'very_bad': 'Mycket dålig',
      'terrible': 'Förfärlig',
      'happy': 'Glad',
      'sad': 'Ledsen',
      'angry': 'Arg',
      'stressed': 'Stressad',
      'tired': 'Trött',
      'excited': 'Upphetsad',
      'calm': 'Lugn',
      'joy': 'Glädje',
      'sadness': 'Ledsenhet',
      'anger': 'Ilska',
      'fear': 'Rädsla',
      'surprise': 'Förvåning',
      'disgust': 'Avsky',
      'trust': 'Förtroende',
      'anticipation': 'Förväntan'
    };

    return translations[category.toLowerCase()] || category;
  }

  /**
   * Get color for mood category
   */
  getMoodColor(category: string): string {
    const colorMap: { [key: string]: string } = {
      'excellent': '#10b981', // green-500
      'very_good': '#34d399', // green-400
      'good': '#6ee7b7', // green-300
      'neutral': '#9ca3af', // gray-400
      'okay': '#d1d5db', // gray-300
      'bad': '#f59e0b', // amber-500
      'very_bad': '#ef4444', // red-500
      'terrible': '#dc2626', // red-600
      'happy': '#10b981',
      'sad': '#6b7280',
      'angry': '#ef4444',
      'stressed': '#f59e0b',
      'tired': '#9ca3af',
      'excited': '#8b5cf6',
      'calm': '#06b6d4',
      'joy': '#10b981',
      'sadness': '#6b7280',
      'anger': '#ef4444',
      'fear': '#7c3aed',
      'surprise': '#f59e0b',
      'disgust': '#84cc16',
      'trust': '#10b981',
      'anticipation': '#8b5cf6'
    };

    return colorMap[category.toLowerCase()] || '#9ca3af';
  }

  /**
   * Get risk level color
   */
  getRiskColor(riskLevel: string): string {
    switch (riskLevel) {
      case 'high':
        return '#dc2626'; // red-600
      case 'medium':
        return '#f59e0b'; // amber-500
      case 'low':
        return '#10b981'; // green-500
      default:
        return '#9ca3af'; // gray-400
    }
  }

  /**
   * Format confidence percentage
   */
  formatConfidence(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
  }

  /**
   * Check if user needs immediate attention based on risk assessment
   */
  needsImmediateAttention(riskAssessment: CrisisRiskAssessment): boolean {
    return riskAssessment.risk_level === 'high' && riskAssessment.confidence > 0.7;
  }

  /**
   * Get emergency contact information
   */
  getEmergencyContacts(): {
    sweden: { name: string; number: string; description: string }[];
    norway: { name: string; number: string; description: string }[];
  } {
    return {
      sweden: [
        {
          name: 'Självmordslinjen',
          number: '90101',
          description: 'Dygnet runt stöd för självmordstankar'
        },
        {
          name: 'BRIS - Barn',
          number: '116111',
          description: 'Stöd för barn och unga'
        },
        {
          name: 'Vuxentelefonen',
          number: '020-222424',
          description: 'Stöd för vuxna med psykiska problem'
        },
        {
          name: 'Akut psykiatri',
          number: '112',
          description: 'Vid akut fara för liv eller hälsa'
        }
      ],
      norway: [
        {
          name: 'Mental Helse Hjelpetelefonen',
          number: '116123',
          description: 'Stöd för psykiska problem'
        },
        {
          name: 'Kirkens SOS',
          number: '22400040',
          description: 'Krisstöd dygnet runt'
        },
        {
          name: 'Akutt hjelp',
          number: '113',
          description: 'Vid akut fara för liv eller hälsa'
        }
      ]
    };
  }
}

// Export singleton instance
export const predictiveService = new PredictiveAnalyticsService();
export default predictiveService;