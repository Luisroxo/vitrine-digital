/**
 * ConflictResolutionDashboard - Interface React para Gerenciamento de Conflitos
 * 
 * Dashboard completo para visualizar, gerenciar e resolver conflitos de dados
 * Inclui ferramentas manuais e automáticas de resolução
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Card, 
    Row, 
    Col, 
    Nav, 
    Tab, 
    Table, 
    Button, 
    Badge, 
    Modal, 
    Form, 
    Alert,
    InputGroup,
    Dropdown,
    ProgressBar,
    OverlayTrigger,
    Tooltip
} from 'react-bootstrap';

const ConflictResolutionDashboard = () => {
    // Estados do dashboard
    const [activeTab, setActiveTab] = useState('overview');
    const [conflicts, setConflicts] = useState([]);
    const [metrics, setMetrics] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Estados de filtros
    const [filters, setFilters] = useState({
        status: '',
        type: '',
        severity: '',
        page: 1,
        limit: 20
    });
    
    // Estados de modais
    const [showResolveModal, setShowResolveModal] = useState(false);
    const [showIgnoreModal, setShowIgnoreModal] = useState(false);
    const [showDetectionModal, setShowDetectionModal] = useState(false);
    const [selectedConflict, setSelectedConflict] = useState(null);
    
    // Estados de resolução
    const [resolutionStrategy, setResolutionStrategy] = useState('timestamp_priority');
    const [chosenSource, setChosenSource] = useState('local');
    const [resolutionReason, setResolutionReason] = useState('');
    const [ignoreReason, setIgnoreReason] = useState('');
    
    // Estados de bulk operations
    const [selectedConflicts, setSelectedConflicts] = useState([]);
    const [bulkStrategy, setBulkStrategy] = useState('timestamp_priority');
    
    // Auto-refresh
    const [autoRefresh, setAutoRefresh] = useState(true);
    
    /**
     * Carregar dados iniciais
     */
    useEffect(() => {
        loadConflicts();
        loadMetrics();
        
        // Auto-refresh a cada 30 segundos
        let interval;
        if (autoRefresh) {
            interval = setInterval(() => {
                loadConflicts();
                loadMetrics();
            }, 30000);
        }
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [filters, autoRefresh]);
    
    /**
     * Carregar conflitos
     */
    const loadConflicts = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                if (filters[key]) {
                    params.append(key, filters[key]);
                }
            });
            
            const response = await fetch(`/api/conflicts?${params}`);
            const data = await response.json();
            
            if (data.success) {
                setConflicts(data.data.conflicts);
            } else {
                setError(data.error);
            }
        } catch (error) {
            setError('Erro ao carregar conflitos: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, [filters]);
    
    /**
     * Carregar métricas
     */
    const loadMetrics = useCallback(async () => {
        try {
            const response = await fetch('/api/conflicts/metrics');
            const data = await response.json();
            
            if (data.success) {
                setMetrics(data.data);
            }
        } catch (error) {
            console.error('Erro ao carregar métricas:', error);
        }
    }, []);
    
    /**
     * Executar detecção de conflitos
     */
    const detectConflicts = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/conflicts/detect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            
            const data = await response.json();
            
            if (data.success) {
                setShowDetectionModal(false);
                loadConflicts();
                loadMetrics();
                alert(`Detecção concluída: ${data.data.detected} novos conflitos encontrados`);
            } else {
                setError(data.error);
            }
        } catch (error) {
            setError('Erro na detecção: ' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    /**
     * Resolver conflito manualmente
     */
    const resolveConflict = async () => {
        if (!selectedConflict) return;
        
        setLoading(true);
        try {
            const response = await fetch(`/api/conflicts/${selectedConflict.id}/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy: resolutionStrategy,
                    chosenSource,
                    reason: resolutionReason
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                setShowResolveModal(false);
                loadConflicts();
                loadMetrics();
                alert('Conflito resolvido com sucesso!');
            } else {
                setError(data.error);
            }
        } catch (error) {
            setError('Erro ao resolver conflito: ' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    /**
     * Ignorar conflito
     */
    const ignoreConflict = async () => {
        if (!selectedConflict) return;
        
        setLoading(true);
        try {
            const response = await fetch(`/api/conflicts/${selectedConflict.id}/ignore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: ignoreReason
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                setShowIgnoreModal(false);
                loadConflicts();
                loadMetrics();
                alert('Conflito ignorado com sucesso!');
            } else {
                setError(data.error);
            }
        } catch (error) {
            setError('Erro ao ignorar conflito: ' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    /**
     * Resolução em lote
     */
    const bulkResolve = async () => {
        if (selectedConflicts.length === 0) {
            alert('Selecione pelo menos um conflito');
            return;
        }
        
        setLoading(true);
        try {
            const response = await fetch('/api/conflicts/bulk-resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conflictIds: selectedConflicts,
                    strategy: bulkStrategy
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                setSelectedConflicts([]);
                loadConflicts();
                loadMetrics();
                alert(`Resolução em lote concluída: ${data.data.resolved} resolvidos`);
            } else {
                setError(data.error);
            }
        } catch (error) {
            setError('Erro na resolução em lote: ' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    /**
     * Obter badge de severidade
     */
    const getSeverityBadge = (severity) => {
        const variants = {
            low: 'success',
            medium: 'warning',
            high: 'danger'
        };
        
        return <Badge bg={variants[severity] || 'secondary'}>{severity}</Badge>;
    };
    
    /**
     * Obter badge de status
     */
    const getStatusBadge = (status) => {
        const variants = {
            pending: 'warning',
            resolved: 'success',
            ignored: 'secondary'
        };
        
        return <Badge bg={variants[status] || 'primary'}>{status}</Badge>;
    };
    
    /**
     * Renderizar overview
     */
    const renderOverview = () => (
        <Row>
            <Col md={3}>
                <Card className="text-center">
                    <Card.Body>
                        <h3 className="text-primary">{metrics.totalConflicts || 0}</h3>
                        <p>Total de Conflitos</p>
                    </Card.Body>
                </Card>
            </Col>
            <Col md={3}>
                <Card className="text-center">
                    <Card.Body>
                        <h3 className="text-warning">{metrics.pendingConflicts || 0}</h3>
                        <p>Pendentes</p>
                    </Card.Body>
                </Card>
            </Col>
            <Col md={3}>
                <Card className="text-center">
                    <Card.Body>
                        <h3 className="text-success">{metrics.resolvedConflicts || 0}</h3>
                        <p>Resolvidos</p>
                    </Card.Body>
                </Card>
            </Col>
            <Col md={3}>
                <Card className="text-center">
                    <Card.Body>
                        <h3 className="text-info">{metrics.resolutionRate || 0}%</h3>
                        <p>Taxa de Resolução</p>
                    </Card.Body>
                </Card>
            </Col>
            
            <Col md={6} className="mt-3">
                <Card>
                    <Card.Header>Distribuição por Tipo</Card.Header>
                    <Card.Body>
                        {metrics.byType && Object.keys(metrics.byType).map(type => (
                            <div key={type} className="mb-2">
                                <div className="d-flex justify-content-between">
                                    <span>{type}</span>
                                    <span>{metrics.byType[type]}</span>
                                </div>
                                <ProgressBar 
                                    now={(metrics.byType[type] / metrics.totalConflicts) * 100}
                                    variant="info"
                                />
                            </div>
                        ))}
                    </Card.Body>
                </Card>
            </Col>
            
            <Col md={6} className="mt-3">
                <Card>
                    <Card.Header>Ações Rápidas</Card.Header>
                    <Card.Body>
                        <div className="d-grid gap-2">
                            <Button 
                                variant="primary" 
                                onClick={() => setShowDetectionModal(true)}
                                disabled={loading}
                            >
                                <i className="fas fa-search me-2"></i>
                                Detectar Conflitos
                            </Button>
                            
                            <Button 
                                variant="success" 
                                onClick={bulkResolve}
                                disabled={selectedConflicts.length === 0 || loading}
                            >
                                <i className="fas fa-check-double me-2"></i>
                                Resolver Selecionados ({selectedConflicts.length})
                            </Button>
                            
                            <Button 
                                variant="outline-secondary"
                                onClick={() => window.open('/api/conflicts/export?format=csv', '_blank')}
                            >
                                <i className="fas fa-download me-2"></i>
                                Exportar CSV
                            </Button>
                        </div>
                    </Card.Body>
                </Card>
            </Col>
        </Row>
    );
    
    /**
     * Renderizar lista de conflitos
     */
    const renderConflicts = () => (
        <div>
            {/* Filtros */}
            <Card className="mb-3">
                <Card.Body>
                    <Row>
                        <Col md={2}>
                            <Form.Select
                                value={filters.status}
                                onChange={(e) => setFilters({...filters, status: e.target.value})}
                            >
                                <option value="">Todos os Status</option>
                                <option value="pending">Pendente</option>
                                <option value="resolved">Resolvido</option>
                                <option value="ignored">Ignorado</option>
                            </Form.Select>
                        </Col>
                        <Col md={2}>
                            <Form.Select
                                value={filters.type}
                                onChange={(e) => setFilters({...filters, type: e.target.value})}
                            >
                                <option value="">Todos os Tipos</option>
                                <option value="product_data">Dados do Produto</option>
                                <option value="price_minor">Preço Menor</option>
                                <option value="price_major">Preço Maior</option>
                                <option value="stock_minor">Estoque Menor</option>
                                <option value="stock_major">Estoque Maior</option>
                            </Form.Select>
                        </Col>
                        <Col md={2}>
                            <Form.Select
                                value={filters.severity}
                                onChange={(e) => setFilters({...filters, severity: e.target.value})}
                            >
                                <option value="">Todas as Severidades</option>
                                <option value="low">Baixa</option>
                                <option value="medium">Média</option>
                                <option value="high">Alta</option>
                            </Form.Select>
                        </Col>
                        <Col md={2}>
                            <Form.Check
                                type="switch"
                                label="Auto-refresh"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                            />
                        </Col>
                        <Col md={4} className="text-end">
                            <Dropdown className="d-inline-block me-2">
                                <Dropdown.Toggle variant="outline-primary">
                                    Estratégia: {bulkStrategy}
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    <Dropdown.Item onClick={() => setBulkStrategy('timestamp_priority')}>
                                        Timestamp Priority
                                    </Dropdown.Item>
                                    <Dropdown.Item onClick={() => setBulkStrategy('source_priority')}>
                                        Source Priority
                                    </Dropdown.Item>
                                    <Dropdown.Item onClick={() => setBulkStrategy('smart_merge')}>
                                        Smart Merge
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                            
                            <Button 
                                variant="primary" 
                                onClick={loadConflicts}
                                disabled={loading}
                            >
                                <i className="fas fa-sync-alt me-2"></i>
                                Atualizar
                            </Button>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>
            
            {/* Tabela de conflitos */}
            <Card>
                <Card.Header className="d-flex justify-content-between align-items-center">
                    <span>Conflitos Detectados ({conflicts.length})</span>
                    {selectedConflicts.length > 0 && (
                        <Button size="sm" variant="success" onClick={bulkResolve}>
                            Resolver {selectedConflicts.length} selecionados
                        </Button>
                    )}
                </Card.Header>
                <Card.Body>
                    <Table striped bordered hover responsive>
                        <thead>
                            <tr>
                                <th>
                                    <Form.Check
                                        checked={selectedConflicts.length === conflicts.length}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedConflicts(conflicts.map(c => c.id));
                                            } else {
                                                setSelectedConflicts([]);
                                            }
                                        }}
                                    />
                                </th>
                                <th>ID</th>
                                <th>Tipo</th>
                                <th>Severidade</th>
                                <th>Status</th>
                                <th>Entidade</th>
                                <th>Detectado</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {conflicts.map(conflict => (
                                <tr key={conflict.id}>
                                    <td>
                                        <Form.Check
                                            checked={selectedConflicts.includes(conflict.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedConflicts([...selectedConflicts, conflict.id]);
                                                } else {
                                                    setSelectedConflicts(selectedConflicts.filter(id => id !== conflict.id));
                                                }
                                            }}
                                        />
                                    </td>
                                    <td>
                                        <OverlayTrigger
                                            overlay={<Tooltip>{conflict.id}</Tooltip>}
                                        >
                                            <span>{conflict.id.substring(0, 8)}...</span>
                                        </OverlayTrigger>
                                    </td>
                                    <td>{conflict.type}</td>
                                    <td>{getSeverityBadge(conflict.severity)}</td>
                                    <td>{getStatusBadge(conflict.status)}</td>
                                    <td>
                                        {conflict.entityType} #{conflict.entityId}
                                    </td>
                                    <td>
                                        {new Date(conflict.detectedAt).toLocaleString()}
                                    </td>
                                    <td>
                                        <Dropdown>
                                            <Dropdown.Toggle variant="outline-primary" size="sm">
                                                Ações
                                            </Dropdown.Toggle>
                                            <Dropdown.Menu>
                                                <Dropdown.Item 
                                                    onClick={() => {
                                                        setSelectedConflict(conflict);
                                                        setShowResolveModal(true);
                                                    }}
                                                    disabled={conflict.status !== 'pending'}
                                                >
                                                    <i className="fas fa-check me-2"></i>
                                                    Resolver
                                                </Dropdown.Item>
                                                <Dropdown.Item 
                                                    onClick={() => {
                                                        setSelectedConflict(conflict);
                                                        setShowIgnoreModal(true);
                                                    }}
                                                    disabled={conflict.status !== 'pending'}
                                                >
                                                    <i className="fas fa-times me-2"></i>
                                                    Ignorar
                                                </Dropdown.Item>
                                                <Dropdown.Divider />
                                                <Dropdown.Item>
                                                    <i className="fas fa-eye me-2"></i>
                                                    Ver Detalhes
                                                </Dropdown.Item>
                                            </Dropdown.Menu>
                                        </Dropdown>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                    
                    {conflicts.length === 0 && !loading && (
                        <div className="text-center py-4">
                            <i className="fas fa-check-circle fa-3x text-success mb-3"></i>
                            <h5>Nenhum conflito encontrado</h5>
                            <p className="text-muted">Todos os dados estão sincronizados!</p>
                        </div>
                    )}
                </Card.Body>
            </Card>
        </div>
    );
    
    return (
        <div className="conflict-resolution-dashboard">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    Resolução de Conflitos
                </h2>
                <Button
                    variant="outline-primary"
                    onClick={() => setShowDetectionModal(true)}
                    disabled={loading}
                >
                    <i className="fas fa-search me-2"></i>
                    Detectar Conflitos
                </Button>
            </div>
            
            {error && (
                <Alert variant="danger" dismissible onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}
            
            <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
                <Nav variant="tabs" className="mb-3">
                    <Nav.Item>
                        <Nav.Link eventKey="overview">
                            <i className="fas fa-chart-pie me-2"></i>
                            Overview
                        </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link eventKey="conflicts">
                            <i className="fas fa-list me-2"></i>
                            Conflitos ({conflicts.length})
                        </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link eventKey="settings">
                            <i className="fas fa-cog me-2"></i>
                            Configurações
                        </Nav.Link>
                    </Nav.Item>
                </Nav>
                
                <Tab.Content>
                    <Tab.Pane eventKey="overview">
                        {renderOverview()}
                    </Tab.Pane>
                    
                    <Tab.Pane eventKey="conflicts">
                        {renderConflicts()}
                    </Tab.Pane>
                    
                    <Tab.Pane eventKey="settings">
                        <Card>
                            <Card.Header>Configurações de Resolução</Card.Header>
                            <Card.Body>
                                <p>Configurações avançadas serão implementadas aqui.</p>
                            </Card.Body>
                        </Card>
                    </Tab.Pane>
                </Tab.Content>
            </Tab.Container>
            
            {/* Modal de Detecção */}
            <Modal show={showDetectionModal} onHide={() => setShowDetectionModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Detectar Conflitos</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Executar detecção manual de conflitos em todos os dados?</p>
                    <Alert variant="info">
                        <i className="fas fa-info-circle me-2"></i>
                        Esta operação pode levar alguns minutos dependendo do volume de dados.
                    </Alert>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDetectionModal(false)}>
                        Cancelar
                    </Button>
                    <Button variant="primary" onClick={detectConflicts} disabled={loading}>
                        {loading ? 'Detectando...' : 'Detectar Conflitos'}
                    </Button>
                </Modal.Footer>
            </Modal>
            
            {/* Modal de Resolução */}
            <Modal show={showResolveModal} onHide={() => setShowResolveModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Resolver Conflito</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedConflict && (
                        <div>
                            <h6>Conflito: {selectedConflict.type}</h6>
                            <p>Entidade: {selectedConflict.entityType} #{selectedConflict.entityId}</p>
                            
                            <Row>
                                <Col md={6}>
                                    <h6>Dados Locais</h6>
                                    <pre className="bg-light p-2">
                                        {JSON.stringify(selectedConflict.localData, null, 2)}
                                    </pre>
                                </Col>
                                <Col md={6}>
                                    <h6>Dados Bling</h6>
                                    <pre className="bg-light p-2">
                                        {JSON.stringify(selectedConflict.blingData, null, 2)}
                                    </pre>
                                </Col>
                            </Row>
                            
                            <Form>
                                <Form.Group className="mb-3">
                                    <Form.Label>Estratégia de Resolução</Form.Label>
                                    <Form.Select
                                        value={resolutionStrategy}
                                        onChange={(e) => setResolutionStrategy(e.target.value)}
                                    >
                                        <option value="timestamp_priority">Prioridade por Timestamp</option>
                                        <option value="source_priority">Prioridade por Fonte</option>
                                        <option value="smart_merge">Merge Inteligente</option>
                                        <option value="value_based">Baseado em Valor</option>
                                    </Form.Select>
                                </Form.Group>
                                
                                <Form.Group className="mb-3">
                                    <Form.Label>Fonte Escolhida</Form.Label>
                                    <Form.Select
                                        value={chosenSource}
                                        onChange={(e) => setChosenSource(e.target.value)}
                                    >
                                        <option value="local">Dados Locais</option>
                                        <option value="bling">Dados Bling</option>
                                        <option value="merged">Merge dos Dados</option>
                                    </Form.Select>
                                </Form.Group>
                                
                                <Form.Group className="mb-3">
                                    <Form.Label>Motivo (Opcional)</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={2}
                                        value={resolutionReason}
                                        onChange={(e) => setResolutionReason(e.target.value)}
                                        placeholder="Descreva o motivo da resolução..."
                                    />
                                </Form.Group>
                            </Form>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowResolveModal(false)}>
                        Cancelar
                    </Button>
                    <Button variant="success" onClick={resolveConflict} disabled={loading}>
                        {loading ? 'Resolvendo...' : 'Resolver Conflito'}
                    </Button>
                </Modal.Footer>
            </Modal>
            
            {/* Modal de Ignorar */}
            <Modal show={showIgnoreModal} onHide={() => setShowIgnoreModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Ignorar Conflito</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group>
                            <Form.Label>Motivo para Ignorar</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={ignoreReason}
                                onChange={(e) => setIgnoreReason(e.target.value)}
                                placeholder="Descreva por que este conflito deve ser ignorado..."
                                required
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowIgnoreModal(false)}>
                        Cancelar
                    </Button>
                    <Button 
                        variant="warning" 
                        onClick={ignoreConflict} 
                        disabled={loading || !ignoreReason.trim()}
                    >
                        {loading ? 'Ignorando...' : 'Ignorar Conflito'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ConflictResolutionDashboard;