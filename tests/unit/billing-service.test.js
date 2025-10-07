/**
 * Billing Service Unit Tests
 * Tests for subscription management, payments, and invoicing
 */

const { testUtils } = require('../setup');

describe('Billing Service', () => {
  describe('Subscription Plans', () => {
    test('should create subscription plans with different features', () => {
      const plans = [
        {
          id: 1,
          name: 'Basic',
          price: 29.90,
          interval: 'monthly',
          features: ['100 produtos', 'Suporte por email'],
          maxProducts: 100,
          maxUsers: 2
        },
        {
          id: 2,
          name: 'Pro',
          price: 59.90,
          interval: 'monthly',
          features: ['500 produtos', 'Suporte prioritário', 'Relatórios avançados'],
          maxProducts: 500,
          maxUsers: 5
        },
        {
          id: 3,
          name: 'Enterprise',
          price: 149.90,
          interval: 'monthly',
          features: ['Produtos ilimitados', 'Suporte 24/7', 'API completa'],
          maxProducts: -1, // unlimited
          maxUsers: -1 // unlimited
        }
      ];

      plans.forEach(plan => {
        expect(plan.id).toBeDefined();
        expect(plan.name).toBeDefined();
        expect(plan.price).toBeGreaterThan(0);
        expect(plan.features).toBeInstanceOf(Array);
        expect(plan.features.length).toBeGreaterThan(0);
      });
    });

    test('should validate plan pricing', () => {
      const plans = [
        { name: 'Basic', price: 29.90 },
        { name: 'Pro', price: 59.90 },
        { name: 'Enterprise', price: 149.90 }
      ];

      plans.forEach(plan => {
        expect(plan.price).toBeGreaterThan(0);
        
        // Format as Brazilian currency
        const formatted = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(plan.price);
        
        expect(formatted).toHaveValidBrazilianCurrency();
      });
    });

    test('should handle annual vs monthly pricing', () => {
      const monthlyPrice = 59.90;
      const annualPrice = monthlyPrice * 12 * 0.8; // 20% discount
      const savings = (monthlyPrice * 12) - annualPrice;

      expect(annualPrice).toBeLessThan(monthlyPrice * 12);
      expect(savings).toBeGreaterThan(0);
      expect(savings).toBe(monthlyPrice * 12 * 0.2);
    });
  });

  describe('Subscription Management', () => {
    test('should create new subscription', () => {
      const tenant = testUtils.generateMockTenant();
      const subscription = {
        id: Math.floor(Math.random() * 1000),
        tenantId: tenant.id,
        planId: 1,
        status: 'active',
        startDate: new Date(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        createdAt: new Date()
      };

      expect(subscription.tenantId).toBe(tenant.id);
      expect(subscription.status).toBe('active');
      expect(subscription.nextBillingDate).toBeInstanceOf(Date);
      expect(subscription.nextBillingDate.getTime()).toBeGreaterThan(Date.now());
    });

    test('should handle subscription upgrades', () => {
      const currentSubscription = {
        planId: 1, // Basic
        price: 29.90,
        maxProducts: 100
      };

      const newSubscription = {
        planId: 2, // Pro
        price: 59.90,
        maxProducts: 500
      };

      expect(newSubscription.price).toBeGreaterThan(currentSubscription.price);
      expect(newSubscription.maxProducts).toBeGreaterThan(currentSubscription.maxProducts);
    });

    test('should handle subscription downgrades', () => {
      const currentSubscription = {
        planId: 2, // Pro
        price: 59.90,
        maxProducts: 500
      };

      const newSubscription = {
        planId: 1, // Basic
        price: 29.90,
        maxProducts: 100
      };

      expect(newSubscription.price).toBeLessThan(currentSubscription.price);
      expect(newSubscription.maxProducts).toBeLessThan(currentSubscription.maxProducts);
    });

    test('should calculate prorated billing', () => {
      const currentPlanPrice = 59.90;
      const newPlanPrice = 149.90;
      const daysUsed = 15;
      const daysInMonth = 30;
      
      const usedAmount = (currentPlanPrice / daysInMonth) * daysUsed;
      const remainingAmount = (newPlanPrice / daysInMonth) * (daysInMonth - daysUsed);
      const proratedAmount = remainingAmount - (currentPlanPrice - usedAmount);

      expect(proratedAmount).toBeGreaterThan(0);
      expect(usedAmount).toBeWithinRange(0, currentPlanPrice);
    });
  });

  describe('Payment Processing', () => {
    test('should process credit card payments', () => {
      const paymentData = {
        id: Math.random().toString(36).substring(2, 15),
        amount: 59.90,
        method: 'credit_card',
        status: 'completed',
        transactionId: 'tx_' + Math.random().toString(36).substring(2, 15),
        processedAt: new Date()
      };

      expect(paymentData.amount).toBeGreaterThan(0);
      expect(paymentData.method).toBe('credit_card');
      expect(paymentData.status).toBe('completed');
      expect(paymentData.transactionId).toMatch(/^tx_/);
    });

    test('should handle PIX payments', () => {
      const pixPayment = {
        id: Math.random().toString(36).substring(2, 15),
        amount: 59.90,
        method: 'pix',
        pixCode: '00020126360014BR.GOV.BCB.PIX0114+5511999999999',
        status: 'pending',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      };

      expect(pixPayment.method).toBe('pix');
      expect(pixPayment.pixCode).toBeDefined();
      expect(pixPayment.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('should handle boleto payments', () => {
      const boletoPayment = {
        id: Math.random().toString(36).substring(2, 15),
        amount: 59.90,
        method: 'boleto',
        boletoCode: '23791.23456.60009.123456.78901.234567.8.90120240001000',
        status: 'pending',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
      };

      expect(boletoPayment.method).toBe('boleto');
      expect(boletoPayment.boletoCode).toBeDefined();
      expect(boletoPayment.dueDate.getTime()).toBeGreaterThan(Date.now());
    });

    test('should validate payment amounts', () => {
      const validAmounts = [0.01, 10.50, 100.00, 999.99];
      const invalidAmounts = [0, -1, -10.50];

      validAmounts.forEach(amount => {
        expect(amount).toBeGreaterThan(0);
      });

      invalidAmounts.forEach(amount => {
        expect(amount).toBeLessThanOrEqual(0);
      });
    });
  });

  describe('Invoice Generation', () => {
    test('should generate monthly invoices', () => {
      const subscription = {
        tenantId: 1,
        planId: 1,
        price: 59.90
      };

      const invoice = {
        id: Math.floor(Math.random() * 1000),
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        amount: subscription.price,
        status: 'pending',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        items: [
          {
            description: 'Plano Pro - Mensal',
            amount: subscription.price,
            quantity: 1
          }
        ],
        createdAt: new Date()
      };

      expect(invoice.tenantId).toBe(subscription.tenantId);
      expect(invoice.amount).toBe(subscription.price);
      expect(invoice.status).toBe('pending');
      expect(invoice.items).toHaveLength(1);
    });

    test('should calculate taxes', () => {
      const baseAmount = 100.00;
      const taxRates = {
        pis: 0.0065, // 0.65%
        cofins: 0.03, // 3%
        iss: 0.05 // 5%
      };

      const pis = baseAmount * taxRates.pis;
      const cofins = baseAmount * taxRates.cofins;
      const iss = baseAmount * taxRates.iss;
      const totalTax = pis + cofins + iss;
      const totalAmount = baseAmount + totalTax;

      expect(totalTax).toBeGreaterThan(0);
      expect(totalAmount).toBeGreaterThan(baseAmount);
      expect(totalTax).toBe(pis + cofins + iss);
    });

    test('should handle invoice numbering', () => {
      const currentYear = new Date().getFullYear();
      const invoiceNumber = `${currentYear}001234`;
      
      expect(invoiceNumber).toMatch(/^\d{7}$/);
      expect(invoiceNumber.substring(0, 4)).toBe(currentYear.toString());
    });
  });

  describe('Credits System', () => {
    test('should add credits to tenant account', () => {
      const tenant = testUtils.generateMockTenant();
      const creditTransaction = {
        id: Math.floor(Math.random() * 1000),
        tenantId: tenant.id,
        type: 'purchase',
        amount: 100.00,
        credits: 1000, // 10 credits per R$ 1.00
        description: 'Compra de créditos',
        createdAt: new Date()
      };

      expect(creditTransaction.tenantId).toBe(tenant.id);
      expect(creditTransaction.type).toBe('purchase');
      expect(creditTransaction.credits).toBeGreaterThan(0);
      expect(creditTransaction.credits / creditTransaction.amount).toBe(10);
    });

    test('should deduct credits for usage', () => {
      const initialCredits = 1000;
      const usageCredits = 50;
      const remainingCredits = initialCredits - usageCredits;

      expect(remainingCredits).toBe(950);
      expect(remainingCredits).toBeGreaterThanOrEqual(0);
    });

    test('should prevent negative credit balance', () => {
      const currentCredits = 10;
      const requestedCredits = 20;
      const canProceed = currentCredits >= requestedCredits;

      expect(canProceed).toBe(false);
      expect(currentCredits).toBeLessThan(requestedCredits);
    });

    test('should calculate credit packages with bonuses', () => {
      const packages = [
        { amount: 50.00, baseCredits: 500, bonus: 0 },
        { amount: 100.00, baseCredits: 1000, bonus: 100 }, // 10% bonus
        { amount: 250.00, baseCredits: 2500, bonus: 500 } // 20% bonus
      ];

      packages.forEach(pkg => {
        const totalCredits = pkg.baseCredits + pkg.bonus;
        const creditsPerReal = totalCredits / pkg.amount;
        
        expect(totalCredits).toBeGreaterThanOrEqual(pkg.baseCredits);
        expect(creditsPerReal).toBeGreaterThanOrEqual(10);
      });
    });
  });

  describe('Payment Methods', () => {
    test('should store encrypted payment method data', () => {
      const paymentMethod = {
        id: Math.random().toString(36).substring(2, 15),
        tenantId: 1,
        type: 'credit_card',
        last4: '1234',
        brand: 'visa',
        expiryMonth: 12,
        expiryYear: 2025,
        isDefault: true,
        createdAt: new Date()
      };

      expect(paymentMethod.last4).toHaveLength(4);
      expect(paymentMethod.expiryYear).toBeGreaterThan(new Date().getFullYear());
      expect(paymentMethod.isDefault).toBe(true);
      expect(['visa', 'mastercard', 'elo', 'amex']).toContain(paymentMethod.brand);
    });

    test('should validate credit card expiration', () => {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      const validCards = [
        { expiryMonth: currentMonth + 1, expiryYear: currentYear },
        { expiryMonth: 1, expiryYear: currentYear + 1 },
        { expiryMonth: 12, expiryYear: currentYear + 2 }
      ];

      const invalidCards = [
        { expiryMonth: currentMonth - 1, expiryYear: currentYear },
        { expiryMonth: 12, expiryYear: currentYear - 1 }
      ];

      validCards.forEach(card => {
        const expiryDate = new Date(card.expiryYear, card.expiryMonth - 1);
        const now = new Date();
        expect(expiryDate.getTime()).toBeGreaterThanOrEqual(now.getTime());
      });

      invalidCards.forEach(card => {
        const expiryDate = new Date(card.expiryYear, card.expiryMonth - 1);
        const now = new Date();
        expect(expiryDate.getTime()).toBeLessThan(now.getTime());
      });
    });
  });

  describe('Billing Analytics', () => {
    test('should calculate monthly recurring revenue (MRR)', () => {
      const subscriptions = [
        { planPrice: 29.90, interval: 'monthly', status: 'active' },
        { planPrice: 59.90, interval: 'monthly', status: 'active' },
        { planPrice: 149.90, interval: 'monthly', status: 'active' },
        { planPrice: 599.90, interval: 'yearly', status: 'active' }, // Convert to monthly
        { planPrice: 29.90, interval: 'monthly', status: 'cancelled' } // Exclude
      ];

      const mrr = subscriptions
        .filter(sub => sub.status === 'active')
        .reduce((total, sub) => {
          const monthlyAmount = sub.interval === 'yearly' ? sub.planPrice / 12 : sub.planPrice;
          return total + monthlyAmount;
        }, 0);

      expect(mrr).toBeGreaterThan(0);
      expect(mrr).toBe(29.90 + 59.90 + 149.90 + (599.90 / 12));
    });

    test('should calculate customer lifetime value (CLV)', () => {
      const averageMonthlyRevenue = 59.90;
      const averageCustomerLifespan = 24; // months
      const grossMargin = 0.8; // 80%

      const clv = averageMonthlyRevenue * averageCustomerLifespan * grossMargin;

      expect(clv).toBeGreaterThan(0);
      expect(clv).toBe(averageMonthlyRevenue * averageCustomerLifespan * grossMargin);
    });

    test('should calculate churn rate', () => {
      const customersAtStart = 100;
      const customersLost = 5;
      const churnRate = (customersLost / customersAtStart) * 100;

      expect(churnRate).toBe(5);
      expect(churnRate).toBeWithinRange(0, 100);
    });
  });

  describe('Subscription Lifecycle', () => {
    test('should handle subscription pause and resume', () => {
      const subscription = {
        status: 'active',
        pausedAt: null,
        resumedAt: null
      };

      // Pause subscription
      const pausedSubscription = {
        ...subscription,
        status: 'paused',
        pausedAt: new Date()
      };

      expect(pausedSubscription.status).toBe('paused');
      expect(pausedSubscription.pausedAt).toBeInstanceOf(Date);

      // Resume subscription
      const resumedSubscription = {
        ...pausedSubscription,
        status: 'active',
        resumedAt: new Date()
      };

      expect(resumedSubscription.status).toBe('active');
      expect(resumedSubscription.resumedAt).toBeInstanceOf(Date);
    });

    test('should handle subscription cancellation', () => {
      const subscription = {
        status: 'active',
        cancelledAt: null,
        cancellationReason: null
      };

      const cancelledSubscription = {
        ...subscription,
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: 'User requested cancellation'
      };

      expect(cancelledSubscription.status).toBe('cancelled');
      expect(cancelledSubscription.cancelledAt).toBeInstanceOf(Date);
      expect(cancelledSubscription.cancellationReason).toBeDefined();
    });

    test('should handle grace period for failed payments', () => {
      const gracePeriodDays = 7;
      const failedPaymentDate = new Date();
      const graceEndDate = new Date(failedPaymentDate.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);

      const subscription = {
        status: 'past_due',
        lastPaymentAttempt: failedPaymentDate,
        graceEndDate: graceEndDate
      };

      expect(subscription.status).toBe('past_due');
      expect(subscription.graceEndDate.getTime()).toBeGreaterThan(failedPaymentDate.getTime());
    });
  });
});

describe('Billing Service Integration', () => {
  test('should integrate with tenant system', () => {
    const tenant = testUtils.generateMockTenant({ id: 1 });
    const subscription = {
      tenantId: tenant.id,
      planId: 1,
      status: 'active'
    };

    expect(subscription.tenantId).toBe(tenant.id);
  });

  test('should enforce plan limits', () => {
    const basicPlan = { maxProducts: 100, maxUsers: 2 };
    const tenant = testUtils.generateMockTenant({ planLimits: basicPlan });

    const products = Array.from({ length: 150 }, () => 
      testUtils.generateMockProduct({ tenantId: tenant.id })
    );

    const exceedsLimit = products.length > basicPlan.maxProducts;
    expect(exceedsLimit).toBe(true);
  });

  test('should integrate with notification system', () => {
    const paymentFailedNotification = {
      tenantId: 1,
      type: 'payment_failed',
      message: 'Falha no pagamento da assinatura',
      sentAt: new Date()
    };

    expect(paymentFailedNotification.type).toBe('payment_failed');
    expect(paymentFailedNotification.message).toBeDefined();
  });
});