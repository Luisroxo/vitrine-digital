import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlug, faCheck, faTimes, faSync, faChartLine, 
  faRefresh, faInfoCircle, faExclamationTriangle, faKey, faExternalLinkAlt 
} from '@fortawesome/free-solid-svg-icons';
import api from '../services/api';

const BlingIntegration = () => {
  const [status, setStatus] = useState({
    connected: false,
    loading: true,
    company: null
  });
  const [syncStatus, setSyncStatus] = useState({
    syncing: false,
    lastSync: null,
    synchronized: 0
  });
  const [authUrl, setAuthUrl] = useState('');

  useEffect(() => {
    checkBlingStatus();
  }, []);

  const checkBlingStatus = async () => {
    try {
      setStatus(prev => ({ ...prev, loading: true }));
      const response = await api.get('/bling/status');
      setStatus({
        connected: response.data.connected,
        loading: false,
        company: response.data.company
      });
    } catch (error) {
      console.error('Erro ao verificar status do Bling:', error);
      setStatus({
        connected: false,
        loading: false,
        company: null
      });
    }
  };

  const getAuthUrl = async () => {
    try {
      const response = await api.get('/bling/auth/url');
      setAuthUrl(response.data.authUrl);
      window.open(response.data.authUrl, '_blank');
    } catch (error) {
      console.error('Erro ao obter URL de autenticação:', error);
      alert('Erro ao gerar URL de autenticação. Verifique as configurações.');
    }
  };

  const syncProducts = async () => {
    try {
      setSyncStatus(prev => ({ ...prev, syncing: true }));
      const response = await api.post('/bling/sync/products');
      
      setSyncStatus({
        syncing: false,
        lastSync: new Date(),
        synchronized: response.data.synchronized
      });

      alert(`Sincronização concluída! ${response.data.synchronized} produtos processados.`);
      
      // Atualiza a lista de produtos na página se necessário
      if (window.location.pathname === '/') {
        window.location.reload();
      }
    } catch (error) {
      console.error('Erro na sincronização:', error);
      setSyncStatus(prev => ({ ...prev, syncing: false }));
      alert('Erro na sincronização. Verifique a conexão com o Bling.');
    }
  };

  const StatusBadge = ({ connected, loading }) => {
    if (loading) {
      return (
        <span className="badge bg-secondary">
          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
          Verificando...
        </span>
      );
    }

    return (
      <span className={`badge ${connected ? 'bg-success' : 'bg-danger'}`}>
        <FontAwesomeIcon icon={connected ? faCheck : faTimes} className="me-2" />
        {connected ? 'Conectado' : 'Desconectado'}
      </span>
    );
  };

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0">
          <FontAwesomeIcon icon={faPlug} className="me-2" />
          Integração Bling ERP
        </h5>
        <StatusBadge connected={status.connected} loading={status.loading} />
      </div>
      
      <div className="card-body">
        {status.loading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Carregando...</span>
            </div>
          </div>
        ) : status.connected ? (
          <div>
            <div className="alert alert-success d-flex align-items-center">
              <FontAwesomeIcon icon={faCheck} className="me-2" />
              <div>
                <strong>Conectado com sucesso!</strong>
                {status.company && <div>Empresa: {status.company}</div>}
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <div className="card bg-light">
                  <div className="card-body text-center">
                    <FontAwesomeIcon icon={faSync} size="2x" className="text-primary mb-3" />
                    <h6>Sincronização de Produtos</h6>
                    <p className="small text-muted">
                      Sincronize produtos do Bling com a vitrine digital
                    </p>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={syncProducts}
                      disabled={syncStatus.syncing}
                    >
                      {syncStatus.syncing ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faSync} className="me-2" />
                          Sincronizar Produtos
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card bg-light">
                  <div className="card-body text-center">
                    <FontAwesomeIcon icon={faChartLine} size="2x" className="text-info mb-3" />
                    <h6>Status da Sincronização</h6>
                    <div className="small">
                      {syncStatus.lastSync ? (
                        <>
                          <div>Última sincronização:</div>
                          <div className="text-muted">
                            {syncStatus.lastSync.toLocaleString('pt-BR')}
                          </div>
                          <div className="mt-2">
                            <span className="badge bg-info">
                              {syncStatus.synchronized} produtos sincronizados
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-muted">Nenhuma sincronização realizada</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="d-flex justify-content-between align-items-center">
                <small className="text-muted">
                  <FontAwesomeIcon icon={faInfoCircle} className="me-1" />
                  A sincronização mantém os produtos atualizados com o ERP Bling
                </small>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={checkBlingStatus}
                >
                  <FontAwesomeIcon icon={faRefresh} className="me-2" />
                  Atualizar Status
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="alert alert-warning d-flex align-items-center">
              <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
              <div>
                <strong>Bling ERP não conectado</strong>
                <div>Configure a integração para sincronizar produtos automaticamente.</div>
              </div>
            </div>

            <div className="text-center py-4">
              <FontAwesomeIcon icon={faPlug} size="3x" className="text-muted mb-3" />
              <h6>Conectar com Bling ERP</h6>
              <p className="text-muted">
                Conecte sua vitrine digital com o sistema Bling ERP para sincronizar 
                produtos, estoques e pedidos automaticamente.
              </p>
              
              <div className="alert alert-info text-start">
                <h6><FontAwesomeIcon icon={faInfoCircle} className="me-2" />Como configurar:</h6>
                <ol className="mb-0">
                  <li>Crie uma aplicação no <a href="https://developer.bling.com.br/aplicativos" target="_blank" rel="noopener noreferrer">Bling Developer</a></li>
                  <li>Configure as variáveis de ambiente BLING_CLIENT_ID e BLING_CLIENT_SECRET</li>
                  <li>Clique no botão abaixo para autorizar a integração</li>
                </ol>
              </div>

              <button
                className="btn btn-primary"
                onClick={getAuthUrl}
              >
                <FontAwesomeIcon icon={faKey} className="me-2" />
                Conectar com Bling
              </button>

              {authUrl && (
                <div className="mt-3">
                  <small className="text-muted">
                    <FontAwesomeIcon icon={faExternalLinkAlt} className="me-1" />
                    Uma nova aba foi aberta para autorização
                  </small>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlingIntegration;