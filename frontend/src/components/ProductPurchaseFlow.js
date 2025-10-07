import React, { useState, useEffect } from 'react';
import { useProducts, useBilling } from '../hooks/useAPI';
import { LoadingButton, SkeletonLoader } from '../contexts/LoadingContext';
import { useError } from '../contexts/ErrorContext';

/**
 * Product Purchase Flow Main Component
 */
export function ProductPurchaseFlow({ tenantId, onPurchaseComplete }) {
  const [currentStep, setCurrentStep] = useState('selection'); // selection -> review -> payment -> confirmation
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    document: '',
    address: {
      street: '',
      number: '',
      complement: '',
      district: '',
      city: '',
      state: '',
      zipCode: ''
    }
  });
  const [paymentData, setPaymentData] = useState({
    method: 'credit_card',
    installments: 1,
    cardData: null
  });

  const { products, fetchProducts, loading: productsLoading } = useProducts();
  const { processOrder, loading: orderLoading } = useBilling();
  const { showError, showSuccess } = useError();

  useEffect(() => {
    if (tenantId) {
      fetchProducts(tenantId);
    }
  }, [tenantId]);

  const addToCart = (product, quantity = 1) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity, unitPrice: product.price }]);
    }
    
    showSuccess(`${product.name} adicionado ao carrinho!`);
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const updateCartQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    setCart(cart.map(item =>
      item.product.id === productId
        ? { ...item, quantity }
        : item
    ));
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.unitPrice * item.quantity), 0);
  };

  const handlePurchaseComplete = async () => {
    try {
      const orderData = {
        tenantId,
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        })),
        customer: customerInfo,
        payment: paymentData,
        total: getCartTotal()
      };

      const result = await processOrder(orderData);
      
      if (result.success) {
        showSuccess('Pedido realizado com sucesso!');
        setCurrentStep('confirmation');
        setCart([]);
        
        if (onPurchaseComplete) {
          onPurchaseComplete(result.order);
        }
      }
    } catch (error) {
      showError('Erro ao processar pedido.', 'order');
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'selection', label: 'Produtos', icon: 'shopping-bag' },
      { key: 'review', label: 'Revisão', icon: 'clipboard-list' },
      { key: 'payment', label: 'Pagamento', icon: 'credit-card' },
      { key: 'confirmation', label: 'Confirmação', icon: 'check-circle' }
    ];

    return (
      <div className="d-flex justify-content-center mb-4">
        <div className="d-flex align-items-center">
          {steps.map((step, index) => (
            <React.Fragment key={step.key}>
              <div
                className={`rounded-circle d-flex align-items-center justify-content-center ${
                  currentStep === step.key ? 'bg-primary text-white' :
                  steps.findIndex(s => s.key === currentStep) > index ? 'bg-success text-white' :
                  'bg-light text-muted'
                }`}
                style={{ width: '50px', height: '50px' }}
              >
                <i className={`fas fa-${step.icon}`}></i>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-3 ${
                    steps.findIndex(s => s.key === currentStep) > index ? 'bg-success' : 'bg-light'
                  }`}
                  style={{ height: '2px', width: '80px' }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="product-purchase-flow">
      {renderStepIndicator()}

      {currentStep === 'selection' && (
        <ProductSelection
          products={products}
          cart={cart}
          onAddToCart={addToCart}
          onUpdateQuantity={updateCartQuantity}
          onRemoveFromCart={removeFromCart}
          onNext={() => setCurrentStep('review')}
          loading={productsLoading}
        />
      )}

      {currentStep === 'review' && (
        <OrderReview
          cart={cart}
          total={getCartTotal()}
          onBack={() => setCurrentStep('selection')}
          onNext={() => setCurrentStep('payment')}
          onUpdateQuantity={updateCartQuantity}
          onRemoveFromCart={removeFromCart}
        />
      )}

      {currentStep === 'payment' && (
        <PaymentStep
          cart={cart}
          total={getCartTotal()}
          customerInfo={customerInfo}
          paymentData={paymentData}
          onCustomerInfoChange={setCustomerInfo}
          onPaymentDataChange={setPaymentData}
          onBack={() => setCurrentStep('review')}
          onComplete={handlePurchaseComplete}
          loading={orderLoading}
        />
      )}

      {currentStep === 'confirmation' && (
        <OrderConfirmation
          onFinish={() => setCurrentStep('selection')}
        />
      )}
    </div>
  );
}

/**
 * Product Selection Step
 */
function ProductSelection({ products, cart, onAddToCart, onUpdateQuantity, onRemoveFromCart, onNext, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getCartItemQuantity = (productId) => {
    const item = cart.find(item => item.product.id === productId);
    return item ? item.quantity : 0;
  };

  const filteredProducts = products?.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory && product.active && product.stock > 0;
  }) || [];

  const categories = [...new Set(products?.map(p => p.category).filter(Boolean) || [])];

  if (loading) {
    return (
      <div className="row">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="col-md-4 mb-4">
            <SkeletonLoader lines={4} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="row">
      <div className="col-md-8">
        {/* Filters */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="row">
              <div className="col-md-8">
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="fas fa-search"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Buscar produtos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-md-4">
                <select
                  className="form-select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">Todas as categorias</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="row">
          {filteredProducts.map(product => (
            <div key={product.id} className="col-md-4 mb-4">
              <div className="card h-100">
                {product.image && (
                  <img
                    src={product.image}
                    className="card-img-top"
                    alt={product.name}
                    style={{ height: '200px', objectFit: 'cover' }}
                  />
                )}
                
                <div className="card-body d-flex flex-column">
                  <h6 className="card-title">{product.name}</h6>
                  
                  {product.description && (
                    <p className="card-text text-muted small flex-grow-1">
                      {product.description.substring(0, 80)}
                      {product.description.length > 80 && '...'}
                    </p>
                  )}

                  <div className="mb-2">
                    <div className="fw-bold text-primary fs-5">
                      {formatCurrency(product.price)}
                    </div>
                    
                    <small className="text-muted">
                      {product.stock} em estoque
                    </small>
                  </div>

                  <div className="mt-auto">
                    {getCartItemQuantity(product.id) > 0 ? (
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="btn-group">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => onUpdateQuantity(product.id, getCartItemQuantity(product.id) - 1)}
                          >
                            <i className="fas fa-minus"></i>
                          </button>
                          <button className="btn btn-outline-secondary btn-sm" disabled>
                            {getCartItemQuantity(product.id)}
                          </button>
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => onUpdateQuantity(product.id, getCartItemQuantity(product.id) + 1)}
                            disabled={getCartItemQuantity(product.id) >= product.stock}
                          >
                            <i className="fas fa-plus"></i>
                          </button>
                        </div>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => onRemoveFromCart(product.id)}
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm w-100"
                        onClick={() => onAddToCart(product)}
                      >
                        <i className="fas fa-cart-plus me-2"></i>
                        Adicionar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-5">
            <i className="fas fa-search text-muted" style={{ fontSize: '4rem' }}></i>
            <h4 className="mt-3">Nenhum produto encontrado</h4>
            <p className="text-muted">
              Tente ajustar os filtros ou termo de busca.
            </p>
          </div>
        )}
      </div>

      <div className="col-md-4">
        <CartSidebar
          cart={cart}
          onUpdateQuantity={onUpdateQuantity}
          onRemoveFromCart={onRemoveFromCart}
          onNext={onNext}
        />
      </div>
    </div>
  );
}

/**
 * Cart Sidebar Component
 */
function CartSidebar({ cart, onUpdateQuantity, onRemoveFromCart, onNext }) {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const total = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

  return (
    <div className="card sticky-top" style={{ top: '20px' }}>
      <div className="card-header">
        <h6 className="mb-0">
          <i className="fas fa-shopping-cart me-2"></i>
          Carrinho ({cart.length})
        </h6>
      </div>
      
      <div className="card-body">
        {cart.length > 0 ? (
          <>
            <div className="mb-3" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {cart.map(item => (
                <div key={item.product.id} className="d-flex align-items-center mb-3 pb-3 border-bottom">
                  {item.product.image && (
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="rounded me-3"
                      style={{ width: '60px', height: '60px', objectFit: 'cover' }}
                    />
                  )}
                  
                  <div className="flex-grow-1">
                    <h6 className="mb-1 small">{item.product.name}</h6>
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                        >
                          <i className="fas fa-minus"></i>
                        </button>
                        <button className="btn btn-outline-secondary" disabled>
                          {item.quantity}
                        </button>
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                        >
                          <i className="fas fa-plus"></i>
                        </button>
                      </div>
                      
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => onRemoveFromCart(item.product.id)}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                    
                    <div className="text-muted small mt-1">
                      {formatCurrency(item.unitPrice)} x {item.quantity} = {formatCurrency(item.unitPrice * item.quantity)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="border-top pt-3">
              <div className="d-flex justify-content-between mb-3">
                <strong>Total:</strong>
                <strong className="text-primary fs-5">{formatCurrency(total)}</strong>
              </div>
              
              <button
                className="btn btn-success w-100"
                onClick={onNext}
              >
                <i className="fas fa-arrow-right me-2"></i>
                Continuar
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <i className="fas fa-shopping-cart text-muted" style={{ fontSize: '3rem' }}></i>
            <p className="mt-3 text-muted">Seu carrinho está vazio</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Order Review Step
 */
function OrderReview({ cart, total, onBack, onNext, onUpdateQuantity, onRemoveFromCart }) {
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
          <i className="fas fa-clipboard-list me-2"></i>
          Revisão do Pedido
        </h5>
      </div>
      
      <div className="card-body">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Preço Unitário</th>
                <th>Quantidade</th>
                <th>Subtotal</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {cart.map(item => (
                <tr key={item.product.id}>
                  <td>
                    <div className="d-flex align-items-center">
                      {item.product.image && (
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="rounded me-3"
                          style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                        />
                      )}
                      <div>
                        <h6 className="mb-0">{item.product.name}</h6>
                        {item.product.sku && (
                          <small className="text-muted">SKU: {item.product.sku}</small>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{formatCurrency(item.unitPrice)}</td>
                  <td>
                    <div className="btn-group btn-group-sm">
                      <button
                        className="btn btn-outline-secondary"
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                      >
                        <i className="fas fa-minus"></i>
                      </button>
                      <button className="btn btn-outline-secondary" disabled>
                        {item.quantity}
                      </button>
                      <button
                        className="btn btn-outline-secondary"
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                      >
                        <i className="fas fa-plus"></i>
                      </button>
                    </div>
                  </td>
                  <td>{formatCurrency(item.unitPrice * item.quantity)}</td>
                  <td>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => onRemoveFromCart(item.product.id)}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan="3">Total:</th>
                <th className="text-primary">{formatCurrency(total)}</th>
                <th></th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      <div className="card-footer">
        <div className="d-flex justify-content-between">
          <button className="btn btn-outline-secondary" onClick={onBack}>
            <i className="fas fa-arrow-left me-2"></i>
            Voltar
          </button>
          <button className="btn btn-primary" onClick={onNext}>
            <i className="fas fa-arrow-right me-2"></i>
            Continuar para Pagamento
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Payment Step Component
 */
function PaymentStep({ 
  cart, 
  total, 
  customerInfo, 
  paymentData, 
  onCustomerInfoChange, 
  onPaymentDataChange,
  onBack, 
  onComplete, 
  loading 
}) {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleCustomerChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      onCustomerInfoChange(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      onCustomerInfoChange(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  return (
    <div className="row">
      <div className="col-md-8">
        {/* Customer Information */}
        <div className="card mb-4">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-user me-2"></i>
              Dados do Cliente
            </h6>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Nome Completo *</label>
                <input
                  type="text"
                  className="form-control"
                  value={customerInfo.name}
                  onChange={(e) => handleCustomerChange('name', e.target.value)}
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  className="form-control"
                  value={customerInfo.email}
                  onChange={(e) => handleCustomerChange('email', e.target.value)}
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Telefone *</label>
                <input
                  type="tel"
                  className="form-control"
                  value={customerInfo.phone}
                  onChange={(e) => handleCustomerChange('phone', e.target.value)}
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">CPF/CNPJ *</label>
                <input
                  type="text"
                  className="form-control"
                  value={customerInfo.document}
                  onChange={(e) => handleCustomerChange('document', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-credit-card me-2"></i>
              Forma de Pagamento
            </h6>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <div className="d-flex gap-3">
                <div className="form-check">
                  <input
                    type="radio"
                    className="form-check-input"
                    id="credit_card"
                    value="credit_card"
                    checked={paymentData.method === 'credit_card'}
                    onChange={(e) => onPaymentDataChange(prev => ({ ...prev, method: e.target.value }))}
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
                    checked={paymentData.method === 'pix'}
                    onChange={(e) => onPaymentDataChange(prev => ({ ...prev, method: e.target.value }))}
                  />
                  <label className="form-check-label" htmlFor="pix">
                    <i className="fas fa-qrcode me-2"></i>
                    PIX
                  </label>
                </div>
              </div>
            </div>

            {paymentData.method === 'credit_card' && (
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Parcelas</label>
                  <select
                    className="form-select"
                    value={paymentData.installments}
                    onChange={(e) => onPaymentDataChange(prev => ({ ...prev, installments: parseInt(e.target.value) }))}
                  >
                    <option value={1}>1x {formatCurrency(total)} à vista</option>
                    <option value={2}>2x {formatCurrency(total / 2)}</option>
                    <option value={3}>3x {formatCurrency(total / 3)}</option>
                    <option value={6}>6x {formatCurrency(total / 6)}</option>
                  </select>
                </div>
              </div>
            )}

            {paymentData.method === 'pix' && (
              <div className="alert alert-info">
                <i className="fas fa-info-circle me-2"></i>
                Após confirmar o pedido, você receberá o QR Code PIX para pagamento.
                O pedido será processado automaticamente após a confirmação do pagamento.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-md-4">
        {/* Order Summary */}
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">
              <i className="fas fa-file-invoice me-2"></i>
              Resumo do Pedido
            </h6>
          </div>
          <div className="card-body">
            {cart.map(item => (
              <div key={item.product.id} className="d-flex justify-content-between mb-2">
                <span>{item.product.name} ({item.quantity}x)</span>
                <span>{formatCurrency(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
            
            <hr />
            
            <div className="d-flex justify-content-between mb-3">
              <strong>Total:</strong>
              <strong className="text-primary">{formatCurrency(total)}</strong>
            </div>
            
            <div className="d-grid gap-2">
              <button className="btn btn-outline-secondary" onClick={onBack}>
                <i className="fas fa-arrow-left me-2"></i>
                Voltar
              </button>
              
              <LoadingButton
                className="btn btn-success"
                onClick={onComplete}
                loading={loading}
                loadingText="Processando..."
                disabled={!customerInfo.name || !customerInfo.email}
              >
                <i className="fas fa-check me-2"></i>
                Finalizar Pedido
              </LoadingButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Order Confirmation Step
 */
function OrderConfirmation({ onFinish }) {
  return (
    <div className="text-center">
      <div className="card">
        <div className="card-body py-5">
          <div className="mb-4">
            <i className="fas fa-check-circle text-success" style={{ fontSize: '5rem' }}></i>
          </div>
          
          <h3 className="text-success mb-3">Pedido Realizado com Sucesso!</h3>
          
          <p className="text-muted mb-4">
            Seu pedido foi processado com sucesso. Você receberá um email com os detalhes
            e o status de acompanhamento em breve.
          </p>
          
          <div className="d-flex justify-content-center gap-3">
            <button className="btn btn-primary" onClick={onFinish}>
              <i className="fas fa-shopping-bag me-2"></i>
              Fazer Novo Pedido
            </button>
            
            <button className="btn btn-outline-primary">
              <i className="fas fa-file-invoice me-2"></i>
              Ver Pedidos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}