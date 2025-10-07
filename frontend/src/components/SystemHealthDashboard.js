/**
 * @fileoverview System Health Dashboard Component - Consolidated monitoring interface
 * @version 1.0.0
 * @description Dashboard consolidado para monitoramento de todos os microserviços
 * com visão unificada, métricas aggregadas e alertas do sistema
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Container, Row, Col, Card, Table, Badge, Alert, 
  ProgressBar, Nav, Tab, Modal, Button, Form 
} from 'react-bootstrap';
import { 
  FaServer, FaExclamationTriangle, FaCheckCircle, 
  FaClock, FaChartLine, FaRefresh, FaEye, 
  FaTachometerAlt, FaHeartbeat, FaNetworkWired,
  FaCloudUploadAlt, FaDatabase, FaCogs
} from 'react-icons/fa';

const SystemHealthDashboard = () => {
  const [systemData, setSystemData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedService, setSelectedService] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchSystemData();
    
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchSystemData, 30000); // 30 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  const fetchSystemData = async () => {
    try {
      const response = await fetch('/api/shared/system/dashboard');
      if (!response.ok) throw new Error('Failed to fetch system data');
      
      const data = await response.json();
      setSystemData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('System Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkSpecificService = async (serviceId) => {
    try {
      const response = await fetch(`/api/shared/system/services/${serviceId}/check`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Service check failed');
      
      // Refresh data after check
      setTimeout(fetchSystemData, 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  const viewServiceDetails = (serviceId) => {
    const service = systemData?.services[serviceId];
    if (service) {
      setSelectedService({ id: serviceId, ...service });
      setShowServiceModal(true);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      healthy: 'success',
      unhealthy: 'danger',
      degraded: 'warning',
      critical: 'danger',
      unknown: 'secondary'
    };
    
    const icons = {
      healthy: <FaCheckCircle />,
      unhealthy: <FaExclamationTriangle />,
      degraded: <FaExclamationTriangle />,
      critical: <FaExclamationTriangle />,
      unknown: <FaClock />
    };

    return (
      <Badge variant={variants[status]} className="d-flex align-items-center gap-1">
        {icons[status]} {status.toUpperCase()}
      </Badge>
    );
  };

  const getSystemStatusColor = (status) => {
    const colors = {
      healthy: 'success',
      degraded: 'warning',
      critical: 'danger',
      unknown: 'secondary'
    };
    return colors[status] || 'secondary';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      core: <FaServer />,
      business: <FaCogs />,
      integration: <FaNetworkWired />,
      data: <FaDatabase />,
      other: <FaCloudUploadAlt />
    };
    return icons[category] || <FaServer />;
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (milliseconds) => {
    if (milliseconds < 1000) return `${milliseconds}ms`;
    if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1)}s`;
    return `${(milliseconds / 60000).toFixed(1)}m`;
  };

  if (loading && !systemData) {
    return (
      <Container className="text-center mt-5">
        <div className="spinner-border" role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <p className="mt-3">Loading system health data...</p>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="h3">
              <FaTachometerAlt className="me-2" />
              System Health Dashboard
              <small className="text-muted ms-3">
                Consolidated Monitoring
              </small>
            </h1>
            
            <div className="d-flex gap-2 align-items-center">
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
                onClick={fetchSystemData}
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

      {systemData && (
        <>
          {/* System Overview Cards */}
          <Row className="mb-4">
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">
                    <FaHeartbeat className="me-2" />
                    System Status
                  </h5>
                  <h3 className={`text-${getSystemStatusColor(systemData.system.overallStatus)}`}>
                    {getStatusBadge(systemData.system.overallStatus)}
                  </h3>
                  <small className="text-muted">
                    Last Update: {formatTimestamp(systemData.system.lastUpdate)}
                  </small>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">
                    <FaServer className="me-2" />
                    Services Health
                  </h5>
                  <ProgressBar 
                    variant="success" 
                    now={(systemData.system.healthyServices / systemData.system.totalServices) * 100} 
                    label={`${systemData.system.healthyServices}/${systemData.system.totalServices}`}
                    className="mb-2"
                  />
                  <small className="text-muted">
                    {((systemData.system.healthyServices / systemData.system.totalServices) * 100).toFixed(1)}% Healthy
                  </small>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">
                    <FaClock className="me-2" />
                    Avg Response Time
                  </h5>
                  <h2 className={`text-${systemData.performance?.avgResponseTime > 2000 ? 'danger' : systemData.performance?.avgResponseTime > 1000 ? 'warning' : 'success'}`}>
                    {systemData.performance?.avgResponseTime || 0}ms
                  </h2>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">
                    <FaExclamationTriangle className="me-2" />
                    Active Alerts
                  </h5>
                  <h2 className={systemData.system.alerts?.length > 0 ? 'text-warning' : 'text-success'}>
                    {systemData.system.alerts?.length || 0}
                  </h2>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* System Performance Summary */}
          {systemData.performance && (
            <Row className="mb-4">
              <Col>
                <Card>
                  <Card.Header>System Performance Overview</Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={3}>
                        <div className="text-center">
                          <h6>Total Requests</h6>
                          <h4 className="text-info">{systemData.performance.totalRequests.toLocaleString()}</h4>
                        </div>
                      </Col>
                      <Col md={3}>
                        <div className="text-center">
                          <h6>Error Rate</h6>
                          <h4 className={`text-${systemData.performance.overallErrorRate > 5 ? 'danger' : systemData.performance.overallErrorRate > 1 ? 'warning' : 'success'}`}>
                            {systemData.performance.overallErrorRate.toFixed(2)}%
                          </h4>
                        </div>
                      </Col>
                      <Col md={3}>
                        <div className="text-center">
                          <h6>System Uptime</h6>
                          <h4 className="text-success">{systemData.performance.systemUptime.toFixed(2)}%</h4>
                        </div>
                      </Col>
                      <Col md={3}>
                        <div className="text-center">
                          <h6>Trend</h6>
                          <h4 className={`text-${systemData.trends?.direction === 'improving' ? 'success' : 'warning'}`}>
                            {systemData.trends?.direction === 'improving' ? '📈' : '📉'} 
                            {systemData.trends?.direction || 'Stable'}
                          </h4>
                        </div>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

          {/* Tabs */}
          <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
            <Nav variant="tabs" className="mb-4">
              <Nav.Item>
                <Nav.Link eventKey="overview">
                  <FaChartLine className="me-1" />
                  Services Overview
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="categories">
                  <FaCogs className="me-1" />
                  By Category
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="alerts">
                  <FaExclamationTriangle className="me-1" />
                  System Alerts ({systemData.system.alerts?.length || 0})
                </Nav.Link>
              </Nav.Item>
            </Nav>

            <Tab.Content>
              {/* Services Overview Tab */}
              <Tab.Pane eventKey="overview">
                <Card>
                  <Card.Header>All Services Status</Card.Header>
                  <Card.Body>
                    <Table striped hover responsive>
                      <thead>
                        <tr>
                          <th>Service</th>
                          <th>Status</th>
                          <th>Category</th>
                          <th>Response Time</th>
                          <th>Uptime</th>
                          <th>Error Rate</th>
                          <th>Last Check</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(systemData.services || {}).map(([serviceId, service]) => (
                          <tr key={serviceId}>
                            <td>
                              <div className="d-flex align-items-center">
                                {service.critical && <FaExclamationTriangle className="text-warning me-2" />}
                                <strong>{service.name}</strong>
                              </div>
                            </td>
                            <td>{getStatusBadge(service.status)}</td>
                            <td>
                              <div className="d-flex align-items-center">
                                {getCategoryIcon(service.category)}
                                <span className="ms-2">{service.category}</span>
                              </div>
                            </td>
                            <td>
                              <span className={service.health.responseTime > 2000 ? 'text-danger' : service.health.responseTime > 1000 ? 'text-warning' : 'text-success'}>
                                {service.health.responseTime ? `${service.health.responseTime}ms` : 'N/A'}
                              </span>
                            </td>
                            <td>
                              <ProgressBar 
                                variant={service.health.uptime >= 99 ? 'success' : service.health.uptime >= 95 ? 'warning' : 'danger'}
                                now={service.health.uptime}
                                label={`${service.health.uptime.toFixed(1)}%`}
                                style={{ minWidth: '100px' }}
                              />
                            </td>
                            <td>
                              <span className={service.metrics.errorRate > 5 ? 'text-danger' : service.metrics.errorRate > 1 ? 'text-warning' : 'text-success'}>
                                {service.metrics.errorRate.toFixed(1)}%
                              </span>
                            </td>
                            <td>
                              <small>{service.health.lastCheck ? formatTimestamp(service.health.lastCheck) : 'Never'}</small>
                            </td>
                            <td>
                              <div className="d-flex gap-1">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => checkSpecificService(serviceId)}
                                >
                                  <FaRefresh />
                                </Button>
                                <Button
                                  variant="outline-info"
                                  size="sm"
                                  onClick={() => viewServiceDetails(serviceId)}
                                >
                                  <FaEye />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              </Tab.Pane>

              {/* Categories Tab */}
              <Tab.Pane eventKey="categories">
                <Row>
                  {systemData.categories && Object.entries(systemData.categories).map(([category, services]) => (
                    <Col md={6} lg={4} key={category} className="mb-4">
                      <Card>
                        <Card.Header className="d-flex align-items-center">
                          {getCategoryIcon(category)}
                          <span className="ms-2">{category.toUpperCase()} Services</span>
                        </Card.Header>
                        <Card.Body>
                          {services.map(service => (
                            <div key={service.id} className="d-flex justify-content-between align-items-center mb-2">
                              <div>
                                <strong>{service.name}</strong>
                                {service.critical && <Badge variant="warning" className="ms-2">Critical</Badge>}
                              </div>
                              {getStatusBadge(service.status)}
                            </div>
                          ))}
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Tab.Pane>

              {/* Alerts Tab */}
              <Tab.Pane eventKey="alerts">
                <Card>
                  <Card.Header>System Alerts</Card.Header>
                  <Card.Body>
                    {!systemData.system.alerts || systemData.system.alerts.length === 0 ? (
                      <div className="text-center text-success py-4">
                        <FaCheckCircle size={48} className="mb-3" />
                        <h5>No Active System Alerts</h5>
                        <p>All systems are operating normally.</p>
                      </div>
                    ) : (
                      <Table striped hover>
                        <thead>
                          <tr>
                            <th>Severity</th>
                            <th>Type</th>
                            <th>Service</th>
                            <th>Message</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {systemData.system.alerts.map((alert) => (
                            <tr key={alert.id}>
                              <td>
                                <Badge variant={alert.severity === 'critical' ? 'danger' : 'warning'}>
                                  {alert.severity.toUpperCase()}
                                </Badge>
                              </td>
                              <td>{alert.type.replace('_', ' ').toUpperCase()}</td>
                              <td>{alert.service}</td>
                              <td>{alert.message}</td>
                              <td>
                                <small>{formatTimestamp(alert.timestamp)}</small>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </Card.Body>
                </Card>
              </Tab.Pane>
            </Tab.Content>
          </Tab.Container>
        </>
      )}

      {/* Service Details Modal */}
      <Modal show={showServiceModal} onHide={() => setShowServiceModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedService?.name} - Service Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedService && (
            <>
              <Row className="mb-3">
                <Col md={6}>
                  <h6>General Information</h6>
                  <Table size="sm">
                    <tbody>
                      <tr>
                        <td>Status</td>
                        <td>{getStatusBadge(selectedService.status)}</td>
                      </tr>
                      <tr>
                        <td>Category</td>
                        <td>{selectedService.category}</td>
                      </tr>
                      <tr>
                        <td>Critical Service</td>
                        <td>{selectedService.critical ? '✅ Yes' : '❌ No'}</td>
                      </tr>
                      <tr>
                        <td>URL</td>
                        <td><small>{selectedService.url || 'N/A'}</small></td>
                      </tr>
                    </tbody>
                  </Table>
                </Col>
                <Col md={6}>
                  <h6>Health Metrics</h6>
                  <Table size="sm">
                    <tbody>
                      <tr>
                        <td>Response Time</td>
                        <td>{selectedService.health.responseTime ? `${selectedService.health.responseTime}ms` : 'N/A'}</td>
                      </tr>
                      <tr>
                        <td>Uptime</td>
                        <td>{selectedService.health.uptime.toFixed(2)}%</td>
                      </tr>
                      <tr>
                        <td>Last Check</td>
                        <td><small>{selectedService.health.lastCheck ? formatTimestamp(selectedService.health.lastCheck) : 'Never'}</small></td>
                      </tr>
                      <tr>
                        <td>Error</td>
                        <td><small className="text-danger">{selectedService.health.error || 'None'}</small></td>
                      </tr>
                    </tbody>
                  </Table>
                </Col>
              </Row>

              {selectedService.health.checks && Object.keys(selectedService.health.checks).length > 0 && (
                <Row>
                  <Col>
                    <h6>Health Checks</h6>
                    <Table size="sm">
                      <tbody>
                        {Object.entries(selectedService.health.checks).map(([check, status]) => (
                          <tr key={check}>
                            <td>{check}</td>
                            <td>{status ? '✅' : '❌'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Col>
                </Row>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowServiceModal(false)}>
            Close
          </Button>
          {selectedService && (
            <Button variant="primary" onClick={() => checkSpecificService(selectedService.id)}>
              <FaRefresh className="me-2" />
              Check Now
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default SystemHealthDashboard;