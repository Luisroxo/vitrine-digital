import React, { useState, useEffect } from 'react';
import { useBling } from '../hooks/useAPI';
import { LoadingButton, SkeletonLoader, PageLoader } from '../contexts/LoadingContext';
import { useError } from '../contexts/ErrorContext';

/**
 * Bling Setup Component
 */
export function BlingSetup({ tenantId, onSetupComplete }) {
  const [step, setStep] = useState('credentials'); // credentials | authorize | configure | complete
  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    webhookUrl: '',
    syncProducts: true,
    syncOrders: true,
    autoStock: true
  });

  const { setupBling, authorizeBling, loading } = useBling();
  const { showError, showSuccess } = useError();

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();

    if (!formData.clientId || !formData.clientSecret) {
      showError('Client ID e Client Secret são obrigatórios.', 'validation');
      return;
    }

    try {
      const result = await setupBling(tenantId, {
        clientId: formData.clientId,
        clientSecret: formData.clientSecret,
        webhookUrl: formData.webhookUrl
      });

      if (result.authUrl) {
        setStep('authorize');
        // Open authorization URL in new window
        window.open(result.authUrl, 'bling-auth', 'width=600,height=700');
      }
    } catch (error) {
      showError('Erro ao configurar Bling. Verifique as credenciais.', 'bling');
    }
  };

  const handleAuthorizeComplete = async () => {
    try {
      const result = await authorizeBling(tenantId);
      
      if (result.success) {
        showSuccess('Autorização do Bling realizada com sucesso!');
        setStep('configure');
      }
    } catch (error) {
      showError('Erro na autorização do Bling.', 'bling');
    }
  };

  const handleConfigurationSubmit = async (e) => {
    e.preventDefault();

    try {
      // Configure sync settings
      await setupBling(tenantId, {
        syncProducts: formData.syncProducts,
        syncOrders: formData.syncOrders,
        autoStock: formData.autoStock
      });

      setStep('complete');
      showSuccess('Integração Bling configurada com sucesso!');
      
      if (onSetupComplete) {
        onSetupComplete();
      }
    } catch (error) {
      showError('Erro ao configurar sincronização.', 'bling');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const renderStepIndicator = () => (
    <div className="d-flex justify-content-center mb-4">
      <div className="d-flex align-items-center">
        {['credentials', 'authorize', 'configure', 'complete'].map((stepName, index) => (
          <React.Fragment key={stepName}>
            <div
              className={`rounded-circle d-flex align-items-center justify-content-center ${
                step === stepName ? 'bg-primary text-white' : 
                ['credentials', 'authorize', 'configure'].indexOf(step) > index ? 'bg-success text-white' : 'bg-light text-muted'
              }`}
              style={{ width: '40px', height: '40px' }}
            >
              {['credentials', 'authorize', 'configure'].indexOf(step) > index ? (
                <i className="fas fa-check"></i>
              ) : (
                index + 1
              )}
            </div>
            {index < 3 && (
              <div
                className={`mx-3 ${
                  ['credentials', 'authorize', 'configure'].indexOf(step) > index ? 'bg-success' : 'bg-light'
                }`}
                style={{ height: '2px', width: '60px' }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  if (step === 'credentials') {
    return (
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">
            <i className="fas fa-cog me-2"></i>
            Configurar Integração Bling - Credenciais
          </h5>
        </div>
        <div className="card-body">
          {renderStepIndicator()}
          
          <div className="alert alert-info">
            <i className="fas fa-info-circle me-2"></i>
            <strong>Passo 1:</strong> Configure suas credenciais do Bling Developer.
            <a href="https://developer.bling.com.br/aplicativos" target="_blank" className="alert-link ms-2">
              Criar aplicação no Bling Developer
            </a>
          </div>

          <form onSubmit={handleCredentialsSubmit}>
            <div className="mb-3">
              <label htmlFor="clientId" className="form-label">
                Client ID *
              </label>
              <input
                type="text"
                className="form-control"
                id="clientId"
                name="clientId"
                value={formData.clientId}
                onChange={handleChange}
                placeholder="Digite o Client ID do Bling"
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="clientSecret" className="form-label">
                Client Secret *
              </label>
              <input
                type="password"
                className="form-control"
                id="clientSecret"
                name="clientSecret"
                value={formData.clientSecret}
                onChange={handleChange}
                placeholder="Digite o Client Secret do Bling"
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="webhookUrl" className="form-label">
                URL do Webhook (Opcional)
              </label>
              <input
                type="url"
                className="form-control"
                id="webhookUrl"
                name="webhookUrl"
                value={formData.webhookUrl}
                onChange={handleChange}
                placeholder="https://seudominio.com/webhook/bling"
              />
              <div className="form-text">
                URL para receber notificações automáticas do Bling
              </div>
            </div>

            <div className="d-grid">
              <LoadingButton
                type="submit"
                className="btn btn-primary"
                loading={loading}
                loadingText="Configurando..."
              >
                <i className="fas fa-arrow-right me-2"></i>
                Próximo: Autorizar Bling
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'authorize') {
    return (
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">
            <i className="fas fa-shield-alt me-2"></i>
            Configurar Integração Bling - Autorização
          </h5>
        </div>
        <div className="card-body text-center">
          {renderStepIndicator()}
          
          <div className="mb-4">
            <i className="fas fa-external-link-alt text-primary" style={{ fontSize: '4rem' }}></i>
          </div>

          <h4>Autorize a integração no Bling</h4>
          <p className="text-muted mb-4">
            Uma janela foi aberta para você autorizar o acesso ao Bling.
            Após autorizar, clique no botão abaixo para continuar.
          </p>

          <div className="d-grid gap-2">
            <LoadingButton
              className="btn btn-success"
              onClick={handleAuthorizeComplete}
              loading={loading}
              loadingText="Verificando autorização..."
            >
              <i className="fas fa-check me-2"></i>
              Autorização Concluída
            </LoadingButton>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'configure') {
    return (
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">
            <i className="fas fa-sync me-2"></i>
            Configurar Integração Bling - Sincronização
          </h5>
        </div>
        <div className="card-body">
          {renderStepIndicator()}
          
          <div className="alert alert-success">
            <i className="fas fa-check-circle me-2"></i>
            <strong>Sucesso!</strong> Bling autorizado. Configure agora as opções de sincronização.
          </div>

          <form onSubmit={handleConfigurationSubmit}>
            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="syncProducts"
                name="syncProducts"
                checked={formData.syncProducts}
                onChange={handleChange}
              />
              <label className="form-check-label" htmlFor="syncProducts">
                <strong>Sincronizar Produtos</strong>
                <div className="text-muted small">
                  Importar produtos do Bling automaticamente
                </div>
              </label>
            </div>

            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="syncOrders"
                name="syncOrders"
                checked={formData.syncOrders}
                onChange={handleChange}
              />
              <label className="form-check-label" htmlFor="syncOrders">
                <strong>Sincronizar Pedidos</strong>
                <div className="text-muted small">
                  Enviar pedidos da vitrine para o Bling
                </div>
              </label>
            </div>

            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="autoStock"
                name="autoStock"
                checked={formData.autoStock}
                onChange={handleChange}
              />
              <label className="form-check-label" htmlFor="autoStock">
                <strong>Controle Automático de Estoque</strong>
                <div className="text-muted small">
                  Atualizar estoque automaticamente via webhooks
                </div>
              </label>
            </div>

            <div className="d-grid">
              <LoadingButton
                type="submit"
                className="btn btn-success"
                loading={loading}
                loadingText="Finalizando..."
              >
                <i className="fas fa-check me-2"></i>
                Finalizar Configuração
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="card">
        <div className="card-body text-center">
          {renderStepIndicator()}
          
          <div className="mb-4">
            <i className="fas fa-check-circle text-success" style={{ fontSize: '4rem' }}></i>
          </div>

          <h4 className="text-success">Integração Bling Configurada!</h4>
          <p className="text-muted mb-4">
            Sua integração com o Bling foi configurada com sucesso.
            Agora você pode sincronizar produtos e pedidos automaticamente.
          </p>

          <div className="d-grid gap-2">
            <button className="btn btn-primary" onClick={onSetupComplete}>
              <i className="fas fa-tachometer-alt me-2"></i>
              Ir para Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Bling Dashboard Component
 */
export function BlingDashboard({ tenantId }) {
  const [stats, setStats] = useState(null);
  const [recentSync, setRecentSync] = useState([]);

  const { 
    getStats, 
    syncProducts, 
    syncOrders, 
    getRecentSync,
    loading 
  } = useBling();
  const { showError, showSuccess } = useError();

  useEffect(() => {
    loadDashboardData();
  }, [tenantId]);

  const loadDashboardData = async () => {
    try {
      const [statsData, syncData] = await Promise.all([
        getStats(tenantId),
        getRecentSync(tenantId)
      ]);
      
      setStats(statsData);
      setRecentSync(syncData);
    } catch (error) {
      showError('Erro ao carregar dados do dashboard.', 'bling');
    }
  };

  const handleSyncProducts = async () => {
    try {
      await syncProducts(tenantId);
      showSuccess('Sincronização de produtos iniciada!');
      loadDashboardData();
    } catch (error) {
      showError('Erro ao sincronizar produtos.', 'bling');
    }
  };

  const handleSyncOrders = async () => {
    try {
      await syncOrders(tenantId);
      showSuccess('Sincronização de pedidos iniciada!');
      loadDashboardData();
    } catch (error) {
      showError('Erro ao sincronizar pedidos.', 'bling');
    }
  };

  if (loading && !stats) {
    return <PageLoader message="Carregando dashboard Bling..." />;
  }

  return (
    <div>
      {/* Stats Cards */}
      <div className="row mb-4">
        <div className="col-md-3 mb-3">
          <div className="card bg-primary text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h5 className="card-title">Produtos Sincronizados</h5>
                  <h2>{stats?.productsSynced || 0}</h2>
                </div>
                <div className="align-self-center">
                  <i className="fas fa-box fa-2x"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card bg-success text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h5 className="card-title">Pedidos Enviados</h5>
                  <h2>{stats?.ordersSent || 0}</h2>
                </div>
                <div className="align-self-center">
                  <i className="fas fa-shopping-cart fa-2x"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card bg-info text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h5 className="card-title">Última Sincronização</h5>
                  <p className="mb-0">
                    {stats?.lastSync ? new Date(stats.lastSync).toLocaleString('pt-BR') : 'Nunca'}
                  </p>
                </div>
                <div className="align-self-center">
                  <i className="fas fa-sync fa-2x"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card bg-warning text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h5 className="card-title">Status</h5>
                  <span className="badge bg-light text-dark">
                    {stats?.status === 'active' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="align-self-center">
                  <i className={`fas ${stats?.status === 'active' ? 'fa-check-circle' : 'fa-exclamation-circle'} fa-2x`}></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="fas fa-tools me-2"></i>
                Ações de Sincronização
              </h5>
            </div>
            <div className="card-body">
              <div className="d-flex gap-3 flex-wrap">
                <LoadingButton
                  className="btn btn-primary"
                  onClick={handleSyncProducts}
                  loading={loading}
                  loadingText="Sincronizando..."
                >
                  <i className="fas fa-download me-2"></i>
                  Sincronizar Produtos
                </LoadingButton>

                <LoadingButton
                  className="btn btn-success"
                  onClick={handleSyncOrders}
                  loading={loading}
                  loadingText="Sincronizando..."
                >
                  <i className="fas fa-upload me-2"></i>
                  Sincronizar Pedidos
                </LoadingButton>

                <button className="btn btn-outline-secondary" onClick={loadDashboardData}>
                  <i className="fas fa-refresh me-2"></i>
                  Atualizar Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sync Activity */}
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="fas fa-history me-2"></i>
                Atividade Recente de Sincronização
              </h5>
            </div>
            <div className="card-body">
              {recentSync?.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Descrição</th>
                        <th>Status</th>
                        <th>Data/Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSync.map(sync => (
                        <tr key={sync.id}>
                          <td>
                            <span className={`badge ${sync.type === 'product' ? 'bg-primary' : 'bg-success'}`}>
                              {sync.type === 'product' ? 'Produto' : 'Pedido'}
                            </span>
                          </td>
                          <td>{sync.description}</td>
                          <td>
                            <span className={`badge ${
                              sync.status === 'success' ? 'bg-success' : 
                              sync.status === 'error' ? 'bg-danger' : 'bg-warning'
                            }`}>
                              {sync.status === 'success' ? 'Sucesso' : 
                               sync.status === 'error' ? 'Erro' : 'Pendente'}
                            </span>
                          </td>
                          <td>{new Date(sync.createdAt).toLocaleString('pt-BR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4">
                  <i className="fas fa-clock text-muted" style={{ fontSize: '3rem' }}></i>
                  <h5 className="mt-3">Nenhuma atividade recente</h5>
                  <p className="text-muted">
                    As sincronizações aparecerão aqui quando executadas.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Bling Settings Component
 */
export function BlingSettings({ tenantId, onSave }) {
  const [settings, setSettings] = useState({
    autoSync: true,
    syncInterval: 30,
    webhookEnabled: true,
    stockControl: true,
    priceSync: true,
    categoryMapping: {},
    notifications: {
      syncSuccess: true,
      syncError: true,
      lowStock: true
    }
  });

  const { getSettings, updateSettings, loading } = useBling();
  const { showError, showSuccess } = useError();

  useEffect(() => {
    loadSettings();
  }, [tenantId]);

  const loadSettings = async () => {
    try {
      const data = await getSettings(tenantId);
      setSettings(prev => ({ ...prev, ...data }));
    } catch (error) {
      showError('Erro ao carregar configurações.', 'bling');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await updateSettings(tenantId, settings);
      showSuccess('Configurações salvas com sucesso!');
      
      if (onSave) {
        onSave(settings);
      }
    } catch (error) {
      showError('Erro ao salvar configurações.', 'bling');
    }
  };

  const handleChange = (path, value) => {
    setSettings(prev => {
      const updated = { ...prev };
      const keys = path.split('.');
      let current = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">
          <i className="fas fa-cog me-2"></i>
          Configurações da Integração Bling
        </h5>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          {/* Sync Settings */}
          <div className="mb-4">
            <h6 className="border-bottom pb-2">Sincronização Automática</h6>
            
            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="autoSync"
                checked={settings.autoSync}
                onChange={(e) => handleChange('autoSync', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="autoSync">
                Habilitar sincronização automática
              </label>
            </div>

            <div className="mb-3">
              <label htmlFor="syncInterval" className="form-label">
                Intervalo de sincronização (minutos)
              </label>
              <select
                className="form-select"
                id="syncInterval"
                value={settings.syncInterval}
                onChange={(e) => handleChange('syncInterval', parseInt(e.target.value))}
              >
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
                <option value={120}>2 horas</option>
                <option value={240}>4 horas</option>
              </select>
            </div>
          </div>

          {/* Product Settings */}
          <div className="mb-4">
            <h6 className="border-bottom pb-2">Configurações de Produtos</h6>
            
            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="stockControl"
                checked={settings.stockControl}
                onChange={(e) => handleChange('stockControl', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="stockControl">
                Controle automático de estoque
              </label>
            </div>

            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="priceSync"
                checked={settings.priceSync}
                onChange={(e) => handleChange('priceSync', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="priceSync">
                Sincronizar preços automaticamente
              </label>
            </div>
          </div>

          {/* Webhook Settings */}
          <div className="mb-4">
            <h6 className="border-bottom pb-2">Webhooks</h6>
            
            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="webhookEnabled"
                checked={settings.webhookEnabled}
                onChange={(e) => handleChange('webhookEnabled', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="webhookEnabled">
                Habilitar webhooks do Bling
              </label>
            </div>
          </div>

          {/* Notifications */}
          <div className="mb-4">
            <h6 className="border-bottom pb-2">Notificações</h6>
            
            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="syncSuccess"
                checked={settings.notifications.syncSuccess}
                onChange={(e) => handleChange('notifications.syncSuccess', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="syncSuccess">
                Notificar sincronização bem-sucedida
              </label>
            </div>

            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="syncError"
                checked={settings.notifications.syncError}
                onChange={(e) => handleChange('notifications.syncError', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="syncError">
                Notificar erros de sincronização
              </label>
            </div>

            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="lowStock"
                checked={settings.notifications.lowStock}
                onChange={(e) => handleChange('notifications.lowStock', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="lowStock">
                Notificar estoque baixo
              </label>
            </div>
          </div>

          <div className="d-flex justify-content-end">
            <LoadingButton
              type="submit"
              className="btn btn-primary"
              loading={loading}
              loadingText="Salvando..."
            >
              <i className="fas fa-save me-2"></i>
              Salvar Configurações
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}