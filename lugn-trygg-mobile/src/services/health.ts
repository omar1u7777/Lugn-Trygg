import { apiService } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HealthData, AnalysisResult, MoodEntry } from '../types';

class HealthService {
  private cache = new Map<string, any>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  // ============ HEALTH DATA ============

  async getHealthData(date: 'today' | 'week' | 'month' = 'today'): Promise<HealthData> {
    const cacheKey = `health_${date}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }
    }

    try {
      const data = await apiService.getHealthData(date);

      // Cache result
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      return data;
    } catch (error) {
      console.error('Error getting health data:', error);
      return {
        date: new Date(),
        steps: 0,
        sleep_hours: 0,
        heart_rate: 0,
        exercise_minutes: 0,
      };
    }
  }

  // ============ MOOD TRACKING ============

  async addMood(score: number, notes?: string): Promise<MoodEntry> {
    try {
      const entry = await apiService.addMoodEntry(score, notes);

      // Clear mood cache
      Array.from(this.cache.keys()).forEach((key) => {
        if (key.startsWith('moods_')) {
          this.cache.delete(key);
        }
      });

      return entry;
    } catch (error) {
      console.error('Error adding mood:', error);
      throw error;
    }
  }

  async getMoods(days: number = 7): Promise<MoodEntry[]> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const moods = await apiService.getMoodEntries(
        startDate.toISOString(),
        endDate.toISOString()
      );

      return moods;
    } catch (error) {
      console.error('Error fetching moods:', error);
      return [];
    }
  }

  // ============ ANALYSIS ============

  async analyze(): Promise<AnalysisResult> {
    try {
      const analysis = await apiService.getAnalysis();
      return analysis;
    } catch (error) {
      console.error('Error running analysis:', error);
      return {
        date: new Date(),
        patterns: [],
        recommendations: [],
        mood_average: 0,
        mood_trend: 'stable',
      };
    }
  }

  async getAnalysisHistory(): Promise<AnalysisResult | null> {
    try {
      const history = await apiService.getAnalysisHistory(1);
      return history[0] || null;
    } catch (error) {
      console.error('Error fetching analysis history:', error);
      return null;
    }
  }

  // ============ INTEGRATIONS ============

  async syncProvider(provider: string): Promise<any> {
    try {
      const result = await apiService.syncHealthData(provider);

      // Clear health cache after sync
      this.cache.clear();

      return result;
    } catch (error) {
      console.error('Error syncing provider:', error);
      throw error;
    }
  }

  async getProviderStatus(provider: string): Promise<any> {
    try {
      const status = await apiService.getProviderStatus(provider);
      return status;
    } catch (error) {
      console.error('Error getting provider status:', error);
      return {
        connected: false,
        lastSync: null,
      };
    }
  }

  // ============ UTILITIES ============

  clearCache(): void {
    this.cache.clear();
  }
}

export const healthService = new HealthService();
