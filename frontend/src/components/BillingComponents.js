import React, { useState, useEffect } from 'react';
import { useBilling } from '../hooks/useAPI';
import { LoadingButton, SkeletonLoader, CardSkeleton } from '../contexts/LoadingContext';
import { useError } from '../contexts/ErrorContext';

/**
 * Billing Dashboard Component
 */
export function BillingDashboard({ tenantId }) {
  const [overview, setOverview] = useState(null);

  const { getOverview, loading } = useBilling();
  const { showError } = useError();

  useEffect(() => {
    loadOverview();
  }, [tenantId]);

  const loadOverview = async () => {
    try {
      const data = await getOverview(tenantId);
      setOverview(data);
    } catch (error) {
      showError('Erro ao carregar dados de faturamento.', 'billing');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  if (loading && !overview) {
    return (
      <div className="row">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="col-md-3 mb-3">
            <CardSkeleton showImage={false} lines={2} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Overview Cards */}
      <div className="row mb-4">
        <div className="col-md-3 mb-3">
          <div className="card bg-primary text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h6 className="card-title">Plano Atual</h6>
                  <h4>{overview?.currentPlan?.name || 'Gratuito'}</h4>
                  <small>{overview?.currentPlan?.description}</small>
                </div>
                <div className="align-self-center">
                  <i className="fas fa-crown fa-2x"></i>
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
                  <h6 className="card-title">Créditos Disponíveis</h6>
                  <h4>{overview?.credits || 0}</h4>
                  <small>créditos restantes</small>
                </div>
                <div className="align-self-center">
                  <i className="fas fa-coins fa-2x"></i>
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
                  <h6 className="card-title">Próxima Cobrança</h6>
                  <h4>{formatCurrency(overview?.nextPayment?.amount)}</h4>
                  <small>
                    {overview?.nextPayment?.date ? 
                      new Date(overview.nextPayment.date).toLocaleDateString('pt-BR') : 
                      'N/A'
                    }
                  </small>
                </div>
                <div className="align-self-center">
                  <i className="fas fa-credit-card fa-2x"></i>
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
                  <h6 className="card-title">Status</h6>
                  <h4>
                    {overview?.status === 'active' ? 'Ativo' : 
                     overview?.status === 'suspended' ? 'Suspenso' : 'Inativo'}
                  </h4>
                  <small>
                    {overview?.expiresAt && 
                      `Expira em ${new Date(overview.expiresAt).toLocaleDateString('pt-BR')}`
                    }
                  </small>
                </div>
                <div className="align-self-center">
                  <i className={`fas ${
                    overview?.status === 'active' ? 'fa-check-circle' : 
                    overview?.status === 'suspended' ? 'fa-pause-circle' : 'fa-times-circle'
                  } fa-2x`}></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Chart */}
      {overview?.usage && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="fas fa-chart-line me-2"></i>
                  Uso de Recursos - {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Produtos</span>
                      <span>{overview.usage.products}/{overview.limits?.products || '∞'}</span>
                    </div>
                    <div className="progress">
                      <div 
                        className="progress-bar bg-primary" 
                        style={{ 
                          width: `${overview.limits?.products ? 
                            (overview.usage.products / overview.limits.products * 100) : 0
                          }%` 
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="col-md-4 mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Pedidos</span>
                      <span>{overview.usage.orders}/{overview.limits?.orders || '∞'}</span>
                    </div>
                    <div className="progress">
                      <div 
                        className="progress-bar bg-success" 
                        style={{ 
                          width: `${overview.limits?.orders ? 
                            (overview.usage.orders / overview.limits.orders * 100) : 0
                          }%` 
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="col-md-4 mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Storage</span>
                      <span>{overview.usage.storage}MB/{overview.limits?.storage || '∞'}MB</span>
                    </div>
                    <div className="progress">
                      <div 
                        className="progress-bar bg-warning" 
                        style={{ 
                          width: `${overview.limits?.storage ? 
                            (overview.usage.storage / overview.limits.storage * 100) : 0
                          }%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="row">
        <div className="col-md-6 mb-3">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">
                <i className="fas fa-shopping-cart me-2"></i>
                Ações Rápidas
              </h6>
            </div>
            <div className="card-body">
              <div className="d-grid gap-2">
                <button className="btn btn-primary">
                  <i className="fas fa-arrow-up me-2"></i>
                  Upgrade do Plano
                </button>
                <button className="btn btn-success">
                  <i className="fas fa-plus-circle me-2"></i>
                  Comprar Créditos
                </button>
                <button className="btn btn-outline-secondary">
                  <i className="fas fa-receipt me-2"></i>
                  Ver Faturas
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 mb-3">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">
                <i className="fas fa-history me-2"></i>
                Histórico Recente
              </h6>
            </div>
            <div className="card-body">
              {overview?.recentTransactions?.length > 0 ? (
                <ul className="list-unstyled mb-0">
                  {overview.recentTransactions.map(transaction => (
                    <li key={transaction.id} className="d-flex justify-content-between mb-2">
                      <span>{transaction.description}</span>
                      <span className={`text-${transaction.type === 'credit' ? 'success' : 'danger'}`}>
                        {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted mb-0">Nenhuma transação recente</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Plans List Component
 */
export function PlansList({ currentPlanId, onSelectPlan }) {
  const [plans, setPlans] = useState([]);

  const { getPlans, loading } = useBilling();
  const { showError } = useError();

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const data = await getPlans();
      setPlans(data);
    } catch (error) {
      showError('Erro ao carregar planos.', 'billing');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  if (loading && !plans.length) {
    return (
      <div className="row">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="col-md-4 mb-4">
            <CardSkeleton showImage={false} lines={5} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="row">
      {plans.map(plan => (
        <div key={plan.id} className="col-md-4 mb-4">
          <div className={`card h-100 ${plan.id === currentPlanId ? 'border-primary' : ''}`}>
            {plan.featured && (
              <div className="card-header bg-primary text-white text-center">
                <i className="fas fa-star me-2"></i>
                Mais Popular
              </div>
            )}
            
            <div className="card-body text-center">
              <h5 className="card-title">{plan.name}</h5>
              <div className="mb-3">
                <h2 className="text-primary">
                  {plan.price > 0 ? formatCurrency(plan.price) : 'Gratuito'}
                  {plan.price > 0 && <small className="text-muted">/mês</small>}
                </h2>
              </div>
              
              <p className="text-muted">{plan.description}</p>
              
              <ul className="list-unstyled mb-4">
                {plan.features.map((feature, index) => (
                  <li key={index} className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    {feature}
                  </li>
                ))}
              </ul>

              {plan.limits && (
                <div className="mb-3">
                  <hr />
                  <h6>Limites:</h6>
                  <ul className="list-unstyled small text-muted">
                    {plan.limits.products && (
                      <li>• {plan.limits.products} produtos</li>
                    )}
                    {plan.limits.orders && (
                      <li>• {plan.limits.orders} pedidos/mês</li>
                    )}
                    {plan.limits.storage && (
                      <li>• {plan.limits.storage}MB storage</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="card-footer text-center">
              {plan.id === currentPlanId ? (
                <button className="btn btn-outline-success" disabled>
                  <i className="fas fa-check me-2"></i>
                  Plano Atual
                </button>
              ) : (
                <button
                  className="btn btn-primary w-100"
                  onClick={() => onSelectPlan(plan)}
                >
                  {plan.price > 0 ? 'Assinar Plano' : 'Começar Grátis'}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Credits Purchase Component
 */
export function CreditsPurchase({ onPurchaseComplete }) {
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [packages, setPackages] = useState([
    { id: 1, credits: 100, price: 50, bonus: 0 },
    { id: 2, credits: 250, price: 100, bonus: 25 },
    { id: 3, credits: 500, price: 200, bonus: 75 },
    { id: 4, credits: 1000, price: 350, bonus: 200 }
  ]);

  const { purchaseCredits, loading } = useBilling();
  const { showError, showSuccess } = useError();

  const handlePurchase = async () => {
    if (!selectedPackage) {
      showError('Selecione um pacote de créditos.', 'validation');
      return;
    }

    try {
      const result = await purchaseCredits(selectedPackage.id);
      showSuccess('Compra de créditos realizada com sucesso!');
      
      if (onPurchaseComplete) {
        onPurchaseComplete(result);
      }
    } catch (error) {
      showError('Erro ao processar compra de créditos.', 'billing');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">
          <i className="fas fa-coins me-2"></i>
          Comprar Créditos
        </h5>
      </div>
      <div className="card-body">
        <div className="row">
          {packages.map(pkg => (
            <div key={pkg.id} className="col-md-3 mb-3">
              <div
                className={`card h-100 cursor-pointer ${selectedPackage?.id === pkg.id ? 'border-primary bg-light' : ''}`}
                onClick={() => setSelectedPackage(pkg)}
                style={{ cursor: 'pointer' }}
              >
                <div className="card-body text-center">
                  <div className="mb-2">
                    <i className="fas fa-coins text-warning fa-2x"></i>
                  </div>
                  
                  <h5>{pkg.credits} Créditos</h5>
                  
                  {pkg.bonus > 0 && (
                    <div className="mb-2">
                      <span className="badge bg-success">
                        +{pkg.bonus} bônus
                      </span>
                    </div>
                  )}
                  
                  <div className="mb-2">
                    <strong className="text-primary fs-5">
                      {formatCurrency(pkg.price)}
                    </strong>
                  </div>
                  
                  <small className="text-muted">
                    {formatCurrency(pkg.price / (pkg.credits + pkg.bonus))} por crédito
                  </small>
                  
                  {selectedPackage?.id === pkg.id && (
                    <div className="mt-2">
                      <i className="fas fa-check-circle text-primary"></i>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {selectedPackage && (
          <div className="alert alert-info mt-3">
            <h6>Resumo da compra:</h6>
            <p className="mb-1">
              <strong>{selectedPackage.credits} créditos</strong>
              {selectedPackage.bonus > 0 && (
                <span> + <strong>{selectedPackage.bonus} créditos bônus</strong></span>
              )}
            </p>
            <p className="mb-0">
              Total: <strong>{formatCurrency(selectedPackage.price)}</strong>
            </p>
          </div>
        )}

        <div className="text-end mt-3">
          <LoadingButton
            className="btn btn-primary"
            onClick={handlePurchase}
            disabled={!selectedPackage}
            loading={loading}
            loadingText="Processando..."
          >
            <i className="fas fa-shopping-cart me-2"></i>
            Comprar Créditos
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Invoices List Component
 */
export function InvoicesList({ tenantId }) {
  const [invoices, setInvoices] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    dateRange: 'last_30_days'
  });

  const { getInvoices, downloadInvoice, loading } = useBilling();
  const { showError, showSuccess } = useError();

  useEffect(() => {
    loadInvoices();
  }, [tenantId, filters]);

  const loadInvoices = async () => {
    try {
      const data = await getInvoices(tenantId, filters);
      setInvoices(data);
    } catch (error) {
      showError('Erro ao carregar faturas.', 'billing');
    }
  };

  const handleDownload = async (invoiceId) => {
    try {
      await downloadInvoice(invoiceId);
      showSuccess('Fatura baixada com sucesso!');
    } catch (error) {
      showError('Erro ao baixar fatura.', 'billing');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      paid: { class: 'bg-success', text: 'Paga' },
      pending: { class: 'bg-warning', text: 'Pendente' },
      overdue: { class: 'bg-danger', text: 'Vencida' },
      cancelled: { class: 'bg-secondary', text: 'Cancelada' }
    };

    const config = statusConfig[status] || { class: 'bg-secondary', text: 'Desconhecido' };
    
    return (
      <span className={`badge ${config.class}`}>
        {config.text}
      </span>
    );
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="fas fa-receipt me-2"></i>
            Histórico de Faturas
          </h5>
          
          <div className="d-flex gap-2">
            <select
              className="form-select form-select-sm"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="all">Todos os status</option>
              <option value="paid">Pagas</option>
              <option value="pending">Pendentes</option>
              <option value="overdue">Vencidas</option>
            </select>
            
            <select
              className="form-select form-select-sm"
              value={filters.dateRange}
              onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
            >
              <option value="last_30_days">Últimos 30 dias</option>
              <option value="last_90_days">Últimos 90 dias</option>
              <option value="this_year">Este ano</option>
              <option value="all">Todas</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="card-body">
        {loading && !invoices.length ? (
          <SkeletonLoader lines={5} />
        ) : invoices.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Fatura</th>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>#{invoice.number}</strong>
                    </td>
                    <td>
                      {new Date(invoice.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td>{invoice.description}</td>
                    <td>{formatCurrency(invoice.amount)}</td>
                    <td>{getStatusBadge(invoice.status)}</td>
                    <td>
                      <div className="dropdown">
                        <button
                          className="btn btn-outline-secondary btn-sm dropdown-toggle"
                          type="button"
                          data-bs-toggle="dropdown"
                        >
                          Ações
                        </button>
                        <ul className="dropdown-menu">
                          <li>
                            <button
                              className="dropdown-item"
                              onClick={() => handleDownload(invoice.id)}
                            >
                              <i className="fas fa-download me-2"></i>
                              Baixar PDF
                            </button>
                          </li>
                          {invoice.paymentUrl && invoice.status === 'pending' && (
                            <li>
                              <a
                                className="dropdown-item"
                                href={invoice.paymentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <i className="fas fa-credit-card me-2"></i>
                                Pagar Agora
                              </a>
                            </li>
                          )}
                        </ul>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-4">
            <i className="fas fa-receipt text-muted" style={{ fontSize: '3rem' }}></i>
            <h5 className="mt-3">Nenhuma fatura encontrada</h5>
            <p className="text-muted">
              {filters.status === 'all' ? 
                'Você ainda não possui faturas.' : 
                `Nenhuma fatura ${filters.status === 'paid' ? 'paga' : filters.status === 'pending' ? 'pendente' : 'vencida'} encontrada.`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Payment Method Component
 */
export function PaymentMethod({ tenantId, onSave }) {
  const [paymentMethod, setPaymentMethod] = useState({
    type: 'credit_card',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    holderName: '',
    isDefault: true
  });

  const { savePaymentMethod, loading } = useBilling();
  const { showError, showSuccess } = useError();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await savePaymentMethod(tenantId, paymentMethod);
      showSuccess('Método de pagamento salvo com sucesso!');
      
      if (onSave) {
        onSave(paymentMethod);
      }
    } catch (error) {
      showError('Erro ao salvar método de pagamento.', 'billing');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPaymentMethod(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const formatCardNumber = (value) => {
    return value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
  };

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">
          <i className="fas fa-credit-card me-2"></i>
          Método de Pagamento
        </h5>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Tipo de Pagamento</label>
            <div className="d-flex gap-3">
              <div className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  id="credit_card"
                  name="type"
                  value="credit_card"
                  checked={paymentMethod.type === 'credit_card'}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="credit_card">
                  <i className="fas fa-credit-card me-2"></i>
                  Cartão de Crédito
                </label>
              </div>
              
              <div className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  id="pix"
                  name="type"
                  value="pix"
                  checked={paymentMethod.type === 'pix'}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="pix">
                  <i className="fas fa-qrcode me-2"></i>
                  PIX
                </label>
              </div>
            </div>
          </div>

          {paymentMethod.type === 'credit_card' && (
            <>
              <div className="mb-3">
                <label htmlFor="cardNumber" className="form-label">
                  Número do Cartão *
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="cardNumber"
                  name="cardNumber"
                  value={formatCardNumber(paymentMethod.cardNumber)}
                  onChange={(e) => setPaymentMethod(prev => ({
                    ...prev,
                    cardNumber: e.target.value.replace(/\s/g, '')
                  }))}
                  placeholder="0000 0000 0000 0000"
                  maxLength="19"
                  required
                />
              </div>

              <div className="row">
                <div className="col-md-4 mb-3">
                  <label htmlFor="expiryDate" className="form-label">
                    Validade *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="expiryDate"
                    name="expiryDate"
                    value={paymentMethod.expiryDate}
                    onChange={handleChange}
                    placeholder="MM/AA"
                    maxLength="5"
                    required
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <label htmlFor="cvv" className="form-label">
                    CVV *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="cvv"
                    name="cvv"
                    value={paymentMethod.cvv}
                    onChange={handleChange}
                    placeholder="000"
                    maxLength="4"
                    required
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <div className="form-check mt-4">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="isDefault"
                      name="isDefault"
                      checked={paymentMethod.isDefault}
                      onChange={handleChange}
                    />
                    <label className="form-check-label" htmlFor="isDefault">
                      Método padrão
                    </label>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="holderName" className="form-label">
                  Nome no Cartão *
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="holderName"
                  name="holderName"
                  value={paymentMethod.holderName}
                  onChange={handleChange}
                  placeholder="Nome conforme impresso no cartão"
                  required
                />
              </div>
            </>
          )}

          {paymentMethod.type === 'pix' && (
            <div className="alert alert-info">
              <i className="fas fa-info-circle me-2"></i>
              Com PIX, você receberá um QR Code para pagamento no momento da compra.
            </div>
          )}

          <div className="d-flex justify-content-end">
            <LoadingButton
              type="submit"
              className="btn btn-primary"
              loading={loading}
              loadingText="Salvando..."
            >
              <i className="fas fa-save me-2"></i>
              Salvar Método de Pagamento
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}