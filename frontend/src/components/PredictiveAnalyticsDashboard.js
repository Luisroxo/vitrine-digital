/**
 * @fileoverview Predictive Analytics Dashboard Component
 * @version 1.0.0
 * @description Componente React para visualização de análises preditivas,
 * ML models, forecasting, anomaly detection e insights de IA
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Container, Row, Col, Card, Table, Badge, Alert, 
  Button, Form, Modal, Tab, Nav, ButtonGroup,
  ProgressBar, Spinner, Toast, ToastContainer
} from 'react-bootstrap';
import { 
  FaBrain, FaChartLine, FaExclamationTriangle, FaTrendingUp,
  FaDollarSign, FaUsers, FaCog, FaRobot, FaLightbulb,
  FaPlay, FaStop, FaRefresh, FaDownload, FaEye,
  FaChartArea, FaChartBar, FaBullseye, FaShieldAlt
} from 'react-icons/fa';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ReferenceLine
} from 'recharts';

const PredictiveAnalyticsDashboard = () => {
  const [forecasts, setForecasts] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [trends, setTrends] = useState(null);
  const [revenueForecast, setRevenueForecast] = useState(null);
  const [churnPrediction, setChurnPrediction] = useState(null);
  const [pricingOptimization, setPricingOptimization] = useState(null);
  const [mlModels, setMlModels] = useState([]);
  const [aiAlerts, setAiAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMetric, setSelectedMetric] = useState('revenue');
  const [showModelModal, setShowModelModal] = useState(false);
  const [showAnomalyModal, setShowAnomalyModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Chart colors
  const colors = {
    primary: '#007bff',
    success: '#28a745',
    warning: '#ffc107',
    danger: '#dc3545',
    info: '#17a2b8',
    optimistic: '#28a745',
    realistic: '#007bff',
    pessimistic: '#dc3545'
  };

  useEffect(() => {
    fetchAllPredictiveData();
  }, []);

  const fetchAllPredictiveData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchMlModels(),
        fetchRevenueForecast(),
        fetchAnomalies(),
        fetchChurnPrediction(),
        fetchPricingOptimization(),
        fetchAiAlerts()
      ]);
      setError(null);
    } catch (err) {
      setError(err.message);
      showToast('Error loading predictive analytics data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMlModels = async () => {
    const response = await fetch('/api/shared/analytics/predictive/models');
    if (!response.ok) throw new Error('Failed to fetch ML models');
    const data = await response.json();
    setMlModels(data.data.models);
  };

  const fetchRevenueForecast = async () => {
    const response = await fetch('/api/shared/analytics/predictive/revenue-forecast');
    if (!response.ok) throw new Error('Failed to fetch revenue forecast');
    const data = await response.json();
    setRevenueForecast(data.data);
  };

  const fetchAnomalies = async () => {
    const response = await fetch('/api/shared/analytics/predictive/anomalies?limit=20');
    if (!response.ok) throw new Error('Failed to fetch anomalies');
    const data = await response.json();
    setAnomalies(data.data.anomalies);
  };

  const fetchChurnPrediction = async () => {
    const response = await fetch('/api/shared/analytics/predictive/churn-prediction');
    if (!response.ok) throw new Error('Failed to fetch churn prediction');
    const data = await response.json();
    setChurnPrediction(data.data);
  };

  const fetchPricingOptimization = async () => {
    const response = await fetch('/api/shared/analytics/predictive/pricing-optimization');
    if (!response.ok) throw new Error('Failed to fetch pricing optimization');
    const data = await response.json();
    setPricingOptimization(data.data);
  };

  const fetchAiAlerts = async () => {
    // Placeholder - would implement AI alerts API
    setAiAlerts([
      {
        id: 1,
        type: 'anomaly',
        severity: 'warning',
        title: 'Revenue Anomaly Detected',
        description: 'Revenue dropped 25% below expected value',
        triggeredAt: new Date().toISOString()
      }
    ]);
  };

  const generateForecast = async (metricName, horizon = 30) => {
    try {
      setProcessingAction(`Generating forecast for ${metricName}`);
      
      const response = await fetch('/api/shared/analytics/predictive/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricName,
          horizon,
          modelType: 'seasonal_decomposition'
        })
      });
      
      if (!response.ok) throw new Error('Failed to generate forecast');
      
      const data = await response.json();
      setForecasts(prev => ({ ...prev, [metricName]: data.data }));
      showToast(`Forecast generated for ${metricName}`, 'success');
      
    } catch (error) {
      showToast(`Failed to generate forecast: ${error.message}`, 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const detectAnomalies = async (metricName) => {
    try {
      setProcessingAction(`Detecting anomalies in ${metricName}`);
      
      const response = await fetch('/api/shared/analytics/predictive/anomalies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricName,
          recentHours: 24,
          baselineDays: 30
        })
      });
      
      if (!response.ok) throw new Error('Failed to detect anomalies');
      
      const data = await response.json();
      setAnomalies(prev => [...prev, ...data.data.anomalies]);
      showToast(`${data.data.detectedCount} anomalies detected`, 'info');
      
    } catch (error) {
      showToast(`Failed to detect anomalies: ${error.message}`, 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const analyzeTrends = async (metricName) => {
    try {
      setProcessingAction(`Analyzing trends for ${metricName}`);
      
      const response = await fetch('/api/shared/analytics/predictive/trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricName,
          analysisDays: 60,
          timeWindow: 30
        })
      });
      
      if (!response.ok) throw new Error('Failed to analyze trends');
      
      const data = await response.json();
      setTrends(prev => ({ ...prev, [metricName]: data.data }));
      showToast(`Trends analyzed for ${metricName}`, 'success');
      
    } catch (error) {
      showToast(`Failed to analyze trends: ${error.message}`, 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const showToast = (message, type = 'info') => {
    const toast = {
      id: Date.now(),
      message,
      type,
      show: true
    };
    setToasts(prev => [...prev, toast]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, 5000);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(amount || 0);
  };

  const formatNumber = (number) => {
    return new Intl.NumberFormat('pt-BR').format(number || 0);
  };

  const getSeverityVariant = (severity) => {
    const variants = {
      low: 'success',
      medium: 'warning',
      high: 'danger',
      critical: 'danger'
    };
    return variants[severity] || 'secondary';
  };

  const getTrendIcon = (direction) => {
    switch (direction) {
      case 'upward': return <FaTrendingUp className="text-success" />;
      case 'downward': return <FaTrendingUp className="text-danger" style={{ transform: 'rotate(180deg)' }} />;
      default: return <FaTrendingUp className="text-secondary" style={{ transform: 'rotate(90deg)' }} />;
    }
  };

  if (loading && !revenueForecast) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Loading Predictive Analytics...</p>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="h3">
              <FaBrain className="me-2 text-primary" />
              Predictive Analytics & AI Insights
              <small className="text-muted ms-3">
                Machine Learning & Forecasting
              </small>
            </h1>
            
            <div className="d-flex gap-2">
              <ButtonGroup>
                <Button 
                  variant="outline-primary" 
                  size="sm"
                  onClick={() => generateForecast(selectedMetric)}
                  disabled={!!processingAction}
                >
                  <FaPlay /> Generate Forecast
                </Button>
                
                <Button 
                  variant="outline-warning" 
                  size="sm"
                  onClick={() => detectAnomalies(selectedMetric)}
                  disabled={!!processingAction}
                >
                  <FaShieldAlt /> Detect Anomalies
                </Button>
                
                <Button 
                  variant="outline-success" 
                  size="sm"
                  onClick={() => analyzeTrends(selectedMetric)}
                  disabled={!!processingAction}
                >
                  <FaTrendingUp /> Analyze Trends
                </Button>
              </ButtonGroup>
              
              <Button 
                variant="outline-info" 
                size="sm"
                onClick={fetchAllPredictiveData}
                disabled={loading}
              >
                <FaRefresh /> Refresh
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {processingAction && (
        <Alert variant="info" className="mb-4">
          <Spinner animation="border" size="sm" className="me-2" />
          {processingAction}...
        </Alert>
      )}

      {error && (
        <Alert variant="danger" className="mb-4" dismissible onClose={() => setError(null)}>
          <FaExclamationTriangle className="me-2" />
          {error}
        </Alert>
      )}

      {/* AI Alerts */}
      {aiAlerts.length > 0 && (
        <Row className="mb-4">
          <Col>
            <Alert variant="warning" className="d-flex align-items-center">
              <FaRobot className="me-2" />
              <div className="flex-grow-1">
                <strong>AI Alert:</strong> {aiAlerts[0].title}
                <br />
                <small>{aiAlerts[0].description}</small>
              </div>
              <Button variant="outline-warning" size="sm">
                View Details
              </Button>
            </Alert>
          </Col>
        </Row>
      )}

      {/* Key Insights Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center border-primary">
            <Card.Body>
              <h5 className="card-title">
                <FaBrain className="me-2 text-primary" />
                ML Models
              </h5>
              <h2 className="text-primary">
                {mlModels.length}
              </h2>
              <small className="text-muted">
                Active models trained
              </small>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="text-center border-warning">
            <Card.Body>
              <h5 className="card-title">
                <FaExclamationTriangle className="me-2 text-warning" />
                Anomalies
              </h5>
              <h2 className="text-warning">
                {anomalies.filter(a => a.severity === 'high' || a.severity === 'critical').length}
              </h2>
              <small className="text-muted">
                High priority detected
              </small>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="text-center border-success">
            <Card.Body>
              <h5 className="card-title">
                <FaDollarSign className="me-2 text-success" />
                Revenue Forecast
              </h5>
              <h2 className="text-success">
                {revenueForecast?.modelAccuracy ? 
                  `${(revenueForecast.modelAccuracy * 100).toFixed(1)}%` : 
                  'N/A'
                }
              </h2>
              <small className="text-muted">
                Model accuracy
              </small>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="text-center border-info">
            <Card.Body>
              <h5 className="card-title">
                <FaUsers className="me-2 text-info" />
                Churn Risk
              </h5>
              <h2 className="text-info">
                {churnPrediction?.highRiskCustomers || 0}
              </h2>
              <small className="text-muted">
                High-risk customers
              </small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Navigation Tabs */}
      <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
        <Nav variant="tabs" className="mb-4">
          <Nav.Item>
            <Nav.Link eventKey="overview">
              <FaLightbulb className="me-1" />
              AI Overview
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="forecasting">
              <FaChartLine className="me-1" />
              Forecasting
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="anomalies">
              <FaShieldAlt className="me-1" />
              Anomaly Detection
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="models">
              <FaBrain className="me-1" />
              ML Models
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="optimization">
              <FaBullseye className="me-1" />
              Optimization
            </Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          {/* AI Overview Tab */}
          <Tab.Pane eventKey="overview">
            <Row>
              <Col lg={8}>
                <Card>
                  <Card.Header>Revenue Forecast - Multi-Scenario Analysis</Card.Header>
                  <Card.Body>
                    {revenueForecast?.scenarios && (
                      <ResponsiveContainer width="100%" height={350}>
                        <AreaChart data={revenueForecast.scenarios.realistic}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip formatter={(value) => [formatCurrency(value), 'Revenue']} />
                          <Legend />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={colors.optimistic}
                            fill={colors.optimistic}
                            fillOpacity={0.2}
                            name="Optimistic"
                          />
                          <Area 
                            type="monotone" 
                , "value" 
                            stroke={colors.realistic}
                            fill={colors.realistic}
                            fillOpacity={0.3}
                            name="Realistic"
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={colors.pessimistic}
                            fill={colors.pessimistic}
                            fillOpacity={0.2}
                            name="Pessimistic"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              
              <Col lg={4}>
                <Card>
                  <Card.Header>AI Insights & Recommendations</Card.Header>
                  <Card.Body>
                    <div className="mb-3">
                      <h6 className="text-success">
                        <FaLightbulb className="me-2" />
                        Key Insights
                      </h6>
                      <ul className="list-unstyled">
                        <li className="mb-2">
                          <Badge variant="success" className="me-2">Growth</Badge>
                          Revenue trending upward (+12%)
                        </li>
                        <li className="mb-2">
                          <Badge variant="warning" className="me-2">Alert</Badge>
                          Customer churn risk increased
                        </li>
                        <li className="mb-2">
                          <Badge variant="info" className="me-2">Optimize</Badge>
                          3 products need price adjustment
                        </li>
                      </ul>
                    </div>
                    
                    <div>
                      <h6 className="text-primary">
                        <FaRobot className="me-2" />
                        Recommended Actions
                      </h6>
                      <ul className="list-unstyled">
                        <li className="mb-2">• Launch retention campaign</li>
                        <li className="mb-2">• Adjust pricing on Product X</li>
                        <li className="mb-2">• Investigate revenue anomaly</li>
                      </ul>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Tab.Pane>

          {/* Forecasting Tab */}
          <Tab.Pane eventKey="forecasting">
            <Row>
              <Col>
                <Card>
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <span>Predictive Forecasting</span>
                    <Form.Select 
                      size="sm" 
                      value={selectedMetric} 
                      onChange={(e) => setSelectedMetric(e.target.value)}
                      style={{ width: 'auto' }}
                    >
                      <option value="revenue">Revenue</option>
                      <option value="orders">Orders</option>
                      <option value="customers">Customers</option>
                      <option value="conversion">Conversion Rate</option>
                    </Form.Select>
                  </Card.Header>
                  <Card.Body>
                    {forecasts?.[selectedMetric] ? (
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={forecasts[selectedMetric].predictions}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke={colors.primary}
                            strokeWidth={2}
                            name="Forecast"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-5">
                        <FaChartLine size={48} className="text-muted mb-3" />
                        <p className="text-muted">No forecast data available for {selectedMetric}</p>
                        <Button 
                          variant="primary" 
                          onClick={() => generateForecast(selectedMetric)}
                          disabled={!!processingAction}
                        >
                          Generate Forecast
                        </Button>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Tab.Pane>

          {/* Anomalies Tab */}
          <Tab.Pane eventKey="anomalies">
            <Row>
              <Col>
                <Card>
                  <Card.Header>Anomaly Detection Results</Card.Header>
                  <Card.Body>
                    <Table striped hover responsive>
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Timestamp</th>
                          <th>Actual Value</th>
                          <th>Expected Value</th>
                          <th>Severity</th>
                          <th>Type</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anomalies.map((anomaly, index) => (
                          <tr key={index}>
                            <td>{anomaly.metricName}</td>
                            <td>
                              <small>{new Date(anomaly.timestamp).toLocaleString()}</small>
                            </td>
                            <td>{formatNumber(anomaly.value)}</td>
                            <td>{formatNumber(anomaly.expectedValue)}</td>
                            <td>
                              <Badge variant={getSeverityVariant(anomaly.severity)}>
                                {anomaly.severity}
                              </Badge>
                            </td>
                            <td>
                              <Badge variant="secondary">
                                {anomaly.type}
                              </Badge>
                            </td>
                            <td>
                              <Button variant="outline-primary" size="sm">
                                <FaEye />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Tab.Pane>

          {/* ML Models Tab */}
          <Tab.Pane eventKey="models">
            <Row>
              <Col>
                <Card>
                  <Card.Header>Machine Learning Models</Card.Header>
                  <Card.Body>
                    <Table striped hover>
                      <thead>
                        <tr>
                          <th>Model Name</th>
                          <th>Metric</th>
                          <th>Type</th>
                          <th>Accuracy</th>
                          <th>Trained At</th>
                          <th>Data Points</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mlModels.map((model, index) => (
                          <tr key={index}>
                            <td>{model.metricName}</td>
                            <td>{model.metricName}</td>
                            <td>
                              <Badge variant="info">
                                {model.modelType}
                              </Badge>
                            </td>
                            <td>
                              <div className="d-flex align-items-center">
                                <ProgressBar 
                                  now={model.accuracy * 100} 
                                  style={{ width: '100px', marginRight: '8px' }}
                                  variant={model.accuracy > 0.8 ? 'success' : model.accuracy > 0.6 ? 'warning' : 'danger'}
                                />
                                <small>{(model.accuracy * 100).toFixed(1)}%</small>
                              </div>
                            </td>
                            <td>
                              <small>{new Date(model.trainedAt).toLocaleDateString()}</small>
                            </td>
                            <td>{formatNumber(model.dataPoints)}</td>
                            <td>
                              <ButtonGroup size="sm">
                                <Button variant="outline-primary">
                                  <FaEye />
                                </Button>
                                <Button variant="outline-success">
                                  <FaPlay />
                                </Button>
                              </ButtonGroup>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Tab.Pane>

          {/* Optimization Tab */}
          <Tab.Pane eventKey="optimization">
            <Row>
              <Col md={6}>
                <Card>
                  <Card.Header>Customer Churn Prediction</Card.Header>
                  <Card.Body>
                    {churnPrediction && (
                      <>
                        <div className="mb-3">
                          <h5>Risk Distribution</h5>
                          <div className="mb-2">
                            <div className="d-flex justify-content-between">
                              <span>High Risk</span>
                              <Badge variant="danger">{churnPrediction.highRiskCustomers}</Badge>
                            </div>
                            <ProgressBar 
                              now={(churnPrediction.highRiskCustomers / churnPrediction.totalCustomers) * 100} 
                              variant="danger"
                              className="mb-2"
                            />
                          </div>
                          <div className="mb-2">
                            <div className="d-flex justify-content-between">
                              <span>Medium Risk</span>
                              <Badge variant="warning">{churnPrediction.mediumRiskCustomers}</Badge>
                            </div>
                            <ProgressBar 
                              now={(churnPrediction.mediumRiskCustomers / churnPrediction.totalCustomers) * 100} 
                              variant="warning"
                              className="mb-2"
                            />
                          </div>
                          <div className="mb-2">
                            <div className="d-flex justify-content-between">
                              <span>Low Risk</span>
                              <Badge variant="success">{churnPrediction.lowRiskCustomers}</Badge>
                            </div>
                            <ProgressBar 
                              now={(churnPrediction.lowRiskCustomers / churnPrediction.totalCustomers) * 100} 
                              variant="success"
                            />
                          </div>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-muted">
                            Average Churn Probability: <strong>
                              {(churnPrediction.averageChurnProbability * 100).toFixed(1)}%
                            </strong>
                          </p>
                        </div>
                      </>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              
              <Col md={6}>
                <Card>
                  <Card.Header>Pricing Optimization</Card.Header>
                  <Card.Body>
                    {pricingOptimization && (
                      <>
                        <div className="mb-3">
                          <h6>Optimization Summary</h6>
                          <p>
                            <strong>Total Products Analyzed:</strong> {pricingOptimization.totalProducts}
                          </p>
                          <p>
                            <strong>Potential Revenue Increase:</strong> {' '}
                            <span className="text-success">
                              {formatCurrency(pricingOptimization.aggregatedImpact?.totalRevenueIncrease || 0)}
                            </span>
                          </p>
                          <p>
                            <strong>Average Price Change:</strong> {' '}
                            <span className={pricingOptimization.aggregatedImpact?.averageOptimalPriceChange > 0 ? 'text-success' : 'text-danger'}>
                              {((pricingOptimization.aggregatedImpact?.averageOptimalPriceChange || 0) * 100).toFixed(1)}%
                            </span>
                          </p>
                        </div>
                        
                        <div className="text-center">
                          <Button variant="primary" size="sm">
                            View Detailed Recommendations
                          </Button>
                        </div>
                      </>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>

      {/* Toast Notifications */}
      <ToastContainer position="top-end" className="p-3">
        {toasts.map((toast) => (
          <Toast 
            key={toast.id}
            show={toast.show}
            onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            bg={toast.type === 'error' ? 'danger' : toast.type === 'success' ? 'success' : 'info'}
          >
            <Toast.Header>
              <strong className="me-auto">
                {toast.type === 'error' ? 'Error' : toast.type === 'success' ? 'Success' : 'Info'}
              </strong>
            </Toast.Header>
            <Toast.Body className="text-white">
              {toast.message}
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </Container>
  );
};

export default PredictiveAnalyticsDashboard;