# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Remove Windows-specific dependencies that cause issues in Linux containers
RUN npm uninstall @rollup/rollup-win32-x64-msvc || true

# Explicitly install the Linux-specific rollup package
RUN npm install @rollup/rollup-linux-x64-musl --save-optional || true

# Install dependencies with npm ci to ensure correct platform-specific packages
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]