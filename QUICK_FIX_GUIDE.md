# 🚀 Snabb Fix Guide - Kritiska Buggar

## ⚡ Snabbfix: Material-UI Grid Problem (Rekommenderad Lösning)

### Option 1: Downgrade MUI till v6 (5 minuter)

```powershell
cd c:\Projekt\Lugn-Trygg-main_klar\frontend

# Downgrade MUI packages
npm install @mui/material@^6.1.8 @mui/icons-material@^6.1.8 @emotion/react@^11.13.5 @emotion/styled@^11.13.5

# Rebuild
npm run build
```

✅ Detta fixar alla Grid-fel omedelbart!

### Option 2: Manuell Fix (30-60 minuter)

Ersätt Grid med Box i alla påverkade filer:

```typescript
// ❌ Gammalt (fungerar inte i MUI v7)
<Grid container spacing={2}>
  <Grid xs={12} md={6}>
    <Card>Content</Card>
  </Grid>
</Grid>

// ✅ Nytt (MUI v7 kompatibelt)
<Box sx={{ 
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
  gap: 2 
}}>
  <Card>Content</Card>
</Box>
```

## 🔧 Fixa Återstående Småfel

### 1. Jest Dependencies

```powershell
npm install --save-dev @jest/globals @testing-library/jest-dom
```

I `frontend/src/setupTests.ts`, lägg till:
```typescript
import '@testing-library/jest-dom';
```

### 2. Uppdatera User Type

I `frontend/src/types/index.ts`:

```typescript
export type User = {
  user_id: string;
  email: string;
  name?: string;
  displayName?: string;  // Lägg till denna
  streak?: number;       // Lägg till denna
  goals?: string[];      // Lägg till denna
  role?: UserRole;
  createdAt?: Date | string | undefined;
  updatedAt?: Date | string | undefined;
  avatarUrl?: string;
  isActive?: boolean;
  lastLogin?: Date | string | undefined;
};
```

### 3. Fixa OfflineIndicator

I `frontend/src/components/OfflineIndicator.tsx` rad 55:

```typescript
// ❌ Gammalt
(data.queuedRequests?.length || 0);

// ✅ Nytt
(data.requests?.length || 0);
```

### 4. Ta Bort Oanvända Imports

Kör detta för att automatiskt fixa:

```powershell
cd c:\Projekt\Lugn-Trygg-main_klar\frontend
npm run lint -- --fix
```

## ✅ Verifiering

Efter alla fixar, kör:

```powershell
# Kontrollera TypeScript fel
npm run typecheck

# Bygg projektet
npm run build

# Kör tester
npm test
```

## 📝 Checklis ta

- [ ] MUI downgrade ELLER Grid refactoring
- [ ] Jest dependencies installerade
- [ ] User type uppdaterad
- [ ] OfflineIndicator fixad
- [ ] Lint körd
- [ ] Build fungerande
- [ ] Tester passerar

---

**Estimerad tid:** 10-15 minuter med downgrade, 1-2 timmar med manuell refactoring
