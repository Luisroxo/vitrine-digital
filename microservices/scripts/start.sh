#!/bin/bash

# Start script para microserviços
# Inicia todos os serviços usando Docker Compose

echo "🚀 Starting Vitrine Digital Microservices..."

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

# Verificar se docker-compose.yml existe
if [ ! -f "docker-compose.yml" ]; then
    error "docker-compose.yml não encontrado no diretório atual."
    exit 1
fi

log "Verificando variáveis de ambiente..."

# Criar .env se não existir
if [ ! -f ".env" ]; then
    warn "Arquivo .env não encontrado. Criando template..."
    cat > .env << EOF
# Database Configuration
POSTGRES_PASSWORD=password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Bling Integration
BLING_CLIENT_ID=your-bling-client-id
BLING_CLIENT_SECRET=your-bling-client-secret

# Environment
NODE_ENV=development

# Logging
LOG_LEVEL=info

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
EOF
    warn "⚠️  .env criado com valores padrão. Configure as variáveis antes da produção!"
fi

# Parar serviços existentes se estiverem rodando
log "Parando serviços existentes..."
docker-compose down

# Executar migrações se necessário
log "Verificando migrations..."

# Iniciar serviços
log "Iniciando serviços em modo detached..."
docker-compose up --build -d

# Verificar se os serviços subiram
log "Aguardando serviços iniciarem..."
sleep 10

# Health check dos serviços
services=("gateway:3000" "auth-service:3001" "product-service:3002" "bling-service:3003" "billing-service:3004")

for service_port in "${services[@]}"; do
    service=$(echo $service_port | cut -d: -f1)
    port=$(echo $service_port | cut -d: -f2)
    
    log "Verificando $service na porta $port..."
    
    # Tentar conectar com timeout
    timeout 30 bash -c "until curl -f http://localhost:$port/health &>/dev/null; do sleep 2; done"
    
    if [ $? -eq 0 ]; then
        log "✅ $service está rodando"
    else
        warn "⚠️  $service pode não estar totalmente pronto (porta $port)"
    fi
done

log "🎉 Microserviços iniciados!"
log "📊 API Gateway: http://localhost:3000"
log "🔐 Auth Service: http://localhost:3001"
log "📦 Product Service: http://localhost:3002"
log "🔗 Bling Service: http://localhost:3003"
log "💰 Billing Service: http://localhost:3004"
log "📈 Prometheus: http://localhost:9090"
log "📊 Grafana: http://localhost:3001 (admin/admin)"

log "📋 Para ver os logs: docker-compose logs -f [service-name]"
log "⏹️  Para parar: ./scripts/stop.sh"