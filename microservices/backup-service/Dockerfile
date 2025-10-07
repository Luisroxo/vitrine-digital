# Dockerfile para o sistema de backup
FROM node:18-alpine

# Instalar ferramentas de backup
RUN apk add --no-cache \
    postgresql-client \
    mysql-client \
    tar \
    gzip \
    aws-cli

# Criar diretório de trabalho
WORKDIR /app

# Criar diretórios de backup
RUN mkdir -p /app/backups/{daily,weekly,monthly,temp}

# Copiar dependências
COPY package*.json ./
RUN npm ci --only=production

# Copiar código do sistema de backup
COPY microservices/shared/services/AutomatedBackupSystem.js ./services/
COPY microservices/shared/routes/backupRoutes.js ./routes/
COPY microservices/shared/utils/ ./utils/

# Criar script de inicialização
RUN echo '#!/bin/sh\nnode -e "const BackupSystem = require(\"./services/AutomatedBackupSystem\"); const system = new BackupSystem(); system.start();"' > /app/start-backup.sh
RUN chmod +x /app/start-backup.sh

# Expor porta para API
EXPOSE 3005

# Volumes para persistência
VOLUME ["/app/backups", "/app/logs"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3005/api/shared/backup/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Comando padrão
CMD ["node", "services/AutomatedBackupSystem.js"]