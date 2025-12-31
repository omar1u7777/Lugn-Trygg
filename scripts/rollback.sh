#!/bin/bash
# Rollback script for Lugn & Trygg production deployment
# This script rolls back the application to the previous stable version

set -e

echo "🚨 Starting rollback procedure for Lugn & Trygg..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ROLLBACK_TAG="rollback-$(date +%Y%m%d-%H%M%S)"
PREVIOUS_DEPLOYMENT="previous-deployment"

echo -e "${YELLOW}Step 1: Identifying previous stable deployment...${NC}"

# Check if we have a previous deployment to rollback to
if [ ! -f ".rollback-marker" ]; then
    echo -e "${RED}❌ No rollback marker found. Cannot determine previous stable version.${NC}"
    exit 1
fi

PREVIOUS_VERSION=$(cat .rollback-marker)
echo -e "${GREEN}✅ Found previous stable version: ${PREVIOUS_VERSION}${NC}"

echo -e "${YELLOW}Step 2: Creating rollback tag...${NC}"
git tag "$ROLLBACK_TAG" || echo "Tag creation failed, continuing..."

echo -e "${YELLOW}Step 3: Stopping current application...${NC}"

# Stop the application (adjust based on your deployment method)
if command -v docker-compose &> /dev/null; then
    echo "Stopping Docker containers..."
    docker-compose down || true
elif command -v pm2 &> /dev/null; then
    echo "Stopping PM2 processes..."
    pm2 stop all || true
    pm2 delete all || true
elif [ -f "package.json" ]; then
    echo "Stopping Node.js application..."
    pkill -f "node.*main.js" || true
    pkill -f "vite" || true
fi

echo -e "${YELLOW}Step 4: Restoring previous version...${NC}"

# Restore from backup or git
if [ -d "backups/$PREVIOUS_VERSION" ]; then
    echo "Restoring from backup..."
    cp -r "backups/$PREVIOUS_VERSION/*" ./
elif git rev-parse --verify "$PREVIOUS_VERSION" &> /dev/null; then
    echo "Rolling back to git commit/tag..."
    git checkout "$PREVIOUS_VERSION" --force
else
    echo -e "${RED}❌ No backup or git reference found for version: ${PREVIOUS_VERSION}${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 5: Restoring database from backup...${NC}"

# Restore database if needed
if [ -f "Backend/db_backup_$PREVIOUS_VERSION.sql" ]; then
    echo "Restoring database..."
    # Add your database restore command here
    # Example for PostgreSQL:
    # psql -U username -d database_name < "Backend/db_backup_$PREVIOUS_VERSION.sql"
    echo "Database restore command would go here"
fi

echo -e "${YELLOW}Step 6: Restarting application...${NC}"

# Restart the application
if [ -f "docker-compose.yml" ]; then
    echo "Starting Docker containers..."
    docker-compose up -d
elif [ -f "package.json" ]; then
    echo "Starting Node.js application..."
    npm run build
    npm run start &
elif [ -f "Backend/main.py" ]; then
    echo "Starting Python application..."
    cd Backend
    python main.py &
fi

echo -e "${YELLOW}Step 7: Running health checks...${NC}"

# Wait for application to start
sleep 30

# Health check
HEALTH_URL="http://localhost:3000/health"
if curl -f "$HEALTH_URL" &> /dev/null; then
    echo -e "${GREEN}✅ Application health check passed${NC}"
else
    echo -e "${RED}❌ Application health check failed${NC}"
    echo -e "${YELLOW}Manual intervention may be required${NC}"
fi

echo -e "${YELLOW}Step 8: Updating rollback marker...${NC}"
echo "$ROLLBACK_TAG" > .rollback-marker

echo -e "${GREEN}🎉 Rollback completed successfully!${NC}"
echo -e "${YELLOW}Previous version: ${PREVIOUS_VERSION}${NC}"
echo -e "${YELLOW}Rollback tag: ${ROLLBACK_TAG}${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Monitor application logs for any issues"
echo "2. Run full test suite to verify functionality"
echo "3. Notify team about the rollback"
echo "4. Investigate root cause of the issue that required rollback"
