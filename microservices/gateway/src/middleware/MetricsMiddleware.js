class MetricsMiddleware {
  constructor(logger) {
    this.logger = logger;
    this.metrics = {
      requests: new Map(),
      responses: new Map(),
      errors: new Map(),
      latency: []
    };
    
    // Reset metrics every 5 minutes
    setInterval(() => this.resetMetrics(), 5 * 60 * 1000);
  }

  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      const originalSend = res.send;

      // Track request
      this.trackRequest(req);

      // Override res.send to capture response data
      res.send = function(data) {
        const duration = Date.now() - start;
        this.trackResponse(res, duration);
        originalSend.call(res, data);
      }.bind(this);

      // Handle errors
      res.on('error', (err) => {
        this.trackError(req, err);
      });

      next();
    };
  }

  trackRequest(req) {
    const key = `${req.method}:${req.route?.path || req.path}`;
    const current = this.metrics.requests.get(key) || 0;
    this.metrics.requests.set(key, current + 1);
  }

  trackResponse(res, duration) {
    const statusGroup = `${Math.floor(res.statusCode / 100)}xx`;
    const current = this.metrics.responses.get(statusGroup) || 0;
    this.metrics.responses.set(statusGroup, current + 1);
    
    // Track latency
    this.metrics.latency.push(duration);
    
    // Keep only last 1000 latency measurements
    if (this.metrics.latency.length > 1000) {
      this.metrics.latency = this.metrics.latency.slice(-1000);
    }
  }

  trackError(req, error) {
    const key = error.code || error.name || 'UNKNOWN_ERROR';
    const current = this.metrics.errors.get(key) || 0;
    this.metrics.errors.set(key, current + 1);
  }

  getMetrics() {
    const latency = this.metrics.latency;
    const avgLatency = latency.length > 0 ? 
      latency.reduce((sum, val) => sum + val, 0) / latency.length : 0;
    
    const p95Latency = latency.length > 0 ? 
      latency.sort((a, b) => a - b)[Math.floor(latency.length * 0.95)] : 0;

    return {
      requests: Object.fromEntries(this.metrics.requests),
      responses: Object.fromEntries(this.metrics.responses),
      errors: Object.fromEntries(this.metrics.errors),
      latency: {
        average: Math.round(avgLatency),
        p95: p95Latency,
        count: latency.length
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  resetMetrics() {
    this.logger.info('Resetting metrics', this.getMetrics());
    this.metrics.requests.clear();
    this.metrics.responses.clear();
    this.metrics.errors.clear();
    this.metrics.latency = [];
  }
}

module.exports = MetricsMiddleware;