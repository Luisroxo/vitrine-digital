#!/bin/bash

# Build script para microserviços
# Constrói todas as imagens Docker

echo "🔨 Building Vitrine Digital Microservices..."

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

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    error "Docker não está rodando. Por favor, inicie o Docker primeiro."
    exit 1
fi

# Build shared library primeiro
log "Building shared library..."
cd shared
npm install
cd ..

# Lista de serviços para build
services=("gateway" "auth-service" "product-service" "bling-service" "billing-service")

# Build cada serviço
for service in "${services[@]}"; do
    log "Building $service..."
    
    if [ -f "$service/Dockerfile" ]; then
        docker build -t "vitrine-digital-$service:latest" -f "$service/Dockerfile" .
        
        if [ $? -eq 0 ]; then
            log "✅ $service built successfully"
        else
            error "❌ Failed to build $service"
            exit 1
        fi
    else
        warn "$service/Dockerfile not found, skipping..."
    fi
done

log "🎉 All services built successfully!"

# Listar imagens criadas
log "📋 Docker images created:"
docker images | grep "vitrine-digital"

log "🚀 Ready to start services with: ./scripts/start.sh"