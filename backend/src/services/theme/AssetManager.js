/**
 * Asset Manager Service
 * 
 * Gerencia upload e armazenamento de assets para personalização:
 * - Logos, favicons
 * - Imagens de background
 * - Imagens personalizadas
 * - Otimização automática
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class AssetManager {
  constructor() {
    this.uploadsPath = path.join(process.cwd(), 'public', 'uploads');
    this.assetsPath = path.join(process.cwd(), 'public', 'assets');
    
    // Configurações de upload
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.allowedTypes = {
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
      favicon: ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png']
    };
    
    // Dimensões padrão para otimização
    this.imageSizes = {
      logo: { width: 200, height: 80 },
      favicon: { width: 32, height: 32 },
      hero_bg: { width: 1920, height: 1080 },
      product_thumb: { width: 300, height: 300 },
      product_large: { width: 800, height: 800 }
    };
  }

  /**
   * Upload de asset para um tenant
   */
  async uploadAsset(tenantId, file, assetType, metadata = {}) {
    try {
      console.log(`📤 Upload de ${assetType} para tenant ${tenantId}`);
      
      // Validar arquivo
      await this.validateFile(file, assetType);
      
      // Gerar nome único
      const fileName = this.generateFileName(file.originalname, tenantId, assetType);
      
      // Determinar paths
      const tenantDir = path.join(this.uploadsPath, `tenant-${tenantId}`);
      const filePath = path.join(tenantDir, fileName);
      
      // Criar diretório se não existir
      await fs.mkdir(tenantDir, { recursive: true });
      
      // Salvar arquivo original
      await fs.writeFile(filePath, file.buffer);
      
      // Otimizar se for imagem
      let optimizedPath = filePath;
      if (this.isImage(file.mimetype)) {
        optimizedPath = await this.optimizeImage(filePath, assetType);
      }
      
      // Gerar URL pública
      const publicUrl = this.getPublicUrl(tenantId, fileName);
      
      // Salvar metadata no banco (integrar depois)
      const assetRecord = await this.saveAssetRecord({
        tenant_id: tenantId,
        asset_type: assetType,
        original_name: file.originalname,
        file_name: fileName,
        file_path: optimizedPath,
        file_size: file.size,
        mime_type: file.mimetype,
        public_url: publicUrl,
        metadata: metadata,
        created_at: new Date().toISOString()
      });
      
      console.log(`✅ Asset ${assetType} salvo: ${publicUrl}`);
      
      return {
        asset_id: assetRecord.id,
        asset_type: assetType,
        public_url: publicUrl,
        file_name: fileName,
        file_size: file.size,
        metadata: metadata
      };
      
    } catch (error) {
      console.error(`❌ Erro no upload:`, error);
      throw error;
    }
  }

  /**
   * Lista assets de um tenant
   */
  async getTenantAssets(tenantId, assetType = null) {
    try {
      console.log(`📋 Listando assets do tenant ${tenantId}`);
      
      const tenantDir = path.join(this.uploadsPath, `tenant-${tenantId}`);
      
      try {
        const files = await fs.readdir(tenantDir);
        const assets = [];
        
        for (const file of files) {
          const filePath = path.join(tenantDir, file);
          const stats = await fs.stat(filePath);
          
          // Extrair tipo do nome do arquivo
          const fileType = this.extractAssetTypeFromFileName(file);
          
          if (!assetType || fileType === assetType) {
            assets.push({
              file_name: file,
              asset_type: fileType,
              public_url: this.getPublicUrl(tenantId, file),
              file_size: stats.size,
              created_at: stats.birthtime.toISOString()
            });
          }
        }
        
        return assets;
        
      } catch (error) {
        if (error.code === 'ENOENT') {
          return []; // Diretório não existe ainda
        }
        throw error;
      }
      
    } catch (error) {
      console.error(`❌ Erro ao listar assets:`, error);
      throw error;
    }
  }

  /**
   * Remove asset de um tenant
   */
  async deleteAsset(tenantId, fileName) {
    try {
      console.log(`🗑️ Removendo asset: ${fileName} do tenant ${tenantId}`);
      
      const filePath = path.join(this.uploadsPath, `tenant-${tenantId}`, fileName);
      
      // Remover arquivo
      await fs.unlink(filePath);
      
      // Remover registro do banco (implementar depois)
      // await this.deleteAssetRecord(tenantId, fileName);
      
      console.log(`✅ Asset ${fileName} removido com sucesso`);
      return true;
      
    } catch (error) {
      console.error(`❌ Erro ao remover asset:`, error);
      throw error;
    }
  }

  /**
   * Gera preview de como ficará o asset no tema
   */
  async generateAssetPreview(tenantId, assetType, fileName) {
    try {
      console.log(`🖼️ Gerando preview do asset ${fileName}`);
      
      const publicUrl = this.getPublicUrl(tenantId, fileName);
      
      // Gerar HTML de preview baseado no tipo
      const previewHtml = this.generatePreviewHTML(assetType, publicUrl);
      
      return {
        asset_type: assetType,
        public_url: publicUrl,
        preview_html: previewHtml,
        preview_styles: this.getPreviewStyles(assetType)
      };
      
    } catch (error) {
      console.error(`❌ Erro ao gerar preview:`, error);
      throw error;
    }
  }

  /**
   * Valida arquivo antes do upload
   */
  async validateFile(file, assetType) {
    // Verificar tamanho
    if (file.size > this.maxFileSize) {
      throw new Error(`Arquivo muito grande. Máximo: ${this.maxFileSize / 1024 / 1024}MB`);
    }
    
    // Verificar tipo MIME
    const allowedTypes = this.getAllowedTypes(assetType);
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error(`Tipo de arquivo não permitido. Permitidos: ${allowedTypes.join(', ')}`);
    }
    
    // Verificações específicas por tipo
    switch (assetType) {
      case 'logo':
        if (!this.isImage(file.mimetype)) {
          throw new Error('Logo deve ser uma imagem');
        }
        break;
        
      case 'favicon':
        if (!this.allowedTypes.favicon.includes(file.mimetype)) {
          throw new Error('Favicon deve ser ICO ou PNG');
        }
        break;
    }
    
    return true;
  }

  /**
   * Otimiza imagem baseada no tipo de asset
   */
  async optimizeImage(filePath, assetType) {
    try {
      console.log(`🔧 Otimizando imagem: ${assetType}`);
      
      // Por enquanto, retornar o mesmo arquivo
      // Implementar sharp ou jimp depois para redimensionamento real
      
      const targetSize = this.imageSizes[assetType];
      if (targetSize) {
        console.log(`📏 Tamanho alvo para ${assetType}: ${targetSize.width}x${targetSize.height}`);
        
        // TODO: Implementar redimensionamento com sharp
        // const sharp = require('sharp');
        // await sharp(filePath)
        //   .resize(targetSize.width, targetSize.height, { fit: 'inside' })
        //   .jpeg({ quality: 85 })
        //   .toFile(optimizedPath);
      }
      
      return filePath;
      
    } catch (error) {
      console.error(`❌ Erro na otimização:`, error);
      return filePath; // Retornar original se falhar
    }
  }

  /**
   * Gera nome único para o arquivo
   */
  generateFileName(originalName, tenantId, assetType) {
    const ext = path.extname(originalName);
    const hash = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    
    return `${assetType}-${timestamp}-${hash}${ext}`;
  }

  /**
   * Gera URL pública para o asset
   */
  getPublicUrl(tenantId, fileName) {
    return `/uploads/tenant-${tenantId}/${fileName}`;
  }

  /**
   * Extrai tipo de asset do nome do arquivo
   */
  extractAssetTypeFromFileName(fileName) {
    const parts = fileName.split('-');
    return parts[0] || 'unknown';
  }

  /**
   * Verifica se é arquivo de imagem
   */
  isImage(mimetype) {
    return this.allowedTypes.image.includes(mimetype);
  }

  /**
   * Retorna tipos permitidos para um asset
   */
  getAllowedTypes(assetType) {
    switch (assetType) {
      case 'logo':
      case 'hero_bg':
      case 'product_image':
        return this.allowedTypes.image;
      case 'favicon':
        return this.allowedTypes.favicon;
      default:
        return this.allowedTypes.image;
    }
  }

  /**
   * Gera HTML de preview para um asset
   */
  generatePreviewHTML(assetType, publicUrl) {
    switch (assetType) {
      case 'logo':
        return `<img src="${publicUrl}" alt="Logo" style="max-height: 60px; object-fit: contain;" />`;
        
      case 'favicon':
        return `<link rel="icon" type="image/x-icon" href="${publicUrl}">`;
        
      case 'hero_bg':
        return `
          <div style="
            background-image: url('${publicUrl}');
            background-size: cover;
            background-position: center;
            height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
          ">
            <h1>Sua mensagem aqui</h1>
          </div>
        `;
        
      default:
        return `<img src="${publicUrl}" alt="${assetType}" style="max-width: 200px; height: auto;" />`;
    }
  }

  /**
   * Retorna estilos de preview para um tipo de asset
   */
  getPreviewStyles(assetType) {
    const baseStyles = `
      .asset-preview {
        border: 2px dashed #ccc;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        background: #f9f9f9;
      }
    `;
    
    switch (assetType) {
      case 'logo':
        return baseStyles + `
          .asset-preview img {
            max-height: 80px;
            object-fit: contain;
          }
        `;
        
      case 'hero_bg':
        return baseStyles + `
          .asset-preview {
            padding: 0;
            height: 200px;
            overflow: hidden;
          }
        `;
        
      default:
        return baseStyles;
    }
  }

  /**
   * Salva registro do asset no banco (placeholder)
   */
  async saveAssetRecord(assetData) {
    // TODO: Implementar salvamento no banco
    // Por enquanto, simular ID
    return {
      id: crypto.randomBytes(4).toString('hex'),
      ...assetData
    };
  }

  /**
   * Gera assets de exemplo para demonstração
   */
  async generateSampleAssets() {
    const sampleAssets = [
      {
        asset_type: 'logo',
        description: 'Logo da empresa em formato PNG',
        dimensions: '200x80px',
        examples: ['Logo horizontal', 'Logo vertical', 'Logo símbolo']
      },
      {
        asset_type: 'favicon',
        description: 'Ícone do site (favicon)',
        dimensions: '32x32px',
        examples: ['Favicon ICO', 'Favicon PNG']
      },
      {
        asset_type: 'hero_bg',
        description: 'Imagem de fundo da seção principal',
        dimensions: '1920x1080px',
        examples: ['Produto em destaque', 'Empresa/Escritório', 'Abstrato/Textura']
      }
    ];
    
    return sampleAssets;
  }
}

module.exports = AssetManager;