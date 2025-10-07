/**
 * @fileoverview Enhanced Bling Price Sync Dashboard
 * @version 2.0.0
 * @description Dashboard avançado para monitoramento e gerenciamento da sincronização de preços
 * com analytics, pricing rules e controles em tempo real
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Container, Row, Col, Card, Table, Badge, Alert, 
  ProgressBar, Nav, Tab, Modal, Button, Form,
  InputGroup, ButtonGroup 
} from 'react-bootstrap';
import { 
  FaSync, FaClock, FaChartLine, FaDollarSign, 
  FaPlay, FaStop, FaEye, FaCog, FaHistory,
  FaRules, FaPlus, FaEdit, FaTrash, FaDownload,
  FaTachometerAlt, FaExclamationTriangle, FaCheckCircle
} from 'react-icons/fa';

const EnhancedBlingPriceSyncDashboard = () => {
  const [syncStatus, setSyncStatus] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [history, setHistory] = useState([]);
  const [rules, setRules] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchAllData();
    
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchAllData, 30000); // 30 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  const fetchAllData = async () => {
    try {
      await Promise.all([
        fetchSyncStatus(),
        fetchJobs(),
        fetchAnalytics(),
        fetchMetrics()
      ]);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Enhanced Price Sync Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncStatus = async () => {
    const response = await fetch('/api/bling/price-sync/status');
    if (!response.ok) throw new Error('Failed to fetch sync status');
    const data = await response.json();
    setSyncStatus(data.data);
  };

  const fetchJobs = async () => {
    const response = await fetch('/api/bling/price-sync/jobs?limit=20');
    if (!response.ok) throw new Error('Failed to fetch jobs');
    const data = await response.json();
    setJobs(data.data);
  };

  const fetchAnalytics = async () => {
    const response = await fetch('/api/bling/price-sync/analytics?period=7d');
    if (!response.ok) throw new Error('Failed to fetch analytics');
    const data = await response.json();
    setAnalytics(data.data);
  };

  const fetchMetrics = async () => {
    const response = await fetch('/api/bling/price-sync/metrics');
    if (!response.ok) throw new Error('Failed to fetch metrics');
    const data = await response.json();
    setMetrics(data.data);
  };

  const fetchHistory = async () => {
    const response = await fetch('/api/bling/price-sync/history?limit=100');
    if (!response.ok) throw new Error('Failed to fetch history');
    const data = await response.json();
    setHistory(data.data);
  };

  const fetchRules = async () => {
    const response = await fetch('/api/bling/price-sync/rules');
    if (!response.ok) throw new Error('Failed to fetch rules');
    const data = await response.json();
    setRules(data.data);
  };

  const triggerSync = async (syncType) => {
    try {
      const response = await fetch(`/api/bling/price-sync/trigger/${syncType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error(`Failed to trigger ${syncType} sync`);
      
      // Refresh data after triggering
      setTimeout(fetchAllData, 2000);
    } catch (error) {
      setError(error.message);
    }
  };

  const viewJobDetails = (job) => {
    setSelectedJob(job);
    setShowJobModal(true);
  };

  const getStatusBadge = (status) => {
    const variants = {
      running: 'primary',
      completed: 'success',
      failed: 'danger',
      pending: 'warning'
    };
    
    const icons = {
      running: <FaSync className="fa-spin" />,
      completed: <FaCheckCircle />,
      failed: <FaExclamationTriangle />,
      pending: <FaClock />
    };

    return (
      <Badge variant={variants[status]} className="d-flex align-items-center gap-1">
        {icons[status]} {status.toUpperCase()}
      </Badge>
    );
  };

  const getSyncStatusColor = (isRunning) => {
    return isRunning ? 'success' : 'secondary';
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(amount);
  };

  const formatPercentage = (percent) => {
    return `${percent.toFixed(2)}%`;
  };

  if (loading && !syncStatus) {
    return (
      <Container className="text-center mt-5">
        <div className="spinner-border" role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <p className="mt-3">Loading Enhanced Price Sync Dashboard...</p>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="h3">
              <FaDollarSign className="me-2" />
              Enhanced Bling Price Sync Dashboard
              <small className="text-muted ms-3">
                Advanced Price Management
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
              
              <ButtonGroup>
                <Button 
                  variant="outline-primary" 
                  size="sm"
                  onClick={fetchAllData}
                  disabled={loading}
                >
                  <FaSync /> Refresh
                </Button>
                
                <Button 
                  variant="outline-success" 
                  size="sm"
                  onClick={() => triggerSync('realtime')}
                  disabled={syncStatus?.realTimeSyncRunning}
                >
                  <FaPlay /> Real-time Sync
                </Button>
                
                <Button 
                  variant="outline-info" 
                  size="sm"
                  onClick={() => triggerSync('bulk')}
                  disabled={syncStatus?.bulkSyncRunning}
                >
                  <FaPlay /> Bulk Sync
                </Button>
              </ButtonGroup>
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

      {syncStatus && (
        <>
          {/* Status Overview Cards */}
          <Row className="mb-4">
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">
                    <FaTachometerAlt className="me-2" />
                    Service Status
                  </h5>
                  <h3 className={`text-${syncStatus.isInitialized ? 'success' : 'danger'}`}>
                    {syncStatus.isInitialized ? '✅ Active' : '❌ Inactive'}
                  </h3>
                  <small className="text-muted">
                    Last Update: {formatTimestamp(syncStatus.lastRealTimeSync)}
                  </small>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">
                    <FaSync className="me-2" />
                    Sync Status
                  </h5>
                  <div className="d-flex justify-content-center gap-2">
                    <Badge variant={getSyncStatusColor(syncStatus.realTimeSyncRunning)}>
                      RT: {syncStatus.realTimeSyncRunning ? 'Running' : 'Idle'}
                    </Badge>
                    <Badge variant={getSyncStatusColor(syncStatus.bulkSyncRunning)}>
                      Bulk: {syncStatus.bulkSyncRunning ? 'Running' : 'Idle'}
                    </Badge>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">
                    <FaChartLine className="me-2" />
                    Total Updates
                  </h5>
                  <h2 className="text-info">
                    {syncStatus.metrics?.totalPriceUpdates?.toLocaleString() || 0}
                  </h2>
                  <small className="text-muted">
                    Errors: {syncStatus.metrics?.totalErrors || 0}
                  </small>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">
                    <FaClock className="me-2" />
                    Avg Sync Time
                  </h5>
                  <h2 className="text-success">
                    {syncStatus.metrics?.averageSyncTime || 0}ms
                  </h2>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Analytics Summary */}
          {analytics && (
            <Row className="mb-4">
              <Col>
                <Card>
                  <Card.Header>Price Analytics - Last 7 Days</Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={2}>
                        <div className="text-center">
                          <h6>Products</h6>
                          <h4 className="text-info">{analytics.aggregated.totalProducts.toLocaleString()}</h4>
                        </div>
                      </Col>
                      <Col md={2}>
                        <div className="text-center">
                          <h6>Price Changes</h6>
                          <h4 className="text-warning">{analytics.aggregated.totalPriceChanges.toLocaleString()}</h4>
                        </div>
                      </Col>
                      <Col md={2}>
                        <div className="text-center">
                          <h6>Avg Change</h6>
                          <h4 className="text-primary">{formatPercentage(analytics.aggregated.averagePriceChangePercent)}</h4>
                        </div>
                      </Col>
                      <Col md={3}>
                        <div className="text-center">
                          <h6>Price Increases</h6>
                          <h4 className="text-success">{formatCurrency(analytics.aggregated.totalPriceIncreases)}</h4>
                        </div>
                      </Col>
                      <Col md={3}>
                        <div className="text-center">
                          <h6>Price Decreases</h6>
                          <h4 className="text-danger">{formatCurrency(analytics.aggregated.totalPriceDecreases)}</h4>
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
                  <FaTachometerAlt className="me-1" />
                  Overview
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="jobs">
                  <FaSync className="me-1" />
                  Sync Jobs ({jobs.length})
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="history" onClick={() => activeTab === 'history' && fetchHistory()}>
                  <FaHistory className="me-1" />
                  Price History
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="rules" onClick={() => activeTab === 'rules' && fetchRules()}>
                  <FaRules className="me-1" />
                  Pricing Rules
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="config">
                  <FaCog className="me-1" />
                  Configuration
                </Nav.Link>
              </Nav.Item>
            </Nav>

            <Tab.Content>
              {/* Overview Tab */}
              <Tab.Pane eventKey="overview">
                <Row>
                  <Col md={6}>
                    <Card>
                      <Card.Header>Recent Sync Jobs</Card.Header>
                      <Card.Body>
                        <Table size="sm">
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Status</th>
                              <th>Products</th>
                              <th>Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {jobs.slice(0, 5).map(job => (
                              <tr key={job.id}>
                                <td>{job.job_type}</td>
                                <td>{getStatusBadge(job.job_status)}</td>
                                <td>{job.updated_products || 0}/{job.total_products || 0}</td>
                                <td><small>{formatTimestamp(job.start_time)}</small></td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={6}>
                    <Card>
                      <Card.Header>Performance Metrics</Card.Header>
                      <Card.Body>
                        {metrics && (
                          <div>
                            <div className="d-flex justify-content-between mb-2">
                              <span>Total Syncs:</span>
                              <strong>{metrics.performance.totalSyncs}</strong>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                              <span>Total Updates:</span>
                              <strong>{metrics.performance.totalPriceUpdates}</strong>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                              <span>Average Sync Time:</span>
                              <strong>{metrics.performance.averageSyncTime}ms</strong>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                              <span>Peak Processing Rate:</span>
                              <strong>{metrics.performance.peakProcessingRate}/min</strong>
                            </div>
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Tab.Pane>

              {/* Jobs Tab */}
              <Tab.Pane eventKey="jobs">
                <Card>
                  <Card.Header>Sync Jobs History</Card.Header>
                  <Card.Body>
                    <Table striped hover responsive>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Total Products</th>
                          <th>Updated</th>
                          <th>Failed</th>
                          <th>Start Time</th>
                          <th>Duration</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.map(job => (
                          <tr key={job.id}>
                            <td>{job.id}</td>
                            <td>
                              <Badge variant="info">{job.job_type}</Badge>
                            </td>
                            <td>{getStatusBadge(job.job_status)}</td>
                            <td>{job.total_products || 0}</td>
                            <td className="text-success">{job.updated_products || 0}</td>
                            <td className="text-danger">{job.failed_products || 0}</td>
                            <td><small>{formatTimestamp(job.start_time)}</small></td>
                            <td>
                              <small>
                                {job.end_time 
                                  ? `${Math.round((new Date(job.end_time) - new Date(job.start_time)) / 1000)}s`
                                  : 'Running...'}
                              </small>
                            </td>
                            <td>
                              <Button
                                variant="outline-info"
                                size="sm"
                                onClick={() => viewJobDetails(job)}
                              >
                                <FaEye />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              </Tab.Pane>

              {/* History Tab */}
              <Tab.Pane eventKey="history">
                <Card>
                  <Card.Header>Price Change History</Card.Header>
                  <Card.Body>
                    <Table striped hover responsive>
                      <thead>
                        <tr>
                          <th>Product ID</th>
                          <th>Old Price</th>
                          <th>New Price</th>
                          <th>Change</th>
                          <th>Sync Type</th>
                          <th>Reason</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map(record => (
                          <tr key={record.id}>
                            <td><small>{record.product_id}</small></td>
                            <td>{formatCurrency(record.old_price)}</td>
                            <td>{formatCurrency(record.new_price)}</td>
                            <td>
                              <span className={record.price_change_percent > 0 ? 'text-success' : 'text-danger'}>
                                {formatPercentage(record.price_change_percent)}
                              </span>
                            </td>
                            <td>
                              <Badge variant="secondary">{record.sync_type}</Badge>
                            </td>
                            <td><small>{record.change_reason}</small></td>
                            <td><small>{formatTimestamp(record.created_at)}</small></td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              </Tab.Pane>

              {/* Rules Tab */}
              <Tab.Pane eventKey="rules">
                <Card>
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <span>Pricing Rules</span>
                    <Button variant="primary" size="sm" onClick={() => setShowRuleModal(true)}>
                      <FaPlus className="me-1" />
                      Add Rule
                    </Button>
                  </Card.Header>
                  <Card.Body>
                    <Table striped hover>
                      <thead>
                        <tr>
                          <th>Rule Name</th>
                          <th>Type</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rules.map(rule => (
                          <tr key={rule.id}>
                            <td>{rule.rule_name}</td>
                            <td>
                              <Badge variant="info">{rule.rule_type}</Badge>
                            </td>
                            <td>{rule.priority}</td>
                            <td>
                              <Badge variant={rule.is_active ? 'success' : 'secondary'}>
                                {rule.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                            <td>
                              <ButtonGroup size="sm">
                                <Button variant="outline-primary" onClick={() => {
                                  setEditingRule(rule);
                                  setShowRuleModal(true);
                                }}>
                                  <FaEdit />
                                </Button>
                                <Button variant="outline-danger">
                                  <FaTrash />
                                </Button>
                              </ButtonGroup>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              </Tab.Pane>

              {/* Configuration Tab */}
              <Tab.Pane eventKey="config">
                <Card>
                  <Card.Header>Price Sync Configuration</Card.Header>
                  <Card.Body>
                    {syncStatus && (
                      <Row>
                        <Col md={6}>
                          <h5>Sync Intervals</h5>
                          <Form.Group className="mb-3">
                            <Form.Label>Real-time Sync Interval</Form.Label>
                            <InputGroup>
                              <Form.Control 
                                type="number" 
                                value={syncStatus.config.realTimeSyncInterval / 1000} 
                                readOnly
                              />
                              <InputGroup.Text>seconds</InputGroup.Text>
                            </InputGroup>
                          </Form.Group>
                          
                          <Form.Group className="mb-3">
                            <Form.Label>Bulk Sync Interval</Form.Label>
                            <InputGroup>
                              <Form.Control 
                                type="number" 
                                value={syncStatus.config.bulkSyncInterval / 60000} 
                                readOnly
                              />
                              <InputGroup.Text>minutes</InputGroup.Text>
                            </InputGroup>
                          </Form.Group>
                        </Col>
                        
                        <Col md={6}>
                          <h5>Business Rules</h5>
                          <Form.Group className="mb-3">
                            <Form.Label>Price Tolerance</Form.Label>
                            <InputGroup>
                              <Form.Control 
                                type="number" 
                                step="0.01"
                                value={syncStatus.config.priceTolerancePercent} 
                                readOnly
                              />
                              <InputGroup.Text>%</InputGroup.Text>
                            </InputGroup>
                          </Form.Group>
                          
                          <Form.Group className="mb-3">
                            <Form.Label>Max Price Increase</Form.Label>
                            <InputGroup>
                              <Form.Control 
                                type="number" 
                                value={syncStatus.config.maxPriceIncreasePercent} 
                                readOnly
                              />
                              <InputGroup.Text>%</InputGroup.Text>
                            </InputGroup>
                          </Form.Group>
                        </Col>
                      </Row>
                    )}
                  </Card.Body>
                </Card>
              </Tab.Pane>
            </Tab.Content>
          </Tab.Container>
        </>
      )}

      {/* Job Details Modal */}
      <Modal show={showJobModal} onHide={() => setShowJobModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Sync Job Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedJob && (
            <div>
              <Row className="mb-3">
                <Col md={6}>
                  <strong>Job ID:</strong> {selectedJob.id}<br/>
                  <strong>Type:</strong> {selectedJob.job_type}<br/>
                  <strong>Status:</strong> {getStatusBadge(selectedJob.job_status)}<br/>
                  <strong>Total Products:</strong> {selectedJob.total_products || 0}
                </Col>
                <Col md={6}>
                  <strong>Processed:</strong> {selectedJob.processed_products || 0}<br/>
                  <strong>Updated:</strong> {selectedJob.updated_products || 0}<br/>
                  <strong>Failed:</strong> {selectedJob.failed_products || 0}<br/>
                  <strong>Start Time:</strong> {formatTimestamp(selectedJob.start_time)}
                </Col>
              </Row>
              
              {selectedJob.error_details && (
                <Alert variant="danger">
                  <strong>Error Details:</strong><br/>
                  {JSON.stringify(selectedJob.error_details, null, 2)}
                </Alert>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowJobModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default EnhancedBlingPriceSyncDashboard;