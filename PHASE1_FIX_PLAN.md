# Phase 1 Architecture & Code Structure Fix Plan

**Project:** Lugn & Trygg Web Application  
**Date:** 2026-05-02  
**Status:** Ready for Implementation  
**Priority:** Critical/High/Medium  
**Estimated Effort:** 3-4 weeks (full-stack coordination required)

---

## Executive Summary

This plan addresses critical structural issues identified in the Phase 1 audit:
1. **5,593-line monster component** (`Recommendations.tsx`) causing TDZ errors and bundle bloat
2. **Duplicated password toggle logic** across auth forms (DRY violation)
3. **No server-state management library** despite 34+ API modules
4. **Client-side usage limits** stored in `localStorage` (security bypass)
5. **Other large components** requiring decomposition

All fixes prioritize security, performance, maintainability, and production readiness.

---

## Table of Contents

1. [Fix #1: Split Recommendations.tsx](#fix-1-split-recommendationstx)
2. [Fix #2: Create PasswordInput Component](#fix-2-create-passwordinput-component)
3. [Fix #3: Implement React Query](#fix-3-implement-react-query)
4. [Fix #4: Move Usage Limits to Backend](#fix-4-move-usage-limits-to-backend)
5. [Fix #5: Audit Large Components](#fix-5-audit-large-components)
6. [Risk Assessment & Mitigation](#risk-assessment--mitigation)
7. [Testing Strategy](#testing-strategy)
8. [Deployment Checklist](#deployment-checklist)

---

## Fix #1: Split Recommendations.tsx

### Current State
- **File:** `src/components/Recommendations.tsx`
- **Size:** 5,593 lines / 291 KB
- **Issues:**
  - TDZ errors already occurred (`handleSaveMeditationSession` moved from L1317 to L326)
  - Impossible to review/maintain
  - Massive bundle impact for any route that imports it
  - Mixes breathing exercises, PMR, meditation, CBT, journaling, and mood analytics

### Target State
Decompose into 12-15 focused modules:
```
src/components/Recommendations/
├── index.tsx                    # Main orchestrator (max 200 lines)
├── hooks/
│   ├── useBreathing.ts         # Breathing exercise logic
│   ├── usePMR.ts               # Progressive Muscle Relaxation logic
│   ├── useMeditation.ts        # Meditation session logic
│   ├── useCBT.ts               # Cognitive Behavioral Therapy logic
│   ├── useJournaling.ts        # Journaling prompts logic
│   └── useMoodAnalysis.ts      # Mood analytics logic
├── BreathingExercise.tsx       # Breathing UI component
├── PMRExercise.tsx             # PMR UI component
├── MeditationSession.tsx       # Meditation UI component
├── CBTExercise.tsx             # CBT UI component
├── JournalingPrompt.tsx         # Journaling UI component
├── MoodAnalytics.tsx           # Mood analytics UI component
├── types.ts                    # Shared TypeScript interfaces
└── constants.ts                # Shared constants
```

### Implementation Steps

#### Step 1: Analysis & Extraction Planning
```bash
# Identify distinct features in Recommendations.tsx
grep -n "function\|const.*=.*useCallback\|const.*=.*useMemo" src/components/Recommendations.tsx
```

**Actions:**
1. Read entire `Recommendations.tsx` to understand feature boundaries
2. Map all state variables to their respective features
3. Identify shared state vs. feature-specific state
4. Document all external dependencies (API calls, hooks, contexts)

#### Step 2: Create Directory Structure
```bash
mkdir -p src/components/Recommendations/hooks
```

#### Step 3: Extract Shared Types
**File:** `src/components/Recommendations/types.ts`
```typescript
// All interfaces used across sub-components
export interface Recommendation {
  id: string;
  type: 'breathing' | 'pmr' | 'meditation' | 'cbt' | 'journaling' | 'mood';
  title: string;
  description: string;
  // ... other shared fields
}

export interface BreathingConfig {
  inhaleSeconds: number;
  holdSeconds: number;
  exhaleSeconds: number;
  cycles: number;
}

// ... other interfaces
```

#### Step 4: Extract Constants
**File:** `src/components/Recommendations/constants.ts`
```typescript
export const BREATHING_DEFAULTS = {
  inhaleSeconds: 4,
  holdSeconds: 4,
  exhaleSeconds: 4,
  cycles: 5,
} as const;

export const PMR_MUSCLE_GROUPS = [
  'hands',
  'arms',
  'shoulders',
  'face',
  'chest',
  'stomach',
  'legs',
  'feet',
] as const;

// ... other constants
```

#### Step 5: Extract Hooks (Feature-Specific Logic)

**File:** `src/components/Recommendations/hooks/useBreathing.ts`
```typescript
import { useState, useCallback, useEffect } from 'react';
import { BREATHING_DEFAULTS } from '../constants';
import type { BreathingConfig } from '../types';

export const useBreathing = (config?: Partial<BreathingConfig>) => {
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [cycle, setCycle] = useState(0);
  const [isActive, setIsActive] = useState(false);
  
  // ... breathing logic extracted from Recommendations.tsx
  
  return {
    phase,
    cycle,
    isActive,
    start: useCallback(() => setIsActive(true), []),
    stop: useCallback(() => setIsActive(false), []),
    // ... other returns
  };
};
```

**Repeat for:**
- `usePMR.ts` (Progressive Muscle Relaxation)
- `useMeditation.ts` (Meditation sessions)
- `useCBT.ts` (Cognitive Behavioral Therapy)
- `useJournaling.ts` (Journaling prompts)
- `useMoodAnalysis.ts` (Mood analytics)

#### Step 6: Extract UI Components

**File:** `src/components/Recommendations/BreathingExercise.tsx`
```typescript
import React from 'react';
import { useBreathing } from './hooks/useBreathing';
import { Card } from '../ui/tailwind';

export const BreathingExercise: React.FC = () => {
  const { phase, cycle, isActive, start, stop } = useBreathing();
  
  return (
    <Card>
      {/* Breathing UI extracted from Recommendations.tsx */}
    </Card>
  );
};
```

**Repeat for:**
- `PMRExercise.tsx`
- `MeditationSession.tsx`
- `CBTExercise.tsx`
- `JournalingPrompt.tsx`
- `MoodAnalytics.tsx`

#### Step 7: Create Main Orchestrator

**File:** `src/components/Recommendations/index.tsx`
```typescript
import React from 'react';
import { BreathingExercise } from './BreathingExercise';
import { PMRExercise } from './PMRExercise';
import { MeditationSession } from './MeditationSession';
import { CBTExercise } from './CBTExercise';
import { JournalingPrompt } from './JournalingPrompt';
import { MoodAnalytics } from './MoodAnalytics';

export const Recommendations: React.FC = () => {
  return (
    <div className="space-y-6">
      <BreathingExercise />
      <PMRExercise />
      <MeditationSession />
      <CBTExercise />
      <JournalingPrompt />
      <MoodAnalytics />
    </div>
  );
};

export default Recommendations;
```

#### Step 8: Update Imports Across Codebase
```bash
# Find all files importing Recommendations
grep -r "from.*Recommendations" src/ --include="*.tsx" --include="*.ts"
```

**Update all imports:**
- Old: `import Recommendations from '@/components/Recommendations'`
- New: `import { Recommendations } from '@/components/Recommendations'`

#### Step 9: Update Tests
**File:** `src/components/__tests__/Recommendations.test.tsx`
- Split tests by feature (breathing, PMR, meditation, etc.)
- Ensure all hooks are tested independently
- Add integration tests for the orchestrator

#### Step 10: Verify Bundle Impact
```bash
npm run build:analyze
```
- Compare bundle sizes before/after
- Verify no increase in total bundle size
- Confirm code splitting is working

### Side Effects & Mitigations

| Side Effect | Mitigation |
|-------------|------------|
| Breaking import path changes | Update all imports in single PR |
| State management complexity | Use React Context for shared state if needed |
| Prop drilling | Introduce feature-specific contexts |
| Test failures | Update all test files in same PR |
| Bundle regression | Run bundle analysis before/after |

### Security Considerations
- No security impact (pure refactoring)
- Verify no API calls are duplicated
- Ensure all error handling is preserved

### Completeness Checklist
- [ ] All features extracted to separate files
- [ ] No code duplication
- [ ] All imports updated
- [ ] All tests updated and passing
- [ ] Bundle size verified (no regression)
- [ ] TypeScript compilation successful
- [ ] No console errors in development
- [ ] Manual testing of all recommendation features

---

## Fix #2: Create PasswordInput Component

### Current State
- `LoginForm.tsx`: Uses `usePasswordToggle` hook (correct)
- `RegisterForm.tsx`: Has inline `useState` for `showPassword` and `showConfirmPassword` (~60 lines duplicated)

### Target State
Create reusable `PasswordInput` component:
```
src/components/ui/tailwind/PasswordInput.tsx
```

### Implementation Steps

#### Step 1: Create PasswordInput Component
**File:** `src/components/ui/tailwind/PasswordInput.tsx`
```typescript
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Input } from './Input';

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helpText?: string;
  dataTestId?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  className?: string;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  id,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  helpText,
  dataTestId,
  ariaDescribedBy,
  ariaInvalid,
  className = '',
}) => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);

  const togglePassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const describedBy = error ? `${id}-error` : helpText ? `${id}-help` : ariaDescribedBy;

  return (
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`pr-12 ${className}`}
        data-testid={dataTestId}
        aria-describedby={describedBy}
        aria-invalid={!!error || ariaInvalid}
      />
      <button
        type="button"
        onClick={togglePassword}
        disabled={disabled}
        title={showPassword ? t('common.hidePassword') : t('common.showPassword')}
        aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
        aria-pressed={showPassword}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
      </button>
      {helpText && !error && (
        <p id={`${id}-help`} className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          {helpText}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-error-600 dark:text-error-400">
          {error}
        </p>
      )}
    </div>
  );
};

export default PasswordInput;
```

#### Step 2: Update RegisterForm.tsx
**Remove from RegisterForm.tsx:**
```typescript
// DELETE these lines:
const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
const togglePassword = useCallback(() => setShowPassword((prev) => !prev), []);
const toggleConfirmPassword = useCallback(() => setShowConfirmPassword((prev) => !prev), []);
```

**Replace password input section:**
```tsx
// OLD CODE (lines 254-296):
<div>
  <label htmlFor="password" ...>
    {t('registerForm.passwordLabel')}
  </label>
  <div className="relative">
    <Input
      id="password"
      type={showPassword ? "text" : "password"}
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      placeholder={t('registerForm.passwordPlaceholder')}
      required
      disabled={loading}
      className="pr-12"
      data-testid="register-password-input"
      aria-describedby={validationErrors.password ? "password-error" : "password-help"}
      aria-invalid={!!validationErrors.password}
    />
    <button
      type="button"
      onClick={togglePassword}
      disabled={loading}
      title={showPassword ? t('registerForm.hidePassword') : t('registerForm.showPassword')}
      aria-label={showPassword ? t('registerForm.hidePassword') : t('registerForm.showPassword')}
      aria-pressed={showPassword}
      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
    >
      {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
    </button>
  </div>
  <p id="password-help" className="text-xs text-gray-600 dark:text-gray-400 mt-2">
    {t('registerForm.passwordHelp')}
  </p>
  {validationErrors.password && (
    <p id="password-error" className="mt-1 text-sm text-error-600 dark:text-error-400">{validationErrors.password}</p>
  )}
</div>

// NEW CODE:
<div>
  <label htmlFor="password" ...>
    {t('registerForm.passwordLabel')}
  </label>
  <PasswordInput
    id="password"
    value={password}
    onChange={setPassword}
    placeholder={t('registerForm.passwordPlaceholder')}
    required
    disabled={loading}
    error={validationErrors.password}
    helpText={t('registerForm.passwordHelp')}
    dataTestId="register-password-input"
  />
</div>
```

**Replace confirm password input section:**
```tsx
// OLD CODE (lines 298-337):
<div>
  <label htmlFor="confirmPassword" ...>
    {t('registerForm.confirmPasswordLabel')}
  </label>
  <div className="relative">
    <Input
      id="confirmPassword"
      type={showConfirmPassword ? "text" : "password"}
      value={confirmPassword}
      onChange={(e) => setConfirmPassword(e.target.value)}
      placeholder={t('registerForm.confirmPasswordPlaceholder')}
      required
      disabled={loading}
      className="pr-12"
      data-testid="register-confirm-password-input"
      aria-describedby={validationErrors.confirmPassword ? "confirm-password-error" : undefined}
      aria-invalid={!!validationErrors.confirmPassword}
    />
    <button
      type="button"
      onClick={toggleConfirmPassword}
      disabled={loading}
      title={showConfirmPassword ? t('registerForm.hidePassword') : t('registerForm.showPassword')}
      aria-label={showConfirmPassword ? t('registerForm.hidePassword') : t('registerForm.showPassword')}
      aria-pressed={showConfirmPassword}
      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
    >
      {showConfirmPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
    </button>
  </div>
  {validationErrors.confirmPassword && (
    <p id="confirm-password-error" className="mt-1 text-sm text-error-600 dark:text-error-400">{validationErrors.confirmPassword}</p>
  )}
</div>

// NEW CODE:
<div>
  <label htmlFor="confirmPassword" ...>
    {t('registerForm.confirmPasswordLabel')}
  </label>
  <PasswordInput
    id="confirmPassword"
    value={confirmPassword}
    onChange={setConfirmPassword}
    placeholder={t('registerForm.confirmPasswordPlaceholder')}
    required
    disabled={loading}
    error={validationErrors.confirmPassword}
    dataTestId="register-confirm-password-input"
  />
</div>
```

#### Step 3: Update LoginForm.tsx (Optional Refactor)
`LoginForm.tsx` already uses `usePasswordToggle`, but can be refactored to use `PasswordInput` for consistency.

#### Step 4: Add Missing Translation Keys
**File:** `src/i18n/locales/sv.json` (and other locales)
```json
{
  "common": {
    "showPassword": "Visa lösenord",
    "hidePassword": "Dölj lösenord"
  }
}
```

#### Step 5: Update Tests
**File:** `src/components/Auth/__tests__/RegisterForm.test.tsx`
- Update password input tests to work with new component
- Test toggle functionality still works
- Test accessibility attributes are preserved

**File:** `src/components/__tests__/AuthFormsIntegration.test.tsx`
- Update all password input selectors
- Verify integration tests still pass

#### Step 6: Create PasswordInput Tests
**File:** `src/components/ui/tailwind/__tests__/PasswordInput.test.tsx`
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { PasswordInput } from '../PasswordInput';

describe('PasswordInput', () => {
  it('should toggle password visibility', () => {
    render(<PasswordInput id="test" value="password" onChange={() => {}} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.type).toBe('password');
    
    const toggle = screen.getByRole('button', { name: /visa|show/i });
    fireEvent.click(toggle);
    expect(input.type).toBe('text');
  });

  it('should display error message', () => {
    render(<PasswordInput id="test" value="" onChange={() => {}} error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('should have correct ARIA attributes', () => {
    render(<PasswordInput id="test" value="" onChange={() => {}} error="Required" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'test-error');
  });
});
```

### Side Effects & Mitigations

| Side Effect | Mitigation |
|-------------|------------|
| Breaking changes in RegisterForm | Update in single PR with tests |
| Missing translation keys | Add all locale keys before deployment |
| Test failures | Update all test files in same PR |
| Accessibility regression | Verify ARIA attributes in manual testing |

### Security Considerations
- No security impact (pure UI refactoring)
- Verify password field still uses `type="password"` by default
- Ensure no password values are logged

### Completeness Checklist
- [ ] PasswordInput component created
- [ ] RegisterForm.tsx refactored
- [ ] LoginForm.tsx refactored (optional)
- [ ] All translation keys added
- [ ] All tests updated and passing
- [ ] Manual testing of password toggle
- [ ] Accessibility audit (ARIA attributes)
- [ ] No console errors

---

## Fix #3: Implement React Query

### Current State
- 34+ API modules with manual fetch/caching logic
- `useDashboardData` has module-level in-memory cache
- `SubscriptionContext` has localStorage TTL cache
- `RouteWrappers` has inline `useEffect` fetches
- No unified cache invalidation strategy
- Caches don't sync across tabs

### Target State
Implement `@tanstack/react-query` for unified server-state management:
- Automatic caching with stale-while-revalidate
- Automatic refetching on window focus/reconnect
- Optimistic updates
- Loading/error states
- Request deduplication
- Cross-tab cache synchronization

### Implementation Steps

#### Step 1: Install React Query
```bash
npm install @tanstack/react-query
```

#### Step 2: Create QueryClient Provider
**File:** `src/contexts/QueryContext.tsx`
```typescript
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      refetchOnWindowFocus: false, // Disable for auth pages
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

export const QueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

export { queryClient };
```

#### Step 3: Add to App.tsx
**File:** `src/main.tsx`
```typescript
import { QueryProvider } from './contexts/QueryContext';

// In bootstrap():
createRoot(rootElement).render(
  <ErrorBoundary>
    <I18nextProvider i18n={i18n}>
      <BrowserRouter future={ROUTER_FUTURE_FLAGS}>
        <ThemeProvider>
          <AuthProvider>
            <SubscriptionProvider>
              <QueryProvider>  {/* ADD THIS */}
                <App />
                <TelemetryPortal />
              </QueryProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </I18nextProvider>
  </ErrorBoundary>
);
```

#### Step 4: Create API Query Hooks
**File:** `src/hooks/queries/useDashboardSummary.ts`
```typescript
import { useQuery } from '@tanstack/react-query';
import { getDashboardSummary } from '../api/dashboard';

export const useDashboardSummary = (userId: string, forceRefresh = false) => {
  return useQuery({
    queryKey: ['dashboard', 'summary', userId],
    queryFn: () => getDashboardSummary(userId, forceRefresh),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

**File:** `src/hooks/queries/useSubscriptionStatus.ts`
```typescript
import { useQuery } from '@tanstack/react-query';
import { getSubscriptionStatus } from '../api/subscription';

export const useSubscriptionStatus = (userId: string) => {
  return useQuery({
    queryKey: ['subscription', 'status', userId],
    queryFn: () => getSubscriptionStatus(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

**File:** `src/hooks/queries/useMoods.ts`
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMoods, logMood } from '../api/api';

export const useMoods = (userId: string) => {
  return useQuery({
    queryKey: ['moods', userId],
    queryFn: () => getMoods(userId),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useLogMood = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: logMood,
    onSuccess: () => {
      // Invalidate moods query to refetch
      queryClient.invalidateQueries({ queryKey: ['moods'] });
    },
  });
};
```

#### Step 5: Refactor useDashboardData Hook
**File:** `src/hooks/useDashboardData.ts`
```typescript
import { useDashboardSummary } from './queries/useDashboardSummary';
// Remove manual caching logic - React Query handles it

export const useDashboardData = (userId?: string) => {
  const { data, isLoading, error, refetch } = useDashboardSummary(userId || '', false);
  
  // Map backend response to frontend format
  const stats = data ? {
    totalMoods: data.totalMoods || 0,
    totalChats: data.totalChats || 0,
    averageMood: data.averageMood || 0,
    streakDays: data.streakDays || 0,
    weeklyGoal: Math.max(data.weeklyGoal || 1, 1),
    weeklyProgress: Math.max(data.weeklyProgress || 0, 0),
    wellnessGoals: Array.isArray(data.wellnessGoals) ? data.wellnessGoals : [],
    recentActivity: (data.recentActivity || []).map((activity) => ({
      id: activity.id,
      type: activity.type,
      timestamp: new Date(activity.timestamp),
      description: activity.description,
    })),
  } : createInitialStats();

  return { stats, loading: isLoading, error, refresh: refetch };
};
```

#### Step 6: Refactor SubscriptionContext
**File:** `src/contexts/SubscriptionContext.tsx`
```typescript
import { useSubscriptionStatus } from '../hooks/queries/useSubscriptionStatus';

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isLoggedIn } = useAuth();
  const { data: subscriptionData, isLoading, refetch } = useSubscriptionStatus(user?.user_id || '');
  
  // Use React Query data instead of manual fetch
  const plan = subscriptionData ? normalizePlan(subscriptionData) : FREE_PLAN;
  
  // ... rest of context logic
};
```

#### Step 7: Refactor RouteWrappers
**File:** `src/components/RouteWrappers.tsx`
```typescript
import { useMoods } from '../hooks/queries/useMoods';

export const DailyInsightsWrapper: React.FC = () => {
  const { user } = useAuth();
  const { data: moodData, isLoading, error } = useMoods(getUserId(user));
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;
  
  return <DailyInsights userId={getUserId(user)} moodData={moodData || []} />;
};
```

#### Step 8: Remove Manual Caching
**Delete from:**
- `src/hooks/useDashboardData.ts` - Remove `dashboardCache` object
- `src/contexts/SubscriptionContext.tsx` - Remove localStorage caching logic
- `src/components/RouteWrappers.tsx` - Remove inline `useEffect` fetches

#### Step 9: Add React Query DevTools (Development Only)
**File:** `src/main.tsx`
```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// In QueryProvider:
<QueryClientProvider client={queryClient}>
  {children}
  {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
</QueryClientProvider>
```

#### Step 10: Update Tests
- Mock React Query in test files
- Update component tests to use mocked query hooks
- Verify cache behavior in integration tests

### Side Effects & Mitigations

| Side Effect | Mitigation |
|-------------|------------|
| Breaking changes in data fetching | Phase migration, feature flag |
| Cache invalidation differences | Test thoroughly in staging |
| Bundle size increase | ~12KB gzipped (acceptable) |
| Learning curve for team | Document patterns, provide training |

### Security Considerations
- React Query caches data in memory (no security issue)
- Ensure sensitive data is not cached longer than necessary
- Verify no PII in query keys
- Clear cache on logout

### Completeness Checklist
- [ ] React Query installed
- [ ] QueryProvider created and added to App
- [ ] All API calls converted to query hooks
- [ ] Manual caching removed
- [ ] Cache invalidation tested
- [ ] DevTools added (dev only)
- [ ] All tests updated
- [ ] Documentation updated
- [ ] Team training completed

---

## Fix #4: Move Usage Limits to Backend

### Current State
- Client-side usage limits stored in `localStorage`
- Key: `lugn_trygg_daily_usage_${userId}`
- User can clear storage to reset limits
- No server-side verification

### Target State
- Backend tracks authoritative usage limits
- Client-side counters are UX hints only
- Server validates all limit requests
- Backend enforces limits on all API endpoints

### Implementation Steps

#### Step 1: Backend - Add Usage Tracking
**File:** `Backend/src/models/user_usage.py` (create new)
```python
from datetime import date, datetime
from sqlalchemy import Column, String, Integer, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base

class UserUsage(Base):
    __tablename__ = 'user_usage'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False, unique=True)
    date = Column(Date, nullable=False, default=date.today)
    mood_logs = Column(Integer, default=0)
    chat_messages = Column(Integer, default=0)
    last_updated = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="usage")
```

**File:** `Backend/src/models/user.py` (update)
```python
# Add relationship
usage = relationship("UserUsage", back_populates="user", uselist=False)
```

#### Step 2: Backend - Add Usage Endpoints
**File:** `Backend/src/routes/usage_routes.py` (create new)
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user_usage import UserUsage
from ..models.user import User
from ..auth import get_current_user

router = APIRouter(prefix="/api/usage", tags=["usage"])

@router.get("/status")
async def get_usage_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current usage and limits for the user."""
    usage = db.query(UserUsage).filter(
        UserUsage.user_id == current_user.id,
        UserUsage.date == date.today()
    ).first()
    
    if not usage:
        usage = UserUsage(user_id=current_user.id, date=date.today())
        db.add(usage)
        db.commit()
    
    # Get user's subscription limits
    limits = get_subscription_limits(current_user.subscription_tier)
    
    return {
        "mood_logs": usage.mood_logs,
        "chat_messages": usage.chat_messages,
        "limits": limits,
        "date": usage.date.isoformat()
    }

@router.post("/increment/mood")
async def increment_mood_log(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Increment mood log count (called after successful mood save)."""
    usage = db.query(UserUsage).filter(
        UserUsage.user_id == current_user.id,
        UserUsage.date == date.today()
    ).first()
    
    if not usage:
        usage = UserUsage(user_id=current_user.id, date=date.today())
        db.add(usage)
    
    # Check limit
    limits = get_subscription_limits(current_user.subscription_tier)
    if limits['mood_logs_per_day'] != -1 and usage.mood_logs >= limits['mood_logs_per_day']:
        raise HTTPException(status_code=429, detail="Daily mood log limit reached")
    
    usage.mood_logs += 1
    usage.last_updated = datetime.utcnow()
    db.commit()
    
    return {"success": True, "mood_logs": usage.mood_logs}

@router.post("/increment/chat")
async def increment_chat_message(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Increment chat message count (called after successful chat message)."""
    usage = db.query(UserUsage).filter(
        UserUsage.user_id == current_user.id,
        UserUsage.date == date.today()
    ).first()
    
    if not usage:
        usage = UserUsage(user_id=current_user.id, date=date.today())
        db.add(usage)
    
    # Check limit
    limits = get_subscription_limits(current_user.subscription_tier)
    if limits['chat_messages_per_day'] != -1 and usage.chat_messages >= limits['chat_messages_per_day']:
        raise HTTPException(status_code=429, detail="Daily chat message limit reached")
    
    usage.chat_messages += 1
    usage.last_updated = datetime.utcnow()
    db.commit()
    
    return {"success": True, "chat_messages": usage.chat_messages}
```

#### Step 3: Backend - Add Middleware for Limit Enforcement
**File:** `Backend/src/middleware/usage_middleware.py` (create new)
```python
from fastapi import Request, HTTPException
from ..database import get_db
from ..models.user_usage import UserUsage
from datetime import date

async def check_usage_limit(request: Request, call_next):
    """Middleware to check usage limits before protected endpoints."""
    # Skip for auth endpoints
    if request.url.path.startswith("/api/auth"):
        return await call_next(request)
    
    # Get user from token (implement based on your auth)
    user = await get_current_user_from_request(request)
    if not user:
        return await call_next(request)
    
    db = next(get_db())
    usage = db.query(UserUsage).filter(
        UserUsage.user_id == user.id,
        UserUsage.date == date.today()
    ).first()
    
    if usage:
        limits = get_subscription_limits(user.subscription_tier)
        
        # Check mood log limit
        if request.url.path.startswith("/api/mood") and request.method == "POST":
            if limits['mood_logs_per_day'] != -1 and usage.mood_logs >= limits['mood_logs_per_day']:
                raise HTTPException(status_code=429, detail="Daily mood log limit reached")
        
        # Check chat message limit
        if request.url.path.startswith("/api/chat") and request.method == "POST":
            if limits['chat_messages_per_day'] != -1 and usage.chat_messages >= limits['chat_messages_per_day']:
                raise HTTPException(status_code=429, detail="Daily chat message limit reached")
    
    return await call_next(request)
```

#### Step 4: Backend - Register Routes and Middleware
**File:** `Backend/src/main.py` (update)
```python
from .routes.usage_routes import router as usage_router
from .middleware.usage_middleware import check_usage_limit

app.include_router(usage_router)
app.middleware("http")(check_usage_limit)
```

#### Step 5: Frontend - Update SubscriptionContext
**File:** `src/contexts/SubscriptionContext.tsx`
```typescript
// Remove localStorage usage tracking
// Fetch from backend API instead

const fetchUsage = useCallback(async () => {
  if (!user?.user_id) {
    setUsage(DEFAULT_USAGE);
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/usage/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await response.json();
    
    setUsage({
      moodLogs: data.mood_logs,
      chatMessages: data.chat_messages,
      lastResetDate: data.date,
    });
  } catch (error) {
    logger.error('Failed to fetch usage:', error);
  }
}, [user?.user_id, token]);
```

#### Step 6: Frontend - Update API Calls to Increment Usage
**File:** `src/api/mood.ts` (update)
```typescript
export const logMood = async (userId: string, moodData: MoodData) => {
  const response = await api.post('/api/mood', { userId, ...moodData });
  
  // Increment usage count
  await api.post('/api/usage/increment/mood');
  
  return response.data;
};
```

**File:** `src/api/chat.ts` (update)
```typescript
export const sendMessage = async (userId: string, message: string) => {
  const response = await api.post('/api/chat/message', { userId, message });
  
  // Increment usage count
  await api.post('/api/usage/increment/chat');
  
  return response.data;
};
```

#### Step 7: Frontend - Handle 429 Errors
**File:** `src/api/client.ts` (update)
```typescript
// Add interceptor for 429 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      // Show user-friendly message
      const message = error.response.data.detail || 'Daily limit reached';
      // Use toast or alert to inform user
      alert(message);
    }
    return Promise.reject(error);
  }
);
```

#### Step 8: Database Migration
**File:** `Backend/alembic/versions/xxxx_add_user_usage.py` (create new migration)
```python
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table(
        'user_usage',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('mood_logs', sa.Integer(), default=0),
        sa.Column('chat_messages', sa.Integer(), default=0),
        sa.Column('last_updated', sa.DateTime(), default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.UniqueConstraint('user_id', 'date')
    )

def downgrade():
    op.drop_table('user_usage')
```

#### Step 9: Testing
- Test limit enforcement on backend
- Test 429 error handling on frontend
- Test usage count increments
- Test daily reset (mock date change)

### Side Effects & Mitigations

| Side Effect | Mitigation |
|-------------|------------|
| Database schema change | Run migration in maintenance window |
| Breaking change for existing users | Seed existing usage from logs |
| API latency increase | Cache usage status in Redis |
| 429 errors in production | Graceful degradation, clear messaging |

### Security Considerations
- Server-side enforcement prevents bypass
- Rate limiting prevents abuse
- Audit trail for usage
- No PII in usage data

### Completeness Checklist
- [ ] Backend model created
- [ ] Backend routes implemented
- [ ] Middleware added
- [ ] Database migration run
- [ ] Frontend updated to use backend
- [ ] 429 error handling added
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Production deployment verified

---

## Fix #5: Audit Large Components

### Current State
Components >25KB requiring review:
- `MoodAnalytics.tsx` (63 KB)
- `ProfileHub.tsx` (41 KB)
- `VoiceChat.tsx` (37 KB)
- `WorldClassDashboard.tsx` (34 KB)
- `WellnessHub.tsx` (34 KB)
- `MemoryJournal.tsx` (34 KB)
- `PeerSupportChat.tsx` (32 KB)
- `MoodList.tsx` (32 KB)
- `WorldClassAnalytics.tsx` (28 KB)
- `OAuthHealthIntegrations.tsx` (27 KB)
- `RewardsHub.tsx` (26 KB)
- `SuperMoodLogger.tsx` (26 KB)
- `WorldClassAIChat.tsx` (26 KB)
- `AIMusicGenerator.tsx` (25 KB)

### Target State
All components <20KB (ideally <10KB)

### Implementation Steps

#### Step 1: Component Size Analysis
For each component >25KB:
1. Count lines of code
2. Identify distinct features
3. Map state to features
4. Identify shared vs. feature-specific logic

#### Step 2: Prioritization
Priority order based on:
1. Bundle impact (imported by many routes)
2. Complexity (mixing concerns)
3. Maintenance burden

**High Priority:**
- `WorldClassDashboard.tsx` (imported by main route)
- `SuperMoodLogger.tsx` (imported by multiple routes)
- `VoiceChat.tsx` (complex state management)

**Medium Priority:**
- `MoodAnalytics.tsx`
- `ProfileHub.tsx`
- `WellnessHub.tsx`

**Low Priority:**
- Components imported by single route
- Components with clear single responsibility

#### Step 3: Decomposition Pattern
For each component, apply this pattern:

```
src/components/[ComponentName]/
├── index.tsx              # Main orchestrator (max 200 lines)
├── hooks/
│   ├── use[Feature1].ts   # Feature 1 logic
│   ├── use[Feature2].ts   # Feature 2 logic
│   └── useShared.ts       # Shared logic
├── [Feature1].tsx         # Feature 1 UI
├── [Feature2].tsx         # Feature 2 UI
├── types.ts               # Shared types
└── constants.ts           # Shared constants
```

#### Step 4: Example - SuperMoodLogger Decomposition
**Current:** 686 lines

**Target Structure:**
```
src/components/SuperMoodLogger/
├── index.tsx              # Main orchestrator (150 lines)
├── hooks/
│   ├── useCircumplex.ts   # Valence/arousal logic
│   ├── useTags.ts         # Tag selection logic
│   ├── useVoiceRecording.ts # Voice recording logic
│   └── useRecentMoods.ts  # Recent moods fetch
├── CircumplexSliders.tsx  # Already exists
├── TagSelector.tsx        # Already exists
├── VoiceRecorder.tsx      # Extract from main
├── RecentMoods.tsx        # Extract from main
├── types.ts               # Shared types
└── constants.ts           # Shared constants
```

#### Step 5: Example - WorldClassDashboard Decomposition
**Current:** 34 KB

**Target Structure:**
```
src/components/WorldClassDashboard/
├── index.tsx              # Main orchestrator (200 lines)
├── hooks/
│   ├── useDashboardData.ts # Already exists
│   └── useQuickActions.ts # Quick actions logic
├── DashboardHeader.tsx    # Already exists
├── DashboardStats.tsx      # Already exists
├── DashboardActivity.tsx  # Already exists
├── DashboardQuickActions.tsx # Already exists
└── types.ts               # Shared types
```

#### Step 6: Iterative Refactoring
For each component:
1. Create directory structure
2. Extract types
3. Extract constants
4. Extract hooks
5. Extract UI components
6. Update main orchestrator
7. Update imports
8. Update tests
9. Verify bundle size

#### Step 7: Bundle Size Verification
After each component refactor:
```bash
npm run build:analyze
```
- Verify no bundle size regression
- Confirm code splitting is working
- Check lazy loading is effective

### Side Effects & Mitigations

| Side Effect | Mitigation |
|-------------|------------|
| Breaking import changes | Update all imports in single PR |
| Test failures | Update all test files in same PR |
| Bundle regression | Run bundle analysis after each change |
| State management complexity | Use React Context for shared state |

### Security Considerations
- No security impact (pure refactoring)
- Verify no API calls are duplicated
- Ensure all error handling is preserved

### Completeness Checklist
- [ ] All components >25KB identified
- [ ] Prioritization completed
- [ ] High-priority components refactored
- [ ] Medium-priority components refactored
- [ ] Low-priority components refactored
- [ ] All imports updated
- [ ] All tests updated
- [ ] Bundle size verified
- [ ] No regressions

---

## Risk Assessment & Mitigation

### Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking changes in production | Medium | High | Feature flags, phased rollout |
| Bundle size regression | Low | Medium | Bundle analysis before/after |
| Test failures | Medium | Medium | Update tests in same PR |
| Performance regression | Low | Medium | Performance testing |
| Security vulnerabilities | Low | High | Security audit, penetration testing |
| Data loss during migration | Low | Critical | Database backups, rollback plan |

### Rollback Plan
For each fix, define rollback procedure:
1. Database migrations: Downgrade script ready
2. Code changes: Git revert procedure documented
3. Configuration changes: Previous version saved
4. API changes: Version endpoints

### Monitoring
- Error tracking (Sentry)
- Performance monitoring (Vercel Speed Insights)
- Bundle size tracking (CI/CD)
- User feedback (in-app feedback)

---

## Testing Strategy

### Unit Tests
- All new hooks: 100% coverage
- All new components: 80%+ coverage
- All API query hooks: 100% coverage

### Integration Tests
- Auth flows (login, register, logout)
- Subscription flow (upgrade, downgrade)
- Usage limit enforcement
- Cache invalidation

### E2E Tests
- Critical user journeys
- Cross-browser testing
- Mobile responsiveness

### Performance Tests
- Bundle size analysis
- Lighthouse scores
- Load testing

### Security Tests
- Penetration testing
- Dependency scanning
- Secret scanning

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Code review completed
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Rollback plan documented
- [ ] Stakeholders notified

### Deployment
- [ ] Database migrations run
- [ ] Backend deployed
- [ ] Frontend deployed
- [ ] Cache cleared
- [ ] Monitoring enabled

### Post-Deployment
- [ ] Smoke tests passed
- [ ] Error rates normal
- [ ] Performance normal
- [ ] User feedback collected
- [ ] Incident response ready

---

## Timeline

### Week 1
- Fix #2: PasswordInput component (1-2 days)
- Fix #4: Move usage limits to backend (3-4 days)

### Week 2
- Fix #3: Implement React Query (3-4 days)
- Fix #5: Audit large components - high priority (1-2 days)

### Week 3
- Fix #1: Split Recommendations.tsx (4-5 days)

### Week 4
- Fix #5: Audit large components - medium/low priority (3-4 days)
- Testing and documentation (1-2 days)

---

## Success Criteria

### Technical
- All components <20KB (except where justified)
- Zero duplicate code for password inputs
- React Query handling all server state
- Usage limits enforced server-side
- No bundle size regression
- All tests passing

### Business
- Improved maintainability
- Faster development velocity
- Better user experience (no limit bypass)
- Reduced technical debt

### Security
- Server-side limit enforcement
- No localStorage security bypass
- Audit trail for usage
- No new vulnerabilities

---

## Appendix

### A. File Structure Changes
```
src/
├── components/
│   ├── Recommendations/           # NEW
│   │   ├── index.tsx
│   │   ├── hooks/
│   │   ├── BreathingExercise.tsx
│   │   ├── PMRExercise.tsx
│   │   ├── MeditationSession.tsx
│   │   ├── CBTExercise.tsx
│   │   ├── JournalingPrompt.tsx
│   │   ├── MoodAnalytics.tsx
│   │   ├── types.ts
│   │   └── constants.ts
│   ├── ui/
│   │   └── tailwind/
│   │       └── PasswordInput.tsx  # NEW
│   ├── SuperMoodLogger/           # RESTRUCTURED
│   │   ├── index.tsx
│   │   ├── hooks/
│   │   ├── CircumplexSliders.tsx
│   │   ├── TagSelector.tsx
│   │   ├── VoiceRecorder.tsx
│   │   ├── RecentMoods.tsx
│   │   ├── types.ts
│   │   └── constants.ts
│   └── WorldClassDashboard/       # RESTRUCTURED
│       ├── index.tsx
│       ├── hooks/
│       ├── DashboardHeader.tsx
│       ├── DashboardStats.tsx
│       ├── DashboardActivity.tsx
│       ├── DashboardQuickActions.tsx
│       └── types.ts
├── contexts/
│   └── QueryContext.tsx           # NEW
├── hooks/
│   └── queries/                   # NEW
│       ├── useDashboardSummary.ts
│       ├── useSubscriptionStatus.ts
│       ├── useMoods.ts
│       └── ...
└── ...

Backend/
├── src/
│   ├── models/
│   │   └── user_usage.py          # NEW
│   ├── routes/
│   │   └── usage_routes.py        # NEW
│   └── middleware/
│       └── usage_middleware.py    # NEW
└── alembic/
    └── versions/
        └── xxxx_add_user_usage.py # NEW
```

### B. Dependencies to Add
```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.0.0"
  },
  "devDependencies": {
    "@tanstack/react-query-devtools": "^5.0.0"
  }
}
```

### C. Translation Keys to Add
```json
{
  "common": {
    "showPassword": "Visa lösenord",
    "hidePassword": "Dölj lösenord",
    "dailyLimitReached": "Daglig gräns nådd",
    "upgradeToPremium": "Uppgradera till Premium"
  }
}
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-02  
**Review Status:** Pending Full-Stack Review
