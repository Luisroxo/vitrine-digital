import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const AcceptPartnership = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invitationData, setInvitationData] = useState(null);
  const [formData, setFormData] = useState({
    client_id: '',
    client_secret: '',
    access_token: '',
    refresh_token: '',
    company_name: ''
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: Validar token, 2: Configurar Bling, 3: Sucesso

  useEffect(() => {
    if (token) {
      validateInvitation();
    }
  }, [token]);

  const validateInvitation = async () => {
    try {
      setLoading(true);
      // Simular validação do token (não temos endpoint específico, mas o accept fará a validação)
      // Por enquanto, vamos assumir que o token é válido e pedir os dados
      setInvitationData({
        token,
        valid: true,
        supplier_name: 'Fornecedor Demo', // Isso viria da API
        message: 'Convite para parceria exclusiva'
      });
      setStep(2);
    } catch (error) {
      console.error('Erro ao validar convite:', error);
      setInvitationData({ valid: false, error: 'Convite inválido ou expirado' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post(`/partnerships/accept/${token}`, formData);
      setStep(3);
    } catch (error) {
      alert('Erro ao aceitar convite: ' + (error.response?.data?.error || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const renderStep1 = () => (
    <div className="text-center">
      <div className="spinner-border text-primary mb-3" role="status">
        <span className="visually-hidden">Validando convite...</span>
      </div>
      <h4>Validando seu convite...</h4>
      <p className="text-muted">Aguarde enquanto verificamos as informações do convite.</p>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <div className="text-center mb-4">
        <div className="bg-success text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" 
             style={{width: '80px', height: '80px'}}>
          <i className="fas fa-handshake fa-2x"></i>
        </div>
        <h3 className="mb-2">Você foi convidado para uma parceria!</h3>
        <p className="text-muted mb-4">
          Configure sua integração Bling para aceitar a parceria exclusiva
        </p>
      </div>

      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="fas fa-cog me-2"></i>
                Configuração Bling ERP
              </h5>
            </div>
            <div className="card-body">
              <div className="alert alert-info">
                <i className="fas fa-info-circle me-2"></i>
                <strong>Importante:</strong> Você precisa ter uma conta ativa no Bling ERP com API habilitada.
                <a href="https://developer.bling.com.br" target="_blank" rel="noopener noreferrer" className="ms-2">
                  Ver documentação <i className="fas fa-external-link-alt"></i>
                </a>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Client ID *</label>
                      <input
                        type="text"
                        className="form-control"
                        name="client_id"
                        value={formData.client_id}
                        onChange={handleChange}
                        required
                        placeholder="Seu Client ID do Bling"
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Client Secret *</label>
                      <input
                        type="password"
                        className="form-control"
                        name="client_secret"
                        value={formData.client_secret}
                        onChange={handleChange}
                        required
                        placeholder="Seu Client Secret do Bling"
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Nome da Empresa *</label>
                  <input
                    type="text"
                    className="form-control"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    required
                    placeholder="Nome da sua empresa"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Access Token</label>
                  <input
                    type="text"
                    className="form-control"
                    name="access_token"
                    value={formData.access_token}
                    onChange={handleChange}
                    placeholder="Access Token (se já possuir)"
                  />
                  <div className="form-text">
                    Se você não possui um Access Token, deixe em branco. Será gerado automaticamente.
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label">Refresh Token</label>
                  <input
                    type="text"
                    className="form-control"
                    name="refresh_token"
                    value={formData.refresh_token}
                    onChange={handleChange}
                    placeholder="Refresh Token (se já possuir)"
                  />
                </div>

                <div className="alert alert-warning">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  <strong>Modelo de Parceria 1:1:</strong> Ao aceitar este convite, você terá uma parceria 
                  exclusiva com este fornecedor. Você não poderá ter parcerias com outros fornecedores 
                  simultaneamente.
                </div>

                <div className="d-grid gap-2">
                  <button type="submit" className="btn btn-success btn-lg" disabled={submitting}>
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Processando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-handshake me-2"></i>
                        Aceitar Parceria
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Benefícios da Parceria */}
          <div className="card mt-4">
            <div className="card-header">
              <h6 className="mb-0">
                <i className="fas fa-star me-2"></i>
                Benefícios da Parceria
              </h6>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <ul className="list-unstyled">
                    <li className="mb-2">
                      <i className="fas fa-check text-success me-2"></i>
                      Sincronização automática de produtos
                    </li>
                    <li className="mb-2">
                      <i className="fas fa-check text-success me-2"></i>
                      Controle de estoque em tempo real
                    </li>
                    <li className="mb-2">
                      <i className="fas fa-check text-success me-2"></i>
                      Logística unificada e simplificada
                    </li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <ul className="list-unstyled">
                    <li className="mb-2">
                      <i className="fas fa-check text-success me-2"></i>
                      Relacionamento exclusivo 1:1
                    </li>
                    <li className="mb-2">
                      <i className="fas fa-check text-success me-2"></i>
                      Suporte dedicado
                    </li>
                    <li className="mb-2">
                      <i className="fas fa-check text-success me-2"></i>
                      Chat direto com fornecedor
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="text-center">
      <div className="bg-success text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-4" 
           style={{width: '100px', height: '100px'}}>
        <i className="fas fa-check fa-3x"></i>
      </div>
      <h2 className="text-success mb-3">Parceria Aceita com Sucesso!</h2>
      <p className="lead mb-4">
        Sua parceria foi criada e a sincronização inicial está em andamento.
      </p>
      
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">
                <i className="fas fa-rocket me-2"></i>
                Próximos Passos
              </h5>
              <div className="row text-start">
                <div className="col-md-6">
                  <div className="mb-3">
                    <h6 className="fw-bold">1. Sincronização Automática</h6>
                    <p className="text-muted small">
                      Seus produtos serão sincronizados automaticamente do ERP do fornecedor.
                    </p>
                  </div>
                  <div className="mb-3">
                    <h6 className="fw-bold">2. Configure sua Loja</h6>
                    <p className="text-muted small">
                      Personalize as configurações da sua loja virtual.
                    </p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <h6 className="fw-bold">3. Comece a Vender</h6>
                    <p className="text-muted small">
                      Sua loja estará pronta para receber pedidos automaticamente.
                    </p>
                  </div>
                  <div className="mb-3">
                    <h6 className="fw-bold">4. Acompanhe Vendas</h6>
                    <p className="text-muted small">
                      Use o dashboard para acompanhar suas vendas e estoque.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <button 
              className="btn btn-primary btn-lg me-3"
              onClick={() => window.location.href = '/dashboard'}
            >
              <i className="fas fa-tachometer-alt me-2"></i>
              Ir para o Dashboard
            </button>
            <button 
              className="btn btn-outline-info btn-lg"
              onClick={() => window.location.href = '/suporte'}
            >
              <i className="fas fa-headset me-2"></i>
              Preciso de Ajuda
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderInvalidInvitation = () => (
    <div className="text-center">
      <div className="bg-danger text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-4" 
           style={{width: '100px', height: '100px'}}>
        <i className="fas fa-times fa-3x"></i>
      </div>
      <h2 className="text-danger mb-3">Convite Inválido</h2>
      <p className="lead mb-4">
        Este convite não é válido ou já expirou.
      </p>
      <p className="text-muted mb-4">
        Entre em contato com o fornecedor para solicitar um novo convite.
      </p>
      <button 
        className="btn btn-primary"
        onClick={() => window.location.href = '/'}
      >
        <i className="fas fa-home me-2"></i>
        Voltar ao Início
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          {renderStep1()}
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid min-vh-100" style={{backgroundColor: '#f8f9fa'}}>
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-12">
            <div className="text-center mb-4">
              <h1 className="display-6 fw-bold text-primary">
                🤝 Aceitar Parceria
              </h1>
              <p className="text-muted">Sistema de Parcerias 1:1 Exclusivas</p>
            </div>

            <div className="bg-white rounded shadow-sm p-4">
              {!invitationData?.valid && renderInvalidInvitation()}
              {invitationData?.valid && step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcceptPartnership;