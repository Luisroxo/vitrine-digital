import React, { useState, useEffect } from 'react';
import api from '../services/api';

const BillingDashboard = () => {
  const [billingData, setBillingData] = useState({
    currentSubscription: null,
    availablePlans: [],
    paymentHistory: [],
    usage: null,
    loading: true
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      setBillingData(prev => ({ ...prev, loading: true }));
      setError('');

      const [plansRes, subscriptionRes, historyRes, usageRes] = await Promise.allSettled([
        api.get('/billing/plans'),
        api.get('/billing/subscription'),
        api.get('/billing/payment-history'),
        api.get('/billing/usage')
      ]);

      setBillingData({
        availablePlans: plansRes.status === 'fulfilled' ? plansRes.value.data : [],
        currentSubscription: subscriptionRes.status === 'fulfilled' ? subscriptionRes.value.data : null,
        paymentHistory: historyRes.status === 'fulfilled' ? historyRes.value.data : [],
        usage: usageRes.status === 'fulfilled' ? usageRes.value.data : null,
        loading: false
      });
    } catch (err) {
      console.error('Erro ao carregar dados de billing:', err);
      setError('Erro ao carregar informações de cobrança');
      setBillingData(prev => ({ ...prev, loading: false }));
    }
  };

  const formatPrice = (cents) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleSubscribe = async (planId) => {
    try {
      const response = await api.post('/billing/subscribe', { planId });
      
      if (response.data.checkout_url) {
        // Redirecionar para o Stripe Checkout
        window.location.href = response.data.checkout_url;
      } else {
        alert('Assinatura criada com sucesso!');
        loadBillingData();
      }
    } catch (err) {
      console.error('Erro ao criar assinatura:', err);
      alert('Erro ao processar assinatura');
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Tem certeza que deseja cancelar sua assinatura?')) return;

    try {
      await api.post('/billing/cancel-subscription');
      alert('Assinatura cancelada com sucesso!');
      loadBillingData();
    } catch (err) {
      console.error('Erro ao cancelar assinatura:', err);
      alert('Erro ao cancelar assinatura');
    }
  };

  if (billingData.loading) {
    return (
      <div className="container mt-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Carregando...</span>
          </div>
          <p className="mt-2">Carregando informações de cobrança...</p>
        </div>
      </div>
    );
  }

  const { currentSubscription, availablePlans, paymentHistory, usage } = billingData;

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-md-12">
          <h2 className="mb-4">
            <i className="fas fa-credit-card me-2"></i>
            Billing & Assinaturas
          </h2>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {/* Status da Assinatura Atual */}
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Assinatura Atual</h5>
              {currentSubscription && currentSubscription.status === 'active' && (
                <button 
                  className="btn btn-outline-danger btn-sm"
                  onClick={handleCancelSubscription}
                >
                  Cancelar Assinatura
                </button>
              )}
            </div>
            <div className="card-body">
              {currentSubscription ? (
                <div className="row">
                  <div className="col-md-6">
                    <h6>Plano: <span className="text-primary">{currentSubscription.plan_name}</span></h6>
                    <p className="mb-1">
                      <strong>Status:</strong>
                      <span className={`badge ms-2 ${
                        currentSubscription.status === 'active' ? 'bg-success' :
                        currentSubscription.status === 'canceled' ? 'bg-danger' :
                        'bg-warning'
                      }`}>
                        {currentSubscription.status === 'active' ? 'Ativo' :
                         currentSubscription.status === 'canceled' ? 'Cancelado' :
                         currentSubscription.status}
                      </span>
                    </p>
                    <p className="mb-1">
                      <strong>Preço:</strong> {formatPrice(currentSubscription.price_cents)}
                    </p>
                  </div>
                  <div className="col-md-6">
                    <p className="mb-1">
                      <strong>Próxima cobrança:</strong> {formatDate(currentSubscription.next_billing_date)}
                    </p>
                    <p className="mb-1">
                      <strong>Criada em:</strong> {formatDate(currentSubscription.created_at)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3">
                  <i className="fas fa-exclamation-circle fa-2x text-warning mb-2"></i>
                  <p className="mb-0">Nenhuma assinatura ativa encontrada</p>
                  <small className="text-muted">Escolha um plano abaixo para começar</small>
                </div>
              )}
            </div>
          </div>

          {/* Uso Atual (se houver assinatura) */}
          {usage && (
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0">Uso do Período Atual</h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-3">
                    <div className="text-center">
                      <h3 className="text-primary">{usage.api_calls || 0}</h3>
                      <p className="mb-0">Chamadas API</p>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="text-center">
                      <h3 className="text-success">{usage.orders || 0}</h3>
                      <p className="mb-0">Pedidos</p>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="text-center">
                      <h3 className="text-info">{usage.products || 0}</h3>
                      <p className="mb-0">Produtos</p>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="text-center">
                      <h3 className="text-warning">{usage.storage_gb || 0}GB</h3>
                      <p className="mb-0">Armazenamento</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Planos Disponíveis */}
          {(!currentSubscription || currentSubscription.status !== 'active') && (
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0">Planos Disponíveis</h5>
              </div>
              <div className="card-body">
                <div className="row">
                  {availablePlans.map(plan => (
                    <div key={plan.id} className="col-md-6 mb-3">
                      <div className="card h-100 border-primary">
                        <div className="card-header bg-primary text-white text-center">
                          <h5 className="mb-0">{plan.name}</h5>
                          <small>{plan.target_type === 'supplier' ? 'Fornecedor' : 'Lojista'}</small>
                        </div>
                        <div className="card-body">
                          <div className="text-center mb-3">
                            <h3 className="text-primary">{formatPrice(plan.price_cents)}</h3>
                            <p className="mb-0">por mês</p>
                            {plan.setup_fee_cents > 0 && (
                              <small className="text-muted">
                                + {formatPrice(plan.setup_fee_cents)} taxa de setup
                              </small>
                            )}
                          </div>

                          <p className="text-muted">{plan.description}</p>

                          {plan.features && (
                            <div className="mb-3">
                              <h6>Recursos:</h6>
                              <ul className="list-unstyled">
                                {Object.entries(JSON.parse(plan.features)).map(([key, value]) => (
                                  value && (
                                    <li key={key} className="mb-1">
                                      <i className="fas fa-check text-success me-2"></i>
                                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </li>
                                  )
                                ))}
                              </ul>
                            </div>
                          )}

                          <button 
                            className="btn btn-primary w-100"
                            onClick={() => handleSubscribe(plan.id)}
                          >
                            Assinar Agora
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Histórico de Pagamentos */}
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Histórico de Pagamentos</h5>
            </div>
            <div className="card-body">
              {paymentHistory.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th>Valor</th>
                        <th>Status</th>
                        <th>Método</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.map(payment => (
                        <tr key={payment.id}>
                          <td>{formatDate(payment.created_at)}</td>
                          <td>{payment.description}</td>
                          <td>{formatPrice(payment.amount_cents)}</td>
                          <td>
                            <span className={`badge ${
                              payment.status === 'paid' ? 'bg-success' :
                              payment.status === 'pending' ? 'bg-warning' :
                              'bg-danger'
                            }`}>
                              {payment.status === 'paid' ? 'Pago' :
                               payment.status === 'pending' ? 'Pendente' :
                               payment.status}
                            </span>
                          </td>
                          <td>{payment.payment_method || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-3 text-muted">
                  <i className="fas fa-receipt fa-2x mb-2"></i>
                  <p className="mb-0">Nenhum pagamento encontrado</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingDashboard;