import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCogs, faBoxes, faShoppingCart, faSync, faTools, faClock,
  faPlus, faList, faChartBar, faCog, faArrowLeft, faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import BlingIntegration from '../components/BlingIntegration';

const Admin = () => {
  return (
    <div className="container my-5">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>
              <FontAwesomeIcon icon={faCogs} className="me-2" />
              Painel Administrativo
            </h2>
            <nav aria-label="breadcrumb">
              <ol className="breadcrumb">
                <li className="breadcrumb-item">
                  <a href="/" className="text-decoration-none">Início</a>
                </li>
                <li className="breadcrumb-item active" aria-current="page">
                  Admin
                </li>
              </ol>
            </nav>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12 mb-4">
          <BlingIntegration />
        </div>
      </div>

      <div className="row">
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">
                <FontAwesomeIcon icon={faBoxes} className="me-2" />
                Produtos
              </h6>
            </div>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="h4 mb-0">156</div>
                  <small className="text-muted">Total de produtos</small>
                </div>
                <FontAwesomeIcon icon={faBoxes} size="2x" className="text-primary" />
              </div>
              <hr />
              <div className="row text-center">
                <div className="col">
                  <div className="h6 mb-0">134</div>
                  <small className="text-success">Ativos</small>
                </div>
                <div className="col">
                  <div className="h6 mb-0">22</div>
                  <small className="text-warning">Sem estoque</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">
                <FontAwesomeIcon icon={faShoppingCart} className="me-2" />
                Pedidos
              </h6>
            </div>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="h4 mb-0">42</div>
                  <small className="text-muted">Total de pedidos</small>
                </div>
                <FontAwesomeIcon icon={faShoppingCart} size="2x" className="text-success" />
              </div>
              <hr />
              <div className="row text-center">
                <div className="col">
                  <div className="h6 mb-0">38</div>
                  <small className="text-success">Concluídos</small>
                </div>
                <div className="col">
                  <div className="h6 mb-0">4</div>
                  <small className="text-primary">Pendentes</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">
                <FontAwesomeIcon icon={faSync} className="me-2" />
                Sincronização
              </h6>
            </div>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="h4 mb-0">
                    <span className="badge bg-success">OK</span>
                  </div>
                  <small className="text-muted">Status da sincronização</small>
                </div>
                <FontAwesomeIcon icon={faSync} size="2x" className="text-info" />
              </div>
              <hr />
              <div className="text-center">
                <small className="text-muted">
                  Última sincronização:<br />
                  Hoje às 14:32
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">
                <FontAwesomeIcon icon={faTools} className="me-2" />
                Ferramentas de Administração
              </h6>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-3">
                  <div className="d-grid">
                    <button className="btn btn-outline-primary">
                      <FontAwesomeIcon icon={faPlus} className="me-2" />
                      Adicionar Produto
                    </button>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="d-grid">
                    <button className="btn btn-outline-info">
                      <FontAwesomeIcon icon={faList} className="me-2" />
                      Gerenciar Categorias
                    </button>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="d-grid">
                    <button className="btn btn-outline-warning">
                      <FontAwesomeIcon icon={faChartBar} className="me-2" />
                      Relatórios
                    </button>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="d-grid">
                    <button className="btn btn-outline-secondary">
                      <FontAwesomeIcon icon={faCog} className="me-2" />
                      Configurações
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">
                <FontAwesomeIcon icon={faClock} className="me-2" />
                Log de Atividades Recentes
              </h6>
            </div>
            <div className="card-body">
              <div className="list-group list-group-flush">
                <div className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <FontAwesomeIcon icon={faSync} className="text-success me-2" />
                    Produtos sincronizados com Bling ERP
                    <br />
                    <small className="text-muted">156 produtos atualizados</small>
                  </div>
                  <small className="text-muted">há 2 horas</small>
                </div>
                
                <div className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <FontAwesomeIcon icon={faShoppingCart} className="text-primary me-2" />
                    Novo pedido recebido
                    <br />
                    <small className="text-muted">Pedido #1234 - R$ 299,90</small>
                  </div>
                  <small className="text-muted">há 4 horas</small>
                </div>
                
                <div className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-warning me-2" />
                    Produto com estoque baixo
                    <br />
                    <small className="text-muted">Smartphone XYZ - 2 unidades restantes</small>
                  </div>
                  <small className="text-muted">há 6 horas</small>
                </div>
              </div>
              
              <div className="text-center mt-3">
                <button className="btn btn-sm btn-outline-secondary">
                  <FontAwesomeIcon icon={faPlus} className="me-2" />
                  Ver todos os logs
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Link para voltar ao site */}
      <div className="row mt-4">
        <div className="col-12 text-center">
          <a href="/" className="btn btn-outline-primary">
            <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
            Voltar à Vitrine
          </a>
        </div>
      </div>
    </div>
  );
};

export default Admin;