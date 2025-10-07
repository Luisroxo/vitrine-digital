# 🌐 API Gateway - Enhanced Microservices Gateway

## 📋 Overview

O API Gateway é o ponto de entrada único para toda a arquitetura de microserviços da Vitrine Digital. Ele fornece roteamento, autenticação, autorização, balanceamento de carga, descoberta de serviços e recursos de segurança avançados.

## ✨ Features Implementadas

### 🔒 Security & Authentication
- **JWT Validation Pipeline**: Validação avançada de tokens com cache e blacklist
- **Role-Based Access Control (RBAC)**: Sistema hierárquico de permissões
- **Request Sanitization**: Proteção contra XSS, SQL Injection, Path Traversal
- **Rate Limiting**: Controle diferenciado por role e endpoint

### 🔍 Service Discovery & Load Balancing
- **Service Discovery**: Auto-descoberta e monitoramento de serviços
- **Health Checks**: Verificação contínua da saúde dos microserviços
- **Retry Policies**: Reenvio inteligente com backoff exponencial
- **Circuit Breaker**: Isolamento de falhas por serviço

### 📊 Monitoring & Observability
- **Comprehensive Health Endpoints**: `/health`, `/health/live`, `/health/ready`
- **Metrics Collection**: Coleta de métricas de performance e uso
- **Centralized Logging**: Logs estruturados com correlation IDs
- **System Monitoring**: Monitoramento de CPU, memória e event loop

## 🚀 Getting Started

### Installation
```bash
cd microservices/gateway
npm install
```

### Environment Variables
```env
# Gateway Configuration
GATEWAY_PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-jwt-secret-key

# Service URLs
AUTH_SERVICE_URL=http://auth-service:3001
PRODUCT_SERVICE_URL=http://product-service:3002
BLING_SERVICE_URL=http://bling-service:3003
BILLING_SERVICE_URL=http://billing-service:3004

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000
```

### Running
```bash
# Development
npm run dev

# Production
npm start

# Tests
npm test
```

## 📚 API Documentation

### Health Endpoints

#### GET /health
Comprehensive health check including system resources and service status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-07T12:00:00.000Z",
  "responseTime": 45,
  "version": "1.0.0",
  "environment": "production",
  "gateway": {
    "status": "running",
    "uptime": 3600,
    "metrics": {
      "requests": 1234,
      "errors": 5,
      "requestRate": 2.5
    }
  },
  "system": {
    "status": "healthy",
    "issues": []
  },
  "services": {
    "healthy": true,
    "total": 4,
    "healthy_count": 4,
    "unhealthy_count": 0
  }
}
```

#### GET /health/live
Kubernetes liveness probe - verifica se o gateway está vivo.

#### GET /health/ready
Kubernetes readiness probe - verifica se o gateway está pronto para receber tráfego.

### Management Endpoints

#### GET /services
Lista todos os serviços registrados (requer role `admin`).

#### GET /gateway/stats
Estatísticas detalhadas do gateway (requer role `admin`).

**Response:**
```json
{
  "serviceDiscovery": {
    "auth-service": {
      "url": "http://auth-service:3001",
      "status": "healthy",
      "responseTime": 25
    }
  },
  "retryPolicy": {
    "config": {
      "maxAttempts": 3,
      "baseDelay": 1000
    }
  },
  "jwtValidation": {
    "cacheSize": 150,
    "blacklistedTokens": 5
  },
  "roleRouter": {
    "totalRoutes": 26
  }
}
```

## 🛡️ Security Features

### JWT Validation Pipeline
- **Token Caching**: Cache de validações por 5 minutos
- **Blacklist Support**: Revogação instantânea de tokens
- **Role Hierarchy**: Sistema hierárquico de permissões
- **Tenant Isolation**: Isolamento automático por tenant

### Role-Based Routing
Controle de acesso granular por rota e método HTTP:

```javascript
// Configuração de exemplo
{
  "/products": {
    "GET": ["public"],
    "POST": ["admin", "manager"],
    "DELETE": ["admin"]
  },
  "/bling/*": ["lojista", "admin"],
  "/billing/admin/*": ["admin"]
}
```

### Request Sanitization
Proteção automática contra:
- **XSS**: Remoção de scripts maliciosos
- **SQL Injection**: Detecção de padrões SQL
- **Path Traversal**: Sanitização de caminhos
- **Command Injection**: Bloqueio de comandos

## 🔄 Service Discovery

### Automatic Registration
O gateway registra automaticamente os serviços configurados:

```javascript
const services = [
  {
    name: 'auth-service',
    url: 'http://auth-service:3001',
    healthPath: '/health',
    timeout: 30000
  }
];
```

### Health Monitoring
- **Interval**: Verificação a cada 30 segundos
- **Timeout**: 5 segundos por verificação
- **Failure Threshold**: 3 falhas consecutivas
- **Circuit Breaker**: Isolamento automático

### Load Balancing
Preparado para múltiplas instâncias:
```javascript
const service = {
  instances: [
    'http://service:3001',
    'http://service:3002'
  ],
  strategy: 'round-robin' // Futuro
};
```

## 🔧 Retry Policies

### Configuration
```javascript
{
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  exponentialBackoff: true,
  retryableStatuses: [429, 502, 503, 504, 408, 500],
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT']
}
```

### Usage Example
```javascript
// Automatic retry in proxy
const result = await req.retry(async () => {
  return await axios.get('/api/data');
}, 'get-data');
```

## 📊 Monitoring & Metrics

### Health Check Metrics
- **System**: CPU, memoria, load average
- **Application**: Event loop lag, heap usage
- **Services**: Status e tempo de resposta
- **Gateway**: Requests, errors, latencia

### Performance Monitoring
- **Request Rate**: Requests por segundo
- **Error Rate**: Percentual de erros
- **P95 Latency**: 95º percentil de latência
- **Circuit Breaker Status**: Estado dos circuit breakers

## 🔀 Routing Configuration

### Service Routes
```javascript
// Auth Service (Public + Protected)
app.use('/auth', authProxy);

