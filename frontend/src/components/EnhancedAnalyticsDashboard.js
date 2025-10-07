/**
 * Enhanced Analytics Dashboard - React Component
 * 
 * Dashboard consolidado de analytics com métricas de negócio, performance,
 * alertas e insights em tempo real para toda a plataforma.
 * 
 * Funcionalidades:
 * - Overview consolidado com KPIs principais
 * - Métricas em tempo real com auto-refresh
 * - Relatórios de negócio com comparações
 * - Dashboard de performance por serviço
 * - Centro de alertas com resolução
 * - Export de dados em múltiplos formatos
 * - Insights automáticos e recomendações
 * 
 * @author Sistema Vitrine Digital
 * @version 2.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    CardBody,
    CardHeader,
    Row,
    Col,
    Nav,
    NavItem,
    NavLink,
    TabContent,
    TabPane,
    Table,
    Button,
    Badge,
    Alert,
    Progress,
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Form,
    FormGroup,
    Label,
    Input,
    Spinner,
    ButtonGroup,
    UncontrolledTooltip
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChartLine,
    faDollarSign,
    faUsers,
    faShoppingCart,
    faClock,
    faExclamationTriangle,
    faCheckCircle,
    faServer,
    faTachometerAlt,
    faDownload,
    faSync,
    faEye,
    faArrowUp,
    faArrowDown,
    faMinus,
    faLightbulb,
    faBell,
    faChartBar,
    faDesktop,
    faCog,
    faFilePdf,
    faFileExcel,
    faFileAlt
} from '@fortawesome/free-solid-svg-icons';

const EnhancedAnalyticsDashboard = () => {
    // Estados principais
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState('24h');
    
    // Dados do dashboard
    const [dashboardData, setDashboardData] = useState(null);
    const [realTimeMetrics, setRealTimeMetrics] = useState({});
    const [businessSummary, setBusinessSummary] = useState(null);
    const [performanceData, setPerformanceData] = useState(null);
    const [alertsData, setAlertsData] = useState(null);
    
    // Estados de controle
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshInterval, setRefreshInterval] = useState(30000); // 30 segundos
    const [exportModal, setExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState('json');
    
    // KPIs calculados
    const [kpis, setKpis] = useState({
        totalRevenue: 0,
        totalOrders: 0,
        newUsers: 0,
        conversionRate: 0,
        avgResponseTime: 0,
        errorRate: 0
    });
    
    /**
     * Carrega dados do dashboard
     */
    const loadDashboardData = useCallback(async () => {
        try {
            setLoading(true);
            
            const response = await fetch(`/api/analytics/v2/dashboard/overview?timeRange=${timeRange}`);
            const result = await response.json();
            
            if (result.success) {
                setDashboardData(result.data);
                setKpis(result.data.kpis || {});
                setError(null);
            } else {
                throw new Error(result.message || 'Falha ao carregar dados');
            }
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            setError('Erro ao carregar dados do dashboard');
        } finally {
            setLoading(false);
        }
    }, [timeRange]);
    
    /**
     * Carrega métricas em tempo real
     */
    const loadRealTimeMetrics = useCallback(async () => {
        try {
            const response = await fetch('/api/analytics/v2/metrics/real-time');
            const result = await response.json();
            
            if (result.success) {
                setRealTimeMetrics(result.data);
            }
            
        } catch (error) {
            console.error('Error loading real-time metrics:', error);
        }
    }, []);
    
    /**
     * Carrega resumo de negócio
     */
    const loadBusinessSummary = useCallback(async () => {
        try {
            const response = await fetch(`/api/analytics/v2/reports/business-summary?timeRange=${timeRange}`);
            const result = await response.json();
            
            if (result.success) {
                setBusinessSummary(result.data);
            }
            
        } catch (error) {
            console.error('Error loading business summary:', error);
        }
    }, [timeRange]);
    
    /**
     * Carrega dados de performance
     */
    const loadPerformanceData = useCallback(async () => {
        try {
            const response = await fetch(`/api/analytics/v2/performance/overview?timeRange=${timeRange}`);
            const result = await response.json();
            
            if (result.success) {
                setPerformanceData(result.data);
            }
            
        } catch (error) {
            console.error('Error loading performance data:', error);
        }
    }, [timeRange]);
    
    /**
     * Carrega dados de alertas
     */
    const loadAlertsData = useCallback(async () => {
        try {
            const response = await fetch('/api/analytics/v2/alerts/dashboard');
            const result = await response.json();
            
            if (result.success) {
                setAlertsData(result.data);
            }
            
        } catch (error) {
            console.error('Error loading alerts data:', error);
        }
    }, []);
    
    /**
     * Carrega todos os dados baseado na aba ativa
     */
    const loadTabData = useCallback(async () => {
        switch (activeTab) {
            case 'overview':
                await loadDashboardData();
                break;
            case 'business':
                await loadBusinessSummary();
                break;
            case 'performance':
                await loadPerformanceData();
                break;
            case 'alerts':
                await loadAlertsData();
                break;
            default:
                await loadDashboardData();
        }
    }, [activeTab, loadDashboardData, loadBusinessSummary, loadPerformanceData, loadAlertsData]);
    
    /**
     * Export de dados
     */
    const exportData = async () => {
        try {
            const response = await fetch('/api/analytics/v2/export/dashboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    format: exportFormat,
                    timeRange,
                    sections: ['overview', 'business', 'performance', 'alerts']
                })
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics-export-${Date.now()}.${exportFormat}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                setExportModal(false);
            }
            
        } catch (error) {
            console.error('Error exporting data:', error);
            setError('Erro ao exportar dados');
        }
    };
    
    // Effects
    useEffect(() => {
        loadTabData();
    }, [loadTabData]);
    
    useEffect(() => {
        if (autoRefresh && activeTab === 'overview') {
            loadRealTimeMetrics();
            const interval = setInterval(loadRealTimeMetrics, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, activeTab, loadRealTimeMetrics, refreshInterval]);
    
    // Renderização condicional para loading
    if (loading && !dashboardData) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
                <Spinner size="lg" color="primary" />
                <span className="ml-2">Carregando analytics...</span>
            </div>
        );
    }
    
    return (
        <div className="enhanced-analytics-dashboard">
            {/* Header */}
            <Row className="mb-4">
                <Col>
                    <Card>
                        <CardHeader className="d-flex justify-content-between align-items-center">
                            <div>
                                <h4 className="mb-0">
                                    <FontAwesomeIcon icon={faChartLine} className="mr-2" />
                                    Analytics Dashboard Enhanced
                                </h4>
                                <small className="text-muted">
                                    Métricas consolidadas de negócio, performance e insights em tempo real
                                </small>
                            </div>
                            <div className="d-flex align-items-center">
                                {/* Time Range Selector */}
                                <ButtonGroup className="mr-2">
                                    {['1h', '6h', '24h', '7d', '30d'].map(range => (
                                        <Button
                                            key={range}
                                            size="sm"
                                            color={timeRange === range ? 'primary' : 'secondary'}
                                            onClick={() => setTimeRange(range)}
                                        >
                                            {range}
                                        </Button>
                                    ))}
                                </ButtonGroup>
                                
                                {/* Auto-refresh Toggle */}
                                <Button
                                    size="sm"
                                    color={autoRefresh ? 'success' : 'secondary'}
                                    onClick={() => setAutoRefresh(!autoRefresh)}
                                    className="mr-2"
                                >
                                    <FontAwesomeIcon icon={faSync} className={autoRefresh ? 'fa-spin' : ''} />
                                    {autoRefresh ? 'Auto' : 'Manual'}
                                </Button>
                                
                                {/* Export Button */}
                                <Button
                                    size="sm"
                                    color="info"
                                    onClick={() => setExportModal(true)}
                                >
                                    <FontAwesomeIcon icon={faDownload} className="mr-1" />
                                    Export
                                </Button>
                            </div>
                        </CardHeader>
                    </Card>
                </Col>
            </Row>
            
            {/* Error Alert */}
            {error && (
                <Alert color="danger" toggle={() => setError(null)} className="mb-4">
                    {error}
                </Alert>
            )}
            
            {/* Navigation Tabs */}
            <Nav tabs className="mb-4">
                <NavItem>
                    <NavLink
                        className={activeTab === 'overview' ? 'active' : ''}
                        onClick={() => setActiveTab('overview')}
                        style={{ cursor: 'pointer' }}
                    >
                        <FontAwesomeIcon icon={faDesktop} className="mr-2" />
                        Overview
                    </NavLink>
                </NavItem>
                <NavItem>
                    <NavLink
                        className={activeTab === 'business' ? 'active' : ''}
                        onClick={() => setActiveTab('business')}
                        style={{ cursor: 'pointer' }}
                    >
                        <FontAwesomeIcon icon={faDollarSign} className="mr-2" />
                        Negócio
                    </NavLink>
                </NavItem>
                <NavItem>
                    <NavLink
                        className={activeTab === 'performance' ? 'active' : ''}
                        onClick={() => setActiveTab('performance')}
                        style={{ cursor: 'pointer' }}
                    >
                        <FontAwesomeIcon icon={faTachometerAlt} className="mr-2" />
                        Performance
                    </NavLink>
                </NavItem>
                <NavItem>
                    <NavLink
                        className={activeTab === 'alerts' ? 'active' : ''}
                        onClick={() => setActiveTab('alerts')}
                        style={{ cursor: 'pointer' }}
                    >
                        <FontAwesome icon={faBell} className="mr-2" />
                        Alertas
                        {alertsData?.statistics?.total > 0 && (
                            <Badge color="danger" className="ml-1">
                                {alertsData.statistics.total}
                            </Badge>
                        )}
                    </NavLink>
                </NavItem>
            </Nav>
            
            {/* Tab Content */}
            <TabContent activeTab={activeTab}>
                {/* Overview Tab */}
                <TabPane tabId="overview">
                    <Row>
                        {/* KPI Cards */}
                        <Col md="2" className="mb-4">
                            <Card className="text-center">
                                <CardBody>
                                    <FontAwesomeIcon icon={faDollarSign} size="2x" className="text-success mb-2" />
                                    <h4 className="text-success">
                                        R$ {(kpis.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </h4>
                                    <small className="text-muted">Receita Total</small>
                                </CardBody>
                            </Card>
                        </Col>
                        <Col md="2" className="mb-4">
                            <Card className="text-center">
                                <CardBody>
                                    <FontAwesomeIcon icon={faShoppingCart} size="2x" className="text-primary mb-2" />
                                    <h4 className="text-primary">{kpis.totalOrders || 0}</h4>
                                    <small className="text-muted">Pedidos</small>
                                </CardBody>
                            </Card>
                        </Col>
                        <Col md="2" className="mb-4">
                            <Card className="text-center">
                                <CardBody>
                                    <FontAwesomeIcon icon={faUsers} size="2x" className="text-info mb-2" />
                                    <h4 className="text-info">{kpis.newUsers || 0}</h4>
                                    <small className="text-muted">Novos Usuários</small>
                                </CardBody>
                            </Card>
                        </Col>
                        <Col md="2" className="mb-4">
                            <Card className="text-center">
                                <CardBody>
                                    <FontAwesomeIcon icon={faEye} size="2x" className="text-warning mb-2" />
                                    <h4 className="text-warning">{(kpis.conversionRate || 0).toFixed(1)}%</h4>
                                    <small className="text-muted">Taxa Conversão</small>
                                </CardBody>
                            </Card>
                        </Col>
                        <Col md="2" className="mb-4">
                            <Card className="text-center">
                                <CardBody>
                                    <FontAwesomeIcon icon={faClock} size="2x" className="text-secondary mb-2" />
                                    <h4 className="text-secondary">{(kpis.avgResponseTime || 0).toFixed(0)}ms</h4>
                                    <small className="text-muted">Tempo Resposta</small>
                                </CardBody>
                            </Card>
                        </Col>
                        <Col md="2" className="mb-4">
                            <Card className="text-center">
                                <CardBody>
                                    <FontAwesome icon={faExclamationTriangle} 
                                        size="2x" 
                                        className={`mb-2 ${(kpis.errorRate || 0) > 5 ? 'text-danger' : 'text-success'}`} 
                                    />
                                    <h4 className={`${(kpis.errorRate || 0) > 5 ? 'text-danger' : 'text-success'}`}>
                                        {(kpis.errorRate || 0).toFixed(1)}%
                                    </h4>
                                    <small className="text-muted">Taxa de Erro</small>
                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                    
                    {/* Real-time Metrics */}
                    <Row>
                        <Col md="8" className="mb-4">
                            <Card>
                                <CardHeader>
                                    <FontAwesome icon={faChartBar} className="mr-2" />
                                    Métricas em Tempo Real
                                    {autoRefresh && (
                                        <FontAwesome icon={faSync} className="fa-spin ml-2 text-success" />
                                    )}
                                </CardHeader>
                                <CardBody>
                                    {Object.keys(realTimeMetrics).length > 0 ? (
                                        <Table size="sm" responsive>
                                            <thead>
                                                <tr>
                                                    <th>Métrica</th>
                                                    <th>Atual</th>
                                                    <th>Média</th>
                                                    <th>Máximo</th>
                                                    <th>Contagem</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(realTimeMetrics).map(([key, metric]) => (
                                                    <tr key={key}>
                                                        <td><strong>{key.replace(/_/g, ' ')}</strong></td>
                                                        <td>{metric.current?.toFixed(2) || 0}</td>
                                                        <td>{metric.avg?.toFixed(2) || 0}</td>
                                                        <td>{metric.max?.toFixed(2) || 0}</td>
                                                        <td>{metric.count || 0}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    ) : (
                                        <div className="text-center py-4">
                                            <FontAwesome icon={faChartBar} size="3x" className="text-muted mb-3" />
                                            <h5 className="text-muted">Aguardando métricas em tempo real...</h5>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </Col>
                        
                        {/* Insights Automáticos */}
                        <Col md="4" className="mb-4">
                            <Card>
                                <CardHeader>
                                    <FontAwesome icon={faLightbulb} className="mr-2" />
                                    Insights Automáticos
                                </CardHeader>
                                <CardBody>
                                    {dashboardData?.insights && dashboardData.insights.length > 0 ? (
                                        <div>
                                            {dashboardData.insights.map((insight, index) => (
                                                <Alert 
                                                    key={index}
                                                    color={insight.severity === 'critical' ? 'danger' : 
                                                           insight.severity === 'warning' ? 'warning' : 'info'}
                                                    className="mb-2"
                                                >
                                                    <small>
                                                        <strong>{insight.message}</strong><br/>
                                                        <em>{insight.recommendation}</em>
                                                    </small>
                                                </Alert>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <FontAwesome icon={faCheckCircle} size="2x" className="text-success mb-2" />
                                            <p className="text-muted mb-0">Tudo funcionando perfeitamente!</p>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                </TabPane>
                
                {/* Business Tab */}
                <TabPane tabId="business">
                    <Row>
                        <Col>
                            <Card>
                                <CardHeader>
                                    <FontAwesome icon={faChartLine} className="mr-2" />
                                    Resumo de Negócio - {timeRange}
                                </CardHeader>
                                <CardBody>
                                    {businessSummary ? (
                                        <Row>
                                            {Object.entries(businessSummary.current).map(([key, value]) => {
                                                const growth = businessSummary.growth[key] || 0;
                                                const isPositive = growth > 0;
                                                
                                                return (
                                                    <Col md="3" key={key} className="mb-3">
                                                        <Card className="text-center">
                                                            <CardBody>
                                                                <h5 className="text-capitalize">{key.replace(/_/g, ' ')}</h5>
                                                                <h3>{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</h3>
                                                                <div className={`d-flex align-items-center justify-content-center ${isPositive ? 'text-success' : growth < 0 ? 'text-danger' : 'text-muted'}`}>
                                                                    <FontAwesome 
                                                                        icon={isPositive ? faArrowUp : growth < 0 ? faArrowDown : faMinus} 
                                                                        className="mr-1" 
                                                                    />
                                                                    {Math.abs(growth).toFixed(1)}%
                                                                </div>
                                                            </CardBody>
                                                        </Card>
                                                    </Col>
                                                );
                                            })}
                                        </Row>
                                    ) : (
                                        <div className="text-center py-4">
                                            <Spinner color="primary" />
                                            <p className="mt-2">Carregando relatório de negócio...</p>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                </TabPane>
                
                {/* Performance Tab */}
                <TabPane tabId="performance">
                    <Row>
                        <Col>
                            <Card>
                                <CardHeader>
                                    <FontAwesome icon={faServer} className="mr-2" />
                                    Performance dos Serviços
                                </CardHeader>
                                <CardBody>
                                    {performanceData ? (
                                        <div>
                                            {/* Health Scores */}
                                            <Row className="mb-4">
                                                {Object.entries(performanceData.healthScores || {}).map(([service, score]) => (
                                                    <Col md="3" key={service} className="mb-3">
                                                        <Card className="text-center">
                                                            <CardBody>
                                                                <h6 className="text-uppercase">{service}</h6>
                                                                <div className="mb-2">
                                                                    <FontAwesome 
                                                                        icon={faServer} 
                                                                        size="2x"
                                                                        className={
                                                                            score >= 90 ? 'text-success' :
                                                                            score >= 70 ? 'text-warning' : 'text-danger'
                                                                        }
                                                                    />
                                                                </div>
                                                                <h4 className={
                                                                    score >= 90 ? 'text-success' :
                                                                    score >= 70 ? 'text-warning' : 'text-danger'
                                                                }>
                                                                    {score.toFixed(0)}%
                                                                </h4>
                                                                <Progress 
                                                                    value={score} 
                                                                    color={
                                                                        score >= 90 ? 'success' :
                                                                        score >= 70 ? 'warning' : 'danger'
                                                                    }
                                                                    className="mt-2"
                                                                />
                                                            </CardBody>
                                                        </Card>
                                                    </Col>
                                                ))}
                                            </Row>
                                            
                                            {/* Performance Summary */}
                                            <Row>
                                                <Col md="4">
                                                    <Card className="text-center">
                                                        <CardBody>
                                                            <h5>Total de Serviços</h5>
                                                            <h3 className="text-primary">
                                                                {performanceData.summary?.totalServices || 0}
                                                            </h3>
                                                        </CardBody>
                                                    </Card>
                                                </Col>
                                                <Col md="4">
                                                    <Card className="text-center">
                                                        <CardBody>
                                                            <h5>Saúde Média</h5>
                                                            <h3 className="text-success">
                                                                {(performanceData.summary?.averageHealth || 0).toFixed(1)}%
                                                            </h3>
                                                        </CardBody>
                                                    </Card>
                                                </Col>
                                                <Col md="4">
                                                    <Card className="text-center">
                                                        <CardBody>
                                                            <h5>Serviços Críticos</h5>
                                                            <h3 className="text-danger">
                                                                {performanceData.summary?.criticalServices || 0}
                                                            </h3>
                                                        </CardBody>
                                                    </Card>
                                                </Col>
                                            </Row>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <Spinner color="primary" />
                                            <p className="mt-2">Carregando dados de performance...</p>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                </TabPane>
                
                {/* Alerts Tab */}
                <TabPane tabId="alerts">
                    <Row>
                        <Col>
                            <Card>
                                <CardHeader>
                                    <FontAwesome icon={faBell} className="mr-2" />
                                    Centro de Alertas
                                </CardHeader>
                                <CardBody>
                                    {alertsData ? (
                                        <div>
                                            {/* Alert Statistics */}
                                            <Row className="mb-4">
                                                <Col md="3">
                                                    <Card className="text-center border-danger">
                                                        <CardBody>
                                                            <FontAwesome icon={faExclamationTriangle} size="2x" className="text-danger mb-2" />
                                                            <h4 className="text-danger">
                                                                {alertsData.categorized?.critical?.length || 0}
                                                            </h4>
                                                            <small>Críticos</small>
                                                        </CardBody>
                                                    </Card>
                                                </Col>
                                                <Col md="3">
                                                    <Card className="text-center border-warning">
                                                        <CardBody>
                                                            <FontAwesome icon={faExclamationTriangle} size="2x" className="text-warning mb-2" />
                                                            <h4 className="text-warning">
                                                                {alertsData.categorized?.warning?.length || 0}
                                                            </h4>
                                                            <small>Avisos</small>
                                                        </CardBody>
                                                    </Card>
                                                </Col>
                                                <Col md="3">
                                                    <Card className="text-center border-info">
                                                        <CardBody>
                                                            <FontAwesome icon={faExclamationTriangle} size="2x" className="text-info mb-2" />
                                                            <h4 className="text-info">
                                                                {alertsData.categorized?.info?.length || 0}
                                                            </h4>
                                                            <small>Informativos</small>
                                                        </CardBody>
                                                    </Card>
                                                </Col>
                                                <Col md="3">
                                                    <Card className="text-center">
                                                        <CardBody>
                                                            <FontAwesome icon={faBell} size="2x" className="text-secondary mb-2" />
                                                            <h4 className="text-secondary">
                                                                {alertsData.statistics?.total || 0}
                                                            </h4>
                                                            <small>Total Ativo</small>
                                                        </CardBody>
                                                    </Card>
                                                </Col>
                                            </Row>
                                            
                                            {/* Active Alerts List */}
                                            {alertsData.active && alertsData.active.length > 0 ? (
                                                <Table responsive hover>
                                                    <thead>
                                                        <tr>
                                                            <th>Severidade</th>
                                                            <th>Tipo</th>
                                                            <th>Mensagem</th>
                                                            <th>Disparado em</th>
                                                            <th>Ações</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {alertsData.active.map(alert => (
                                                            <tr key={alert.id}>
                                                                <td>
                                                                    <Badge color={
                                                                        alert.severity === 'critical' ? 'danger' :
                                                                        alert.severity === 'warning' ? 'warning' : 'info'
                                                                    }>
                                                                        {alert.severity}
                                                                    </Badge>
                                                                </td>
                                                                <td>{alert.type}</td>
                                                                <td>{alert.message}</td>
                                                                <td>{new Date(alert.triggered_at).toLocaleString()}</td>
                                                                <td>
                                                                    <Button size="sm" color="success">
                                                                        Resolver
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </Table>
                                            ) : (
                                                <div className="text-center py-4">
                                                    <FontAwesome icon={faCheckCircle} size="3x" className="text-success mb-3" />
                                                    <h5 className="text-success">Nenhum alerta ativo!</h5>
                                                    <p className="text-muted">Todos os sistemas estão funcionando normalmente.</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <Spinner color="primary" />
                                            <p className="mt-2">Carregando alertas...</p>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                </TabPane>
            </TabContent>
            
            {/* Export Modal */}
            <Modal isOpen={exportModal} toggle={() => setExportModal(false)}>
                <ModalHeader toggle={() => setExportModal(false)}>
                    <FontAwesome icon={faDownload} className="mr-2" />
                    Exportar Dados Analytics
                </ModalHeader>
                <ModalBody>
                    <Form>
                        <FormGroup>
                            <Label>Formato de Export</Label>
                            <Input
                                type="select"
                                value={exportFormat}
                                onChange={(e) => setExportFormat(e.target.value)}
                            >
                                <option value="json">JSON</option>
                                <option value="csv">CSV</option>
                                <option value="excel">Excel</option>
                            </Input>
                        </FormGroup>
                        <FormGroup>
                            <Label>Período</Label>
                            <Input
                                type="select"
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value)}
                            >
                                <option value="1h">Última Hora</option>
                                <option value="6h">Últimas 6 Horas</option>
                                <option value="24h">Últimas 24 Horas</option>
                                <option value="7d">Últimos 7 Dias</option>
                                <option value="30d">Últimos 30 Dias</option>
                            </Input>
                        </FormGroup>
                    </Form>
                </ModalBody>
                <ModalFooter>
                    <Button color="secondary" onClick={() => setExportModal(false)}>
                        Cancelar
                    </Button>
                    <Button color="primary" onClick={exportData}>
                        <FontAwesome icon={faDownload} className="mr-2" />
                        Exportar
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    );
};

export default EnhancedAnalyticsDashboard;