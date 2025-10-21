# 🔌 API INTEGRATION LAYER

Complete integration between mobile frontend and Flask backend.

---

## 🌐 API Service

Create `src/services/api.ts`:

```typescript
import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

class APIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
    });

    // Add auth token to all requests
    this.client.interceptors.request.use(
      async (config) => {
        try {
          const auth = getAuth();
          const token = await auth.currentUser?.getIdToken();
          if (token) {
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
          // Handle unauthorized
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
      const params = { start_date: startDate, end_date: endDate };
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
        date: new Date(),
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

  async getOAuthURL(provider: string) {
    try {
      const response = await this.client.get(`/api/integration/oauth/${provider}`, {
        params: { redirect_uri: `${API_BASE_URL}/oauth/mobile/callback` },
      });
      return response.data;
    } catch (error) {
      console.error('Error getting OAuth URL:', error);
      throw error;
    }
  }

  async completeOAuth(provider: string, code: string, state: string) {
    try {
      const response = await this.client.post('/api/integration/oauth/callback', {
        provider,
        code,
        state,
      });
      return response.data;
    } catch (error) {
      console.error('Error completing OAuth:', error);
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
      const response = await this.client.get(
        `/api/integration/status/${provider}`
      );
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
```

---

## 🏥 Health Service

Create `src/services/health.ts`:

```typescript
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
      // Return default data on error
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
      this.cache.delete('moods_*');
      
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
        patterns: [],
        recommendations: [],
        mood_average: 0,
        mood_trend: 'stable',
      };
    }
  }

  async getAnalysisHistory(): Promise<AnalysisResult> {
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

  async connectProvider(provider: string): Promise<string> {
    try {
      const { oauth_url } = await apiService.getOAuthURL(provider);
      return oauth_url;
    } catch (error) {
      console.error('Error getting OAuth URL:', error);
      throw error;
    }
  }

  async completeProviderAuth(
    provider: string,
    code: string,
    state: string
  ): Promise<any> {
    try {
      const result = await apiService.completeOAuth(provider, code, state);
      
      // Save provider token
      await AsyncStorage.setItem(
        `oauth_${provider}`,
        JSON.stringify(result)
      );

      return result;
    } catch (error) {
      console.error('Error completing OAuth:', error);
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

  async saveOfflineData(): Promise<void> {
    try {
      const data = {
        cache: Array.from(this.cache.entries()),
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem('healthServiceCache', JSON.stringify(data));
    } catch (error) {
      console.error('Error saving offline data:', error);
    }
  }

  async loadOfflineData(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem('healthServiceCache');
      if (data) {
        const parsed = JSON.parse(data);
        this.cache = new Map(parsed.cache);
      }
    } catch (error) {
      console.error('Error loading offline data:', error);
    }
  }
}

export const healthService = new HealthService();
```

---

## 🔐 Auth Service

Create `src/services/auth.ts`:

```typescript
import {
  initializeAuth,
  getReactNativePersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
  onAuthStateChanged,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';

let authInstance: any;

export const initializeFirebaseAuth = async () => {
  try {
    const auth = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    authInstance = auth;
    return auth;
  } catch (error) {
    console.error('Error initializing Firebase Auth:', error);
    throw error;
  }
};

class AuthService {
  private listeners: ((user: User | null) => void)[] = [];

  async login(email: string, password: string): Promise<User> {
    try {
      const auth = authInstance;
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Create/update user in backend
      await this.syncUserToBackend(result.user);
      
      return result.user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async signup(email: string, password: string, name: string): Promise<User> {
    try {
      const auth = authInstance;
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user in backend
      await apiService.updateProfile({
        email: result.user.email,
        name,
        uid: result.user.uid,
      });

      return result.user;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      const auth = authInstance;
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  onAuthStateChange(callback: (user: User | null) => void): void {
    if (!authInstance) return;

    onAuthStateChanged(authInstance, (user) => {
      callback(user);
      
      if (user) {
        this.syncUserToBackend(user);
      }
    });
  }

  private async syncUserToBackend(user: User): Promise<void> {
    try {
      await apiService.updateProfile({
        uid: user.uid,
        email: user.email,
        photoURL: user.photoURL,
      });
    } catch (error) {
      console.error('Error syncing user to backend:', error);
    }
  }
}

export const authService = new AuthService();
```

