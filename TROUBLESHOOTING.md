# 🔧 Quick Troubleshooting Guide

## 🚀 Get Started Quickly

### Check if everything is working:

#### 1. **Dev Server Running?**
```bash
# Should see output like:
# [0]   VITE v7.1.10  ready in 2137 ms
# [0]   ➜  Local:   http://localhost:3000/
```

#### 2. **Open Browser**
- Go to: `http://localhost:3000`
- Press **Ctrl+Shift+R** (hard refresh) to clear cache

#### 3. **Check Browser Console**
Press **F12** → **Console** tab

✅ **Expected**: No critical errors, just informational logs
❌ **Bad**: Red error messages in console

---

## ❌ Common Issues & Solutions

### Issue 1: "Service Worker MIME Type Error"
```
The script has an unsupported MIME type ('text/html')
```

**Solution**: 
- ✅ **Fixed** - `firebase-messaging-sw.js` was created
- Hard refresh: **Ctrl+Shift+R**

---

### Issue 2: "process is not defined"
```
ReferenceError: process is not defined
```

**Solution**:
- ✅ **Fixed** - All direct `process.env` access removed
- Updated to use `config/env.ts` helpers
- Hard refresh: **Ctrl+Shift+R**

---

### Issue 3: "unsubscribe is not a function"
```
TypeError: unsubscribe is not a function
    OfflineIndicator OfflineIndicator.tsx:62
```

**Solution**:
- ✅ **Fixed** - `offlineStorage.listenForOnlineStatus()` now returns cleanup function
- Hard refresh: **Ctrl+Shift+R**

---

### Issue 4: Firebase Messaging Fails
```
Failed to initialize messaging: FirebaseError: Messaging: We are unable to register...
```

**Solution**:
- ✅ **Expected in dev** - Using dummy Firebase config
- For production: Set real credentials in `VITE_FIREBASE_*` environment variables
- See: [Environment Setup](#environment-setup)

---

### Issue 5: Blank Screen or Nothing Loads
```
Page shows blank or infinite loading
```

**Solutions**:
1. **Hard refresh**: **Ctrl+Shift+R**
2. **Clear browser cache**:
   - Chrome: Settings → Privacy → Clear browsing data
   - Firefox: History → Clear Recent History
3. **Restart dev server**:
   ```bash
   # Press Ctrl+C in terminal to stop
   npm run dev
   ```

---

### Issue 6: Port 3000 Already in Use
```
Port 3000 is in use, trying another one...
```

**Solutions**:
1. **Find and kill process**:
   ```bash
   # Windows - PowerShell
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   
   # Or let Vite find another port (it will try 3001, 3002, etc.)
   ```

2. **Use different port**:
   ```bash
   VITE_PORT=3001 npm run dev
   ```

---

## 📊 System Information

### Backend Service
- **URL**: `http://localhost:54112`
- **Status**: Check with curl:
  ```bash
  curl http://localhost:54112/api/health
  ```

### Frontend Dev Server
- **URL**: `http://localhost:3000`
- **Port**: Configurable (defaults to 3000, tries next if in use)
- **Files**: Auto-reload on save (HMR enabled)

### Database/Storage
- **localStorage**: Browser stores user data locally
- **Firebase**: Dummy config in development
- **Service Worker**: Handles offline sync

---

## 🔍 Debugging Tips

### Check Browser DevTools

1. **Console Tab** - See all logs and errors
   - Red 🔴 = Errors (fix these)
   - Yellow ⚠️ = Warnings (usually OK)
   - Blue ℹ️ = Info (just logging)

2. **Network Tab** - See API calls
   - ✅ 200 = Success
   - ❌ 404 = Not found
   - ❌ 500 = Server error

3. **Storage Tab** - See localStorage
   - Check: `lugn_trygg_token`
   - Check: `lugn_trygg_offline_data`

4. **Application Tab** - See Service Workers
   - Should show: `/sw.js` - Status: activated and running
   - Should show: `/firebase-messaging-sw.js` - Status: activated and running

---

## 🧹 Clean Everything & Start Fresh

If you're stuck, nuclear option:

```bash
# Stop dev server (Ctrl+C)

# Clear all caches and reinstall
rm -r node_modules
rm package-lock.json
npm install

# Clear browser cache
# Chrome DevTools → F12 → ⋮ → Settings → Clear browsing data

# Restart dev server
npm run dev
```

---

## 📞 Quick Reference

| Task | Command |
|------|---------|
| Start dev server | `npm run dev` |
| Build for production | `npm run build` |
| Run tests | `npm run test` |
| Lint code | `npm run lint` |
| Format code | `npm run format` |
| Type check | `npm run type-check` |

---

## ✅ Health Check Checklist

Before considering "ready for deployment":

- [ ] Dev server starts without errors: `npm run dev`
- [ ] Browser loads page: `http://localhost:3000`
- [ ] No console errors (red): Press **F12** → Console
- [ ] Can navigate pages without crashes
- [ ] Dark/light theme toggle works
- [ ] Language switcher works (Swedish/English/Norwegian)
- [ ] Analytics logs appear (e.g., "📊 Event tracked: page_view")
- [ ] Service Worker registered: "✅ Service Worker registered successfully"
- [ ] Offline mode works: DevTools → Network → Offline
- [ ] Can interact with UI (buttons, forms, etc.)

If all ✅ → **Ready to continue development or deploy!**

---

## 🎯 Need Help?

### Check These Files for Context
- **Overall Status**: `CURRENT_STATUS.md` (this directory)
- **Deployment Guide**: `QUICK_DEPLOY_GUIDE.md`
- **Architecture**: Check component structure in `frontend/src/`

### Review Recent Changes
- **This Session**: See CURRENT_STATUS.md for list of files modified
- **All Changes**: `git diff main` (if using git)

### Check Server Logs
```bash
# Frontend logs: See console output from `npm run dev`
# Backend logs: See terminal output from Flask server
# Browser logs: Press F12 → Console tab
```

---

**Last Updated**: October 19, 2025
**Status**: ✅ All Critical Issues Resolved
**Next Action**: Hard refresh browser (Ctrl+Shift+R) and test

