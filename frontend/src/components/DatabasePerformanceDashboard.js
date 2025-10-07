import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Alert, Badge, Row, Col, Spinner, ProgressBar } from 'react-bootstrap';

const DatabasePerformanceDashboard = () => {
  const [performanceData, setPerformanceData] = useState(null);
  const [indexAnalysis, setIndexAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const API_BASE = process.env.REACT_APP_PRODUCT_SERVICE_URL || 'http://localhost:3003';

  // Carregar dados de performance
  const loadPerformanceData = async () => {
    setLoading(true);
    try {
      const [perfResponse, indexResponse] = await Promise.all([
        fetch(`${API_BASE}/api/db/performance`),
        fetch(`${API_BASE}/api/db/indexes`)
      ]);

      if (perfResponse.ok) {
        const perfData = await perfResponse.json();
        setPerformanceData(perfData);
      }

      if (indexResponse.ok) {
        const indexData = await indexResponse.json();
        setIndexAnalysis(indexData);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showAlert('Erro ao carregar dados de performance', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Limpar estatísticas
  const clearStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/db/clear-stats`, {
        method: 'POST'
      });

      if (response.ok) {
        showAlert('Estatísticas de performance resetadas', 'success');
        setTimeout(loadPerformanceData, 1000);
      } else {
        showAlert('Erro ao limpar estatísticas', 'danger');
      }
    } catch (error) {
      showAlert('Erro ao limpar estatísticas', 'danger');
    }
  };

  // Mostrar alerta
  const showAlert = (message, variant) => {
    setAlert({ message, variant });
    setTimeout(() => setAlert(null), 5000);
  };

  // Formatar duração
  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Obter cor baseada na performance
  const getPerformanceColor = (avgTime) => {
    if (avgTime < 100) return 'success';
    if (avgTime < 500) return 'warning';
    return 'danger';
  };

  useEffect(() => {
    loadPerformanceData();
    
    // Auto-refresh a cada 60 segundos
    const interval = setInterval(loadPerformanceData, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="database-performance">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4>🗃️ Database Performance</h4>
        <div className="d-flex gap-2">
          <Button 
            variant="outline-primary" 
            onClick={loadPerformanceData}
            disabled={loading}
          >
            {loading ? <Spinner size="sm" /> : '🔄'} Atualizar
          </Button>
          <Button 
            variant="outline-warning" 
            onClick={clearStats}
            disabled={loading}
          >
            🗑️ Limpar Stats
          </Button>
        </div>
      </div>

      {alert && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      {loading && !performanceData ? (
        <div className="text-center p-4">
          <Spinner animation="border" />
          <p className="mt-2">Carregando dados de performance...</p>
        </div>
      ) : (
        <Row>
          <Col lg={8}>
            {/* Performance Overview */}
            <Card className="mb-4">
              <Card.Header>
                <h5>📊 Visão Geral da Performance</h5>
              </Card.Header>
              <Card.Body>
                {performanceData?.performance ? (
                  <Row>
                    <Col md={3}>
                      <div className="text-center">
                        <h3 className="text-primary">{performanceData.performance.totalQueries}</h3>
                        <small className="text-muted">Total de Queries</small>
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="text-center">
                        <h3 className="text-info">{performanceData.performance.uniqueQueries}</h3>
                        <small className="text-muted">Queries Únicas</small>
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="text-center">
                        <h3 className="text-warning">{performanceData.performance.slowQueries}</h3>
                        <small className="text-muted">Queries Lentas</small>
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="text-center">
                        <h3 className={`text-${performanceData.performance.slowQueries / performanceData.performance.totalQueries > 0.1 ? 'danger' : 'success'}`}>
                          {((performanceData.performance.slowQueries / performanceData.performance.totalQueries) * 100).toFixed(1)}%
                        </h3>
                        <small className="text-muted">% Lentas</small>
                      </div>
                    </Col>
                  </Row>
                ) : (
                  <Alert variant="info">Nenhum dado de performance disponível ainda.</Alert>
                )}
              </Card.Body>
            </Card>

            {/* Top Slow Queries */}
            <Card className="mb-4">
              <Card.Header>
                <h5>🐌 Queries Mais Lentas</h5>
              </Card.Header>
              <Card.Body>
                {performanceData?.performance?.topSlowQueries?.length > 0 ? (
                  <Table striped hover size="sm">
                    <thead>
                      <tr>
                        <th>Query</th>
                        <th>Execuções</th>
                        <th>Tempo Médio</th>
                        <th>Tempo Máximo</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performanceData.performance.topSlowQueries.slice(0, 10).map((query, index) => (
                        <tr key={index}>
                          <td>
                            <code style={{ fontSize: '0.8em' }}>
                              {query.query}
                            </code>
                          </td>
                          <td>{query.count}</td>
                          <td>
                            <Badge bg={getPerformanceColor(query.avgTime)}>
                              {formatDuration(query.avgTime)}
                            </Badge>
                          </td>
                          <td>{formatDuration(query.maxTime)}</td>
                          <td>
                            {query.avgTime > 1000 ? (
                              <Badge bg="danger">Crítico</Badge>
                            ) : query.avgTime > 500 ? (
                              <Badge bg="warning">Atenção</Badge>
                            ) : (
                              <Badge bg="success">OK</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <Alert variant="success">Nenhuma query lenta detectada! 🎉</Alert>
                )}
              </Card.Body>
            </Card>

            {/* Recent Slow Queries */}
            {performanceData?.performance?.recentSlowQueries?.length > 0 && (
              <Card className="mb-4">
                <Card.Header>
                  <h5>⏱️ Queries Lentas Recentes</h5>
                </Card.Header>
                <Card.Body>
                  <Table striped hover size="sm">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Query</th>
                        <th>Duração</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performanceData.performance.recentSlowQueries.slice(0, 5).map((query, index) => (
                        <tr key={index}>
                          <td>{new Date(query.timestamp).toLocaleString()}</td>
                          <td>
                            <code style={{ fontSize: '0.8em' }}>
                              {query.normalized.substring(0, 80)}...
                            </code>
                          </td>
                          <td>
                            <Badge bg="danger">
                              {formatDuration(query.duration)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            )}
          </Col>

          <Col lg={4}>
            {/* Recommendations */}
            {performanceData?.recommendations?.length > 0 && (
              <Card className="mb-4">
                <Card.Header>
                  <h5>💡 Recomendações</h5>
                </Card.Header>
                <Card.Body>
                  {performanceData.recommendations.map((rec, index) => (
                    <Alert 
                      key={index} 
                      variant={rec.type === 'critical' ? 'danger' : rec.type === 'warning' ? 'warning' : 'info'}
                      className="mb-2"
                    >
                      <strong>{rec.message}</strong>
                      <br />
                      <small>{rec.action}</small>
                    </Alert>
                  ))}
                </Card.Body>
              </Card>
            )}

            {/* Index Analysis */}
            <Card className="mb-4">
              <Card.Header>
                <h5>📇 Análise de Índices</h5>
              </Card.Header>
              <Card.Body>
                {indexAnalysis ? (
                  <>
                    {indexAnalysis.error ? (
                      <Alert variant="warning">{indexAnalysis.error}</Alert>
                    ) : (
                      <>
                        <h6>Índices Mais Utilizados</h6>
                        {indexAnalysis.mostUsed?.slice(0, 5).map((index, i) => (
                          <div key={i} className="mb-2">
                            <div className="d-flex justify-content-between">
                              <small><strong>{index.indexname}</strong></small>
                              <small>{index.idx_scan} scans</small>
                            </div>
                            <ProgressBar 
                              now={Math.min(100, (index.idx_scan / 1000) * 100)} 
                              size="sm"
                              variant="success"
                            />
                          </div>
                        ))}

                        {indexAnalysis.unused?.length > 0 && (
                          <>
                            <hr />
                            <h6 className="text-warning">Índices Não Utilizados</h6>
                            {indexAnalysis.unused.slice(0, 3).map((index, i) => (
                              <div key={i} className="mb-1">
                                <small>
                                  <Badge bg="warning">{index.indexname}</Badge>
                                  <span className="ms-2">{index.size}</span>
                                </small>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <Alert variant="info">Carregando análise de índices...</Alert>
                )}
              </Card.Body>
            </Card>

            {/* Performance Health */}
            <Card>
              <Card.Header>
                <h5>🏥 Saúde da Performance</h5>
              </Card.Header>
              <Card.Body>
                {performanceData?.performance ? (
                  <>
                    <div className="mb-3">
                      <div className="d-flex justify-content-between">
                        <span>Queries Rápidas</span>
                        <span>{((performanceData.performance.totalQueries - performanceData.performance.slowQueries) / performanceData.performance.totalQueries * 100).toFixed(1)}%</span>
                      </div>
                      <ProgressBar 
                        now={(performanceData.performance.totalQueries - performanceData.performance.slowQueries) / performanceData.performance.totalQueries * 100}
                        variant="success"
                      />
                    </div>

                    <div className="mb-3">
                      <div className="d-flex justify-content-between">
                        <span>Queries Únicas vs Total</span>
                        <span>{(performanceData.performance.uniqueQueries / performanceData.performance.totalQueries * 100).toFixed(1)}%</span>
                      </div>
                      <ProgressBar 
                        now={performanceData.performance.uniqueQueries / performanceData.performance.totalQueries * 100}
                        variant="info"
                      />
                    </div>

                    <div className="text-center">
                      <Badge 
                        bg={performanceData.performance.slowQueries / performanceData.performance.totalQueries < 0.05 ? 'success' : 
                           performanceData.performance.slowQueries / performanceData.performance.totalQueries < 0.1 ? 'warning' : 'danger'}
                        className="fs-6"
                      >
                        {performanceData.performance.slowQueries / performanceData.performance.totalQueries < 0.05 ? 'Excelente' :
                         performanceData.performance.slowQueries / performanceData.performance.totalQueries < 0.1 ? 'Bom' : 'Precisa Atenção'}
                      </Badge>
                    </div>
                  </>
                ) : (
                  <Alert variant="info">Aguardando dados...</Alert>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default DatabasePerformanceDashboard;