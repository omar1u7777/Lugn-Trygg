# 🎨 Design System Migration Guide
**Lugn & Trygg - Design Token System**

## 📋 Overview

This guide helps migrate components from hardcoded styles to the centralized design token system.

## ⚠️ Why This Matters

**Before Migration:**
- ❌ Hardcoded colors: `#1abc9c`, `rgba(255,255,255,0.8)`
- ❌ Magic numbers: `padding: 32`, `fontSize: '1.5rem'`
- ❌ Inconsistent spacing: `p: 4`, `p: 3`, `p: 32px`
- ❌ Duplicate gradients across files

**After Migration:**
- ✅ Centralized tokens: `colors.primary.main`, `spacing.xl`
- ✅ Type-safe imports
- ✅ Easy theme switching (light/dark)
- ✅ Consistent design language

---

## 🚀 Migration Steps

### Step 1: Import Tokens

```typescript
// ❌ Before
import { Box, Typography } from '@mui/material';

// ✅ After
import { Box, Typography } from '@mui/material';
import { colors, spacing, typography, shadows } from '@/theme/tokens';
```

### Step 2: Replace Hardcoded Colors

```typescript
// ❌ Before
<Box sx={{ color: '#1abc9c' }}>

// ✅ After
<Box sx={{ color: colors.primary.main }}>
```

```typescript
// ❌ Before
<Box sx={{ background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%)' }}>

// ✅ After
<Box sx={{ background: colors.background.gradient }}>
```

```typescript
// ❌ Before
<Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>

// ✅ After
<Typography sx={{ color: colors.overlay.medium }}>
```

### Step 3: Replace Hardcoded Spacing

```typescript
// ❌ Before
<Box sx={{ p: 4, mb: 3, gap: 2 }}>

// ✅ After
<Box sx={{ p: spacing.xl, mb: spacing.lg, gap: spacing.md }}>
```

### Step 4: Replace Mood Colors

```typescript
// ❌ Before
const getMoodColor = (mood: string) => {
  const colors = {
    glad: '#4caf50',
    ledsen: '#ff9800',
    // ... 20+ hardcoded colors
  };
  return colors[mood] || '#9e9e9e';
};

// ✅ After
import { getMoodColor } from '@/theme/tokens';
const color = getMoodColor(mood); // Centralized logic
```

### Step 5: Replace Shadows

```typescript
// ❌ Before
<Card sx={{ boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}>

// ✅ After
<Card sx={{ boxShadow: shadows.xl }}>
```

---

## 📊 Migration Checklist

### Priority 1: High-Traffic Components ⚡

- [x] `src/theme/tokens.ts` - Create design token system
- [ ] `src/components/WorldClassMoodLogger.tsx` - 50+ hardcoded colors
- [ ] `src/components/WorldClassGamification.tsx` - Gradient + overlays
- [ ] `src/components/WorldClassDashboard.tsx` - Multiple gradients
- [ ] `src/components/WorldClassAnalytics.tsx` - Chart colors
- [ ] `src/components/WorldClassAIChat.tsx` - Background gradient

### Priority 2: Shared Components 🔄

- [ ] `src/components/WeeklyAnalysis.tsx` - 12 mood colors
- [ ] `src/components/Referral/ReferralProgram.tsx` - Gradient card
- [ ] `src/components/Dashboard/Dashboard.tsx` - Layout spacing
- [ ] `src/components/Layout/NavigationPro.tsx` - Navigation styles

### Priority 3: Utility Components 🛠️

- [ ] All components in `src/components/` directory
- [ ] Update `sx` props to use tokens
- [ ] Remove inline style objects
- [ ] Replace magic numbers

---

## 🔍 Search & Replace Patterns

### Find Hardcoded Colors

```bash
# Find all hex colors
grep -rn "#[0-9a-fA-F]\{3,6\}" src/components/

# Find rgba colors
grep -rn "rgba(" src/components/

# Find rgb colors
grep -rn "rgb(" src/components/
```

### Common Replacements

