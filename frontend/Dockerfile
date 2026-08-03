# Multi-stage Dockerfile for WeMarket Frontend
# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application (CI=true skips the puppeteer-based critical-CSS step)
RUN CI=true npm run build

# Stage 2: Production runtime (using nginx for static file serving)
FROM nginx:1.27-alpine AS production

# The official nginx image already provides the nginx user/group,
# so no addgroup/adduser is needed (re-creating it fails with exit 1).

# Upgrade base image packages to get security fixes
RUN apk upgrade --no-cache

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Change ownership
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /var/run

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
