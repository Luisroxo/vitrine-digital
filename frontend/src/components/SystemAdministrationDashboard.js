import React, { useState, useEffect } from 'react';
import { LoadingButton, SkeletonLoader } from '../contexts/LoadingContext';
import { useError } from '../contexts/ErrorContext';
import { MonitoringDashboard } from './MonitoringDashboard';

/**
 * System Administration Dashboard
 * Complete admin interface for system management
 */
export function SystemAdministrationDashboard() {
  const [activeSection, setActiveSection] = useState('overview');
  const [systemInfo, setSystemInfo] = useState({
    status: 'operational',
    uptime: 0,
    services: [],
    resources: {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: 0
    },
    database: {
      connected: false,
      connectionCount: 0,
      queryTime: 0,
      size: 0
    },
    cache: {
      connected: false,
      hitRate: 0,
      keys: 0,
      memory: 0
    }
  });
  
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [backups, setBackups] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  const { showError, showSuccess } = useError();

  useEffect(() => {
    loadSystemData();
  }, []);

  const loadSystemData = async () => {
    try {
      setLoading(true);
      
      const [
        systemData,
        usersData,
        tenantsData,
        logsData,
        backupsData,
        settingsData
      ] = await Promise.all([
        fetchSystemInfo(),
        fetchUsers(),
        fetchTenants(),
        fetchSystemLogs(),
        fetchBackups(),
        fetchSettings()
      ]);

      setSystemInfo(systemData);
      setUsers(usersData);
      setTenants(tenantsData);
      setSystemLogs(logsData);
      setBackups(backupsData);
      setSettings(settingsData);
    } catch (error) {
      showError('Erro ao carregar dados do sistema.', 'admin');
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemInfo = async () => {
    // Mock system info
    return {
      status: 'operational',
      uptime: 2547289, // seconds
      version: '2.1.0',
      environment: 'production',
      region: 'us-east-1',
      services: 5,
      activeUsers: 1247,
      totalTenants: 89,
      resources: {
        cpu: 35.2,
        memory: 62.8,
        disk: 45.1,
        network: 12.5
      },
      database: {
        connected: true,
        connectionCount: 25,
        queryTime: 45,
        size: 2.4, // GB
        queries24h: 45678
      },
      cache: {
        connected: true,
        hitRate: 94.2,
        keys: 12547,
        memory: 512, // MB
        operations24h: 123456
      }
    };
  };

  const fetchUsers = async () => {
    return [
      {
        id: 1,
        name: 'João Silva',
        email: 'joao@empresa.com',
        role: 'admin',
        tenant: 'Empresa ABC',
        lastLogin: new Date(),
        status: 'active',
        loginCount: 156
      },
      {
        id: 2,
        name: 'Maria Santos',
        email: 'maria@loja.com',
        role: 'owner',
        tenant: 'Loja XYZ',
        lastLogin: new Date(Date.now() - 3600000),
        status: 'active',
        loginCount: 89
      }
    ];
  };

  const fetchTenants = async () => {
    return [
      {
        id: 1,
        name: 'Empresa ABC',
        domain: 'empresa-abc.vitrinedigital.com',
        plan: 'Pro',
        status: 'active',
        users: 5,
        products: 250,
        orders: 1247,
        createdAt: new Date('2024-01-15'),
        billingStatus: 'paid'
      },
      {
        id: 2,
        name: 'Loja XYZ',
        domain: 'loja-xyz.vitrinedigital.com',
        plan: 'Basic',
        status: 'active',
        users: 2,
        products: 89,
        orders: 456,
        createdAt: new Date('2024-03-20'),
        billingStatus: 'pending'
      }
    ];
  };

  const fetchSystemLogs = async () => {
    return [
      {
        id: 1,
        timestamp: new Date(),
        level: 'INFO',
        component: 'Auth Service',
        message: 'User login successful',
        userId: 1,
        details: 'User joao@empresa.com logged in from 192.168.1.1'
      },
      {
        id: 2,
        timestamp: new Date(Date.now() - 300000),
        level: 'WARN',
        component: 'Billing Service',
        message: 'Payment retry scheduled',
        details: 'Payment failed for tenant 2, retry in 1 hour'
      }
    ];
  };

  const fetchBackups = async () => {
    return [
      {
        id: 1,
        type: 'database',
        status: 'completed',
        size: '2.4 GB',
        duration: 180,
        createdAt: new Date(),
        location: 's3://backups/db-2024-10-07-03-00.sql.gz'
      },
      {
        id: 2,
        type: 'files',
        status: 'completed',
        size: '150 MB',
        duration: 45,
        createdAt: new Date(Date.now() - 86400000),
        location: 's3://backups/files-2024-10-06-03-00.tar.gz'
      }
    ];
  };

  const fetchSettings = async () => {
    return {
      maintenance: {
        enabled: false,
        message: '',
        scheduledTime: null
      },
      registration: {
        enabled: true,
        requireApproval: false,
        emailDomainWhitelist: []
      },
      billing: {
        gracePeriod: 7, // days
        autoSuspend: true,
        currency: 'BRL'
      },
      notifications: {
        email: 'admin@vitrinedigital.com',
        webhookUrl: '',
        slackChannel: '#alerts'
      }
    };
  };

  const renderSidebarNavigation = () => (
    <div className="col-md-2">
      <div className="list-group">
        <button
          className={`list-group-item list-group-item-action ${activeSection === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveSection('overview')}
        >
          <i className="fas fa-tachometer-alt me-2"></i>
          Visão Geral
        </button>
        
        <button
          className={`list-group-item list-group-item-action ${activeSection === 'monitoring' ? 'active' : ''}`}
          onClick={() => setActiveSection('monitoring')}
        >
          <i className="fas fa-chart-line me-2"></i>
          Monitoramento
        </button>
        
        <button
          className={`list-group-item list-group-item-action ${activeSection === 'users' ? 'active' : ''}`}
          onClick={() => setActiveSection('users')}
        >
          <i className="fas fa-users me-2"></i>
          Usuários
        </button>
        
        <button
          className={`list-group-item list-group-item-action ${activeSection === 'tenants' ? 'active' : ''}`}
          onClick={() => setActiveSection('tenants')}
        >
          <i className="fas fa-building me-2"></i>
          Tenants
        </button>
        
        <button
          className={`list-group-item list-group-item-action ${activeSection === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveSection('logs')}
        >
          <i className="fas fa-file-alt me-2"></i>
          Logs
        </button>
        
        <button
          className={`list-group-item list-group-item-action ${activeSection === 'backups' ? 'active' : ''}`}
          onClick={() => setActiveSection('backups')}
        >
          <i className="fas fa-database me-2"></i>
          Backups
        </button>
        
        <button
          className={`list-group-item list-group-item-action ${activeSection === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveSection('settings')}
        >
          <i className="fas fa-cog me-2"></i>
          Configurações
        </button>
        
        <button
          className={`list-group-item list-group-item-action ${activeSection === 'maintenance' ? 'active' : ''}`}
          onClick={() => setActiveSection('maintenance')}
        >
          <i className="fas fa-wrench me-2"></i>
          Manutenção
        </button>
      </div>
    </div>
  );

  if (loading) {
    return <SkeletonLoader lines={15} />;
  }

  return (
    <div className="system-admin-dashboard">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3>
            <i className="fas fa-shield-alt me-2"></i>
            Administração do Sistema
          </h3>
          <small className="text-muted">
            Painel de controle completo do sistema SaaS
          </small>
        </div>
        
        <div className="d-flex gap-2">
          <LoadingButton
            className="btn btn-outline-primary"
            onClick={loadSystemData}
            loading={loading}
            loadingText="Atualizando..."
          >
            <i className="fas fa-sync me-2"></i>
            Atualizar
          </LoadingButton>
        </div>
      </div>

      {/* System Status Banner */}
      <SystemStatusBanner systemInfo={systemInfo} />

      <div className="row">
        {/* Sidebar Navigation */}
        {renderSidebarNavigation()}

        {/* Main Content */}
        <div className="col-md-10">
          {activeSection === 'overview' && (
            <SystemOverview 
              systemInfo={systemInfo} 
              users={users} 
              tenants={tenants}
              logs={systemLogs.slice(0, 5)}
            />
          )}
          
          {activeSection === 'monitoring' && (
            <MonitoringDashboard />
          )}
          
          {activeSection === 'users' && (
            <UsersManagement users={users} setUsers={setUsers} />
          )}
          
          {activeSection === 'tenants' && (
            <TenantsManagement tenants={tenants} setTenants={setTenants} />
          )}
          
          {activeSection === 'logs' && (
            <SystemLogsManagement logs={systemLogs} />
          )}
          
          {activeSection === 'backups' && (
            <BackupsManagement backups={backups} setBackups={setBackups} />
          )}
          
          {activeSection === 'settings' && (
            <SystemSettings settings={settings} setSettings={setSettings} />
          )}
          
          {activeSection === 'maintenance' && (
            <MaintenanceMode settings={settings} setSettings={setSettings} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * System Status Banner Component
 */
function SystemStatusBanner({ systemInfo }) {
  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusColor = () => {
    switch (systemInfo.status) {
      case 'operational': return 'success';
      case 'degraded': return 'warning';
      case 'maintenance': return 'info';
      case 'outage': return 'danger';
      default: return 'secondary';
    }
  };

  return (
    <div className={`alert alert-${getStatusColor()} mb-4`}>
      <div className="row align-items-center">
        <div className="col-md-3">
          <div className="d-flex align-items-center">
            <i className={`fas fa-circle text-${getStatusColor()} me-2`}></i>
            <div>
              <div className="fw-bold">Status: {systemInfo.status}</div>
              <small>Uptime: {formatUptime(systemInfo.uptime)}</small>
            </div>
          </div>
        </div>
        
        <div className="col-md-9">
          <div className="row text-center">
            <div className="col">
              <div className="fw-bold">{systemInfo.services}</div>
              <small>Serviços Ativos</small>
            </div>
            <div className="col">
              <div className="fw-bold">{systemInfo.activeUsers.toLocaleString('pt-BR')}</div>
              <small>Usuários Ativos</small>
            </div>
            <div className="col">
              <div className="fw-bold">{systemInfo.totalTenants}</div>
              <small>Total Tenants</small>
            </div>
            <div className="col">
              <div className="fw-bold">{systemInfo.resources.cpu}%</div>
              <small>CPU</small>
            </div>
            <div className="col">
              <div className="fw-bold">{systemInfo.resources.memory}%</div>
              <small>Memória</small>
            </div>
            <div className="col">
              <div className="fw-bold">v{systemInfo.version}</div>
              <small>Versão</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * System Overview Component
 */
function SystemOverview({ systemInfo, users, tenants, logs }) {
  return (
    <div className="row">
      {/* Resource Usage Cards */}
      <div className="col-md-6 mb-4">
        <div className="row">
          <div className="col-6 mb-3">
            <div className="card text-center h-100">
              <div className="card-body">
                <i className="fas fa-microchip fa-2x text-primary mb-2"></i>
                <h5>{systemInfo.resources.cpu}%</h5>
                <p className="card-text small">CPU</p>
                <div className="progress" style={{height: '4px'}}>
                  <div 
                    className="progress-bar bg-primary" 
                    style={{width: `${systemInfo.resources.cpu}%`}}
                  ></div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-6 mb-3">
            <div className="card text-center h-100">
              <div className="card-body">
                <i className="fas fa-memory fa-2x text-success mb-2"></i>
                <h5>{systemInfo.resources.memory}%</h5>
                <p className="card-text small">Memória</p>
                <div className="progress" style={{height: '4px'}}>
                  <div 
                    className="progress-bar bg-success" 
                    style={{width: `${systemInfo.resources.memory}%`}}
                  ></div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-6">
            <div className="card text-center h-100">
              <div className="card-body">
                <i className="fas fa-hdd fa-2x text-warning mb-2"></i>
                <h5>{systemInfo.resources.disk}%</h5>
                <p className="card-text small">Disco</p>
                <div className="progress" style={{height: '4px'}}>
                  <div 
                    className="progress-bar bg-warning" 
                    style={{width: `${systemInfo.resources.disk}%`}}
                  ></div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-6">
            <div className="card text-center h-100">
              <div className="card-body">
                <i className="fas fa-network-wired fa-2x text-info mb-2"></i>
                <h5>{systemInfo.resources.network}</h5>
                <p className="card-text small">Rede (MB/s)</p>
                <div className="progress" style={{height: '4px'}}>
                  <div 
                    className="progress-bar bg-info" 
                    style={{width: `${Math.min(systemInfo.resources.network * 4, 100)}%`}}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Database & Cache Status */}
      <div className="col-md-6 mb-4">
        <div className="row">
          <div className="col-12 mb-3">
            <div className="card">
              <div className="card-header">
                <h6 className="mb-0">
                  <i className="fas fa-database me-2"></i>
                  Database PostgreSQL
                </h6>
              </div>
              <div className="card-body">
                <div className="row small">
                  <div className="col-6">
                    <div className="d-flex justify-content-between">
                      <span>Status:</span>
                      <span className="text-success">
                        <i className="fas fa-check-circle"></i> Conectado
                      </span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Conexões:</span>
                      <span>{systemInfo.database.connectionCount}/100</span>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="d-flex justify-content-between">
                      <span>Tempo Query:</span>
                      <span>{systemInfo.database.queryTime}ms</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Tamanho:</span>
                      <span>{systemInfo.database.size} GB</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h6 className="mb-0">
                  <i className="fas fa-bolt me-2"></i>
                  Cache Redis
                </h6>
              </div>
              <div className="card-body">
                <div className="row small">
                  <div className="col-6">
                    <div className="d-flex justify-content-between">
                      <span>Status:</span>
                      <span className="text-success">
                        <i className="fas fa-check-circle"></i> Conectado
                      </span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Hit Rate:</span>
                      <span>{systemInfo.cache.hitRate}%</span>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="d-flex justify-content-between">
                      <span>Chaves:</span>
                      <span>{systemInfo.cache.keys.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Memória:</span>
                      <span>{systemInfo.cache.memory} MB</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="col-md-8 mb-4">
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-clock me-2"></i>
              Atividade Recente do Sistema
            </h6>
          </div>
          <div className="card-body">
            {logs.map(log => (
              <div key={log.id} className="d-flex align-items-start mb-3">
                <div className={`badge bg-${log.level === 'ERROR' ? 'danger' : log.level === 'WARN' ? 'warning' : 'info'} me-3`}>
                  {log.level}
                </div>
                <div className="flex-grow-1">
                  <div className="fw-medium">{log.component}</div>
                  <div className="small text-muted">{log.message}</div>
                  <div className="small text-muted">
                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="col-md-4 mb-4">
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-chart-bar me-2"></i>
              Estatísticas Rápidas
            </h6>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <div className="d-flex justify-content-between">
                <span>Usuários Online:</span>
                <span className="fw-bold text-success">
                  {users.filter(u => u.status === 'active').length}
                </span>
              </div>
            </div>
            
            <div className="mb-3">
              <div className="d-flex justify-content-between">
                <span>Tenants Ativos:</span>
                <span className="fw-bold text-primary">
                  {tenants.filter(t => t.status === 'active').length}
                </span>
              </div>
            </div>
            
            <div className="mb-3">
              <div className="d-flex justify-content-between">
                <span>Queries DB/24h:</span>
                <span className="fw-bold">
                  {systemInfo.database.queries24h?.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
            
            <div className="mb-3">
              <div className="d-flex justify-content-between">
                <span>Ops Cache/24h:</span>
                <span className="fw-bold">
                  {systemInfo.cache.operations24h?.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
            
            <hr />
            
            <div className="text-center">
              <small className="text-muted">
                Ambiente: <span className="fw-bold">{systemInfo.environment}</span><br />
                Região: <span className="fw-bold">{systemInfo.region}</span>
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Users Management Component
 */
function UsersManagement({ users, setUsers }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="card">
      <div className="card-header">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="fas fa-users me-2"></i>
            Gerenciamento de Usuários
          </h5>
          
          <div className="d-flex gap-2">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Buscar usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '200px' }}
            />
            
            <select
              className="form-select form-select-sm"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="all">Todos os Roles</option>
              <option value="admin">Administradores</option>
              <option value="owner">Proprietários</option>
              <option value="user">Usuários</option>
            </select>
          </div>
        </div>
      </div>
      <div className="card-body">
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Tenant</th>
                <th>Role</th>
                <th>Status</th>
                <th>Último Login</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="d-flex align-items-center">
                      <div className="avatar bg-primary text-white rounded-circle me-3" style={{width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="fw-medium">{user.name}</div>
                        <small className="text-muted">{user.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{user.tenant}</td>
                  <td>
                    <span className={`badge bg-${user.role === 'admin' ? 'danger' : user.role === 'owner' ? 'warning' : 'secondary'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge bg-${user.status === 'active' ? 'success' : 'secondary'}`}>
                      {user.status}
                    </span>
                  </td>
                  <td>
                    <small>{new Date(user.lastLogin).toLocaleString('pt-BR')}</small>
                  </td>
                  <td>
                    <div className="btn-group btn-group-sm">
                      <button 
                        className="btn btn-outline-primary"
                        onClick={() => setSelectedUser(user)}
                      >
                        <i className="fas fa-eye"></i>
                      </button>
                      <button className="btn btn-outline-secondary">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button className="btn btn-outline-danger">
                        <i className="fas fa-ban"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Tenants Management Component
 */
function TenantsManagement({ tenants, setTenants }) {
  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">
          <i className="fas fa-building me-2"></i>
          Gerenciamento de Tenants
        </h5>
      </div>
      <div className="card-body">
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Domínio</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Usuários</th>
                <th>Produtos</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(tenant => (
                <tr key={tenant.id}>
                  <td>
                    <div className="fw-medium">{tenant.name}</div>
                    <small className="text-muted">ID: {tenant.id}</small>
                  </td>
                  <td>
                    <a href={`https://${tenant.domain}`} target="_blank" rel="noopener noreferrer">
                      {tenant.domain}
                    </a>
                  </td>
                  <td>
                    <span className={`badge bg-${tenant.plan === 'Pro' ? 'primary' : 'secondary'}`}>
                      {tenant.plan}
                    </span>
                  </td>
                  <td>
                    <span className={`badge bg-${tenant.status === 'active' ? 'success' : 'warning'}`}>
                      {tenant.status}
                    </span>
                  </td>
                  <td>{tenant.users}</td>
                  <td>{tenant.products.toLocaleString('pt-BR')}</td>
                  <td>
                    <small>{new Date(tenant.createdAt).toLocaleDateString('pt-BR')}</small>
                  </td>
                  <td>
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-outline-primary">
                        <i className="fas fa-eye"></i>
                      </button>
                      <button className="btn btn-outline-secondary">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button className="btn btn-outline-danger">
                        <i className="fas fa-pause"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * System Logs Management Component
 */
function SystemLogsManagement({ logs }) {
  const [logLevel, setLogLevel] = useState('all');
  
  return (
    <div className="card">
      <div className="card-header">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="fas fa-file-alt me-2"></i>
            Logs do Sistema
          </h5>
          
          <select
            className="form-select form-select-sm"
            value={logLevel}
            onChange={(e) => setLogLevel(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">Todos os Níveis</option>
            <option value="ERROR">Erros</option>
            <option value="WARN">Avisos</option>
            <option value="INFO">Informações</option>
          </select>
        </div>
      </div>
      <div className="card-body">
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {logs.map(log => (
            <div key={log.id} className="border-bottom pb-2 mb-2">
              <div className="d-flex justify-content-between align-items-start">
                <div className="d-flex align-items-center">
                  <span className={`badge bg-${log.level === 'ERROR' ? 'danger' : log.level === 'WARN' ? 'warning' : 'info'} me-2`}>
                    {log.level}
                  </span>
                  <strong>{log.component}</strong>
                </div>
                <small className="text-muted">
                  {new Date(log.timestamp).toLocaleString('pt-BR')}
                </small>
              </div>
              <div className="mt-1">
                <div>{log.message}</div>
                {log.details && (
                  <small className="text-muted">{log.details}</small>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Backups Management Component
 */
function BackupsManagement({ backups, setBackups }) {
  return (
    <div className="row">
      <div className="col-12 mb-4">
        <div className="card">
          <div className="card-header">
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <i className="fas fa-database me-2"></i>
                Gerenciamento de Backups
              </h5>
              
              <button className="btn btn-primary">
                <i className="fas fa-plus me-2"></i>
                Novo Backup
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Status</th>
                    <th>Tamanho</th>
                    <th>Duração</th>
                    <th>Criado em</th>
                    <th>Localização</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map(backup => (
                    <tr key={backup.id}>
                      <td>
                        <i className={`fas ${backup.type === 'database' ? 'fa-database' : 'fa-folder'} me-2`}></i>
                        {backup.type}
                      </td>
                      <td>
                        <span className={`badge bg-${backup.status === 'completed' ? 'success' : backup.status === 'running' ? 'warning' : 'danger'}`}>
                          {backup.status}
                        </span>
                      </td>
                      <td>{backup.size}</td>
                      <td>{backup.duration}s</td>
                      <td>{new Date(backup.createdAt).toLocaleString('pt-BR')}</td>
                      <td>
                        <small className="text-muted font-monospace">
                          {backup.location}
                        </small>
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary">
                            <i className="fas fa-download"></i>
                          </button>
                          <button className="btn btn-outline-danger">
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
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
}

/**
 * System Settings Component
 */
function SystemSettings({ settings, setSettings }) {
  const { showSuccess } = useError();
  
  const handleSave = () => {
    // Save settings logic here
    showSuccess('Configurações salvas com sucesso!');
  };
  
  return (
    <div className="row">
      <div className="col-md-6 mb-4">
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-user-plus me-2"></i>
              Configurações de Registro
            </h6>
          </div>
          <div className="card-body">
            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="registrationEnabled"
                checked={settings.registration?.enabled}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  registration: { ...prev.registration, enabled: e.target.checked }
                }))}
              />
              <label className="form-check-label" htmlFor="registrationEnabled">
                <strong>Permitir novos registros</strong>
              </label>
            </div>
            
            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="requireApproval"
                checked={settings.registration?.requireApproval}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  registration: { ...prev.registration, requireApproval: e.target.checked }
                }))}
              />
              <label className="form-check-label" htmlFor="requireApproval">
                <strong>Requerer aprovação manual</strong>
              </label>
            </div>
          </div>
        </div>
      </div>
      
      <div className="col-md-6 mb-4">
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-credit-card me-2"></i>
              Configurações de Billing
            </h6>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label">Período de Carência (dias)</label>
              <input
                type="number"
                className="form-control"
                value={settings.billing?.gracePeriod}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  billing: { ...prev.billing, gracePeriod: parseInt(e.target.value) }
                }))}
              />
            </div>
            
            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="autoSuspend"
                checked={settings.billing?.autoSuspend}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  billing: { ...prev.billing, autoSuspend: e.target.checked }
                }))}
              />
              <label className="form-check-label" htmlFor="autoSuspend">
                <strong>Suspender automaticamente por não pagamento</strong>
              </label>
            </div>
          </div>
        </div>
      </div>
      
      <div className="col-12">
        <div className="d-flex justify-content-end">
          <LoadingButton
            className="btn btn-primary"
            onClick={handleSave}
          >
            <i className="fas fa-save me-2"></i>
            Salvar Configurações
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Maintenance Mode Component
 */
function MaintenanceMode({ settings, setSettings }) {
  const { showSuccess, showError } = useError();
  
  const toggleMaintenance = () => {
    const newState = !settings.maintenance?.enabled;
    
    setSettings(prev => ({
      ...prev,
      maintenance: { ...prev.maintenance, enabled: newState }
    }));
    
    if (newState) {
      showError('Sistema entrou em modo de manutenção.', 'maintenance');
    } else {
      showSuccess('Sistema saiu do modo de manutenção.');
    }
  };
  
  return (
    <div className="row">
      <div className="col-md-8 mx-auto">
        <div className="card">
          <div className="card-header">
            <h5 className="mb-0">
              <i className="fas fa-wrench me-2"></i>
              Modo de Manutenção
            </h5>
          </div>
          <div className="card-body text-center">
            <div className="mb-4">
              <i className={`fas fa-power-off fa-4x mb-3 text-${settings.maintenance?.enabled ? 'warning' : 'success'}`}></i>
              <h4>
                Status: {settings.maintenance?.enabled ? 'Ativo' : 'Inativo'}
              </h4>
              <p className="text-muted">
                {settings.maintenance?.enabled 
                  ? 'O sistema está em modo de manutenção. Usuários não podem acessar.'
                  : 'O sistema está operacional normalmente.'
                }
              </p>
            </div>
            
            <div className="mb-4">
              <label className="form-label">Mensagem de Manutenção</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Digite a mensagem que será exibida aos usuários..."
                value={settings.maintenance?.message || ''}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  maintenance: { ...prev.maintenance, message: e.target.value }
                }))}
              />
            </div>
            
            <button
              className={`btn btn-lg ${settings.maintenance?.enabled ? 'btn-success' : 'btn-warning'}`}
              onClick={toggleMaintenance}
            >
              <i className={`fas ${settings.maintenance?.enabled ? 'fa-play' : 'fa-pause'} me-2`}></i>
              {settings.maintenance?.enabled ? 'Desativar Manutenção' : 'Ativar Manutenção'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}