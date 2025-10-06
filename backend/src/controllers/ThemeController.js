const { body, param, validationResult } = require('express-validator');
const ThemeEngine = require('../services/theme/ThemeEngine');
const AssetManager = require('../services/theme/AssetManager');
const multer = require('multer');
const path = require('path');

class ThemeController {
  constructor() {
    this.themeEngine = new ThemeEngine();
    this.assetManager = new AssetManager();
    
    // Configurar multer para upload de arquivos
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
      },
      fileFilter: (req, file, cb) => {
        this.validateUploadFile(file, cb);
      }
    });
  }

  /**
   * Cria ou atualiza tema de um tenant
   * PUT /api/tenants/:tenantId/theme
   */
  async updateTheme(req, res) {
    try {
      // Validação
      await this.validateThemeUpdate(req);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { tenantId } = req.params;
      const themeConfig = req.body;

      console.log(`🎨 API: Atualizando tema do tenant ${tenantId}`);

      // Verificar se tema já existe
      let result;
      try {
        const existingTheme = await this.themeEngine.getTenantTheme(tenantId);
        result = await this.themeEngine.updateTenantTheme(tenantId, themeConfig);
      } catch (error) {
        // Se não existe, criar novo
        result = await this.themeEngine.createTenantTheme(tenantId, themeConfig);
      }
      
      res.json({
        success: true,
        message: 'Tema atualizado com sucesso',
        data: result
      });
      
    } catch (error) {
      console.error('❌ Erro ao atualizar tema:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Obtém tema de um tenant
   * GET /api/tenants/:tenantId/theme
   */
  async getTheme(req, res) {
    try {
      const { tenantId } = req.params;

      console.log(`🔍 API: Buscando tema do tenant ${tenantId}`);

      const theme = await this.themeEngine.getTenantTheme(tenantId);
      
      res.json({
        success: true,
        data: theme
      });
      
    } catch (error) {
      console.error('❌ Erro ao buscar tema:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Upload de asset (logo, imagem de fundo, etc)
   * POST /api/tenants/:tenantId/assets
   */
  async uploadAsset(req, res) {
    try {
      const { tenantId } = req.params;
      const { asset_type } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'Arquivo não fornecido'
        });
      }

      if (!asset_type) {
        return res.status(400).json({
          success: false,
          message: 'Tipo de asset é obrigatório'
        });
      }

      console.log(`📤 API: Upload de ${asset_type} para tenant ${tenantId}`);

      const result = await this.assetManager.uploadAsset(
        tenantId, 
        file, 
        asset_type,
        req.body.metadata ? JSON.parse(req.body.metadata) : {}
      );
      
      res.status(201).json({
        success: true,
        message: 'Asset enviado com sucesso',
        data: result
      });
      
    } catch (error) {
      console.error('❌ Erro no upload de asset:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Lista assets de um tenant
   * GET /api/tenants/:tenantId/assets
   */
  async getAssets(req, res) {
    try {
      const { tenantId } = req.params;
      const { type } = req.query;

      console.log(`📋 API: Listando assets do tenant ${tenantId}`);

      const assets = await this.assetManager.getTenantAssets(tenantId, type);
      
      res.json({
        success: true,
        data: {
          tenant_id: tenantId,
          assets: assets,
          total: assets.length
        }
      });
      
    } catch (error) {
      console.error('❌ Erro ao listar assets:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Remove asset de um tenant
   * DELETE /api/tenants/:tenantId/assets/:fileName
   */
  async deleteAsset(req, res) {
    try {
      const { tenantId, fileName } = req.params;

      console.log(`🗑️ API: Removendo asset ${fileName} do tenant ${tenantId}`);

      await this.assetManager.deleteAsset(tenantId, fileName);
      
      res.json({
        success: true,
        message: 'Asset removido com sucesso'
      });
      
    } catch (error) {
      console.error('❌ Erro ao remover asset:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Preview do asset no contexto do tema
   * GET /api/tenants/:tenantId/assets/:fileName/preview
   */
  async getAssetPreview(req, res) {
    try {
      const { tenantId, fileName } = req.params;
      const { asset_type } = req.query;

      console.log(`🖼️ API: Preview do asset ${fileName}`);

      const preview = await this.assetManager.generateAssetPreview(
        tenantId, 
        asset_type, 
        fileName
      );
      
      res.json({
        success: true,
        data: preview
      });
      
    } catch (error) {
      console.error('❌ Erro ao gerar preview:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Obtém tema compilado (CSS)
   * GET /api/tenants/:tenantId/theme/compiled
   */
  async getCompiledTheme(req, res) {
    try {
      const { tenantId } = req.params;

      console.log(`📦 API: Tema compilado do tenant ${tenantId}`);

      const theme = await this.themeEngine.getTenantTheme(tenantId);
      const css = await this.themeEngine.compileThemeCSS(theme.theme_config);
      
      // Retornar CSS com header correto
      res.setHeader('Content-Type', 'text/css');
      res.send(css);
      
    } catch (error) {
      console.error('❌ Erro ao compilar tema:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Preview completo do tema
   * GET /api/tenants/:tenantId/theme/preview
   */
  async getThemePreview(req, res) {
    try {
      const { tenantId } = req.params;

      console.log(`🎭 API: Preview completo do tema ${tenantId}`);

      const theme = await this.themeEngine.getTenantTheme(tenantId);
      const css = await this.themeEngine.compileThemeCSS(theme.theme_config);
      
      // Gerar HTML de preview
      const previewHtml = this.generatePreviewHTML(theme.theme_config, css);
      
      res.setHeader('Content-Type', 'text/html');
      res.send(previewHtml);
      
    } catch (error) {
      console.error('❌ Erro no preview do tema:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Reset tema para padrão
   * POST /api/tenants/:tenantId/theme/reset
   */
  async resetTheme(req, res) {
    try {
      const { tenantId } = req.params;

      console.log(`🔄 API: Reset do tema ${tenantId}`);

      // Remover tema customizado
      await this.themeEngine.deleteTenantTheme(tenantId);
      
      // Retornar tema padrão
      const defaultTheme = await this.themeEngine.getTenantTheme(tenantId);
      
      res.json({
        success: true,
        message: 'Tema resetado para padrão',
        data: defaultTheme
      });
      
    } catch (error) {
      console.error('❌ Erro ao resetar tema:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Lista templates disponíveis
   * GET /api/theme/templates
   */
  async getTemplates(req, res) {
    try {
      console.log('📋 API: Listando templates disponíveis');

      const templates = await this.getAvailableTemplates();
      
      res.json({
        success: true,
        data: {
          templates: templates,
          total: templates.length
        }
      });
      
    } catch (error) {
      console.error('❌ Erro ao listar templates:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Validações para atualização de tema
   */
  async validateThemeUpdate(req) {
    return Promise.all([
      param('tenantId')
        .isInt({ min: 1 })
        .withMessage('ID do tenant deve ser um número válido')
        .run(req),
        
      body('colors')
        .optional()
        .isObject()
        .withMessage('Cores devem ser um objeto')
        .run(req),
        
      body('typography')
        .optional()
        .isObject()
        .withMessage('Tipografia deve ser um objeto')
        .run(req),
        
      body('layout')
        .optional()
        .isObject()
        .withMessage('Layout deve ser um objeto')
        .run(req)
    ]);
  }

  /**
   * Valida arquivo de upload
   */
  validateUploadFile(file, cb) {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'image/x-icon', 'image/vnd.microsoft.icon'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  }

  /**
   * Gera HTML de preview completo
   */
  generatePreviewHTML(themeConfig, css) {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview - ${themeConfig.branding?.company_name || 'Vitrine Digital'}</title>
    <style>${css}</style>
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="container">
            <div style="display: flex; align-items: center; justify-content: space-between; height: 100%;">
                <div class="logo">
                    ${themeConfig.branding?.logo ? 
                      `<img src="${themeConfig.branding.logo}" alt="Logo" style="max-height: 60px;">` :
                      `<h2 style="margin: 0; color: var(--color-primary);">${themeConfig.branding?.company_name || 'Sua Empresa'}</h2>`
                    }
                </div>
                <nav>
                    <a href="#" style="margin: 0 15px; color: var(--color-text-primary); text-decoration: none;">Início</a>
                    <a href="#" style="margin: 0 15px; color: var(--color-text-primary); text-decoration: none;">Produtos</a>
                    <a href="#" style="margin: 0 15px; color: var(--color-text-primary); text-decoration: none;">Contato</a>
                </nav>
            </div>
        </div>
    </header>

    <!-- Hero Section -->
    <section class="hero">
        <div class="container">
            <h1 style="font-family: var(--font-family-heading); margin-bottom: 1rem;">
                ${themeConfig.branding?.company_name || 'Bem-vindo à Nossa Loja'}
            </h1>
            <p style="font-size: 1.2rem; margin-bottom: 2rem;">
                ${themeConfig.branding?.tagline || 'Produtos de qualidade com os melhores preços'}
            </p>
            <button class="btn-primary">Ver Produtos</button>
        </div>
    </section>

    <!-- Produtos -->
    <section style="padding: 4rem 0;">
        <div class="container">
            <h2 style="text-align: center; margin-bottom: 3rem; font-family: var(--font-family-heading);">
                Nossos Produtos
            </h2>
            
            <div class="products-grid">
                ${this.generateSampleProducts()}
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer style="background: var(--color-dark); color: white; padding: 2rem 0; margin-top: 4rem;">
        <div class="container">
            <div style="text-align: center;">
                <h3>${themeConfig.branding?.company_name || 'Sua Empresa'}</h3>
                <p>© 2025 Todos os direitos reservados.</p>
            </div>
        </div>
    </footer>
</body>
</html>
    `;
  }

  /**
   * Gera produtos de exemplo para preview
   */
  generateSampleProducts() {
    const products = [
      { name: 'Produto 1', price: 'R$ 99,90', image: '/assets/sample-product-1.jpg' },
      { name: 'Produto 2', price: 'R$ 149,90', image: '/assets/sample-product-2.jpg' },
      { name: 'Produto 3', price: 'R$ 79,90', image: '/assets/sample-product-3.jpg' },
      { name: 'Produto 4', price: 'R$ 199,90', image: '/assets/sample-product-4.jpg' }
    ];

    return products.map(product => `
      <div class="product-card">
        <div style="height: 200px; background: var(--color-light); display: flex; align-items: center; justify-content: center;">
          <span style="color: var(--color-text-secondary);">Imagem do Produto</span>
        </div>
        <div style="padding: 1rem;">
          <h4 style="margin: 0 0 0.5rem 0;">${product.name}</h4>
          <p style="margin: 0; color: var(--color-primary); font-weight: bold;">${product.price}</p>
          <button class="btn-primary" style="margin-top: 1rem; width: 100%;">Comprar</button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Lista templates disponíveis (placeholder)
   */
  async getAvailableTemplates() {
    return [
      {
        id: 'default',
        name: 'Padrão',
        description: 'Template padrão limpo e moderno',
        preview: '/templates/default/preview.jpg',
        category: 'basic'
      },
      {
        id: 'ecommerce',
        name: 'E-commerce Pro',
        description: 'Template otimizado para vendas online',
        preview: '/templates/ecommerce/preview.jpg',
        category: 'ecommerce'
      },
      {
        id: 'minimal',
        name: 'Minimalista',
        description: 'Design clean e minimalista',
        preview: '/templates/minimal/preview.jpg',
        category: 'minimal'
      }
    ];
  }

  /**
   * Middleware de upload configurado
   */
  getUploadMiddleware() {
    return this.upload.single('file');
  }
}

module.exports = ThemeController;