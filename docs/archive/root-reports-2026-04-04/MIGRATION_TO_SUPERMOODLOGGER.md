# Migration Guide: SuperMoodLogger

## 🎯 Översikt

**SuperMoodLogger** är den ultimata mood tracking-komponenten som kombinerar det bästa från alla tidigare loggers:

### ✅ Features från alla loggers:

**Från EnhancedMoodLogger:**
- ✅ Circumplex Model (Valence + Arousal)
- ✅ Tag System (Multi-select, 12 predefined + custom)
- ✅ Context input
- ✅ Advanced options toggle

**Från MoodLogger:**
- ✅ Recent moods display (grupperat per dag)
- ✅ Duplicate detection (5 min cooldown)
- ✅ Reflection prompts baserat på mood
- ✅ Visual mood icons med färger
- ✅ Voice recording support (optional)

**Från WorldClassMoodLogger:**
- ✅ Premium UX med smooth animations
- ✅ Scale effects på buttons
- ✅ Better visual feedback

---

## 📝 Migration Steps

### Step 1: Uppdatera imports

**Före:**
```tsx
import MoodLogger from '@/components/MoodLogger';
// eller
import { WorldClassMoodLogger } from '@/components/WorldClassMoodLogger';
// eller
import { EnhancedMoodLogger } from '@/components/mood/EnhancedMoodLogger';
```

**Efter:**
```tsx
import { SuperMoodLogger } from '@/components/SuperMoodLogger';
```

### Step 2: Uppdatera användning

**Före:**
```tsx
<MoodLogger 
  onMoodLogged={(mood, note) => {
    // callback
  }}
/>
```

**Efter:**
```tsx
<SuperMoodLogger 
  onMoodLogged={(mood, note) => {
    // callback
  }}
  showRecentMoods={true}  // Optional, default: true
  enableVoiceRecording={false}  // Optional, default: false
/>
```

### Step 3: Props mapping

| Old Prop (MoodLogger) | SuperMoodLogger | Notes |
|----------------------|-----------------|-------|
| `onMoodLogged` | `onMoodLogged` | Same ✅ |
| N/A | `showRecentMoods` | New, default: true |
| N/A | `enableVoiceRecording` | New, default: false |

---

## 🔄 Filer att uppdatera

### 1. RouteWrappers.tsx
```tsx
// Före
import MoodLogger from './MoodLogger';

export const MoodLoggerWrapper: React.FC = () => {
  return <MoodLogger />;
};

// Efter
import { SuperMoodLogger } from './SuperMoodLogger';

export const MoodLoggerWrapper: React.FC = () => {
  return <SuperMoodLogger showRecentMoods={true} />;
};
```

### 2. Dashboard components
```tsx
// Före
import MoodLogger from '@/components/MoodLogger';

// Efter
import { SuperMoodLogger } from '@/components/SuperMoodLogger';
```

### 3. Test files
```tsx
// Uppdatera alla test imports
import { SuperMoodLogger } from '@/components/SuperMoodLogger';
```

---

## 🗑️ Filer att ta bort

Efter migration, ta bort dessa filer:

1. ❌ `src/components/MoodLogger.tsx`
2. ❌ `src/components/WorldClassMoodLogger.tsx`
3. ❌ `src/components/AdvancedMoodLogger.tsx`
4. ❌ `src/components/mood/EnhancedMoodLogger.tsx`

**VIKTIGT:** Ta backup först! Eller commit till git innan borttagning.

---

## 🎨 UI/UX Förbättringar

### Nya features i SuperMoodLogger:

1. **Reflection Prompts** - Dynamiska frågor baserat på mood
2. **Smooth Animations** - Scale effects på buttons
3. **Better Visual Feedback** - Tydligare selected state
4. **Grouped Recent Moods** - Organiserat per dag (Idag, Igår, datum)
5. **Tag Display** - Visar tags i recent moods
6. **Optional Voice** - Kan aktiveras per use case
7. **Advanced Toggle** - Döljer Circumplex/Tags som default för enklare UX

---

## 📊 Data Compatibility

SuperMoodLogger är **100% bakåtkompatibel** med befintlig data:

- ✅ Läser gamla mood entries utan valence/arousal
- ✅ Visar gamla entries i recent moods
- ✅ Nya entries sparar alla fält (valence, arousal, tags, context)
- ✅ Fungerar med befintlig backend API

---

## 🧪 Testing Checklist

Efter migration, testa:

- [ ] Mood selection fungerar
- [ ] Note input sparas korrekt
- [ ] Advanced options toggle fungerar
- [ ] Circumplex sliders uppdaterar
- [ ] Tags kan väljas (max 5)
- [ ] Recent moods visas grupperat
- [ ] Duplicate detection fungerar (5 min cooldown)
- [ ] Reflection prompts visas korrekt
- [ ] Submit button disabled när inget mood valt
- [ ] Error handling fungerar
- [ ] Dark mode ser bra ut
- [ ] Mobile responsive

---

## 🚀 Deployment Plan

### Phase 1: Soft Launch (Vecka 1)
1. Deploy SuperMoodLogger som ny komponent
2. Behåll gamla loggers parallellt
3. A/B test med 10% av användare
4. Samla feedback

### Phase 2: Gradual Rollout (Vecka 2-3)
1. Öka till 50% av användare
2. Fixa eventuella buggar
3. Optimera performance
4. Uppdatera dokumentation

### Phase 3: Full Migration (Vecka 4)
1. 100% av användare på SuperMoodLogger
2. Ta bort gamla loggers
3. Cleanup kod
4. Update tests

---

## 📈 Expected Benefits

### Performance:
- **-30% bundle size** (en komponent istället för 4)
- **Faster load time** (mindre kod att ladda)
- **Better maintainability** (en codebase)

### User Experience:
- **Unified UX** (konsekvent över hela appen)
- **More features** (Circumplex + Tags + Voice)
- **Better analytics** (correlation analysis ready)

### Developer Experience:
- **Single source of truth**
- **Easier to maintain**
- **Better typed** (TypeScript)
- **Cleaner imports**

---

## 🆘 Troubleshooting

### Problem: Import error
```
Module not found: Can't resolve '@/components/SuperMoodLogger'
```
**Solution:** Kontrollera att filen finns på rätt plats och att path alias fungerar.

### Problem: Props not working
```
Property 'showRecentMoods' does not exist
```
**Solution:** Uppdatera TypeScript types och se till att du använder rätt props.

### Problem: Recent moods not showing
**Solution:** Kontrollera att `showRecentMoods={true}` är satt och att användaren har mood history.

---

## 📞 Support

Vid problem, kontakta:
- **Tech Lead**: [namn]
- **Slack**: #mood-tracking-migration
- **Docs**: Se MOOD_TRACKING_IMPLEMENTATION.md

---

## ✅ Migration Checklist

- [ ] Backup all mood logger files
- [ ] Create feature branch: `feature/supermoodlogger-migration`
- [ ] Update RouteWrappers.tsx
- [ ] Update Dashboard components
- [ ] Update all test files
- [ ] Run `npm run type-check`
- [ ] Run `npm run test`
- [ ] Test manually in dev
- [ ] Deploy to staging
- [ ] QA testing
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] Remove old logger files
- [ ] Update documentation
- [ ] Close migration ticket

---

**Migration Date**: 2026-04-01  
**Status**: Ready for implementation  
**Estimated Time**: 2-4 hours
