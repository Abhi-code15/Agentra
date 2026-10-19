# Multi-stage Dockerfile for Agentra Backend
FROM node:24-alpine AS base

WORKDIR /app

# Install dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Copy application source
COPY server/src ./server/src
COPY server/migrations ./server/migrations

# Expose port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

# Run as non-root user
USER node

WORKDIR /app/server
CMD ["node", "src/server.js"]
