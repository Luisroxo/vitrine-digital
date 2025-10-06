import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCogs, faBoxes, faShoppingCart, faSync, faTools, faClock,
  faPlus, faList, faChartBar, faCog, faArrowLeft, faExclamationTriangle, 
  faHandshake, faCreditCard, faRocket
} from '@fortawesome/free-solid-svg-icons';
import BlingIntegration from '../components/BlingIntegration';
import OrderManagement from '../components/OrderManagement';
import PartnershipDashboard from '../components/PartnershipDashboard';
import BillingDashboard from '../components/BillingDashboard';
import BetaOnboarding from '../components/BetaOnboarding';

const Admin = () => {
  const [activeTab, setActiveTab] = useState('onboarding');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'onboarding':
        return <BetaOnboarding />;
      case 'orders':
        return <OrderManagement />;
      case 'bling':
        return <BlingIntegration />;
      case 'partnerships':
        return <PartnershipDashboard />;
      case 'billing':
        return <BillingDashboard />;
      case 'dashboard':
      default:
        return renderDashboard();
    }
  };

  const renderDashboard = () => (
    <>
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
                  <p className="text-muted mb-1">Total de produtos ativos</p>
                  <h4 className="mb-0">--</h4>
                </div>
                <FontAwesomeIcon icon={faBoxes} size="2x" className="text-muted" />
              </div>
              <div className="mt-3">
                <button className="btn btn-outline-primary btn-sm me-2">
                  <FontAwesomeIcon icon={faPlus} className="me-1" />
                  Adicionar
                </button>
                <button className="btn btn-outline-secondary btn-sm">
                  <FontAwesomeIcon icon={faList} className="me-1" />
                  Listar
                </button>
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
                  <p className="text-muted mb-1">Pedidos hoje</p>
                  <h4 className="mb-0">--</h4>
                </div>
                <FontAwesomeIcon icon={faShoppingCart} size="2x" className="text-muted" />
              </div>
              <div className="mt-3">
                <button 
                  className="btn btn-outline-primary btn-sm me-2"
                  onClick={() => setActiveTab('orders')}
                >
                  <FontAwesomeIcon icon={faList} className="me-1" />
                  Gerenciar
                </button>
                <button className="btn btn-outline-secondary btn-sm">
                  <FontAwesomeIcon icon={faChartBar} className="me-1" />
                  Relatórios
                </button>
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
                  <p className="text-muted mb-1">Última sincronização</p>
                  <h6 className="mb-0">--</h6>
                </div>
                <FontAwesomeIcon icon={faClock} size="2x" className="text-muted" />
              </div>
              <div className="mt-3">
                <button className="btn btn-outline-success btn-sm me-2">
                  <FontAwesomeIcon icon={faSync} className="me-1" />
                  Sincronizar
                </button>
                <button 
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setActiveTab('bling')}
                >
                  <FontAwesomeIcon icon={faCog} className="me-1" />
                  Configurar
                </button>
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
                Ferramentas Administrativas
              </h6>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <h6>Gestão de Conteúdo</h6>
                  <ul className="list-unstyled">
                    <li><a href="#" className="text-decoration-none">Gerenciar categorias</a></li>
                    <li><a href="#" className="text-decoration-none">Configurar promoções</a></li>
                    <li><a href="#" className="text-decoration-none">Personalizar layout</a></li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>Relatórios</h6>
                  <ul className="list-unstyled">
                    <li><a href="#" className="text-decoration-none">Vendas por período</a></li>
                    <li><a href="#" className="text-decoration-none">Produtos mais vendidos</a></li>
                    <li><a href="#" className="text-decoration-none">Análise de desempenho</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-12">
          <div className="alert alert-info" role="alert">
            <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
            <strong>Dica:</strong> Use o painel de integração Bling para sincronizar seus produtos e pedidos automaticamente.
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="container-fluid my-4">
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
          
          {/* Navegação por abas */}
          <ul className="nav nav-tabs mb-4">
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'onboarding' ? 'active' : ''}`}
                onClick={() => setActiveTab('onboarding')}
              >
                <FontAwesomeIcon icon={faRocket} className="me-2" />
                Onboarding
              </button>
            </li>
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                <FontAwesomeIcon icon={faChartBar} className="me-2" />
                Dashboard
              </button>
            </li>
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'orders' ? 'active' : ''}`}
                onClick={() => setActiveTab('orders')}
              >
                <FontAwesomeIcon icon={faShoppingCart} className="me-2" />
                Pedidos
              </button>
            </li>
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'bling' ? 'active' : ''}`}
                onClick={() => setActiveTab('bling')}
              >
                <FontAwesomeIcon icon={faSync} className="me-2" />
                Integração Bling
              </button>
            </li>
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'partnerships' ? 'active' : ''}`}
                onClick={() => setActiveTab('partnerships')}
              >
                <FontAwesomeIcon icon={faHandshake} className="me-2" />
                Parcerias 1:1
              </button>
            </li>
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'billing' ? 'active' : ''}`}
                onClick={() => setActiveTab('billing')}
              >
                <FontAwesomeIcon icon={faCreditCard} className="me-2" />
                Billing & Planos
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Conteúdo das abas */}
      {renderTabContent()}
    </div>
  );
};

export default Admin;