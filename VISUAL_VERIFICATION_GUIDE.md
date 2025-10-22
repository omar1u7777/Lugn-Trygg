# 👀 Visuell Verifieringsguide - Integration System

## 🎯 Quick Visual Checks

### ✅ CHECKPOINT 1: Dashboard Widget
**URL:** http://localhost:3000/dashboard

**Förväntat utseende:**
```
┌─────────────────────────────────────────────┐
│ ❤️ Hälsointegrationer      Visa alla →    │
├─────────────────────────────────────────────┤
│                                              │
│          2 av 4 anslutna                    │
│                                              │
│    🏃 💪 📱 ⚖️  (ikoner i rad)              │
│                                              │
├─────────────────────────────────────────────┤
│  Senaste synkronisering                     │
│  2 tim sedan                                │
├─────────────────────────────────────────────┤
│  Integrationsnivå              50%          │
│  [████████████░░░░░░░░░░░░░]               │
├─────────────────────────────────────────────┤
│        🔄 Synkronisera nu                   │
└─────────────────────────────────────────────┘
```

**Färger:**
- Bakgrund: Röd-rosa gradient (`from-red-50 to-pink-50`)
- Border: Röd (`border-red-200`)
- Knapp: Röd-rosa gradient (`from-red-600 to-pink-600`)
- Text: Mörkröd (`text-red-900`)

**Animations:**
- Widget ska fade-in smooth (opacity 0 → 1)
- Knapp hover → ljusare gradient
- Syncing spinner → roterande ⟳-ikon

---

### ✅ CHECKPOINT 2: Sync History Timeline
**URL:** http://localhost:3000/integrations (scrolla ner)

**Förväntat utseende:**
```
📜 Synkroniseringshistorik

[Dropdown: Alla enheter ▼] [Dropdown: Senaste 7 dagarna ▼]

│  ┌───────────────────────────────────────┐
│  │ ✅  🏃 Google Fit                     │
├──┤     jan 15, 2025, 10:30 (2 tim sedan)│
│  │     👣 Steg ❤️ Puls 😴 Sömn          │
│  │     📊 156 poster ⏱️ 2.3s            │
│  └───────────────────────────────────────┘
│
│  ┌───────────────────────────────────────┐
│  │ ✅  ⌚ Fitbit                         │
├──┤     jan 15, 2025, 07:30 (5 tim sedan)│
│  │     👣 Steg 🔥 Kalorier 📏 Distans   │
│  │     📊 89 poster ⏱️ 1.8s             │
│  └───────────────────────────────────────┘
│
│  ┌───────────────────────────────────────┐
│  │ ❌  💪 Samsung Health                │
├──┤     jan 14, 2025, 12:30 (1 dag sedan)│
│  │     👣 Steg                           │
│  │     ⚠️ Token expired                 │
│  └───────────────────────────────────────┘
```

**Färgkodning:**
- ✅ Success: Grön bakgrund (`bg-green-100`)
- ❌ Failed: Röd bakgrund (`bg-red-100`)
- ⚠️ Partial: Gul bakgrund (`bg-yellow-100`)

**Vertikalt timeline-streck:**
- Vänster sida, grå linje (`bg-slate-200`)
- Prickar vid varje entry

**Animations:**
- Entries fade-in staggered (delay: 0.05s per entry)
- Filter change → smooth transition

---

### ✅ CHECKPOINT 3: Health Data Charts
**URL:** http://localhost:3000/integrations (scrolla längre ner)

**Förväntat utseende:**
```
📊 Hälsodata visualisering

[📊 Alla] [👣 Steg] [❤️ Puls] [😴 Sömn] [🔥 Kalorier]

┌──────────────────────────────────────────────┐
│ 👣 Steg per dag                              │
├──────────────────────────────────────────────┤
│      10000 ─────────────────────────────────│
│       8000 ─────────────────────────────────│
│       6000 ─────────────────────────────────│
│       4000 ─────────────────────────────────│
│       2000 ─────────────────────────────────│
│          ▅ ▆ ▇ ▅ ▆ ▇ ▅                     │
│        15 16 17 18 19 20 21                 │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ ❤️ Genomsnittlig vilopuls                   │
├──────────────────────────────────────────────┤
│         90 ─────────────────────────────────│
│         80 ────────●────●────●──────────────│
│         70 ───●────────────────●────●───────│
│         60 ●─────────────────────────────●──│
│         50 ─────────────────────────────────│
│          15 16 17 18 19 20 21               │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ 😴 Sömn per natt                             │
├──────────────────────────────────────────────┤
│         10 ─────────────────────────────────│
│          8 ─────▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓─────────────│
│          6 ──▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓──────────│
│          4 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓────────│
│          2 ─────────────────────────────────│
│          15 16 17 18 19 20 21               │
└──────────────────────────────────────────────┘
```

