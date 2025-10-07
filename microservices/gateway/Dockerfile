FROM node:18-alpine

WORKDIR /app

# Copy shared dependencies
COPY shared/ /app/shared/

# Copy gateway files
COPY gateway/package*.json ./
RUN npm ci --only=production

COPY gateway/src/ ./src/
COPY gateway/config/ ./config/

# Create logs directory
RUN mkdir -p logs

EXPOSE 3000

USER node

CMD ["node", "src/server.js"]