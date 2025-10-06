const PartnershipService = require('../services/PartnershipService');

class PartnershipController {
  
  /**
   * Cria convite para lojista
   * POST /partnerships/invite
   */
  static async createInvitation(req, res) {
    try {
      const { tenantId } = req.tenant;
      const partnershipService = new PartnershipService(tenantId);
      
      const {
        lojista_name,
        lojista_email,
        lojista_phone,
        lojista_document,
        message,
        expires_in_days
      } = req.body;

      // Validações básicas
      if (!lojista_name || !lojista_email) {
        return res.status(400).json({
          error: 'Nome e email do lojista são obrigatórios'
        });
      }

      if (!lojista_email.includes('@')) {
        return res.status(400).json({
          error: 'Email inválido'
        });
      }

      const invitation = await partnershipService.createInvitation({
        lojista_name,
        lojista_email,
        lojista_phone,
        lojista_document,
        message,
        expires_in_days
      });

      res.status(201).json({
        success: true,
        message: 'Convite criado com sucesso',
        data: invitation
      });

    } catch (error) {
      console.error('Erro ao criar convite:', error);
      res.status(400).json({
        error: error.message
      });
    }
  }

  /**
   * Aceita convite (usado pelo lojista)
   * POST /partnerships/accept/:token
   */
  static async acceptInvitation(req, res) {
    try {
      const { token } = req.params;
      const {
        client_id,
        client_secret,
        access_token,
        refresh_token,
        expires_at,
        company_name
      } = req.body;

      // Validações básicas
      if (!client_id || !client_secret) {
        return res.status(400).json({
          error: 'Credenciais do Bling são obrigatórias'
        });
      }

      // Criar service sem tenant específico (convite público)
      const partnershipService = new PartnershipService(null);
      
      const partnership = await partnershipService.acceptInvitation(token, {
        client_id,
        client_secret,
        access_token,
        refresh_token,
        expires_at: expires_at ? new Date(expires_at) : null,
        company_name
      });

      res.status(201).json({
        success: true,
        message: 'Parceria criada com sucesso! Sincronização inicial em andamento.',
        data: { partnership_id: partnership }
      });

    } catch (error) {
      console.error('Erro ao aceitar convite:', error);
      res.status(400).json({
        error: error.message
      });
    }
  }

  /**
   * Lista parcerias do fornecedor
   * GET /partnerships
   */
  static async getPartnerships(req, res) {
    try {
      const { tenantId } = req.tenant;
      const partnershipService = new PartnershipService(tenantId);
      
      const partnerships = await partnershipService.getPartnerships();

      res.json({
        success: true,
        data: partnerships
      });

    } catch (error) {
      console.error('Erro ao buscar parcerias:', error);
      res.status(500).json({
        error: error.message
      });
    }
  }

  /**
   * Busca parceria específica
   * GET /partnerships/:id
   */
  static async getPartnership(req, res) {
    try {
      const { tenantId } = req.tenant;
      const { id } = req.params;
      const partnershipService = new PartnershipService(tenantId);
      
      const partnership = await partnershipService.getPartnership(parseInt(id));

      res.json({
        success: true,
        data: partnership
      });

    } catch (error) {
      console.error('Erro ao buscar parceria:', error);
      res.status(404).json({
        error: error.message
      });
    }
  }

  /**
   * Envia mensagem para lojista
   * POST /partnerships/:id/messages
   */
  static async sendMessage(req, res) {
    try {
      const { tenantId } = req.tenant;
      const { id } = req.params;
      const { message, message_type, related_order_id } = req.body;
      
      if (!message || message.trim().length === 0) {
        return res.status(400).json({
          error: 'Mensagem não pode estar vazia'
        });
      }

      const partnershipService = new PartnershipService(tenantId);
      
      const messageId = await partnershipService.sendMessage(parseInt(id), {
        message: message.trim(),
        message_type,
        related_order_id
      });

      res.status(201).json({
        success: true,
        message: 'Mensagem enviada com sucesso',
        data: { message_id: messageId[0] }
      });

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      res.status(400).json({
        error: error.message
      });
    }
  }

  /**
   * Lista mensagens da parceria
   * GET /partnerships/:id/messages
   */
  static async getMessages(req, res) {
    try {
      const { tenantId } = req.tenant;
      const { id } = req.params;
      const partnershipService = new PartnershipService(tenantId);
      
      const messages = await partnershipService.getMessages(parseInt(id));

      res.json({
        success: true,
        data: messages
      });

    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      res.status(400).json({
        error: error.message
      });
    }
  }

  /**
   * Suspende parceria
   * PUT /partnerships/:id/suspend
   */
  static async suspendPartnership(req, res) {
    try {
      const { tenantId } = req.tenant;
      const { id } = req.params;
      const { reason } = req.body;
      
      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({
          error: 'Motivo da suspensão é obrigatório'
        });
      }

      const partnershipService = new PartnershipService(tenantId);
      
      await partnershipService.suspendPartnership(parseInt(id), reason.trim());

      res.json({
        success: true,
        message: 'Parceria suspensa com sucesso'
      });

    } catch (error) {
      console.error('Erro ao suspender parceria:', error);
      res.status(400).json({
        error: error.message
      });
    }
  }

  /**
   * Obtém estatísticas das parcerias
   * GET /partnerships/stats
   */
  static async getStats(req, res) {
    try {
      const { tenantId } = req.tenant;
      const partnershipService = new PartnershipService(tenantId);
      
      const stats = await partnershipService.getStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({
        error: error.message
      });
    }
  }

  /**
   * Força sincronização manual
   * POST /partnerships/:id/sync
   */
  static async forceSync(req, res) {
    try {
      const { tenantId } = req.tenant;
      const { id } = req.params;
      const partnershipService = new PartnershipService(tenantId);
      
      // Executar sincronização em background
      setImmediate(async () => {
        try {
          await partnershipService.performInitialSync(parseInt(id));
        } catch (error) {
          console.error('Erro na sincronização:', error);
        }
      });

      res.json({
        success: true,
        message: 'Sincronização iniciada em segundo plano'
      });

    } catch (error) {
      console.error('Erro ao iniciar sincronização:', error);
      res.status(400).json({
        error: error.message
      });
    }
  }

  /**
   * Reativa parceria suspensa
   * PUT /partnerships/:id/reactivate
   */
  static async reactivatePartnership(req, res) {
    try {
      const { tenantId } = req.tenant;
      const { id } = req.params;
      
      const db = require('../database/connection');
      
      const partnership = await db('partnerships')
        .where('id', parseInt(id))
        .where('supplier_tenant_id', tenantId)
        .first();

      if (!partnership) {
        return res.status(404).json({
          error: 'Parceria não encontrada'
        });
      }

      if (partnership.status !== 'suspended') {
        return res.status(400).json({
          error: 'Apenas parcerias suspensas podem ser reativadas'
        });
      }

      await db('partnerships')
        .where('id', parseInt(id))
        .update({
          status: 'active',
          updated_at: new Date()
        });

      // Registrar mensagem de reativação
      const partnershipService = new PartnershipService(tenantId);
      await partnershipService.sendMessage(parseInt(id), {
        message: 'Parceria reativada com sucesso!',
        message_type: 'support'
      });

      res.json({
        success: true,
        message: 'Parceria reativada com sucesso'
      });

    } catch (error) {
      console.error('Erro ao reativar parceria:', error);
      res.status(400).json({
        error: error.message
      });
    }
  }
}

module.exports = PartnershipController;