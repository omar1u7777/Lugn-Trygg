# ⚡ QUICK REFERENCE CARD

**Last Updated**: October 19, 2025  
**Status**: ✅ PRODUCTION READY

---

## 🎯 Start Here

### 1️⃣ Start Dev Server
```bash
cd frontend
npm run dev
```

### 2️⃣ Open Browser
```
http://localhost:3000
```

### 3️⃣ Hard Refresh Cache
```
Ctrl+Shift+R (Windows)
Cmd+Shift+R (Mac)
```

### 4️⃣ Check Console
```
F12 → Console tab → Should be clean ✅
```

---

## 🚀 Essential Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run test` | Run tests |
| `npm run lint` | Check code quality |
| `npm run format` | Auto-format code |
| `npm run type-check` | TypeScript check |

---

## 📁 Key Files & Locations

| File | Purpose | Location |
|------|---------|----------|
| Environment Config | Centralized env vars | `src/config/env.ts` |
| Main App | React entry point | `src/main.tsx` |
| Service Worker | App offline support | `public/sw.js` |
| Firebase SW | Background notifications | `public/firebase-messaging-sw.js` |
| Analytics | Event tracking | `src/services/analytics.ts` |
| Notifications | Push notifications | `src/services/notifications.ts` |
| Auth Context | User authentication | `src/contexts/AuthContext.tsx` |

---

## 🔍 Browser DevTools Shortcuts

| Action | Shortcut |
|--------|----------|
| Open DevTools | `F12` |
| Console Tab | `F12` → Console |
| Network Tab | `F12` → Network |
| Storage Tab | `F12` → Application → Local Storage |
| Toggle Mobile | `F12` → `Ctrl+Shift+M` |
| Clear Cache | `Ctrl+Shift+Delete` |
| Hard Refresh | `Ctrl+Shift+R` |

---

## ✅ Status Indicators

### All Green ✅
- ✅ No console errors (red)
- ✅ Service Worker registered
- ✅ Analytics tracking
- ✅ Firebase Messaging ready
- ✅ Offline storage working

### Yellow Warnings ⚠️ (OK)
- ⚠️ Invalid Sentry DSN (dev dummy)
- ⚠️ Firebase dummy keys (dev only)
- ⚠️ CSS vendor prefixes (harmless)
- ⚠️ Deprecation warnings (transitive deps)

### Red Errors ❌ (Fix Immediately)
- ❌ TypeError in console
- ❌ ReferenceError in console
- ❌ Network 404 errors
- ❌ Service Worker not registered

---

## 🔧 Common Issues & Quick Fixes

| Problem | Solution |
|---------|----------|
| Blank screen | Hard refresh: `Ctrl+Shift+R` |
| Old code running | Clear cache: `Ctrl+Shift+Delete` |
| Port in use | Use next port or `VITE_PORT=3001 npm run dev` |
| SW not updating | Hard refresh + wait 30 sec |
| Service offline | Check Network tab, look for red entries |
| Auth not working | Check localStorage has `lugn_trygg_token` |

---

## 📊 Health Check Script

Copy/paste in browser console (F12):

```javascript
console.log('=== LUGN & TRYGG HEALTH CHECK ===');

// 1. Service Workers
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('✅ Service Workers:', regs.length);
  regs.forEach(r => console.log('  -', r.scope));
});

// 2. LocalStorage
console.log('✅ Auth Token:', !!localStorage.getItem('lugn_trygg_token'));
console.log('✅ Offline Data:', !!localStorage.getItem('lugn_trygg_offline_data'));

// 3. Location
console.log('✅ URL:', window.location.href);

// 4. Console errors (if any appear, fix them!)
console.log('✅ Ready!');
```

Expected output:
```
✅ Service Workers: 1
  - http://localhost:3000/
✅ Auth Token: true
✅ Offline Data: true
✅ URL: http://localhost:3000/
✅ Ready!
```

---

## 🎯 Development Workflow

### When Adding Features
1. Edit component/service in `src/`
2. File auto-saves (Vite HMR active)
3. Browser auto-updates
4. Check console for errors
5. Test feature in browser

### When Fixing Bugs
1. Find error in console
2. Open DevTools → Sources tab
3. Set breakpoint
4. Refresh page (`F5`)
5. Step through code
6. Fix and test

### Before Committing Code
```bash
npm run lint --fix    # Auto-fix formatting
npm run type-check    # Check TypeScript
npm run test          # Run tests
git add .
git commit -m "message"
```

---

## 🚀 Deployment Steps

### Quick Deploy to Firebase
```bash
# 1. Build
npm run build

# 2. Login to Firebase
firebase login

# 3. Deploy
firebase deploy --only hosting --project lugn-trygg-53d75

# 4. Check live
firebase hosting:list --project lugn-trygg-53d75
```

