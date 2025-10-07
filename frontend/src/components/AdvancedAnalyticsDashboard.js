/**
 * @fileoverview Advanced Analytics Dashboard
 * @version 1.0.0
 * @description Dashboard avançado de analytics com business intelligence,
 * métricas consolidadas, trends e relatórios customizados
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Container, Row, Col, Card, Table, Badge, Alert, 
  ProgressBar, Nav, Tab, Modal, Button, Form,
  InputGroup, ButtonGroup, Dropdown 
} from 'react-bootstrap';
import { 
  FaChartLine, FaChartBar, FaChartPie, FaTachometerAlt,
  FaDollarSign, FaShoppingCart, FaUsers, FaEye,
  FaArrowUp, FaArrowDown, FaRefresh, FaDownload,
  FaCog, FaPlus, FaFilter, FaCalendar, FaFileAlt
} from 'react-icons/fa';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const AdvancedAnalyticsDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [businessMetrics, setBusinessMetrics] = useState(null);
  const [performanceMetrics, setPerformanceMetrics] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [topMetrics, setTopMetrics] = useState(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState(null);
  const [reports, setReports] = useState([]);
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('7d');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('revenue');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const intervalRef = useRef(null);

  // Color scheme for charts
  const chartColors = {
    primary: '#007bff',
    success: '#28a745',
    warning: '#ffc107',
    danger: '#dc3545',
    info: '#17a2b8',
    secondary: '#6c757d'
  };

  const pieColors = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6c757d'];

  useEffect(() => {
    fetchAllData();
    
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchAllData, 60000); // 1 minute
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timeRange, autoRefresh]);

  const fetchAllData = async () => {
    try {
      await Promise.all([
        fetchDashboardData(),
        fetchBusinessMetrics(),
        fetchPerformanceMetrics(),
        fetchTrendsData(),
        fetchTopMetrics(),
        fetchRealTimeMetrics()
      ]);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Analytics Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    const response = await fetch(`/api/shared/analytics/dashboard?timeRange=${timeRange}`);
    if (!response.ok) throw new Error('Failed to fetch dashboard data');
    const data = await response.json();
    setDashboardData(data.data);
  };

  const fetchBusinessMetrics = async () => {
    const response = await fetch(`/api/shared/analytics/business-metrics?timeRange=${timeRange}`);
    if (!response.ok) throw new Error('Failed to fetch business metrics');
    const data = await response.json();
    setBusinessMetrics(data.data);
  };

  const fetchPerformanceMetrics = async () => {
    const response = await fetch(`/api/shared/analytics/performance-metrics?timeRange=${timeRange}`);
    if (!response.ok) throw new Error('Failed to fetch performance metrics');
    const data = await response.json();
    setPerformanceMetrics(data.data);
  };

  const fetchTrendsData = async () => {
    const response = await fetch(`/api/shared/analytics/trends?timeRange=${timeRange}&metric=${selectedMetric}`);
    if (!response.ok) throw new Error('Failed to fetch trends data');
    const data = await response.json();
    setTrendsData(data.data);
  };

  const fetchTopMetrics = async () => {
    const response = await fetch(`/api/shared/analytics/top-metrics?timeRange=${timeRange}`);
    if (!response.ok) throw new Error('Failed to fetch top metrics');
    const data = await response.json();
    setTopMetrics(data.data);
  };

  const fetchRealTimeMetrics = async () => {
    const response = await fetch('/api/shared/analytics/realtime-metrics');
    if (!response.ok) throw new Error('Failed to fetch real-time metrics');
    const data = await response.json();
    setRealTimeMetrics(data.data);
  };

  const fetchReports = async () => {
    const response = await fetch('/api/shared/analytics/reports');
    if (!response.ok) throw new Error('Failed to fetch reports');
    const data = await response.json();
    setReports(data.data);
  };

  const fetchDashboards = async () => {
    const response = await fetch('/api/shared/analytics/dashboards');
    if (!response.ok) throw new Error('Failed to fetch dashboards');
    const data = await response.json();
    setDashboards(data.data);
  };

  const triggerMetricsCollection = async (type) => {
    try {
      const response = await fetch('/api/shared/analytics/collect-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      
      if (!response.ok) throw new Error(`Failed to trigger ${type} metrics collection`);
      
      // Refresh data after collection
      setTimeout(fetchAllData, 3000);
    } catch (error) {
      setError(error.message);
    }
  };

  const exportData = async (dataType, format) => {
    try {
      const response = await fetch(
        `/api/shared/analytics/export?dataType=${dataType}&format=${format}&timeRange=${timeRange}`
      );
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${dataType}-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setShowExportModal(false);
    } catch (error) {
      setError(error.message);
    }
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

  const formatPercentage = (percent) => {
    return `${(percent || 0).toFixed(2)}%`;
  };

  const getChangeIndicator = (current, previous) => {
    if (!previous || previous === 0) return null;
    
    const change = ((current - previous) / previous) * 100;
    const isPositive = change > 0;
    
    return (
      <span className={isPositive ? 'text-success' : 'text-danger'}>
        {isPositive ? <FaArrowUp /> : <FaArrowDown />}
        {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  if (loading && !dashboardData) {
    return (
      <Container className="text-center mt-5">
        <div className="spinner-border" role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <p className="mt-3">Loading Advanced Analytics Dashboard...</p>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="h3">
              <FaChartLine className="me-2" />
              Advanced Analytics Dashboard
              <small className="text-muted ms-3">
                Business Intelligence & Metrics
              </small>
            </h1>
            
            <div className="d-flex gap-2 align-items-center">
              <Form.Select 
                size="sm" 
                value={timeRange} 
                onChange={(e) => setTimeRange(e.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="1d">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="1y">Last Year</option>
              </Form.Select>
              
              <Form.Check 
                type="switch"
                id="auto-refresh"
                label="Auto"
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
                  <FaRefresh /> Refresh
                </Button>
                
                <Button 
                  variant="outline-success" 
                  size="sm"
                  onClick={() => setShowExportModal(true)}
                >
                  <FaDownload /> Export
                </Button>
                
                <Dropdown as={ButtonGroup}>
                  <Button 
                    variant="outline-info" 
                    size="sm"
                    onClick={() => triggerMetricsCollection('realtime')}
                  >
                    Collect Metrics
                  </Button>
                  <Dropdown.Toggle split variant="outline-info" size="sm" />
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={() => triggerMetricsCollection('realtime')}>
                      Real-time Metrics
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => triggerMetricsCollection('business')}>
                      Business Metrics
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
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

      {dashboardData && (
        <>
          {/* Key Metrics Overview */}
          <Row className="mb-4">
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">
                    <FaDollarSign className="me-2 text-success" />
                    Total Revenue
                  </h5>
                  <h2 className="text-success">
                    {formatCurrency(dashboardData.summary?.totalRevenue)}
                  </h2>
                  <small className="text-muted">
                    {getChangeIndicator(
                      dashboardData.summary?.totalRevenue,
                      dashboardData.summary?.previousRevenue
                    )}
                  </small>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">
                    <FaShoppingCart className="me-2 text-primary" />
                    Total Orders
                  </h5>
                  <h2 className="text-primary">
                    {formatNumber(dashboardData.summary?.totalOrders)}
                  </h2>
                  <small className="text-muted">
                    Avg: {formatCurrency(dashboardData.summary?.avgOrderValue)}
                  </small>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">
                    <FaUsers className="me-2 text-info" />
                    Total Customers
                  </h5>
                  <h2 className="text-info">
                    {formatNumber(dashboardData.summary?.totalCustomers)}
                  </h2>
                  <small className="text-muted">
                    Active: {formatNumber(dashboardData.summary?.activeCustomers)}
                  </small>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <h5 className="card-title">
                    <FaEye className="me-2 text-warning" />
                    Conversion Rate
                  </h5>
                  <h2 className="text-warning">
                    {formatPercentage(dashboardData.summary?.conversionRate)}
                  </h2>
                  <small className="text-muted">
                    {getChangeIndicator(
                      dashboardData.summary?.conversionRate,
                      dashboardData.summary?.previousConversionRate
                    )}
                  </small>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Main Charts Row */}
          <Row className="mb-4">
            <Col lg={8}>
              <Card>
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <span>Revenue Trends</span>
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
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={trendsData?.trends || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value) => [formatCurrency(value), selectedMetric]} />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={chartColors.primary}
                        fill={chartColors.primary}
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
            
            <Col lg={4}>
              <Card>
                <Card.Header>Top Products</Card.Header>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={topMetrics?.products || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {(topMetrics?.products || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
          </Row>

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
                <Nav.Link eventKey="business">
                  <FaDollarSign className="me-1" />
                  Business Metrics
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="performance">
                  <FaChartBar className="me-1" />
                  Performance
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="realtime">
                  <FaEye className="me-1" />
                  Real-time
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="reports" onClick={() => activeTab === 'reports' && fetchReports()}>
                  <FaFileAlt className="me-1" />
                  Reports
                </Nav.Link>
              </Nav.Item>
            </Nav>

            <Tab.Content>
              {/* Overview Tab */}
              <Tab.Pane eventKey="overview">
                <Row>
                  <Col md={6}>
                    <Card>
                      <Card.Header>Performance Overview</Card.Header>
                      <Card.Body>
                        {performanceMetrics && (
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={performanceMetrics.metrics?.serviceMetrics || []}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="service" />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="avgResponseTime" fill={chartColors.primary} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={6}>
                    <Card>
                      <Card.Header>Recent Activity</Card.Header>
                      <Card.Body>
                        <Table size="sm">
                          <thead>
                            <tr>
                              <th>Metric</th>
                              <th>Value</th>
                              <th>Change</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>Page Views</td>
                              <td>{formatNumber(dashboardData.summary?.pageViews)}</td>
                              <td className="text-success">+12%</td>
                            </tr>
                            <tr>
                              <td>Unique Visitors</td>
                              <td>{formatNumber(dashboardData.summary?.uniqueVisitors)}</td>
                              <td className="text-success">+8%</td>
                            </tr>
                            <tr>
                              <td>Bounce Rate</td>
                              <td>35%</td>
                              <td className="text-success">-3%</td>
                            </tr>
                            <tr>
                              <td>Avg Session</td>
                              <td>4:32</td>
                              <td className="text-success">+15%</td>
                            </tr>
                          </tbody>
                        </Table>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Tab.Pane>

              {/* Business Metrics Tab */}
              <Tab.Pane eventKey="business">
                <Row>
                  <Col>
                    <Card>
                      <Card.Header>Business Metrics Details</Card.Header>
                      <Card.Body>
                        {businessMetrics && (
                          <Row>
                            <Col md={4}>
                              <h5 className="text-success">Revenue Metrics</h5>
                              <Table size="sm">
                                <tbody>
                                  <tr>
                                    <td>Total Revenue:</td>
                                    <td><strong>{formatCurrency(businessMetrics.metrics?.revenue?.total)}</strong></td>
                                  </tr>
                                  <tr>
                                    <td>Recurring Revenue:</td>
                                    <td>{formatCurrency(businessMetrics.metrics?.revenue?.recurring)}</td>
                                  </tr>
                                  <tr>
                                    <td>One-time Revenue:</td>
                                    <td>{formatCurrency(businessMetrics.metrics?.revenue?.oneTime)}</td>
                                  </tr>
                                </tbody>
                              </Table>
                            </Col>
                            
                            <Col md={4}>
                              <h5 className="text-primary">Order Metrics</h5>
                              <Table size="sm">
                                <tbody>
                                  <tr>
                                    <td>Total Orders:</td>
                                    <td><strong>{formatNumber(businessMetrics.metrics?.orders?.total)}</strong></td>
                                  </tr>
                                  <tr>
                                    <td>Completed:</td>
                                    <td>{formatNumber(businessMetrics.metrics?.orders?.completed)}</td>
                                  </tr>
                                  <tr>
                                    <td>Cancelled:</td>
                                    <td>{formatNumber(businessMetrics.metrics?.orders?.cancelled)}</td>
                                  </tr>
                                </tbody>
                              </Table>
                            </Col>
                            
                            <Col md={4}>
                              <h5 className="text-info">Customer Metrics</h5>
                              <Table size="sm">
                                <tbody>
                                  <tr>
                                    <td>Total Customers:</td>
                                    <td><strong>{formatNumber(businessMetrics.metrics?.customers?.total)}</strong></td>
                                  </tr>
                                  <tr>
                                    <td>New Customers:</td>
                                    <td>{formatNumber(businessMetrics.metrics?.customers?.new)}</td>
                                  </tr>
                                  <tr>
                                    <td>Active Customers:</td>
                                    <td>{formatNumber(businessMetrics.metrics?.customers?.active)}</td>
                                  </tr>
                                </tbody>
                              </Table>
                            </Col>
                          </Row>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Tab.Pane>

              {/* Performance Tab */}
              <Tab.Pane eventKey="performance">
                <Row>
                  <Col>
                    <Card>
                      <Card.Header>System Performance Metrics</Card.Header>
                      <Card.Body>
                        {performanceMetrics && (
                          <Table striped hover>
                            <thead>
                              <tr>
                                <th>Service</th>
                                <th>Avg Response Time</th>
                                <th>Total Requests</th>
                                <th>Error Rate</th>
                                <th>Uptime</th>
                              </tr>
                            </thead>
                            <tbody>
                              {performanceMetrics.metrics?.serviceMetrics?.map((service, index) => (
                                <tr key={index}>
                                  <td>{service.service}</td>
                                  <td>
                                    <Badge variant={service.avgResponseTime < 200 ? 'success' : service.avgResponseTime < 500 ? 'warning' : 'danger'}>
                                      {service.avgResponseTime}ms
                                    </Badge>
                                  </td>
                                  <td>{formatNumber(service.totalRequests)}</td>
                                  <td>
                                    <Badge variant={service.errorRate < 1 ? 'success' : service.errorRate < 5 ? 'warning' : 'danger'}>
                                      {formatPercentage(service.errorRate)}
                                    </Badge>
                                  </td>
                                  <td>
                                    <ProgressBar 
                                      now={service.uptime} 
                                      variant={service.uptime > 99 ? 'success' : service.uptime > 95 ? 'warning' : 'danger'}
                                      label={`${service.uptime.toFixed(2)}%`}
                                    />
                                  </td>
                                </tr>
                              )) || []}
                            </tbody>
                          </Table>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Tab.Pane>

              {/* Real-time Tab */}
              <Tab.Pane eventKey="realtime">
                <Row>
                  <Col>
                    <Card>
                      <Card.Header>Real-time Metrics</Card.Header>
                      <Card.Body>
                        {realTimeMetrics && (
                          <Table striped hover>
                            <thead>
                              <tr>
                                <th>Service</th>
                                <th>Metric</th>
                                <th>Value</th>
                                <th>Type</th>
                                <th>Timestamp</th>
                              </tr>
                            </thead>
                            <tbody>
                              {realTimeMetrics.slice(0, 20).map((metric, index) => (
                                <tr key={index}>
                                  <td>{metric.service_name}</td>
                                  <td>{metric.metric_name}</td>
                                  <td>{metric.metric_value}</td>
                                  <td>
                                    <Badge variant="secondary">{metric.metric_type}</Badge>
                                  </td>
                                  <td>
                                    <small>{new Date(metric.timestamp).toLocaleString()}</small>
                                  </td>
                                </tr>
                              )) || []}
                            </tbody>
                          </Table>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Tab.Pane>

              {/* Reports Tab */}
              <Tab.Pane eventKey="reports">
                <Row>
                  <Col>
                    <Card>
                      <Card.Header className="d-flex justify-content-between align-items-center">
                        <span>Custom Reports</span>
                        <Button variant="primary" size="sm" onClick={() => setShowReportModal(true)}>
                          <FaPlus className="me-1" />
                          Create Report
                        </Button>
                      </Card.Header>
                      <Card.Body>
                        <Table striped hover>
                          <thead>
                            <tr>
                              <th>Report Name</th>
                              <th>Type</th>
                              <th>Format</th>
                              <th>Created</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reports.map(report => (
                              <tr key={report.id}>
                                <td>{report.report_name}</td>
                                <td>
                                  <Badge variant="info">{report.report_type}</Badge>
                                </td>
                                <td>{report.output_format}</td>
                                <td>
                                  <small>{new Date(report.created_at).toLocaleDateString()}</small>
                                </td>
                                <td>
                                  <ButtonGroup size="sm">
                                    <Button variant="outline-primary">
                                      <FaEye />
                                    </Button>
                                    <Button variant="outline-success">
                                      <FaDownload />
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
            </Tab.Content>
          </Tab.Container>
        </>
      )}

      {/* Export Modal */}
      <Modal show={showExportModal} onHide={() => setShowExportModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Export Analytics Data</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Data Type</Form.Label>
              <Form.Select>
                <option value="business">Business Metrics</option>
                <option value="performance">Performance Metrics</option>
                <option value="realtime">Real-time Metrics</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Format</Form.Label>
              <Form.Select>
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowExportModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => exportData('business', 'json')}>
            Export Data
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default AdvancedAnalyticsDashboard;