import React, { useState, useEffect } from "react";

const SuperAdmin = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [metrics, setMetrics] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showEditModal, setShowEditModal] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    document: '',
    state_registration: '',
    contact_person: '',
    address: '',
    plan: 'pro',
    client_type: 'supplier',
    services: {
      implantacao: false,
      erp_bling: false,
      crm: false,
      gestao_marketplaces: false
    }
  });

  useEffect(() => {
    loadDashboardData();
    loadSuppliers();
  }, []);

  // Dados fictícios para demonstração
  const mockSuppliers = [
    // Fornecedores (10)
    { id: 1, name: 'TechFlow Solutions', email: 'contato@techflow.com.br', slug: 'techflow', tenant_status: 'active', bling_status: 'connected', tenant_plan: 'pro', plan_value: 399, created_at: '2024-01-15', client_type: 'supplier' },
    { id: 2, name: 'Digital Innovations', email: 'admin@digitalinnov.com.br', slug: 'digitalinnov', tenant_status: 'active', bling_status: 'connected', tenant_plan: 'pro', plan_value: 399, created_at: '2024-02-03', client_type: 'supplier' },
    { id: 3, name: 'Smart Systems Corp', email: 'info@smartsystems.com.br', slug: 'smartsystems', tenant_status: 'pending', bling_status: 'pending', tenant_plan: 'pro', plan_value: 399, created_at: '2024-03-10', client_type: 'supplier' },
    { id: 4, name: 'Cloud Dynamics', email: 'suporte@clouddynamics.com.br', slug: 'clouddynamics', tenant_status: 'active', bling_status: 'connected', tenant_plan: 'pro', plan_value: 399, created_at: '2024-01-28', client_type: 'supplier' },
    { id: 5, name: 'NextGen Technologies', email: 'comercial@nextgen.com.br', slug: 'nextgen', tenant_status: 'active', bling_status: 'not_connected', tenant_plan: 'pro', plan_value: 399, created_at: '2024-02-14', client_type: 'supplier' },
    { id: 6, name: 'Alpha Software', email: 'vendas@alphasoft.com.br', slug: 'alphasoft', tenant_status: 'active', bling_status: 'connected', tenant_plan: 'pro', plan_value: 399, created_at: '2024-01-05', client_type: 'supplier' },
    { id: 7, name: 'Beta Industries', email: 'contato@betaind.com.br', slug: 'betaind', tenant_status: 'suspended', bling_status: 'not_connected', tenant_plan: 'pro', plan_value: 399, created_at: '2024-03-20', client_type: 'supplier' },
    { id: 8, name: 'Omega Solutions', email: 'admin@omegasol.com.br', slug: 'omegasol', tenant_status: 'active', bling_status: 'connected', tenant_plan: 'pro', plan_value: 399, created_at: '2024-02-25', client_type: 'supplier' },
    { id: 9, name: 'Gamma Tech', email: 'info@gammatech.com.br', slug: 'gammatech', tenant_status: 'active', bling_status: 'pending', tenant_plan: 'pro', plan_value: 399, created_at: '2024-03-08', client_type: 'supplier' },
    { id: 10, name: 'Delta Systems', email: 'suporte@deltasys.com.br', slug: 'deltasys', tenant_status: 'pending', bling_status: 'not_connected', tenant_plan: 'pro', plan_value: 399, created_at: '2024-03-15', client_type: 'supplier' },
    
    // Clientes/Lojistas (20)
    { id: 11, name: 'Loja Bella Vista', email: 'contato@bellavista.com.br', slug: 'bellavista', tenant_status: 'active', bling_status: 'connected', tenant_plan: 'starter', plan_value: 49, created_at: '2024-01-10', client_type: 'retailer' },
    { id: 12, name: 'Boutique Elegance', email: 'admin@elegance.com.br', slug: 'elegance', tenant_status: 'active', bling_status: 'connected', tenant_plan: 'starter', plan_value: 49, created_at: '2024-01-12', client_type: 'retailer' },
    { id: 13, name: 'Casa & Decoração', email: 'vendas@casadecor.com.br', slug: 'casadecor', tenant_status: 'active', bling_status: 'not_connected', tenant_plan: 'starter', plan_value: 49, created_at: '2024-01-18', client_type: 'retailer' },
    { id: 14, name: 'ModaStyle Store', email: 'contato@modastyle.com.br', slug: 'modastyle', tenant_status: 'pending', bling_status: 'pending', tenant_plan: 'starter', plan_value: 49, created_at: '2024-02-01', client_type: 'retailer' },
    { id: 15, name: 'TechGadgets Loja', email: 'info@techgadgets.com.br', slug: 'techgadgets', tenant_status: 'active', bling_status: 'connected', tenant_plan: 'starter', plan_value: 49, created_at: '2024-02-05', client_type: 'retailer' },
    { id: 16, name: 'BeautyCenter', email: 'admin@beautycenter.com.br', slug: 'beautycenter', tenant_status: 'active', bling_status: 'connected', tenant_plan: 'starter', plan_value: 49, created_at: '2024-02-08', client_type: 'retailer' },
    { id: 17, name: 'Sportland', email: 'vendas@sportland.com.br', slug: 'sportland', tenant_status: 'active', bling_status: 'not_connected', tenant_plan: 'starter', plan_value: 49, created_at: '2024-02-12', client_type: 'retailer' },
    { id: 18, name: 'Kids Paradise', email: 'contato@kidsparadise.com.br', slug: 'kidsparadise', tenant_status: 'suspended', bling_status: 'not_connected', tenant_plan: 'starter', plan_value: 49, created_at: '2024-02-15', client_type: 'retailer' },
    { id: 19, name: 'Pet Shop Amigo', email: 'info@petamigo.com.br', slug: 'petamigo', tenant_status: 'active', bling_status: 'pending', tenant_plan: 'starter', plan_value: 49, created_at: '2024-02-18', client_type: 'retailer' },
    { id: 20, name: 'Garden Center', email: 'admin@gardencenter.com.br', slug: 'gardencenter', tenant_status: 'active', bling_status: 'connected', tenant_plan: 'starter', plan_value: 49, created_at: '2024-02-22', client_type: 'retailer' },
    { id: 21, name: 'Auto Parts Pro', email: 'vendas@autoparts.com.br', slug: 'autoparts', tenant_status: 'active', bling_status: 'connected', tenant_plan: 'starter', plan_value: 49, created_at: '2024-02-25', client_type: 'retailer' },
    { id: 22, name: 'Book Corner', email: 'contato@bookcorner.com.br', slug: 'bookcorner', tenant_status: 'pending', bling_status: 'not_connected', tenant_plan: 'starter', plan_value: 49, created_at: '2024-03-01', client_type: 'retailer' },
    { id: 23, name: 'Música & Arte', email: 'info@musicaarte.com.br', slug: 'musicaarte', tenant_status: 'active', bling_status: 'pending', tenant_plan: 'starter', plan_value: 49, created_at: '2024-03-03', client_type: 'retailer' },
    { id: 24, name: 'Health Store', email: 'admin@healthstore.com.br', slug: 'healthstore', tenant_status: 'active', bling_status: 'connected', tenant_plan: 'starter', plan_value: 49, created_at: '2024-03-05', client_type: 'retailer' },
    { id: 25, name: 'Game Zone', email: 'vendas@gamezone.com.br', slug: 'gamezone', tenant_status: 'active', bling_status: 'not_connected', tenant_plan: 'starter', plan_value: 49, created_at: '2024-03-08', client_type: 'retailer' },
    { id: 26, name: 'Crafts & Arts', email: 'contato@craftsarts.com.br', slug: 'craftsarts', tenant_status: 'active', bling_status: 'connected', tenant_plan: 'starter', plan_value: 49, created_at: '2024-03-10', client_type: 'retailer' },
    { id: 27, name: 'Office Supply', email: 'info@officesupply.com.br', slug: 'officesupply', tenant_status: 'suspended', bling_status: 'not_connected', tenant_plan: 'starter', plan_value: 49, created_at: '2024-03-12', client_type: 'retailer' },
    { id: 28, name: 'Fresh Market', email: 'admin@freshmarket.com.br', slug: 'freshmarket', tenant_status: 'active', bling_status: 'pending', tenant_plan: 'starter', plan_value: 49, created_at: '2024-03-15', client_type: 'retailer' },
    { id: 29, name: 'Jewelry Palace', email: 'vendas@jewelrypalace.com.br', slug: 'jewelrypalace', tenant_status: 'active', bling_status: 'connected', tenant_plan: 'starter', plan_value: 49, created_at: '2024-03-18', client_type: 'retailer' },
    { id: 30, name: 'Outdoor Adventure', email: 'contato@outdoor.com.br', slug: 'outdoor', tenant_status: 'pending', bling_status: 'not_connected', tenant_plan: 'starter', plan_value: 49, created_at: '2024-03-20', client_type: 'retailer' }
  ];

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/super-admin/metrics');
      const data = await response.json();
      
      if (data.success) {
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
      // Usar dados fictícios quando API não disponível
      const suppliers = mockSuppliers.filter(s => s.client_type === 'supplier');
      const retailers = mockSuppliers.filter(s => s.client_type === 'retailer');
      const activeSuppliers = suppliers.filter(s => s.tenant_status === 'active');
      const activeRetailers = retailers.filter(s => s.tenant_status === 'active');
      const totalMrr = (activeSuppliers.length * 399) + (activeRetailers.length * 49);
      
      setMetrics({
        suppliers: {
          total: mockSuppliers.length,
          active: activeSuppliers.length + activeRetailers.length,
          pending: mockSuppliers.filter(s => s.tenant_status === 'pending').length
        },
        revenue: {
          total_mrr: totalMrr
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await fetch('/api/super-admin/suppliers');
      const data = await response.json();
      
      if (data.success) {
        setSuppliers(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
      // Usar dados fictícios quando API não disponível
      setSuppliers(mockSuppliers);
    }
  };

  const formatPrice = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleServiceChange = (e) => {
    const { name, checked } = e.target;
    const serviceName = name.split('.')[1];
    setFormData(prev => ({
      ...prev,
      services: {
        ...prev.services,
        [serviceName]: checked
      }
    }));
  };

  const handleSubmitSupplier = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/super-admin/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Cliente cadastrado com sucesso!');
        setFormData({
          name: '',
          email: '',
          phone: '',
          company_name: '',
          document: '',
          state_registration: '',
          contact_person: '',
          address: '',
          plan: 'pro',
          client_type: 'supplier',
          services: {
            implantacao: false,
            erp_bling: false,
            crm: false,
            gestao_marketplaces: false
          }
        });
        setActiveTab('suppliers');
        loadSuppliers();
        loadDashboardData();
      } else {
        alert('Erro ao cadastrar cliente: ' + data.message);
      }
    } catch (error) {
      console.error('Erro ao cadastrar cliente:', error);
      alert('Erro ao cadastrar cliente');
    } finally {
      setSubmitting(false);
    }
  };

  const renderDashboard = () => (
    <div className="row">
      <div className="col-12 mb-4">
        <div className="row">
          <div className="col-lg-6 col-md-6 mb-4">
            <div className="card bg-success text-white h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <div>
                    <h6 className="card-title">💰 MRR Total</h6>
                    <h3 className="mb-0">{formatPrice(metrics.revenue?.total_mrr || 0)}</h3>
                    <small>Receita mensal recorrente</small>
                  </div>
                  <div className="align-self-center">
                    <i className="fas fa-money-bill-wave fa-2x"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-6 col-md-6 mb-4">
            <div className="card bg-primary text-white h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <div>
                    <h6 className="card-title">👥 Total de Clientes</h6>
                    <h3 className="mb-0">{metrics.suppliers?.total || 0}</h3>
                    <small>{metrics.suppliers?.active || 0} ativos • {metrics.suppliers?.pending || 0} pendentes</small>
                  </div>
                  <div className="align-self-center">
                    <i className="fas fa-users fa-2x"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-12">
        <div className="card">
          <div className="card-header">
            <h5 className="mb-0">⚡ Ações Rápidas</h5>
          </div>
          <div className="card-body">
            <div className="d-grid gap-2">
              <button 
                className="btn btn-outline-primary"
                onClick={() => setActiveTab('suppliers')}
              >
                <i className="fas fa-users me-2"></i>
                Gerenciar Clientes ({metrics.suppliers?.total || 0})
              </button>
              <button 
                className="btn btn-outline-info"
                onClick={() => loadDashboardData()}
              >
                <i className="fas fa-sync-alt me-2"></i>
                Atualizar Dados
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSuppliers = () => {
    const supplierData = suppliers.filter(s => s.client_type === 'supplier');
    
    const handleRowClick = (supplierId) => {
      setExpandedRow(expandedRow === supplierId ? null : supplierId);
    };
    
    return (
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="fas fa-building me-2"></i>
            Fornecedores da Plataforma ({supplierData.length})
          </h5>
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => setActiveTab('cadastro')}
          >
            <i className="fas fa-plus me-1"></i>
            Novo Cliente
          </button>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Domínio</th>
                  <th>Status</th>
                  <th>Status Bling</th>
                  <th>Plano</th>
                  <th>Valor</th>
                  <th>Criado em</th>
                  <th className="text-center">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {supplierData.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-4">
                      <div className="text-muted">
                        <i className="fas fa-store fa-2x mb-2"></i>
                        <p>Nenhum fornecedor cadastrado ainda</p>
                        <div className="mt-3">
                          <button 
                            className="btn btn-primary btn-sm" 
                            onClick={() => setActiveTab('cadastro')}
                          >
                            <i className="fas fa-plus me-1"></i>
                            Cadastrar Novo Fornecedor
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  supplierData.map(supplier => (
                    <React.Fragment key={supplier.id}>
                      <tr 
                        className={`cursor-pointer ${expandedRow === supplier.id ? 'table-active' : ''}`}
                        onClick={() => handleRowClick(supplier.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div>
                            <strong>{supplier.name}</strong>
                            <br />
                            <small className="text-muted">{supplier.email}</small>
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-info">{supplier.slug}.hub360plus.com</span>
                        </td>
                        <td>
                          <span className={`badge bg-${supplier.tenant_status === 'active' ? 'success' : 
                            supplier.tenant_status === 'pending' ? 'warning' : 'danger'}`}>
                            {supplier.tenant_status === 'active' ? 'Ativo' : 
                             supplier.tenant_status === 'pending' ? 'Pendente' : 'Suspenso'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge bg-${supplier.bling_status === 'connected' ? 'success' : 
                            supplier.bling_status === 'pending' ? 'warning' : 'secondary'}`}>
                            {supplier.bling_status === 'connected' ? 'Conectado' : 
                             supplier.bling_status === 'pending' ? 'Pendente' : 'Não conectado'}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-primary">{supplier.tenant_plan || 'Sem plano'}</span>
                        </td>
                        <td>{formatPrice(supplier.plan_value || 0)}</td>
                        <td>{formatDate(supplier.created_at)}</td>
                        <td className="text-center">
                          <i className={`fas fa-chevron-${expandedRow === supplier.id ? 'up' : 'down'}`}></i>
                        </td>
                      </tr>
                      {expandedRow === supplier.id && (
                        <tr>
                          <td colSpan="8" className="p-0">
                            <div className="bg-light border-top p-4 expandable-panel">
                              <div className="row">
                                <div className="col-md-8">
                                  <h6 className="mb-3">
                                    <i className="fas fa-info-circle me-2"></i>
                                    Detalhes Completos - {supplier.name}
                                  </h6>
                                  <div className="row">
                                    <div className="col-md-6 mb-3">
                                      <strong>📧 Email:</strong>
                                      <br />
                                      <span className="text-muted">{supplier.email}</span>
                                    </div>
                                    <div className="col-md-6 mb-3">
                                      <strong>🌐 Domínio:</strong>
                                      <br />
                                      <span className="text-muted">{supplier.slug}.hub360plus.com</span>
                                    </div>
                                    <div className="col-md-6 mb-3">
                                      <strong>📋 Plano:</strong>
                                      <br />
                                      <span className="badge bg-primary me-2">{supplier.tenant_plan}</span>
                                      <span className="text-success fw-bold">{formatPrice(supplier.plan_value)}/mês</span>
                                    </div>
                                    <div className="col-md-6 mb-3">
                                      <strong>📅 Criado em:</strong>
                                      <br />
                                      <span className="text-muted">{formatDate(supplier.created_at)}</span>
                                    </div>
                                    <div className="col-md-6 mb-3">
                                      <strong>🔄 Status Tenant:</strong>
                                      <br />
                                      <span className={`badge bg-${supplier.tenant_status === 'active' ? 'success' : 
                                        supplier.tenant_status === 'pending' ? 'warning' : 'danger'}`}>
                                        {supplier.tenant_status === 'active' ? 'Ativo' : 
                                         supplier.tenant_status === 'pending' ? 'Pendente' : 'Suspenso'}
                                      </span>
                                    </div>
                                    <div className="col-md-6 mb-3">
                                      <strong>🔗 Status Bling:</strong>
                                      <br />
                                      <span className={`badge bg-${supplier.bling_status === 'connected' ? 'success' : 
                                        supplier.bling_status === 'pending' ? 'warning' : 'secondary'}`}>
                                        {supplier.bling_status === 'connected' ? 'Conectado' : 
                                         supplier.bling_status === 'pending' ? 'Pendente' : 'Não conectado'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="col-md-4">
                                  <h6 className="mb-3">
                                    <i className="fas fa-cogs me-2"></i>
                                    Ações Disponíveis
                                  </h6>
                                  <div className="d-grid gap-2 action-buttons">
                                    <button 
                                      className="btn btn-outline-primary btn-sm"
                                      onClick={() => handleEdit(supplier)}
                                      disabled={actionLoading === supplier.id}
                                    >
                                      <i className="fas fa-edit me-2"></i>
                                      Editar Dados
                                    </button>
                                    <button 
                                      className="btn btn-outline-info btn-sm"
                                      onClick={() => handleAccessPanel(supplier)}
                                      disabled={actionLoading === supplier.id}
                                    >
                                      <i className="fas fa-eye me-2"></i>
                                      Acessar Painel
                                    </button>
                                    {supplier.tenant_status === 'active' ? (
                                      <button 
                                        className="btn btn-outline-warning btn-sm"
                                        onClick={() => handleSuspendReactivate(supplier)}
                                        disabled={actionLoading === supplier.id}
                                      >
                                        {actionLoading === supplier.id ? (
                                          <>
                                            <i className="fas fa-spinner fa-spin me-2"></i>
                                            Suspendendo...
                                          </>
                                        ) : (
                                          <>
                                            <i className="fas fa-pause me-2"></i>
                                            Suspender Conta
                                          </>
                                        )}
                                      </button>
                                    ) : (
                                      <button 
                                        className="btn btn-outline-success btn-sm"
                                        onClick={() => handleSuspendReactivate(supplier)}
                                        disabled={actionLoading === supplier.id}
                                      >
                                        {actionLoading === supplier.id ? (
                                          <>
                                            <i className="fas fa-spinner fa-spin me-2"></i>
                                            Reativando...
                                          </>
                                        ) : (
                                          <>
                                            <i className="fas fa-play me-2"></i>
                                            Reativar Conta
                                          </>
                                        )}
                                      </button>
                                    )}
                                    <button 
                                      className="btn btn-outline-secondary btn-sm"
                                      onClick={() => handleResetBling(supplier)}
                                      disabled={actionLoading === supplier.id}
                                    >
                                      {actionLoading === supplier.id ? (
                                        <>
                                          <i className="fas fa-spinner fa-spin me-2"></i>
                                          Resetando...
                                        </>
                                      ) : (
                                        <>
                                          <i className="fas fa-sync me-2"></i>
                                          Resetar Bling
                                        </>
                                      )}
                                    </button>
                                    <hr />
                                    <button 
                                      className="btn btn-outline-danger btn-sm"
                                      onClick={() => handleDelete(supplier)}
                                      disabled={actionLoading === supplier.id}
                                    >
                                      <i className="fas fa-trash me-2"></i>
                                      Excluir Permanentemente
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderRetailers = () => {
    const retailerData = suppliers.filter(s => s.client_type === 'retailer');
    
    const handleRowClick = (retailerId) => {
      setExpandedRow(expandedRow === retailerId ? null : retailerId);
    };
    
    return (
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="fas fa-store me-2"></i>
            Lojistas da Plataforma ({retailerData.length})
          </h5>
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => setActiveTab('cadastro')}
          >
            <i className="fas fa-plus me-1"></i>
            Novo Lojista
          </button>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Loja</th>
                  <th>Domínio</th>
                  <th>Status</th>
                  <th>Status Bling</th>
                  <th>Plano</th>
                  <th>Valor</th>
                  <th>Criado em</th>
                  <th className="text-center">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {retailerData.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-4">
                      <div className="text-muted">
                        <i className="fas fa-store fa-2x mb-2"></i>
                        <p>Nenhuma loja cadastrada ainda</p>
                        <div className="mt-3">
                          <button 
                            className="btn btn-primary btn-sm" 
                            onClick={() => setActiveTab('cadastro')}
                          >
                            <i className="fas fa-plus me-1"></i>
                            Cadastrar Nova Loja
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  retailerData.map(retailer => (
                    <React.Fragment key={retailer.id}>
                      <tr 
                        className={`cursor-pointer ${expandedRow === retailer.id ? 'table-active' : ''}`}
                        onClick={() => handleRowClick(retailer.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div>
                            <strong>{retailer.name}</strong>
                            <br />
                            <small className="text-muted">{retailer.email}</small>
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-info">{retailer.slug}.hub360plus.com</span>
                        </td>
                        <td>
                          <span className={`badge bg-${retailer.tenant_status === 'active' ? 'success' : 
                            retailer.tenant_status === 'pending' ? 'warning' : 'danger'}`}>
                            {retailer.tenant_status === 'active' ? 'Ativo' : 
                             retailer.tenant_status === 'pending' ? 'Pendente' : 'Suspenso'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge bg-${retailer.bling_status === 'connected' ? 'success' : 
                            retailer.bling_status === 'pending' ? 'warning' : 'secondary'}`}>
                            {retailer.bling_status === 'connected' ? 'Conectado' : 
                             retailer.bling_status === 'pending' ? 'Pendente' : 'Não conectado'}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-success">{retailer.tenant_plan || 'Sem plano'}</span>
                        </td>
                        <td>{formatPrice(retailer.plan_value || 0)}</td>
                        <td>{formatDate(retailer.created_at)}</td>
                        <td className="text-center">
                          <i className={`fas fa-chevron-${expandedRow === retailer.id ? 'up' : 'down'}`}></i>
                        </td>
                      </tr>
                      {expandedRow === retailer.id && (
                        <tr>
                          <td colSpan="8" className="p-0">
                            <div className="bg-light border-top p-4 expandable-panel">
                              <div className="row">
                                <div className="col-md-8">
                                  <h6 className="mb-3">
                                    <i className="fas fa-info-circle me-2"></i>
                                    Detalhes Completos - {retailer.name}
                                  </h6>
                                  <div className="row">
                                    <div className="col-md-6 mb-3">
                                      <strong>📧 Email:</strong>
                                      <br />
                                      <span className="text-muted">{retailer.email}</span>
                                    </div>
                                    <div className="col-md-6 mb-3">
                                      <strong>🌐 Domínio:</strong>
                                      <br />
                                      <span className="text-muted">{retailer.slug}.hub360plus.com</span>
                                    </div>
                                    <div className="col-md-6 mb-3">
                                      <strong>📋 Plano:</strong>
                                      <br />
                                      <span className="badge bg-success me-2">{retailer.tenant_plan}</span>
                                      <span className="text-success fw-bold">{formatPrice(retailer.plan_value)}/mês</span>
                                    </div>
                                    <div className="col-md-6 mb-3">
                                      <strong>📅 Criado em:</strong>
                                      <br />
                                      <span className="text-muted">{formatDate(retailer.created_at)}</span>
                                    </div>
                                    <div className="col-md-6 mb-3">
                                      <strong>🔄 Status Loja:</strong>
                                      <br />
                                      <span className={`badge bg-${retailer.tenant_status === 'active' ? 'success' : 
                                        retailer.tenant_status === 'pending' ? 'warning' : 'danger'}`}>
                                        {retailer.tenant_status === 'active' ? 'Ativo' : 
                                         retailer.tenant_status === 'pending' ? 'Pendente' : 'Suspenso'}
                                      </span>
                                    </div>
                                    <div className="col-md-6 mb-3">
                                      <strong>🔗 Status Bling:</strong>
                                      <br />
                                      <span className={`badge bg-${retailer.bling_status === 'connected' ? 'success' : 
                                        retailer.bling_status === 'pending' ? 'warning' : 'secondary'}`}>
                                        {retailer.bling_status === 'connected' ? 'Conectado' : 
                                         retailer.bling_status === 'pending' ? 'Pendente' : 'Não conectado'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="col-md-4">
                                  <h6 className="mb-3">
                                    <i className="fas fa-cogs me-2"></i>
                                    Ações Disponíveis
                                  </h6>
                                  <div className="d-grid gap-2 action-buttons">
                                    <button 
                                      className="btn btn-outline-primary btn-sm"
                                      onClick={() => handleEdit(retailer)}
                                      disabled={actionLoading === retailer.id}
                                    >
                                      <i className="fas fa-edit me-2"></i>
                                      Editar Dados
                                    </button>
                                    <button 
                                      className="btn btn-outline-info btn-sm"
                                      onClick={() => handleAccessPanel(retailer)}
                                      disabled={actionLoading === retailer.id}
                                    >
                                      <i className="fas fa-eye me-2"></i>
                                      Acessar Loja
                                    </button>
                                    {retailer.tenant_status === 'active' ? (
                                      <button 
                                        className="btn btn-outline-warning btn-sm"
                                        onClick={() => handleSuspendReactivate(retailer)}
                                        disabled={actionLoading === retailer.id}
                                      >
                                        {actionLoading === retailer.id ? (
                                          <>
                                            <i className="fas fa-spinner fa-spin me-2"></i>
                                            Suspendendo...
                                          </>
                                        ) : (
                                          <>
                                            <i className="fas fa-pause me-2"></i>
                                            Suspender Loja
                                          </>
                                        )}
                                      </button>
                                    ) : (
                                      <button 
                                        className="btn btn-outline-success btn-sm"
                                        onClick={() => handleSuspendReactivate(retailer)}
                                        disabled={actionLoading === retailer.id}
                                      >
                                        {actionLoading === retailer.id ? (
                                          <>
                                            <i className="fas fa-spinner fa-spin me-2"></i>
                                            Reativando...
                                          </>
                                        ) : (
                                          <>
                                            <i className="fas fa-play me-2"></i>
                                            Reativar Loja
                                          </>
                                        )}
                                      </button>
                                    )}
                                    <button 
                                      className="btn btn-outline-secondary btn-sm"
                                      onClick={() => handleResetBling(retailer)}
                                      disabled={actionLoading === retailer.id}
                                    >
                                      {actionLoading === retailer.id ? (
                                        <>
                                          <i className="fas fa-spinner fa-spin me-2"></i>
                                          Resetando...
                                        </>
                                      ) : (
                                        <>
                                          <i className="fas fa-sync me-2"></i>
                                          Resetar Bling
                                        </>
                                      )}
                                    </button>
                                    <hr />
                                    <button 
                                      className="btn btn-outline-danger btn-sm"
                                      onClick={() => handleDelete(retailer)}
                                      disabled={actionLoading === retailer.id}
                                    >
                                      <i className="fas fa-trash me-2"></i>
                                      Excluir Permanentemente
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCadastroForm = () => (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">
          <i className="fas fa-plus me-2"></i>
          Cadastrar Novo Cliente
        </h5>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmitSupplier}>
          <div className="row mb-3">
            <div className="col-12">
              <label className="form-label fw-bold">Tipo de Cliente *</label>
              <div className="d-flex gap-4">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="client_type"
                    id="supplier"
                    value="supplier"
                    checked={formData.client_type === 'supplier'}
                    onChange={handleInputChange}
                  />
                  <label className="form-check-label" htmlFor="supplier">
                    <i className="fas fa-building me-2"></i>Fornecedor
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="client_type"
                    id="retailer"
                    value="retailer"
                    checked={formData.client_type === 'retailer'}
                    onChange={handleInputChange}
                  />
                  <label className="form-check-label" htmlFor="retailer">
                    <i className="fas fa-store me-2"></i>Lojista
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="name" className="form-label">Nome da Empresa *</label>
              <input
                type="text"
                className="form-control"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="email" className="form-label">Email *</label>
              <input
                type="email"
                className="form-control"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="company_name" className="form-label">Razão Social</label>
              <input
                type="text"
                className="form-control"
                id="company_name"
                name="company_name"
                value={formData.company_name}
                onChange={handleInputChange}
                placeholder="Nome Completo da Empresa Ltda"
              />
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="contact_person" className="form-label">Contato *</label>
              <input
                type="text"
                className="form-control"
                id="contact_person"
                name="contact_person"
                value={formData.contact_person}
                onChange={handleInputChange}
                placeholder="Nome do responsável"
                required
              />
            </div>
          </div>
          
          <div className="row">
            <div className="col-md-4 mb-3">
              <label htmlFor="document" className="form-label">CNPJ</label>
              <input
                type="text"
                className="form-control"
                id="document"
                name="document"
                value={formData.document}
                onChange={handleInputChange}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="col-md-4 mb-3">
              <label htmlFor="state_registration" className="form-label">Inscrição Estadual</label>
              <input
                type="text"
                className="form-control"
                id="state_registration"
                name="state_registration"
                value={formData.state_registration}
                onChange={handleInputChange}
                placeholder="123.456.789.000"
              />
            </div>
            <div className="col-md-4 mb-3">
              <label htmlFor="phone" className="form-label">Telefone</label>
              <input
                type="tel"
                className="form-control"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
          
          <div className="mb-3">
            <label htmlFor="address" className="form-label">Endereço</label>
            <textarea
              className="form-control"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              rows={3}
              placeholder="Endereço completo"
            ></textarea>
          </div>

          <div className="row mb-3">
            <div className="col-12">
              <label className="form-label fw-bold">Plano *</label>
              <div className="d-flex gap-4">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="plan"
                    id="fornecedor_plan"
                    value="pro"
                    checked={formData.plan === 'pro'}
                    onChange={handleInputChange}
                  />
                  <label className="form-check-label" htmlFor="fornecedor_plan">
                    <i className="fas fa-building me-2"></i>Fornecedor - R$ 399/mês
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="plan"
                    id="cliente_plan"
                    value="starter"
                    checked={formData.plan === 'starter'}
                    onChange={handleInputChange}
                  />
                  <label className="form-check-label" htmlFor="cliente_plan">
                    <i className="fas fa-store me-2"></i>Cliente - R$ 49/mês
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-12">
              <label className="form-label fw-bold">Serviços Adicionais</label>
              <div className="row">
                <div className="col-md-6 mb-2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="services.implantacao"
                      id="implantacao"
                      checked={formData.services.implantacao}
                      onChange={handleServiceChange}
                    />
                    <label className="form-check-label" htmlFor="implantacao">
                      <i className="fas fa-cogs me-2"></i>Implantação - R$ 599
                    </label>
                  </div>
                </div>
                <div className="col-md-6 mb-2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="services.erp_bling"
                      id="erp_bling"
                      checked={formData.services.erp_bling}
                      onChange={handleServiceChange}
                    />
                    <label className="form-check-label" htmlFor="erp_bling">
                      <i className="fas fa-database me-2"></i>ERP Bling (Comissão 10%)
                    </label>
                  </div>
                </div>
                <div className="col-md-6 mb-2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="services.crm"
                      id="crm"
                      checked={formData.services.crm}
                      onChange={handleServiceChange}
                    />
                    <label className="form-check-label" htmlFor="crm">
                      <i className="fas fa-users-cog me-2"></i>CRM (Comissão 30%)
                    </label>
                  </div>
                </div>
                <div className="col-md-6 mb-2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="services.gestao_marketplaces"
                      id="gestao_marketplaces"
                      checked={formData.services.gestao_marketplaces}
                      onChange={handleServiceChange}
                    />
                    <label className="form-check-label" htmlFor="gestao_marketplaces">
                      <i className="fas fa-shopping-bag me-2"></i>Gestão Marketplaces - R$ 399/mês
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <strong className="form-text text-dark">
                  <i className="fas fa-store me-1"></i>
                  Marketplaces Disponíveis:
                </strong>
                <div className="row mt-2">
                  <div className="col-md-6">
                    <div className="form-check form-check-inline">
                      <input className="form-check-input" type="checkbox" id="tiktok" />
                      <label className="form-check-label" htmlFor="tiktok">TikTok Shop</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-check form-check-inline">
                      <input className="form-check-input" type="checkbox" id="amazon" />
                      <label className="form-check-label" htmlFor="amazon">Amazon</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-check form-check-inline">
                      <input className="form-check-input" type="checkbox" id="mercadolivre" />
                      <label className="form-check-label" htmlFor="mercadolivre">Mercado Livre</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-check form-check-inline">
                      <input className="form-check-input" type="checkbox" id="shopee" />
                      <label className="form-check-label" htmlFor="shopee">Shopee</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-check form-check-inline">
                      <input className="form-check-input" type="checkbox" id="magalu" />
                      <label className="form-check-label" htmlFor="magalu">Magalu</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="d-flex gap-2">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Cadastrando...
                </>
              ) : (
                <>
                  <i className="fas fa-save me-2"></i>
                  Cadastrar Cliente
                </>
              )}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => setActiveTab('suppliers')}
            >
              <i className="fas fa-times me-2"></i>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="container-fluid py-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Carregando...</span>
          </div>
          <p className="mt-3">Carregando dados da plataforma...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      {/* Cabeçalho */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="h3 mb-0">Super Admin - HUB360PLUS</h1>
              <p className="text-muted mb-0">Cadastro e gestão completa de clientes - Controle total: criar, alterar, excluir e bloquear</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <div className="row mb-4">
        <div className="col-12">
          <ul className="nav nav-pills">
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                <i className="fas fa-tachometer-alt me-2"></i>
                Dashboard
              </button>
            </li>
            <li className="nav-item dropdown">
              <button 
                className={`nav-link dropdown-toggle ${activeTab === 'suppliers' || activeTab === 'retailers' ? 'active' : ''}`}
                type="button"
                id="clientesDropdown"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <i className="fas fa-users me-2"></i>
                Clientes ({metrics.suppliers?.total || 0})
              </button>
              <ul className="dropdown-menu" aria-labelledby="clientesDropdown">
                <li>
                  <button 
                    className="dropdown-item"
                    onClick={() => setActiveTab('suppliers')}
                  >
                    <i className="fas fa-building me-2"></i>
                    Fornecedores
                  </button>
                </li>
                <li>
                  <button 
                    className="dropdown-item"
                    onClick={() => setActiveTab('retailers')}
                  >
                    <i className="fas fa-store me-2"></i>
                    Lojistas
                  </button>
                </li>
              </ul>
            </li>
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'cadastro' ? 'active' : ''}`}
                onClick={() => setActiveTab('cadastro')}
              >
                <i className="fas fa-plus me-2"></i>
                Cadastrar Cliente
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="row">
        <div className="col-12">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'suppliers' && renderSuppliers()}
          {activeTab === 'retailers' && renderRetailers()}
          {activeTab === 'cadastro' && renderCadastroForm()}
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
    {showDeleteModal && (
      <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-danger text-white">
              <h5 className="modal-title">
                <i className="fas fa-exclamation-triangle me-2"></i>
                Confirmar Exclusão
              </h5>
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={() => setShowDeleteModal(null)}
              ></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning">
                <i className="fas fa-warning me-2"></i>
                <strong>Atenção!</strong> Esta ação não pode ser desfeita.
              </div>
              <p>
                Você está prestes a excluir permanentemente o cliente:
              </p>
              <div className="bg-light p-3 rounded">
                <strong>{showDeleteModal.name}</strong><br />
                <small className="text-muted">{showDeleteModal.email}</small><br />
                <small className="text-muted">Domínio: {showDeleteModal.slug}.hub360plus.com</small>
              </div>
              <p className="mt-3 text-danger">
                <i className="fas fa-exclamation-circle me-1"></i>
                Todos os dados, configurações e integrações serão perdidos definitivamente.
              </p>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowDeleteModal(null)}
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={confirmDelete}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin me-2"></i>
                    Excluindo...
                  </>
                ) : (
                  <>
                    <i className="fas fa-trash me-2"></i>
                    Sim, Excluir Permanentemente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Modal de Edição (Placeholder para funcionalidade futura) */}
    {showEditModal && (
      <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">
                <i className="fas fa-edit me-2"></i>
                Editar Cliente - {showEditModal.name}
              </h5>
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={() => setShowEditModal(null)}
              ></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info">
                <i className="fas fa-info-circle me-2"></i>
                <strong>Em Desenvolvimento:</strong> Interface de edição completa será implementada em breve.
              </div>
              <div className="row">
                <div className="col-md-6">
                  <h6>Dados Atuais:</h6>
                  <ul className="list-unstyled">
                    <li><strong>Nome:</strong> {showEditModal.name}</li>
                    <li><strong>Email:</strong> {showEditModal.email}</li>
                    <li><strong>Domínio:</strong> {showEditModal.slug}.hub360plus.com</li>
                    <li><strong>Plano:</strong> {showEditModal.tenant_plan}</li>
                    <li><strong>Status:</strong> {showEditModal.tenant_status}</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>Ações Disponíveis:</h6>
                  <div className="d-grid gap-2">
                    <button className="btn btn-outline-primary btn-sm">
                      <i className="fas fa-user me-2"></i>
                      Alterar Dados Pessoais
                    </button>
                    <button className="btn btn-outline-info btn-sm">
                      <i className="fas fa-globe me-2"></i>
                      Modificar Domínio
                    </button>
                    <button className="btn btn-outline-success btn-sm">
                      <i className="fas fa-credit-card me-2"></i>
                      Alterar Plano
                    </button>
                    <button className="btn btn-outline-warning btn-sm">
                      <i className="fas fa-key me-2"></i>
                      Resetar Senha
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowEditModal(null)}
              >
                Fechar
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={() => {
                  alert('Funcionalidade de edição será implementada em breve!');
                  setShowEditModal(null);
                }}
              >
                <i className="fas fa-save me-2"></i>
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    </div>
  );
};

export default SuperAdmin;