---

## 📋 Notification Service

Create `src/services/notifications.ts`:

```typescript
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  private expoPushToken: string | null = null;

  async initialize(): Promise<string | null> {
    try {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Notification permissions not granted');
        return null;
      }

      // Get Expo push token
      const token = await Notifications.getExpoPushTokenAsync();
      this.expoPushToken = token.data;

      // Save to backend
      await apiService.updateProfile({
        push_token: this.expoPushToken,
      });

      return this.expoPushToken;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return null;
    }
  }

  async scheduleDailyReminder(hour: number = 9, minute: number = 0): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();

      for (let i = 0; i < 7; i++) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + i);
        tomorrow.setHours(hour, minute, 0);

        await Notifications.scheduleNotificationAsync({
          content: {
            title: '💭 How are you feeling?',
            body: 'Take a moment to log your mood.',
            sound: 'default',
          },
          trigger: tomorrow,
        });
      }

      console.log('Daily reminders scheduled');
    } catch (error) {
      console.error('Error scheduling reminders:', error);
    }
  }

  async sendNotification(
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    try {
      await Notifications.presentNotificationAsync({
        title,
        body,
        data,
        sound: 'default',
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  addNotificationListener(handler: (notification: Notifications.Notification) => void): void {
    Notifications.addNotificationResponseReceivedListener((response) => {
      handler(response.notification);
    });
  }
}

export const notificationService = new NotificationService();
```

---

## 🏗️ Backend API Endpoints (Python Flask)

Add these to your `Backend/src/routes/integration_routes.py`:

