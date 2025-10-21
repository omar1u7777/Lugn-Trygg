# 🚀 Quick Manual Testing Guide

## Prerequisites
✅ Backend running: http://localhost:54112  
✅ Frontend running: http://localhost:3000  
✅ Browser: Chrome, Firefox, or Edge

---

## 🔐 Test 1: Google OAuth Login (5 min)

### Steps:
1. Open browser: http://localhost:3000
2. You should see the login page
3. Click **"Continue with Google"** button
4. Complete Google OAuth in popup window
5. Should redirect to dashboard

### Verification:
- [ ] Redirected to `/dashboard` after login
- [ ] User name displayed in UI
- [ ] Open DevTools (F12) → Application → Local Storage
  - [ ] Check for `access_token`
  - [ ] Check for `refresh_token`  
  - [ ] Check for `user_id`
- [ ] Open DevTools → Application → Cookies
  - [ ] Check for `access_token` cookie (httpOnly)

### Expected Result:
✅ Successfully logged in with JWT tokens stored

### If it fails:
- Check browser console for errors (F12 → Console)
- Check backend terminal for error logs
- Verify Firebase config in frontend/.env

---

## 🏥 Test 2: Health Integration Page (5 min)

### Steps:
1. After logging in, click **"Integration"** in navigation menu
2. Or navigate directly to: http://localhost:3000/integrations

### Verification:
- [ ] Page loads without errors
- [ ] "Connected Devices" section visible
- [ ] Connect buttons for devices visible:
  - [ ] Fitbit
  - [ ] Apple Health
  - [ ] Google Fit
  - [ ] Samsung Health
- [ ] Health metrics cards displayed (mock data):
  - [ ] Steps (8500)
  - [ ] Heart Rate (72 bpm)
  - [ ] Sleep (7.5h)
  - [ ] Calories (2145)
- [ ] FHIR Integration section visible
- [ ] Crisis Contacts section visible:
  - [ ] 112 (Emergency)
  - [ ] 1177 (Healthcare)
  - [ ] Mind (Suicide Prevention)

### Test Actions:
- [ ] Click "Connect" on a device (should show connecting state)
- [ ] Click "Sync" button (should show syncing state)
- [ ] Click on crisis contact links (should open correctly)

### Expected Result:
✅ Page functional, buttons respond, data displays correctly

---

## 🎁 Test 3: Referral Program Page (5 min)

### Steps:
1. Click **"Referral"** in navigation menu
2. Or navigate to: http://localhost:3000/referral

### Verification:
- [ ] Page loads without errors
- [ ] Referral code displayed
- [ ] Copy button for referral code visible
- [ ] Referral link displayed
- [ ] Copy button for referral link visible
- [ ] Social sharing buttons visible:
  - [ ] WhatsApp
  - [ ] Facebook
  - [ ] Twitter
  - [ ] Email
- [ ] Tier information displayed:
  - [ ] Current tier (Bronze/Silver/Gold/Platinum)
  - [ ] Tier emoji (🥉🥈🥇💎)
  - [ ] Progress bar
- [ ] Statistics displayed:
  - [ ] Total referred
  - [ ] Active users
  - [ ] Rewards earned
- [ ] Rewards information visible (50kr per referral)

### Test Actions:
- [ ] Click "Copy Code" button (should copy to clipboard)
- [ ] Click "Copy Link" button (should copy to clipboard)
- [ ] Click social sharing buttons (should open share dialog)

### Expected Result:
✅ All buttons work, clipboard copies successful

---

## 💬 Test 4: Feedback Form (5 min)

### Steps:
1. Click **"Feedback"** in navigation menu
2. Or navigate to: http://localhost:3000/feedback

### Verification:
- [ ] Page loads without errors
- [ ] Category dropdown visible
- [ ] Star rating visible (1-5 stars)
- [ ] Message textarea visible
- [ ] Character counter visible (0/1000)
- [ ] Contact preference checkbox visible
- [ ] Email field (conditional on checkbox)
- [ ] Submit button visible
- [ ] Quick action cards visible:
  - [ ] Help Center
  - [ ] Live Chat
  - [ ] Email Support

### Test Actions:
1. **Select Category**: Choose "Bug Report"
2. **Rate**: Click on 4 stars
3. **Message**: Type "Testing feedback form"
4. **Contact**: Check the contact checkbox
5. **Email**: Enter your email
6. **Submit**: Click Submit button

### Expected Behavior:
- [ ] Category selection works
- [ ] Stars change color when clicked
- [ ] Character counter updates as you type
- [ ] Character limit enforced at 1000
- [ ] Email field appears when checkbox checked
- [ ] Submit button shows loading state
- [ ] Success message appears
- [ ] Form resets after submission

### Expected Result:
✅ Form submission successful, backend receives data

---

## 🎯 Test 5: Onboarding Flow (5 min)

### Steps:
1. **Clear localStorage**: 
   - DevTools (F12) → Application → Local Storage
   - Delete all items
2. **Refresh page**: Press F5
3. Onboarding should appear

