import React, { useState, useEffect } from 'react';
import { useBilling, useProducts } from '../hooks/useAPI';
import { SkeletonLoader, LoadingButton } from '../contexts/LoadingContext';
import { useError } from '../contexts/ErrorContext';

/**
 * Marketplace Analytics Dashboard
 */
export function MarketplaceAnalytics({ tenantId, dateRange = 30 }) {
  const [analytics, setAnalytics] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(dateRange);
  const [chartType, setChartType] = useState('sales'); // sales, products, customers, revenue

  const { getAnalytics, loading } = useBilling();
  const { showError } = useError();

  useEffect(() => {
    loadAnalytics();
  }, [tenantId, selectedPeriod]);

  const loadAnalytics = async () => {
    try {
      const data = await getAnalytics(tenantId, {
        period: selectedPeriod,
        includeCharts: true,
        includeComparisons: true
      });
      setAnalytics(data);
    } catch (error) {
      showError('Erro ao carregar analytics.', 'analytics');
    }
  };

  if (loading && !analytics) {
    return (
      <div className="row">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="col-md-3 mb-4">
            <SkeletonLoader lines={3} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="marketplace-analytics">
      {/* Header Controls */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4>
          <i className="fas fa-chart-bar me-2"></i>
          Analytics da Vitrine
        </h4>
        
        <div className="d-flex gap-3">
          <select
            className="form-select"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Último ano</option>
          </select>
          
          <LoadingButton
            className="btn btn-outline-primary"
            onClick={loadAnalytics}
            loading={loading}
            loadingText="Atualizando..."
          >
            <i className="fas fa-sync"></i>
          </LoadingButton>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICards analytics={analytics} />

      {/* Charts Section */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0">Análise Temporal</h6>
                <div className="btn-group btn-group-sm">
                  <button
                    className={`btn ${chartType === 'sales' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setChartType('sales')}
                  >
                    Vendas
                  </button>
                  <button
                    className={`btn ${chartType === 'revenue' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setChartType('revenue')}
                  >
                    Receita
                  </button>
                  <button
                    className={`btn ${chartType === 'customers' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setChartType('customers')}
                  >
                    Clientes
                  </button>
                  <button
                    className={`btn ${chartType === 'products' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setChartType('products')}
                  >
                    Produtos
                  </button>
                </div>
              </div>
            </div>
            <div className="card-body">
              <TimeSeriesChart
                data={analytics?.charts?.[chartType]}
                type={chartType}
                period={selectedPeriod}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Analytics */}
      <div className="row">
        <div className="col-md-6 mb-4">
          <TopProducts analytics={analytics} />
        </div>
        
        <div className="col-md-6 mb-4">
          <CustomerInsights analytics={analytics} />
        </div>
      </div>

      <div className="row">
        <div className="col-md-4 mb-4">
          <SalesChannels analytics={analytics} />
        </div>
        
        <div className="col-md-4 mb-4">
          <PaymentMethods analytics={analytics} />
        </div>
        
        <div className="col-md-4 mb-4">
          <ConversionFunnel analytics={analytics} />
        </div>
      </div>
    </div>
  );
}

/**
 * KPI Cards Component
 */
function KPICards({ analytics }) {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
  };

  const formatPercentage = (value) => {
    const color = value >= 0 ? 'text-success' : 'text-danger';
    const icon = value >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
    return (
      <span className={color}>
        <i className={`fas ${icon} me-1`}></i>
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  const kpis = [
    {
      title: 'Receita Total',
      value: formatCurrency(analytics?.revenue?.total || 0),
      change: analytics?.revenue?.change || 0,
      icon: 'fas fa-dollar-sign',
      color: 'bg-primary'
    },
    {
      title: 'Pedidos',
      value: formatNumber(analytics?.orders?.total || 0),
      change: analytics?.orders?.change || 0,
      icon: 'fas fa-shopping-cart',
      color: 'bg-success'
    },
    {
      title: 'Clientes',
      value: formatNumber(analytics?.customers?.total || 0),
      change: analytics?.customers?.change || 0,
      icon: 'fas fa-users',
      color: 'bg-info'
    },
    {
      title: 'Ticket Médio',
      value: formatCurrency(analytics?.averageTicket?.value || 0),
      change: analytics?.averageTicket?.change || 0,
      icon: 'fas fa-chart-line',
      color: 'bg-warning'
    }
  ];

  return (
    <div className="row mb-4">
      {kpis.map((kpi, index) => (
        <div key={index} className="col-md-3 mb-3">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h6 className="card-subtitle text-muted mb-2">{kpi.title}</h6>
                  <h4 className="card-title mb-1">{kpi.value}</h4>
                  <small className="text-muted">
                    vs período anterior: {formatPercentage(kpi.change)}
                  </small>
                </div>
                <div className={`rounded-circle d-flex align-items-center justify-content-center ${kpi.color} text-white`}
                     style={{ width: '50px', height: '50px' }}>
                  <i className={kpi.icon}></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Time Series Chart Component
 */
function TimeSeriesChart({ data, type, period }) {
  if (!data || !data.length) {
    return (
      <div className="text-center py-5">
        <i className="fas fa-chart-line text-muted" style={{ fontSize: '3rem' }}></i>
        <p className="mt-3 text-muted">Dados do gráfico não disponíveis</p>
      </div>
    );
  }

  const formatValue = (value, type) => {
    switch (type) {
      case 'revenue':
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(value);
      default:
        return new Intl.NumberFormat('pt-BR').format(value);
    }
  };

  return (
    <div className="chart-container" style={{ height: '300px', position: 'relative' }}>
      {/* Simple chart representation - in real app would use Chart.js or similar */}
      <div className="d-flex align-items-end h-100 gap-2">
        {data.map((point, index) => (
          <div
            key={index}
            className="d-flex flex-column align-items-center flex-grow-1"
            style={{ height: '100%' }}
          >
            <div
              className="bg-primary rounded-top"
              style={{
                width: '100%',
                height: `${(point.value / Math.max(...data.map(d => d.value))) * 80}%`,
                minHeight: '5px'
              }}
            />
            <small className="text-muted mt-2" style={{ fontSize: '0.7rem' }}>
              {new Date(point.date).toLocaleDateString('pt-BR', { 
                month: 'short', 
                day: 'numeric' 
              })}
            </small>
          </div>
        ))}
      </div>
      
      {/* Chart legend */}
      <div className="position-absolute top-0 end-0 bg-light p-2 rounded">
        <small>
          <strong>Máximo:</strong> {formatValue(Math.max(...data.map(d => d.value)), type)}
        </small>
      </div>
    </div>
  );
}

/**
 * Top Products Component
 */
function TopProducts({ analytics }) {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const topProducts = analytics?.topProducts || [];

  return (
    <div className="card h-100">
      <div className="card-header">
        <h6 className="mb-0">
          <i className="fas fa-trophy me-2"></i>
          Produtos Mais Vendidos
        </h6>
      </div>
      <div className="card-body">
        {topProducts.length > 0 ? (
          <div className="list-group list-group-flush">
            {topProducts.map((product, index) => (
              <div key={product.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                <div className="d-flex align-items-center">
                  <span className={`badge ${
                    index === 0 ? 'bg-warning' :
                    index === 1 ? 'bg-secondary' :
                    index === 2 ? 'bg-info' : 'bg-light text-dark'
                  } me-3`}>
                    #{index + 1}
                  </span>
                  
                  <div>
                    <h6 className="mb-1">{product.name}</h6>
                    <small className="text-muted">
                      {product.quantity} vendidos • {formatCurrency(product.revenue)}
                    </small>
                  </div>
                </div>
                
                <div className="text-end">
                  <div className="progress" style={{ width: '80px', height: '8px' }}>
                    <div
                      className="progress-bar bg-primary"
                      style={{ width: `${(product.quantity / topProducts[0].quantity) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-3">
            <i className="fas fa-box text-muted"></i>
            <p className="text-muted mb-0 mt-2">Nenhuma venda registrada</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Customer Insights Component
 */
function CustomerInsights({ analytics }) {
  const customerData = analytics?.customerInsights || {};

  return (
    <div className="card h-100">
      <div className="card-header">
        <h6 className="mb-0">
          <i className="fas fa-users me-2"></i>
          Insights de Clientes
        </h6>
      </div>
      <div className="card-body">
        <div className="row text-center">
          <div className="col-6 border-end">
            <h4 className="text-primary">{customerData.new || 0}</h4>
            <small className="text-muted">Novos Clientes</small>
          </div>
          <div className="col-6">
            <h4 className="text-success">{customerData.returning || 0}</h4>
            <small className="text-muted">Clientes Recorrentes</small>
          </div>
        </div>
        
        <hr />
        
        <div className="mb-3">
          <div className="d-flex justify-content-between mb-1">
            <span>Taxa de Retenção</span>
            <span>{(customerData.retentionRate || 0).toFixed(1)}%</span>
          </div>
          <div className="progress">
            <div
              className="progress-bar bg-success"
              style={{ width: `${customerData.retentionRate || 0}%` }}
            />
          </div>
        </div>
        
        <div className="mb-3">
          <div className="d-flex justify-content-between mb-1">
            <span>Satisfação (NPS)</span>
            <span>{customerData.nps || 0}</span>
          </div>
          <div className="progress">
            <div
              className="progress-bar bg-info"
              style={{ width: `${((customerData.nps || 0) + 100) / 2}%` }}
            />
          </div>
        </div>
        
        <div className="text-center">
          <small className="text-muted">
            Tempo médio entre compras: {customerData.averageTimeBetweenOrders || 0} dias
          </small>
        </div>
      </div>
    </div>
  );
}

/**
 * Sales Channels Component
 */
function SalesChannels({ analytics }) {
  const channels = analytics?.salesChannels || [];
  const total = channels.reduce((sum, channel) => sum + channel.value, 0);

  return (
    <div className="card h-100">
      <div className="card-header">
        <h6 className="mb-0">
          <i className="fas fa-chart-pie me-2"></i>
          Canais de Venda
        </h6>
      </div>
      <div className="card-body">
        {channels.length > 0 ? (
          channels.map((channel, index) => {
            const percentage = ((channel.value / total) * 100).toFixed(1);
            const colors = ['primary', 'success', 'warning', 'info', 'secondary'];
            
            return (
              <div key={index} className="mb-3">
                <div className="d-flex justify-content-between mb-1">
                  <span>{channel.name}</span>
                  <span className="fw-bold">{percentage}%</span>
                </div>
                <div className="progress">
                  <div
                    className={`progress-bar bg-${colors[index % colors.length]}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <small className="text-muted">{channel.value} vendas</small>
              </div>
            );
          })
        ) : (
          <div className="text-center py-3">
            <i className="fas fa-chart-pie text-muted"></i>
            <p className="text-muted mb-0 mt-2">Dados não disponíveis</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Payment Methods Component
 */
function PaymentMethods({ analytics }) {
  const methods = analytics?.paymentMethods || [];
  const total = methods.reduce((sum, method) => sum + method.value, 0);

  const getMethodIcon = (method) => {
    switch (method.toLowerCase()) {
      case 'credit_card': return 'fas fa-credit-card';
      case 'pix': return 'fas fa-qrcode';
      case 'boleto': return 'fas fa-barcode';
      case 'debit_card': return 'fas fa-credit-card';
      default: return 'fas fa-money-bill';
    }
  };

  return (
    <div className="card h-100">
      <div className="card-header">
        <h6 className="mb-0">
          <i className="fas fa-credit-card me-2"></i>
          Métodos de Pagamento
        </h6>
      </div>
      <div className="card-body">
        {methods.length > 0 ? (
          methods.map((method, index) => {
            const percentage = ((method.value / total) * 100).toFixed(1);
            
            return (
              <div key={index} className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center">
                  <i className={`${getMethodIcon(method.name)} me-2 text-primary`}></i>
                  <span>{method.label}</span>
                </div>
                <div className="text-end">
                  <div className="fw-bold">{percentage}%</div>
                  <small className="text-muted">{method.value} transações</small>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-3">
            <i className="fas fa-credit-card text-muted"></i>
            <p className="text-muted mb-0 mt-2">Dados não disponíveis</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Conversion Funnel Component
 */
function ConversionFunnel({ analytics }) {
  const funnel = analytics?.conversionFunnel || {};
  
  const steps = [
    { name: 'Visitantes', value: funnel.visitors || 0, color: 'bg-info' },
    { name: 'Visualizações', value: funnel.productViews || 0, color: 'bg-primary' },
    { name: 'Carrinho', value: funnel.cartAdds || 0, color: 'bg-warning' },
    { name: 'Checkout', value: funnel.checkoutStarts || 0, color: 'bg-danger' },
    { name: 'Compras', value: funnel.purchases || 0, color: 'bg-success' }
  ];

  const maxValue = Math.max(...steps.map(step => step.value));

  return (
    <div className="card h-100">
      <div className="card-header">
        <h6 className="mb-0">
          <i className="fas fa-filter me-2"></i>
          Funil de Conversão
        </h6>
      </div>
      <div className="card-body">
        {maxValue > 0 ? (
          steps.map((step, index) => {
            const percentage = maxValue > 0 ? ((step.value / maxValue) * 100) : 0;
            const conversionRate = index > 0 && steps[index - 1].value > 0 
              ? ((step.value / steps[index - 1].value) * 100).toFixed(1)
              : '100.0';
            
            return (
              <div key={index} className="mb-3">
                <div className="d-flex justify-content-between mb-1">
                  <span>{step.name}</span>
                  <div>
                    <span className="fw-bold">{step.value}</span>
                    {index > 0 && (
                      <small className="text-muted ms-2">({conversionRate}%)</small>
                    )}
                  </div>
                </div>
                <div className="progress" style={{ height: '20px' }}>
                  <div
                    className={`progress-bar ${step.color}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-3">
            <i className="fas fa-filter text-muted"></i>
            <p className="text-muted mb-0 mt-2">Dados não disponíveis</p>
          </div>
        )}
      </div>
    </div>
  );
}