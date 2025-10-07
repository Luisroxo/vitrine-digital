import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Alert, Badge, Row, Col, Spinner, Table, InputGroup } from 'react-bootstrap';

const CDNManagementDashboard = () => {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    filePath: '',
    key: ''
  });
  const [invalidateForm, setInvalidateForm] = useState({
    paths: ''
  });
  const [urlForm, setUrlForm] = useState({
    key: '',
    width: '',
    height: '',
    quality: ''
  });
  const [generatedUrl, setGeneratedUrl] = useState(null);

  const API_BASE = process.env.REACT_APP_PRODUCT_SERVICE_URL || 'http://localhost:3003';

  // Carregar dados do CDN
  const loadCDNData = async () => {
    setLoading(true);
    try {
      const [healthResponse, statsResponse, configResponse] = await Promise.all([
        fetch(`${API_BASE}/api/cdn/health`),
        fetch(`${API_BASE}/api/cdn/stats`),
        fetch(`${API_BASE}/api/cdn/config`)
      ]);

      if (healthResponse.ok) {
        setHealth(await healthResponse.json());
      }

      if (statsResponse.ok) {
        setStats(await statsResponse.json());
      }

      if (configResponse.ok) {
        setConfig(await configResponse.json());
      }

    } catch (error) {
      console.error('Erro ao carregar dados CDN:', error);
      showAlert('Erro ao carregar dados do CDN', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Upload manual de arquivo
  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!uploadForm.filePath || !uploadForm.key) {
      showAlert('Informe o caminho do arquivo e a chave', 'warning');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/cdn/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(uploadForm)
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        showAlert(`Arquivo enviado com sucesso! URL: ${result.cdnUrl}`, 'success');
        setUploadForm({ filePath: '', key: '' });
      } else {
        showAlert(result.error || 'Erro no upload', 'danger');
      }
    } catch (error) {
      showAlert('Erro ao fazer upload', 'danger');
    }
  };

  // Invalidar cache
  const handleInvalidate = async (e) => {
    e.preventDefault();
    
    if (!invalidateForm.paths) {
      showAlert('Informe os caminhos para invalidar', 'warning');
      return;
    }

    const pathsArray = invalidateForm.paths.split('\n').map(p => p.trim()).filter(p => p);
    
    try {
      const response = await fetch(`${API_BASE}/api/cdn/invalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ paths: pathsArray })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        showAlert(`Cache invalidado! ID: ${result.invalidationId}`, 'success');
        setInvalidateForm({ paths: '' });
      } else {
        showAlert(result.error || 'Erro na invalidação', 'danger');
      }
    } catch (error) {
      showAlert('Erro ao invalidar cache', 'danger');
    }
  };

  // Gerar URL CDN
  const generateURL = async (e) => {
    e.preventDefault();
    
    if (!urlForm.key) {
      showAlert('Informe a chave do arquivo', 'warning');
      return;
    }

    try {
      const params = new URLSearchParams();
      if (urlForm.width) params.append('width', urlForm.width);
      if (urlForm.height) params.append('height', urlForm.height);
      if (urlForm.quality) params.append('quality', urlForm.quality);

      const response = await fetch(`${API_BASE}/api/cdn/url/${encodeURIComponent(urlForm.key)}?${params}`);
      const result = await response.json();
      
      if (response.ok) {
        setGeneratedUrl(result);
        showAlert('URL gerada com sucesso!', 'success');
      } else {
        showAlert(result.error || 'Erro ao gerar URL', 'danger');
      }
    } catch (error) {
      showAlert('Erro ao gerar URL', 'danger');
    }
  };

  // Mostrar alerta
  const showAlert = (message, variant) => {
    setAlert({ message, variant });
    setTimeout(() => setAlert(null), 5000);
  };

  // Obter status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'local-fallback': return 'info';
      default: return 'danger';
    }
  };

  useEffect(() => {
    loadCDNData();
    
    // Auto-refresh a cada 60 segundos
    const interval = setInterval(loadCDNData, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="cdn-management">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4>🌐 CDN Management</h4>
        <Button 
          variant="outline-primary" 
          onClick={loadCDNData}
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
        <Col lg={8}>
          {/* CDN Status */}
          <Card className="mb-4">
            <Card.Header>
              <h5>📊 Status do CDN</h5>
            </Card.Header>
            <Card.Body>
              {health ? (
                <Row>
                  <Col md={6}>
                    <h6>🔗 Conexão</h6>
                    <p>
                      <Badge bg={getStatusColor(health.status)}>
                        {health.status.replace('-', ' ').toUpperCase()}
                      </Badge>
                    </p>

                    <h6>⚙️ Configuração</h6>
                    <ul className="list-unstyled">
                      <li><strong>Bucket:</strong> {health.config?.bucket || 'N/A'}</li>
                      <li><strong>Distribution:</strong> {health.config?.distribution || 'N/A'}</li>
                      <li><strong>Domain:</strong> {health.config?.domain || 'N/A'}</li>
                    </ul>
                  </Col>
                  
                  <Col md={6}>
                    <h6>☁️ AWS Services</h6>
                    <ul className="list-unstyled">
                      <li>
                        <strong>AWS:</strong> 
                        <Badge bg={health.aws?.enabled ? 'success' : 'secondary'} className="ms-2">
                          {health.aws?.enabled ? 'Habilitado' : 'Desabilitado'}
                        </Badge>
                      </li>
                      <li>
                        <strong>S3:</strong> 
                        <Badge bg={health.aws?.s3 ? 'success' : 'danger'} className="ms-2">
                          {health.aws?.s3 ? 'Online' : 'Offline'}
                        </Badge>
                      </li>
                      <li>
                        <strong>CloudFront:</strong> 
                        <Badge bg={health.aws?.cloudfront ? 'success' : 'warning'} className="ms-2">
                          {health.aws?.cloudfront ? 'Online' : 'N/A'}
                        </Badge>
                      </li>
                    </ul>

                    {health.error && (
                      <Alert variant="warning" className="mt-2">
                        <small>{health.error}</small>
                      </Alert>
                    )}
                  </Col>
                </Row>
              ) : (
                <div className="text-center p-4">
                  <Spinner animation="border" />
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Asset Types Configuration */}
          {config?.assetTypes && (
            <Card className="mb-4">
              <Card.Header>
                <h5>📁 Tipos de Assets</h5>
              </Card.Header>
              <Card.Body>
                <Table size="sm" striped>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Extensões</th>
                      <th>Cache TTL</th>
                      <th>Gzip</th>
                      <th>Prefixo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(config.assetTypes).map(([type, typeConfig]) => (
                      <tr key={type}>
                        <td><Badge bg="secondary">{type}</Badge></td>
                        <td>
                          <small>{typeConfig.extensions.join(', ')}</small>
                        </td>
                        <td>
                          {typeConfig.cacheTTL > 86400 ? 
                            `${Math.round(typeConfig.cacheTTL / 86400)}d` :
                            `${Math.round(typeConfig.cacheTTL / 3600)}h`
                          }
                        </td>
                        <td>
                          <Badge bg={typeConfig.gzip ? 'success' : 'secondary'}>
                            {typeConfig.gzip ? 'Sim' : 'Não'}
                          </Badge>
                        </td>
                        <td><code>{typeConfig.prefix}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          )}
        </Col>

        <Col lg={4}>
          {/* Upload Manual */}
          <Card className="mb-4">
            <Card.Header>
              <h5>📤 Upload Manual</h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleUpload}>
                <Form.Group className="mb-3">
                  <Form.Label>Caminho do Arquivo</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="/caminho/para/arquivo.jpg"
                    value={uploadForm.filePath}
                    onChange={(e) => setUploadForm(prev => ({
                      ...prev,
                      filePath: e.target.value
                    }))}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Chave CDN</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="produto-123.jpg"
                    value={uploadForm.key}
                    onChange={(e) => setUploadForm(prev => ({
                      ...prev,
                      key: e.target.value
                    }))}
                  />
                </Form.Group>

                <Button type="submit" variant="primary" className="w-100">
                  📤 Fazer Upload
                </Button>
              </Form>
            </Card.Body>
          </Card>

          {/* Invalidar Cache */}
          <Card className="mb-4">
            <Card.Header>
              <h5>🗑️ Invalidar Cache</h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleInvalidate}>
                <Form.Group className="mb-3">
                  <Form.Label>Caminhos (um por linha)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    placeholder={`/images/produto-123.jpg\n/assets/style.css`}
                    value={invalidateForm.paths}
                    onChange={(e) => setInvalidateForm(prev => ({
                      ...prev,
                      paths: e.target.value
                    }))}
                  />
                </Form.Group>

                <Button type="submit" variant="warning" className="w-100">
                  🗑️ Invalidar Cache
                </Button>
              </Form>
            </Card.Body>
          </Card>

          {/* Gerador de URL */}
          <Card>
            <Card.Header>
              <h5>🔗 Gerador de URL</h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={generateURL}>
                <Form.Group className="mb-3">
                  <Form.Label>Chave do Arquivo</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="images/produto-123.jpg"
                    value={urlForm.key}
                    onChange={(e) => setUrlForm(prev => ({
                      ...prev,
                      key: e.target.value
                    }))}
                  />
                </Form.Group>

                <Row>
                  <Col>
                    <Form.Group className="mb-3">
                      <Form.Label>Largura</Form.Label>
                      <Form.Control
                        type="number"
                        placeholder="300"
                        value={urlForm.width}
                        onChange={(e) => setUrlForm(prev => ({
                          ...prev,
                          width: e.target.value
                        }))}
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group className="mb-3">
                      <Form.Label>Altura</Form.Label>
                      <Form.Control
                        type="number"
                        placeholder="200"
                        value={urlForm.height}
                        onChange={(e) => setUrlForm(prev => ({
                          ...prev,
                          height: e.target.value
                        }))}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>Qualidade (%)</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    max="100"
                    placeholder="85"
                    value={urlForm.quality}
                    onChange={(e) => setUrlForm(prev => ({
                      ...prev,
                      quality: e.target.value
                    }))}
                  />
                </Form.Group>

                <Button type="submit" variant="info" className="w-100 mb-3">
                  🔗 Gerar URL
                </Button>

                {generatedUrl && (
                  <Alert variant="success">
                    <strong>URL Gerada:</strong>
                    <br />
                    <a href={generatedUrl.url} target="_blank" rel="noopener noreferrer">
                      {generatedUrl.url}
                    </a>
                  </Alert>
                )}
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CDNManagementDashboard;