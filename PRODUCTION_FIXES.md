# Production Deployment Fixes

## Firebase 403 Errors
The Firebase configuration in `src/config/env.ts` has hardcoded development values. In production on Vercel, you need to set these environment variables:

**Required Vercel Environment Variables:**
```
VITE_FIREBASE_API_KEY=your_production_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_production_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## CSP Violations
The CSP in the backend allows Firebase domains, but you may need to add unpkg.com and other external script sources. Update the CSP_DIRECTIVES in `Backend/src/config.py`:

```python
CSP_DIRECTIVES = {
    "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'",
                   "https://cdnjs.cloudflare.com",
                   "https://unpkg.com",  # Add this for external scripts
                   "https://www.gstatic.com",
                   "https://www.googleapis.com",
                   "https://apis.google.com",
                   "https://securetoken.googleapis.com",
                   "https://firebase.googleapis.com",
                   "https://*.firebaseapp.com",
                   "https://*.googleapis.com"],
    # ... rest of directives
}
```

## Service Worker MIME Type Error
The service worker registration is already commented out in `src/main.tsx`, which should prevent this error. If you're still seeing it, ensure no other code is registering a service worker.

## React Import Error
The Vite configuration has been fixed with proper React plugin setup. The duplicate rollupOptions in `vite.config.js` has been merged.

## Testing Checklist
- [x] Backend running locally on port 54112
- [x] Frontend running locally on port 3000
- [ ] Test login functionality
- [ ] Test mood logging
- [ ] Test dashboard features
- [ ] Test all buttons and navigation
- [ ] Verify API calls work with backend