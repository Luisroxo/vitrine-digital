/**
 * @fileoverview Log Dashboard Component - React interface for log visualization
 * @version 1.0.0
 * @description Dashboard completo para visualização de logs, métricas em tempo real,
 * análise de padrões e monitoramento de sistema
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Container, Row, Col, Card, Table, Badge, Alert, 
  Form, Button, InputGroup, Spinner, Nav, Tab 
} from 'react-bootstrap';
import { 
  FaSearch, FaDownload, FaRefresh, FaFilter, 
  FaExclamationTriangle, FaInfoCircle, FaBug, 
  FaChartLine, FaServer, FaClock, FaTrash
} from 'react-icons/fa';

const LogDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchDashboardData();
    
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchDashboardData, 30000); // 30 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/shared/logs/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      
      const data = await response.json();
      setDashboardData(data);
      setRecentLogs(data.recentLogs || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (levelFilter) params.append('level', levelFilter);
      params.append('limit', '100');

      const response = await fetch(`/api/shared/logs/search?${params}`);
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      setRecentLogs(data.logs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = async (format = 'json') => {
    try {
      const params = new URLSearchParams();
      if (levelFilter) params.append('level', levelFilter);
      if (searchQuery) params.append('query', searchQuery);
      params.append('format', format);
      params.append('limit', '1000');

      const response = await fetch(`/api/shared/logs/export?${params}`);
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `logs.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const createTestLog = async (level = 'info') => {
    try {
      const response = await fetch('/api/shared/logs/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level,
          message: `Test ${level} log from dashboard`,
          count: 1
        })
      });
      
      if (!response.ok) throw new Error('Test log creation failed');
      
      // Refresh data after creating test log
      setTimeout(fetchDashboardData, 1000);
    } catch (err) {
      setError(err.message);
    }
  };

  const cleanupLogs = async () => {
    if (!window.confirm('Are you sure you want to clean up old logs?')) return;
    
    try {
      const response = await fetch('/api/shared/logs/cleanup?daysToKeep=30', {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Cleanup failed');
      
      const result = await response.json();
      alert(`Cleanup completed. ${result.deletedFiles} files deleted.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getLogLevelBadge = (level) => {
    const variants = {
      error: 'danger',
      warn: 'warning', 
      info: 'info',
      debug: 'secondary'
    };
    
    const icons = {
      error: <FaExclamationTriangle />,
      warn: <FaExclamationTriangle />,
      info: <FaInfoCircle />,
      debug: <FaBug />
    };

    return (
      <Badge variant={variants[level]} className="d-flex align-items-center gap-1">
        {icons[level]} {level.toUpperCase()}
      </Badge>
    );
  };

  const getHealthBadge = (status) => {
    const variants = {
      healthy: 'success',
      degraded: 'warning',
      unhealthy: 'danger'
    };

    return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
  };

  if (loading && !dashboardData) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="sr-only">Loading...</span>
        </Spinner>
        <p className="mt-3">Loading dashboard data...</p>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="h3">
              <FaServer className="me-2" />
              Log Dashboard
              {dashboardData && (
                <small className="text-muted ms-3">
                  {dashboardData.service || 'All Services'}
                </small>
              )}
            </h1>
            
            <div className="d-flex gap-2">
              <Form.Check 
                type="switch"
                id="auto-refresh"
                label="Auto Refresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              
              <Button 
                variant="outline-primary" 
                size="sm"
                onClick={fetchDashboardData}
                disabled={loading}
              >
                <FaRefresh /> Refresh
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" className="mb-4" dismissible onClose={() => setError(null)}>
          <FaExclamationTriangle className="me-2" />
          {error}
        </Alert>
      )}

      {dashboardData && (
        <>
          {/* Overview Cards */}
          <Row className="mb-4">
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">Total Logs</h5>
                  <h2 className="text-primary">{dashboardData.overview.totalLogs.toLocaleString()}</h2>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">Errors</h5>
                  <h2 className="text-danger">{dashboardData.overview.errorCount.toLocaleString()}</h2>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">Warnings</h5>
                  <h2 className="text-warning">{dashboardData.overview.warningCount.toLocaleString()}</h2>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">Health Status</h5>
                  <h4>{getHealthBadge(dashboardData.health.status)}</h4>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Tabs */}
          <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
            <Nav variant="tabs" className="mb-4">
              <Nav.Item>
                <Nav.Link eventKey="overview">
                  <FaChartLine className="me-1" />
                  Overview
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="logs">
                  <FaServer className="me-1" />
                  Recent Logs
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="requests">
                  <FaClock className="me-1" />
                  Request Metrics
                </Nav.Link>
              </Nav.Item>
            </Nav>

            <Tab.Content>
              {/* Overview Tab */}
              <Tab.Pane eventKey="overview">
                <Row>
                  <Col md={6}>
                    <Card className="mb-4">
                      <Card.Header>System Health</Card.Header>
                      <Card.Body>
                        <Table size="sm">
                          <tbody>
                            <tr>
                              <td>Logger</td>
                              <td>{dashboardData.health.checks.logger ? '✅' : '❌'}</td>
                            </tr>
                            <tr>
                              <td>Files</td>
                              <td>{dashboardData.health.checks.files ? '✅' : '❌'}</td>
                            </tr>
                            <tr>
                              <td>Redis</td>
                              <td>{dashboardData.health.checks.redis ? '✅' : '❌'}</td>
                            </tr>
                            <tr>
                              <td>Elasticsearch</td>
                              <td>{dashboardData.health.checks.elasticsearch ? '✅' : '❌'}</td>
                            </tr>
                          </tbody>
                        </Table>
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={6}>
                    <Card className="mb-4">
                      <Card.Header>Quick Actions</Card.Header>
                      <Card.Body>
                        <div className="d-grid gap-2">
                          <Button 
                            variant="outline-info" 
                            size="sm"
                            onClick={() => createTestLog('info')}
                          >
                            Create Test Info Log
                          </Button>
                          <Button 
                            variant="outline-warning" 
                            size="sm"
                            onClick={() => createTestLog('warn')}
                          >
                            Create Test Warning
                          </Button>
                          <Button 
                            variant="outline-danger" 
                            size="sm"
                            onClick={() => createTestLog('error')}
                          >
                            Create Test Error
                          </Button>
                          <Button 
                            variant="outline-secondary" 
                            size="sm"
                            onClick={cleanupLogs}
                          >
                            <FaTrash className="me-1" />
                            Cleanup Old Logs
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Tab.Pane>

              {/* Logs Tab */}
              <Tab.Pane eventKey="logs">
                <Card>
                  <Card.Header>
                    <Row className="align-items-center">
                      <Col md={8}>
                        <InputGroup>
                          <Form.Control
                            placeholder="Search logs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && searchLogs()}
                          />
                          <Form.Select
                            value={levelFilter}
                            onChange={(e) => setLevelFilter(e.target.value)}
                            style={{ maxWidth: '120px' }}
                          >
                            <option value="">All Levels</option>
                            <option value="error">Error</option>
                            <option value="warn">Warning</option>
                            <option value="info">Info</option>
                            <option value="debug">Debug</option>
                          </Form.Select>
                          <Button variant="outline-secondary" onClick={searchLogs}>
                            <FaSearch />
                          </Button>
                        </InputGroup>
                      </Col>
                      
                      <Col md={4} className="text-end">
                        <Button 
                          variant="outline-success" 
                          size="sm" 
                          className="me-2"
                          onClick={() => exportLogs('json')}
                        >
                          <FaDownload /> JSON
                        </Button>
                        <Button 
                          variant="outline-success" 
                          size="sm" 
                          className="me-2"
                          onClick={() => exportLogs('csv')}
                        >
                          <FaDownload /> CSV
                        </Button>
                        <Button 
                          variant="outline-success" 
                          size="sm"
                          onClick={() => exportLogs('txt')}
                        >
                          <FaDownload /> TXT
                        </Button>
                      </Col>
                    </Row>
                  </Card.Header>
                  
                  <Card.Body style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    {recentLogs.length === 0 ? (
                      <p className="text-center text-muted py-4">No logs found</p>
                    ) : (
                      <Table striped hover size="sm">
                        <thead>
                          <tr>
                            <th style={{ width: '160px' }}>Timestamp</th>
                            <th style={{ width: '80px' }}>Level</th>
                            <th style={{ width: '100px' }}>Service</th>
                            <th>Message</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentLogs.map((log, index) => (
                            <tr key={index}>
                              <td>
                                <small>{formatTimestamp(log.timestamp)}</small>
                              </td>
                              <td>{getLogLevelBadge(log.level)}</td>
                              <td>
                                <small className="text-muted">
                                  {log.service || 'N/A'}
                                </small>
                              </td>
                              <td>
                                <div 
                                  style={{ 
                                    maxWidth: '400px', 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title={log.message}
                                >
                                  {log.message}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </Card.Body>
                </Card>
              </Tab.Pane>

              {/* Request Metrics Tab */}
              <Tab.Pane eventKey="requests">
                {dashboardData.requests ? (
                  <Row>
                    <Col md={6}>
                      <Card className="mb-4">
                        <Card.Header>Request Statistics</Card.Header>
                        <Card.Body>
                          <Table size="sm">
                            <tbody>
                              <tr>
                                <td>Total Requests</td>
                                <td><strong>{dashboardData.requests.totalRequests}</strong></td>
                              </tr>
                              <tr>
                                <td>Avg Response Time</td>
                                <td><strong>{dashboardData.requests.averageResponseTime}ms</strong></td>
                              </tr>
                              <tr>
                                <td>Error Rate</td>
                                <td><strong>{dashboardData.requests.errorRate}%</strong></td>
                              </tr>
                            </tbody>
                          </Table>
                        </Card.Body>
                      </Card>
                    </Col>
                    
                    <Col md={6}>
                      <Card className="mb-4">
                        <Card.Header>Status Code Distribution</Card.Header>
                        <Card.Body>
                          {Object.entries(dashboardData.requests.statusCodeDistribution || {}).map(([code, count]) => (
                            <div key={code} className="d-flex justify-content-between">
                              <span>{code}</span>
                              <Badge variant="secondary">{count}</Badge>
                            </div>
                          ))}
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                ) : (
                  <Alert variant="info">
                    Request metrics not available. Enable request logging middleware.
                  </Alert>
                )}
              </Tab.Pane>
            </Tab.Content>
          </Tab.Container>
        </>
      )}
    </Container>
  );
};

export default LogDashboard;