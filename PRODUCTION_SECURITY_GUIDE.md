# 🔒 Production Security Guide - Lugn & Trygg

**Last Updated**: October 19, 2025  
**Status**: Production Security Hardening - Step 8

---

## 📋 Table of Contents

1. [HTTPS Configuration](#https-configuration)
2. [Secure JWT Handling](#secure-jwt-handling)
3. [Environment Variables Security](#environment-variables-security)
4. [Input Validation](#input-validation)
5. [Firestore Query Optimization](#firestore-query-optimization)
6. [CORS Configuration](#cors-configuration)
7. [API Rate Limiting](#api-rate-limiting)
8. [Security Headers](#security-headers)
9. [Deployment Checklist](#deployment-checklist)

---

## 🔐 1. HTTPS Configuration

### Production Requirements

**All production deployments MUST use HTTPS**. Never deploy without SSL/TLS certificates.

### Frontend (Vercel/Netlify/Firebase Hosting)

✅ **Automatic HTTPS** - These platforms automatically provision and renew SSL certificates.

**Firebase Hosting Configuration** (Recommended):
```json
// firebase.json
{
  "hosting": {
    "public": "frontend/dist",
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Strict-Transport-Security",
            "value": "max-age=31536000; includeSubDomains; preload"
          },
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          },
          {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
          },
          {
            "key": "Permissions-Policy",
            "value": "geolocation=(), microphone=(), camera=()"
          }
        ]
      }
    ],
    "cleanUrls": true,
    "trailingSlash": false
  }
}
```

### Backend (Google Cloud Run/Heroku/Railway)

**Google Cloud Run** (Recommended):
- Automatically provides HTTPS endpoints
- No manual SSL certificate management required
- Custom domain setup includes free SSL

**Heroku**:
- Free automatic SSL on `*.herokuapp.com` domains
- Custom domains require ACM (Automatic Certificate Management)

**Railway**:
- Automatic SSL for all deployments
- Custom domains with automatic certificate provisioning

### Force HTTPS Redirects

**Backend Flask Configuration**:
```python
# Backend/src/middleware/security.py
from flask import request, redirect

def enforce_https():
    """Redirect HTTP to HTTPS in production"""
    if request.headers.get('X-Forwarded-Proto', 'http') != 'https' and not app.debug:
        url = request.url.replace('http://', 'https://', 1)
        return redirect(url, code=301)
```

**Add to Backend/main.py**:
```python
from src.middleware.security import enforce_https

@app.before_request
def before_request():
    if os.getenv('FLASK_DEBUG', 'False') == 'False':
        return enforce_https()
```

---

## 🔑 2. Secure JWT Handling

### Current Implementation Review

**Issues to Address**:
- ✅ JWT secret keys must be strong (256+ bits)
- ⚠️ Token expiration validation needed on every request
- ⚠️ Refresh token rotation recommended
- ⚠️ Token blacklisting for logout needed

### Enhanced JWT Configuration

**Backend/src/config/jwt_config.py** (NEW):
```python
import os
from datetime import timedelta

class JWTConfig:
    """Centralized JWT configuration with security best practices"""
    
    # Secret Keys (MUST be environment variables in production)
    SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    REFRESH_SECRET_KEY = os.getenv('JWT_REFRESH_SECRET_KEY')
    
    # Token Expiration
    ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(os.getenv('JWT_EXPIRATION_MINUTES', '15')))
    REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv('JWT_REFRESH_EXPIRATION_DAYS', '30')))
    
    # Security Settings
    ALGORITHM = 'HS256'
    VERIFY_EXP = True  # Always verify expiration
    VERIFY_NBF = True  # Verify not-before claim
    
    # Blacklist (for token revocation)
    TOKEN_BLACKLIST_ENABLED = True
    TOKEN_BLACKLIST_PRUNE_FREQUENCY = timedelta(hours=24)
    
    @staticmethod
    def validate_secrets():
        """Ensure JWT secrets are properly configured"""
        if not JWTConfig.SECRET_KEY or JWTConfig.SECRET_KEY == 'your-jwt-secret':
            raise ValueError("JWT_SECRET_KEY must be set in production!")
        if not JWTConfig.REFRESH_SECRET_KEY or JWTConfig.REFRESH_SECRET_KEY == 'your-refresh-secret':
            raise ValueError("JWT_REFRESH_SECRET_KEY must be set in production!")
        if len(JWTConfig.SECRET_KEY) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters!")

# Validate on import in production
if os.getenv('FLASK_DEBUG', 'False') == 'False':
    JWTConfig.validate_secrets()
```

### Token Blacklist Implementation

**Backend/src/services/token_blacklist.py** (NEW):
```python
from datetime import datetime, timedelta
from firebase_admin import firestore

class TokenBlacklist:
    """Manages revoked JWT tokens"""
    
    def __init__(self):
        self.db = firestore.client()
        self.collection = 'token_blacklist'
    
    def revoke_token(self, jti: str, expires_at: datetime):
        """Add token to blacklist"""
        self.db.collection(self.collection).document(jti).set({
            'revoked_at': datetime.utcnow(),
            'expires_at': expires_at
        })
    
    def is_token_revoked(self, jti: str) -> bool:
        """Check if token is blacklisted"""
        doc = self.db.collection(self.collection).document(jti).get()
        return doc.exists
    
    def prune_expired_tokens(self):
        """Remove expired tokens from blacklist (run as cron job)"""
        cutoff = datetime.utcnow()
        query = self.db.collection(self.collection).where('expires_at', '<', cutoff)
        
        batch = self.db.batch()
        for doc in query.stream():
            batch.delete(doc.reference)
        batch.commit()
```

### Enhanced Token Validation

**Backend/src/middleware/auth.py** - Update:
```python
import jwt
from functools import wraps
from flask import request, jsonify
from src.config.jwt_config import JWTConfig
from src.services.token_blacklist import TokenBlacklist

blacklist = TokenBlacklist()

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Extract token from Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            # Decode and validate token
            payload = jwt.decode(
                token,
                JWTConfig.SECRET_KEY,
                algorithms=[JWTConfig.ALGORITHM],
                options={
                    'verify_exp': JWTConfig.VERIFY_EXP,
                    'verify_nbf': JWTConfig.VERIFY_NBF
                }
            )
            
            # Check if token is blacklisted
            jti = payload.get('jti')
            if jti and blacklist.is_token_revoked(jti):
                return jsonify({'error': 'Token has been revoked'}), 401
            
            # Attach user info to request
            request.user_id = payload.get('user_id')
            request.email = payload.get('email')
            
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        except Exception as e:
            return jsonify({'error': f'Token validation failed: {str(e)}'}), 401
        
        return f(*args, **kwargs)
    
    return decorated
```

### Frontend Token Storage Best Practices

**Current**: Tokens stored in `localStorage`  
**Issue**: Vulnerable to XSS attacks  
**Recommendation**: Use `httpOnly` cookies for production

**Backend Changes Required**:
```python
# Backend/src/routes/auth.py
from flask import make_response

@auth_bp.route('/login', methods=['POST'])
def login():
    # ... authentication logic ...
    
    response = make_response(jsonify({
        'success': True,
        'user': user_data
    }))
    
    # Set httpOnly cookie (not accessible via JavaScript)
    response.set_cookie(
        'access_token',
        value=access_token,
        httponly=True,
        secure=True,  # HTTPS only
        samesite='Strict',
        max_age=900  # 15 minutes
    )
    
    response.set_cookie(
        'refresh_token',
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite='Strict',
        max_age=2592000  # 30 days
    )
    
    return response
```

**Frontend Changes Required**:
```typescript
// frontend/src/api/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || '/api',
  withCredentials: true,  // Send cookies with requests
  headers: {
    'Content-Type': 'application/json'
  }
});

// No need to manually attach Authorization header
// Cookies are sent automatically

export default api;
```

---

## 🔒 3. Environment Variables Security

### Production Environment Setup

**NEVER commit `.env` files to version control!**

### Secret Generation

**Generate Strong Secrets**:
```bash
# JWT Secret (256-bit)
openssl rand -base64 32

# Encryption Key (256-bit)
openssl rand -hex 32

# Flask Secret Key
python -c "import secrets; print(secrets.token_hex(32))"
```

### Backend Production Environment Variables

**Required for Production**:
```bash
# Flask Configuration
FLASK_DEBUG=False
PORT=5001

# JWT Security (CRITICAL - Generate new secrets!)
JWT_SECRET_KEY=<generate-with-openssl-rand-base64-32>
JWT_REFRESH_SECRET_KEY=<generate-different-secret>
JWT_EXPIRATION_MINUTES=15
JWT_REFRESH_EXPIRATION_DAYS=30

# Firebase Admin SDK (from Firebase Console)
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json
FIREBASE_PROJECT_ID=<your-project-id>
FIREBASE_DATABASE_URL=https://<project-id>.firebaseio.com
FIREBASE_STORAGE_BUCKET=<project-id>.appspot.com

# Firebase Client Config
FIREBASE_WEB_API_KEY=<from-firebase-console>
FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
FIREBASE_MESSAGING_SENDER_ID=<from-firebase-console>
FIREBASE_APP_ID=<from-firebase-console>

# OpenAI (for AI features)
OPENAI_API_KEY=<your-openai-key>

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_live_<your-live-key>  # Use sk_live_ in production!
STRIPE_PUBLISHABLE_KEY=pk_live_<your-live-key>
STRIPE_PRICE_ID=price_<your-price-id>
STRIPE_WEBHOOK_SECRET=whsec_<your-webhook-secret>

# Google OAuth
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com

# CORS (Update with production URLs)
FRONTEND_URL=https://your-app.com
CORS_ALLOWED_ORIGINS=https://your-app.com,https://www.your-app.com

# Google Cloud (for Speech-to-Text)
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

### Frontend Production Environment Variables

**Required for Production** (`.env.production`):
```bash
# Backend API
VITE_BACKEND_URL=https://api.your-app.com

# Firebase Client
VITE_FIREBASE_API_KEY=<from-firebase-console>
VITE_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<your-project-id>
VITE_FIREBASE_STORAGE_BUCKET=<project-id>.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=<from-firebase-console>
VITE_FIREBASE_APP_ID=<from-firebase-console>
VITE_FIREBASE_MEASUREMENT_ID=G-<your-measurement-id>
VITE_FIREBASE_VAPID_KEY=<from-firebase-cloud-messaging>

# Stripe Client
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_<your-live-key>

# Encryption (for sensitive local storage)
VITE_ENCRYPTION_KEY=<generate-with-openssl-rand-hex-32>

# Google OAuth
VITE_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com

# Analytics (Optional)
VITE_SENTRY_DSN=https://<key>@sentry.io/<project>
VITE_AMPLITUDE_API_KEY=<your-amplitude-key>
```

### Platform-Specific Environment Setup

**Vercel**:
```bash
vercel env add VITE_FIREBASE_API_KEY production
vercel env add VITE_BACKEND_URL production
# ... add all variables
```

**Netlify**:
```bash
netlify env:set VITE_FIREBASE_API_KEY "<value>"
netlify env:set VITE_BACKEND_URL "<value>"
# ... or use Netlify UI
```

**Google Cloud Run**:
```bash
gcloud run deploy backend \
  --set-env-vars="JWT_SECRET_KEY=<secret>,FIREBASE_PROJECT_ID=<id>" \
  --set-secrets="OPENAI_API_KEY=openai-key:latest"
```

**Heroku**:
```bash
heroku config:set JWT_SECRET_KEY=<secret>
heroku config:set FIREBASE_PROJECT_ID=<id>
```

---

## ✅ 4. Input Validation

### Backend Input Validation

**Install Validation Library**:
```bash
cd Backend
pip install marshmallow==3.20.1
```

**Update `requirements.txt`**:
```
marshmallow==3.20.1
```

**Create Validation Schemas** - `Backend/src/validators/schemas.py` (NEW):
```python
from marshmallow import Schema, fields, validate, validates, ValidationError
import re

class UserRegistrationSchema(Schema):
    """Validate user registration input"""
    email = fields.Email(required=True, error_messages={
        'required': 'Email is required',
        'invalid': 'Invalid email format'
    })
    password = fields.Str(required=True, validate=validate.Length(min=8, max=128))
    name = fields.Str(required=True, validate=validate.Length(min=2, max=100))
    
    @validates('password')
    def validate_password_strength(self, value):
        """Ensure strong password"""
        if not re.search(r'[A-Z]', value):
            raise ValidationError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', value):
            raise ValidationError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', value):
            raise ValidationError('Password must contain at least one digit')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', value):
            raise ValidationError('Password must contain at least one special character')

class MoodLogSchema(Schema):
    """Validate mood log input"""
    mood_score = fields.Int(required=True, validate=validate.Range(min=1, max=10))
    note = fields.Str(validate=validate.Length(max=500))
    activities = fields.List(fields.Str(validate=validate.Length(max=50)), validate=validate.Length(max=10))
    timestamp = fields.DateTime()

class MemorySchema(Schema):
    """Validate memory input"""
    title = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    content = fields.Str(required=True, validate=validate.Length(min=1, max=5000))
    category = fields.Str(validate=validate.OneOf(['personal', 'work', 'family', 'other']))
    tags = fields.List(fields.Str(validate=validate.Length(max=30)), validate=validate.Length(max=20))
    is_favorite = fields.Bool()

class FeedbackSchema(Schema):
    """Validate feedback form input"""
    name = fields.Str(required=True, validate=validate.Length(min=2, max=100))
    email = fields.Email(required=True)
    message = fields.Str(required=True, validate=validate.Length(min=10, max=2000))
    rating = fields.Int(validate=validate.Range(min=1, max=5))
```

**Apply Validation in Routes** - Update `Backend/src/routes/auth.py`:
```python
from src.validators.schemas import UserRegistrationSchema
from marshmallow import ValidationError

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        # Validate input
        schema = UserRegistrationSchema()
        data = schema.load(request.get_json())
        
        # Proceed with registration
        email = data['email']
        password = data['password']
        name = data['name']
        
        # ... rest of registration logic ...
        
    except ValidationError as err:
        return jsonify({
            'success': False,
            'errors': err.messages
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
```

### Frontend Input Validation

**Create Validation Utilities** - `frontend/src/utils/validation.ts`:
```typescript
/**
 * Frontend input validation utilities
 * Note: Always validate on backend too! Frontend validation is for UX only.
 */

export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return { valid: false, error: 'Email is required' };
  if (!emailRegex.test(email)) return { valid: false, error: 'Invalid email format' };
  return { valid: true };
};

export const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Include at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Include at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Include at least one number');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Include at least one special character');
  
  return { valid: errors.length === 0, errors };
};

export const validateMoodScore = (score: number): { valid: boolean; error?: string } => {
  if (score < 1 || score > 10) return { valid: false, error: 'Mood score must be between 1-10' };
  return { valid: true };
};

export const sanitizeInput = (input: string, maxLength: number = 500): string => {
  // Remove potentially dangerous characters
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ''); // Remove iframes
};

export const validateUrl = (url: string): { valid: boolean; error?: string } => {
  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
};
```

**Use in Forms** - Update `frontend/src/components/Auth/RegisterForm.tsx`:
```typescript
import { validateEmail, validatePassword } from '../../utils/validation';

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  
  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    setError(emailValidation.error);
    return;
  }
  
  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    setError(passwordValidation.errors.join(', '));
    return;
  }
  
  // Proceed with registration
  // ...
};
```

---

## 🚀 5. Firestore Query Optimization

### Current Query Review

**Issues to Address**:
- ⚠️ Missing pagination on large collections
- ⚠️ No composite indexes for complex queries
- ⚠️ Inefficient queries fetching all documents

### Create Firestore Indexes

**`firestore.indexes.json`** (NEW):
```json
{
  "indexes": [
    {
      "collectionGroup": "moods",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "memories",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "memories",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "isFavorite", "order": "DESCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

**Deploy Indexes**:
```bash
firebase deploy --only firestore:indexes
```

### Implement Pagination

**Backend - Update `Backend/src/routes/mood_routes.py`**:
```python
from google.cloud.firestore_v1.base_query import FieldFilter

@mood_bp.route('/moods', methods=['GET'])
@token_required
def get_moods():
    try:
        user_id = request.user_id
        
        # Pagination parameters
        page_size = int(request.args.get('limit', 20))
        last_doc_id = request.args.get('cursor', None)
        
        # Build query
        query = db.collection('moods') \
            .where(filter=FieldFilter('userId', '==', user_id)) \
            .order_by('timestamp', direction='DESCENDING') \
            .limit(page_size)
        
        # Apply cursor for pagination
        if last_doc_id:
            last_doc = db.collection('moods').document(last_doc_id).get()
            if last_doc.exists:
                query = query.start_after(last_doc)
        
        # Execute query
        docs = query.stream()
        moods = []
        last_id = None
        
        for doc in docs:
            mood_data = doc.to_dict()
            mood_data['id'] = doc.id
            moods.append(mood_data)
            last_id = doc.id
        
        return jsonify({
            'success': True,
            'moods': moods,
            'next_cursor': last_id if len(moods) == page_size else None,
            'has_more': len(moods) == page_size
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
```

**Frontend - Update `frontend/src/api/mood.ts`**:
```typescript
export const getMoods = async (limit: number = 20, cursor?: string) => {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (cursor) params.append('cursor', cursor);
  
  const response = await api.get(`/moods?${params.toString()}`);
  return response.data;
};

// Infinite scroll implementation
export const useMoodsPaginated = () => {
  const [moods, setMoods] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  
  const loadMore = async () => {
    const data = await getMoods(20, cursor);
    setMoods(prev => [...prev, ...data.moods]);
    setCursor(data.next_cursor);
    setHasMore(data.has_more);
  };
  
  return { moods, loadMore, hasMore };
};
```

### Query Performance Best Practices

**DO**:
- ✅ Use indexes for all compound queries
- ✅ Implement pagination for large datasets
- ✅ Limit query results to necessary fields with `.select()`
- ✅ Use batch operations for multiple writes
- ✅ Cache frequently accessed data

**DON'T**:
- ❌ Fetch entire collections without limits
- ❌ Use array-contains on large arrays
- ❌ Perform client-side filtering on large datasets
- ❌ Make queries in loops (use batch operations)

---

## 🌐 6. CORS Configuration

### Production CORS Setup

**Backend - Update `Backend/main.py`**:
```python
from flask_cors import CORS
import os

# Production CORS configuration
allowed_origins = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')

# Remove empty strings and localhost in production
if os.getenv('FLASK_DEBUG', 'False') == 'False':
    allowed_origins = [origin for origin in allowed_origins if origin and 'localhost' not in origin]

CORS(app, 
     origins=allowed_origins,
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'],
     supports_credentials=True,  # For httpOnly cookies
     max_age=3600  # Cache preflight for 1 hour
)
```

**Production Environment**:
```bash
# Backend/.env
CORS_ALLOWED_ORIGINS=https://your-app.com,https://www.your-app.com,https://app.your-domain.com
```

---

## 🚦 7. API Rate Limiting

### Install Flask-Limiter

```bash
cd Backend
pip install Flask-Limiter==3.5.0
```

**Update `requirements.txt`**:
```
Flask-Limiter==3.5.0
```

### Configure Rate Limiting

**Backend/src/middleware/rate_limit.py** (NEW):
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

def get_user_id():
    """Get user ID from request for rate limiting"""
    from flask import request, g
    return getattr(g, 'user_id', get_remote_address())

limiter = Limiter(
    key_func=get_user_id,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",  # Use Redis in production: "redis://localhost:6379"
)
```

**Apply to Routes** - Update `Backend/main.py`:
```python
from src.middleware.rate_limit import limiter

limiter.init_app(app)

# Rate limits per route
@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("5 per minute")  # Prevent brute force
def login():
    # ...
```

**Production Redis Configuration**:
```python
# Use Redis for distributed rate limiting
limiter = Limiter(
    key_func=get_user_id,
    storage_uri=os.getenv('REDIS_URL', 'redis://localhost:6379'),
    strategy='fixed-window'
)
```

---

## 🛡️ 8. Security Headers

### Backend Security Headers

**Backend/src/middleware/security.py** - Add:
```python
@app.after_request
def set_security_headers(response):
    """Add security headers to all responses"""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    
    # Content Security Policy
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://api.your-app.com https://*.google.com; "
    )
    response.headers['Content-Security-Policy'] = csp
    
    return response
```

---

## ✅ 9. Deployment Checklist

### Pre-Deployment

- [ ] Generate strong JWT secrets (32+ chars)
- [ ] Configure production environment variables
- [ ] Remove all debug/development configurations
- [ ] Enable HTTPS on all endpoints
- [ ] Configure CORS with production URLs only
- [ ] Set up Firestore indexes
- [ ] Enable rate limiting
- [ ] Add security headers
- [ ] Test token expiration/refresh
- [ ] Implement input validation on all endpoints
- [ ] Review and sanitize all error messages
- [ ] Remove sensitive data from logs
- [ ] Configure backup strategy for Firestore
- [ ] Set up monitoring and alerting
- [ ] Test with production Firebase credentials
- [ ] Review and update CORS origins

### Post-Deployment

- [ ] Verify HTTPS is enforced
- [ ] Test authentication flow
- [ ] Monitor error rates
- [ ] Check API response times
- [ ] Verify rate limiting works
- [ ] Test offline functionality
- [ ] Check push notifications
- [ ] Run security scan (OWASP ZAP)
- [ ] Monitor token expiration/refresh
- [ ] Test payment flows (Stripe)
- [ ] Verify analytics are working
- [ ] Check all third-party integrations

---

## 📊 Security Monitoring

### Recommended Tools

1. **Sentry** - Error tracking and performance monitoring
2. **Google Cloud Monitoring** - Infrastructure and application metrics
3. **Firestore Security Rules** - Database access control
4. **Cloud Armor** - DDoS protection (GCP)
5. **OWASP ZAP** - Automated security testing

### Security Audit Schedule

- **Weekly**: Review authentication logs for suspicious activity
- **Monthly**: Update dependencies and review CVEs
- **Quarterly**: Full security audit with penetration testing
- **Annually**: Third-party security assessment

---

## 🎯 Next Steps

1. ✅ Review and implement JWT enhancements
2. ✅ Add input validation schemas
3. ✅ Create Firestore indexes
4. ✅ Configure production environment variables
5. ✅ Set up rate limiting
6. ✅ Deploy with HTTPS enforced
7. ✅ Monitor security metrics

---

**Last Updated**: October 19, 2025  
**Status**: ✅ Security hardening guide complete  
**Next**: Deploy to production following this guide