**Diagram-specifikationer:**

1. **Steg per dag (BarChart):**
   - Blå staplar (`#3b82f6`)
   - Avrundade hörn (radius: 8)
   - Hover → tooltip med exakt antal steg

2. **Vilopuls (LineChart):**
   - Röd linje (`#ef4444`)
   - Strokewidth: 3
   - Punkter: röda cirklar (radius: 6)
   - Y-axis: 50-90 bpm fixed domain

3. **Sömn (AreaChart):**
   - Lila gradient (`#8b5cf6`)
   - Gradient från 80% opacity (top) till 10% (bottom)
   - Smooth fill under line

4. **Kalorier (AreaChart):**
   - Orange gradient (`#f97316`)
   - Samma gradient-stil som Sleep

**Filter-knappar:**
- Aktiv: `bg-red-600 text-white shadow-lg`
- Inaktiv: `bg-slate-100 hover:bg-slate-200`

**Tooltips:**
- Mörk bakgrund (`#1e293b`)
- Vit text
- Rundade hörn (8px)
- Visas on hover

---

## 🔍 Browser Console Checks

Öppna DevTools Console (F12) och verifiera:

### ✅ NO ERRORS:
```
✓ Inga röda error-meddelanden
✓ Inga "Failed to fetch" errors
✓ Inga "undefined is not a function" errors
```

### ✅ SUCCESSFUL LOGS:
```
✓ "✅ OAuth token found for GOOGLE_FIT"
✓ "✅ Real health data FETCHED from GOOGLE_FIT"
✓ "📊 Collected X health data points and Y mood entries"
```

### ⚠️ ACCEPTABLE WARNINGS:
```
⚠️ DeprecationWarning: util._extend (ignorera)
⚠️ React key warnings (om mockdata används)
```

---

## 🌐 Network Tab Verification

**Öppna DevTools Network tab och verifiera:**

### 1. OAuth Status Check:
```
GET /api/integration/oauth/google_fit/status
Status: 200 OK
Response: {"connected": true, "provider": "google_fit", ...}
```

### 2. Health Data Sync:
```
POST /api/integration/health/sync/google_fit
Status: 200 OK
Response: {"success": true, "provider": "google_fit", "data": {...}}
```

### 3. Auto-Sync Settings:
```
GET /api/integration/oauth/auto-sync/settings
Status: 200 OK
Response: {"success": true, "settings": {...}}
```

---

## 📱 Responsive Design Check

### Desktop (1920x1080):
- [ ] Widget tar ~1/3 av Dashboard width
- [ ] Charts är fullwidth med padding
- [ ] Timeline är centered med max-width

### Tablet (768x1024):
- [ ] Filter-knappar wrappar till flera rader
- [ ] Charts förblir responsive (ResponsiveContainer)
- [ ] Widget är fullwidth

### Mobile (375x667):
- [ ] Alla komponenter stackar vertikalt
- [ ] Touch-targets är minst 44x44px
- [ ] Charts skalar ner men förblir läsbara

---

## 🎨 Dark Mode Verification

**Toggle dark mode och verifiera:**

### IntegrationWidget:
- [ ] Gradient ändras till `dark:from-red-900/20`
- [ ] Text blir ljus (`dark:text-red-100`)
- [ ] Border blir mörkare (`dark:border-red-700`)

### SyncHistory:
- [ ] Timeline-linje blir ljusare (`dark:bg-slate-700`)
- [ ] Cards har mörk bakgrund (`dark:bg-slate-800`)
- [ ] Text är ljus och läsbar

### Charts:
- [ ] Gridlines är synliga (ljus färg)
- [ ] Tooltips har mörk bakgrund
- [ ] Legend text är ljus

---

## ✅ Final Visual Approval

**Alla komponenter ska se professionella ut:**
- [ ] Konsistent spacing (padding, margins)
- [ ] Smooth animations (inga ryck)
- [ ] Korrekt färgschema (röd-rosa tema)
- [ ] Responsiva och mobile-friendly
- [ ] Dark mode stöds fullt ut
- [ ] Inga UI-glitches eller visual bugs

---

## 🚀 Ready for Production?

Om alla visuella checks är ✅ PASS, då är systemet redo för deployment!

**Sign-off:**
- Visual Design: ☐ APPROVED ☐ NEEDS WORK
- Functionality: ☐ APPROVED ☐ NEEDS WORK
- Responsiveness: ☐ APPROVED ☐ NEEDS WORK
- Dark Mode: ☐ APPROVED ☐ NEEDS WORK

**Datum:** _____________  
**Godkänd av:** _____________
