/**
 * App Store - Global State Management with Zustand
 * 
 * Centralized store for application-wide state.
 * Uses Zustand for lightweight, TypeScript-friendly state management.
 */

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';

// ============================================
// User Store
// ============================================

interface UserState {
  userId: string | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  isPremium: boolean;
  plan: 'free' | 'premium' | 'enterprise';
  
  // Actions
  setUser: (user: Partial<UserState>) => void;
  clearUser: () => void;
  upgradeToPremium: () => void;
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set) => ({
        userId: null,
        displayName: null,
        email: null,
        avatarUrl: null,
        isPremium: false,
        plan: 'free',

        setUser: (user) => set((state) => ({ ...state, ...user })),
        
        clearUser: () => set({
          userId: null,
          displayName: null,
          email: null,
          avatarUrl: null,
          isPremium: false,
          plan: 'free',
        }),
        
        upgradeToPremium: () => set({ isPremium: true, plan: 'premium' }),
      }),
      {
        name: 'lugn-trygg-user',
        partialize: (state) => ({
          userId: state.userId,
          displayName: state.displayName,
          isPremium: state.isPremium,
          plan: state.plan,
        }),
      }
    ),
    { name: 'UserStore' }
  )
);

// ============================================
// UI Store
// ============================================

interface UIState {
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  activeModal: string | null;
  toasts: Toast[];
  
  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: true,
        mobileMenuOpen: false,
        theme: 'system',
        notificationsEnabled: true,
        activeModal: null,
        toasts: [],

        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        setSidebarOpen: (open) => set({ sidebarOpen: open }),
        toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
        setTheme: (theme) => set({ theme }),
        openModal: (modalId) => set({ activeModal: modalId }),
        closeModal: () => set({ activeModal: null }),
        
        addToast: (toast) => set((state) => ({
          toasts: [...state.toasts, { ...toast, id: `toast_${Date.now()}` }],
        })),
        
        removeToast: (id) => set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),
      }),
      {
        name: 'lugn-trygg-ui',
        partialize: (state) => ({
          theme: state.theme,
          sidebarOpen: state.sidebarOpen,
          notificationsEnabled: state.notificationsEnabled,
        }),
      }
    ),
    { name: 'UIStore' }
  )
);

// ============================================
// Mood Store
// ============================================

interface MoodEntry {
  id: string;
  score: number;
  mood: string;
  text?: string;
  timestamp: Date;
}

interface MoodState {
  recentMoods: MoodEntry[];
  averageScore: number;
  streakDays: number;
  lastLoggedAt: Date | null;
  isLoading: boolean;
  
  // Actions
  setMoods: (moods: MoodEntry[]) => void;
  addMood: (mood: MoodEntry) => void;
  setStreak: (days: number) => void;
  setLoading: (loading: boolean) => void;
  calculateAverage: () => void;
}

export const useMoodStore = create<MoodState>()(
  devtools(
    (set, get) => ({
      recentMoods: [],
      averageScore: 0,
      streakDays: 0,
      lastLoggedAt: null,
      isLoading: false,

      setMoods: (moods) => {
        set({ recentMoods: moods });
        get().calculateAverage();
      },
      
      addMood: (mood) => set((state) => {
        const newMoods = [mood, ...state.recentMoods].slice(0, 50);
        const avg = newMoods.reduce((sum, m) => sum + m.score, 0) / newMoods.length;
        return {
          recentMoods: newMoods,
          averageScore: Math.round(avg * 10) / 10,
          lastLoggedAt: mood.timestamp,
        };
      }),
      
      setStreak: (days) => set({ streakDays: days }),
      setLoading: (loading) => set({ isLoading: loading }),
      
      calculateAverage: () => set((state) => {
        if (state.recentMoods.length === 0) return { averageScore: 0 };
        const avg = state.recentMoods.reduce((sum, m) => sum + m.score, 0) / state.recentMoods.length;
        return { averageScore: Math.round(avg * 10) / 10 };
      }),
    }),
    { name: 'MoodStore' }
  )
);

// ============================================
// Gamification Store
// ============================================

interface GamificationState {
  level: number;
  xp: number;
  xpToNextLevel: number;
  streakDays: number;
  achievements: string[];
  badges: string[];
  
  // Actions
  addXP: (amount: number) => void;
  unlockAchievement: (achievementId: string) => void;
  earnBadge: (badgeId: string) => void;
  setLevel: (level: number, xp: number, xpToNext: number) => void;
}

export const useGamificationStore = create<GamificationState>()(
  devtools(
    persist(
      (set, get) => ({
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        streakDays: 0,
        achievements: [],
        badges: [],

        addXP: (amount) => set((state) => {
          let newXP = state.xp + amount;
          let newLevel = state.level;
          let newXPToNext = state.xpToNextLevel;
          
          // Level up logic
          while (newXP >= newXPToNext) {
            newXP -= newXPToNext;
            newLevel++;
            newXPToNext = Math.floor(100 * Math.pow(1.5, newLevel - 1));
          }
          
          return {
            xp: newXP,
            level: newLevel,
            xpToNextLevel: newXPToNext,
          };
        }),
        
        unlockAchievement: (achievementId) => set((state) => {
          if (state.achievements.includes(achievementId)) return state;
          return { achievements: [...state.achievements, achievementId] };
        }),
        
        earnBadge: (badgeId) => set((state) => {
          if (state.badges.includes(badgeId)) return state;
          return { badges: [...state.badges, badgeId] };
        }),
        
        setLevel: (level, xp, xpToNext) => set({
          level,
          xp,
          xpToNextLevel: xpToNext,
        }),
      }),
      {
        name: 'lugn-trygg-gamification',
      }
    ),
    { name: 'GamificationStore' }
  )
);

// ============================================
// Navigation Store
// ============================================

interface NavigationState {
  currentPath: string;
  previousPath: string | null;
  breadcrumbs: { label: string; path: string }[];
  
  // Actions
  navigate: (path: string) => void;
  setBreadcrumbs: (breadcrumbs: { label: string; path: string }[]) => void;
}

export const useNavigationStore = create<NavigationState>()(
  devtools(
    (set) => ({
      currentPath: '/',
      previousPath: null,
      breadcrumbs: [],

      navigate: (path) => set((state) => ({
        previousPath: state.currentPath,
        currentPath: path,
      })),
      
      setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),
    }),
    { name: 'NavigationStore' }
  )
);

// ============================================
// Exports
// ============================================

export type { UserState, UIState, MoodState, GamificationState, NavigationState, Toast, MoodEntry };
