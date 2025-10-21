# 📱 REACT NATIVE SETUP - GETTING STARTED

**This file contains all the setup needed to start building the mobile app**

---

## 🚀 STEP 1: Create React Native Project

```bash
# Install Expo CLI
npm install -g expo-cli@latest

# Create new React Native project with TypeScript
npx create-expo-app LugnTryggMobile --template
cd LugnTryggMobile

# Add TypeScript support
npx expo install expo-cli
npm install typescript @types/react @types/react-native --save-dev
npx tsc --init
```

---

## 📦 STEP 2: Install Dependencies

```bash
npm install \
  @react-navigation/native @react-navigation/bottom-tabs @react-navigation/stack \
  react-native-screens react-native-safe-area-context \
  react-native-gesture-handler \
  firebase @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore \
  axios \
  react-native-paper \
  @react-native-community/async-storage \
  expo-notifications \
  expo-linking \
  date-fns \
  react-native-svg \
  react-native-linear-gradient

npm install --save-dev @types/node @types/react @types/react-native
```

---

## 🔐 STEP 3: Firebase Setup

Create `src/config/firebase.ts`:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-community/async-storage';
import * as ReactNativeFirebase from '@react-native-firebase/app';

// Get this from Firebase Console
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Initialize Firestore
const db = getFirestore(app);

export { auth, db, app };
```

---

## 🔑 STEP 4: Environment Variables

Create `.env.local`:

```
REACT_APP_FIREBASE_API_KEY=your_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

REACT_APP_BACKEND_URL=http://localhost:5000
REACT_APP_OAUTH_REDIRECT_URL=lugntrygguniverse://oauth-callback
```

---

## 📱 STEP 5: Core Navigation Structure

Create `src/navigation/RootNavigator.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/stack';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

import SplashScreen from '../screens/common/SplashScreen';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';

const Stack = createNativeStackNavigator();