// Product Service (Public read, Protected write)
app.use('/products', roleMiddleware, productProxy);

// Bling Service (Lojista+ required)
app.use('/bling', lojistaAuthMiddleware, blingProxy);

// Billing Service (Lojista+ required)
app.use('/billing', lojistaAuthMiddleware, billingProxy);
```

### Rate Limiting by Role
```javascript
const rateLimits = {
  'super_admin': { max: 10000, windowMs: 60000 },
  'admin': { max: 5000, windowMs: 60000 },
  'manager': { max: 2000, windowMs: 60000 },
  'lojista': { max: 1000, windowMs: 60000 },
  'user': { max: 500, windowMs: 60000 },
  'public': { max: 100, windowMs: 60000 }
};
```

## 🧪 Testing

### Test Coverage
- **Unit Tests**: 66 testes passando
- **Integration Tests**: Service discovery, JWT validation
- **Security Tests**: Role-based access, tenant isolation
- **Performance Tests**: Rate limiting, circuit breaker

### Running Tests
```bash
# All tests
npm test

# Specific test suite
npm test -- --testNamePattern="ServiceDiscovery"

# Watch mode
npm test -- --watch
```

## 🚀 Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Docker Compose
```yaml
gateway:
  build: ./gateway
  ports:
    - "3000:3000"
  environment:
    - NODE_ENV=production
    - JWT_SECRET=${JWT_SECRET}
  depends_on:
    - auth-service
    - product-service
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: gateway
  template:
    spec:
      containers:
      - name: gateway
        image: vitrine-digital/gateway:latest
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
```

## 📈 Performance Optimizations

### Implemented
- **Connection Pooling**: Reutilização de conexões HTTP
- **Response Compression**: Compressão gzip automática
- **Token Caching**: Cache JWT para reduzir validações
- **Circuit Breakers**: Isolamento de falhas
- **Request Timeouts**: Timeouts configuráveis por serviço

### Future Improvements
- **Redis Caching**: Cache distribuído
- **Connection Keep-Alive**: Conexões persistentes
- **Request Batching**: Agrupamento de requests
- **Load Balancing**: Algoritmos avançados

## 🔧 Configuration

### Service-Specific Timeouts
```javascript
const serviceConfigs = {
  'auth-service': { timeout: 30000 },
  'product-service': { timeout: 30000 },
  'bling-service': { timeout: 45000 }, // Bling pode ser mais lento
  'billing-service': { timeout: 30000 }
};
```

### Security Headers
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"]
    }
  }
}));
```

## 🐛 Troubleshooting

### Common Issues

#### Service Discovery Failures
```bash
# Check service health
curl http://localhost:3000/services

# Check specific service
curl http://localhost:3000/health?details=true
```

#### JWT Validation Errors
```bash
# Check token cache stats
curl -H "Authorization: Bearer admin-token" http://localhost:3000/gateway/stats

# Clear token cache (restart gateway)
docker restart gateway
```

#### High Latency
```bash
# Check metrics
curl http://localhost:3000/metrics

# Check circuit breaker status
curl http://localhost:3000/circuit-breaker
```

### Debug Logs
```javascript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Check correlation IDs
grep "correlation-id-123" logs/gateway.log
```

## 🔮 Future Roadmap

### Phase 1 (Completed ✅)
- [x] Service Discovery
- [x] Health Checks
- [x] JWT Validation Pipeline
- [x] Role-Based Routing
- [x] Request Sanitization
- [x] Retry Policies

### Phase 2 (Next Sprint)
- [ ] Redis Integration
- [ ] Advanced Load Balancing
- [ ] Prometheus Metrics
- [ ] Distributed Tracing
- [ ] GraphQL Gateway

### Phase 3 (Future)
- [ ] gRPC Support
- [ ] WebSocket Proxying
- [ ] API Versioning
- [ ] Mock Services
- [ ] A/B Testing

## 📞 Support

Para problemas ou dúvidas sobre o Gateway:

1. **Logs**: Verificar logs do container
2. **Health Endpoints**: Usar `/health` para diagnóstico  
3. **Metrics**: Monitorar `/metrics` e `/gateway/stats`
4. **Circuit Breakers**: Verificar `/circuit-breaker`

---

**Status**: ✅ **COMPLETO - Gateway MVP** 
**Última Atualização**: 07/10/2025
**Próximo Passo**: Billing Service Implementation