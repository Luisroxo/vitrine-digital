import React, { useState, useEffect } from 'react';
import { LoadingButton, SkeletonLoader } from '../contexts/LoadingContext';
import { useError } from '../contexts/ErrorContext';

/**
 * Multi-Service Monitoring Dashboard
 * Comprehensive monitoring for all microservices
 */
export function MonitoringDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [loading, setLoading] = useState(true);
  
  const [metrics, setMetrics] = useState({
    overview: {
      totalServices: 0,
      healthyServices: 0,
      unhealthyServices: 0,
      avgResponseTime: 0,
      totalRequests: 0,
      errorRate: 0
    },
    services: [],
    alerts: [],
    logs: [],
    performance: {
      cpu: [],
      memory: [],
      disk: [],
      network: []
    }
  });

  const { showError } = useError();

  useEffect(() => {
    loadMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(loadMetrics, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      
      // Simulate API calls to monitoring endpoints
      const [
        servicesData,
        performanceData,
        alertsData,
        logsData
      ] = await Promise.all([
        fetchServicesMetrics(),
        fetchPerformanceMetrics(),
        fetchAlerts(),
        fetchLogs()
      ]);

      setMetrics({
        overview: calculateOverviewMetrics(servicesData),
        services: servicesData,
        alerts: alertsData,
        logs: logsData,
        performance: performanceData
      });

      setLastUpdated(new Date());
    } catch (error) {
      showError('Erro ao carregar métricas de monitoramento.', 'monitoring');
    } finally {
      setLoading(false);
    }
  };

  const fetchServicesMetrics = async () => {
    // Mock data - in real implementation, fetch from monitoring API
    return [
      {
        id: 'auth-service',
        name: 'Auth Service',
        status: 'healthy',
        uptime: '99.9%',
        responseTime: 45,
        requests: 1250,
        errors: 2,
        cpu: 15.5,
        memory: 78.2,
        version: '1.2.3',
        lastHealthCheck: new Date(),
        endpoints: [
          { path: '/auth/login', status: 'healthy', responseTime: 42 },
          { path: '/auth/register', status: 'healthy', responseTime: 38 },
          { path: '/auth/validate', status: 'healthy', responseTime: 25 }
        ]
      },
      {
        id: 'product-service',
        name: 'Product Service',
        status: 'healthy',
        uptime: '99.8%',
        responseTime: 67,
        requests: 3420,
        errors: 8,
        cpu: 22.1,
        memory: 65.4,
        version: '1.1.8',
        lastHealthCheck: new Date(),
        endpoints: [
          { path: '/products', status: 'healthy', responseTime: 65 },
          { path: '/products/:id', status: 'healthy', responseTime: 45 },
          { path: '/categories', status: 'warning', responseTime: 120 }
        ]
      },
      {
        id: 'billing-service',
        name: 'Billing Service',
        status: 'warning',
        uptime: '98.5%',
        responseTime: 156,
        requests: 890,
        errors: 15,
        cpu: 45.8,
        memory: 82.7,
        version: '1.0.5',
        lastHealthCheck: new Date(),
        endpoints: [
          { path: '/billing/plans', status: 'healthy', responseTime: 78 },
          { path: '/billing/invoices', status: 'warning', responseTime: 180 },
          { path: '/billing/payments', status: 'warning', responseTime: 200 }
        ]
      },
      {
        id: 'bling-service',
        name: 'Bling Integration Service',
        status: 'healthy',
        uptime: '99.2%',
        responseTime: 89,
        requests: 567,
        errors: 3,
        cpu: 18.9,
        memory: 56.3,
        version: '1.3.1',
        lastHealthCheck: new Date(),
        endpoints: [
          { path: '/bling/products/sync', status: 'healthy', responseTime: 95 },
          { path: '/bling/orders/create', status: 'healthy', responseTime: 110 },
          { path: '/bling/webhooks', status: 'healthy', responseTime: 45 }
        ]
      },
      {
        id: 'gateway',
        name: 'API Gateway',
        status: 'critical',
        uptime: '95.2%',
        responseTime: 245,
        requests: 8750,
        errors: 125,
        cpu: 78.5,
        memory: 91.2,
        version: '2.1.0',
        lastHealthCheck: new Date(Date.now() - 300000), // 5 minutes ago
        endpoints: [
          { path: '/api/v1/*', status: 'critical', responseTime: 300 },
          { path: '/health', status: 'healthy', responseTime: 15 }
        ]
      }
    ];
  };

  const fetchPerformanceMetrics = async () => {
    // Mock performance data
    const now = new Date();
    const data = [];
    
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - (i * 60 * 60 * 1000));
      data.push({
        timestamp: time,
        cpu: 20 + Math.random() * 60,
        memory: 40 + Math.random() * 40,
        disk: 30 + Math.random() * 20,
        network: Math.random() * 100
      });
    }
    
    return data;
  };

  const fetchAlerts = async () => {
    return [
      {
        id: 1,
        severity: 'critical',
        service: 'API Gateway',
        message: 'High response time detected (>200ms)',
        timestamp: new Date(Date.now() - 600000),
        acknowledged: false
      },
      {
        id: 2,
        severity: 'warning',
        service: 'Billing Service',
        message: 'Memory usage above 80%',
        timestamp: new Date(Date.now() - 1800000),
        acknowledged: false
      },
      {
        id: 3,
        severity: 'info',
        service: 'Auth Service',
        message: 'Service restarted successfully',
        timestamp: new Date(Date.now() - 3600000),
        acknowledged: true
      }
    ];
  };

  const fetchLogs = async () => {
    return [
      {
        id: 1,
        timestamp: new Date(),
        level: 'ERROR',
        service: 'API Gateway',
        message: 'Database connection timeout',
        details: 'Connection to PostgreSQL failed after 30s timeout'
      },
      {
        id: 2,
        timestamp: new Date(Date.now() - 120000),
        level: 'WARN',
        service: 'Billing Service',
        message: 'Payment provider slow response',
        details: 'Stripe API responded in 5.2s (threshold: 3s)'
      },
      {
        id: 3,
        timestamp: new Date(Date.now() - 300000),
        level: 'INFO',
        service: 'Product Service',
        message: 'Cache refresh completed',
        details: 'Product catalog cache updated with 1,250 items'
      }
    ];
  };

  const calculateOverviewMetrics = (services) => {
    const total = services.length;
    const healthy = services.filter(s => s.status === 'healthy').length;
    const avgResponse = services.reduce((acc, s) => acc + s.responseTime, 0) / total;
    const totalReqs = services.reduce((acc, s) => acc + s.requests, 0);
    const totalErrors = services.reduce((acc, s) => acc + s.errors, 0);
    
    return {
      totalServices: total,
      healthyServices: healthy,
      unhealthyServices: total - healthy,
      avgResponseTime: Math.round(avgResponse),
      totalRequests: totalReqs,
      errorRate: totalReqs > 0 ? ((totalErrors / totalReqs) * 100).toFixed(2) : 0
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'danger';
      default: return 'secondary';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'danger';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'secondary';
    }
  };

  const renderTabNavigation = () => (
    <ul className="nav nav-tabs mb-4">
      <li className="nav-item">
        <button
          className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <i className="fas fa-tachometer-alt me-2"></i>
          Visão Geral
        </button>
      </li>
      <li className="nav-item">
        <button
          className={`nav-link ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => setActiveTab('services')}
        >
          <i className="fas fa-server me-2"></i>
          Serviços
        </button>
      </li>
      <li className="nav-item">
        <button
          className={`nav-link ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          <i className="fas fa-chart-line me-2"></i>
          Performance
        </button>
      </li>
      <li className="nav-item">
        <button
          className={`nav-link ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          <i className="fas fa-exclamation-triangle me-2"></i>
          Alertas
          {metrics.alerts.filter(a => !a.acknowledged).length > 0 && (
            <span className="badge bg-danger ms-2">
              {metrics.alerts.filter(a => !a.acknowledged).length}
            </span>
          )}
        </button>
      </li>
      <li className="nav-item">
        <button
          className={`nav-link ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <i className="fas fa-file-alt me-2"></i>
          Logs
        </button>
      </li>
    </ul>
  );

  if (loading && metrics.services.length === 0) {
    return <SkeletonLoader lines={12} />;
  }

  return (
    <div className="monitoring-dashboard">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4>
            <i className="fas fa-monitor-heart-rate me-2"></i>
            Dashboard de Monitoramento
          </h4>
          <small className="text-muted">
            Última atualização: {lastUpdated.toLocaleString('pt-BR')}
          </small>
        </div>
        
        <div className="d-flex gap-2 align-items-center">
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              id="autoRefresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="autoRefresh">
              Auto-refresh
            </label>
          </div>
          
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
            disabled={!autoRefresh}
          >
            <option value={10}>10s</option>
            <option value={30}>30s</option>
            <option value={60}>1min</option>
            <option value={300}>5min</option>
          </select>
          
          <LoadingButton
            className="btn btn-outline-primary"
            onClick={loadMetrics}
            loading={loading}
            loadingText="Atualizando..."
          >
            <i className="fas fa-sync me-2"></i>
            Atualizar
          </LoadingButton>
        </div>
      </div>

      {/* Status Banner */}
      <SystemStatusBanner metrics={metrics.overview} services={metrics.services} />

      {/* Tab Navigation */}
      {renderTabNavigation()}

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <OverviewTab metrics={metrics} />
        )}
        
        {activeTab === 'services' && (
          <ServicesTab services={metrics.services} />
        )}
        
        {activeTab === 'performance' && (
          <PerformanceTab data={metrics.performance} />
        )}
        
        {activeTab === 'alerts' && (
          <AlertsTab alerts={metrics.alerts} />
        )}
        
        {activeTab === 'logs' && (
          <LogsTab logs={metrics.logs} />
        )}
      </div>
    </div>
  );
}

