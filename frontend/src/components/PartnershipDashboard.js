import React, { useState, useEffect } from 'react';
import api from '../services/api';

const PartnershipDashboard = () => {
  const [partnerships, setPartnerships] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedPartnership, setSelectedPartnership] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [partnershipsResponse, statsResponse] = await Promise.all([
        api.get('/partnerships'),
        api.get('/partnerships/stats')
      ]);

      setPartnerships(partnershipsResponse.data.data);
      setStats(statsResponse.data.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendPartnership = async (partnershipId) => {
    const reason = prompt('Motivo da suspensão:');
    if (!reason) return;

    try {
      await api.put(`/partnerships/${partnershipId}/suspend`, { reason });
      await loadDashboardData();
      alert('Parceria suspensa com sucesso!');
    } catch (error) {
      alert('Erro ao suspender parceria: ' + error.response?.data?.error);
    }
  };

  const handleReactivatePartnership = async (partnershipId) => {
    try {
      await api.put(`/partnerships/${partnershipId}/reactivate`);
      await loadDashboardData();
      alert('Parceria reativada com sucesso!');
    } catch (error) {
      alert('Erro ao reativar parceria: ' + error.response?.data?.error);
    }
  };

  const handleForceSync = async (partnershipId) => {
    try {
      await api.post(`/partnerships/${partnershipId}/sync`);
      alert('Sincronização iniciada! Acompanhe o progresso na aba de logs.');
    } catch (error) {
      alert('Erro ao iniciar sincronização: ' + error.response?.data?.error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-success',
      suspended: 'bg-warning',
      pending: 'bg-info'
    };
    return `badge ${badges[status] || 'bg-secondary'}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{height: '400px'}}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">🤝 Parcerias 1:1</h2>
          <p className="text-muted mb-0">Gerencie suas parcerias exclusivas com lojistas</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowInviteModal(true)}
        >
          <i className="fas fa-plus me-2"></i>
          Convidar Lojista
        </button>
      </div>

      {/* Stats Cards */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card bg-primary text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h6 className="card-title">Total de Parcerias</h6>
                  <h3 className="mb-0">{stats.total_partnerships || 0}</h3>
                </div>
                <div className="align-self-center">
                  <i className="fas fa-handshake fa-2x opacity-75"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-3">
          <div className="card bg-success text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h6 className="card-title">Parcerias Ativas</h6>
                  <h3 className="mb-0">{stats.active_partnerships || 0}</h3>
                </div>
                <div className="align-self-center">
                  <i className="fas fa-check-circle fa-2x opacity-75"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card bg-info text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h6 className="card-title">Produtos Sincronizados</h6>
                  <h3 className="mb-0">{stats.total_products_synced || 0}</h3>
                </div>
                <div className="align-self-center">
                  <i className="fas fa-sync fa-2x opacity-75"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card bg-warning text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h6 className="card-title">Total de Pedidos</h6>
                  <h3 className="mb-0">{stats.total_orders || 0}</h3>
                </div>
                <div className="align-self-center">
                  <i className="fas fa-shopping-cart fa-2x opacity-75"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Partnerships List */}
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">
            <i className="fas fa-users me-2"></i>
            Suas Parcerias ({partnerships.length})
          </h5>
        </div>
        <div className="card-body">
          {partnerships.length === 0 ? (
            <div className="text-center py-5">
              <i className="fas fa-handshake fa-3x text-muted mb-3"></i>
              <h5 className="text-muted">Nenhuma parceria encontrada</h5>
              <p className="text-muted">Comece convidando lojistas para sua rede exclusiva!</p>
              <button 
                className="btn btn-primary"
                onClick={() => setShowInviteModal(true)}
              >
                <i className="fas fa-plus me-2"></i>
                Enviar Primeiro Convite
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Lojista</th>
                    <th>Empresa</th>
                    <th>Status</th>
                    <th>Produtos Sync</th>
                    <th>Última Sync</th>
                    <th>Criada em</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerships.map(partnership => (
                    <tr key={partnership.id}>
                      <td>
                        <div>
                          <strong>{partnership.lojista_name}</strong>
                          <br />
                          <small className="text-muted">{partnership.lojista_email}</small>
                        </div>
                      </td>
                      <td>
                        <span className="fw-medium">{partnership.lojista_company || 'N/A'}</span>
                      </td>
                      <td>
                        <span className={getStatusBadge(partnership.status)}>
                          {partnership.status}
                        </span>
                      </td>
                      <td>
                        <strong>{partnership.products_synced || 0}</strong> produtos
                      </td>
                      <td>
                        {partnership.last_sync_at ? 
                          formatDate(partnership.last_sync_at) : 
                          <span className="text-muted">Nunca</span>
                        }
                      </td>
                      <td>
                        {formatDate(partnership.created_at)}
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-outline-primary"
                            onClick={() => setSelectedPartnership(partnership)}
                            title="Ver detalhes"
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          <button
                            className="btn btn-outline-info"
                            onClick={() => handleForceSync(partnership.id)}
                            title="Forçar sincronização"
                          >
                            <i className="fas fa-sync"></i>
                          </button>
                          {partnership.status === 'active' ? (
                            <button
                              className="btn btn-outline-warning"
                              onClick={() => handleSuspendPartnership(partnership.id)}
                              title="Suspender parceria"
                            >
                              <i className="fas fa-pause"></i>
                            </button>
                          ) : partnership.status === 'suspended' ? (
                            <button
                              className="btn btn-outline-success"
                              onClick={() => handleReactivatePartnership(partnership.id)}
                              title="Reativar parceria"
                            >
                              <i className="fas fa-play"></i>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invitation Modal */}
      {showInviteModal && (
        <InvitationModal 
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            loadDashboardData();
          }}
        />
      )}

      {/* Partnership Detail Modal */}
      {selectedPartnership && (
        <PartnershipDetailModal 
          partnership={selectedPartnership}
          onClose={() => setSelectedPartnership(null)}
        />
      )}
    </div>
  );
};

// Modal de convite (componente separado)
const InvitationModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    lojista_name: '',
    lojista_email: '',
    lojista_phone: '',
    lojista_document: '',
    message: '',
    expires_in_days: 7
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/partnerships/invite', formData);
      alert('Convite enviado com sucesso! Token: ' + response.data.data.invitation_token);
      onSuccess();
    } catch (error) {
      alert('Erro ao enviar convite: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-paper-plane me-2"></i>
              Convidar Novo Lojista
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Nome do Lojista *</label>
                    <input
                      type="text"
                      className="form-control"
                      name="lojista_name"
                      value={formData.lojista_name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      className="form-control"
                      name="lojista_email"
                      value={formData.lojista_email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Telefone</label>
                    <input
                      type="text"
                      className="form-control"
                      name="lojista_phone"
                      value={formData.lojista_phone}
                      onChange={handleChange}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">CNPJ</label>
                    <input
                      type="text"
                      className="form-control"
                      name="lojista_document"
                      value={formData.lojista_document}
                      onChange={handleChange}
                      placeholder="00.000.000/0001-00"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Mensagem Personalizada</label>
                <textarea
                  className="form-control"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Olá! Gostaria de convidá-lo para uma parceria exclusiva..."
                ></textarea>
              </div>

              <div className="mb-3">
                <label className="form-label">Validade do Convite (dias)</label>
                <select
                  className="form-select"
                  name="expires_in_days"
                  value={formData.expires_in_days}
                  onChange={handleChange}
                >
                  <option value="3">3 dias</option>
                  <option value="7">7 dias</option>
                  <option value="15">15 dias</option>
                  <option value="30">30 dias</option>
                </select>
              </div>

              <div className="alert alert-info">
                <i className="fas fa-info-circle me-2"></i>
                <strong>Modelo 1:1 Exclusivo:</strong> Cada lojista pode ter apenas 1 fornecedor. 
                Uma vez aceito, a parceria será exclusiva entre vocês.
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Enviando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane me-2"></i>
                    Enviar Convite
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Modal de detalhes da parceria
const PartnershipDetailModal = ({ partnership, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMessages();
  }, [partnership.id]);

  const loadMessages = async () => {
    try {
      const response = await api.get(`/partnerships/${partnership.id}/messages`);
      setMessages(response.data.data);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      await api.post(`/partnerships/${partnership.id}/messages`, {
        message: newMessage,
        message_type: 'general'
      });
      setNewMessage('');
      loadMessages();
    } catch (error) {
      alert('Erro ao enviar mensagem: ' + error.response?.data?.error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-handshake me-2"></i>
              Parceria com {partnership.lojista_name}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="row">
              {/* Informações da Parceria */}
              <div className="col-md-6">
                <div className="card h-100">
                  <div className="card-header">
                    <h6 className="mb-0">
                      <i className="fas fa-info-circle me-2"></i>
                      Informações da Parceria
                    </h6>
                  </div>
                  <div className="card-body">
                    <table className="table table-sm table-borderless">
                      <tbody>
                        <tr>
                          <td><strong>Lojista:</strong></td>
                          <td>{partnership.lojista_name}</td>
                        </tr>
                        <tr>
                          <td><strong>Email:</strong></td>
                          <td>{partnership.lojista_email}</td>
                        </tr>
                        <tr>
                          <td><strong>Empresa:</strong></td>
                          <td>{partnership.lojista_company || 'N/A'}</td>
                        </tr>
                        <tr>
                          <td><strong>Status:</strong></td>
                          <td>
                            <span className={`badge ${partnership.status === 'active' ? 'bg-success' : 'bg-warning'}`}>
                              {partnership.status}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Produtos Sync:</strong></td>
                          <td>{partnership.products_synced || 0}</td>
                        </tr>
                        <tr>
                          <td><strong>Total Pedidos:</strong></td>
                          <td>{partnership.total_orders || 0}</td>
                        </tr>
                        <tr>
                          <td><strong>Última Sync:</strong></td>
                          <td>{partnership.last_sync_at ? formatDate(partnership.last_sync_at) : 'Nunca'}</td>
                        </tr>
                        <tr>
                          <td><strong>Criada em:</strong></td>
                          <td>{formatDate(partnership.created_at)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Chat de Mensagens */}
              <div className="col-md-6">
                <div className="card h-100">
                  <div className="card-header">
                    <h6 className="mb-0">
                      <i className="fas fa-comments me-2"></i>
                      Mensagens ({messages.length})
                    </h6>
                  </div>
                  <div className="card-body">
                    <div style={{maxHeight: '300px', overflowY: 'auto'}} className="mb-3">
                      {messages.length === 0 ? (
                        <div className="text-center text-muted py-4">
                          <i className="fas fa-comments fa-2x mb-2"></i>
                          <p>Nenhuma mensagem ainda</p>
                        </div>
                      ) : (
                        messages.map(message => (
                          <div key={message.id} className="mb-3">
                            <div className={`d-flex ${message.sender_type === 'supplier' ? 'justify-content-end' : 'justify-content-start'}`}>
                              <div className={`card ${message.sender_type === 'supplier' ? 'bg-primary text-white' : 'bg-light'}`} style={{maxWidth: '80%'}}>
                                <div className="card-body py-2 px-3">
                                  <p className="mb-1">{message.message}</p>
                                  <small className={message.sender_type === 'supplier' ? 'text-white-50' : 'text-muted'}>
                                    {message.sender_name} • {formatDate(message.created_at)}
                                  </small>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Formulário de nova mensagem */}
                    <form onSubmit={handleSendMessage}>
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Digite sua mensagem..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                        />
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                          <i className="fas fa-paper-plane"></i>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnershipDashboard;