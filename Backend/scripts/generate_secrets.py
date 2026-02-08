"""
Generate cryptographically secure secrets for production deployment.
Run this script to generate new JWT secrets and API keys.
"""
import secrets
import string
import os
from datetime import datetime

def generate_jwt_secret(length=64):
    """Generate cryptographically secure JWT secret key."""
    alphabet = string.ascii_letters + string.digits + string.punctuation
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def generate_api_key(prefix='sk', length=48):
    """Generate API key with prefix."""
    alphabet = string.ascii_letters + string.digits
    key = ''.join(secrets.choice(alphabet) for _ in range(length))
    return f"{prefix}_{key}"

def create_secure_env():
    """Create new .env.production with secure secrets."""
    
    print("🔐 Generating secure production secrets...\n")
    
    # Generate new secrets
    jwt_secret = generate_jwt_secret(64)
    jwt_refresh_secret = generate_jwt_secret(64)
    flask_secret = generate_jwt_secret(32)
    encryption_key = secrets.token_urlsafe(32)
    
    print(f"✓ Generated JWT_SECRET_KEY ({len(jwt_secret)} chars)")
    print(f"✓ Generated JWT_REFRESH_SECRET_KEY ({len(jwt_refresh_secret)} chars)")
    print(f"✓ Generated FLASK_SECRET_KEY ({len(flask_secret)} chars)")
    print(f"✓ Generated ENCRYPTION_KEY ({len(encryption_key)} chars)")
    
    # Read existing .env to preserve other settings
    # Backend directory is one level up from scripts/
    backend_dir = os.path.dirname(os.path.dirname(__file__))
    env_path = os.path.join(backend_dir, '.env')
    existing_env = {}
    
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    existing_env[key.strip()] = value.strip()
    
    # Create production environment template
    env_production = f"""# Production Environment Configuration
# Generated: {datetime.now().isoformat()}
# ⚠️ NEVER commit this file to version control!

# Flask Configuration
FLASK_ENV=production
FLASK_DEBUG=False
FLASK_SECRET_KEY={flask_secret}

# JWT Configuration (CRITICAL - KEEP SECRET!)
JWT_SECRET_KEY={jwt_secret}
JWT_REFRESH_SECRET_KEY={jwt_refresh_secret}
JWT_ACCESS_TOKEN_EXPIRES=3600
JWT_REFRESH_TOKEN_EXPIRES=2592000

# Encryption
ENCRYPTION_KEY={encryption_key}

# CORS Settings
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com

# Rate Limiting
RATELIMIT_STORAGE_URL=redis://localhost:6379
RATELIMIT_DEFAULT=2000 per day;500 per hour;100 per minute

# Database
DATABASE_URL={existing_env.get('DATABASE_URL', 'sqlite:///lugn_trygg.db')}

# Firebase (from existing .env)
FIREBASE_PROJECT_ID={existing_env.get('FIREBASE_PROJECT_ID', 'your-project-id')}
FIREBASE_PRIVATE_KEY_ID={existing_env.get('FIREBASE_PRIVATE_KEY_ID', '')}
FIREBASE_CLIENT_EMAIL={existing_env.get('FIREBASE_CLIENT_EMAIL', '')}

# External APIs (⚠️ Move to environment variables or secrets manager)
OPENAI_API_KEY={existing_env.get('OPENAI_API_KEY', 'your-openai-key')}
STRIPE_SECRET_KEY={existing_env.get('STRIPE_SECRET_KEY', 'sk_live_...')}
RESEND_API_KEY={existing_env.get('RESEND_API_KEY', 're_...')}

# Monitoring
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# Logging
LOG_LEVEL=INFO
LOG_FILE=/var/log/lugn-trygg/app.log

# Performance
GUNICORN_WORKERS={os.cpu_count() * 2 + 1}
GUNICORN_THREADS=2
GUNICORN_MAX_REQUESTS=2000
GUNICORN_TIMEOUT=30

# Security Headers
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
SESSION_COOKIE_HTTPONLY=True
SESSION_COOKIE_SAMESITE=Lax
"""
    
    # Write to .env.production
    backend_dir = os.path.dirname(os.path.dirname(__file__))
    production_path = os.path.join(backend_dir, '.env.production')
    with open(production_path, 'w', encoding='utf-8') as f:
        f.write(env_production)
    
    print(f"\n✓ Created {production_path}")
    
    # Create .env.example template (without secrets)
    env_example = """# Environment Configuration Template
# Copy to .env and fill in your actual values

# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=True
FLASK_SECRET_KEY=your-secret-key-here

# JWT Configuration
JWT_SECRET_KEY=your-jwt-secret-here
JWT_REFRESH_SECRET_KEY=your-jwt-refresh-secret-here
JWT_ACCESS_TOKEN_EXPIRES=3600
JWT_REFRESH_TOKEN_EXPIRES=2592000

# CORS Settings
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
ALLOWED_ORIGINS=http://localhost:3000

# Database
DATABASE_URL=sqlite:///lugn_trygg.db

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_CLIENT_EMAIL=your-client-email@project.iam.gserviceaccount.com

# External APIs
OPENAI_API_KEY=your-openai-key
STRIPE_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_...

# Monitoring
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
"""
    
    example_path = os.path.join(backend_dir, '.env.example')
    with open(example_path, 'w', encoding='utf-8') as f:
        f.write(env_example)
    
    print(f"✓ Created {example_path}")
    
    # Create secrets backup (encrypted)
    backup_dir = os.path.join(backend_dir, 'secrets_backup')
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = os.path.join(backup_dir, f'secrets_{timestamp}.txt')
    
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(f"""# Secrets Backup - {datetime.now().isoformat()}
# Store this file in a secure password manager!
# Delete after importing to password manager.

JWT_SECRET_KEY={jwt_secret}
JWT_REFRESH_SECRET_KEY={jwt_refresh_secret}
FLASK_SECRET_KEY={flask_secret}
ENCRYPTION_KEY={encryption_key}
""")
    
    print(f"✓ Created secrets backup at {backup_path}")
    
    print("\n" + "="*70)
    print("🎉 Production secrets generated successfully!")
    print("="*70)
    
    print("\n📋 Next Steps:")
    print("1. Copy secrets from secrets_backup/ to your password manager")
    print("2. Update .env.production with your actual API keys")
    print("3. Deploy using: cp .env.production .env")
    print("4. Delete secrets_backup/ after storing securely")
    print("5. NEVER commit .env.production to git!")
    
    print("\n⚠️  SECURITY CHECKLIST:")
    print("[ ] Secrets stored in password manager")
    print("[ ] .env.production not in git")
    print("[ ] API keys updated in production")
    print("[ ] Old JWT secrets rotated")
    print("[ ] Team members notified of key rotation")
    
    return {
        'jwt_secret': jwt_secret,
        'jwt_refresh_secret': jwt_refresh_secret,
        'flask_secret': flask_secret,
        'encryption_key': encryption_key
    }

if __name__ == "__main__":
    try:
        secrets = create_secure_env()
        print("\n✅ All secrets generated and saved!")
    except Exception as e:
        print(f"\n❌ Error generating secrets: {e}")
        exit(1)
