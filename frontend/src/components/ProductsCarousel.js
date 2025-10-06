import React, { useState, useEffect } from 'react';
import Carousel from 'react-multi-carousel';
import 'react-multi-carousel/lib/styles.css';
import api from '../services/api';

function ProductsCarousel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [popularProducts, setPopularProducts] = useState([]);
  const [offerProducts, setOfferProducts] = useState([]);

  const responsive = {
    desktop: {
      breakpoint: { max: 3000, min: 1024 },
      items: 4,
      slidesToSlide: 3,
    },
    tablet: {
      breakpoint: { max: 1024, min: 464 },
      items: 2,
      slidesToSlide: 2,
    },
    mobile: {
      breakpoint: { max: 464, min: 0 },
      items: 1,
      slidesToSlide: 1,
    },
  };

  useEffect(() => {
    Promise.all([
      api.get('/products/popular'),
      api.get('/products/offers')
    ])
    .then(([popularResponse, offersResponse]) => {
      setPopularProducts(popularResponse.data.popular_products || []);
      setOfferProducts(offersResponse.data.price_products || []);
      setLoading(false);
    })
    .catch(err => {
      console.error('Erro ao carregar produtos:', err);
      setError('Erro ao carregar produtos');
      setLoading(false);
    });
  }, []);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="loading"></div>
        <p>Carregando produtos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger text-center">
        <h4>Oops! Algo deu errado</h4>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="container-content">
      {/* Seção de Produtos Mais Populares */}
      <section className="mb-5">
        <div className="container">
          <h4>Vitrine de Mais Populares</h4>
        </div>
        <h5>Mais Vendidos</h5>
        <div className="container py-2">
          <Carousel
            responsive={responsive}
            infinite={true}
            autoPlay={true}
            autoPlaySpeed={3000}
            keyBoardControl={true}
            customTransition="all .5s"
            transitionDuration={500}
            containerClass="carousel-container"
            removeArrowOnDeviceType={["tablet", "mobile"]}
            itemClass="px-2"
          >
            {popularProducts.map((product, index) => (
              <div key={product.id} className="card h-100 shadow-sm">
                <div className="position-relative">
                  <img 
                    src={product.image_src} 
                    alt={product.name}
                    className="card-img-top"
                    style={{ height: '200px', objectFit: 'cover' }}
                  />
                  <div className="position-count position-absolute top-0 start-0 m-2">
                    <span>{index + 1}º</span>
                  </div>
                </div>
                <div className="card-body">
                  <h6 className="card-title">{product.name}</h6>
                  <div className="product-oldprice">
                    {formatPrice(product.oldprice)}
                  </div>
                  <div className="product-price">
                    Por <span>{formatPrice(product.price)}</span>
                  </div>
                  <small className="text-muted">
                    {product.count}x {formatPrice(product.price / product.count)}
                  </small>
                </div>
              </div>
            ))}
          </Carousel>
        </div>
      </section>

      {/* Seção de Ofertas */}
      <section>
        <div className="container py-5">
          <h4>Vitrine de Ofertas</h4>
        </div>
        <h5>Produtos que baixaram de preço</h5>
        <div className="container py-2">
          <Carousel
            responsive={responsive}
            infinite={true}
            autoPlay={true}
            autoPlaySpeed={4000}
            keyBoardControl={true}
            customTransition="all .5s"
            transitionDuration={500}
            containerClass="carousel-container"
            removeArrowOnDeviceType={["tablet", "mobile"]}
            itemClass="px-2"
          >
            {offerProducts.map((product) => (
              <div key={product.id} className="card h-100 shadow-sm">
                <div className="position-relative">
                  <div className="product-discount">
                    {product.discount}%
                  </div>
                  <img 
                    src={product.image_src} 
                    alt={product.name}
                    className="card-img-top"
                    style={{ height: '200px', objectFit: 'cover' }}
                  />
                </div>
                <div className="card-body">
                  <h6 className="card-title">{product.name}</h6>
                  <div className="product-oldprice">
                    {formatPrice(product.oldprice)}
                  </div>
                  <div className="product-price">
                    Por <span>{formatPrice(product.price)}</span>
                  </div>
                  <small className="text-muted">
                    {product.count}x {formatPrice(product.price / product.count)}
                  </small>
                </div>
              </div>
            ))}
          </Carousel>
        </div>
      </section>
    </div>
  );
}

export default ProductsCarousel;