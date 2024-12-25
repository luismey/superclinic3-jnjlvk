# Stage 1: Dependencies
FROM node:18-alpine AS deps
LABEL stage=builder

# Install additional dependencies for node-gyp and other build requirements
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies with frozen lockfile for reproducible builds
RUN yarn install --frozen-lockfile --network-timeout 1000000 && \
    # Remove unnecessary files
    yarn cache clean && \
    # Create .next directory and set permissions
    mkdir .next && \
    chmod -R 777 .next

# Stage 2: Builder
FROM node:18-alpine AS builder
LABEL stage=builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.next ./.next

# Copy source files
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Run type checking and build
RUN yarn type-check && \
    yarn build && \
    # Remove dev dependencies
    yarn install --production --ignore-scripts --prefer-offline && \
    # Remove unnecessary files
    rm -rf .git .github .next/cache

# Stage 3: Runner
FROM node:18-alpine AS runner
LABEL stage=production

# Install security updates and basic tools
RUN apk update && \
    apk upgrade && \
    apk add --no-cache curl wget && \
    # Create non-root user
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    # Clean up
    rm -rf /var/cache/apk/*

WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384"
ENV PORT=3000

# Copy necessary files from builder
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Security hardening
RUN chmod -R 555 /app && \
    chmod -R 444 /app/public && \
    # Make .next/cache writable
    mkdir -p .next/cache && \
    chmod -R 777 .next/cache

# Switch to non-root user
USER nextjs

# Expose application port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["yarn", "start"]