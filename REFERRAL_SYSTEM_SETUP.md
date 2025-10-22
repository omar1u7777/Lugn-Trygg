# 🔧 REFERRAL SYSTEM - ENVIRONMENT VARIABLES SETUP

## 📧 SendGrid Configuration (Email Service)

### Required Environment Variables:

```bash
# SendGrid API Key (Get from https://app.sendgrid.com/settings/api_keys)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Sender email (must be verified in SendGrid)
SENDGRID_FROM_EMAIL=noreply@lugn-trygg.se

# Sender name
SENDGRID_FROM_NAME=Lugn & Trygg
```

### Setup Steps:

1. **Create SendGrid Account:**
   - Go to https://sendgrid.com/
   - Sign up for free (100 emails/day)

2. **Verify Domain:**
   - Settings → Sender Authentication
   - Verify domain (lugn-trygg.se) OR single sender email

3. **Create API Key:**
   - Settings → API Keys
   - Create API Key with "Full Access"
   - Copy key to `SENDGRID_API_KEY`

4. **Add to Render:**
   ```
   Dashboard → lugn-trygg-backend → Environment
   Add: SENDGRID_API_KEY = SG.your_key_here
   Add: SENDGRID_FROM_EMAIL = noreply@lugn-trygg.se
   Add: SENDGRID_FROM_NAME = Lugn & Trygg
   ```

---

## 📱 Firebase Cloud Messaging (Push Notifications)

### Required Environment Variables:

```bash
# Enable/disable push notifications
FCM_ENABLED=true
```

### Setup Steps:

1. **Firebase Console:**
   - Go to https://console.firebase.google.com/
   - Select project: lugn-trygg-53d75
   - Settings → Cloud Messaging
   - Enable Cloud Messaging API

2. **Service Account:**
   - Already configured via `FIREBASE_SERVICE_ACCOUNT_KEY`
   - No additional env vars needed!

3. **Frontend FCM Token:**
   - Users need to grant notification permission
   - FCM token stored in Firestore (`users/{userId}/fcm_token`)

4. **Add to Render:**
   ```
   Dashboard → lugn-trygg-backend → Environment
   Add: FCM_ENABLED = true
   ```

---

## 🎯 Complete Environment Variables Checklist

### Backend (Render):

```bash
# Existing (already configured)
✅ FIREBASE_SERVICE_ACCOUNT_KEY
✅ JWT_SECRET_KEY
✅ FLASK_ENV
✅ CORS_ORIGINS

# NEW - Add these:
📧 SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
📧 SENDGRID_FROM_EMAIL=noreply@lugn-trygg.se
📧 SENDGRID_FROM_NAME=Lugn & Trygg
📱 FCM_ENABLED=true
```

### Frontend (Vercel):

```bash
# Existing (already configured)
✅ VITE_API_URL
✅ VITE_FIREBASE_API_KEY
✅ VITE_FIREBASE_PROJECT_ID
✅ VITE_FIREBASE_AUTH_DOMAIN
... (all Firebase config)

# No new vars needed! FCM uses existing Firebase config
```

---

## 🧪 Testing Email Integration

### Test SendGrid Email:

```bash
# From Backend directory
python -c "
from src.services.email_service import email_service
result = email_service.send_referral_invitation(
    to_email='your-email@example.com',
    referrer_name='Test User',
    referral_code='TEST1234',
    referral_link='https://lugn-trygg.vercel.app/register?ref=TEST1234'
)
print(result)
"
```

Expected output:
```json
{
  "success": true,
  "status_code": 202,
  "message": "Email sent successfully"
}
```

### Test Push Notification:

```bash
python -c "
from src.services.push_notification_service import push_notification_service
result = push_notification_service.send_referral_success_notification(
    user_token='YOUR_FCM_TOKEN_HERE',
    referrer_name='Test User',
    new_user_name='New Friend',
    total_referrals=5
)
print(result)
"
```

---

## 📊 API Endpoints Summary

### Email Endpoints:
```
POST /api/referral/invite
  → Sends invitation email via SendGrid
  Body: { user_id, email, referrer_name }
```

### Push Notification Triggers:
```
POST /api/referral/complete
  → Auto sends email + push notification
  → Checks tier upgrade → sends upgrade notification
```

### Rewards Endpoints:
```
GET  /api/referral/rewards/catalog
  → Get all available rewards

POST /api/referral/rewards/redeem
  → Redeem reward with earned weeks
  Body: { user_id, reward_id }
```

### Leaderboard & History:
```
GET  /api/referral/leaderboard?limit=20
  → Get top referrers

GET  /api/referral/history?user_id=xxx
  → Get user's referral history
```

---

## 🚀 Deployment Checklist

### Backend (Render):

1. ✅ Add SendGrid environment variables
2. ✅ Add FCM_ENABLED=true
3. ✅ Deploy updated code
4. ✅ Test email sending
5. ✅ Verify push notifications work

### Frontend (Vercel):

1. ✅ Deploy updated components
2. ✅ Test new UI features:
   - Email invite form
   - Leaderboard display
   - Rewards catalog
   - Referral history
3. ✅ Verify routing works

---

## 💰 SendGrid Pricing

**Free Tier:**
- 100 emails/day forever
- Perfect for testing & small user base

**Essentials Plan ($19.95/month):**
- 50,000 emails/month
- $1.00 per additional 1,000 emails
- Recommended when you reach 50+ daily invites

**Pro Plan ($89.95/month):**
- 100,000 emails/month
- Advanced features
- For scale (500+ users)

---

## 🔒 Security Notes

1. **Never commit API keys to Git**
   - Use `.env` locally
   - Set via Render/Vercel dashboard

2. **SendGrid API Key Permissions:**
   - Only grant "Mail Send" permission
   - Don't use "Full Access" in production

3. **FCM Tokens:**
   - Store securely in Firestore
   - Refresh tokens periodically
   - Remove tokens on logout

4. **Rate Limiting:**
   - SendGrid: 100 emails/day (free)
   - FCM: Unlimited (but respect quotas)
   - Consider adding rate limiting to `/api/referral/invite`

---

## 📞 Support Resources

**SendGrid:**
- Docs: https://docs.sendgrid.com/
- Status: https://status.sendgrid.com/
- Support: support@sendgrid.com

**Firebase FCM:**
- Docs: https://firebase.google.com/docs/cloud-messaging
- Console: https://console.firebase.google.com/
- Status: https://status.firebase.google.com/

---

## ✅ Verification Steps

After deployment, verify:

1. **Email Sending:**
   - ✅ Invitation email received
   - ✅ HTML formatting correct
   - ✅ Links clickable
   - ✅ Swedish language correct

2. **Push Notifications:**
   - ✅ Notification appears on device
   - ✅ Click opens referral page
   - ✅ Sound/vibration works
   - ✅ Badge count updates

3. **Leaderboard:**
   - ✅ Shows top referrers
   - ✅ Ranks correctly ordered
   - ✅ Tier badges display
   - ✅ Updates in real-time

4. **Rewards:**
   - ✅ Catalog loads
   - ✅ Redemption works
   - ✅ Balance updates
   - ✅ Insufficient funds blocked

5. **History:**
   - ✅ Shows all referrals
   - ✅ Timestamps formatted
   - ✅ User names display
   - ✅ Sorted by date

---

**🎉 Du är redo att deployer! All kod är implementerad!**
