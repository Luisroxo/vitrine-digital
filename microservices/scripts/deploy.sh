#!/bin/bash

# Deploy script para produção
# Deploy dos microserviços em ambiente de produção

echo "🚀 Deploying Vitrine Digital Microservices to Production..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Verificações pré-deploy
log "Executando verificações pré-deploy..."

# Verificar se está no ambiente correto
if [ "$NODE_ENV" != "production" ]; then
    warn "NODE_ENV não está definido como 'production'"
    read -p "Continuar mesmo assim? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        error "Deploy cancelado pelo usuário"
        exit 1
    fi
fi

# Verificar variáveis de ambiente obrigatórias
required_vars=("JWT_SECRET" "POSTGRES_PASSWORD")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        error "Variável de ambiente obrigatória não definida: $var"
        exit 1
    fi
done

# Build das imagens com tag de produção
log "Building production images..."
VERSION=${VERSION:-$(date +%Y%m%d-%H%M%S)}
info "Using version tag: $VERSION"

services=("gateway" "auth-service" "product-service" "bling-service" "billing-service")

for service in "${services[@]}"; do
    log "Building $service:$VERSION..."
    docker build -t "vitrine-digital-$service:$VERSION" -t "vitrine-digital-$service:latest" -f "$service/Dockerfile" .
    
    if [ $? -eq 0 ]; then
        log "✅ $service:$VERSION built successfully"
    else
        error "❌ Failed to build $service:$VERSION"
        exit 1
    fi
done

# Push para registry (se configurado)
if [ ! -z "$DOCKER_REGISTRY" ]; then
    log "Pushing images to registry: $DOCKER_REGISTRY"
    
    for service in "${services[@]}"; do
        log "Pushing $service..."
        
        # Tag para o registry
        docker tag "vitrine-digital-$service:$VERSION" "$DOCKER_REGISTRY/vitrine-digital-$service:$VERSION"
        docker tag "vitrine-digital-$service:latest" "$DOCKER_REGISTRY/vitrine-digital-$service:latest"
        
        # Push
        docker push "$DOCKER_REGISTRY/vitrine-digital-$service:$VERSION"
        docker push "$DOCKER_REGISTRY/vitrine-digital-$service:latest"
        
        if [ $? -eq 0 ]; then
            log "✅ $service pushed successfully"
        else
            error "❌ Failed to push $service"
            exit 1
        fi
    done
fi

# Deploy usando docker-compose.prod.yml se existir
if [ -f "docker-compose.prod.yml" ]; then
    log "Deploying with production configuration..."
    
    # Backup da configuração anterior (se existir)
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        log "Creating backup of current deployment..."
        docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres vitrine_digital > backup-$(date +%Y%m%d-%H%M%S).sql
    fi
    
    # Deploy
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml up --build -d
    
else
    warn "docker-compose.prod.yml não encontrado, usando configuração padrão..."
    docker-compose down
    docker-compose up --build -d
fi

# Health check pós-deploy
log "Executando health checks..."
sleep 30

for service_port in "${services[@]}"; do
    service=$(echo $service_port | cut -d: -f1)
    port=${service_port##*:}
    
    if [ "$service" = "gateway" ]; then port=3000; fi
    if [ "$service" = "auth-service" ]; then port=3001; fi
    if [ "$service" = "product-service" ]; then port=3002; fi
    if [ "$service" = "bling-service" ]; then port=3003; fi
    if [ "$service" = "billing-service" ]; then port=3004; fi
    
    log "Health check: $service on port $port..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health)
    
    if [ "$response" = "200" ]; then
        log "✅ $service is healthy"
    else
        error "❌ $service health check failed (HTTP $response)"
    fi
done

# Executar testes de fumaça se existirem
if [ -f "tests/smoke-tests.sh" ]; then
    log "Executando smoke tests..."
    ./tests/smoke-tests.sh
fi

log "🎉 Deploy completed successfully!"
log "📊 Version deployed: $VERSION"
log "🌐 API Gateway: http://localhost:3000"

# Notificação (webhook, Slack, etc. - configure conforme necessário)
if [ ! -z "$DEPLOY_WEBHOOK_URL" ]; then
    curl -X POST "$DEPLOY_WEBHOOK_URL" \
         -H "Content-Type: application/json" \
         -d "{\"text\": \"✅ Vitrine Digital microservices deployed successfully! Version: $VERSION\"}"
fi