### Verification:
- [ ] Onboarding modal/overlay appears
- [ ] Step 1: Welcome message
- [ ] Step 2: Goal selection
  - [ ] Multiple goal buttons visible:
    - [ ] Hantera stress
    - [ ] Bättre sömn
    - [ ] Ökad fokusering
    - [ ] Mental klarhet
  - [ ] Can click goals to select them
  - [ ] Selected goals show blue background + checkmark (✓)
  - [ ] "Nästa" button disabled until at least 1 goal selected
- [ ] Step 3: Final step/confirmation
- [ ] "Slutför" or "Finish" button

### Test Actions:
- [ ] Try clicking "Nästa" without selecting a goal (should be disabled)
- [ ] Select 1 goal (button should enable)
- [ ] Select multiple goals
- [ ] Deselect a goal (click again)
- [ ] Complete onboarding
- [ ] Refresh page
- [ ] Onboarding should NOT appear again

### Expected Result:
✅ Onboarding completes, persists to localStorage, doesn't repeat

---

## 📊 Test 6: Dashboard Features (5 min)

### Steps:
1. Navigate to: http://localhost:3000/dashboard

### Verification:
- [ ] Dashboard loads
- [ ] User greeting displayed ("Hej, [Name]!")
- [ ] Mood logger visible
- [ ] Quick stats/widgets visible
- [ ] Navigation menu works
- [ ] All links functional

### Test Actions:
- [ ] Log a mood entry
- [ ] Navigate between pages
- [ ] Check for console errors (F12 → Console)

---

## 🧪 Test 7: API Integration (10 min)

### Using Browser DevTools Network Tab:

1. **Open DevTools**: F12 → Network tab
2. **Filter**: XHR or Fetch requests
3. **Perform actions**: Login, navigate pages, submit forms

### Verification for each request:
- [ ] Status Code: 200 OK (success) or 401 (auth required)
- [ ] Request Headers include: `Authorization: Bearer <token>`
- [ ] Response Headers include: `Content-Type: application/json`
- [ ] Response body is valid JSON
- [ ] No CORS errors

### Key Requests to Check:
- [ ] POST `/api/auth/google-login` → 200 OK
- [ ] GET `/api/integration/wearable/status` → 200 or 401
- [ ] POST `/api/referral/generate` → 200 OK
- [ ] POST `/api/feedback/submit` → 200 OK
- [ ] POST `/api/mood/log` → 200 OK

---

## 🐛 Common Issues & Solutions

### Issue: Google Login Fails
**Solution**: 
- Check Firebase config in `frontend/.env`
- Verify `VITE_FIREBASE_API_KEY` is correct
- Check backend logs for Firebase errors

### Issue: 401 Unauthorized on API Calls
**Solution**:
- Check localStorage for `access_token`
- Token might be expired (15 min lifetime)
- Try logging in again

### Issue: Page Not Found (404)
**Solution**:
- Verify route exists in `frontend/src/App.tsx`
- Check browser URL spelling
- Restart frontend server

### Issue: Blank Page
**Solution**:
- Open DevTools console (F12)
- Check for JavaScript errors
- Verify all dependencies installed (`npm install`)

### Issue: CORS Errors
**Solution**:
- Verify backend CORS config allows `http://localhost:3000`
- Check `Backend/.env` for `CORS_ALLOWED_ORIGINS`
- Restart backend server

---

## ✅ Testing Checklist Summary

### Must Complete (Critical):
- [ ] Google OAuth login works
- [ ] Dashboard loads after login
- [ ] JWT tokens stored correctly
- [ ] New pages load without errors
- [ ] Onboarding can be completed
- [ ] No critical console errors

### Nice to Have:
- [ ] All form submissions work
- [ ] All navigation links work
- [ ] Mobile responsive design
- [ ] Dark mode toggle works
- [ ] All icons display correctly

---

## 📝 Bug Reporting Template

When you find a bug, document it like this:

```
**Bug Title**: [Short description]

**Severity**: Critical / High / Medium / Low

**Steps to Reproduce**:
1. Go to...
2. Click on...
3. See error...

**Expected Behavior**: [What should happen]

**Actual Behavior**: [What actually happens]

**Browser**: Chrome 118

**Console Errors**: [Copy any red errors from F12 console]

**Screenshots**: [If applicable]

**Backend Logs**: [If applicable]
```

---

## 🎯 Success Criteria

At the end of testing, you should have:
- ✅ Successfully logged in with Google OAuth
- ✅ Visited all new pages (/integrations, /referral, /feedback)
- ✅ Completed onboarding flow
- ✅ Submitted at least one form
- ✅ Verified JWT tokens are working
- ✅ No critical bugs blocking usage

---

## ⏰ Estimated Time

- **Quick Test** (all 7 tests): 30-40 minutes
- **Thorough Test** (including edge cases): 1-2 hours
- **Full QA** (all features): 3-4 hours

---

**Good luck with testing!** 🚀

If you encounter any issues, check:
1. Browser console (F12 → Console)
2. Network tab (F12 → Network)
3. Backend terminal logs
4. Frontend terminal logs

**Contact**: Document all findings in API_TESTING_REPORT.md
