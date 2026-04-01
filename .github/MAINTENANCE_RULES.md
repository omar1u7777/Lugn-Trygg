# Maintenance Rules for Lugn & Trygg

## 🚨 CRITICAL RULES

### Mood Tracking System

**RULE #1: SuperMoodLogger is the ONLY mood tracking component**

```
All mood-related tracking must strictly use SuperMoodLogger.tsx.
DO NOT create new logger components under any circumstances.
```

**Location**: `src/components/SuperMoodLogger.tsx`

**If new features are needed**, follow this process:

1. **Extend the interface**:
```tsx
interface SuperMoodLoggerProps {
  onMoodLogged?: (mood?: number, note?: string) => void;
  showRecentMoods?: boolean;
  enableVoiceRecording?: boolean;
  // NEW: Add your feature prop here
  enableBioDataIntegration?: boolean;
}
```

2. **Implement within SuperMoodLogger**:
```tsx
export const SuperMoodLogger: React.FC<SuperMoodLoggerProps> = ({
  onMoodLogged,
  showRecentMoods = true,
  enableVoiceRecording = false,
  enableBioDataIntegration = false, // NEW
}) => {
  // Use conditional rendering
  {enableBioDataIntegration && (
    <BioDataPanel />
  )}
};
```

3. **Use sub-modules for complex features**:
```tsx
// src/components/mood/BioDataPanel.tsx
export const BioDataPanel: React.FC = () => {
  // Complex bio-data logic here
};

// Import in SuperMoodLogger
import { BioDataPanel } from './mood/BioDataPanel';
```

**Why this rule exists**:
- ✅ Single source of truth
- ✅ Consistent UX across app
- ✅ Reduced maintenance burden (-75% code)
- ✅ No fragmentation of mood logging logic
- ✅ Easier testing and debugging

**Deprecated components (DO NOT USE)**:
- ❌ `MoodLogger.tsx` (removed)
- ❌ `WorldClassMoodLogger.tsx` (removed)
- ❌ `AdvancedMoodLogger.tsx` (removed)
- ❌ `EnhancedMoodLogger.tsx` (removed)

**Current SuperMoodLogger features**:
- Circumplex Model (Valence + Arousal)
- Tag System (12 predefined + custom)
- Recent moods display (grouped by day)
- Voice recording (optional)
- Reflection prompts (dynamic)
- Duplicate detection (5 min cooldown)
- Advanced options toggle
- Context input
- Note input (1000 chars)

---

## 📋 Other Maintenance Rules

### Code Organization
- Keep components modular and reusable
- Use TypeScript for all new code
- Follow existing naming conventions
- Document complex logic with comments

### Testing
- Write tests for new features
- Update existing tests when modifying components
- Maintain >80% code coverage

### Performance
- Lazy load heavy components
- Optimize bundle size
- Use React.memo for expensive renders
- Avoid unnecessary re-renders

### Accessibility
- WCAG 2.1 AA compliance
- Screen reader support
- Keyboard navigation
- Proper ARIA labels

---

**Last Updated**: 2026-04-01  
**Version**: 1.0.0
