/**
 * Theme Engine Service
 * 
 * Sistema completo de personalização visual para tenants,
 * incluindo cores, tipografia, layout e componentes.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ThemeEngine {
  constructor() {
    this.themesPath = path.join(process.cwd(), 'public', 'themes');
    this.templatesPath = path.join(process.cwd(), 'templates');
    this.assetsPath = path.join(process.cwd(), 'public', 'assets');
    
    // Theme schema padrão
    this.defaultTheme = {
      // Identidade visual
      branding: {
        logo: null,
        favicon: null,
        company_name: '',
        tagline: ''
      },
      
      // Paleta de cores
      colors: {
        primary: '#007bff',
        secondary: '#6c757d',
        success: '#28a745',
        danger: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8',
        light: '#f8f9fa',
        dark: '#343a40',
        
        // Cores customizadas
        accent: '#ff6b6b',
        background: '#ffffff',
        surface: '#f8f9fa',
        text_primary: '#212529',
        text_secondary: '#6c757d',
        border: '#dee2e6'
      },
      
      // Tipografia
      typography: {
        font_family_primary: "'Roboto', sans-serif",
        font_family_secondary: "'Open Sans', sans-serif",
        font_family_heading: "'Poppins', sans-serif",
        
        font_sizes: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem',
          '4xl': '2.25rem',
          '5xl': '3rem'
        },
        
        font_weights: {
          thin: '100',
          light: '300',
          normal: '400',
          medium: '500',
          semibold: '600',
          bold: '700',
          extrabold: '800',
          black: '900'
        }
      },
      
      // Layout e espaçamento
      layout: {
        container_max_width: '1200px',
        header_height: '80px',
        sidebar_width: '250px',
        footer_height: '120px',
        
        spacing: {
          xs: '0.25rem',
          sm: '0.5rem',
          md: '1rem',
          lg: '1.5rem',
          xl: '2rem',
          '2xl': '3rem',
          '3xl': '4rem'
        },
        
        border_radius: {
          none: '0',
          sm: '0.125rem',
          base: '0.25rem',
          md: '0.375rem',
          lg: '0.5rem',
          xl: '0.75rem',
          '2xl': '1rem',
          full: '9999px'
        }
      },
      
      // Componentes específicos
      components: {
        header: {
          background: 'transparent',
          shadow: 'sm',
          sticky: true,
          transparent: false
        },
        
        hero: {
          background_type: 'color', // color, gradient, image
          background_value: '#007bff',
          text_align: 'center',
          padding: 'xl'
        },
        
        product_card: {
          shadow: 'md',
          border: true,
          border_radius: 'md',
          hover_effect: 'lift'
        },
        
        buttons: {
          primary_style: 'filled',
          border_radius: 'md',
          size: 'md'
        },
        
        carousel: {
          show_arrows: true,
          show_dots: true,
          autoplay: true,
          autoplay_speed: 5000
        }
      },
      
      // Configurações específicas da vitrine
      vitrine: {
        show_prices: true,
        show_stock: true,
        show_description: true,
        products_per_row: 4,
        pagination_type: 'numbers', // numbers, load_more, infinite
        
        filters: {
          show_categories: true,
          show_price_range: true,
          show_brands: true,
          show_search: true
        }
      },
      
      // Meta configurações
      meta: {
        created_at: null,
        updated_at: null,
        version: '1.0.0',
        custom_css: '',
        custom_js: ''
      }
    };
  }

  /**
   * Cria tema personalizado para um tenant
   */
  async createTenantTheme(tenantId, themeConfig = {}) {
    try {
      console.log(`🎨 Criando tema para tenant ${tenantId}`);
      
      // Mesclar com tema padrão
      const theme = this.mergeWithDefault(themeConfig);
      theme.meta.created_at = new Date().toISOString();
      theme.meta.updated_at = new Date().toISOString();
      
      // Gerar ID único para o tema
      const themeId = this.generateThemeId(tenantId);
      
      // Salvar tema
      await this.saveTheme(themeId, theme);
      
      // Gerar CSS compilado
      const css = await this.compileThemeCSS(theme);
      await this.saveCSSFile(themeId, css);
      
      console.log(`✅ Tema ${themeId} criado com sucesso`);
      
      return {
        theme_id: themeId,
        theme_config: theme,
        css_url: `/themes/${themeId}/style.css`,
        preview_url: `/themes/${themeId}/preview.html`
      };
      
    } catch (error) {
      console.error(`❌ Erro ao criar tema:`, error);
      throw error;
    }
  }

  /**
   * Atualiza tema existente
   */
  async updateTenantTheme(tenantId, themeUpdates) {
    try {
      console.log(`🔄 Atualizando tema do tenant ${tenantId}`);
      
      const themeId = this.generateThemeId(tenantId);
      
      // Carregar tema existente
      const currentTheme = await this.loadTheme(themeId);
      
      // Fazer merge das atualizações
      const updatedTheme = this.deepMerge(currentTheme, themeUpdates);
      updatedTheme.meta.updated_at = new Date().toISOString();
      
      // Salvar tema atualizado
      await this.saveTheme(themeId, updatedTheme);
      
      // Recompilar CSS
      const css = await this.compileThemeCSS(updatedTheme);
      await this.saveCSSFile(themeId, css);
      
      console.log(`✅ Tema ${themeId} atualizado com sucesso`);
      
      return {
        theme_id: themeId,
        theme_config: updatedTheme,
        css_url: `/themes/${themeId}/style.css`
      };
      
    } catch (error) {
      console.error(`❌ Erro ao atualizar tema:`, error);
      throw error;
    }
  }

  /**
   * Carrega tema de um tenant
   */
  async getTenantTheme(tenantId) {
    try {
      const themeId = this.generateThemeId(tenantId);
      const theme = await this.loadTheme(themeId);
      
      return {
        theme_id: themeId,
        theme_config: theme,
        css_url: `/themes/${themeId}/style.css`
      };
      
    } catch (error) {
      console.log(`⚠️ Tema não encontrado para tenant ${tenantId}, usando padrão`);
      
      // Retornar tema padrão se não existir
      return {
        theme_id: 'default',
        theme_config: this.defaultTheme,
        css_url: '/themes/default/style.css'
      };
    }
  }

  /**
   * Compila tema para CSS
   */
  async compileThemeCSS(theme) {
    try {
      console.log('🎨 Compilando tema para CSS...');
      
      const css = `
        /* ========================================
         * VITRINE DIGITAL - TEMA COMPILADO
         * Gerado automaticamente em ${new Date().toISOString()}
         * ========================================
         */
        
        /* Variáveis CSS */
        :root {
          /* Cores */
          --color-primary: ${theme.colors.primary};
          --color-secondary: ${theme.colors.secondary};
          --color-success: ${theme.colors.success};
          --color-danger: ${theme.colors.danger};
          --color-warning: ${theme.colors.warning};
          --color-info: ${theme.colors.info};
          --color-light: ${theme.colors.light};
          --color-dark: ${theme.colors.dark};
          --color-accent: ${theme.colors.accent};
          --color-background: ${theme.colors.background};
          --color-surface: ${theme.colors.surface};
          --color-text-primary: ${theme.colors.text_primary};
          --color-text-secondary: ${theme.colors.text_secondary};
          --color-border: ${theme.colors.border};
          
          /* Tipografia */
          --font-family-primary: ${theme.typography.font_family_primary};
          --font-family-secondary: ${theme.typography.font_family_secondary};
          --font-family-heading: ${theme.typography.font_family_heading};
          
          /* Layout */
          --container-max-width: ${theme.layout.container_max_width};
          --header-height: ${theme.layout.header_height};
          --sidebar-width: ${theme.layout.sidebar_width};
          --footer-height: ${theme.layout.footer_height};
        }
        
        /* Reset e base */
        * {
          box-sizing: border-box;
        }
        
        body {
          font-family: var(--font-family-primary);
          color: var(--color-text-primary);
          background-color: var(--color-background);
          margin: 0;
          padding: 0;
          line-height: 1.6;
        }
        
        /* Container principal */
        .container {
          max-width: var(--container-max-width);
          margin: 0 auto;
          padding: 0 1rem;
        }
        
        /* Header */
        .header {
          height: var(--header-height);
          background-color: ${theme.components.header.background === 'transparent' ? 'transparent' : theme.components.header.background};
          ${theme.components.header.sticky ? 'position: sticky; top: 0; z-index: 1000;' : ''}
          ${theme.components.header.shadow ? `box-shadow: 0 2px 4px rgba(0,0,0,0.1);` : ''}
        }
        
        /* Hero section */
        .hero {
          background: ${this.getHeroBackground(theme.components.hero)};
          text-align: ${theme.components.hero.text_align};
          padding: ${theme.layout.spacing[theme.components.hero.padding] || '2rem'};
          color: white;
        }
        
        /* Produtos */
        .products-grid {
          display: grid;
          grid-template-columns: repeat(${theme.vitrine.products_per_row}, 1fr);
          gap: ${theme.layout.spacing.lg};
          margin: ${theme.layout.spacing.xl} 0;
        }
        
        .product-card {
          background: var(--color-surface);
          border-radius: ${theme.layout.border_radius[theme.components.product_card.border_radius]};
          ${theme.components.product_card.border ? 'border: 1px solid var(--color-border);' : ''}
          ${theme.components.product_card.shadow ? 'box-shadow: 0 4px 6px rgba(0,0,0,0.1);' : ''}
          overflow: hidden;
          transition: transform 0.2s ease;
        }
        
        ${theme.components.product_card.hover_effect === 'lift' ? `
        .product-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 15px rgba(0,0,0,0.15);
        }
        ` : ''}
        
        /* Botões */
        .btn-primary {
          background-color: var(--color-primary);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: ${theme.layout.border_radius[theme.components.buttons.border_radius]};
          font-weight: ${theme.typography.font_weights.medium};
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
          background-color: color-mix(in srgb, var(--color-primary) 85%, black);
        }
        
        /* Carousel */
        .carousel {
          position: relative;
          overflow: hidden;
          border-radius: ${theme.layout.border_radius.lg};
        }
        
        ${!theme.components.carousel.show_arrows ? `
        .carousel .carousel-control-prev,
        .carousel .carousel-control-next {
          display: none;
        }
        ` : ''}
        
        ${!theme.components.carousel.show_dots ? `
        .carousel .carousel-indicators {
          display: none;
        }
        ` : ''}
        
        /* Responsividade */
        @media (max-width: 768px) {
          .products-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .container {
            padding: 0 0.5rem;
          }
        }
        
        @media (max-width: 480px) {
          .products-grid {
            grid-template-columns: 1fr;
          }
        }
        
        /* CSS Customizado do usuário */
        ${theme.meta.custom_css || ''}
      `;
      
      return css;
      
    } catch (error) {
      console.error('❌ Erro ao compilar CSS:', error);
      throw error;
    }
  }

  /**
   * Gera background do hero baseado na configuração
   */
  getHeroBackground(heroConfig) {
    switch (heroConfig.background_type) {
      case 'gradient':
        return `linear-gradient(135deg, ${heroConfig.background_value})`;
      case 'image':
        return `url('${heroConfig.background_value}') center/cover no-repeat`;
      default:
        return heroConfig.background_value;
    }
  }

  /**
   * Gera ID único para o tema
   */
  generateThemeId(tenantId) {
    return `tenant-${tenantId}`;
  }

  /**
   * Salva tema no filesystem
   */
  async saveTheme(themeId, theme) {
    try {
      const themeDir = path.join(this.themesPath, themeId);
      await fs.mkdir(themeDir, { recursive: true });
      
      const themeFile = path.join(themeDir, 'theme.json');
      await fs.writeFile(themeFile, JSON.stringify(theme, null, 2));
      
    } catch (error) {
      throw new Error(`Erro ao salvar tema: ${error.message}`);
    }
  }

  /**
   * Carrega tema do filesystem
   */
  async loadTheme(themeId) {
    try {
      const themeFile = path.join(this.themesPath, themeId, 'theme.json');
      const themeData = await fs.readFile(themeFile, 'utf8');
      return JSON.parse(themeData);
      
    } catch (error) {
      throw new Error(`Tema não encontrado: ${themeId}`);
    }
  }

  /**
   * Salva arquivo CSS compilado
   */
  async saveCSSFile(themeId, css) {
    try {
      const themeDir = path.join(this.themesPath, themeId);
      await fs.mkdir(themeDir, { recursive: true });
      
      const cssFile = path.join(themeDir, 'style.css');
      await fs.writeFile(cssFile, css);
      
    } catch (error) {
      throw new Error(`Erro ao salvar CSS: ${error.message}`);
    }
  }

  /**
   * Faz merge com tema padrão
   */
  mergeWithDefault(themeConfig) {
    return this.deepMerge(this.defaultTheme, themeConfig);
  }

  /**
   * Deep merge de objetos
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Lista todos os temas disponíveis
   */
  async listThemes() {
    try {
      const themes = await fs.readdir(this.themesPath);
      const themeList = [];
      
      for (const themeId of themes) {
        try {
          const theme = await this.loadTheme(themeId);
          themeList.push({
            theme_id: themeId,
            name: theme.branding?.company_name || themeId,
            created_at: theme.meta?.created_at,
            updated_at: theme.meta?.updated_at
          });
        } catch (error) {
          // Ignorar temas com erro
          console.warn(`⚠️ Erro ao carregar tema ${themeId}:`, error.message);
        }
      }
      
      return themeList;
      
    } catch (error) {
      console.error('❌ Erro ao listar temas:', error);
      return [];
    }
  }

  /**
   * Remove tema de um tenant
   */
  async deleteTenantTheme(tenantId) {
    try {
      const themeId = this.generateThemeId(tenantId);
      const themeDir = path.join(this.themesPath, themeId);
      
      await fs.rm(themeDir, { recursive: true, force: true });
      
      console.log(`✅ Tema ${themeId} removido com sucesso`);
      return true;
      
    } catch (error) {
      console.error(`❌ Erro ao remover tema:`, error);
      throw error;
    }
  }
}

module.exports = ThemeEngine;