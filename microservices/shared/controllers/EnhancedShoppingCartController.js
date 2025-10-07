/**
 * Enhanced Shopping Cart Controller - API REST Completa
 * 
 * Controller para gerenciamento avançado de carrinho de compras:
 * - CRUD completo de carrinho
 * - Gestão de itens com validação de estoque
 * - Sistema de cupons e descontos
 * - Checkout inteligente multi-etapas
 * - Recuperação de carrinhos abandonados
 * - Analytics e métricas de conversão
 * - Recomendações baseadas em IA
 * 
 * @author Sistema Vitrine Digital
 * @version 2.0.0
 */

const EnhancedShoppingCartService = require('../services/EnhancedShoppingCartService');
const { validationResult, body, param, query } = require('express-validator');

class EnhancedShoppingCartController {
    constructor() {
        this.cartService = new EnhancedShoppingCartService({
            maxItems: 100,
            sessionTimeout: 24 * 60 * 60 * 1000, // 24h
            abandonmentThreshold: 30 * 60 * 1000, // 30min
            reserveStock: true,
            reserveTimeout: 15 * 60 * 1000, // 15min
            allowStackingDiscounts: false,
            maxDiscountPercent: 70,
            enableRecommendations: true,
            maxRecommendations: 8
        });
        
        this.initializeService();
    }
    
    async initializeService() {
        try {
            await this.cartService.initialize();
        } catch (error) {
            console.error('Failed to initialize Enhanced Shopping Cart Service:', error);
        }
    }
    
