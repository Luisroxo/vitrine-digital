import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Alert, Badge, Row, Col, Spinner, Table } from 'react-bootstrap';

const CacheAdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [invalidating, setInvalidating] = useState(false);
  const [alert, setAlert] = useState(null);
  const [invalidateForm, setInvalidateForm] = useState({
    category: '',
    key: ''
  });

  const API_BASE = process.env.REACT_APP_PRODUCT_SERVICE_URL || 'http://localhost:3003';

  // Carregar estatísticas do cache
  const loadCacheStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/cache/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        showAlert('Erro ao carregar estatísticas do cache', 'danger');
      }
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
      showAlert('Erro ao conectar com o cache service', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Verificar saúde do cache
  const checkCacheHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/cache/health`);
      const health = await response.json();
      return health;
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  };

  // Invalidar cache
  const handleInvalidate = async (e) => {
    e.preventDefault();
    
    if (!invalidateForm.category && !invalidateForm.key) {
      showAlert('Informe uma categoria ou chave específica', 'warning');
      return;
    }

    setInvalidating(true);
    try {
      const response = await fetch(`${API_BASE}/api/cache/invalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidateForm)
      });

      const result = await response.json();
      
      if (response.ok) {
        showAlert(result.message, 'success');
        setInvalidateForm({ category: '', key: '' });
        // Recarregar stats após invalidação
        setTimeout(loadCacheStats, 1000);
      } else {
        showAlert(result.error || 'Erro ao invalidar cache', 'danger');
      }
    } catch (error) {
      console.error('Erro ao invalidar cache:', error);
      showAlert('Erro ao invalidar cache', 'danger');
    } finally {
      setInvalidating(false);
    }
  };

  // Mostrar alerta
  const showAlert = (message, variant) => {
    setAlert({ message, variant });
    setTimeout(() => setAlert(null), 5000);
  };

  // Formatar bytes
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Formatar tempo
  const formatUptime = (seconds) => {
    if (!seconds) return '0s';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  useEffect(() => {
    loadCacheStats();
    
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(loadCacheStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="cache-admin">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4>🗄️ Cache Administration</h4>
        <Button 
          variant="outline-primary" 
          onClick={loadCacheStats}
          disabled={loading}
        >
          {loading ? <Spinner size="sm" /> : '🔄'} Atualizar
        </Button>
      </div>

      {alert && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      <Row>
        <Col md={8}>
          {/* Cache Statistics */}
          <Card className="mb-4">
            <Card.Header>
              <h5>📊 Estatísticas do Cache</h5>
            </Card.Header>
            <Card.Body>
              {loading ? (
                <div className="text-center p-4">
                  <Spinner animation="border" />
                </div>
              ) : stats ? (
                <Row>
                  <Col md={6}>
                    <h6>🔗 Conexão</h6>
                    <p>
                      <Badge bg={stats.connected ? 'success' : 'danger'}>
                        {stats.connected ? 'Conectado' : 'Desconectado'}
                      </Badge>
                    </p>

                    <h6>💾 Memória</h6>
                    <ul className="list-unstyled">
                      <li><strong>Usado:</strong> {formatBytes(stats.memory?.used_memory)}</li>
                      <li><strong>Peak:</strong> {formatBytes(stats.memory?.used_memory_peak)}</li>
                      <li><strong>RSS:</strong> {formatBytes(stats.memory?.used_memory_rss)}</li>
                    </ul>
                  </Col>
                  
                  <Col md={6}>
                    <h6>🔑 Keyspace</h6>
                    {stats.keyspace && Object.keys(stats.keyspace).length > 0 ? (
                      Object.entries(stats.keyspace).map(([db, info]) => (
                        <div key={db}>
                          <strong>{db}:</strong> {info}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted">Nenhuma chave encontrada</p>
                    )}

                    <h6>⚙️ Estratégias de Cache</h6>
                    <Table size="sm">
                      <thead>
                        <tr>
                          <th>Categoria</th>
                          <th>TTL</th>
                          <th>Refresh</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.strategies && Object.entries(stats.strategies).map(([category, config]) => (
                          <tr key={category}>
                            <td><Badge bg="secondary">{category}</Badge></td>
                            <td>{config.ttl}s</td>
                            <td>
                              <Badge bg={config.refresh ? 'success' : 'secondary'}>
                                {config.refresh ? 'Sim' : 'Não'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Col>
                </Row>
              ) : (
                <Alert variant="warning">
                  Cache service indisponível ou erro ao carregar estatísticas.
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          {/* Cache Invalidation */}
          <Card>
            <Card.Header>
              <h5>🗑️ Invalidar Cache</h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleInvalidate}>
                <Form.Group className="mb-3">
                  <Form.Label>Categoria</Form.Label>
                  <Form.Select 
                    value={invalidateForm.category}
                    onChange={(e) => setInvalidateForm(prev => ({
                      ...prev, 
                      category: e.target.value
                    }))}
                  >
                    <option value="">Selecione uma categoria</option>
                    <option value="products">Products</option>
                    <option value="images">Images</option>
                    <option value="search">Search</option>
                    <option value="analytics">Analytics</option>
                    <option value="catalog">Catalog</option>
                    <option value="sessions">Sessions</option>
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Invalidar toda a categoria (opcional)
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Chave Específica</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Ex: GET:/api/products/123"
                    value={invalidateForm.key}
                    onChange={(e) => setInvalidateForm(prev => ({
                      ...prev,
                      key: e.target.value
                    }))}
                  />
                  <Form.Text className="text-muted">
                    Invalidar chave específica (opcional)
                  </Form.Text>
                </Form.Group>

                <div className="d-grid gap-2">
                  <Button 
                    type="submit" 
                    variant="danger"
                    disabled={invalidating || (!invalidateForm.category && !invalidateForm.key)}
                  >
                    {invalidating ? (
                      <>
                        <Spinner size="sm" className="me-2" />
                        Invalidando...
                      </>
                    ) : (
                      '🗑️ Invalidar Cache'
                    )}
                  </Button>
                </div>
              </Form>

              <hr />

              <div className="text-center">
                <small className="text-muted">
                  <strong>Atalhos Rápidos:</strong>
                </small>
              </div>
              
              <div className="d-grid gap-2 mt-2">
                <Button 
                  size="sm" 
                  variant="outline-warning"
                  onClick={() => {
                    setInvalidateForm({ category: 'products', key: '' });
                    const form = document.querySelector('form');
                    if (form) form.requestSubmit();
                  }}
                  disabled={invalidating}
                >
                  Limpar Products
                </Button>
                
                <Button 
                  size="sm" 
                  variant="outline-warning"
                  onClick={() => {
                    setInvalidateForm({ category: 'search', key: '' });
                    const form = document.querySelector('form');
                    if (form) form.requestSubmit();
                  }}
                  disabled={invalidating}
                >
                  Limpar Search
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CacheAdminDashboard;