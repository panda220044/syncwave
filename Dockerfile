# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install build tools needed for better-sqlite3 (native module)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

# Install all workspace dependencies from root
RUN npm install --legacy-peer-deps

# Copy source files
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

# Build the server
WORKDIR /app/apps/server
RUN npm run build

# ── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

# Install production deps only
RUN npm install --legacy-peer-deps --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Create data directory for SQLite
RUN mkdir -p /data/uploads

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

WORKDIR /app/apps/server

CMD ["node", "dist/server.js"]
