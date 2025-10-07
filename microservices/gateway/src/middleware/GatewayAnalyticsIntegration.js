/**
 * @fileoverview Gateway Analytics Integration
 * @version 1.0.0
 * @description Middleware para integração do Gateway com Advanced Analytics Service
 */

const AdvancedAnalyticsService = require('../shared/services/AdvancedAnalyticsService');

class GatewayAnalyticsIntegration {
  constructor() {
    this.analyticsService = new AdvancedAnalyticsService();
    this.requestCounters = new Map();
    this.responseTimeTracker = new Map();
  }

  /**
   * Middleware para rastreamento de requisições
   */
  requestTrackingMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      req.analyticsStartTime = startTime;
      
      // Incrementar contador de requisições por serviço
      const service = this.extractServiceFromPath(req.path);
      const currentCount = this.requestCounters.get(service) || 0;
      this.requestCounters.set(service, currentCount + 1);
      
      // Middleware para capturar resposta
      const originalSend = res.send;
      res.send = function(data) {
        const responseTime = Date.now() - startTime;
        
        // Registrar métricas de resposta
        req.gatewayIntegration.recordResponseMetrics(req, res, responseTime);
        
        return originalSend.call(this, data);
      };
      
      req.gatewayIntegration = this;
      next();
    };
  }

  /**
   * Registrar métricas de resposta
   */
  recordResponseMetrics(req, res, responseTime) {
    const service = this.extractServiceFromPath(req.path);
    const endpoint = `${req.method} ${req.path}`;
    
    // Métricas em tempo real
    this.analyticsService.recordRealTimeMetric({
      serviceName: 'gateway',
      metricName: 'request_response_time',
      metricValue: responseTime,
      metricType: 'gauge',
      metadata: {
        service: service,
        endpoint: endpoint,
        statusCode: res.statusCode,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });

    // Métricas de negócio se for endpoint relacionado
    if (this.isBusinessEndpoint(req.path)) {
      this.recordBusinessMetrics(req, res, responseTime);
    }

    // Salvar tempo de resposta para cálculos posteriores
    const responseKey = `${service}:${endpoint}`;
    const times = this.responseTimeTracker.get(responseKey) || [];
    times.push(responseTime);
    
    // Manter apenas os últimos 100 tempos para cálculo de média
    if (times.length > 100) {
      times.splice(0, times.length - 100);
    }
    
    this.responseTimeTracker.set(responseKey, times);
  }

  /**
   * Registrar métricas de negócio
   */
  recordBusinessMetrics(req, res, responseTime) {
    const path = req.path.toLowerCase();
    
    try {
      if (path.includes('/products') && req.method === 'GET') {
        this.analyticsService.recordBusinessMetric({
          metricName: 'product_views',
          metricValue: 1,
          category: 'engagement',
          metadata: {
            productId: req.params.id,
            source: 'gateway',
            responseTime: responseTime
          }
        });
      }
      
      if (path.includes('/orders') && req.method === 'POST' && res.statusCode === 201) {
        // Assumindo que o body contém informações do pedido
        const orderValue = req.body?.total || 0;
        
        this.analyticsService.recordBusinessMetric({
          metricName: 'order_created',
          metricValue: orderValue,
          category: 'sales',
          metadata: {
            orderId: res.locals?.orderId,
            customerId: req.body?.customerId,
            items: req.body?.items?.length || 0,
            source: 'gateway'
          }
        });
        
        this.analyticsService.recordBusinessMetric({
          metricName: 'revenue',
          metricValue: orderValue,
          category: 'financial',
          metadata: {
            source: 'order_creation',
            orderId: res.locals?.orderId
          }
        });
      }
      
      if (path.includes('/auth/login') && res.statusCode === 200) {
        this.analyticsService.recordBusinessMetric({
          metricName: 'user_login',
          metricValue: 1,
          category: 'engagement',
          metadata: {
            source: 'gateway',
            responseTime: responseTime
          }
        });
      }
      
      if (path.includes('/auth/register') && res.statusCode === 201) {
        this.analyticsService.recordBusinessMetric({
          metricName: 'user_registration',
          metricValue: 1,
          category: 'growth',
          metadata: {
            source: 'gateway',
            responseTime: responseTime
          }
        });
      }
    } catch (error) {
      console.error('Error recording business metrics:', error);
    }
  }

  /**
   * Middleware para rastreamento de erros
   */
  errorTrackingMiddleware() {
    return (err, req, res, next) => {
      const service = this.extractServiceFromPath(req.path);
      const responseTime = req.analyticsStartTime ? Date.now() - req.analyticsStartTime : 0;
      
      // Registrar erro como métrica
      this.analyticsService.recordRealTimeMetric({
        serviceName: 'gateway',
        metricName: 'error_count',
        metricValue: 1,
        metricType: 'counter',
        metadata: {
          service: service,
          errorMessage: err.message,
          errorStack: err.stack,
          statusCode: err.status || 500,
          endpoint: `${req.method} ${req.path}`,
          responseTime: responseTime
        }
      });
      
      next(err);
    };
  }

  /**
   * Coletar métricas agregadas do gateway
   */
  async collectGatewayMetrics() {
    try {
      const metrics = {
        totalRequests: Array.from(this.requestCounters.values()).reduce((a, b) => a + b, 0),
        requestsByService: Object.fromEntries(this.requestCounters),
        averageResponseTimes: this.calculateAverageResponseTimes(),
        timestamp: new Date().toISOString()
      };

      // Registrar métricas agregadas
      await this.analyticsService.recordBusinessMetric({
        metricName: 'gateway_total_requests',
        metricValue: metrics.totalRequests,
        category: 'system',
        metadata: metrics
      });

      // Registrar tempo de resposta médio por serviço
      for (const [service, avgTime] of Object.entries(metrics.averageResponseTimes)) {
        await this.analyticsService.recordRealTimeMetric({
          serviceName: 'gateway',
          metricName: 'avg_response_time_by_service',
          metricValue: avgTime,
          metricType: 'gauge',
          metadata: { targetService: service }
        });
      }

      return metrics;
    } catch (error) {
      console.error('Error collecting gateway metrics:', error);
      throw error;
    }
  }

  /**
   * Calcular tempos de resposta médios
   */
  calculateAverageResponseTimes() {
    const averages = {};
    
    for (const [key, times] of this.responseTimeTracker.entries()) {
      if (times.length > 0) {
        const service = key.split(':')[0];
        const average = times.reduce((a, b) => a + b, 0) / times.length;
        
        if (!averages[service]) {
          averages[service] = [];
        }
        averages[service].push(average);
      }
    }
    
    // Calcular média por serviço
    for (const service in averages) {
      const serviceAverages = averages[service];
      averages[service] = serviceAverages.reduce((a, b) => a + b, 0) / serviceAverages.length;
    }
    
    return averages;
  }

  /**
   * Extrair nome do serviço do path
   */
  extractServiceFromPath(path) {
    const pathSegments = path.split('/').filter(segment => segment.length > 0);
    
    if (pathSegments.length === 0) return 'gateway';
    
    const firstSegment = pathSegments[0];
    
    // Mapear paths para serviços
    const serviceMap = {
      'api': pathSegments[1] || 'api',
      'auth': 'auth-service',
      'products': 'product-service',
      'orders': 'product-service',
      'billing': 'billing-service',
      'bling': 'bling-service',
      'shared': 'shared-service'
    };
    
    return serviceMap[firstSegment] || firstSegment;
  }

  /**
   * Verificar se é endpoint de negócio
   */
  isBusinessEndpoint(path) {
    const businessPaths = [
      '/products', '/orders', '/auth/login', '/auth/register',
      '/billing', '/bling', '/customers'
    ];
    
    return businessPaths.some(bp => path.toLowerCase().includes(bp));
  }

  /**
   * Middleware para coleta periódica de métricas
   */
  startPeriodicCollection(intervalMs = 60000) { // 1 minuto
    setInterval(async () => {
      try {
        await this.collectGatewayMetrics();
      } catch (error) {
        console.error('Error in periodic metrics collection:', error);
      }
    }, intervalMs);
  }

  /**
   * Obter estatísticas atuais
   */
  getCurrentStats() {
    return {
      totalRequests: Array.from(this.requestCounters.values()).reduce((a, b) => a + b, 0),
      requestsByService: Object.fromEntries(this.requestCounters),
      averageResponseTimes: this.calculateAverageResponseTimes(),
      trackedEndpoints: this.responseTimeTracker.size,
      uptime: process.uptime()
    };
  }

  /**
   * Resetar contadores (útil para testes)
   */
  resetCounters() {
    this.requestCounters.clear();
    this.responseTimeTracker.clear();
  }
}

module.exports = GatewayAnalyticsIntegration;