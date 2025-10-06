import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlug, faSync, faRefresh, faInfoCircle, 
  faKey, faCog, faHistory, faTrash 
} from '@fortawesome/free-solid-svg-icons';
import api from '../services/api';

/**
 * Componente de Integração Multi-Tenant Bling ERP
 * Gerencia configuração, autenticação e sincronização por tenant
 */
const BlingIntegration = () => {
  // Estados principais
  const [integrationStatus, setIntegrationStatus] = useState({
    connected: false,
    loading: true,
    integration: null,
    stats: null,
    tenant_id: null
  });

  const [configForm, setConfigForm] = useState({
    client_id: '',
    client_secret: '',
    company_name: '',
    sync_settings: {
      auto_sync: true,
      sync_interval: 60, // minutos
      sync_categories: true
    }
  });

  const [syncStatus, setSyncStatus] = useState({
    syncing: false,
    lastSync: null,
    synchronized: 0,
    history: []
  });

  const [showConfig, setShowConfig] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    checkIntegrationStatus();
  }, []);

  /**
   * Verifica status da integração Bling do tenant
   */
  const checkIntegrationStatus = async () => {
    try {
      setIntegrationStatus(prev => ({ ...prev, loading: true }));
      
      const response = await api.get('/bling/status');
      
      setIntegrationStatus({
        connected: response.data.connected,
        loading: false,
        integration: response.data.integration,
        stats: response.data.stats,
        tenant_id: response.data.tenant_id
      });

      // Se há integração configurada, preencher form
      if (response.data.integration) {
        setConfigForm(prev => ({
          ...prev,
          company_name: response.data.integration.company_name || ''
        }));
      }

    } catch (error) {
      console.error('Erro ao verificar status do Bling:', error);
      setIntegrationStatus({
        connected: false,
        loading: false,
        integration: null,
        stats: null,
        tenant_id: null
      });
    }
  };

  /**
   * Configura credenciais da integração
   */
  const configureIntegration = async () => {
    try {
      if (!configForm.client_id || !configForm.client_secret) {
        alert('Client ID e Client Secret são obrigatórios');
        return;
      }

      const response = await api.post('/bling/auth/config', configForm);
      
      if (response.data.message) {
        alert(response.data.message);
        setShowConfig(false);
        await checkIntegrationStatus();
      }
    } catch (error) {
      console.error('Erro ao configurar integração:', error);
      alert(`Erro ao configurar: ${error.response?.data?.message || error.message}`);
    }
  };

  /**
   * Obtém URL de autenticação OAuth2
   */
  const getAuthUrl = async () => {
    try {
      const response = await api.get('/bling/auth/url');
      
      // Abrir janela de autorização
      const authWindow = window.open(response.data.authUrl, '_blank', 'width=600,height=600');
      
      // Monitorar fechamento da janela para atualizar status
      const checkClosed = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(checkClosed);
          setTimeout(() => {
            checkIntegrationStatus();
          }, 2000);
        }
      }, 1000);

    } catch (error) {
      console.error('Erro ao obter URL de autenticação:', error);
      alert(`Erro: ${error.response?.data?.message || error.message}`);
    }
  };

  /**
   * Executa sincronização de produtos
   */
  const syncProducts = async () => {
    try {
      setSyncStatus(prev => ({ ...prev, syncing: true }));
      
      const response = await api.post('/bling/sync/products');
      
      setSyncStatus({
        syncing: false,
        lastSync: new Date(),
        synchronized: response.data.synchronized || 0
      });

      alert(`Sincronização concluída! ${response.data.synchronized} produtos sincronizados.`);
      await checkIntegrationStatus();
      
    } catch (error) {
      console.error('Erro na sincronização:', error);
      setSyncStatus(prev => ({ ...prev, syncing: false }));
      alert(`Erro na sincronização: ${error.response?.data?.message || error.message}`);
    }
  };

  /**
   * Busca histórico de sincronização
   */
  const loadSyncHistory = async () => {
    try {
      const response = await api.get('/bling/sync/history?limit=20');
      setSyncStatus(prev => ({
        ...prev,
        history: response.data.history || []
      }));
      setShowHistory(true);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      alert('Erro ao carregar histórico de sincronização');
    }
  };

  /**
   * Remove integração
   */
  const removeIntegration = async () => {
    if (!window.confirm('Tem certeza que deseja remover a integração Bling? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await api.delete('/bling/integration');
      alert('Integração removida com sucesso!');
      await checkIntegrationStatus();
    } catch (error) {
      console.error('Erro ao remover integração:', error);
      alert(`Erro ao remover integração: ${error.response?.data?.message || error.message}`);
    }
  };

  /**
   * Renderiza indicador de status
   */
  const renderStatusBadge = () => {
    if (integrationStatus.loading) {
      return <span className="badge bg-secondary">Verificando...</span>;
    }

    if (!integrationStatus.integration) {
      return <span className="badge bg-warning">Não configurado</span>;
    }

    if (integrationStatus.connected) {
      return <span className="badge bg-success">Conectado</span>;
    } else {
      return <span className="badge bg-danger">Erro de conexão</span>;
    }
  };

  /**
   * Renderiza estatísticas da integração
   */
  const renderStats = () => {
    if (!integrationStatus.integration) return null;

    const { integration, stats } = integrationStatus;

    return (
      <div className="row mt-3">
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title text-primary">{integration.products_synced || 0}</h5>
              <p className="card-text small">Produtos Sincronizados</p>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title text-success">{integration.orders_created || 0}</h5>
              <p className="card-text small">Pedidos Criados</p>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title text-info">{stats?.successful_operations || 0}</h5>
              <p className="card-text small">Operações Sucesso</p>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title text-warning">{stats?.failed_operations || 0}</h5>
              <p className="card-text small">Operações com Erro</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Renderiza histórico de sincronização
   */
  const renderHistory = () => {
    if (!showHistory || !syncStatus.history.length) return null;

    return (
      <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
        <div className="modal-backdrop fade show" onClick={() => setShowHistory(false)}></div>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <FontAwesomeIcon icon={faHistory} className="me-2" />
                Histórico de Sincronização
              </h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setShowHistory(false)}
              ></button>
            </div>
            <div className="modal-body">
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Data/Hora</th>
                      <th>Operação</th>
                      <th>Status</th>
                      <th>Registros</th>
                      <th>Mensagem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncStatus.history.map((log, index) => (
                      <tr key={index}>
                        <td>
                          <small>{new Date(log.created_at).toLocaleString()}</small>
                        </td>
                        <td>
                          <span className="badge bg-secondary">{log.operation}</span>
                        </td>
                        <td>
                          <span className={`badge ${log.status === 'success' ? 'bg-success' : 'bg-danger'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td>
                          <small>
                            {log.records_success || 0}/{log.records_processed || 0}
                          </small>
                        </td>
                        <td>
                          <small>{log.message}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h4 className="mb-0">
          <FontAwesomeIcon icon={faPlug} className="me-2" />
          Integração Bling ERP
        </h4>
        {renderStatusBadge()}
      </div>
      
      <div className="card-body">
        {/* Informações da integração */}
        {integrationStatus.integration && (
          <div className="alert alert-info">
            <div className="row">
              <div className="col-md-6">
                <strong>Empresa:</strong> {integrationStatus.integration.company_name || 'Não informado'}<br/>
                <strong>Tenant ID:</strong> {integrationStatus.tenant_id}<br/>
                <strong>Status:</strong> {integrationStatus.integration.status}
              </div>
              <div className="col-md-6">
                <strong>Criado em:</strong> {new Date(integrationStatus.integration.created_at).toLocaleDateString()}<br/>
                <strong>Último sync:</strong> {integrationStatus.integration.last_sync ? 
                  new Date(integrationStatus.integration.last_sync).toLocaleString() : 'Nunca'
                }
              </div>
            </div>
          </div>
        )}

        {/* Botões de ação */}
        <div className="mb-3">
          {!integrationStatus.integration ? (
            <button 
              className="btn btn-primary me-2" 
              onClick={() => setShowConfig(true)}
            >
              <FontAwesomeIcon icon={faCog} className="me-1" />
              Configurar Integração
            </button>
          ) : (
            <>
              {!integrationStatus.connected ? (
                <button 
                  className="btn btn-success me-2" 
                  onClick={getAuthUrl}
                >
                  <FontAwesomeIcon icon={faKey} className="me-1" />
                  Autorizar no Bling
                </button>
              ) : (
                <>
                  <button 
                    className="btn btn-info me-2" 
                    onClick={syncProducts}
                    disabled={syncStatus.syncing}
                  >
                    <FontAwesomeIcon icon={syncStatus.syncing ? faRefresh : faSync} className="me-1" />
                    {syncStatus.syncing ? 'Sincronizando...' : 'Sincronizar Produtos'}
                  </button>
                  
                  <button 
                    className="btn btn-outline-secondary me-2" 
                    onClick={loadSyncHistory}
                  >
                    <FontAwesomeIcon icon={faHistory} className="me-1" />
                    Histórico
                  </button>
                </>
              )}

              <button 
                className="btn btn-outline-primary me-2" 
                onClick={() => setShowConfig(true)}
              >
                <FontAwesomeIcon icon={faCog} className="me-1" />
                Configurações
              </button>

              <button 
                className="btn btn-outline-danger" 
                onClick={removeIntegration}
              >
                <FontAwesomeIcon icon={faTrash} className="me-1" />
                Remover Integração
              </button>
            </>
          )}

          <button 
            className="btn btn-outline-secondary ms-2" 
            onClick={checkIntegrationStatus}
          >
            <FontAwesomeIcon icon={faRefresh} className="me-1" />
            Atualizar Status
          </button>
        </div>

        {/* Estatísticas */}
        {renderStats()}

        {/* Modal de configuração */}
        {showConfig && (
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
            <div className="modal-backdrop fade show" onClick={() => setShowConfig(false)}></div>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <FontAwesomeIcon icon={faCog} className="me-2" />
                    Configuração Bling ERP
                  </h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setShowConfig(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Client ID *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={configForm.client_id}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, client_id: e.target.value }))}
                      placeholder="Seu Client ID do Bling"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Client Secret *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={configForm.client_secret}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, client_secret: e.target.value }))}
                      placeholder="Seu Client Secret do Bling"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Nome da Empresa</label>
                    <input
                      type="text"
                      className="form-control"
                      value={configForm.company_name}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, company_name: e.target.value }))}
                      placeholder="Nome da sua empresa"
                    />
                  </div>
                  
                  <div className="alert alert-warning">
                    <FontAwesomeIcon icon={faInfoCircle} className="me-2" />
                    <strong>Como obter as credenciais:</strong><br/>
                    1. Acesse o <a href="https://developer.bling.com.br/aplicativos" target="_blank" rel="noopener noreferrer">
                      Bling Developer
                    </a><br/>
                    2. Crie uma nova aplicação<br/>
                    3. Copie o Client ID e Client Secret<br/>
                    4. Configure a URL de callback para este domínio
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setShowConfig(false)}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={configureIntegration}
                  >
                    Salvar Configuração
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de histórico */}
        {renderHistory()}
      </div>
    </div>
  );
};

export default BlingIntegration;