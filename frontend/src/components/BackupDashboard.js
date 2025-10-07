import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHdd, faCloud, faSync, faDownload, faTrash, faPlay, faStop,
  faCheck, faTimes, faExclamationTriangle, faDatabase, faFolder,
  faClock, faChartBar, faFileArchive, faShieldAlt, faHistory
} from '@fortawesome/free-solid-svg-icons';

const BackupDashboard = () => {
  const [backupStatus, setBackupStatus] = useState(null);
  const [backupList, setBackupList] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [executing, setExecuting] = useState(false);
  const [testResults, setTestResults] = useState(null);

  useEffect(() => {
    loadBackupData();
    const interval = setInterval(loadBackupData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadBackupData = async () => {
    try {
      const [statusResponse, listResponse] = await Promise.all([
        fetch('/api/shared/backup/status'),
        fetch('/api/shared/backup/list')
      ]);

      if (statusResponse.ok && listResponse.ok) {
        const statusData = await statusResponse.json();
        const listData = await listResponse.json();
        
        setBackupStatus(statusData.data);
        setBackupList(listData.data);
      }
    } catch (error) {
      console.error('Error loading backup data:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeBackup = async (type = 'manual') => {
    if (executing) return;
    
    setExecuting(true);
    try {
      const response = await fetch('/api/shared/backup/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type })
      });

      if (response.ok) {
        alert(`Backup ${type} iniciado com sucesso!`);
        setTimeout(loadBackupData, 5000); // Refresh after 5 seconds
      } else {
        alert('Erro ao executar backup');
      }
    } catch (error) {
      console.error('Error executing backup:', error);
      alert('Erro ao executar backup');
    } finally {
      setExecuting(false);
    }
  };

  const cleanupBackups = async () => {
    if (executing) return;
    
    if (!window.confirm('Deseja realmente executar a limpeza de backups antigos?')) {
      return;
    }
    
    setExecuting(true);
    try {
      const response = await fetch('/api/shared/backup/cleanup', {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('Limpeza de backups executada com sucesso!');
        loadBackupData();
      } else {
        alert('Erro ao executar limpeza');
      }
    } catch (error) {
      console.error('Error cleaning backups:', error);
      alert('Erro ao executar limpeza');
    } finally {
      setExecuting(false);
    }
  };

  const testSystem = async () => {
    setExecuting(true);
    try {
      const response = await fetch('/api/shared/backup/test', {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setTestResults(data.data);
      } else {
        alert('Erro ao testar sistema');
      }
    } catch (error) {
      console.error('Error testing system:', error);
      alert('Erro ao testar sistema');
    } finally {
      setExecuting(false);
    }
  };

  const downloadBackup = (type, filename) => {
    const url = `/api/shared/backup/download/${type}/${filename}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'completed':
        return <FontAwesomeIcon icon={faCheck} className="text-success" />;
      case 'warning':
        return <FontAwesomeIcon icon={faExclamationTriangle} className="text-warning" />;
      case 'failed':
      case 'unhealthy':
        return <FontAwesomeIcon icon={faTimes} className="text-danger" />;
      default:
        return <FontAwesomeIcon icon={faClock} className="text-muted" />;
    }
  };

  const renderOverview = () => (
    <div>
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <FontAwesomeIcon icon={faHdd} className="text-primary" size="2x" />
              <h5 className="card-title mt-2">Total Backups</h5>
              <h3 className="text-primary">{backupStatus?.statistics?.totalBackups || 0}</h3>
            </div>
          </div>
        </div>
        
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <FontAwesomeIcon icon={faCheck} className="text-success" size="2x" />
              <h5 className="card-title mt-2">Sucessos</h5>
              <h3 className="text-success">{backupStatus?.statistics?.successfulBackups || 0}</h3>
            </div>
          </div>
        </div>
        
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <FontAwesomeIcon icon={faTimes} className="text-danger" size="2x" />
              <h5 className="card-title mt-2">Falhas</h5>
              <h3 className="text-danger">{backupStatus?.statistics?.failedBackups || 0}</h3>
            </div>
          </div>
        </div>
        
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <FontAwesomeIcon icon={faFileArchive} className="text-info" size="2x" />
              <h5 className="card-title mt-2">Tamanho Total</h5>
              <h3 className="text-info">{backupStatus?.statistics?.totalSizeFormatted || '0 Bytes'}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Status do Sistema</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <span>Sistema de Backup</span>
                  <span className="badge bg-success">Ativo</span>
                </div>
              </div>
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <span>Último Backup</span>
                  <span className="text-muted">
                    {backupStatus?.statistics?.lastBackup 
                      ? new Date(backupStatus.statistics.lastBackup).toLocaleString()
                      : 'Nunca'
                    }
                  </span>
                </div>
              </div>
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <span>Taxa de Sucesso</span>
                  <span className="text-success">{backupStatus?.statistics?.successRate || '0%'}</span>
                </div>
              </div>
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <span>Backups Ativos</span>
                  <span className={backupStatus?.statistics?.isActive ? 'text-warning' : 'text-muted'}>
                    {backupStatus?.statistics?.activeBackups?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Configuração</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <span>Armazenamento Local</span>
                  {getStatusIcon(backupStatus?.configuration?.storage?.local ? 'healthy' : 'failed')}
                </div>
              </div>
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <span>Armazenamento S3</span>
                  {getStatusIcon(backupStatus?.configuration?.storage?.s3 ? 'healthy' : 'failed')}
                </div>
              </div>
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <span>Compressão</span>
                  {getStatusIcon(backupStatus?.configuration?.storage?.compression ? 'healthy' : 'failed')}
                </div>
              </div>
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <span>Bancos de Dados</span>
                  <span className="badge bg-info">{backupStatus?.configuration?.databaseCount || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Ações Rápidas</h5>
            </div>
            <div className="card-body">
              <div className="btn-group me-2" role="group">
                <button 
                  className="btn btn-primary"
                  onClick={() => executeBackup('manual')}
                  disabled={executing}
                >
                  <FontAwesomeIcon icon={faPlay} className="me-2" />
                  {executing ? 'Executando...' : 'Backup Manual'}
                </button>
                <button 
                  className="btn btn-warning"
                  onClick={cleanupBackups}
                  disabled={executing}
                >
                  <FontAwesomeIcon icon={faTrash} className="me-2" />
                  Limpeza
                </button>
                <button 
                  className="btn btn-info"
                  onClick={testSystem}
                  disabled={executing}
                >
                  <FontAwesomeIcon icon={faShieldAlt} className="me-2" />
                  Testar Sistema
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBackupList = () => (
    <div>
      {Object.entries(backupList).map(([type, backups]) => (
        <div key={type} className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0 text-capitalize">
              <FontAwesomeIcon icon={faHistory} className="me-2" />
              Backups {type === 'daily' ? 'Diários' : type === 'weekly' ? 'Semanais' : type === 'monthly' ? 'Mensais' : 'Manuais'}
            </h5>
          </div>
          <div className="card-body">
            {backups.length === 0 ? (
              <p className="text-muted">Nenhum backup encontrado</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Arquivo</th>
                      <th>Tamanho</th>
                      <th>Data de Criação</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((backup, index) => (
                      <tr key={index}>
                        <td>
                          <FontAwesomeIcon icon={faFileArchive} className="me-2 text-muted" />
                          {backup.filename}
                        </td>
                        <td>{formatFileSize(backup.size)}</td>
                        <td>{new Date(backup.created).toLocaleString()}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-primary me-2"
                            onClick={() => downloadBackup(backup.type, backup.filename)}
                          >
                            <FontAwesomeIcon icon={faDownload} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderTestResults = () => (
    <div>
      {testResults && (
        <div className="card">
          <div className="card-header">
            <h5 className="mb-0">Resultados do Teste do Sistema</h5>
          </div>
          <div className="card-body">
            <div className="alert alert-info">
              <strong>Status Geral: </strong>
              {getStatusIcon(testResults.systemHealth ? 'healthy' : 'failed')}
              <span className="ms-2">
                {testResults.systemHealth ? 'Todos os sistemas operacionais' : 'Alguns sistemas têm problemas'}
              </span>
            </div>

            <h6>Bancos de Dados:</h6>
            <div className="table-responsive mb-4">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Serviço</th>
                    <th>Status</th>
                    <th>Host</th>
                    <th>Porta</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.databases.map((db, index) => (
                    <tr key={index}>
                      <td>
                        <FontAwesomeIcon icon={faDatabase} className="me-2" />
                        {db.service}
                      </td>
                      <td>{getStatusIcon(db.status)} {db.status}</td>
                      <td>{db.host}</td>
                      <td>{db.port}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h6>Armazenamento:</h6>
            <div className="row">
              <div className="col-md-6">
                <div className="d-flex justify-content-between align-items-center p-2 border rounded">
                  <span>
                    <FontAwesomeIcon icon={faHdd} className="me-2" />
                    Local
                  </span>
                  {getStatusIcon(testResults.storage.local ? 'healthy' : 'failed')}
                </div>
              </div>
              <div className="col-md-6">
                <div className="d-flex justify-content-between align-items-center p-2 border rounded">
                  <span>
                    <FontAwesomeIcon icon={faCloud} className="me-2" />
                    S3
                  </span>
                  {getStatusIcon(testResults.storage.s3 ? 'healthy' : 'failed')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12">
          <h2>
            <FontAwesomeIcon icon={faHdd} className="me-2" />
            Sistema de Backup Automático
          </h2>
          <p className="text-muted">Gerenciamento e monitoramento de backups dos microserviços</p>
        </div>
      </div>

      <div className="row mb-3">
        <div className="col-12">
          <ul className="nav nav-tabs">
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <FontAwesomeIcon icon={faChartBar} className="me-2" />
                Visão Geral
              </button>
            </li>
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'backups' ? 'active' : ''}`}
                onClick={() => setActiveTab('backups')}
              >
                <FontAwesomeIcon icon={faHistory} className="me-2" />
                Lista de Backups
              </button>
            </li>
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'test' ? 'active' : ''}`}
                onClick={() => setActiveTab('test')}
              >
                <FontAwesomeIcon icon={faShieldAlt} className="me-2" />
                Teste do Sistema
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'backups' && renderBackupList()}
          {activeTab === 'test' && renderTestResults()}
        </div>
      </div>
    </div>
  );
};

export default BackupDashboard;