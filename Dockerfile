# Multi-stage Dockerfile for WeMarket API
# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
# --ignore-scripts: prisma generate runs after source copy (prisma is a devDependency)
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Stage 2: Production runtime
FROM node:22-alpine AS production

# Use the node user/group bundled with the official node image
# (newer Alpine adduser/addgroup changed -S handling; the built-in node user avoids that)

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --ignore-scripts

# Remove the npm CLI (not needed at runtime) to drop the base image's bundled
# vulnerable deps (tar, brace-expansion, picomatch, sigstore) from the image
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Copy built application from builder stage
COPY --from=builder /app/app ./app
COPY --from=builder /app/controllers ./controllers
COPY --from=builder /app/services ./services
COPY --from=builder /app/repositories ./repositories
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/config ./config
COPY --from=builder /app/socket ./socket
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/app.js ./app.js
COPY --from=builder /app/index.js ./index.js
COPY --from=builder /app/.env.example ./.env.example

# Copy Prisma client from builder (custom output is relative to schema dir: prisma/app/generated)
COPY --from=builder /app/prisma/app/generated ./prisma/app/generated
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Change ownership to non-root user
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http=require('http');const options={hostname:'localhost',port:3000,path:'/api/health',timeout:2000};const req=http.request(options,(res)=>{process.exit(res.statusCode===200?0:1)});req.on('error',()=>process.exit(1));req.end();"

# Start the application
CMD ["node", "index.mts"]