| Before | After |
|--------|-------|
| `#1abc9c` | `colors.primary.main` |
| `#3498db` | `colors.secondary.main` |
| `#9b59b6` | `colors.tertiary.main` |
| `#ffffff` | `colors.text.inverse` |
| `rgba(255,255,255,0.2)` | `colors.overlay.medium` |
| `p: 4` | `p: spacing.xl` |
| `borderRadius: 16` | `borderRadius: borderRadius.card` |

---

## 📝 Code Examples

### Example 1: Mood Logger Component

```typescript
// ❌ Before
const MOOD_COLORS = {
  ecstatic: { emoji: '🤩', color: '#10b981', label: 'Extatisk' },
  happy: { emoji: '😊', color: '#059669', label: 'Glad' },
  content: { emoji: '😌', color: '#0d9488', label: 'Nöjd' },
  // ... more hardcoded
};

// ✅ After
import { colors } from '@/theme/tokens';

const MOOD_COLORS = {
  ecstatic: { emoji: '🤩', color: colors.mood.ecstatic, label: 'Extatisk' },
  happy: { emoji: '😊', color: colors.mood.happy, label: 'Glad' },
  content: { emoji: '😌', color: colors.mood.content, label: 'Nöjd' },
};
```

### Example 2: Card Component

```typescript
// ❌ Before
<Card sx={{
  background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%)',
  padding: '32px',
  borderRadius: '16px',
  boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
}}>

// ✅ After
<Card sx={{
  background: colors.background.gradient,
  p: spacing.cardPadding,
  borderRadius: borderRadius.card,
  boxShadow: shadows.card,
}}>
```

### Example 3: Typography

```typescript
// ❌ Before
<Typography variant="h5" sx={{ 
  color: 'white', 
  fontWeight: 'bold',
  marginBottom: '24px'
}}>

// ✅ After
<Typography variant="h5" sx={{ 
  color: colors.text.inverse, 
  fontWeight: typography.fontWeight.bold,
  mb: spacing.lg
}}>
```

---

## 🎯 Quality Metrics

### Success Criteria

- ✅ **0 hardcoded colors** in component files
- ✅ **0 magic numbers** for spacing/sizing
- ✅ **All components** use design tokens
- ✅ **Type-safe** token imports
- ✅ **Consistent** design language

### Before/After Metrics

**Before:**
- 200+ hardcoded colors across codebase
- 50+ different spacing values
- 15+ gradient definitions
- No single source of truth

**Target After:**
- 0 hardcoded colors (100% tokens)
- 7 spacing values (xs to xxxl)
- 1 gradient system (createGradient helper)
- tokens.ts as SSOT

---

## 🔧 Tools & Scripts

### Auto-Migration Script (TODO)

```bash
npm run migrate:design-tokens
```

This script will:
1. Find all hardcoded colors
2. Replace with token references
3. Update imports
4. Generate migration report

### Validation Script

```bash
npm run validate:design-tokens
```

Checks for:
- Hardcoded colors still present
- Missing token imports
- Inconsistent spacing usage

---

## 📚 Resources

- **Design Tokens:** `src/theme/tokens.ts`
- **Theme Config:** `src/theme/theme.ts`
- **MUI Theme:** https://mui.com/material-ui/customization/theming/
- **Design System Examples:** https://mui.com/design-kits/

---

## 🚨 Breaking Changes

None! This is a backwards-compatible migration. Old code will continue working.

---

## ✅ Migration Status

**Overall Progress: 5%**

- ✅ Design token system created (tokens.ts)
- ⏳ Component migration in progress
- ⏳ Documentation updates needed
- ⏳ Auto-migration scripts pending

**Next Steps:**
1. Migrate WorldClassMoodLogger.tsx (highest priority)
2. Migrate WorldClassGamification.tsx
3. Update remaining components
4. Create auto-migration script
5. Run validation checks

---

**Last Updated:** 2025-11-10  
**Author:** GitHub Copilot  
**Status:** 🚧 In Progress
