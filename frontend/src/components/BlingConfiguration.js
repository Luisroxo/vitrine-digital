import React, { useState, useEffect } from 'react';
import { useBling } from '../hooks/useAPI';
import { LoadingButton, SkeletonLoader } from '../contexts/LoadingContext';
import { useError } from '../contexts/ErrorContext';

/**
 * Bling Configuration Dashboard
 */
export function BlingConfiguration({ tenantId, onConfigSave }) {
  const [activeTab, setActiveTab] = useState('connection');
  const [config, setConfig] = useState({
    connection: {
      clientId: '',
      clientSecret: '',
      accessToken: '',
      refreshToken: '',
      isConnected: false,
      lastSync: null
    },
    sync: {
      autoSync: true,
      syncInterval: 30, // minutes
      syncProducts: true,
      syncOrders: true,
      syncCustomers: false,
      syncStock: true,
      syncPrices: true
    },
    webhooks: {
      enabled: true,
      url: '',
      events: {
        productUpdated: true,
        orderCreated: true,
        stockUpdated: true,
        priceUpdated: true
      }
    },
    mapping: {
      categories: {},
      statuses: {},
      paymentMethods: {}
    },
    notifications: {
      email: '',
      syncSuccess: true,
      syncError: true,
      webhookError: true,
      lowStock: true,
      orderStatus: true
    }
  });

  const { 
    getBlingConfig, 
    updateBlingConfig, 
    testBlingConnection,
    syncBling,
    loading 
  } = useBling();
  const { showError, showSuccess } = useError();

  useEffect(() => {
    loadConfiguration();
  }, [tenantId]);

  const loadConfiguration = async () => {
    try {
      const data = await getBlingConfig(tenantId);
      setConfig(prev => ({ ...prev, ...data }));
    } catch (error) {
      showError('Erro ao carregar configuração do Bling.', 'bling');
    }
  };

  const handleSave = async () => {
    try {
      await updateBlingConfig(tenantId, config);
      showSuccess('Configuração salva com sucesso!');
      
      if (onConfigSave) {
        onConfigSave(config);
      }
    } catch (error) {
      showError('Erro ao salvar configuração.', 'bling');
    }
  };

  const handleTestConnection = async () => {
    try {
      const result = await testBlingConnection(tenantId);
      
      if (result.success) {
        showSuccess('Conexão com Bling testada com sucesso!');
        setConfig(prev => ({
          ...prev,
          connection: { ...prev.connection, isConnected: true }
        }));
      }
    } catch (error) {
      showError('Erro na conexão com Bling. Verifique as credenciais.', 'bling');
    }
  };

  const handleManualSync = async () => {
    try {
      const result = await syncBling(tenantId, {
        products: config.sync.syncProducts,
        orders: config.sync.syncOrders,
        stock: config.sync.syncStock,
        prices: config.sync.syncPrices
      });
      
      showSuccess(`Sincronização iniciada! ${result.jobsStarted} processo(s) em execução.`);
    } catch (error) {
      showError('Erro ao iniciar sincronização manual.', 'bling');
    }
  };

  const updateConfig = (path, value) => {
    setConfig(prev => {
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

  const renderTabNavigation = () => (
    <ul className="nav nav-tabs mb-4">
      <li className="nav-item">
        <button
          className={`nav-link ${activeTab === 'connection' ? 'active' : ''}`}
          onClick={() => setActiveTab('connection')}
        >
          <i className="fas fa-plug me-2"></i>
          Conexão
        </button>
      </li>
      <li className="nav-item">
        <button
          className={`nav-link ${activeTab === 'sync' ? 'active' : ''}`}
          onClick={() => setActiveTab('sync')}
        >
          <i className="fas fa-sync me-2"></i>
          Sincronização
        </button>
      </li>
      <li className="nav-item">
        <button
          className={`nav-link ${activeTab === 'webhooks' ? 'active' : ''}`}
          onClick={() => setActiveTab('webhooks')}
        >
          <i className="fas fa-bolt me-2"></i>
          Webhooks
        </button>
      </li>
      <li className="nav-item">
        <button
          className={`nav-link ${activeTab === 'mapping' ? 'active' : ''}`}
          onClick={() => setActiveTab('mapping')}
        >
          <i className="fas fa-map me-2"></i>
          Mapeamento
        </button>
      </li>
      <li className="nav-item">
        <button
          className={`nav-link ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <i className="fas fa-bell me-2"></i>
          Notificações
        </button>
      </li>
    </ul>
  );

  if (loading && !config.connection.clientId) {
    return <SkeletonLoader lines={8} />;
  }

  return (
    <div className="bling-configuration">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4>
          <i className="fas fa-cog me-2"></i>
          Configuração Bling ERP
        </h4>
        
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-primary"
            onClick={loadConfiguration}
          >
            <i className="fas fa-refresh me-2"></i>
            Recarregar
          </button>
          
          <LoadingButton
            className="btn btn-success"
            onClick={handleSave}
            loading={loading}
            loadingText="Salvando..."
          >
            <i className="fas fa-save me-2"></i>
            Salvar Configuração
          </LoadingButton>
        </div>
      </div>

      {/* Connection Status */}
      <div className="alert alert-info mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <i className={`fas ${config.connection.isConnected ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'} me-2`}></i>
            <strong>Status da Conexão:</strong> {config.connection.isConnected ? 'Conectado' : 'Desconectado'}
            {config.connection.lastSync && (
              <small className="ms-3 text-muted">
                Última sincronização: {new Date(config.connection.lastSync).toLocaleString('pt-BR')}
              </small>
            )}
          </div>
          
          <div className="d-flex gap-2">
            <LoadingButton
              className="btn btn-outline-primary btn-sm"
              onClick={handleTestConnection}
              loading={loading}
              loadingText="Testando..."
            >
              <i className="fas fa-plug me-2"></i>
              Testar Conexão
            </LoadingButton>
            
            <LoadingButton
              className="btn btn-primary btn-sm"
              onClick={handleManualSync}
              loading={loading}
              loadingText="Sincronizando..."
              disabled={!config.connection.isConnected}
            >
              <i className="fas fa-sync me-2"></i>
              Sincronizar Agora
            </LoadingButton>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      {renderTabNavigation()}

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'connection' && (
          <ConnectionTab config={config} updateConfig={updateConfig} loading={loading} />
        )}
        
        {activeTab === 'sync' && (
          <SyncTab config={config} updateConfig={updateConfig} />
        )}
        
        {activeTab === 'webhooks' && (
          <WebhooksTab config={config} updateConfig={updateConfig} />
        )}
        
        {activeTab === 'mapping' && (
          <MappingTab config={config} updateConfig={updateConfig} tenantId={tenantId} />
        )}
        
        {activeTab === 'notifications' && (
          <NotificationsTab config={config} updateConfig={updateConfig} />
        )}
      </div>
    </div>
  );
}

/**
 * Connection Tab Component
 */
function ConnectionTab({ config, updateConfig, loading }) {
  return (
    <div className="card">
      <div className="card-header">
        <h6 className="mb-0">
          <i className="fas fa-key me-2"></i>
          Credenciais de API
        </h6>
      </div>
      <div className="card-body">
        <div className="alert alert-warning">
          <i className="fas fa-exclamation-triangle me-2"></i>
          <strong>Importante:</strong> Essas credenciais são obtidas no{' '}
          <a href="https://developer.bling.com.br" target="_blank" rel="noopener noreferrer">
            Portal do Desenvolvedor Bling
          </a>
        </div>

        <div className="row">
          <div className="col-md-6 mb-3">
            <label className="form-label">Client ID *</label>
            <input
              type="text"
              className="form-control"
              value={config.connection.clientId}
              onChange={(e) => updateConfig('connection.clientId', e.target.value)}
              placeholder="Digite o Client ID"
            />
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Client Secret *</label>
            <div className="input-group">
              <input
                type="password"
                className="form-control"
                value={config.connection.clientSecret}
                onChange={(e) => updateConfig('connection.clientSecret', e.target.value)}
                placeholder="Digite o Client Secret"
              />
              <button className="btn btn-outline-secondary" type="button">
                <i className="fas fa-eye"></i>
              </button>
            </div>
          </div>
        </div>

        {config.connection.accessToken && (
          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Access Token (Gerado automaticamente)</label>
              <input
                type="text"
                className="form-control"
                value={config.connection.accessToken}
                disabled
              />
              <small className="form-text text-muted">
                Token gerado após autorização OAuth
              </small>
            </div>
            
            <div className="col-md-6 mb-3">
              <label className="form-label">Refresh Token</label>
              <input
                type="text"
                className="form-control"
                value={config.connection.refreshToken}
                disabled
              />
              <small className="form-text text-muted">
                Token para renovação automática
              </small>
            </div>
          </div>
        )}

        <hr />

        <div className="row">
          <div className="col-12">
            <h6>Instruções de Configuração:</h6>
            <ol className="small text-muted">
              <li>Acesse o <a href="https://developer.bling.com.br" target="_blank" rel="noopener noreferrer">Portal do Desenvolvedor Bling</a></li>
              <li>Crie uma nova aplicação ou acesse uma existente</li>
              <li>Copie o Client ID e Client Secret</li>
              <li>Configure a URL de redirect: <code>{window.location.origin}/bling/callback</code></li>
              <li>Cole as credenciais acima e teste a conexão</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Sync Tab Component
 */
function SyncTab({ config, updateConfig }) {
  return (
    <div className="row">
      <div className="col-md-6">
        <div className="card h-100">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-clock me-2"></i>
              Sincronização Automática
            </h6>
          </div>
          <div className="card-body">
            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="autoSync"
                checked={config.sync.autoSync}
                onChange={(e) => updateConfig('sync.autoSync', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="autoSync">
                <strong>Habilitar sincronização automática</strong>
                <div className="text-muted small">
                  Executa sincronização em intervalos regulares
                </div>
              </label>
            </div>

            {config.sync.autoSync && (
              <div className="mb-3">
                <label className="form-label">Intervalo de Sincronização</label>
                <select
                  className="form-select"
                  value={config.sync.syncInterval}
                  onChange={(e) => updateConfig('sync.syncInterval', parseInt(e.target.value))}
                >
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={60}>1 hora</option>
                  <option value={120}>2 horas</option>
                  <option value={240}>4 horas</option>
                  <option value={480}>8 horas</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-md-6">
        <div className="card h-100">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-list me-2"></i>
              Itens para Sincronizar
            </h6>
          </div>
          <div className="card-body">
            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="syncProducts"
                checked={config.sync.syncProducts}
                onChange={(e) => updateConfig('sync.syncProducts', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="syncProducts">
                <strong>Produtos</strong>
                <div className="text-muted small">
                  Importar/atualizar catálogo de produtos
                </div>
              </label>
            </div>

            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="syncOrders"
                checked={config.sync.syncOrders}
                onChange={(e) => updateConfig('sync.syncOrders', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="syncOrders">
                <strong>Pedidos</strong>
                <div className="text-muted small">
                  Enviar pedidos da vitrine para o Bling
                </div>
              </label>
            </div>

            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="syncStock"
                checked={config.sync.syncStock}
                onChange={(e) => updateConfig('sync.syncStock', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="syncStock">
                <strong>Estoque</strong>
                <div className="text-muted small">
                  Manter estoque sincronizado
                </div>
              </label>
            </div>

            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="syncPrices"
                checked={config.sync.syncPrices}
                onChange={(e) => updateConfig('sync.syncPrices', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="syncPrices">
                <strong>Preços</strong>
                <div className="text-muted small">
                  Atualizar preços automaticamente
                </div>
              </label>
            </div>

            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="syncCustomers"
                checked={config.sync.syncCustomers}
                onChange={(e) => updateConfig('sync.syncCustomers', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="syncCustomers">
                <strong>Clientes</strong>
                <div className="text-muted small">
                  Sincronizar dados de clientes
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Webhooks Tab Component
 */
function WebhooksTab({ config, updateConfig }) {
  return (
    <div className="card">
      <div className="card-header">
        <h6 className="mb-0">
          <i className="fas fa-bolt me-2"></i>
          Configuração de Webhooks
        </h6>
      </div>
      <div className="card-body">
        <div className="alert alert-info">
          <i className="fas fa-info-circle me-2"></i>
          <strong>Webhooks</strong> permitem que o Bling notifique automaticamente sobre mudanças,
          mantendo seus dados sempre atualizados em tempo real.
        </div>

        <div className="mb-4 form-check form-switch">
          <input
            type="checkbox"
            className="form-check-input"
            id="webhooksEnabled"
            checked={config.webhooks.enabled}
            onChange={(e) => updateConfig('webhooks.enabled', e.target.checked)}
          />
          <label className="form-check-label" htmlFor="webhooksEnabled">
            <strong>Habilitar Webhooks</strong>
          </label>
        </div>

        {config.webhooks.enabled && (
          <>
            <div className="mb-4">
              <label className="form-label">URL do Webhook</label>
              <div className="input-group">
                <input
                  type="url"
                  className="form-control"
                  value={config.webhooks.url}
                  onChange={(e) => updateConfig('webhooks.url', e.target.value)}
                  placeholder="https://seudominio.com/webhooks/bling"
                />
                <button className="btn btn-outline-secondary" type="button">
                  <i className="fas fa-copy"></i>
                </button>
              </div>
              <small className="form-text text-muted">
                URL que receberá as notificações do Bling
              </small>
            </div>

            <h6 className="mb-3">Eventos para Notificação:</h6>

            <div className="row">
              <div className="col-md-6">
                <div className="mb-3 form-check form-switch">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="productUpdated"
                    checked={config.webhooks.events.productUpdated}
                    onChange={(e) => updateConfig('webhooks.events.productUpdated', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="productUpdated">
                    <strong>Produto Atualizado</strong>
                    <div className="text-muted small">
                      Quando dados do produto são alterados
                    </div>
                  </label>
                </div>

                <div className="mb-3 form-check form-switch">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="stockUpdated"
                    checked={config.webhooks.events.stockUpdated}
                    onChange={(e) => updateConfig('webhooks.events.stockUpdated', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="stockUpdated">
                    <strong>Estoque Atualizado</strong>
                    <div className="text-muted small">
                      Quando quantidade em estoque muda
                    </div>
                  </label>
                </div>
              </div>

              <div className="col-md-6">
                <div className="mb-3 form-check form-switch">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="orderCreated"
                    checked={config.webhooks.events.orderCreated}
                    onChange={(e) => updateConfig('webhooks.events.orderCreated', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="orderCreated">
                    <strong>Pedido Criado</strong>
                    <div className="text-muted small">
                      Quando novo pedido é registrado
                    </div>
                  </label>
                </div>

                <div className="mb-3 form-check form-switch">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="priceUpdated"
                    checked={config.webhooks.events.priceUpdated}
                    onChange={(e) => updateConfig('webhooks.events.priceUpdated', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="priceUpdated">
                    <strong>Preço Atualizado</strong>
                    <div className="text-muted small">
                      Quando preço do produto é alterado
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Mapping Tab Component
 */
function MappingTab({ config, updateConfig, tenantId }) {
  // This would typically load mapping data from API
  const [categories] = useState([
    { bling: 'Eletronicos', vitrine: 'Eletrônicos' },
    { bling: 'Roupas', vitrine: 'Vestuário' }
  ]);

  return (
    <div className="row">
      <div className="col-md-4 mb-4">
        <div className="card h-100">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-tags me-2"></i>
              Categorias
            </h6>
          </div>
          <div className="card-body">
            <p className="small text-muted mb-3">
              Mapeie as categorias do Bling com as da sua vitrine
            </p>
            
            {categories.map((mapping, index) => (
              <div key={index} className="mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div className="flex-grow-1">
                    <div className="small text-muted">Bling:</div>
                    <div className="fw-medium">{mapping.bling}</div>
                  </div>
                  <div className="mx-2">
                    <i className="fas fa-arrow-right text-muted"></i>
                  </div>
                  <div className="flex-grow-1">
                    <div className="small text-muted">Vitrine:</div>
                    <div className="fw-medium">{mapping.vitrine}</div>
                  </div>
                </div>
              </div>
            ))}
            
            <button className="btn btn-outline-primary btn-sm w-100">
              <i className="fas fa-plus me-2"></i>
              Adicionar Mapeamento
            </button>
          </div>
        </div>
      </div>

      <div className="col-md-4 mb-4">
        <div className="card h-100">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-clipboard-list me-2"></i>
              Status de Pedidos
            </h6>
          </div>
          <div className="card-body">
            <p className="small text-muted mb-3">
              Relacione os status entre os sistemas
            </p>
            
            <div className="mb-3">
              <label className="form-label small">Pedido Criado</label>
              <select className="form-select form-select-sm">
                <option>Aguardando Pagamento</option>
                <option>Em Processamento</option>
                <option>Confirmado</option>
              </select>
            </div>
            
            <div className="mb-3">
              <label className="form-label small">Pagamento Confirmado</label>
              <select className="form-select form-select-sm">
                <option>Em Processamento</option>
                <option>Confirmado</option>
                <option>Separação</option>
              </select>
            </div>
            
            <button className="btn btn-outline-primary btn-sm w-100">
              <i className="fas fa-cog me-2"></i>
              Configurar Status
            </button>
          </div>
        </div>
      </div>

      <div className="col-md-4 mb-4">
        <div className="card h-100">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-credit-card me-2"></i>
              Formas de Pagamento
            </h6>
          </div>
          <div className="card-body">
            <p className="small text-muted mb-3">
              Configure as formas de pagamento
            </p>
            
            <div className="mb-3">
              <label className="form-label small">Cartão de Crédito</label>
              <select className="form-select form-select-sm">
                <option>Cartão de Crédito</option>
                <option>Visa/Mastercard</option>
                <option>Financiado</option>
              </select>
            </div>
            
            <div className="mb-3">
              <label className="form-label small">PIX</label>
              <select className="form-select form-select-sm">
                <option>PIX</option>
                <option>Transferência</option>
                <option>Dinheiro</option>
              </select>
            </div>
            
            <button className="btn btn-outline-primary btn-sm w-100">
              <i className="fas fa-plus me-2"></i>
              Adicionar Forma
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Notifications Tab Component
 */
function NotificationsTab({ config, updateConfig }) {
  return (
    <div className="card">
      <div className="card-header">
        <h6 className="mb-0">
          <i className="fas fa-bell me-2"></i>
          Configuração de Notificações
        </h6>
      </div>
      <div className="card-body">
        <div className="mb-4">
          <label className="form-label">Email para Notificações</label>
          <input
            type="email"
            className="form-control"
            value={config.notifications.email}
            onChange={(e) => updateConfig('notifications.email', e.target.value)}
            placeholder="seu@email.com"
          />
          <small className="form-text text-muted">
            Email que receberá as notificações do sistema
          </small>
        </div>

        <h6 className="mb-3">Tipos de Notificação:</h6>

        <div className="row">
          <div className="col-md-6">
            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="syncSuccess"
                checked={config.notifications.syncSuccess}
                onChange={(e) => updateConfig('notifications.syncSuccess', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="syncSuccess">
                <strong>Sincronização Bem-sucedida</strong>
                <div className="text-muted small">
                  Confirmar quando sync completa com sucesso
                </div>
              </label>
            </div>

            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="syncError"
                checked={config.notifications.syncError}
                onChange={(e) => updateConfig('notifications.syncError', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="syncError">
                <strong>Erros de Sincronização</strong>
                <div className="text-muted small">
                  Alertar sobre falhas na sincronização
                </div>
              </label>
            </div>

            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="webhookError"
                checked={config.notifications.webhookError}
                onChange={(e) => updateConfig('notifications.webhookError', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="webhookError">
                <strong>Erros de Webhook</strong>
                <div className="text-muted small">
                  Problemas no recebimento de webhooks
                </div>
              </label>
            </div>
          </div>

          <div className="col-md-6">
            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="lowStock"
                checked={config.notifications.lowStock}
                onChange={(e) => updateConfig('notifications.lowStock', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="lowStock">
                <strong>Estoque Baixo</strong>
                <div className="text-muted small">
                  Avisar quando produtos ficam com pouco estoque
                </div>
              </label>
            </div>

            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="orderStatus"
                checked={config.notifications.orderStatus}
                onChange={(e) => updateConfig('notifications.orderStatus', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="orderStatus">
                <strong>Status de Pedidos</strong>
                <div className="text-muted small">
                  Mudanças importantes no status dos pedidos
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}