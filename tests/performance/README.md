# Performance Testing

This directory contains performance tests for the Vitrine Digital microservices platform.

## Test Categories

### Load Testing (`load-stress.test.js`)
- **Concurrent User Simulation**: Tests system behavior under normal and peak load conditions
- **Database Performance**: Validates query performance with large datasets and connection pooling
- **Cache Performance**: Tests Redis cache behavior under high-frequency operations
- **Resource Utilization**: Monitors CPU, memory, and disk usage patterns

### Stress Testing
- **Breaking Point Analysis**: Identifies system limits and failure modes
- **Memory Pressure**: Tests behavior under high memory consumption scenarios
- **Recovery Testing**: Validates system recovery after stress conditions

### Database Performance
- **Large Dataset Queries**: Tests query efficiency with 100K+ records
- **Concurrent Transactions**: Validates ACID properties under load
- **Index Usage**: Ensures optimal query execution plans

### API Performance
- **Response Time SLAs**: Validates API endpoints meet performance requirements
- **Rate Limiting**: Tests throttling mechanisms effectiveness
- **Caching Impact**: Measures performance gains from caching strategies

### Scalability Testing
- **Horizontal Scaling**: Tests load distribution across multiple instances
- **Auto-scaling**: Validates automatic scaling decisions based on metrics
- **Load Balancing**: Ensures even distribution of requests

### Resource Optimization
- **Memory Management**: Tests garbage collection and memory usage patterns
- **Query Optimization**: Validates database performance improvements
- **Cache Tuning**: Optimizes cache hit rates and memory usage

## Test Configuration

### Performance Thresholds
- **API Response Time**: 95th percentile < 1 second
- **Database Queries**: < 1 second for complex queries
- **Cache Operations**: < 5ms average response time
- **Memory Usage**: < 80% of available heap
- **CPU Usage**: < 90% during peak load
- **Error Rate**: < 1% under normal conditions

### Load Test Scenarios
- **Normal Load**: 50 RPS, 100 concurrent users
- **Peak Load**: 250 RPS, 500 concurrent users
- **Stress Load**: 500+ RPS until breaking point
- **Endurance**: Sustained load for 30+ minutes

## Running Performance Tests

### Prerequisites
```bash
# Install performance testing dependencies
npm install --save-dev jest supertest artillery k6
```

### Execution Commands
```bash
# Run all performance tests
npm run test:performance

# Run specific test categories
npm run test:load
npm run test:stress
npm run test:scalability

# Run with detailed reporting
npm run test:performance -- --verbose --coverage
```

### Environment Setup
```bash
# Set performance test environment variables
export NODE_ENV=performance
export DB_POOL_SIZE=50
export REDIS_MAX_CONNECTIONS=100
export LOG_LEVEL=error
```

## Monitoring and Metrics

### Key Performance Indicators (KPIs)
- **Throughput**: Requests per second handled
- **Response Time**: P50, P95, P99 percentiles
- **Error Rate**: Percentage of failed requests
- **Resource Utilization**: CPU, Memory, Disk I/O
- **Scalability**: Performance vs. instance count

### Performance Regression Detection
- Baseline performance metrics stored in `performance-baseline.json`
- Automatic comparison against historical data
- Alerts for performance degradation > 20%
- Trending analysis for gradual performance decline

## Test Data Management

### Dataset Sizes
- **Products**: 100,000 records (~195MB)
- **Orders**: 500,000 records (~488MB)
- **Order Items**: 1,500,000 records (~732MB)
- **Users**: 25,000 records (~36MB)

### Data Generation
```javascript
// Generate test data for performance tests
const testData = testUtils.generateLargeDataset({
  products: 100000,
  orders: 500000,
  users: 25000
});
```

## Performance Optimization Guidelines

### Database Optimization
1. **Indexing Strategy**
   - Composite indexes for multi-column queries
   - Covering indexes for frequently accessed columns
   - Partitioning for large tables (orders, analytics)

2. **Query Optimization**
   - Use EXPLAIN ANALYZE for query planning
   - Avoid N+1 queries with proper JOINs
   - Implement query result caching

### Application Optimization
1. **Memory Management**
   - Object pooling for frequent operations
   - Lazy loading for large data structures
   - Proper garbage collection tuning

2. **Caching Strategy**
   - Redis for session and frequently accessed data
   - Application-level caching for computed results
   - CDN for static assets and API responses

### Infrastructure Optimization
1. **Auto-scaling Configuration**
   - CPU-based scaling (70% threshold)
   - Response time-based scaling (500ms threshold)
   - Proper cooldown periods (5 minutes)

2. **Load Balancing**
   - Health checks with proper intervals
   - Session affinity when required
   - Circuit breakers for failing services

## Performance Testing Best Practices

### Test Design
- Use realistic data volumes and patterns
- Include both happy path and edge cases
- Test with production-like infrastructure
- Include warmup periods before measurements

### Measurement
- Collect metrics over sufficient time periods
- Use statistical analysis for result interpretation
- Account for external dependencies and variations
- Document test conditions and configurations

### Continuous Integration
- Run performance tests on every major release
- Establish performance budgets and SLAs
- Monitor long-term performance trends
- Integrate with alerting and monitoring systems

## Troubleshooting Performance Issues

### Common Bottlenecks
1. **Database**: Slow queries, connection exhaustion, lock contention
2. **Memory**: Memory leaks, excessive GC, inefficient data structures
3. **Network**: High latency, bandwidth limitations, DNS resolution
4. **Application**: Inefficient algorithms, blocking operations, resource contention

### Debugging Tools
- **Application Performance Monitoring (APM)**: New Relic, Datadog, or similar
- **Database Monitoring**: Query analyzers, slow query logs
- **System Monitoring**: CPU, memory, disk, and network metrics
- **Custom Metrics**: Business-specific performance indicators

### Performance Tuning Checklist
- [ ] Database indexes optimized for query patterns
- [ ] Connection pooling configured appropriately
- [ ] Caching implemented for frequently accessed data
- [ ] Auto-scaling policies tested and validated
- [ ] Resource limits set for all services
- [ ] Performance monitoring and alerting in place