/**
 * System Status Banner Component
 */
function SystemStatusBanner({ metrics, services }) {
  const criticalServices = services.filter(s => s.status === 'critical').length;
  const warningServices = services.filter(s => s.status === 'warning').length;
  
  const getSystemStatus = () => {
    if (criticalServices > 0) return { status: 'critical', text: 'Sistema com Problemas Críticos' };
    if (warningServices > 0) return { status: 'warning', text: 'Sistema com Avisos' };
    return { status: 'healthy', text: 'Sistema Operacional' };
  };
  
  const systemStatus = getSystemStatus();
  
  return (
    <div className={`alert alert-${systemStatus.status === 'healthy' ? 'success' : systemStatus.status === 'warning' ? 'warning' : 'danger'} mb-4`}>
      <div className="row align-items-center">
        <div className="col-md-3">
          <div className="d-flex align-items-center">
            <i className={`fas ${systemStatus.status === 'healthy' ? 'fa-check-circle' : systemStatus.status === 'warning' ? 'fa-exclamation-triangle' : 'fa-times-circle'} fa-2x me-3`}></i>
            <div>
              <div className="fw-bold">{systemStatus.text}</div>
              <small>{metrics.healthyServices}/{metrics.totalServices} serviços saudáveis</small>
            </div>
          </div>
        </div>
        
        <div className="col-md-9">
          <div className="row text-center">
            <div className="col">
              <div className="fw-bold">{metrics.totalRequests.toLocaleString('pt-BR')}</div>
              <small>Requisições (24h)</small>
            </div>
            <div className="col">
              <div className="fw-bold">{metrics.avgResponseTime}ms</div>
              <small>Tempo Médio</small>
            </div>
            <div className="col">
              <div className="fw-bold">{metrics.errorRate}%</div>
              <small>Taxa de Erro</small>
            </div>
            <div className="col">
              <div className="fw-bold">{criticalServices}</div>
              <small>Críticos</small>
            </div>
            <div className="col">
              <div className="fw-bold">{warningServices}</div>
              <small>Avisos</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Overview Tab Component
 */
function OverviewTab({ metrics }) {
  return (
    <div className="row">
      <div className="col-md-8">
        <div className="row mb-4">
          <div className="col-md-3 mb-3">
            <div className="card text-center h-100">
              <div className="card-body">
                <i className="fas fa-server fa-2x text-primary mb-2"></i>
                <h5 className="card-title">{metrics.overview.totalServices}</h5>
                <p className="card-text small">Total de Serviços</p>
              </div>
            </div>
          </div>
          
          <div className="col-md-3 mb-3">
            <div className="card text-center h-100">
              <div className="card-body">
                <i className="fas fa-check-circle fa-2x text-success mb-2"></i>
                <h5 className="card-title">{metrics.overview.healthyServices}</h5>
                <p className="card-text small">Saudáveis</p>
              </div>
            </div>
          </div>
          
          <div className="col-md-3 mb-3">
            <div className="card text-center h-100">
              <div className="card-body">
                <i className="fas fa-clock fa-2x text-info mb-2"></i>
                <h5 className="card-title">{metrics.overview.avgResponseTime}ms</h5>
                <p className="card-text small">Tempo Médio</p>
              </div>
            </div>
          </div>
          
          <div className="col-md-3 mb-3">
            <div className="card text-center h-100">
              <div className="card-body">
                <i className="fas fa-exclamation-triangle fa-2x text-warning mb-2"></i>
                <h5 className="card-title">{metrics.overview.errorRate}%</h5>
                <p className="card-text small">Taxa de Erro</p>
              </div>
            </div>
          </div>
        </div>

        {/* Services Grid */}
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-list me-2"></i>
              Status dos Serviços
            </h6>
          </div>
          <div className="card-body">
            <div className="row">
              {metrics.services.map(service => (
                <div key={service.id} className="col-md-6 mb-3">
                  <div className="card h-100">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <h6 className="card-title mb-0">{service.name}</h6>
                        <span className={`badge bg-${getStatusColor(service.status)}`}>
                          {service.status}
                        </span>
                      </div>
                      
                      <div className="row small text-muted">
                        <div className="col-6">
                          <div><strong>Uptime:</strong> {service.uptime}</div>
                          <div><strong>Resposta:</strong> {service.responseTime}ms</div>
                        </div>
                        <div className="col-6">
                          <div><strong>CPU:</strong> {service.cpu}%</div>
                          <div><strong>Memória:</strong> {service.memory}%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="col-md-4">
        {/* Recent Alerts */}
        <div className="card mb-4">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-bell me-2"></i>
              Alertas Recentes
            </h6>
          </div>
          <div className="card-body">
            {metrics.alerts.slice(0, 5).map(alert => (
              <div key={alert.id} className="d-flex align-items-start mb-3">
                <i className={`fas fa-circle text-${getSeverityColor(alert.severity)} me-2 mt-1`} style={{fontSize: '8px'}}></i>
                <div className="flex-grow-1">
                  <div className="small fw-bold">{alert.service}</div>
                  <div className="small text-muted">{alert.message}</div>
                  <div className="small text-muted">
                    {new Date(alert.timestamp).toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Info */}
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-info-circle me-2"></i>
              Informações do Sistema
            </h6>
          </div>
          <div className="card-body">
            <div className="small">
              <div className="d-flex justify-content-between mb-2">
                <span>Arquitetura:</span>
                <span>Microserviços</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span>Gateway:</span>
                <span>API Gateway</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span>Banco de Dados:</span>
                <span>PostgreSQL</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span>Cache:</span>
                <span>Redis</span>
              </div>
              <div className="d-flex justify-content-between">
                <span>Monitoramento:</span>
                <span>Ativo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Services Tab Component
 */
function ServicesTab({ services }) {
  const [selectedService, setSelectedService] = useState(null);
  
  return (
    <div className="row">
      <div className="col-md-8">
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-server me-2"></i>
              Detalhes dos Serviços
            </h6>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Serviço</th>
                    <th>Status</th>
                    <th>Uptime</th>
                    <th>Resposta</th>
                    <th>CPU</th>
                    <th>Memória</th>
                    <th>Versão</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(service => (
                    <tr key={service.id}>
                      <td>
                        <div className="fw-medium">{service.name}</div>
                        <small className="text-muted">{service.id}</small>
                      </td>
                      <td>
                        <span className={`badge bg-${getStatusColor(service.status)}`}>
                          {service.status}
                        </span>
                      </td>
                      <td>{service.uptime}</td>
                      <td>{service.responseTime}ms</td>
                      <td>{service.cpu}%</td>
                      <td>{service.memory}%</td>
                      <td>{service.version}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => setSelectedService(service)}
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      <div className="col-md-4">
        {selectedService ? (
          <ServiceDetailCard service={selectedService} />
        ) : (
          <div className="card">
            <div className="card-body text-center text-muted">
              <i className="fas fa-mouse-pointer fa-3x mb-3"></i>
              <p>Selecione um serviço para ver detalhes</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Service Detail Card Component
 */
function ServiceDetailCard({ service }) {
  return (
    <div className="card">
      <div className="card-header">
        <h6 className="mb-0">
          <i className="fas fa-info-circle me-2"></i>
          {service.name}
        </h6>
      </div>
      <div className="card-body">
        <div className="mb-3">
          <div className="d-flex justify-content-between mb-2">
            <span>Status:</span>
            <span className={`badge bg-${getStatusColor(service.status)}`}>
              {service.status}
            </span>
          </div>
          <div className="d-flex justify-content-between mb-2">
            <span>Última verificação:</span>
            <span className="small">{service.lastHealthCheck.toLocaleTimeString('pt-BR')}</span>
          </div>
          <div className="d-flex justify-content-between mb-2">
            <span>Requisições:</span>
            <span>{service.requests.toLocaleString('pt-BR')}</span>
          </div>
          <div className="d-flex justify-content-between">
            <span>Erros:</span>
            <span className="text-danger">{service.errors}</span>
          </div>
        </div>

        <h6>Endpoints:</h6>
        {service.endpoints.map((endpoint, idx) => (
          <div key={idx} className="d-flex justify-content-between align-items-center mb-2">
            <div>
              <div className="small fw-medium">{endpoint.path}</div>
              <div className="small text-muted">{endpoint.responseTime}ms</div>
            </div>
            <span className={`badge bg-${getStatusColor(endpoint.status)}`}>
              {endpoint.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Performance Tab Component
 */
function PerformanceTab({ data }) {
  return (
    <div className="row">
      <div className="col-12 mb-4">
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-chart-line me-2"></i>
              Métricas de Performance (24h)
            </h6>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6 mb-4">
                <h6>CPU (%)</h6>
                <div className="bg-light p-3 rounded text-center">
                  <i className="fas fa-microchip fa-2x text-primary mb-2"></i>
                  <div>Gráfico de CPU seria renderizado aqui</div>
                  <small className="text-muted">Média: 35.2%</small>
                </div>
              </div>
              
              <div className="col-md-6 mb-4">
                <h6>Memória (%)</h6>
                <div className="bg-light p-3 rounded text-center">
                  <i className="fas fa-memory fa-2x text-success mb-2"></i>
                  <div>Gráfico de Memória seria renderizado aqui</div>
                  <small className="text-muted">Média: 62.8%</small>
                </div>
              </div>
              
              <div className="col-md-6">
                <h6>Disco (%)</h6>
                <div className="bg-light p-3 rounded text-center">
                  <i className="fas fa-hdd fa-2x text-warning mb-2"></i>
                  <div>Gráfico de Disco seria renderizado aqui</div>
                  <small className="text-muted">Média: 45.1%</small>
                </div>
              </div>
              
              <div className="col-md-6">
                <h6>Rede (MB/s)</h6>
                <div className="bg-light p-3 rounded text-center">
                  <i className="fas fa-network-wired fa-2x text-info mb-2"></i>
                  <div>Gráfico de Rede seria renderizado aqui</div>
                  <small className="text-muted">Média: 12.5 MB/s</small>
                </div>
              </div>
            </div>
            
            <div className="alert alert-info mt-3">
              <i className="fas fa-info-circle me-2"></i>
              <strong>Nota:</strong> Em uma implementação real, aqui seriam exibidos gráficos 
              interativos usando bibliotecas como Chart.js ou D3.js com dados em tempo real.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Alerts Tab Component
 */
function AlertsTab({ alerts }) {
  const [filter, setFilter] = useState('all');
  
  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    if (filter === 'unacknowledged') return !alert.acknowledged;
    return alert.severity === filter;
  });
  
  return (
    <div className="row">
      <div className="col-12">
        <div className="card">
          <div className="card-header">
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="mb-0">
                <i className="fas fa-exclamation-triangle me-2"></i>
                Alertas do Sistema
              </h6>
              
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">Todos os Alertas</option>
                <option value="unacknowledged">Não Reconhecidos</option>
                <option value="critical">Críticos</option>
                <option value="warning">Avisos</option>
                <option value="info">Informativos</option>
              </select>
            </div>
          </div>
          <div className="card-body">
            {filteredAlerts.length === 0 ? (
              <div className="text-center text-muted py-4">
                <i className="fas fa-check-circle fa-3x mb-3"></i>
                <p>Nenhum alerta encontrado para o filtro selecionado.</p>
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {filteredAlerts.map(alert => (
                  <div key={alert.id} className="list-group-item">
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center mb-1">
                          <span className={`badge bg-${getSeverityColor(alert.severity)} me-2`}>
                            {alert.severity}
                          </span>
                          <strong>{alert.service}</strong>
                        </div>
                        <p className="mb-1">{alert.message}</p>
                        <small className="text-muted">
                          {new Date(alert.timestamp).toLocaleString('pt-BR')}
                        </small>
                      </div>
                      
                      <div className="d-flex gap-2">
                        {!alert.acknowledged && (
                          <button className="btn btn-sm btn-outline-primary">
                            <i className="fas fa-check me-1"></i>
                            Reconhecer
                          </button>
                        )}
                        <button className="btn btn-sm btn-outline-secondary">
                          <i className="fas fa-eye"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Logs Tab Component
 */
function LogsTab({ logs }) {
  const [logLevel, setLogLevel] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredLogs = logs.filter(log => {
    const matchesLevel = logLevel === 'all' || log.level === logLevel;
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.service.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLevel && matchesSearch;
  });
  
  const getLogLevelColor = (level) => {
    switch (level) {
      case 'ERROR': return 'danger';
      case 'WARN': return 'warning';
      case 'INFO': return 'info';
      default: return 'secondary';
    }
  };
  
  return (
    <div className="row">
      <div className="col-12">
        <div className="card">
          <div className="card-header">
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="mb-0">
                <i className="fas fa-file-alt me-2"></i>
                Logs do Sistema
              </h6>
              
              <div className="d-flex gap-2">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Buscar logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '200px' }}
                />
                
                <select
                  className="form-select form-select-sm"
                  style={{ width: 'auto' }}
                  value={logLevel}
                  onChange={(e) => setLogLevel(e.target.value)}
                >
                  <option value="all">Todos</option>
                  <option value="ERROR">Erros</option>
                  <option value="WARN">Avisos</option>
                  <option value="INFO">Info</option>
                </select>
              </div>
            </div>
          </div>
          <div className="card-body">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-muted py-4">
                <i className="fas fa-search fa-3x mb-3"></i>
                <p>Nenhum log encontrado para os critérios selecionados.</p>
              </div>
            ) : (
              <div className="logs-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {filteredLogs.map(log => (
                  <div key={log.id} className="border-bottom pb-3 mb-3">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="d-flex align-items-center">
                        <span className={`badge bg-${getLogLevelColor(log.level)} me-2`}>
                          {log.level}
                        </span>
                        <strong>{log.service}</strong>
                      </div>
                      <small className="text-muted">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </small>
                    </div>
                    
                    <div className="mb-2">
                      <div className="fw-medium">{log.message}</div>
                      {log.details && (
                        <div className="small text-muted mt-1">{log.details}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getStatusColor(status) {
  switch (status) {
    case 'healthy': return 'success';
    case 'warning': return 'warning';  
    case 'critical': return 'danger';
    default: return 'secondary';
  }
}

function getSeverityColor(severity) {
  switch (severity) {
    case 'critical': return 'danger';
    case 'warning': return 'warning';
    case 'info': return 'info';
    default: return 'secondary';
  }
}