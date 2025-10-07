# TODO: Comprehensive Fullstack Fix and Production Readiness for Lugn-Trygg App

## 1. Fix Vite CJS Deprecation
- Update frontend/package.json to add "type": "module"
- Ensure frontend/vite.config.ts uses ESM (already does)

## 2. Fix FLASK_ENV Deprecation
- Change FLASK_ENV to FLASK_DEBUG in Backend/.env.example (updated)

## 2.5. Fix Port Inconsistency and Update Dependencies
- Align frontend/vite.config.ts proxy to backend port 5001 (updated)
- Update Flask to 3.0.3 and Werkzeug to 3.0.1 in Backend/requirements.txt (updated)

## 3. Fix Firestore Positional Arguments Warning
- Update Backend/src/routes/auth.py, mood_routes.py, memory_routes.py to use filter=FieldFilter for Firestore queries

## 4. Improve CORS and Proxy Configuration
- Verify frontend/vite.config.ts proxy is working for /api
- Add more CORS origins if needed in Backend/main.py

## 5. Fix Auth Errors and Add Robust Error Handling
- Add better error handling in Backend/src/routes/auth.py
- Validate JWT in routes
- Ensure proper JSON responses

## 6. Review Frontend API Calls
- Check frontend/src/api/api.ts for correct /api prefix usage
- Ensure axios calls are proxied correctly

## 7. Review Backend Routes
- Ensure all routes in auth.py, mood_routes.py, memory_routes.py return proper JSON
- Handle errors gracefully

## 8. Production Readiness
- Add HTTPS considerations
- Secure JWT handling
- Input validation
- Optimize Firestore queries
- Suggest deployment options (Vercel/Netlify for frontend, Heroku/GCP for backend)

## 9. Testing and Verification
- Test frontend-backend integration
- Run npm run build for production
- Verify all features work end-to-end

## Progress Tracking
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 2.5 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed
- [x] Step 6 completed
- [x] Step 7 completed
- [ ] Step 8 completed
- [ ] Step 9 completed
