# Multi-stage Dockerfile for Lugn & Trygg Frontend
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Install all dependencies (devDependencies needed for build)
RUN npm ci && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NODE_ENV=production

# All VITE_ build args must be declared here to be available during `npm run build`.
# docker-compose.yml passes these as build.args — undeclared ARGs are silently dropped.
ARG VITE_BACKEND_URL=https://api.lugntrygg.se
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID
ARG VITE_FIREBASE_VAPID_KEY
ARG VITE_ENCRYPTION_KEY
ARG VITE_DASHBOARD_HERO_PUBLIC_ID
ARG VITE_WELLNESS_HERO_PUBLIC_ID
ARG VITE_JOURNAL_HERO_PUBLIC_ID
ARG VITE_ONBOARDING_HERO_PUBLIC_ID
ARG VITE_CLOUDINARY_CLOUD_NAME
ARG VITE_CLOUDINARY_UPLOAD_PRESET
ARG VITE_SENTRY_DSN
ARG VITE_VERCEL_ANALYTICS_ID
ARG VITE_ENABLE_WEB_VITALS=true
ARG VITE_FORCE_ANALYTICS=false
ARG VITE_ENABLE_PERFORMANCE_MONITORING=true
ARG VITE_ENABLE_CORE_WEB_VITALS=true
ARG VITE_ENABLE_USER_TIMING=true

# Vite reads VITE_* env vars at build time — expose ARGs as ENV for the build step.
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL} \
    VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY} \
    VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN} \
    VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID} \
    VITE_FIREBASE_STORAGE_BUCKET=${VITE_FIREBASE_STORAGE_BUCKET} \
    VITE_FIREBASE_MESSAGING_SENDER_ID=${VITE_FIREBASE_MESSAGING_SENDER_ID} \
    VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID} \
    VITE_FIREBASE_MEASUREMENT_ID=${VITE_FIREBASE_MEASUREMENT_ID} \
    VITE_FIREBASE_VAPID_KEY=${VITE_FIREBASE_VAPID_KEY} \
    VITE_ENCRYPTION_KEY=${VITE_ENCRYPTION_KEY} \
    VITE_DASHBOARD_HERO_PUBLIC_ID=${VITE_DASHBOARD_HERO_PUBLIC_ID} \
    VITE_WELLNESS_HERO_PUBLIC_ID=${VITE_WELLNESS_HERO_PUBLIC_ID} \
    VITE_JOURNAL_HERO_PUBLIC_ID=${VITE_JOURNAL_HERO_PUBLIC_ID} \
    VITE_ONBOARDING_HERO_PUBLIC_ID=${VITE_ONBOARDING_HERO_PUBLIC_ID} \
    VITE_CLOUDINARY_CLOUD_NAME=${VITE_CLOUDINARY_CLOUD_NAME} \
    VITE_CLOUDINARY_UPLOAD_PRESET=${VITE_CLOUDINARY_UPLOAD_PRESET} \
    VITE_SENTRY_DSN=${VITE_SENTRY_DSN} \
    VITE_VERCEL_ANALYTICS_ID=${VITE_VERCEL_ANALYTICS_ID} \
    VITE_ENABLE_WEB_VITALS=${VITE_ENABLE_WEB_VITALS} \
    VITE_FORCE_ANALYTICS=${VITE_FORCE_ANALYTICS} \
    VITE_ENABLE_PERFORMANCE_MONITORING=${VITE_ENABLE_PERFORMANCE_MONITORING} \
    VITE_ENABLE_CORE_WEB_VITALS=${VITE_ENABLE_CORE_WEB_VITALS} \
    VITE_ENABLE_USER_TIMING=${VITE_ENABLE_USER_TIMING}

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM nginx:alpine AS runner
WORKDIR /app

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create non-root user and set permissions
RUN addgroup -g 101 -S nginx-user || true && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx-user nginx-user || true && \
    chown -R 101:101 /var/cache/nginx /var/log/nginx /usr/share/nginx/html && \
    touch /var/run/nginx.pid && chown 101:101 /var/run/nginx.pid

USER 101

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Expose port
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]