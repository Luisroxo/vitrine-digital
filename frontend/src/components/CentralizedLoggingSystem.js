import React, { useState, useEffect, useRef } from 'react';
import { LoadingButton, SkeletonLoader } from '../contexts/LoadingContext';
import { useError } from '../contexts/ErrorContext';

/**
 * Centralized Logging System
 * Advanced log management and analysis for all microservices
 */
export function CentralizedLoggingSystem() {
  const [activeTab, setActiveTab] = useState('realtime');
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    level: 'all',
    service: 'all',
    timeRange: '1h',
    searchTerm: '',
    startDate: '',
    endDate: ''
  });
  
  const [logStats, setLogStats] = useState({
    total: 0,
    errors: 0,
    warnings: 0,
    info: 0,
    debug: 0,
    services: {}
  });
  
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  
  const logsContainerRef = useRef(null);
  const wsRef = useRef(null);

  const { showError, showSuccess } = useError();

  // Available services for filtering
  const services = [
    'auth-service',
    'product-service', 
    'billing-service',
    'bling-service',
    'gateway'
  ];

  // Log levels with colors
  const logLevels = {
    ERROR: 'danger',
    WARN: 'warning',
    INFO: 'info', 
    DEBUG: 'secondary'
  };

  useEffect(() => {
    loadLogs();
    
    if (realtimeEnabled) {
      setupWebSocket();
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [filters, realtimeEnabled]);

  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const setupWebSocket = () => {
    // Mock WebSocket setup - in real implementation connect to log streaming endpoint
    const mockWebSocket = {
      close: () => {},
      send: () => {}
    };
    
    wsRef.current = mockWebSocket;
    
    // Simulate real-time log updates
    const interval = setInterval(() => {
      if (realtimeEnabled) {
        const newLog = generateMockLog();
        setLogs(prev => {
          const updated = [...prev, newLog].slice(-1000); // Keep last 1000 logs
          return updated;
        });
        
        updateLogStats(newLog);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  };

  const generateMockLog = () => {
    const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    const services = ['auth-service', 'product-service', 'billing-service', 'bling-service', 'gateway'];
    const messages = [
      'User authentication successful',
      'Database query executed',
      'Payment processed successfully', 
      'API request rate limit exceeded',
      'Cache miss for key: products_123',
      'WebSocket connection established',
      'Email notification sent',
      'File upload completed',
      'Background job started',
      'Health check completed'
    ];
    
    const level = levels[Math.floor(Math.random() * levels.length)];
    const service = services[Math.floor(Math.random() * services.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];
    
    return {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      level,
      service,
      message,
      details: `Detailed log information for ${message.toLowerCase()}`,
      requestId: Math.random().toString(36).substring(2, 15),
      userId: Math.random() < 0.7 ? Math.floor(Math.random() * 1000) : null,
      ip: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      
      // Simulate API call with filters
      const mockLogs = generateMockLogs(100);
      const filteredLogs = applyFilters(mockLogs);
      
      setLogs(filteredLogs);
      calculateLogStats(filteredLogs);
    } catch (error) {
      showError('Erro ao carregar logs.', 'logging');
    } finally {
      setLoading(false);
    }
  };

  const generateMockLogs = (count) => {
    const logs = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
      const log = generateMockLog();
      log.id = i;
      log.timestamp = new Date(now.getTime() - (i * 30000)); // 30s intervals
      logs.push(log);
    }
    
    return logs.reverse(); // Most recent first
  };

  const applyFilters = (logsList) => {
    return logsList.filter(log => {
      // Level filter
      if (filters.level !== 'all' && log.level !== filters.level) {
        return false;
      }
      
      // Service filter
      if (filters.service !== 'all' && log.service !== filters.service) {
        return false;
      }
      
      // Search filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        if (!log.message.toLowerCase().includes(searchLower) &&
            !log.service.toLowerCase().includes(searchLower) &&
            !log.details.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      
      // Time range filter
      if (filters.timeRange !== 'all') {
        const now = new Date();
        let cutoff;
        
        switch (filters.timeRange) {
          case '15m':
            cutoff = new Date(now.getTime() - 15 * 60 * 1000);
            break;
          case '1h':
            cutoff = new Date(now.getTime() - 60 * 60 * 1000);
            break;
          case '4h':
            cutoff = new Date(now.getTime() - 4 * 60 * 60 * 1000);
            break;
          case '24h':
            cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          default:
            cutoff = new Date(0);
        }
        
        if (new Date(log.timestamp) < cutoff) {
          return false;
        }
      }
      
      return true;
    });
  };

  const calculateLogStats = (logsList) => {
    const stats = {
      total: logsList.length,
      errors: logsList.filter(l => l.level === 'ERROR').length,
      warnings: logsList.filter(l => l.level === 'WARN').length,
      info: logsList.filter(l => l.level === 'INFO').length,
      debug: logsList.filter(l => l.level === 'DEBUG').length,
      services: {}
    };
    
    // Count by service
    logsList.forEach(log => {
      stats.services[log.service] = (stats.services[log.service] || 0) + 1;
    });
    
    setLogStats(stats);
  };

  const updateLogStats = (newLog) => {
    setLogStats(prev => ({
      ...prev,
      total: prev.total + 1,
      [newLog.level.toLowerCase()]: prev[newLog.level.toLowerCase()] + 1,
      services: {
        ...prev.services,
        [newLog.service]: (prev.services[newLog.service] || 0) + 1
      }
    }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      level: 'all',
      service: 'all', 
      timeRange: '1h',
      searchTerm: '',
      startDate: '',
      endDate: ''
    });
  };

  const exportLogs = async (format) => {
    try {
      setExportLoading(true);
      
      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const exportData = logs.map(log => ({
        timestamp: log.timestamp.toISOString(),
        level: log.level,
        service: log.service,
        message: log.message,
        details: log.details,
        requestId: log.requestId,
        userId: log.userId,
        ip: log.ip
      }));
      
      if (format === 'json') {
        downloadFile(JSON.stringify(exportData, null, 2), 'logs.json', 'application/json');
      } else if (format === 'csv') {
        const csv = convertToCSV(exportData);
        downloadFile(csv, 'logs.csv', 'text/csv');
      }
      
      showSuccess(`Logs exportados em formato ${format.toUpperCase()} com sucesso!`);
    } catch (error) {
      showError('Erro ao exportar logs.', 'logging');
    } finally {
      setExportLoading(false);
    }
  };

  const convertToCSV = (data) => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
        }).join(',')
      )
    ];
    
    return csvRows.join('\n');
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderTabNavigation = () => (
    <ul className="nav nav-tabs mb-4">
      <li className="nav-item">
        <button
          className={`nav-link ${activeTab === 'realtime' ? 'active' : ''}`}
          onClick={() => setActiveTab('realtime')}
        >
          <i className="fas fa-broadcast-tower me-2"></i>
          Tempo Real
          {realtimeEnabled && (
            <span className="badge bg-success ms-2">
              <i className="fas fa-circle" style={{fontSize: '6px'}}></i>
            </span>
          )}
        </button>
      </li>
      <li className="nav-item">
        <button
          className={`nav-link ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <i className="fas fa-search me-2"></i>
          Pesquisar
        </button>
      </li>
      <li className="nav-item">
        <button
          className={`nav-link ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <i className="fas fa-chart-bar me-2"></i>
          Analytics
        </button>
      </li>
      <li className="nav-item">
        <button
          className={`nav-link ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          <i className="fas fa-exclamation-triangle me-2"></i>
          Alertas
        </button>
      </li>
    </ul>
  );

  if (loading && logs.length === 0) {
    return <SkeletonLoader lines={10} />;
  }

  return (
    <div className="centralized-logging-system">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4>
            <i className="fas fa-list-alt me-2"></i>
            Sistema de Logs Centralizado
          </h4>
          <small className="text-muted">
            Monitoramento e análise de logs em tempo real
          </small>
        </div>
        
        <div className="d-flex gap-2 align-items-center">
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              id="realtimeToggle"
              checked={realtimeEnabled}
              onChange={(e) => setRealtimeEnabled(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="realtimeToggle">
              Tempo Real
            </label>
          </div>
          
          <div className="dropdown">
            <LoadingButton
              className="btn btn-outline-primary dropdown-toggle"
              data-bs-toggle="dropdown"
              loading={exportLoading}
              loadingText="Exportando..."
            >
              <i className="fas fa-download me-2"></i>
              Exportar
            </LoadingButton>
            <ul className="dropdown-menu">
              <li>
                <button 
                  className="dropdown-item"
                  onClick={() => exportLogs('json')}
                >
                  <i className="fas fa-file-code me-2"></i>
                  Exportar JSON
                </button>
              </li>
              <li>
                <button 
                  className="dropdown-item"
                  onClick={() => exportLogs('csv')}
                >
                  <i className="fas fa-file-csv me-2"></i>
                  Exportar CSV
                </button>
              </li>
            </ul>
          </div>
          
          <LoadingButton
            className="btn btn-outline-secondary"
            onClick={loadLogs}
            loading={loading}
            loadingText="Carregando..."
          >
            <i className="fas fa-sync me-2"></i>
            Atualizar
          </LoadingButton>
        </div>
      </div>

      {/* Stats Summary */}
      <LogStatsSummary stats={logStats} />

      {/* Filters */}
      <LogFilters 
        filters={filters}
        services={services}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
      />

      {/* Tab Navigation */}
      {renderTabNavigation()}

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'realtime' && (
          <RealtimeLogsTab 
            logs={logs}
            autoScroll={autoScroll}
            setAutoScroll={setAutoScroll}
            logsContainerRef={logsContainerRef}
            realtimeEnabled={realtimeEnabled}
          />
        )}
        
        {activeTab === 'search' && (
          <SearchLogsTab logs={logs} />
        )}
        
        {activeTab === 'analytics' && (
          <LogAnalyticsTab logs={logs} stats={logStats} />
        )}
        
        {activeTab === 'alerts' && (
          <LogAlertsTab logs={logs} />
        )}
      </div>
    </div>
  );
}

/**
 * Log Stats Summary Component
 */
function LogStatsSummary({ stats }) {
  return (
    <div className="row mb-4">
      <div className="col-md-2 mb-3">
        <div className="card text-center h-100">
          <div className="card-body">
            <i className="fas fa-list fa-2x text-primary mb-2"></i>
            <h5>{stats.total.toLocaleString('pt-BR')}</h5>
            <p className="card-text small">Total de Logs</p>
          </div>
        </div>
      </div>
      
      <div className="col-md-2 mb-3">
        <div className="card text-center h-100">
          <div className="card-body">
            <i className="fas fa-times-circle fa-2x text-danger mb-2"></i>
            <h5>{stats.errors}</h5>
            <p className="card-text small">Erros</p>
          </div>
        </div>
      </div>
      
      <div className="col-md-2 mb-3">
        <div className="card text-center h-100">
          <div className="card-body">
            <i className="fas fa-exclamation-triangle fa-2x text-warning mb-2"></i>
            <h5>{stats.warnings}</h5>
            <p className="card-text small">Avisos</p>
          </div>
        </div>
      </div>
      
      <div className="col-md-2 mb-3">
        <div className="card text-center h-100">
          <div className="card-body">
            <i className="fas fa-info-circle fa-2x text-info mb-2"></i>
            <h5>{stats.info}</h5>
            <p className="card-text small">Informações</p>
          </div>
        </div>
      </div>
      
      <div className="col-md-2 mb-3">
        <div className="card text-center h-100">
          <div className="card-body">
            <i className="fas fa-bug fa-2x text-secondary mb-2"></i>
            <h5>{stats.debug}</h5>
            <p className="card-text small">Debug</p>
          </div>
        </div>
      </div>
      
      <div className="col-md-2 mb-3">
        <div className="card text-center h-100">
          <div className="card-body">
            <i className="fas fa-server fa-2x text-success mb-2"></i>
            <h5>{Object.keys(stats.services).length}</h5>
            <p className="card-text small">Serviços</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Log Filters Component
 */
function LogFilters({ filters, services, onFilterChange, onClearFilters }) {
  return (
    <div className="card mb-4">
      <div className="card-body">
        <div className="row align-items-end">
          <div className="col-md-2">
            <label className="form-label small">Nível</label>
            <select
              className="form-select form-select-sm"
              value={filters.level}
              onChange={(e) => onFilterChange('level', e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="ERROR">Erro</option>
              <option value="WARN">Aviso</option>
              <option value="INFO">Info</option>
              <option value="DEBUG">Debug</option>
            </select>
          </div>
          
          <div className="col-md-2">
            <label className="form-label small">Serviço</label>
            <select
              className="form-select form-select-sm"
              value={filters.service}
              onChange={(e) => onFilterChange('service', e.target.value)}
            >
              <option value="all">Todos</option>
              {services.map(service => (
                <option key={service} value={service}>{service}</option>
              ))}
            </select>
          </div>
          
          <div className="col-md-2">
            <label className="form-label small">Período</label>
            <select
              className="form-select form-select-sm"
              value={filters.timeRange}
              onChange={(e) => onFilterChange('timeRange', e.target.value)}
            >
              <option value="15m">Últimos 15min</option>
              <option value="1h">Última 1h</option>
              <option value="4h">Últimas 4h</option>
              <option value="24h">Últimas 24h</option>
              <option value="all">Todos</option>
            </select>
          </div>
          
          <div className="col-md-4">
            <label className="form-label small">Pesquisar</label>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Buscar em mensagens, serviços..."
              value={filters.searchTerm}
              onChange={(e) => onFilterChange('searchTerm', e.target.value)}
            />
          </div>
          
          <div className="col-md-2">
            <button
              className="btn btn-outline-secondary btn-sm w-100"
              onClick={onClearFilters}
            >
              <i className="fas fa-times me-1"></i>
              Limpar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Realtime Logs Tab Component
 */
function RealtimeLogsTab({ logs, autoScroll, setAutoScroll, logsContainerRef, realtimeEnabled }) {
  const [selectedLog, setSelectedLog] = useState(null);
  
  return (
    <div className="row">
      <div className="col-md-8">
        <div className="card">
          <div className="card-header">
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="mb-0">
                <i className="fas fa-stream me-2"></i>
                Logs em Tempo Real
                {realtimeEnabled && (
                  <span className="badge bg-success ms-2">Ativo</span>
                )}
              </h6>
              
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="autoScrollToggle"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="autoScrollToggle">
                  Auto-scroll
                </label>
              </div>
            </div>
          </div>
          <div className="card-body p-0">
            <div 
              ref={logsContainerRef}
              className="logs-container"
              style={{ 
                height: '600px', 
                overflowY: 'auto',
                backgroundColor: '#1a1a1a',
                fontFamily: 'Monaco, Menlo, monospace',
                fontSize: '12px'
              }}
            >
              {logs.map(log => (
                <LogEntry 
                  key={log.id} 
                  log={log} 
                  onClick={() => setSelectedLog(log)}
                  isSelected={selectedLog?.id === log.id}
                />
              ))}
              
              {logs.length === 0 && (
                <div className="text-center text-muted p-4">
                  <i className="fas fa-search fa-2x mb-3"></i>
                  <p>Nenhum log encontrado para os filtros selecionados.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="col-md-4">
        {selectedLog ? (
          <LogDetailPanel log={selectedLog} />
        ) : (
          <div className="card">
            <div className="card-body text-center text-muted">
              <i className="fas fa-mouse-pointer fa-3x mb-3"></i>
              <p>Clique em um log para ver detalhes</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Log Entry Component
 */
function LogEntry({ log, onClick, isSelected }) {
  const getLevelColor = (level) => {
    switch (level) {
      case 'ERROR': return '#ff6b6b';
      case 'WARN': return '#feca57';
      case 'INFO': return '#48dbfb';
      case 'DEBUG': return '#a55eea';
      default: return '#ffffff';
    }
  };
  
  return (
    <div 
      className={`log-entry ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderLeft: `3px solid ${getLevelColor(log.level)}`,
        backgroundColor: isSelected ? '#2d3748' : 'transparent',
        color: '#ffffff',
        cursor: 'pointer',
        borderBottom: '1px solid #2d3748',
        ':hover': {
          backgroundColor: '#2d3748'
        }
      }}
    >
      <div className="d-flex align-items-start">
        <span 
          className="badge me-2"
          style={{ 
            backgroundColor: getLevelColor(log.level),
            color: '#000000',
            minWidth: '50px'
          }}
        >
          {log.level}
        </span>
        
        <span className="text-muted me-2" style={{ minWidth: '80px' }}>
          {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
        </span>
        
        <span className="text-info me-2" style={{ minWidth: '120px' }}>
          [{log.service}]
        </span>
        
        <span className="flex-grow-1">
          {log.message}
        </span>
        
        {log.requestId && (
          <span className="text-muted small">
            {log.requestId.substring(0, 8)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Log Detail Panel Component
 */
function LogDetailPanel({ log }) {
  return (
    <div className="card">
      <div className="card-header">
        <h6 className="mb-0">
          <i className="fas fa-info-circle me-2"></i>
          Detalhes do Log
        </h6>
      </div>
      <div className="card-body">
        <div className="mb-3">
          <strong>Timestamp:</strong><br />
          <small className="text-muted font-monospace">
            {new Date(log.timestamp).toLocaleString('pt-BR')}
          </small>
        </div>
        
        <div className="mb-3">
          <strong>Nível:</strong><br />
          <span className={`badge bg-${log.level === 'ERROR' ? 'danger' : log.level === 'WARN' ? 'warning' : 'info'}`}>
            {log.level}
          </span>
        </div>
        
        <div className="mb-3">
          <strong>Serviço:</strong><br />
          <span className="badge bg-secondary">{log.service}</span>
        </div>
        
        <div className="mb-3">
          <strong>Mensagem:</strong><br />
          <small className="text-muted">{log.message}</small>
        </div>
        
        {log.details && (
          <div className="mb-3">
            <strong>Detalhes:</strong><br />
            <small className="text-muted">{log.details}</small>
          </div>
        )}
        
        {log.requestId && (
          <div className="mb-3">
            <strong>Request ID:</strong><br />
            <small className="font-monospace text-muted">{log.requestId}</small>
          </div>
        )}
        
        {log.userId && (
          <div className="mb-3">
            <strong>User ID:</strong><br />
            <small className="text-muted">{log.userId}</small>
          </div>
        )}
        
        {log.ip && (
          <div className="mb-3">
            <strong>IP Address:</strong><br />
            <small className="font-monospace text-muted">{log.ip}</small>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Search Logs Tab Component
 */
function SearchLogsTab({ logs }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    const results = logs.filter(log =>
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.service.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    setSearchResults(results);
  };
  
  return (
    <div className="card">
      <div className="card-header">
        <h6 className="mb-0">
          <i className="fas fa-search me-2"></i>
          Pesquisa Avançada
        </h6>
      </div>
      <div className="card-body">
        <div className="mb-3">
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder="Digite sua pesquisa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="btn btn-primary" onClick={handleSearch}>
              <i className="fas fa-search"></i>
            </button>
          </div>
        </div>
        
        <div className="search-results">
          <p className="text-muted">
            {searchResults.length} resultado(s) encontrado(s)
          </p>
          
          {searchResults.map(log => (
            <div key={log.id} className="border-bottom pb-2 mb-2">
              <div className="d-flex justify-content-between align-items-start mb-1">
                <div className="d-flex align-items-center">
                  <span className={`badge bg-${log.level === 'ERROR' ? 'danger' : log.level === 'WARN' ? 'warning' : 'info'} me-2`}>
                    {log.level}
                  </span>
                  <strong>{log.service}</strong>
                </div>
                <small className="text-muted">
                  {new Date(log.timestamp).toLocaleString('pt-BR')}
                </small>
              </div>
              <div className="small">
                <div>{log.message}</div>
                {log.details && (
                  <div className="text-muted mt-1">{log.details}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Log Analytics Tab Component
 */
function LogAnalyticsTab({ logs, stats }) {
  const getTopServices = () => {
    return Object.entries(stats.services)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
  };
  
  const getErrorRate = () => {
    if (stats.total === 0) return 0;
    return ((stats.errors / stats.total) * 100).toFixed(2);
  };
  
  return (
    <div className="row">
      <div className="col-md-6 mb-4">
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-chart-pie me-2"></i>
              Distribuição por Nível
            </h6>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span>Erros</span>
                <span className="text-danger fw-bold">{stats.errors}</span>
              </div>
              <div className="progress mb-2" style={{height: '8px'}}>
                <div 
                  className="progress-bar bg-danger" 
                  style={{width: `${stats.total ? (stats.errors / stats.total) * 100 : 0}%`}}
                ></div>
              </div>
            </div>
            
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span>Avisos</span>
                <span className="text-warning fw-bold">{stats.warnings}</span>
              </div>
              <div className="progress mb-2" style={{height: '8px'}}>
                <div 
                  className="progress-bar bg-warning" 
                  style={{width: `${stats.total ? (stats.warnings / stats.total) * 100 : 0}%`}}
                ></div>
              </div>
            </div>
            
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span>Informações</span>
                <span className="text-info fw-bold">{stats.info}</span>
              </div>
              <div className="progress mb-2" style={{height: '8px'}}>
                <div 
                  className="progress-bar bg-info" 
                  style={{width: `${stats.total ? (stats.info / stats.total) * 100 : 0}%`}}
                ></div>
              </div>
            </div>
            
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span>Debug</span>
                <span className="text-secondary fw-bold">{stats.debug}</span>
              </div>
              <div className="progress" style={{height: '8px'}}>
                <div 
                  className="progress-bar bg-secondary" 
                  style={{width: `${stats.total ? (stats.debug / stats.total) * 100 : 0}%`}}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="col-md-6 mb-4">
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-server me-2"></i>
              Top Serviços por Volume
            </h6>
          </div>
          <div className="card-body">
            {getTopServices().map(([service, count]) => (
              <div key={service} className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span>{service}</span>
                  <span className="fw-bold">{count}</span>
                </div>
                <div className="progress" style={{height: '6px'}}>
                  <div 
                    className="progress-bar bg-primary" 
                    style={{width: `${(count / stats.total) * 100}%`}}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="col-12">
        <div className="row text-center">
          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <h3 className="text-danger">{getErrorRate()}%</h3>
                <p className="mb-0">Taxa de Erro</p>
              </div>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <h3 className="text-primary">{logs.length}</h3>
                <p className="mb-0">Logs Filtrados</p>
              </div>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <h3 className="text-success">{Object.keys(stats.services).length}</h3>
                <p className="mb-0">Serviços Ativos</p>
              </div>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <h3 className="text-info">{Math.round(stats.total / 24)}</h3>
                <p className="mb-0">Logs/Hora (média)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Log Alerts Tab Component
 */
function LogAlertsTab({ logs }) {
  const [alerts] = useState([
    {
      id: 1,
      name: 'High Error Rate',
      condition: 'Error rate > 5% in last 15 minutes',
      status: 'active',
      triggered: true,
      lastTriggered: new Date(),
      description: 'Alert when error rate exceeds threshold'
    },
    {
      id: 2,
      name: 'Service Unavailable',
      condition: 'No logs from service in last 5 minutes',
      status: 'active',
      triggered: false,
      lastTriggered: null,
      description: 'Alert when service stops logging'
    }
  ]);
  
  return (
    <div className="row">
      <div className="col-md-8">
        <div className="card">
          <div className="card-header">
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="mb-0">
                <i className="fas fa-bell me-2"></i>
                Regras de Alerta
              </h6>
              <button className="btn btn-primary btn-sm">
                <i className="fas fa-plus me-1"></i>
                Nova Regra
              </button>
            </div>
          </div>
          <div className="card-body">
            {alerts.map(alert => (
              <div key={alert.id} className="border rounded p-3 mb-3">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h6 className="mb-1">{alert.name}</h6>
                    <small className="text-muted">{alert.description}</small>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className={`badge bg-${alert.triggered ? 'danger' : 'success'}`}>
                      {alert.triggered ? 'Ativo' : 'OK'}
                    </span>
                    <span className={`badge bg-${alert.status === 'active' ? 'primary' : 'secondary'}`}>
                      {alert.status}
                    </span>
                  </div>
                </div>
                
                <div className="small mb-2">
                  <strong>Condição:</strong> {alert.condition}
                </div>
                
                {alert.lastTriggered && (
                  <div className="small text-muted">
                    Último disparo: {alert.lastTriggered.toLocaleString('pt-BR')}
                  </div>
                )}
                
                <div className="mt-2">
                  <button className="btn btn-outline-primary btn-sm me-2">
                    <i className="fas fa-edit"></i> Editar
                  </button>
                  <button className="btn btn-outline-secondary btn-sm me-2">
                    <i className="fas fa-pause"></i> Pausar
                  </button>
                  <button className="btn btn-outline-danger btn-sm">
                    <i className="fas fa-trash"></i> Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="col-md-4">
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-history me-2"></i>
              Histórico de Alertas
            </h6>
          </div>
          <div className="card-body">
            <div className="small">
              <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                <div>
                  <div className="fw-medium text-danger">High Error Rate</div>
                  <div className="text-muted">Disparado agora</div>
                </div>
                <i className="fas fa-exclamation-triangle text-danger"></i>
              </div>
              
              <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                <div>
                  <div className="fw-medium text-success">Service Unavailable</div>
                  <div className="text-muted">Resolvido há 1h</div>
                </div>
                <i className="fas fa-check-circle text-success"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}