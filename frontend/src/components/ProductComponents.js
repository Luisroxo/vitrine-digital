import React, { useState, useEffect } from 'react';
import { useProducts } from '../hooks/useAPI';
import { LoadingButton, SkeletonLoader, CardSkeleton } from '../contexts/LoadingContext';
import { useError } from '../contexts/ErrorContext';

/**
 * Product List Component
 */
export function ProductList({ tenantId, onProductClick, onProductEdit, filters = {} }) {
  const { products, loading, fetchProducts, deleteProduct } = useProducts();
  const { showError, showSuccess } = useError();

  useEffect(() => {
    if (tenantId) {
      fetchProducts(tenantId, filters);
    }
  }, [tenantId, filters]);

  const handleDelete = async (productId) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      try {
        await deleteProduct(productId);
        showSuccess('Produto excluído com sucesso!');
        fetchProducts(tenantId, filters); // Refresh list
      } catch (error) {
        showError('Erro ao excluir produto.', 'product');
      }
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  if (loading && !products?.length) {
    return (
      <div className="row">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="col-md-4 mb-4">
            <CardSkeleton showImage={true} lines={3} />
          </div>
        ))}
      </div>
    );
  }

  if (!products?.length) {
    return (
      <div className="text-center py-5">
        <i className="fas fa-box-open text-muted" style={{ fontSize: '4rem' }}></i>
        <h4 className="mt-3">Nenhum produto encontrado</h4>
        <p className="text-muted">Comece adicionando seus primeiros produtos.</p>
      </div>
    );
  }

  return (
    <div className="row">
      {products.map(product => (
        <div key={product.id} className="col-md-4 col-lg-3 mb-4">
          <div className="card h-100 product-card">
            {product.image && (
              <img
                src={product.image}
                className="card-img-top"
                alt={product.name}
                style={{ height: '200px', objectFit: 'cover', cursor: 'pointer' }}
                onClick={() => onProductClick?.(product)}
              />
            )}
            
            <div className="card-body d-flex flex-column">
              <h6 
                className="card-title"
                style={{ cursor: 'pointer' }}
                onClick={() => onProductClick?.(product)}
              >
                {product.name}
              </h6>
              
              {product.description && (
                <p className="card-text text-muted small flex-grow-1">
                  {product.description.substring(0, 100)}
                  {product.description.length > 100 && '...'}
                </p>
              )}

              <div className="mb-2">
                {product.price && (
                  <div className="fw-bold text-primary fs-5">
                    {formatPrice(product.price)}
                  </div>
                )}
                
                {product.originalPrice && product.originalPrice > product.price && (
                  <div className="text-muted text-decoration-line-through small">
                    {formatPrice(product.originalPrice)}
                  </div>
                )}
              </div>

              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className={`badge ${product.stock > 0 ? 'bg-success' : 'bg-danger'}`}>
                    {product.stock > 0 ? `${product.stock} em estoque` : 'Sem estoque'}
                  </span>
                </div>
                
                <div className="dropdown">
                  <button
                    className="btn btn-outline-secondary btn-sm dropdown-toggle"
                    type="button"
                    data-bs-toggle="dropdown"
                  >
                    <i className="fas fa-ellipsis-v"></i>
                  </button>
                  <ul className="dropdown-menu dropdown-menu-end">
                    <li>
                      <button
                        className="dropdown-item"
                        onClick={() => onProductClick?.(product)}
                      >
                        <i className="fas fa-eye me-2"></i>Ver Detalhes
                      </button>
                    </li>
                    <li>
                      <button
                        className="dropdown-item"
                        onClick={() => onProductEdit?.(product)}
                      >
                        <i className="fas fa-edit me-2"></i>Editar
                      </button>
                    </li>
                    <li><hr className="dropdown-divider" /></li>
                    <li>
                      <button
                        className="dropdown-item text-danger"
                        onClick={() => handleDelete(product.id)}
                      >
                        <i className="fas fa-trash me-2"></i>Excluir
                      </button>
                    </li>
                  </ul>
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
 * Product Form Component
 */
export function ProductForm({ product, tenantId, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || '',
    originalPrice: product?.originalPrice || '',
    stock: product?.stock || 0,
    sku: product?.sku || '',
    category: product?.category || '',
    tags: product?.tags?.join(', ') || '',
    image: product?.image || '',
    active: product?.active !== false
  });

  const { createProduct, updateProduct, loading } = useProducts();
  const { showError, showSuccess } = useError();

  const isEditing = !!product?.id;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.price) {
      showError('Nome e preço são obrigatórios.', 'validation');
      return;
    }

    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : null,
        stock: parseInt(formData.stock) || 0,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
        tenantId
      };

      let result;
      if (isEditing) {
        result = await updateProduct(product.id, productData);
        showSuccess('Produto atualizado com sucesso!');
      } else {
        result = await createProduct(productData);
        showSuccess('Produto criado com sucesso!');
      }
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      showError(`Erro ao ${isEditing ? 'atualizar' : 'criar'} produto.`, 'product');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">
          <i className={`fas ${isEditing ? 'fa-edit' : 'fa-plus'} me-2`}></i>
          {isEditing ? 'Editar Produto' : 'Novo Produto'}
        </h5>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="col-md-8">
              <div className="mb-3">
                <label htmlFor="name" className="form-label">
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="description" className="form-label">
                  Descrição
                </label>
                <textarea
                  className="form-control"
                  id="description"
                  name="description"
                  rows="3"
                  value={formData.description}
                  onChange={handleChange}
                />
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label htmlFor="category" className="form-label">
                    Categoria
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label htmlFor="sku" className="form-label">
                    SKU
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="sku"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="tags" className="form-label">
                  Tags (separadas por vírgula)
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="tags"
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  placeholder="eletrônicos, smartphone, oferta"
                />
              </div>
            </div>

            <div className="col-md-4">
              <div className="mb-3">
                <label htmlFor="price" className="form-label">
                  Preço *
                </label>
                <div className="input-group">
                  <span className="input-group-text">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="originalPrice" className="form-label">
                  Preço Original
                </label>
                <div className="input-group">
                  <span className="input-group-text">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    id="originalPrice"
                    name="originalPrice"
                    value={formData.originalPrice}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="stock" className="form-label">
                  Estoque
                </label>
                <input
                  type="number"
                  className="form-control"
                  id="stock"
                  name="stock"
                  value={formData.stock}
                  onChange={handleChange}
                  min="0"
                />
              </div>

              <div className="mb-3">
                <label htmlFor="image" className="form-label">
                  URL da Imagem
                </label>
                <input
                  type="url"
                  className="form-control"
                  id="image"
                  name="image"
                  value={formData.image}
                  onChange={handleChange}
                />
                {formData.image && (
                  <div className="mt-2">
                    <img
                      src={formData.image}
                      alt="Preview"
                      className="img-thumbnail"
                      style={{ maxWidth: '100px', maxHeight: '100px' }}
                    />
                  </div>
                )}
              </div>

              <div className="mb-3 form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="active"
                  name="active"
                  checked={formData.active}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="active">
                  Produto ativo
                </label>
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2">
            {onCancel && (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={onCancel}
              >
                Cancelar
              </button>
            )}
            <LoadingButton
              type="submit"
              className="btn btn-primary"
              loading={loading}
              loadingText={isEditing ? 'Salvando...' : 'Criando...'}
            >
              <i className={`fas ${isEditing ? 'fa-save' : 'fa-plus'} me-2`}></i>
              {isEditing ? 'Salvar Alterações' : 'Criar Produto'}
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Product Details Modal Component
 */
export function ProductDetailsModal({ product, onClose, onEdit, onDelete }) {
  const { showError, showSuccess } = useError();
  const { deleteProduct, loading } = useProducts();

  if (!product) return null;

  const handleDelete = async () => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      try {
        await deleteProduct(product.id);
        showSuccess('Produto excluído com sucesso!');
        if (onDelete) {
          onDelete(product.id);
        }
        onClose();
      } catch (error) {
        showError('Erro ao excluir produto.', 'product');
      }
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-box me-2"></i>
              {product.name}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          
          <div className="modal-body">
            <div className="row">
              {product.image && (
                <div className="col-md-5 mb-3">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="img-fluid rounded"
                    style={{ width: '100%', maxHeight: '300px', objectFit: 'cover' }}
                  />
                </div>
              )}
              
              <div className={product.image ? 'col-md-7' : 'col-12'}>
                <div className="mb-3">
                  <h6>Descrição</h6>
                  <p className="text-muted">
                    {product.description || 'Nenhuma descrição disponível.'}
                  </p>
                </div>

                <div className="row mb-3">
                  <div className="col-6">
                    <h6>Preço</h6>
                    <div className="fw-bold text-primary fs-4">
                      {formatPrice(product.price)}
                    </div>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <div className="text-muted text-decoration-line-through">
                        {formatPrice(product.originalPrice)}
                      </div>
                    )}
                  </div>
                  <div className="col-6">
                    <h6>Estoque</h6>
                    <span className={`badge fs-6 ${product.stock > 0 ? 'bg-success' : 'bg-danger'}`}>
                      {product.stock > 0 ? `${product.stock} unidades` : 'Sem estoque'}
                    </span>
                  </div>
                </div>

                <div className="row mb-3">
                  {product.category && (
                    <div className="col-6">
                      <h6>Categoria</h6>
                      <p>{product.category}</p>
                    </div>
                  )}
                  {product.sku && (
                    <div className="col-6">
                      <h6>SKU</h6>
                      <p><code>{product.sku}</code></p>
                    </div>
                  )}
                </div>

                {product.tags?.length > 0 && (
                  <div className="mb-3">
                    <h6>Tags</h6>
                    <div>
                      {product.tags.map(tag => (
                        <span key={tag} className="badge bg-secondary me-1">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <h6>Status</h6>
                  <span className={`badge ${product.active ? 'bg-success' : 'bg-warning'}`}>
                    {product.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              Fechar
            </button>
            {onEdit && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onEdit(product)}
              >
                <i className="fas fa-edit me-2"></i>
                Editar
              </button>
            )}
            {onDelete && (
              <LoadingButton
                className="btn btn-danger"
                onClick={handleDelete}
                loading={loading}
                loadingText="Excluindo..."
              >
                <i className="fas fa-trash me-2"></i>
                Excluir
              </LoadingButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Product Search and Filters Component
 */
export function ProductFilters({ onFiltersChange, initialFilters = {} }) {
  const [filters, setFilters] = useState({
    search: initialFilters.search || '',
    category: initialFilters.category || '',
    minPrice: initialFilters.minPrice || '',
    maxPrice: initialFilters.maxPrice || '',
    inStock: initialFilters.inStock || false,
    active: initialFilters.active !== false,
    sortBy: initialFilters.sortBy || 'name',
    sortOrder: initialFilters.sortOrder || 'asc'
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange(filters);
    }, 500);

    return () => clearTimeout(timer);
  }, [filters, onFiltersChange]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleClear = () => {
    const clearedFilters = {
      search: '',
      category: '',
      minPrice: '',
      maxPrice: '',
      inStock: false,
      active: true,
      sortBy: 'name',
      sortOrder: 'asc'
    };
    setFilters(clearedFilters);
  };

  return (
    <div className="card mb-4">
      <div className="card-header">
        <div className="d-flex justify-content-between align-items-center">
          <h6 className="mb-0">
            <i className="fas fa-search me-2"></i>
            Filtros de Produtos
          </h6>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <i className={`fas fa-chevron-${showAdvanced ? 'up' : 'down'} me-2`}></i>
            {showAdvanced ? 'Menos filtros' : 'Mais filtros'}
          </button>
        </div>
      </div>
      
      <div className="card-body">
        <div className="row">
          <div className="col-md-6 mb-3">
            <label htmlFor="search" className="form-label">
              Buscar produtos
            </label>
            <div className="input-group">
              <span className="input-group-text">
                <i className="fas fa-search"></i>
              </span>
              <input
                type="text"
                className="form-control"
                id="search"
                name="search"
                value={filters.search}
                onChange={handleChange}
                placeholder="Nome, descrição ou SKU..."
              />
            </div>
          </div>

          <div className="col-md-3 mb-3">
            <label htmlFor="sortBy" className="form-label">
              Ordenar por
            </label>
            <select
              className="form-select"
              id="sortBy"
              name="sortBy"
              value={filters.sortBy}
              onChange={handleChange}
            >
              <option value="name">Nome</option>
              <option value="price">Preço</option>
              <option value="stock">Estoque</option>
              <option value="createdAt">Data de criação</option>
            </select>
          </div>

          <div className="col-md-3 mb-3">
            <label htmlFor="sortOrder" className="form-label">
              Ordem
            </label>
            <select
              className="form-select"
              id="sortOrder"
              name="sortOrder"
              value={filters.sortOrder}
              onChange={handleChange}
            >
              <option value="asc">Crescente</option>
              <option value="desc">Decrescente</option>
            </select>
          </div>
        </div>

        {showAdvanced && (
          <>
            <hr />
            <div className="row">
              <div className="col-md-4 mb-3">
                <label htmlFor="category" className="form-label">
                  Categoria
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="category"
                  name="category"
                  value={filters.category}
                  onChange={handleChange}
                  placeholder="Digite a categoria..."
                />
              </div>

              <div className="col-md-4 mb-3">
                <label htmlFor="minPrice" className="form-label">
                  Preço mínimo
                </label>
                <div className="input-group">
                  <span className="input-group-text">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    id="minPrice"
                    name="minPrice"
                    value={filters.minPrice}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="col-md-4 mb-3">
                <label htmlFor="maxPrice" className="form-label">
                  Preço máximo
                </label>
                <div className="input-group">
                  <span className="input-group-text">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    id="maxPrice"
                    name="maxPrice"
                    value={filters.maxPrice}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="inStock"
                    name="inStock"
                    checked={filters.inStock}
                    onChange={handleChange}
                  />
                  <label className="form-check-label" htmlFor="inStock">
                    Apenas produtos em estoque
                  </label>
                </div>
              </div>

              <div className="col-md-6">
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="active"
                    name="active"
                    checked={filters.active}
                    onChange={handleChange}
                  />
                  <label className="form-check-label" htmlFor="active">
                    Apenas produtos ativos
                  </label>
                </div>
              </div>
            </div>

            <hr />
            <div className="text-end">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handleClear}
              >
                <i className="fas fa-eraser me-2"></i>
                Limpar Filtros
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}