const RootNavigator = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen 
            name="App" 
            component={AppNavigator}
            options={{ animationEnabled: false }}
          />
        ) : (
          <Stack.Screen 
            name="Auth" 
            component={AuthNavigator}
            options={{ animationEnabled: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
```

---

## 🏠 STEP 6: App Navigator (Bottom Tabs)

Create `src/navigation/AppNavigator.tsx`:

```typescript
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import HomeScreen from '../screens/home/HomeScreen';
import MoodTrackerScreen from '../screens/home/MoodTrackerScreen';
import IntegrationsScreen from '../screens/integrations/IntegrationsScreen';
import AnalysisScreen from '../screens/analysis/AnalysisScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HomeStack = () => (
  <Stack.Navigator>
    <Stack.Screen 
      name="Home" 
      component={HomeScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="MoodTracker" 
      component={MoodTrackerScreen}
      options={{ headerTitle: 'Add Mood' }}
    />
  </Stack.Navigator>
);

const AppNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'HomeStack') iconName = 'home';
          else if (route.name === 'Integrations') iconName = 'link';
          else if (route.name === 'Analysis') iconName = 'brain';
          else if (route.name === 'Profile') iconName = 'account';
          
          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="HomeStack" 
        component={HomeStack}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen 
        name="Integrations" 
        component={IntegrationsScreen}
        options={{ tabBarLabel: 'Devices' }}
      />
      <Tab.Screen 
        name="Analysis" 
        component={AnalysisScreen}
        options={{ tabBarLabel: 'Analysis' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

export default AppNavigator;
```

---

## 🔐 STEP 7: Auth Navigator

Create `src/navigation/AuthNavigator.tsx`:

```typescript
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import OAuthSetupScreen from '../screens/auth/OAuthSetupScreen';

const Stack = createNativeStackNavigator();

const AuthNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="OAuthSetup" component={OAuthSetupScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
```

---

## 🎨 STEP 8: Theme Configuration

Create `src/theme/colors.ts`:

```typescript
export const COLORS = {
  // Primary
  primary: '#2563EB',
  primary_light: '#DBEAFE',
  primary_dark: '#1E40AF',

  // Success
  success: '#10B981',
  success_light: '#DCFCE7',
  success_dark: '#047857',

  // Warning
  warning: '#F59E0B',
  warning_light: '#FEF3C7',
  warning_dark: '#D97706',

  // Danger
  danger: '#EF4444',
  danger_light: '#FEE2E2',
  danger_dark: '#DC2626',

  // Info
  info: '#06B6D4',
  info_light: '#CFFAFE',
  info_dark: '#0891B2',

  // Backgrounds
  bg_primary: '#FFFFFF',
  bg_secondary: '#F3F4F6',
  bg_tertiary: '#E5E7EB',

  // Text
  text_primary: '#1F2937',
  text_secondary: '#6B7280',
  text_tertiary: '#9CA3AF',

  // Mood colors
  mood_1: '#DC2626',
  mood_2: '#F97316',
  mood_3: '#FBBF24',
  mood_4: '#84CC16',
  mood_5: '#10B981',

  // Borders
  border: '#E5E7EB',
  border_dark: '#D1D5DB',
};

export const DARK_COLORS = {
  bg_primary: '#1F2937',
  bg_secondary: '#111827',
  text_primary: '#F3F4F6',
  text_secondary: '#D1D5DB',
  // ... rest follows same pattern
};
```

---

## 📐 STEP 9: Type Definitions

Create `src/types/index.ts`:

```typescript
// User types
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

// Health types
export interface HealthData {
  date: Date;
  steps: number;
  sleep_hours: number;
  heart_rate: number;
  calories: number;
  provider: string;
}

// Mood types
export interface MoodEntry {
  id: string;
  date: Date;
  mood_score: number;
  notes?: string;
}

// Analysis types
export interface AnalysisResult {
  status: 'success' | 'insufficient_data' | 'error';
  patterns: Pattern[];
  recommendations: Recommendation[];
  mood_average?: number;
  mood_trend?: 'improving' | 'declining' | 'stable';
  health_summary?: HealthSummary;
}

export interface Pattern {
  type: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export interface Recommendation {
  title: string;
  description: string;
  action: string;
  expected_benefit: string;
  priority: 'high' | 'medium' | 'low';
}

export interface HealthSummary {
  avg_steps?: number;
  steps_status?: 'good' | 'low';
  avg_sleep?: number;
  sleep_status?: 'good' | 'too_much' | 'too_little';
  avg_hr?: number;
  hr_status?: 'good' | 'elevated';
}

// Goal types
export interface Goal {
  id: string;
  type: 'steps' | 'sleep' | 'exercise' | 'custom';
  target: number;
  unit: string;
  created_at: Date;
  description?: string;
}

// Context types
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}
```

---

## 🎯 STEP 10: Main App Component

Create `src/App.tsx`:

```typescript
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import RootNavigator from './navigation/RootNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <StatusBar barStyle="dark-content" />
        <RootNavigator />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
```

---

## 🏗️ STEP 11: API Service Layer

Create `src/services/api.ts`:

```typescript
import axios from 'axios';
import AsyncStorage from '@react-native-community/async-storage';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
});

// Add token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle responses
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle token refresh
      await AsyncStorage.removeItem('authToken');
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## 🚦 STEP 12: Health Service

Create `src/services/health.ts`:

```typescript
import api from './api';
import type { HealthData, AnalysisResult } from '../types';

export const healthService = {
  // Sync health data from provider
  async syncHealth(provider: string, days: number = 7) {
    return api.post(`/integration/health/sync/${provider}`, { days });
  },

  // Get health data
  async getHealthData(provider: string) {
    return api.get(`/health/data/${provider}`);
  },

  // Run analysis
  async analyze() {
    return api.post('/integration/health/analyze', {}) as Promise<AnalysisResult>;
  },

  // Get analysis history
  async getAnalysisHistory() {
    return api.get('/integration/health/analyze');
  },
};
```

---

## 🎯 STEP 13: Auth Context

Create `src/context/AuthContext.tsx`:

```typescript
import React, { createContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-community/async-storage';
import type { User, AuthContextType } from '../types';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Get custom user data from Firestore
        const token = await firebaseUser.getIdToken();
        await AsyncStorage.setItem('authToken', token);
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || '',
          createdAt: new Date(firebaseUser.metadata?.creationTime || Date.now()),
        });
      } else {
        setUser(null);
        await AsyncStorage.removeItem('authToken');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      await AsyncStorage.removeItem('authToken');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login: async () => {}, signup: async () => {}, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

---

## ✅ Complete

All foundational setup is done. Next: Build the actual screens!

Ready for:
- Login/SignUp screens
- Home screen
- Mood tracker
- Health integrations
- Analysis display
- Profile management

---

**Next File:** Screens Implementation (HomeScreen, LoginScreen, etc.)

Ready? 🚀