    /**
     * Cria um novo carrinho
     * POST /api/cart
     */
    async createCart(req, res) {
        try {
            const { userId, sessionId } = req.body;
            const tenantId = req.tenant?.id;
            
            if (!tenantId) {
                return res.status(400).json({
                    success: false,
                    error: 'Tenant ID is required'
                });
            }
            
            const cart = await this.cartService.createCart(userId, sessionId, tenantId);
            
            res.status(201).json({
                success: true,
                message: 'Cart created successfully',
                data: cart,
                cartId: cart.id
            });
            
        } catch (error) {
            console.error('Error creating cart:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create cart',
                details: error.message
            });
        }
    }
    
    /**
     * Recupera carrinho existente
     * GET /api/cart/:cartId
     */
    async getCart(req, res) {
        try {
            const { cartId } = req.params;
            const tenantId = req.tenant?.id;
            
            const cart = await this.cartService.getCart(cartId, tenantId);
            
            if (!cart) {
                return res.status(404).json({
                    success: false,
                    error: 'Cart not found'
                });
            }
            
            res.json({
                success: true,
                data: cart
            });
            
        } catch (error) {
            console.error('Error getting cart:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get cart',
                details: error.message
            });
        }
    }
    
    /**
     * Adiciona item ao carrinho
     * POST /api/cart/:cartId/items
     */
    async addItem(req, res) {
        try {
            // Validações
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
            }
            
            const { cartId } = req.params;
            const { productId, quantity, options } = req.body;
            const tenantId = req.tenant?.id;
            
            const cart = await this.cartService.addItem(cartId, productId, quantity, {
                tenantId,
                productOptions: options
            });
            
            res.json({
                success: true,
                message: 'Item added to cart',
                data: cart,
                totals: cart.totals
            });
            
        } catch (error) {
            console.error('Error adding item to cart:', error);
            
            if (error.message.includes('Insufficient stock')) {
                return res.status(409).json({
                    success: false,
                    error: 'Insufficient stock',
                    details: error.message
                });
            }
            
            res.status(500).json({
                success: false,
                error: 'Failed to add item to cart',
                details: error.message
            });
        }
    }
    
    /**
     * Atualiza quantidade de item
     * PUT /api/cart/:cartId/items/:itemId
     */
    async updateItemQuantity(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
            }
            
            const { cartId, itemId } = req.params;
            const { quantity } = req.body;
            const tenantId = req.tenant?.id;
            
            const cart = await this.cartService.updateItemQuantity(cartId, itemId, quantity, tenantId);
            
            res.json({
                success: true,
                message: 'Item quantity updated',
                data: cart,
                totals: cart.totals
            });
            
        } catch (error) {
            console.error('Error updating item quantity:', error);
            
            if (error.message.includes('Insufficient stock')) {
                return res.status(409).json({
                    success: false,
                    error: 'Insufficient stock',
                    details: error.message
                });
            }
            
            res.status(500).json({
                success: false,
                error: 'Failed to update item quantity',
                details: error.message
            });
        }
    }
    
    /**
     * Remove item do carrinho
     * DELETE /api/cart/:cartId/items/:itemId
     */
    async removeItem(req, res) {
        try {
            const { cartId, itemId } = req.params;
            const tenantId = req.tenant?.id;
            
            const cart = await this.cartService.removeItem(cartId, itemId, tenantId);
            
            res.json({
                success: true,
                message: 'Item removed from cart',
                data: cart,
                totals: cart.totals
            });
            
        } catch (error) {
            console.error('Error removing item from cart:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to remove item from cart',
                details: error.message
            });
        }
    }
    
    /**
     * Aplica cupom de desconto
     * POST /api/cart/:cartId/coupons
     */
    async applyCoupon(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
            }
            
            const { cartId } = req.params;
            const { couponCode } = req.body;
            const tenantId = req.tenant?.id;
            
            const cart = await this.cartService.applyCoupon(cartId, couponCode, tenantId);
            
            res.json({
                success: true,
                message: 'Coupon applied successfully',
                data: cart,
                totals: cart.totals,
                appliedDiscount: cart.discounts[cart.discounts.length - 1]
            });
            
        } catch (error) {
            console.error('Error applying coupon:', error);
            
            if (error.message.includes('Invalid coupon') || 
                error.message.includes('already applied') ||
                error.message.includes('Cannot stack')) {
                return res.status(400).json({
                    success: false,
                    error: 'Coupon validation failed',
                    details: error.message
                });
            }
            
            res.status(500).json({
                success: false,
                error: 'Failed to apply coupon',
                details: error.message
            });
        }
    }
    
    /**
     * Remove cupom de desconto
     * DELETE /api/cart/:cartId/coupons/:couponCode
     */
    async removeCoupon(req, res) {
        try {
            const { cartId, couponCode } = req.params;
            const tenantId = req.tenant?.id;
            
            const cart = await this.cartService.removeCoupon(cartId, couponCode, tenantId);
            
            res.json({
                success: true,
                message: 'Coupon removed successfully',
                data: cart,
                totals: cart.totals
            });
            
        } catch (error) {
            console.error('Error removing coupon:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to remove coupon',
                details: error.message
            });
        }
    }
    
    /**
     * Processa checkout
     * POST /api/cart/:cartId/checkout
     */
    async processCheckout(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
            }
            
            const { cartId } = req.params;
            const checkoutData = req.body;
            const tenantId = req.tenant?.id;
            
            const result = await this.cartService.processCheckout(cartId, checkoutData, tenantId);
            
            res.json({
                success: true,
                message: 'Checkout completed successfully',
                data: {
                    cart: result.cart,
                    order: result.order
                },
                orderId: result.order.id
            });
            
        } catch (error) {
            console.error('Error processing checkout:', error);
            
            if (error.message.includes('Stock validation failed') ||
                error.message.includes('Cart is empty')) {
                return res.status(400).json({
                    success: false,
                    error: 'Checkout validation failed',
                    details: error.message
                });
            }
            
            res.status(500).json({
                success: false,
                error: 'Failed to process checkout',
                details: error.message
            });
        }
    }
    
    /**
     * Abandona carrinho
     * POST /api/cart/:cartId/abandon
     */
    async abandonCart(req, res) {
        try {
            const { cartId } = req.params;
            const tenantId = req.tenant?.id;
            
            await this.cartService.abandonCart(cartId, tenantId);
            
            res.json({
                success: true,
                message: 'Cart abandoned successfully'
            });
            
        } catch (error) {
            console.error('Error abandoning cart:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to abandon cart',
                details: error.message
            });
        }
    }
    
    /**
     * Obtém recomendações para o carrinho
     * GET /api/cart/:cartId/recommendations
     */
    async getRecommendations(req, res) {
        try {
            const { cartId } = req.params;
            const tenantId = req.tenant?.id;
            
            const cart = await this.cartService.getCart(cartId, tenantId);
            if (!cart) {
                return res.status(404).json({
                    success: false,
                    error: 'Cart not found'
                });
            }
            
            const recommendations = await this.cartService.generateRecommendations(cart);
            
            res.json({
                success: true,
                data: recommendations,
                count: recommendations.length
            });
            
        } catch (error) {
            console.error('Error getting recommendations:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get recommendations',
                details: error.message
            });
        }
    }
    
    /**
     * Recupera carrinhos abandonados
     * POST /api/cart/recover-abandoned
     */
    async recoverAbandonedCarts(req, res) {
        try {
            const results = await this.cartService.recoverAbandonedCarts();
            
            res.json({
                success: true,
                message: 'Abandoned cart recovery completed',
                data: results,
                recovered: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            });
            
        } catch (error) {
            console.error('Error recovering abandoned carts:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to recover abandoned carts',
                details: error.message
            });
        }
    }
    
    /**
     * Obtém analytics do carrinho
     * GET /api/cart/analytics
     */
    async getAnalytics(req, res) {
        try {
            const analytics = this.cartService.getAnalytics();
            
            res.json({
                success: true,
                data: analytics,
                generatedAt: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error getting cart analytics:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get cart analytics',
                details: error.message
            });
        }
    }
    
    /**
     * Limpa carrinho
     * DELETE /api/cart/:cartId
     */
    async clearCart(req, res) {
        try {
            const { cartId } = req.params;
            const tenantId = req.tenant?.id;
            
            const cart = await this.cartService.getCart(cartId, tenantId);
            if (!cart) {
                return res.status(404).json({
                    success: false,
                    error: 'Cart not found'
                });
            }
            
            // Remover todos os itens
            for (const item of cart.items) {
                await this.cartService.removeItem(cartId, item.id, tenantId);
            }
            
            // Remover todos os cupons
            for (const discount of cart.discounts) {
                await this.cartService.removeCoupon(cartId, discount.code, tenantId);
            }
            
            const clearedCart = await this.cartService.getCart(cartId, tenantId);
            
            res.json({
                success: true,
                message: 'Cart cleared successfully',
                data: clearedCart
            });
            
        } catch (error) {
            console.error('Error clearing cart:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to clear cart',
                details: error.message
            });
        }
    }
    
    /**
     * Obtém resumo do carrinho
     * GET /api/cart/:cartId/summary
     */
    async getCartSummary(req, res) {
        try {
            const { cartId } = req.params;
            const tenantId = req.tenant?.id;
            
            const cart = await this.cartService.getCart(cartId, tenantId);
            if (!cart) {
                return res.status(404).json({
                    success: false,
                    error: 'Cart not found'
                });
            }
            
            const summary = {
                cartId: cart.id,
                itemCount: cart.items.length,
                totalQuantity: cart.items.reduce((sum, item) => sum + item.quantity, 0),
                totals: cart.totals,
                hasDiscounts: cart.discounts.length > 0,
                discountCount: cart.discounts.length,
                status: cart.status,
                createdAt: cart.createdAt,
                updatedAt: cart.updatedAt,
                lastActivity: cart.lastActivity
            };
            
            res.json({
                success: true,
                data: summary
            });
            
        } catch (error) {
            console.error('Error getting cart summary:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get cart summary',
                details: error.message
            });
        }
    }
    
    /**
     * Validações para os endpoints
     */
    static getValidationRules() {
        return {
            addItem: [
                body('productId').notEmpty().withMessage('Product ID is required'),
                body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
                body('options').optional().isObject().withMessage('Options must be an object')
            ],
            
            updateItemQuantity: [
                param('cartId').notEmpty().withMessage('Cart ID is required'),
                param('itemId').notEmpty().withMessage('Item ID is required'),
                body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer')
            ],
            
            applyCoupon: [
                body('couponCode').trim().notEmpty().withMessage('Coupon code is required'),
                body('couponCode').isLength({ min: 3, max: 50 }).withMessage('Coupon code must be between 3 and 50 characters')
            ],
            
            processCheckout: [
                body('customer').isObject().withMessage('Customer information is required'),
                body('customer.email').isEmail().withMessage('Valid email is required'),
                body('customer.name').trim().notEmpty().withMessage('Customer name is required'),
                body('shipping').optional().isObject().withMessage('Shipping information must be an object'),
                body('billing').optional().isObject().withMessage('Billing information must be an object'),
                body('paymentMethod').notEmpty().withMessage('Payment method is required')
            ]
        };
    }
}

module.exports = EnhancedShoppingCartController;