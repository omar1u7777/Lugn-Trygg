// User Types
export interface User {
  uid: string;
  email: string;
  name?: string;
  photoURL?: string;
  createdAt?: Date;
}

// Health Data Types
export interface HealthData {
  date: Date;
  steps: number;
  sleep_hours: number;
  heart_rate: number;
  exercise_minutes: number;
  calories?: number;
  distance?: number;
}

// Mood Entry Types
export interface MoodEntry {
  id?: string;
  date: Date;
  mood_score: number; // 1-5
  notes?: string;
  userId?: string;
}

// Pattern Types
export interface Pattern {
  id: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  frequency: string;
  examples: string[];
}

// Recommendation Types
export interface Recommendation {
  id: string;
  title: string;
  description: string;
  action: string;
  priority: number;
  category: string;
}

// Analysis Result Types
export interface AnalysisResult {
  id?: string;
  date: Date;
  patterns: Pattern[];
  recommendations: Recommendation[];
  mood_average?: number;
  mood_trend?: 'improving' | 'declining' | 'stable';
  summary?: string;
}

// Integration Provider Types
export interface IntegrationProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  connected?: boolean;
  lastSync?: Date;
}

// Provider Status
export interface ProviderStatus {
  connected: boolean;
  lastSync: Date | null;
  error?: string;
}

// Auth Context Types
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle?: (googleUserInfo: any) => Promise<void>;
  isAuthenticated: boolean;
}

// Navigation Types
export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
  Home: undefined;
  MoodTracker: undefined;
  Integrations: undefined;
  Analysis: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type TabParamList = {
  Home: undefined;
  Mood: undefined;
  Health: undefined;
  Analysis: undefined;
  Profile: undefined;
};
