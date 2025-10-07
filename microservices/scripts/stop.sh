#!/bin/bash

# Stop script para microserviços
# Para todos os serviços Docker

echo "⏹️  Stopping Vitrine Digital Microservices..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

# Verificar se docker-compose.yml existe
if [ ! -f "docker-compose.yml" ]; then
    error "docker-compose.yml não encontrado no diretório atual."
    exit 1
fi

# Parar e remover containers
log "Parando containers..."
docker-compose down

# Opcional: remover volumes (descomente se quiser limpar dados)
# log "Removendo volumes..."
# docker-compose down -v

# Opcional: remover imagens (descomente para limpeza completa)
# log "Removendo imagens..."
# docker-compose down --rmi all

log "🛑 Todos os serviços foram parados!"

# Mostrar containers ainda rodando (se houver)
running_containers=$(docker ps -q --filter "name=vitrine-digital")
if [ ! -z "$running_containers" ]; then
    log "⚠️  Alguns containers ainda estão rodando:"
    docker ps --filter "name=vitrine-digital"
else
    log "✅ Nenhum container relacionado rodando"
fi