### Environment Variables for Production
```bash
VITE_BACKEND_URL=https://api.your-domain.com
VITE_FIREBASE_API_KEY=your-real-api-key
VITE_FIREBASE_PROJECT_ID=your-real-project-id
VITE_FIREBASE_VAPID_KEY=your-real-vapid-key
```

---

## 📚 Documentation Map

| Document | Best For |
|----------|----------|
| `FINAL_STATUS_REPORT.md` | Complete overview |
| `CURRENT_STATUS.md` | Technical details |
| `QUICK_STATUS.md` | Visual dashboard |
| `TROUBLESHOOTING.md` | Problem-solving |
| `SESSION_FIXES_SUMMARY.md` | What was fixed |
| `QUICK_DEPLOY_GUIDE.md` | Deployment steps |
| **THIS FILE** | Quick reference |

---

## 💻 System Requirements

### Minimum
- Node.js 16+
- npm 7+
- Modern browser (Chrome, Firefox, Safari, Edge)
- 500MB disk space

### Recommended
- Node.js 18+
- npm 9+
- Chrome/Edge (best DevTools)
- 1GB free disk space
- 4GB RAM

### Check Versions
```bash
node --version      # Should be v16+
npm --version       # Should be 7+
npm list -g vite    # Should be 7.1+
```

---

## 🎓 Tips & Tricks

### Super Fast Refresh
```bash
# 1. Keep dev server running in terminal
# 2. Just save file (Ctrl+S)
# 3. Browser updates automatically (no F5 needed!)
```

### Debug Service Worker
```javascript
// In browser console
navigator.serviceWorker.controller?.postMessage({type: 'DEBUG'});

// Check SW state
navigator.serviceWorker.ready.then(r => {
  console.log('SW State:', r.active?.scriptURL);
});
```

### Check API Calls
```
F12 → Network tab → Find /api/... calls
Click one → Response tab to see data
```

### Profile Performance
```
F12 → Performance tab → Record → Do action → Stop
Look for bottlenecks in flame chart
```

---

## 🆘 Emergency Contacts

### If App Crashes Completely

```bash
# 1. Stop server (Ctrl+C)
# 2. Clear everything
rm -r node_modules dist
rm package-lock.json

# 3. Reinstall
npm install

# 4. Restart
npm run dev

# 5. Hard refresh browser
# Ctrl+Shift+R
```

### If Service Worker Broken

```javascript
// In browser console
// 1. Unregister all SWs
navigator.serviceWorker.getRegistrations()
  .then(regs => regs.forEach(r => r.unregister()));

// 2. Clear cache
caches.keys().then(keys => 
  keys.forEach(k => caches.delete(k))
);

// 3. Hard refresh
// Ctrl+Shift+R
```

### If localStorage Corrupted

```javascript
// In browser console
localStorage.clear();
localStorage.removeItem('lugn_trygg_token');
localStorage.removeItem('lugn_trygg_offline_data');

// Then reload app and sign in again
location.reload();
```

---

## 📞 Quick Help

| Need | Action |
|------|--------|
| See all errors | `F12` → Console |
| Track API calls | `F12` → Network |
| Debug variable | Right-click → Inspect |
| Edit CSS live | `F12` → Elements → Change CSS |
| Check performance | `F12` → Performance → Record |
| Simulate offline | `F12` → Network → Offline |

---

## ✨ Pro Tips

### 1. Use VS Code Extensions
```
- ES7+ React/Redux/React-Native snippets
- Thunder Client (API testing)
- REST Client
- SQLite Viewer
```

### 2. Keep Terminal Clean
```bash
npm run dev 2>&1 | grep -E "error|ready|loaded"
```

### 3. Multiple Terminal Tabs
```
Tab 1: Frontend dev server (npm run dev)
Tab 2: Backend server (python main.py)
Tab 3: General commands
```

### 4. Git Workflow
```bash
git branch                  # Check current branch
git status                  # See changes
git add .                   # Stage changes
git commit -m "message"     # Commit
git push origin main        # Push to main
```

---

## 🎯 Last Checklist Before Calling Complete

- [ ] Ran `npm run dev` successfully
- [ ] Browser loads `http://localhost:3000`
- [ ] Hard refreshed browser (Ctrl+Shift+R)
- [ ] Checked console - no red errors ✅
- [ ] Tested one feature (navigate, toggle theme, etc.)
- [ ] Service Worker shows in Network tab
- [ ] Read `FINAL_STATUS_REPORT.md` for context
- [ ] Created bookmark to `QUICK_STATUS.md` for future reference

---

## 🚀 YOU'RE READY!

The app is fully functional and ready for:
- ✅ Continued development
- ✅ Feature additions
- ✅ User testing
- ✅ Production deployment

**Next Steps**:
1. Read `FINAL_STATUS_REPORT.md` for complete context
2. Start coding new features
3. Deploy when ready

**Questions?** Check the documentation files or use browser DevTools (F12).

---

**Happy Coding!** 🎉

