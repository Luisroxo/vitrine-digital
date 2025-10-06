/**
 * Migration: Create Tenant Configs Table
 * 
 * Esta migration armazena as configurações de branding e personalização
 * de cada tenant para o sistema white label.
 */

exports.up = function(knex) {
  return knex.schema.createTable('tenant_configs', function(table) {
    // Primary Key
    table.increments('id').primary();
    
    // Foreign Key para tenant
    table.integer('tenant_id').unsigned().notNullable()
      .references('id').inTable('tenants').onDelete('CASCADE');
    
    // Branding básico
    table.string('brand_name')
      .comment('Nome da marca exibida na vitrine');
    table.string('brand_slogan')
      .comment('Slogan/tagline da marca');
    table.text('brand_description')
      .comment('Descrição da empresa para SEO');
    
    // Assets visuais
    table.string('logo_url')
      .comment('URL do logo principal');
    table.string('logo_dark_url')
      .comment('URL do logo para modo escuro');
    table.string('favicon_url')
      .comment('URL do favicon');
    table.string('banner_url')
      .comment('URL do banner principal');
    
    // Cores do tema
    table.string('primary_color')
      .defaultTo('#3B82F6')
      .comment('Cor primária (hexadecimal)');
    table.string('secondary_color')
      .defaultTo('#10B981')
      .comment('Cor secundária (hexadecimal)');
    table.string('accent_color')
      .defaultTo('#F59E0B')
      .comment('Cor de destaque (hexadecimal)');
    table.string('background_color')
      .defaultTo('#FFFFFF')
      .comment('Cor de fundo principal');
    
    // Tipografia
    table.string('font_family')
      .defaultTo('Inter')
      .comment('Família de fonte principal');
    table.string('heading_font')
      .comment('Fonte para títulos (opcional)');
    
    // SEO e meta tags
    table.string('meta_title')
      .comment('Título da página (SEO)');
    table.text('meta_description')
      .comment('Descrição da página (SEO)');
    table.text('meta_keywords')
      .comment('Palavras-chave (SEO)');
    table.string('og_image_url')
      .comment('Imagem para compartilhamento social');
    
    // Configurações de layout
    table.json('layout_settings')
      .comment('Configurações de layout em JSON');
    table.json('theme_variables')
      .comment('Variáveis CSS customizáveis');
    
    // Informações de contato
    table.string('contact_email')
      .comment('Email de contato público');
    table.string('contact_phone')
      .comment('Telefone público');
    table.string('contact_whatsapp')
      .comment('WhatsApp para contato');
    table.text('contact_address')
      .comment('Endereço público');
    
    // Links sociais
    table.string('social_facebook')
      .comment('URL do Facebook');
    table.string('social_instagram')
      .comment('URL do Instagram');
    table.string('social_linkedin')
      .comment('URL do LinkedIn');
    table.string('social_youtube')
      .comment('URL do YouTube');
    
    // Configurações avançadas
    table.text('custom_css')
      .comment('CSS customizado adicional');
    table.text('custom_js')
      .comment('JavaScript customizado');
    table.text('google_analytics_id')
      .comment('ID do Google Analytics');
    table.text('facebook_pixel_id')
      .comment('ID do Facebook Pixel');
    
    // Políticas e termos
    table.text('privacy_policy')
      .comment('Política de privacidade');
    table.text('terms_of_service')
      .comment('Termos de uso');
    table.text('about_company')
      .comment('Sobre a empresa');
    
    // Status e controle
    table.boolean('is_published')
      .defaultTo(false)
      .comment('Se as configurações estão publicadas');
    table.timestamp('published_at')
      .comment('Quando foi publicado pela última vez');
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['tenant_id']);
    table.index(['is_published']);
    
    // Unique constraint
    table.unique(['tenant_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('tenant_configs');
};