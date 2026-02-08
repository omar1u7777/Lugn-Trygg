#!/bin/bash
# SSL Certificate Setup Script with Let's Encrypt
# Run this script on your production server to enable HTTPS

set -e  # Exit on error

echo "🔒 SSL Certificate Setup for Lugn & Trygg"
echo "=========================================="
echo ""

# Configuration
DOMAIN="lugn-trygg.com"
EMAIL="admin@lugn-trygg.com"
WEBROOT="/var/www/certbot"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Check if domain is set
if [ "$DOMAIN" == "lugn-trygg.com" ]; then
    echo "⚠️  WARNING: Using default domain. Update DOMAIN variable in this script."
    read -p "Enter your domain name: " DOMAIN
fi

if [ "$EMAIL" == "admin@lugn-trygg.com" ]; then
    read -p "Enter your email for SSL notifications: " EMAIL
fi

echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Install Certbot
echo "📦 Installing Certbot..."
if command -v apt-get &> /dev/null; then
    # Debian/Ubuntu
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
elif command -v yum &> /dev/null; then
    # CentOS/RHEL
    yum install -y certbot python3-certbot-nginx
else
    echo "❌ Unsupported OS. Install certbot manually."
    exit 1
fi

echo "✓ Certbot installed"
echo ""

# Create webroot directory
echo "📁 Creating webroot directory..."
mkdir -p $WEBROOT
chown -R www-data:www-data $WEBROOT 2>/dev/null || chown -R nginx:nginx $WEBROOT

# Test nginx configuration
echo "🔍 Testing nginx configuration..."
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Nginx configuration error. Fix before continuing."
    exit 1
fi

echo "✓ Nginx configuration valid"
echo ""

# Reload nginx
echo "🔄 Reloading nginx..."
systemctl reload nginx

# Obtain SSL certificate
echo "🔒 Obtaining SSL certificate from Let's Encrypt..."
certbot certonly \
    --webroot \
    --webroot-path=$WEBROOT \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN \
    -d www.$DOMAIN

if [ $? -ne 0 ]; then
    echo "❌ Failed to obtain SSL certificate"
    echo "Common issues:"
    echo "  1. Domain not pointing to this server"
    echo "  2. Port 80 not accessible"
    echo "  3. Firewall blocking HTTP traffic"
    exit 1
fi

echo "✓ SSL certificate obtained"
echo ""

# Setup auto-renewal
echo "⚙️  Setting up auto-renewal..."
cat > /etc/cron.d/certbot-renew << EOF
# Renew Let's Encrypt certificates twice daily
0 0,12 * * * root certbot renew --quiet --post-hook "systemctl reload nginx"
EOF

chmod 644 /etc/cron.d/certbot-renew

echo "✓ Auto-renewal configured"
echo ""

# Update nginx configuration for SSL
echo "🔧 Updating nginx configuration..."

# Check if SSL is already configured
if grep -q "ssl_certificate" /etc/nginx/sites-available/lugn-trygg 2>/dev/null; then
    echo "ℹ️  SSL already configured in nginx"
else
    echo "⚠️  Copy infra/nginx/nginx-production.conf to /etc/nginx/sites-available/lugn-trygg"
    echo "   and update domain names"
fi

# Enable site if not already enabled
if [ ! -f /etc/nginx/sites-enabled/lugn-trygg ]; then
    ln -s /etc/nginx/sites-available/lugn-trygg /etc/nginx/sites-enabled/
    echo "✓ Site enabled"
fi

# Test nginx with SSL
echo "🔍 Testing nginx with SSL configuration..."
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Nginx SSL configuration error"
    exit 1
fi

# Reload nginx with SSL
echo "🔄 Reloading nginx with SSL..."
systemctl reload nginx

echo ""
echo "=========================================="
echo "✅ SSL Setup Complete!"
echo "=========================================="
echo ""
echo "Certificate information:"
certbot certificates

echo ""
echo "📋 Next Steps:"
echo "1. Test HTTPS: https://$DOMAIN"
echo "2. Check SSL rating: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
echo "3. Test auto-renewal: certbot renew --dry-run"
echo "4. Update .env.production: CORS_ORIGINS=https://$DOMAIN"
echo ""
echo "🔐 Security Checklist:"
echo "[ ] HTTPS working correctly"
echo "[ ] HTTP redirects to HTTPS"
echo "[ ] SSL certificate valid"
echo "[ ] Security headers present"
echo "[ ] HSTS enabled"
echo "[ ] Auto-renewal tested"
echo ""
echo "Certificate expires: $(date -d "+90 days" +%Y-%m-%d)"
echo "Auto-renewal will run twice daily"
