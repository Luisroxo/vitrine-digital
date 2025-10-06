const db = require('../database/connection');
const crypto = require('crypto');
const BlingMultiTenantService = require('./BlingMultiTenantService');

/**
 * PartnershipService - Gerencia parcerias 1:1 entre fornecedores e lojistas
 * Cada lojista pode ter apenas 1 fornecedor (exclusividade)
 */
class PartnershipService {
  constructor(tenantId) {
    this.tenantId = tenantId;
    this.blingService = new BlingMultiTenantService(tenantId);
  }

  /**
   * Cria convite para lojista
   * @param {Object} invitationData - Dados do convite
   * @returns {Object} Convite criado
   */
  async createInvitation(invitationData) {
    const {
      lojista_name,
      lojista_email,
      lojista_phone,
      lojista_document,
      message,
      expires_in_days = 7
    } = invitationData;

    // Verificar se lojista já tem parceria ativa
    const existingPartnership = await db('partnerships')
      .where('lojista_email', lojista_email)
      .where('status', 'active')
      .first();

    if (existingPartnership) {
      throw new Error(`Lojista ${lojista_email} já possui parceria ativa com outro fornecedor`);
    }

    // Verificar se já existe convite pendente
    const existingInvitation = await db('partnership_invitations')
      .where('lojista_email', lojista_email)
      .where('status', 'pending')
      .where('expires_at', '>', new Date())
      .first();

    if (existingInvitation) {
      throw new Error(`Já existe um convite pendente para ${lojista_email}`);
    }

    // Gerar token único
    const invitation_token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + (expires_in_days * 24 * 60 * 60 * 1000));

    const invitation = await db('partnership_invitations').insert({
      tenant_id: this.tenantId,
      invitation_token,
      lojista_name,
      lojista_email,
      lojista_phone,
      lojista_document,
      message,
      expires_at,
      created_at: new Date(),
      updated_at: new Date()
    });

    return {
      id: invitation[0],
      invitation_token,
      expires_at,
      invitation_url: `${process.env.FRONTEND_URL}/partnership/accept/${invitation_token}`
    };
  }

  /**
   * Aceita convite e cria parceria
   * @param {string} token - Token do convite
   * @param {Object} lojistaBlingConfig - Configuração Bling do lojista
   * @returns {Object} Parceria criada
   */
  async acceptInvitation(token, lojistaBlingConfig) {
    const invitation = await db('partnership_invitations')
      .where('invitation_token', token)
      .where('status', 'pending')
      .where('expires_at', '>', new Date())
      .first();

    if (!invitation) {
      throw new Error('Convite não encontrado ou expirado');
    }

    // Verificar novamente se lojista não tem parceria (race condition)
    const existingPartnership = await db('partnerships')
      .where('lojista_email', invitation.lojista_email)
      .where('status', 'active')
      .first();

    if (existingPartnership) {
      throw new Error('Lojista já possui parceria ativa');
    }

    const trx = await db.transaction();

    try {
      // Criar parceria
      const partnership = await trx('partnerships').insert({
        supplier_tenant_id: invitation.tenant_id,
        lojista_name: invitation.lojista_name,
        lojista_email: invitation.lojista_email,
        lojista_phone: invitation.lojista_phone,
        lojista_document: invitation.lojista_document,
        lojista_company: lojistaBlingConfig.company_name,
        lojista_bling_client_id: lojistaBlingConfig.client_id,
        lojista_bling_client_secret: lojistaBlingConfig.client_secret,
        lojista_bling_access_token: lojistaBlingConfig.access_token,
        lojista_bling_refresh_token: lojistaBlingConfig.refresh_token,
        lojista_bling_token_expires_at: lojistaBlingConfig.expires_at,
        sync_settings: JSON.stringify({
          auto_sync: true,
          sync_inventory: true,
          sync_prices: true,
          sync_descriptions: true
        }),
        created_at: new Date(),
        updated_at: new Date()
      });

      // Marcar convite como aceito
      await trx('partnership_invitations')
        .where('id', invitation.id)
        .update({
          status: 'accepted',
          accepted_at: new Date(),
          updated_at: new Date()
        });

      await trx.commit();

      // Iniciar sincronização inicial
      await this.performInitialSync(partnership[0]);

      return partnership[0];
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Realiza sincronização inicial entre Blings
   * @param {number} partnershipId - ID da parceria
   */
  async performInitialSync(partnershipId) {
    try {
      const partnership = await db('partnerships').where('id', partnershipId).first();
      if (!partnership) throw new Error('Parceria não encontrada');

      const syncLog = await db('partnership_sync_logs').insert({
        partnership_id: partnershipId,
        sync_type: 'full',
        direction: 'supplier_to_lojista',
        status: 'running',
        started_at: new Date()
      });

      // Buscar produtos do fornecedor
      const supplierProducts = await this.blingService.getProducts();
      
      // Configurar Bling do lojista
      const lojistaBling = new BlingMultiTenantService(null, {
        client_id: partnership.lojista_bling_client_id,
        client_secret: partnership.lojista_bling_client_secret,
        access_token: partnership.lojista_bling_access_token,
        refresh_token: partnership.lojista_bling_refresh_token
      });

      let processedItems = 0;
      let successItems = 0;
      let failedItems = 0;

      // Sincronizar cada produto
      for (const product of supplierProducts) {
        try {
          await lojistaBling.createProduct(product);
          successItems++;
        } catch (error) {
          failedItems++;
          console.error(`Erro ao sincronizar produto ${product.id}:`, error.message);
        }
        processedItems++;

        // Atualizar progresso
        await db('partnership_sync_logs')
          .where('id', syncLog[0])
          .update({
            processed_items: processedItems,
            success_items: successItems,
            failed_items: failedItems
          });
      }

      // Finalizar sync
      await db('partnership_sync_logs')
        .where('id', syncLog[0])
        .update({
          status: failedItems > 0 ? 'partial' : 'completed',
          total_items: supplierProducts.length,
          completed_at: new Date()
        });

      // Atualizar partnership
      await db('partnerships')
        .where('id', partnershipId)
        .update({
          last_sync_at: new Date(),
          products_synced: successItems,
          updated_at: new Date()
        });

      return {
        total: supplierProducts.length,
        success: successItems,
        failed: failedItems
      };

    } catch (error) {
      console.error('Erro na sincronização inicial:', error);
      throw error;
    }
  }

  /**
   * Lista parcerias do fornecedor
   * @returns {Array} Lista de parcerias
   */
  async getPartnerships() {
    return await db('partnerships')
      .where('supplier_tenant_id', this.tenantId)
      .orderBy('created_at', 'desc');
  }

  /**
   * Busca parceria específica
   * @param {number} partnershipId - ID da parceria
   * @returns {Object} Dados da parceria
   */
  async getPartnership(partnershipId) {
    const partnership = await db('partnerships')
      .where('id', partnershipId)
      .where('supplier_tenant_id', this.tenantId)
      .first();

    if (!partnership) {
      throw new Error('Parceria não encontrada');
    }

    // Buscar últimos logs de sincronização
    const syncLogs = await db('partnership_sync_logs')
      .where('partnership_id', partnershipId)
      .orderBy('started_at', 'desc')
      .limit(5);

    // Buscar mensagens não lidas
    const unreadMessages = await db('partnership_messages')
      .where('partnership_id', partnershipId)
      .where('sender_type', 'lojista')
      .where('is_read', false)
      .count('* as count');

    return {
      ...partnership,
      sync_logs: syncLogs,
      unread_messages: unreadMessages[0].count
    };
  }

  /**
   * Envia mensagem para lojista
   * @param {number} partnershipId - ID da parceria
   * @param {Object} messageData - Dados da mensagem
   * @returns {Object} Mensagem criada
   */
  async sendMessage(partnershipId, messageData) {
    const { message, message_type = 'general', related_order_id = null } = messageData;

    const partnership = await db('partnerships')
      .where('id', partnershipId)
      .where('supplier_tenant_id', this.tenantId)
      .first();

    if (!partnership) {
      throw new Error('Parceria não encontrada');
    }

    const tenant = await db('tenants').where('id', this.tenantId).first();

    return await db('partnership_messages').insert({
      partnership_id: partnershipId,
      sender_type: 'supplier',
      sender_name: tenant.name,
      message,
      message_type,
      related_order_id,
      created_at: new Date()
    });
  }

  /**
   * Lista mensagens da parceria
   * @param {number} partnershipId - ID da parceria
   * @returns {Array} Mensagens
   */
  async getMessages(partnershipId) {
    const partnership = await db('partnerships')
      .where('id', partnershipId)
      .where('supplier_tenant_id', this.tenantId)
      .first();

    if (!partnership) {
      throw new Error('Parceria não encontrada');
    }

    return await db('partnership_messages')
      .where('partnership_id', partnershipId)
      .orderBy('created_at', 'desc');
  }

  /**
   * Suspende parceria
   * @param {number} partnershipId - ID da parceria
   * @param {string} reason - Motivo da suspensão
   */
  async suspendPartnership(partnershipId, reason) {
    const partnership = await db('partnerships')
      .where('id', partnershipId)
      .where('supplier_tenant_id', this.tenantId)
      .first();

    if (!partnership) {
      throw new Error('Parceria não encontrada');
    }

    await db('partnerships')
      .where('id', partnershipId)
      .update({
        status: 'suspended',
        updated_at: new Date()
      });

    // Registrar mensagem explicativa
    await this.sendMessage(partnershipId, {
      message: `Parceria suspensa. Motivo: ${reason}`,
      message_type: 'support'
    });

    return true;
  }

  /**
   * Obtém estatísticas das parcerias
   * @returns {Object} Estatísticas
   */
  async getStats() {
    const stats = await db('partnerships')
      .where('supplier_tenant_id', this.tenantId)
      .select(
        db.raw('COUNT(*) as total_partnerships'),
        db.raw('SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) as active_partnerships'),
        db.raw('SUM(products_synced) as total_products_synced'),
        db.raw('SUM(total_orders) as total_orders'),
        db.raw('SUM(total_orders_value) as total_revenue')
      )
      .first();

    return {
      total_partnerships: parseInt(stats.total_partnerships) || 0,
      active_partnerships: parseInt(stats.active_partnerships) || 0,
      total_products_synced: parseInt(stats.total_products_synced) || 0,
      total_orders: parseInt(stats.total_orders) || 0,
      total_revenue: parseFloat(stats.total_revenue) || 0
    };
  }
}

module.exports = PartnershipService;