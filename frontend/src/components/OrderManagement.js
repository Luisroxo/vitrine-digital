import React, { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * Componente de Gerenciamento de Pedidos Multi-tenant
 * Interface administrativa para visualizar e gerenciar pedidos
 */
const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    payment_status: '',
    page: 1,
    limit: 20
  });
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    loadOrderData();
  }, [filters]);

  const loadOrderData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Carregar múltiplos dados em paralelo
      const [ordersResponse, statsResponse, settingsResponse] = await Promise.all([
        api.get('/orders', { params: filters }),
        api.get('/orders/stats'),
        api.get('/orders/settings')
      ]);

      setOrders(ordersResponse.data.orders || []);
      setStats(statsResponse.data || {});
      setSettings(settingsResponse.data.settings || {});
      
    } catch (error) {
      console.error('Erro ao carregar dados de pedidos:', error);
      setError(error.response?.data?.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus, comment = '') => {
    try {
      const response = await api.patch(`/orders/${orderId}/status`, {
        status: newStatus,
        comment
      });

      if (response.data.success) {
        // Atualizar a lista de pedidos
        setOrders(prev => prev.map(order => 
          order.id === orderId 
            ? { ...order, status: newStatus, updated_at: new Date().toISOString() }
            : order
        ));

        // Recarregar estatísticas
        const statsResponse = await api.get('/orders/stats');
        setStats(statsResponse.data);

        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      throw error;
    }
  };

  const cancelOrder = async (orderId, reason = '') => {
    try {
      const response = await api.post(`/orders/${orderId}/cancel`, {
        reason
      });

      if (response.data.success) {
        await loadOrderData(); // Recarregar todos os dados
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao cancelar pedido:', error);
      throw error;
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value / 100);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      pending: 'badge bg-warning',
      confirmed: 'badge bg-info',
      processing: 'badge bg-primary',
      shipped: 'badge bg-success',
      delivered: 'badge bg-success',
      cancelled: 'badge bg-danger',
      refunded: 'badge bg-secondary'
    };
    return statusClasses[status] || 'badge bg-light';
  };

  const getStatusText = (status) => {
    const statusText = {
      pending: 'Pendente',
      confirmed: 'Confirmado',
      processing: 'Processando',
      shipped: 'Enviado',
      delivered: 'Entregue',
      cancelled: 'Cancelado',
      refunded: 'Reembolsado'
    };
    return statusText[status] || status;
  };

  if (loading) {
    return (
      <div className="container mt-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Carregando...</span>
          </div>
          <p className="mt-3">Carregando pedidos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          <h4 className="alert-heading">Erro ao carregar pedidos</h4>
          <p>{error}</p>
          <hr />
          <button 
            className="btn btn-outline-danger" 
            onClick={() => loadOrderData()}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>
              <i className="fas fa-shopping-cart me-2"></i>
              Gerenciamento de Pedidos
            </h2>
            <button 
              className="btn btn-primary"
              onClick={() => loadOrderData()}
              disabled={loading}
            >
              <i className="fas fa-sync-alt me-2"></i>
              Atualizar
            </button>
          </div>

          {/* Estatísticas */}
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="card bg-primary text-white">
                <div className="card-body">
                  <div className="d-flex justify-content-between">
                    <div>
                      <h6 className="card-title">Total de Pedidos</h6>
                      <h3 className="mb-0">{stats.total_orders || 0}</h3>
                    </div>
                    <div className="align-self-center">
                      <i className="fas fa-shopping-bag fa-2x"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-success text-white">
                <div className="card-body">
                  <div className="d-flex justify-content-between">
                    <div>
                      <h6 className="card-title">Receita Total</h6>
                      <h3 className="mb-0">{formatCurrency(stats.total_revenue || 0)}</h3>
                    </div>
                    <div className="align-self-center">
                      <i className="fas fa-dollar-sign fa-2x"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-warning text-white">
                <div className="card-body">
                  <div className="d-flex justify-content-between">
                    <div>
                      <h6 className="card-title">Pedidos Pendentes</h6>
                      <h3 className="mb-0">{stats.pending_orders || 0}</h3>
                    </div>
                    <div className="align-self-center">
                      <i className="fas fa-clock fa-2x"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-info text-white">
                <div className="card-body">
                  <div className="d-flex justify-content-between">
                    <div>
                      <h6 className="card-title">Ticket Médio</h6>
                      <h3 className="mb-0">{formatCurrency(stats.average_order_value || 0)}</h3>
                    </div>
                    <div className="align-self-center">
                      <i className="fas fa-chart-line fa-2x"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-3">
                  <label htmlFor="statusFilter" className="form-label">Status</label>
                  <select 
                    id="statusFilter"
                    className="form-select"
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                  >
                    <option value="">Todos os status</option>
                    <option value="pending">Pendente</option>
                    <option value="confirmed">Confirmado</option>
                    <option value="processing">Processando</option>
                    <option value="shipped">Enviado</option>
                    <option value="delivered">Entregue</option>
                    <option value="cancelled">Cancelado</option>
                    <option value="refunded">Reembolsado</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label htmlFor="paymentStatusFilter" className="form-label">Status do Pagamento</label>
                  <select 
                    id="paymentStatusFilter"
                    className="form-select"
                    value={filters.payment_status}
                    onChange={(e) => setFilters(prev => ({ ...prev, payment_status: e.target.value, page: 1 }))}
                  >
                    <option value="">Todos</option>
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="failed">Falhou</option>
                    <option value="refunded">Reembolsado</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label htmlFor="limitFilter" className="form-label">Itens por página</label>
                  <select 
                    id="limitFilter"
                    className="form-select"
                    value={filters.limit}
                    onChange={(e) => setFilters(prev => ({ ...prev, limit: parseInt(e.target.value), page: 1 }))}
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
                <div className="col-md-3 d-flex align-items-end">
                  <button 
                    className="btn btn-outline-secondary w-100"
                    onClick={() => setFilters({
                      status: '',
                      payment_status: '',
                      page: 1,
                      limit: 20
                    })}
                  >
                    Limpar filtros
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Lista de Pedidos */}
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="fas fa-list me-2"></i>
                Pedidos ({orders.length})
              </h5>
            </div>
            <div className="card-body p-0">
              {orders.length === 0 ? (
                <div className="text-center p-4">
                  <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                  <p className="text-muted">Nenhum pedido encontrado com os filtros aplicados.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Pedido</th>
                        <th>Cliente</th>
                        <th>Data</th>
                        <th>Status</th>
                        <th>Pagamento</th>
                        <th>Total</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <strong>#{order.order_number}</strong>
                            <br />
                            <small className="text-muted">ID: {order.id}</small>
                          </td>
                          <td>
                            <div>
                              <strong>{order.customer_name}</strong>
                              <br />
                              <small className="text-muted">{order.customer_email}</small>
                            </div>
                          </td>
                          <td>
                            <small>{formatDate(order.created_at)}</small>
                          </td>
                          <td>
                            <span className={getStatusBadgeClass(order.status)}>
                              {getStatusText(order.status)}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${order.payment_status === 'paid' ? 'bg-success' : 
                              order.payment_status === 'pending' ? 'bg-warning' : 'bg-danger'}`}>
                              {order.payment_status === 'paid' ? 'Pago' : 
                               order.payment_status === 'pending' ? 'Pendente' : 'Falhou'}
                            </span>
                          </td>
                          <td>
                            <strong>{formatCurrency(order.total)}</strong>
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm">
                              <button 
                                className="btn btn-outline-primary"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setOrderModalOpen(true);
                                }}
                                title="Ver detalhes"
                              >
                                <i className="fas fa-eye"></i>
                              </button>
                              {order.status !== 'cancelled' && order.status !== 'delivered' && (
                                <div className="dropdown">
                                  <button 
                                    className="btn btn-outline-secondary dropdown-toggle" 
                                    type="button" 
                                    data-bs-toggle="dropdown"
                                    title="Alterar status"
                                  >
                                    <i className="fas fa-edit"></i>
                                  </button>
                                  <ul className="dropdown-menu">
                                    <li>
                                      <button 
                                        className="dropdown-item"
                                        onClick={() => updateOrderStatus(order.id, 'confirmed')}
                                      >
                                        Confirmar
                                      </button>
                                    </li>
                                    <li>
                                      <button 
                                        className="dropdown-item"
                                        onClick={() => updateOrderStatus(order.id, 'processing')}
                                      >
                                        Processar
                                      </button>
                                    </li>
                                    <li>
                                      <button 
                                        className="dropdown-item"
                                        onClick={() => updateOrderStatus(order.id, 'shipped')}
                                      >
                                        Enviado
                                      </button>
                                    </li>
                                    <li>
                                      <button 
                                        className="dropdown-item"
                                        onClick={() => updateOrderStatus(order.id, 'delivered')}
                                      >
                                        Entregue
                                      </button>
                                    </li>
                                    <li><hr className="dropdown-divider" /></li>
                                    <li>
                                      <button 
                                        className="dropdown-item text-danger"
                                        onClick={() => cancelOrder(order.id, 'Cancelado pelo administrador')}
                                      >
                                        Cancelar
                                      </button>
                                    </li>
                                  </ul>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Modal de detalhes do pedido */}
          {orderModalOpen && selectedOrder && (
            <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
              <div className="modal-dialog modal-lg">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">
                      Pedido #{selectedOrder.order_number}
                    </h5>
                    <button 
                      type="button" 
                      className="btn-close" 
                      onClick={() => setOrderModalOpen(false)}
                    ></button>
                  </div>
                  <div className="modal-body">
                    <div className="row">
                      <div className="col-md-6">
                        <h6>Informações do Cliente</h6>
                        <p><strong>Nome:</strong> {selectedOrder.customer_name}</p>
                        <p><strong>Email:</strong> {selectedOrder.customer_email}</p>
                        <p><strong>Telefone:</strong> {selectedOrder.customer_phone || 'N/A'}</p>
                        <p><strong>Documento:</strong> {selectedOrder.customer_document || 'N/A'}</p>
                      </div>
                      <div className="col-md-6">
                        <h6>Status do Pedido</h6>
                        <p>
                          <span className={getStatusBadgeClass(selectedOrder.status)}>
                            {getStatusText(selectedOrder.status)}
                          </span>
                        </p>
                        <p><strong>Criado em:</strong> {formatDate(selectedOrder.created_at)}</p>
                        <p><strong>Atualizado em:</strong> {formatDate(selectedOrder.updated_at)}</p>
                      </div>
                    </div>
                    
                    <hr />
                    
                    <h6>Endereço de Entrega</h6>
                    {selectedOrder.shipping_address && typeof selectedOrder.shipping_address === 'string' ? (
                      <pre className="bg-light p-2 rounded">{selectedOrder.shipping_address}</pre>
                    ) : (
                      <p className="text-muted">Endereço não disponível</p>
                    )}
                    
                    <hr />
                    
                    <h6>Resumo Financeiro</h6>
                    <table className="table table-sm">
                      <tbody>
                        <tr>
                          <td>Subtotal:</td>
                          <td className="text-end">{formatCurrency(selectedOrder.subtotal)}</td>
                        </tr>
                        <tr>
                          <td>Frete:</td>
                          <td className="text-end">{formatCurrency(selectedOrder.shipping_cost)}</td>
                        </tr>
                        <tr>
                          <td>Desconto:</td>
                          <td className="text-end">-{formatCurrency(selectedOrder.discount)}</td>
                        </tr>
                        <tr className="table-primary">
                          <td><strong>Total:</strong></td>
                          <td className="text-end"><strong>{formatCurrency(selectedOrder.total)}</strong></td>
                        </tr>
                      </tbody>
                    </table>

                    {selectedOrder.notes && (
                      <>
                        <hr />
                        <h6>Observações</h6>
                        <p className="bg-light p-2 rounded">{selectedOrder.notes}</p>
                      </>
                    )}
                  </div>
                  <div className="modal-footer">
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => setOrderModalOpen(false)}
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Backdrop do modal */}
          {orderModalOpen && (
            <div 
              className="modal-backdrop fade show" 
              onClick={() => setOrderModalOpen(false)}
            ></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderManagement;