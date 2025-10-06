/**
 * Seeds para templates de tema pré-definidos
 */
exports.seed = function(knex) {
  // Primeiro limpar a tabela
  return knex('theme_templates').del()
    .then(function () {
      // Inserir templates padrão
      return knex('theme_templates').insert([
        
        // Template Padrão - Gratuito
        {
          template_id: 'default',
          name: 'Padrão',
          description: 'Template limpo e moderno, ideal para começar. Inclui todas as funcionalidades básicas.',
          category: 'basic',
          default_config: JSON.stringify({
            branding: {
              company_name: '',
              tagline: '',
              logo: null,
              favicon: null
            },
            colors: {
              primary: '#0066cc',
              secondary: '#6c757d',
              accent: '#28a745',
              background: '#ffffff',
              surface: '#f8f9fa',
              text: {
                primary: '#212529',
                secondary: '#6c757d',
                light: '#ffffff'
              },
              border: '#dee2e6',
              shadow: 'rgba(0, 0, 0, 0.1)'
            },
            typography: {
              font_family: {
                heading: 'Inter, sans-serif',
                body: 'Inter, sans-serif'
              },
              font_sizes: {
                xs: '0.75rem',
                sm: '0.875rem',
                base: '1rem',
                lg: '1.125rem',
                xl: '1.25rem',
                '2xl': '1.5rem',
                '3xl': '1.875rem',
                '4xl': '2.25rem'
              },
              font_weights: {
                normal: 400,
                medium: 500,
                semibold: 600,
                bold: 700
              }
            },
            layout: {
              container_width: '1200px',
              sidebar_width: '280px',
              header_height: '80px',
              footer_height: '200px',
              border_radius: '8px',
              spacing: {
                xs: '0.5rem',
                sm: '1rem',
                md: '1.5rem',
                lg: '2rem',
                xl: '3rem'
              }
            },
            components: {
              buttons: {
                border_radius: '6px',
                padding_x: '1.5rem',
                padding_y: '0.75rem',
                font_weight: 500
              },
              cards: {
                border_radius: '12px',
                shadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                padding: '1.5rem'
              },
              inputs: {
                border_radius: '6px',
                border_width: '1px',
                padding_x: '1rem',
                padding_y: '0.75rem'
              }
            }
          }),
          features: JSON.stringify([
            'Layout responsivo',
            'Cores personalizáveis',
            'Tipografia configurável',
            'Componentes básicos',
            'Header e footer padrão'
          ]),
          is_premium: false,
          price: null,
          active: true
        },

        // Template E-commerce Pro - Premium
        {
          template_id: 'ecommerce-pro',
          name: 'E-commerce Pro',
          description: 'Template profissional otimizado para vendas online. Inclui carrosséis avançados, filtros e checkout otimizado.',
          category: 'ecommerce',
          default_config: JSON.stringify({
            branding: {
              company_name: '',
              tagline: '',
              logo: null,
              favicon: null
            },
            colors: {
              primary: '#e74c3c',
              secondary: '#34495e',
              accent: '#f39c12',
              background: '#ffffff',
              surface: '#f7f7f7',
              text: {
                primary: '#2c3e50',
                secondary: '#7f8c8d',
                light: '#ffffff'
              },
              border: '#ecf0f1',
              shadow: 'rgba(0, 0, 0, 0.15)'
            },
            typography: {
              font_family: {
                heading: 'Poppins, sans-serif',
                body: 'Open Sans, sans-serif'
              },
              font_sizes: {
                xs: '0.75rem',
                sm: '0.875rem',
                base: '1rem',
                lg: '1.125rem',
                xl: '1.25rem',
                '2xl': '1.5rem',
                '3xl': '2rem',
                '4xl': '2.5rem'
              },
              font_weights: {
                normal: 400,
                medium: 500,
                semibold: 600,
                bold: 700
              }
            },
            layout: {
              container_width: '1400px',
              sidebar_width: '320px',
              header_height: '100px',
              footer_height: '250px',
              border_radius: '10px',
              spacing: {
                xs: '0.5rem',
                sm: '1rem',
                md: '1.5rem',
                lg: '2.5rem',
                xl: '4rem'
              }
            },
            components: {
              buttons: {
                border_radius: '50px',
                padding_x: '2rem',
                padding_y: '1rem',
                font_weight: 600
              },
              cards: {
                border_radius: '15px',
                shadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                padding: '2rem'
              },
              inputs: {
                border_radius: '8px',
                border_width: '2px',
                padding_x: '1.25rem',
                padding_y: '1rem'
              }
            }
          }),
          features: JSON.stringify([
            'Design otimizado para conversão',
            'Carrossel avançado de produtos',
            'Filtros inteligentes',
            'Checkout otimizado',
            'Seções promocionais',
            'Avaliações e reviews',
            'Wishlist integrada',
            'Comparador de produtos'
          ]),
          is_premium: true,
          price: 299.90,
          active: true
        },

        // Template Minimalista - Gratuito
        {
          template_id: 'minimal',
          name: 'Minimalista',
          description: 'Design clean e minimalista. Perfeito para marcas que valorizam simplicidade e elegância.',
          category: 'minimal',
          default_config: JSON.stringify({
            branding: {
              company_name: '',
              tagline: '',
              logo: null,
              favicon: null
            },
            colors: {
              primary: '#000000',
              secondary: '#666666',
              accent: '#333333',
              background: '#ffffff',
              surface: '#fafafa',
              text: {
                primary: '#000000',
                secondary: '#666666',
                light: '#ffffff'
              },
              border: '#e0e0e0',
              shadow: 'rgba(0, 0, 0, 0.05)'
            },
            typography: {
              font_family: {
                heading: 'Playfair Display, serif',
                body: 'Source Sans Pro, sans-serif'
              },
              font_sizes: {
                xs: '0.75rem',
                sm: '0.875rem',
                base: '1rem',
                lg: '1.125rem',
                xl: '1.25rem',
                '2xl': '1.5rem',
                '3xl': '1.875rem',
                '4xl': '2.25rem'
              },
              font_weights: {
                normal: 300,
                medium: 400,
                semibold: 600,
                bold: 700
              }
            },
            layout: {
              container_width: '1000px',
              sidebar_width: '250px',
              header_height: '70px',
              footer_height: '150px',
              border_radius: '0px',
              spacing: {
                xs: '0.5rem',
                sm: '1rem',
                md: '2rem',
                lg: '3rem',
                xl: '4rem'
              }
            },
            components: {
              buttons: {
                border_radius: '0px',
                padding_x: '2rem',
                padding_y: '0.875rem',
                font_weight: 400
              },
              cards: {
                border_radius: '0px',
                shadow: 'none',
                padding: '2rem'
              },
              inputs: {
                border_radius: '0px',
                border_width: '1px',
                padding_x: '1rem',
                padding_y: '0.875rem'
              }
            }
          }),
          features: JSON.stringify([
            'Design ultra limpo',
            'Tipografia elegante',
            'Espaçamento generoso',
            'Foco no conteúdo',
            'Carregamento rápido',
            'Mobile-first'
          ]),
          is_premium: false,
          price: null,
          active: true
        },

        // Template Fashion - Premium
        {
          template_id: 'fashion',
          name: 'Fashion',
          description: 'Template elegante para moda e lifestyle. Design sofisticado com galeria de imagens avançada.',
          category: 'premium',
          default_config: JSON.stringify({
            branding: {
              company_name: '',
              tagline: '',
              logo: null,
              favicon: null
            },
            colors: {
              primary: '#c9a96e',
              secondary: '#8b7355',
              accent: '#d4af37',
              background: '#ffffff',
              surface: '#f9f7f4',
              text: {
                primary: '#2c2c2c',
                secondary: '#8b7355',
                light: '#ffffff'
              },
              border: '#e8e2d4',
              shadow: 'rgba(139, 115, 85, 0.15)'
            },
            typography: {
              font_family: {
                heading: 'Cormorant Garamond, serif',
                body: 'Lato, sans-serif'
              },
              font_sizes: {
                xs: '0.75rem',
                sm: '0.875rem',
                base: '1rem',
                lg: '1.125rem',
                xl: '1.25rem',
                '2xl': '1.75rem',
                '3xl': '2.25rem',
                '4xl': '3rem'
              },
              font_weights: {
                normal: 300,
                medium: 400,
                semibold: 600,
                bold: 700
              }
            },
            layout: {
              container_width: '1300px',
              sidebar_width: '300px',
              header_height: '120px',
              footer_height: '300px',
              border_radius: '0px',
              spacing: {
                xs: '0.75rem',
                sm: '1.25rem',
                md: '2rem',
                lg: '3rem',
                xl: '5rem'
              }
            },
            components: {
              buttons: {
                border_radius: '0px',
                padding_x: '3rem',
                padding_y: '1rem',
                font_weight: 300
              },
              cards: {
                border_radius: '0px',
                shadow: '0 8px 32px rgba(139, 115, 85, 0.1)',
                padding: '3rem'
              },
              inputs: {
                border_radius: '0px',
                border_width: '1px',
                padding_x: '1.5rem',
                padding_y: '1rem'
              }
            }
          }),
          features: JSON.stringify([
            'Design premium para moda',
            'Galeria de imagens avançada',
            'Lookbook integrado',
            'Filtros por cor/tamanho',
            'Size guide interativo',
            'Blog de estilo integrado',
            'Instagram feed',
            'Newsletter premium'
          ]),
          is_premium: true,
          price: 499.90,
          active: true
        }

      ]);
    });
};