```python
from flask import jsonify, request
from datetime import datetime, timedelta
from werkzeug.exceptions import BadRequest
import json

# ============ NEW MOBILE ENDPOINTS ============

@integration_bp.route('/api/health/<date>', methods=['GET'])
@auth_required
def get_health_data(date):
    """Get health data for specific date or period"""
    try:
        user_id = request.user_id
        
        if date == 'today':
            start_date = datetime.now().date()
            end_date = start_date
        elif date == 'week':
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=7)
        elif date == 'month':
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=30)
        else:
            start_date = datetime.fromisoformat(date)
            end_date = start_date

        # Fetch from health providers
        health_data = {
            'date': str(start_date),
            'steps': 0,
            'sleep_hours': 0,
            'heart_rate': 0,
            'exercise_minutes': 0,
        }

        # Aggregate data from all connected providers
        for provider in ['google_fit', 'fitbit', 'samsung', 'withings']:
            try:
                data = fetch_provider_data(user_id, provider, start_date, end_date)
                if data:
                    health_data['steps'] += data.get('steps', 0)
                    health_data['sleep_hours'] += data.get('sleep_hours', 0)
                    health_data['heart_rate'] = data.get('heart_rate', health_data['heart_rate'])
                    health_data['exercise_minutes'] += data.get('exercise_minutes', 0)
            except Exception as e:
                print(f"Error fetching {provider} data: {e}")

        return jsonify(health_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@integration_bp.route('/api/mood', methods=['GET', 'POST'])
@auth_required
def mood_entries():
    """Get or create mood entries"""
    try:
        user_id = request.user_id

        if request.method == 'GET':
            start_date = request.args.get('start_date')
            end_date = request.args.get('end_date')
            
            # Fetch from Firestore
            docs = db.collection('users').document(user_id).collection('mood_entries')\
                .where('date', '>=', start_date)\
                .where('date', '<=', end_date)\
                .stream()
            
            moods = [doc.to_dict() for doc in docs]
            return jsonify(moods)

        elif request.method == 'POST':
            data = request.get_json()
            
            mood_entry = {
                'mood_score': data['mood_score'],
                'notes': data.get('notes'),
                'date': datetime.now().isoformat(),
            }

            # Save to Firestore
            db.collection('users').document(user_id)\
                .collection('mood_entries')\
                .add(mood_entry)

            return jsonify({'success': True, 'entry': mood_entry}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@integration_bp.route('/api/integration/providers', methods=['GET'])
@auth_required
def get_providers():
    """List available health providers"""
    return jsonify({
        'providers': [
            {
                'id': 'google_fit',
                'name': 'Google Fit',
                'icon': 'google',
            },
            {
                'id': 'fitbit',
                'name': 'Fitbit',
                'icon': 'heart-pulse',
            },
            {
                'id': 'samsung',
                'name': 'Samsung Health',
                'icon': 'watch-fit-variant',
            },
            {
                'id': 'withings',
                'name': 'Withings',
                'icon': 'scale-bathroom',
            },
        ]
    })


@integration_bp.route('/api/integration/status/<provider>', methods=['GET'])
@auth_required
def get_provider_status(provider):
    """Get connection status for a provider"""
    try:
        user_id = request.user_id
        
        doc = db.collection('users').document(user_id)\
            .collection('integrations').document(provider).get()
        
        if not doc.exists:
            return jsonify({
                'connected': False,
                'lastSync': None,
            })

        data = doc.to_dict()
        return jsonify({
            'connected': data.get('connected', False),
            'lastSync': data.get('last_sync'),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@integration_bp.route('/api/integration/sync/<provider>', methods=['POST'])
@auth_required
def sync_provider(provider):
    """Force sync data from a provider"""
    try:
        user_id = request.user_id
        
        # Trigger background sync
        sync_result = sync_provider_data(user_id, provider)
        
        return jsonify({
            'success': True,
            'message': f'Synced data from {provider}',
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@integration_bp.route('/api/stats', methods=['GET'])
@auth_required
def get_stats():
    """Get user statistics"""
    try:
        user_id = request.user_id
        period = request.args.get('period', 'week')

        if period == 'week':
            days = 7
        elif period == 'month':
            days = 30
        else:
            days = 365

        # Fetch and aggregate stats
        moods = []
        steps = []
        sleep = []

        # Get data from Firestore
        docs = db.collection('users').document(user_id)\
            .collection('mood_entries').stream()

        for doc in docs:
            moods.append(doc.to_dict())

        mood_avg = sum(m['mood_score'] for m in moods) / len(moods) if moods else 0

        return jsonify({
            'mood_average': mood_avg,
            'mood_count': len(moods),
            'period': period,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@integration_bp.route('/api/user/profile', methods=['GET', 'PUT'])
@auth_required
def user_profile():
    """Get or update user profile"""
    try:
        user_id = request.user_id

        if request.method == 'GET':
            doc = db.collection('users').document(user_id).get()
            if doc.exists:
                return jsonify(doc.to_dict())
            return jsonify({'error': 'User not found'}), 404

        elif request.method == 'PUT':
            data = request.get_json()
            db.collection('users').document(user_id).set(data, merge=True)
            return jsonify({'success': True})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@integration_bp.route('/api/analysis/history', methods=['GET'])
@auth_required
def analysis_history():
    """Get analysis history"""
    try:
        user_id = request.user_id
        limit = request.args.get('limit', 10, type=int)

        docs = db.collection('users').document(user_id)\
            .collection('analysis').order_by('timestamp', 'descending')\
            .limit(limit).stream()

        results = [doc.to_dict() for doc in docs]
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

---

## ✅ Integration Checklist

- [ ] Create `src/services/api.ts`
- [ ] Create `src/services/health.ts`
- [ ] Create `src/services/auth.ts`
- [ ] Create `src/services/notifications.ts`
- [ ] Add new routes to `Backend/src/routes/integration_routes.py`
- [ ] Test API endpoints with Postman
- [ ] Connect screens to services
- [ ] Test data flow end-to-end

Ready! 🚀
