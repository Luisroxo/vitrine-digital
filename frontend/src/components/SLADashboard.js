/**
 * @fileoverview SLA Dashboard Component - Real-time SLA monitoring interface
 * @version 1.0.0
 * @description Dashboard completo para monitoramento SLA em tempo real,
 * alertas ativos, métricas de uptime e configuração de thresholds
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Container, Row, Col, Card, Table, Badge, Alert, 
  Form, Button, ProgressBar, Nav, Tab, Modal 
} from 'react-bootstrap';
import { 
  FaHeartbeat, FaClock, FaExclamationTriangle, 
  FaCheckCircle, FaTachometerAlt, FaBell, 
  FaCog, FaRefresh, FaPlay, FaPause, FaChartLine
} from 'react-icons/fa';

const SLADashboard = () => {
  const [slaData, setSlaData] = useState(null);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchSLAData();
    
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchSLAData, 15000); // 15 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  const fetchSLAData = async () => {
    try {
      const response = await fetch('/api/shared/sla/dashboard');
      if (!response.ok) throw new Error('Failed to fetch SLA data');
      
      const data = await response.json();
      setSlaData(data);
      setActiveAlerts(data.alerts?.active || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('SLA Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const testAlert = async (level = 'warning') => {
    try {
      const response = await fetch('/api/shared/sla/test-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level })
      });
      
      if (!response.ok) throw new Error('Test alert failed');
      
      // Refresh data after test alert
      setTimeout(fetchSLAData, 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  const resolveAlert = async (alertId) => {
    try {
      const response = await fetch(`/api/shared/sla/alerts/${alertId}/resolve`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to resolve alert');
      
      // Refresh data
      fetchSLAData();
    } catch (err) {
      setError(err.message);
    }
  };

  const getSLAStatus = (percentage) => {
    if (percentage >= 99.9) return { status: 'excellent', variant: 'success' };
    if (percentage >= 99.5) return { status: 'good', variant: 'info' };
    if (percentage >= 99.0) return { status: 'warning', variant: 'warning' };
    return { status: 'critical', variant: 'danger' };
  };

  const getUptimeColor = (percentage) => {
    if (percentage >= 99.9) return 'success';
    if (percentage >= 99.5) return 'info';
    if (percentage >= 99.0) return 'warning';
    return 'danger';
  };

  const getAlertBadge = (level) => {
    const variants = {
      warning: 'warning',
      critical: 'danger',
      severe: 'danger'
    };
    
    const icons = {
      warning: <FaExclamationTriangle />,
      critical: <FaExclamationTriangle />,
      severe: <FaExclamationTriangle />
    };

    return (
      <Badge variant={variants[level]} className="d-flex align-items-center gap-1">
        {icons[level]} {level.toUpperCase()}
      </Badge>
    );
  };

  const formatDuration = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading && !slaData) {
    return (
      <Container className="text-center mt-5">
        <div className="spinner-border" role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <p className="mt-3">Loading SLA data...</p>
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
              SLA Dashboard
              {slaData && (
                <small className="text-muted ms-3">
                  {slaData.service || 'All Services'}
                </small>
              )}
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
                onClick={fetchSLAData}
                disabled={loading}
              >
                <FaRefresh /> Refresh
              </Button>

              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setShowConfigModal(true)}
              >
                <FaCog /> Config
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

      {slaData && (
        <>
          {/* SLA Overview Cards */}
          <Row className="mb-4">
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">
                    <FaHeartbeat className="me-2" />
                    Uptime SLA
                  </h5>
                  <ProgressBar 
                    variant={getUptimeColor(slaData.sla.uptime)} 
                    now={slaData.sla.uptime} 
                    label={`${slaData.sla.uptime.toFixed(3)}%`}
                    className="mb-2"
                  />
                  <Badge variant={getSLAStatus(slaData.sla.uptime).variant}>
                    {getSLAStatus(slaData.sla.uptime).status.toUpperCase()}
                  </Badge>
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
                  <h2 className={`text-${slaData.sla.avgResponseTime > 1000 ? 'danger' : slaData.sla.avgResponseTime > 500 ? 'warning' : 'success'}`}>
                    {Math.round(slaData.sla.avgResponseTime)}ms
                  </h2>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">
                    <FaExclamationTriangle className="me-2" />
                    Error Rate
                  </h5>
                  <h2 className={`text-${slaData.sla.errorRate > 5 ? 'danger' : slaData.sla.errorRate > 1 ? 'warning' : 'success'}`}>
                    {slaData.sla.errorRate.toFixed(2)}%
                  </h2>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">
                    <FaBell className="me-2" />
                    Active Alerts
                  </h5>
                  <h2 className={activeAlerts.length > 0 ? 'text-warning' : 'text-success'}>
                    {activeAlerts.length}
                  </h2>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Status Indicator */}
          <Row className="mb-4">
            <Col>
              <Card>
                <Card.Body className="text-center">
                  <h4>
                    Service Status: 
                    {slaData.status === 'up' ? (
                      <Badge variant="success" className="ms-2">
                        <FaCheckCircle className="me-1" />
                        OPERATIONAL
                      </Badge>
                    ) : (
                      <Badge variant="danger" className="ms-2">
                        <FaExclamationTriangle className="me-1" />
                        DOWN
                      </Badge>
                    )}
                  </h4>
                  {slaData.uptime.totalDowntime > 0 && (
                    <p className="text-muted">
                      Total downtime: {formatDuration(slaData.uptime.totalDowntime)}
                    </p>
                  )}
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
                <Nav.Link eventKey="alerts">
                  <FaBell className="me-1" />
                  Active Alerts ({activeAlerts.length})
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="history">
                  <FaClock className="me-1" />
                  Alert History
                </Nav.Link>
              </Nav.Item>
            </Nav>

            <Tab.Content>
              {/* Overview Tab */}
              <Tab.Pane eventKey="overview">
                <Row>
                  <Col md={6}>
                    <Card className="mb-4">
                      <Card.Header>Request Statistics</Card.Header>
                      <Card.Body>
                        <Table size="sm">
                          <tbody>
                            <tr>
                              <td>Total Requests</td>
                              <td><strong>{slaData.requests.total.toLocaleString()}</strong></td>
                            </tr>
                            <tr>
                              <td>Successful</td>
                              <td><strong className="text-success">{slaData.requests.successful.toLocaleString()}</strong></td>
                            </tr>
                            <tr>
                              <td>Failed</td>
                              <td><strong className="text-danger">{slaData.requests.failed.toLocaleString()}</strong></td>
                            </tr>
                            <tr>
                              <td>Success Rate</td>
                              <td><strong>{(100 - slaData.sla.errorRate).toFixed(2)}%</strong></td>
                            </tr>
                          </tbody>
                        </Table>
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={6}>
                    <Card className="mb-4">
                      <Card.Header>SLA Thresholds</Card.Header>
                      <Card.Body>
                        <Table size="sm">
                          <tbody>
                            <tr>
                              <td>Target Uptime</td>
                              <td><strong>{slaData.thresholds.uptime.target}%</strong></td>
                            </tr>
                            <tr>
                              <td>Response Time (Critical)</td>
                              <td><strong>{slaData.thresholds.responseTime.critical}ms</strong></td>
                            </tr>
                            <tr>
                              <td>Error Rate (Warning)</td>
                              <td><strong>{slaData.thresholds.errorRate.warning}%</strong></td>
                            </tr>
                            <tr>
                              <td>Error Rate (Critical)</td>
                              <td><strong>{slaData.thresholds.errorRate.critical}%</strong></td>
                            </tr>
                          </tbody>
                        </Table>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                <Row>
                  <Col>
                    <Card>
                      <Card.Header>Test Controls</Card.Header>
                      <Card.Body>
                        <div className="d-flex gap-2">
                          <Button 
                            variant="outline-warning" 
                            size="sm"
                            onClick={() => testAlert('warning')}
                          >
                            Test Warning Alert
                          </Button>
                          <Button 
                            variant="outline-danger" 
                            size="sm"
                            onClick={() => testAlert('critical')}
                          >
                            Test Critical Alert
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Tab.Pane>

              {/* Active Alerts Tab */}
              <Tab.Pane eventKey="alerts">
                <Card>
                  <Card.Header>Active Alerts</Card.Header>
                  <Card.Body>
                    {activeAlerts.length === 0 ? (
                      <div className="text-center text-success py-4">
                        <FaCheckCircle size={48} className="mb-3" />
                        <h5>No Active Alerts</h5>
                        <p>All systems are operating normally.</p>
                      </div>
                    ) : (
                      <Table striped hover>
                        <thead>
                          <tr>
                            <th>Level</th>
                            <th>Type</th>
                            <th>Time</th>
                            <th>Details</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeAlerts.map((alert) => (
                            <tr key={alert.id}>
                              <td>{getAlertBadge(alert.level)}</td>
                              <td>{alert.type.replace('_', ' ').toUpperCase()}</td>
                              <td>
                                <small>{formatTimestamp(alert.timestamp)}</small>
                              </td>
                              <td>
                                <small>
                                  {Object.entries(alert.data || {}).map(([key, value]) => (
                                    <div key={key}>
                                      <strong>{key}:</strong> {typeof value === 'number' ? value.toFixed(2) : value}
                                    </div>
                                  ))}
                                </small>
                              </td>
                              <td>
                                <Button
                                  variant="outline-success"
                                  size="sm"
                                  onClick={() => resolveAlert(alert.id)}
                                >
                                  Resolve
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </Card.Body>
                </Card>
              </Tab.Pane>

              {/* Alert History Tab */}
              <Tab.Pane eventKey="history">
                <Card>
                  <Card.Header>Recent Alert History</Card.Header>
                  <Card.Body>
                    {slaData.alerts?.recent?.length === 0 ? (
                      <p className="text-center text-muted py-4">No recent alerts</p>
                    ) : (
                      <Table striped size="sm">
                        <thead>
                          <tr>
                            <th>Level</th>
                            <th>Type</th>
                            <th>Time</th>
                            <th>Status</th>
                            <th>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(slaData.alerts?.recent || []).slice(0, 20).map((alert) => (
                            <tr key={alert.id}>
                              <td>{getAlertBadge(alert.level)}</td>
                              <td>{alert.type.replace('_', ' ').toUpperCase()}</td>
                              <td>
                                <small>{formatTimestamp(alert.timestamp)}</small>
                              </td>
                              <td>
                                <Badge variant={alert.status === 'resolved' ? 'success' : 'warning'}>
                                  {alert.status.toUpperCase()}
                                </Badge>
                              </td>
                              <td>
                                <small>
                                  {alert.data && Object.keys(alert.data).length > 0 
                                    ? `${Object.keys(alert.data)[0]}: ${Object.values(alert.data)[0]}`
                                    : 'No details'
                                  }
                                </small>
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

      {/* Configuration Modal */}
      <Modal show={showConfigModal} onHide={() => setShowConfigModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>SLA Configuration</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>SLA threshold configuration would be implemented here.</p>
          <p>This would allow adjusting:</p>
          <ul>
            <li>Response time thresholds</li>
            <li>Error rate thresholds</li>
            <li>Uptime targets</li>
            <li>Alert settings</li>
            <li>Notification channels</li>
          </ul>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfigModal(false)}>
            Close
          </Button>
          <Button variant="primary">
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default SLADashboard;