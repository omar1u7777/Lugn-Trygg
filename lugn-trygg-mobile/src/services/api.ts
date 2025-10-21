import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import { API_BASE_URL, API_TIMEOUT } from '../config/constants';

class APIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
    });

    // Add auth token to all requests
    this.client.interceptors.request.use(
      async (config) => {
        try {
          const auth = getAuth();
          if (auth.currentUser) {
            const token = await auth.currentUser.getIdToken();
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error('Error getting auth token:', error);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Handle response errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          AsyncStorage.removeItem('authToken');
        }
        return Promise.reject(error);
      }
    );
  }

  // ============ HEALTH DATA ============

  async getHealthData(date: string) {
    try {
      const response = await this.client.get(`/api/health/${date}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching health data:', error);
      throw error;
    }
  }

  async getMoodEntries(startDate?: string, endDate?: string) {
    try {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await this.client.get('/api/mood', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching mood entries:', error);
      throw error;
    }
  }

  async addMoodEntry(moodScore: number, notes?: string) {
    try {
      const response = await this.client.post('/api/mood', {
        mood_score: moodScore,
        notes,
        date: new Date().toISOString(),
      });
      return response.data;
    } catch (error) {
      console.error('Error adding mood entry:', error);
      throw error;
    }
  }

  // ============ ANALYSIS ============

  async getAnalysis() {
    try {
      const response = await this.client.get('/api/integration/health/analyze');
      return response.data;
    } catch (error) {
      console.error('Error fetching analysis:', error);
      throw error;
    }
  }

  async getAnalysisHistory(limit: number = 10) {
    try {
      const response = await this.client.get('/api/analysis/history', {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching analysis history:', error);
      throw error;
    }
  }

  // ============ INTEGRATIONS ============

  async getProviders() {
    try {
      const response = await this.client.get('/api/integration/providers');
      return response.data;
    } catch (error) {
      console.error('Error fetching providers:', error);
      throw error;
    }
  }

  async syncHealthData(provider: string) {
    try {
      const response = await this.client.post(`/api/integration/sync/${provider}`);
      return response.data;
    } catch (error) {
      console.error('Error syncing health data:', error);
      throw error;
    }
  }

  async getProviderStatus(provider: string) {
    try {
      const response = await this.client.get(`/api/integration/status/${provider}`);
      return response.data;
    } catch (error) {
      console.error('Error getting provider status:', error);
      throw error;
    }
  }

  // ============ USER PROFILE ============

  async getProfile() {
    try {
      const response = await this.client.get('/api/user/profile');
      return response.data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  }

  async updateProfile(data: any) {
    try {
      const response = await this.client.put('/api/user/profile', data);
      return response.data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  // ============ STATS ============

  async getStats(period: 'week' | 'month' | 'year' = 'week') {
    try {
      const response = await this.client.get('/api/stats', {
        params: { period },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  }
}

export const apiService = new APIService();
