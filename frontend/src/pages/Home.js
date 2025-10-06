import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCogs } from '@fortawesome/free-solid-svg-icons';
import ProductsCarousel from '../components/ProductsCarousel';

function Home() {
  return (
    <div className="Home">
      <header className="bg-primary text-white py-4 mb-4">
        <div className="container">
          <div className="d-flex justify-content-between align-items-center">
            <div className="flex-grow-1 text-center">
              <h1 className="display-4 mb-0">Vitrine Digital</h1>
              <p className="lead mb-0">Os melhores produtos com os melhores preços</p>
            </div>
            <div>
              <a 
                href="/admin" 
                className="btn btn-outline-light btn-sm"
                title="Painel Administrativo"
              >
                <FontAwesomeIcon icon={faCogs} className="me-2" />
                Admin
              </a>
            </div>
          </div>
        </div>
      </header>
      
      <main>
        <ProductsCarousel />
      </main>
      
      <footer className="bg-dark text-white py-4 mt-5">
        <div className="container">
          <div className="row">
            <div className="col-md-6">
              <h5>Vitrine Digital</h5>
              <p>Encontre os melhores produtos com preços incríveis.</p>
            </div>
            <div className="col-md-6">
              <h5>Contato</h5>
              <p>Email: contato@vitrinedigital.com</p>
              <p>Telefone: (11) 99999-9999</p>
            </div>
          </div>
          <hr />
          <div className="text-center">
            <small>&copy; 2023 Vitrine Digital. Todos os direitos reservados.</small>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;