import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Form, Alert, Image, Badge, Spinner } from 'react-bootstrap';

const ProductImageManager = ({ productId, onImagesChange }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [alert, setAlert] = useState(null);
  const [processing, setProcessing] = useState([]);

  const API_BASE = process.env.REACT_APP_PRODUCT_SERVICE_URL || 'http://localhost:3003';

  // Carregar imagens do produto
  const loadImages = async () => {
    if (!productId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}/images`);
      if (response.ok) {
        const data = await response.json();
        setImages(data.images || []);
      } else {
        showAlert('Erro ao carregar imagens', 'danger');
      }
    } catch (error) {
      console.error('Erro ao carregar imagens:', error);
      showAlert('Erro ao carregar imagens', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Fazer upload de imagens
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    setUploading(true);
    const formData = new FormData();
    
    for (let file of selectedFiles) {
      formData.append('images', file);
    }

    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}/images/upload/multiple`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        showAlert(`${result.uploaded.length} imagens enviadas com sucesso!`, 'success');
        setSelectedFiles([]);
        setShowUploadModal(false);
        loadImages();
        
        // Acompanhar processamento
        const imageIds = result.uploaded.map(img => img.id);
        trackProcessing(imageIds);
        
        if (onImagesChange) onImagesChange();
      } else {
        const error = await response.json();
        showAlert(error.message || 'Erro ao fazer upload', 'danger');
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      showAlert('Erro ao fazer upload das imagens', 'danger');
    } finally {
      setUploading(false);
    }
  };

  // Acompanhar processamento de imagens
  const trackProcessing = async (imageIds) => {
    setProcessing(imageIds);
    
    const checkStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/products/${productId}/images`);
        if (response.ok) {
          const data = await response.json();
          const updatedImages = data.images || [];
          
          const stillProcessing = imageIds.filter(id => {
            const img = updatedImages.find(i => i.id === id);
            return img && (img.processing_status === 'pending' || img.processing_status === 'processing');
          });
          
          if (stillProcessing.length === 0) {
            setProcessing([]);
            loadImages();
          } else {
            setTimeout(checkStatus, 2000); // Verificar novamente em 2s
          }
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
        setProcessing([]);
      }
    };
    
    setTimeout(checkStatus, 1000);
  };

  // Definir imagem principal
  const setPrimary = async (imageId) => {
    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}/images/${imageId}/primary`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        showAlert('Imagem principal definida!', 'success');
        loadImages();
        if (onImagesChange) onImagesChange();
      } else {
        showAlert('Erro ao definir imagem principal', 'danger');
      }
    } catch (error) {
      console.error('Erro:', error);
      showAlert('Erro ao definir imagem principal', 'danger');
    }
  };

  // Remover imagem
  const removeImage = async (imageId) => {
    if (!window.confirm('Tem certeza que deseja remover esta imagem?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}/images/${imageId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        showAlert('Imagem removida!', 'success');
        loadImages();
        if (onImagesChange) onImagesChange();
      } else {
        showAlert('Erro ao remover imagem', 'danger');
      }
    } catch (error) {
      console.error('Erro:', error);
      showAlert('Erro ao remover imagem', 'danger');
    }
  };

  // Mostrar alerta
  const showAlert = (message, variant) => {
    setAlert({ message, variant });
    setTimeout(() => setAlert(null), 5000);
  };

  // Selecionar arquivos
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => {
      return file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024; // 10MB
    });
    
    if (validFiles.length !== files.length) {
      showAlert('Alguns arquivos foram ignorados (apenas imagens até 10MB)', 'warning');
    }
    
    setSelectedFiles(validFiles);
  };

  // Obter URL da variante da imagem
  const getImageUrl = (image, variant = 'medium') => {
    if (image.variants && image.variants[variant]) {
      return `${API_BASE}/uploads/images/${image.variants[variant].filename}`;
    }
    return `${API_BASE}/uploads/images/${image.filename}`;
  };

  // Obter status do processamento
  const getProcessingStatus = (image) => {
    if (processing.includes(image.id)) {
      return { variant: 'warning', text: 'Processando...' };
    }
    
    switch (image.processing_status) {
      case 'completed':
        return { variant: 'success', text: 'Processada' };
      case 'processing':
        return { variant: 'warning', text: 'Processando' };
      case 'failed':
        return { variant: 'danger', text: 'Erro' };
      default:
        return { variant: 'secondary', text: 'Pendente' };
    }
  };

  useEffect(() => {
    loadImages();
  }, [productId]);

  if (!productId) {
    return <Alert variant="info">Selecione um produto para gerenciar suas imagens.</Alert>;
  }

  return (
    <div>
      {alert && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5>Imagens do Produto</h5>
        <Button 
          variant="primary" 
          onClick={() => setShowUploadModal(true)}
          disabled={loading}
        >
          Adicionar Imagens
        </Button>
      </div>

      {loading ? (
        <div className="text-center p-4">
          <Spinner animation="border" />
        </div>
      ) : (
        <div className="row">
          {images.map(image => {
            const status = getProcessingStatus(image);
            return (
              <div key={image.id} className="col-md-4 col-sm-6 mb-3">
                <Card>
                  <div style={{ height: '200px', overflow: 'hidden' }}>
                    <Image 
                      src={getImageUrl(image, 'small')} 
                      alt={image.alt_text || image.original_filename}
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover' 
                      }}
                    />
                  </div>
                  
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <small className="text-muted text-truncate">
                        {image.original_filename}
                      </small>
                      {image.is_primary && (
                        <Badge bg="primary">Principal</Badge>
                      )}
                    </div>
                    
                    <div className="mb-2">
                      <Badge bg={status.variant}>{status.text}</Badge>
                    </div>
                    
                    <div className="d-flex gap-1">
                      {!image.is_primary && image.processing_status === 'completed' && (
                        <Button 
                          size="sm" 
                          variant="outline-primary"
                          onClick={() => setPrimary(image.id)}
                        >
                          Principal
                        </Button>
                      )}
                      
                      <Button 
                        size="sm" 
                        variant="outline-danger"
                        onClick={() => removeImage(image.id)}
                      >
                        Remover
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </div>
            );
          })}
          
          {images.length === 0 && (
            <div className="col-12 text-center p-4">
              <p className="text-muted">Nenhuma imagem adicionada ainda.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal de Upload */}
      <Modal show={showUploadModal} onHide={() => setShowUploadModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Adicionar Imagens</Modal.Title>
        </Modal.Header>
        
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Selecionar Imagens</Form.Label>
              <Form.Control
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
              />
              <Form.Text className="text-muted">
                Máximo 10MB por imagem. Formatos: JPG, PNG, WebP, GIF
              </Form.Text>
            </Form.Group>
            
            {selectedFiles.length > 0 && (
              <div className="mt-3">
                <strong>Arquivos selecionados:</strong>
                <ul className="mt-2">
                  {selectedFiles.map((file, index) => (
                    <li key={index}>
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Form>
        </Modal.Body>
        
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowUploadModal(false)}
            disabled={uploading}
          >
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
          >
            {uploading ? (
              <>
                <Spinner size="sm" className="me-2" />
                Enviando...
              </>
            ) : (
              'Fazer Upload'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ProductImageManager;