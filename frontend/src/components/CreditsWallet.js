import React, { useState, useEffect } from 'react';
import { useBilling } from '../hooks/useAPI';
import { LoadingButton, SkeletonLoader } from '../contexts/LoadingContext';
import { useError } from '../contexts/ErrorContext';

/**
 * Credits Wallet Main Component
 */
export function CreditsWallet({ tenantId }) {
  const [walletData, setWalletData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const { 
    getCreditsBalance, 
    getCreditTransactions, 
    purchaseCredits,
    loading 
  } = useBilling();
  const { showError, showSuccess } = useError();

  useEffect(() => {
    loadWalletData();
  }, [tenantId]);

  const loadWalletData = async () => {
    try {
      const [balance, transactionHistory] = await Promise.all([
        getCreditsBalance(tenantId),
        getCreditTransactions(tenantId)
      ]);
      
      setWalletData(balance);
      setTransactions(transactionHistory);
    } catch (error) {
      showError('Erro ao carregar dados da carteira.', 'billing');
    }
  };

  const handlePurchase = async (packageData) => {
    try {
      await purchaseCredits(tenantId, packageData);
      showSuccess('Compra de créditos realizada com sucesso!');
      setShowPurchaseModal(false);
      loadWalletData(); // Refresh data
    } catch (error) {
      showError('Erro ao processar compra de créditos.', 'billing');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  if (loading && !walletData) {
    return (
      <div className="row">
        <div className="col-12">
          <SkeletonLoader lines={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="credits-wallet">
      {/* Wallet Overview */}
      <div className="row mb-4">
        <div className="col-md-8">
          <div className="card bg-gradient-primary text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="card-subtitle mb-2 text-light">
                    <i className="fas fa-wallet me-2"></i>
                    Saldo de Créditos
                  </h6>
                  <h2 className="card-title mb-1">
                    {walletData?.balance || 0} <small>créditos</small>
                  </h2>
                  <p className="mb-0 text-light">
                    Equivalente a {formatCurrency(walletData?.balanceValue || 0)}
                  </p>
                </div>
                <div className="text-end">
                  <i className="fas fa-coins fa-3x opacity-75"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body d-flex flex-column justify-content-center">
              <button
                className="btn btn-success btn-lg w-100"
                onClick={() => setShowPurchaseModal(true)}
              >
                <i className="fas fa-plus-circle me-2"></i>
                Comprar Créditos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card bg-info text-white">
            <div className="card-body text-center">
              <i className="fas fa-chart-line fa-2x mb-2"></i>
              <h5>{walletData?.monthlyUsage || 0}</h5>
              <small>Usados este mês</small>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card bg-success text-white">
            <div className="card-body text-center">
              <i className="fas fa-shopping-cart fa-2x mb-2"></i>
              <h5>{walletData?.totalPurchased || 0}</h5>
              <small>Total comprado</small>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card bg-warning text-white">
            <div className="card-body text-center">
              <i className="fas fa-clock fa-2x mb-2"></i>
              <h5>{walletData?.averageDaily || 0}</h5>
              <small>Uso diário médio</small>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card bg-secondary text-white">
            <div className="card-body text-center">
              <i className="fas fa-calendar-alt fa-2x mb-2"></i>
              <h5>{walletData?.estimatedDays || 0}</h5>
              <small>Dias restantes</small>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Packages */}
      <CreditPackages 
        onSelectPackage={setSelectedPackage}
        selectedPackage={selectedPackage}
        onPurchase={handlePurchase}
        loading={loading}
      />

      {/* Transaction History */}
      <TransactionHistory 
        transactions={transactions}
        onRefresh={loadWalletData}
      />

      {/* Purchase Modal */}
      {showPurchaseModal && (
        <CreditPurchaseModal
          onClose={() => setShowPurchaseModal(false)}
          onPurchase={handlePurchase}
          tenantId={tenantId}
        />
      )}
    </div>
  );
}

/**
 * Credit Packages Component
 */
function CreditPackages({ onSelectPackage, selectedPackage, onPurchase, loading }) {
  const [packages] = useState([
    {
      id: 1,
      name: 'Starter',
      credits: 100,
      price: 29.90,
      bonus: 0,
      popular: false,
      description: 'Para começar',
      features: ['100 créditos', 'Suporte básico', 'Válido por 6 meses']
    },
    {
      id: 2,
      name: 'Business',
      credits: 300,
      price: 79.90,
      bonus: 50,
      popular: true,
      description: 'Mais vendido',
      features: ['300 créditos', '50 créditos bônus', 'Suporte prioritário', 'Válido por 12 meses']
    },
    {
      id: 3,
      name: 'Professional',
      credits: 600,
      price: 149.90,
      bonus: 150,
      popular: false,
      description: 'Para profissionais',
      features: ['600 créditos', '150 créditos bônus', 'Suporte premium', 'Válido por 12 meses']
    },
    {
      id: 4,
      name: 'Enterprise',
      credits: 1200,
      price: 279.90,
      bonus: 400,
      popular: false,
      description: 'Para grandes volumes',
      features: ['1200 créditos', '400 créditos bônus', 'Suporte dedicado', 'Válido por 24 meses']
    }
  ]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="card mb-4">
      <div className="card-header">
        <h5 className="mb-0">
          <i className="fas fa-tags me-2"></i>
          Pacotes de Créditos
        </h5>
      </div>
      <div className="card-body">
        <div className="row">
          {packages.map(pkg => (
            <div key={pkg.id} className="col-md-3 mb-3">
              <div
                className={`card h-100 cursor-pointer position-relative ${
                  selectedPackage?.id === pkg.id ? 'border-primary shadow' : ''
                } ${pkg.popular ? 'border-warning' : ''}`}
                onClick={() => onSelectPackage(pkg)}
                style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
              >
                {pkg.popular && (
                  <div className="position-absolute top-0 start-50 translate-middle">
                    <span className="badge bg-warning text-dark px-3 py-1">
                      <i className="fas fa-star me-1"></i>
                      Mais Popular
                    </span>
                  </div>
                )}

                <div className="card-body text-center">
                  <h6 className="card-subtitle text-muted mb-2">{pkg.description}</h6>
                  <h4 className="card-title text-primary">{pkg.name}</h4>
                  
                  <div className="my-3">
                    <h2 className="text-success">
                      {formatCurrency(pkg.price)}
                    </h2>
                  </div>

                  <div className="mb-3">
                    <div className="d-flex justify-content-center align-items-center">
                      <span className="fs-4 fw-bold">{pkg.credits}</span>
                      <span className="text-muted ms-1">créditos</span>
                    </div>
                    
                    {pkg.bonus > 0 && (
                      <div className="text-center mt-1">
                        <span className="badge bg-success">
                          +{pkg.bonus} bônus
                        </span>
                      </div>
                    )}
                  </div>

                  <ul className="list-unstyled text-start small">
                    {pkg.features.map((feature, index) => (
                      <li key={index} className="mb-1">
                        <i className="fas fa-check text-success me-2"></i>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="text-center mt-3">
                    <small className="text-muted">
                      {formatCurrency(pkg.price / (pkg.credits + pkg.bonus))} por crédito
                    </small>
                  </div>
                </div>

                <div className="card-footer">
                  <LoadingButton
                    className={`btn w-100 ${
                      selectedPackage?.id === pkg.id ? 'btn-primary' : 'btn-outline-primary'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPurchase(pkg);
                    }}
                    loading={loading}
                    loadingText="Processando..."
                  >
                    {selectedPackage?.id === pkg.id ? (
                      <>
                        <i className="fas fa-shopping-cart me-2"></i>
                        Comprar Agora
                      </>
                    ) : (
                      'Selecionar'
                    )}
                  </LoadingButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Transaction History Component
 */
function TransactionHistory({ transactions, onRefresh }) {
  const [filter, setFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30');

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'purchase': return 'fas fa-plus-circle text-success';
      case 'usage': return 'fas fa-minus-circle text-danger';
      case 'bonus': return 'fas fa-gift text-warning';
      case 'refund': return 'fas fa-undo text-info';
      default: return 'fas fa-exchange-alt text-muted';
    }
  };

  const getTransactionDescription = (transaction) => {
    switch (transaction.type) {
      case 'purchase': return `Compra de ${transaction.credits} créditos`;
      case 'usage': return transaction.description || 'Uso de créditos';
      case 'bonus': return `Bônus de ${transaction.credits} créditos`;
      case 'refund': return `Estorno de ${transaction.credits} créditos`;
      default: return transaction.description || 'Transação';
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    if (filter !== 'all' && transaction.type !== filter) return false;
    
    const transactionDate = new Date(transaction.createdAt);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange));
    
    return transactionDate >= cutoffDate;
  });

  return (
    <div className="card">
      <div className="card-header">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="fas fa-history me-2"></i>
            Histórico de Transações
          </h5>
          
          <div className="d-flex gap-2">
            <select
              className="form-select form-select-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Todos os tipos</option>
              <option value="purchase">Compras</option>
              <option value="usage">Uso</option>
              <option value="bonus">Bônus</option>
              <option value="refund">Estornos</option>
            </select>
            
            <select
              className="form-select form-select-sm"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Último ano</option>
            </select>
            
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={onRefresh}
            >
              <i className="fas fa-refresh"></i>
            </button>
          </div>
        </div>
      </div>
      
      <div className="card-body">
        {filteredTransactions.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Créditos</th>
                  <th>Valor</th>
                  <th>Data</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map(transaction => (
                  <tr key={transaction.id}>
                    <td>
                      <i className={getTransactionIcon(transaction.type)}></i>
                    </td>
                    <td>
                      <div>
                        <div className="fw-medium">
                          {getTransactionDescription(transaction)}
                        </div>
                        {transaction.reference && (
                          <small className="text-muted">
                            Ref: {transaction.reference}
                          </small>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`fw-bold ${
                        transaction.type === 'usage' ? 'text-danger' : 'text-success'
                      }`}>
                        {transaction.type === 'usage' ? '-' : '+'}
                        {transaction.credits}
                      </span>
                    </td>
                    <td>
                      {transaction.amount ? (
                        <span className="text-muted">
                          {formatCurrency(transaction.amount)}
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <span className="text-muted">
                        {new Date(transaction.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        transaction.status === 'completed' ? 'bg-success' :
                        transaction.status === 'pending' ? 'bg-warning' :
                        transaction.status === 'failed' ? 'bg-danger' : 'bg-secondary'
                      }`}>
                        {transaction.status === 'completed' ? 'Concluído' :
                         transaction.status === 'pending' ? 'Pendente' :
                         transaction.status === 'failed' ? 'Falhou' : 'Desconhecido'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-4">
            <i className="fas fa-inbox text-muted" style={{ fontSize: '3rem' }}></i>
            <h5 className="mt-3">Nenhuma transação encontrada</h5>
            <p className="text-muted">
              {filter === 'all' 
                ? 'Suas transações aparecerão aqui quando realizadas.'
                : 'Nenhuma transação do tipo selecionado no período.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Credit Purchase Modal
 */
function CreditPurchaseModal({ onClose, onPurchase, tenantId }) {
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('credit_card');
  const [processing, setProcessing] = useState(false);

  const { showError, showSuccess } = useError();

  const packages = [
    { id: 1, credits: 50, price: 19.90, bonus: 0 },
    { id: 2, credits: 100, price: 34.90, bonus: 10 },
    { id: 3, credits: 250, price: 79.90, bonus: 50 },
    { id: 4, credits: 500, price: 149.90, bonus: 100 }
  ];

  const handlePurchase = async () => {
    if (!selectedPackage) {
      showError('Selecione um pacote de créditos.', 'validation');
      return;
    }

    setProcessing(true);
    try {
      await onPurchase({
        ...selectedPackage,
        paymentMethod
      });
      onClose();
    } catch (error) {
      showError('Erro ao processar compra.', 'billing');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-shopping-cart me-2"></i>
              Comprar Créditos
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          
          <div className="modal-body">
            <div className="row mb-4">
              <div className="col-12">
                <h6>Escolha um pacote:</h6>
              </div>
              {packages.map(pkg => (
                <div key={pkg.id} className="col-md-6 mb-3">
                  <div
                    className={`card cursor-pointer ${
                      selectedPackage?.id === pkg.id ? 'border-primary' : ''
                    }`}
                    onClick={() => setSelectedPackage(pkg)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="card-body text-center">
                      <h6>{pkg.credits} créditos</h6>
                      {pkg.bonus > 0 && (
                        <span className="badge bg-success mb-2">+{pkg.bonus} bônus</span>
                      )}
                      <h5 className="text-primary">{formatCurrency(pkg.price)}</h5>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedPackage && (
              <>
                <hr />
                <div className="mb-3">
                  <h6>Método de Pagamento:</h6>
                  <div className="d-flex gap-3">
                    <div className="form-check">
                      <input
                        type="radio"
                        className="form-check-input"
                        id="credit_card"
                        value="credit_card"
                        checked={paymentMethod === 'credit_card'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
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
                        value="pix"
                        checked={paymentMethod === 'pix'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      />
                      <label className="form-check-label" htmlFor="pix">
                        <i className="fas fa-qrcode me-2"></i>
                        PIX
                      </label>
                    </div>
                  </div>
                </div>

                <div className="alert alert-info">
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
              </>
            )}
          </div>
          
          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose}>
              Cancelar
            </button>
            <LoadingButton
              className="btn btn-primary"
              onClick={handlePurchase}
              disabled={!selectedPackage}
              loading={processing}
              loadingText="Processando..."
            >
              <i className="fas fa-credit-card me-2"></i>
              Finalizar Compra
            </LoadingButton>
          </div>
        </div>
      </div>
    </div>
  );
}