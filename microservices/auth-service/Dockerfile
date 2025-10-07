FROM node:18-alpine

WORKDIR /app

# Create logs directory
RUN mkdir -p logs

# Copy shared dependencies first
COPY shared/ ./shared/

# Install shared dependencies
RUN cd shared && npm install

# Copy auth service files
COPY auth-service/package*.json ./
RUN npm ci --only=production

# Copy source code
COPY auth-service/src/ ./src/
COPY auth-service/knexfile.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

CMD ["node", "src/index.js"]