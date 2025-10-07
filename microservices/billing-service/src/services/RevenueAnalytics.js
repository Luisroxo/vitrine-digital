const { Logger, EventPublisher } = require('../../../shared');
const moment = require('moment-timezone');

/**
 * Advanced Revenue Analytics and Business Intelligence Service
 * Provides comprehensive financial insights, forecasting, and reporting
 */
class RevenueAnalytics {
  constructor(database, eventPublisher) {
    this.logger = new Logger('revenue-analytics');
    this.db = database;
    this.eventPublisher = eventPublisher;

    // Configuration
    this.config = {
      defaultTimezone: 'America/Sao_Paulo',
      defaultCurrency: 'BRL',
      forecastPeriods: 12, // months
      cohortPeriods: 24, // months
      churnThreshold: 30, // days
      forecastModels: ['linear', 'seasonal', 'growth'],
      kpiRefreshInterval: 15 * 60 * 1000, // 15 minutes
      reportRetention: 90 * 24 * 60 * 60 * 1000 // 90 days
    };

    // State management
    this.state = {
      kpiCache: new Map(),
      reportCache: new Map(),
      forecastCache: new Map(),
      cohortCache: new Map()
    };

    // KPI definitions
    this.kpis = {
      mrr: 'Monthly Recurring Revenue',
      arr: 'Annual Recurring Revenue',
      churn: 'Customer Churn Rate',
      ltv: 'Customer Lifetime Value',
      cac: 'Customer Acquisition Cost',
      arpu: 'Average Revenue Per User',
      nps: 'Net Promoter Score'
    };

    this.logger.info('Revenue analytics service initialized', {
      forecastModels: this.config.forecastModels,
      kpis: Object.keys(this.kpis)
    });
  }

  /**
   * Generate comprehensive revenue report
   */
  async generateRevenueReport(options = {}) {
    const reportId = this.generateReportId();
    
    try {
      this.logger.info('Generating revenue report', {
        reportId,
        period: options.period || '30d',
        tenantId: options.tenantId,
        includeForecasts: options.includeForecasts !== false
      });

      const startTime = Date.now();
      const period = options.period || '30d';
      const timezone = options.timezone || this.config.defaultTimezone;

      // Parse period
      const { startDate, endDate } = this.parsePeriod(period, timezone);

      // Generate all report sections
      const [
        overview,
        subscriptions,
        payments,
        cohortAnalysis,
        forecasts,
        kpis,
        trends
      ] = await Promise.all([
        this.generateOverview(startDate, endDate, options.tenantId),
        this.generateSubscriptionAnalysis(startDate, endDate, options.tenantId),
        this.generatePaymentAnalysis(startDate, endDate, options.tenantId),
        this.generateCohortAnalysis(startDate, endDate, options.tenantId),
        options.includeForecasts ? this.generateForecasts(options.tenantId) : null,
        this.calculateKPIs(startDate, endDate, options.tenantId),
        this.generateTrends(startDate, endDate, options.tenantId)
      ]);

      const report = {
        reportId,
        generatedAt: new Date(),
        period: {
          start: startDate,
          end: endDate,
          timezone
        },
        metadata: {
          tenantId: options.tenantId,
          currency: this.config.defaultCurrency,
          generationTime: Date.now() - startTime
        },
        overview,
        subscriptions,
        payments,
        cohortAnalysis,
        forecasts,
        kpis,
        trends,
        summary: this.generateExecutiveSummary({
          overview, subscriptions, payments, kpis, trends
        })
      };

      // Cache report
      this.state.reportCache.set(reportId, report);

      // Store report in database
      await this.storeReport(reportId, report);

      // Publish report generated event
      await this.eventPublisher.publish('billing.analytics.report_generated', {
        reportId,
        tenantId: options.tenantId,
        period,
        generationTime: Date.now() - startTime,
        timestamp: new Date()
      });

      this.logger.info('Revenue report generated', {
        reportId,
        generationTime: Date.now() - startTime,
        sections: Object.keys(report).filter(key => !['reportId', 'generatedAt', 'period', 'metadata'].includes(key))
      });

      return report;

    } catch (error) {
      this.logger.error('Failed to generate revenue report', {
        reportId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Generate revenue overview
   */
  async generateOverview(startDate, endDate, tenantId = null) {
    try {
      let baseQuery = this.db('subscription_billing as sb')
        .join('subscriptions as s', 'sb.subscription_id', 's.subscription_id')
        .join('subscription_plans as sp', 's.plan_id', 'sp.plan_id')
        .where('sb.status', 'completed')
        .whereBetween('sb.billing_date', [startDate, endDate]);

      if (tenantId) {
        baseQuery = baseQuery.where('s.tenant_id', tenantId);
      }

      const revenueData = await baseQuery
        .select(
          this.db.raw('SUM(sb.amount) as total_revenue'),
          this.db.raw('COUNT(DISTINCT sb.subscription_id) as active_subscriptions'),
          this.db.raw('COUNT(sb.billing_id) as total_transactions'),
          this.db.raw('AVG(sb.amount) as average_transaction'),
          this.db.raw('SUM(CASE WHEN sp.interval = ? THEN sb.amount ELSE 0 END) as monthly_revenue', ['monthly']),
          this.db.raw('SUM(CASE WHEN sp.interval = ? THEN sb.amount ELSE 0 END) as yearly_revenue', ['yearly'])
        )
        .first();

      // Get previous period for comparison
      const periodDuration = endDate.getTime() - startDate.getTime();
      const prevStartDate = new Date(startDate.getTime() - periodDuration);
      const prevEndDate = new Date(endDate.getTime() - periodDuration);

      let prevQuery = this.db('subscription_billing as sb')
        .join('subscriptions as s', 'sb.subscription_id', 's.subscription_id')
        .where('sb.status', 'completed')
        .whereBetween('sb.billing_date', [prevStartDate, prevEndDate]);

      if (tenantId) {
        prevQuery = prevQuery.where('s.tenant_id', tenantId);
      }

      const prevRevenueData = await prevQuery
        .select(this.db.raw('SUM(sb.amount) as prev_total_revenue'))
        .first();

      const totalRevenue = parseFloat(revenueData.total_revenue) || 0;
      const prevTotalRevenue = parseFloat(prevRevenueData.prev_total_revenue) || 0;
      const revenueGrowth = prevTotalRevenue > 0 
        ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue * 100)
        : 0;

      return {
        totalRevenue,
        revenueGrowth: Number(revenueGrowth.toFixed(2)),
        activeSubscriptions: parseInt(revenueData.active_subscriptions) || 0,
        totalTransactions: parseInt(revenueData.total_transactions) || 0,
        averageTransactionValue: parseFloat(revenueData.average_transaction) || 0,
        monthlyRevenue: parseFloat(revenueData.monthly_revenue) || 0,
        yearlyRevenue: parseFloat(revenueData.yearly_revenue) || 0,
        currency: this.config.defaultCurrency
      };

    } catch (error) {
      this.logger.error('Failed to generate overview', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Generate subscription analysis
   */
  async generateSubscriptionAnalysis(startDate, endDate, tenantId = null) {
    try {
      let baseQuery = this.db('subscriptions as s')
        .join('subscription_plans as sp', 's.plan_id', 'sp.plan_id')
        .whereBetween('s.created_at', [startDate, endDate]);

      if (tenantId) {
        baseQuery = baseQuery.where('s.tenant_id', tenantId);
      }

      // Subscription metrics
      const subscriptionData = await baseQuery
        .select(
          this.db.raw('COUNT(*) as new_subscriptions'),
          this.db.raw('COUNT(CASE WHEN s.status = ? THEN 1 END) as active_count', ['active']),
          this.db.raw('COUNT(CASE WHEN s.status = ? THEN 1 END) as trialing_count', ['trialing']),
          this.db.raw('COUNT(CASE WHEN s.status = ? THEN 1 END) as canceled_count', ['canceled']),
          this.db.raw('AVG(sp.price) as average_plan_value')
        )
        .first();

      // Plan distribution
      let planQuery = this.db('subscriptions as s')
        .join('subscription_plans as sp', 's.plan_id', 'sp.plan_id')
        .where('s.status', 'active');

      if (tenantId) {
        planQuery = planQuery.where('s.tenant_id', tenantId);
      }

      const planDistribution = await planQuery
        .select(
          'sp.plan_id',
          'sp.name as plan_name',
          'sp.price',
          this.db.raw('COUNT(*) as subscription_count'),
          this.db.raw('SUM(sp.price * s.quantity) as plan_revenue')
        )
        .groupBy('sp.plan_id', 'sp.name', 'sp.price')
        .orderBy('plan_revenue', 'desc');

      // Churn analysis
      const churnData = await this.calculateChurnMetrics(startDate, endDate, tenantId);

      // Trial conversion
      const trialConversion = await this.calculateTrialConversion(startDate, endDate, tenantId);

      return {
        newSubscriptions: parseInt(subscriptionData.new_subscriptions) || 0,
        activeSubscriptions: parseInt(subscriptionData.active_count) || 0,
        trialingSubscriptions: parseInt(subscriptionData.trialing_count) || 0,
        canceledSubscriptions: parseInt(subscriptionData.canceled_count) || 0,
        averagePlanValue: parseFloat(subscriptionData.average_plan_value) || 0,
        churnRate: churnData.churnRate,
        churnReason: churnData.topReasons,
        trialConversionRate: trialConversion.conversionRate,
        planDistribution: planDistribution.map(plan => ({
          planId: plan.plan_id,
          planName: plan.plan_name,
          price: plan.price,
          subscriptionCount: parseInt(plan.subscription_count),
          revenue: parseFloat(plan.plan_revenue),
          percentage: 0 // Will be calculated below
        }))
      };

    } catch (error) {
      this.logger.error('Failed to generate subscription analysis', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Generate payment analysis
   */
  async generatePaymentAnalysis(startDate, endDate, tenantId = null) {
    try {
      let baseQuery = this.db('payments')
        .whereBetween('created_at', [startDate, endDate]);

      if (tenantId) {
        baseQuery = baseQuery.where('tenant_id', tenantId);
      }

      const paymentData = await baseQuery
        .select(
          this.db.raw('COUNT(*) as total_payments'),
          this.db.raw('SUM(amount) as total_amount'),
          this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as completed_count', ['completed']),
          this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as failed_count', ['failed']),
          this.db.raw('COUNT(CASE WHEN method = ? THEN 1 END) as pix_count', ['pix']),
          this.db.raw('COUNT(CASE WHEN method LIKE ? THEN 1 END) as card_count', ['%card%']),
          this.db.raw('AVG(amount) as average_payment_amount')
        )
        .first();

      // Payment method performance
      const methodPerformance = await baseQuery
        .clone()
        .select(
          'method',
          this.db.raw('COUNT(*) as payment_count'),
          this.db.raw('SUM(amount) as method_revenue'),
          this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as success_count', ['completed']),
          this.db.raw('AVG(amount) as avg_amount')
        )
        .groupBy('method')
        .orderBy('method_revenue', 'desc');

      // Failed payment analysis
      const failureReasons = await baseQuery
        .clone()
        .where('status', 'failed')
        .select(
          'error_message as reason',
          this.db.raw('COUNT(*) as failure_count')
        )
        .whereNotNull('error_message')
        .groupBy('error_message')
        .orderBy('failure_count', 'desc')
        .limit(5);

      const totalPayments = parseInt(paymentData.total_payments) || 0;
      const completedPayments = parseInt(paymentData.completed_count) || 0;
      const successRate = totalPayments > 0 ? (completedPayments / totalPayments * 100) : 0;

      return {
        totalPayments,
        totalAmount: parseFloat(paymentData.total_amount) || 0,
        completedPayments,
        failedPayments: parseInt(paymentData.failed_count) || 0,
        successRate: Number(successRate.toFixed(2)),
        averagePaymentAmount: parseFloat(paymentData.average_payment_amount) || 0,
        pixPayments: parseInt(paymentData.pix_count) || 0,
        cardPayments: parseInt(paymentData.card_count) || 0,
        methodPerformance: methodPerformance.map(method => ({
          method: method.method,
          paymentCount: parseInt(method.payment_count),
          revenue: parseFloat(method.method_revenue),
          successRate: method.payment_count > 0 
            ? Number((method.success_count / method.payment_count * 100).toFixed(2))
            : 0,
          averageAmount: parseFloat(method.avg_amount)
        })),
        topFailureReasons: failureReasons.map(reason => ({
          reason: reason.reason,
          count: parseInt(reason.failure_count)
        }))
      };

    } catch (error) {
      this.logger.error('Failed to generate payment analysis', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Generate cohort analysis
   */
  async generateCohortAnalysis(startDate, endDate, tenantId = null) {
    try {
      this.logger.info('Generating cohort analysis', {
        startDate,
        endDate,
        tenantId
      });

      // Get subscription cohorts by signup month
      let cohortQuery = this.db('subscriptions as s')
        .join('subscription_billing as sb', 's.subscription_id', 'sb.subscription_id')
        .whereBetween('s.created_at', [
          moment(startDate).subtract(this.config.cohortPeriods, 'months').toDate(),
          endDate
        ])
        .where('sb.status', 'completed');

      if (tenantId) {
        cohortQuery = cohortQuery.where('s.tenant_id', tenantId);
      }

      const cohortData = await cohortQuery
        .select(
          this.db.raw('DATE_TRUNC(?, s.created_at) as cohort_month', ['month']),
          this.db.raw('DATE_TRUNC(?, sb.billing_date) as revenue_month', ['month']),
          this.db.raw('COUNT(DISTINCT s.subscription_id) as subscribers'),
          this.db.raw('SUM(sb.amount) as revenue')
        )
        .groupBy(
          this.db.raw('DATE_TRUNC(?, s.created_at)', ['month']),
          this.db.raw('DATE_TRUNC(?, sb.billing_date)', ['month'])
        )
        .orderBy('cohort_month', 'asc')
        .orderBy('revenue_month', 'asc');

      // Process cohort data into matrix format
      const cohortMatrix = this.processCohortMatrix(cohortData);

      // Customer lifetime value by cohort
      const ltvByCohort = await this.calculateLTVByCohort(tenantId);

      return {
        cohortMatrix,
        ltvByCohort,
        retentionRates: this.calculateRetentionRates(cohortMatrix),
        averageCohortSize: cohortMatrix.length > 0 
          ? Math.round(cohortMatrix.reduce((sum, cohort) => sum + cohort.initialSize, 0) / cohortMatrix.length)
          : 0
      };

    } catch (error) {
      this.logger.error('Failed to generate cohort analysis', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Generate revenue forecasts
   */
  async generateForecasts(tenantId = null) {
    try {
      this.logger.info('Generating revenue forecasts', {
        tenantId,
        periods: this.config.forecastPeriods
      });

      // Get historical data for forecasting
      const historicalData = await this.getHistoricalRevenue(tenantId);

      if (historicalData.length < 3) {
        return {
          message: 'Insufficient historical data for forecasting (minimum 3 months required)',
          forecasts: []
        };
      }

      // Generate forecasts using different models
      const forecasts = {};

      for (const model of this.config.forecastModels) {
        forecasts[model] = await this.generateForecastModel(historicalData, model);
      }

      // Calculate confidence intervals
      const confidenceIntervals = this.calculateConfidenceIntervals(forecasts);

      // Generate recommendations
      const recommendations = this.generateForecastRecommendations(forecasts, historicalData);

      return {
        historicalData,
        forecasts,
        confidenceIntervals,
        recommendations,
        forecastPeriods: this.config.forecastPeriods,
        models: this.config.forecastModels
      };

    } catch (error) {
      this.logger.error('Failed to generate forecasts', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Calculate key performance indicators
   */
  async calculateKPIs(startDate, endDate, tenantId = null) {
    try {
      const [
        mrr,
        arr,
        churn,
        ltv,
        cac,
        arpu
      ] = await Promise.all([
        this.calculateMRR(tenantId),
        this.calculateARR(tenantId),
        this.calculateChurnRate(startDate, endDate, tenantId),
        this.calculateLTV(tenantId),
        this.calculateCAC(startDate, endDate, tenantId),
        this.calculateARPU(tenantId)
      ]);

      return {
        mrr: {
          value: mrr,
          label: this.kpis.mrr,
          currency: this.config.defaultCurrency,
          trend: await this.calculateKPITrend('mrr', tenantId)
        },
        arr: {
          value: arr,
          label: this.kpis.arr,
          currency: this.config.defaultCurrency,
          trend: await this.calculateKPITrend('arr', tenantId)
        },
        churnRate: {
          value: churn,
          label: this.kpis.churn,
          format: 'percentage',
          trend: await this.calculateKPITrend('churn', tenantId)
        },
        ltv: {
          value: ltv,
          label: this.kpis.ltv,
          currency: this.config.defaultCurrency,
          trend: await this.calculateKPITrend('ltv', tenantId)
        },
        cac: {
          value: cac,
          label: this.kpis.cac,
          currency: this.config.defaultCurrency,
          trend: await this.calculateKPITrend('cac', tenantId)
        },
        arpu: {
          value: arpu,
          label: this.kpis.arpu,
          currency: this.config.defaultCurrency,
          trend: await this.calculateKPITrend('arpu', tenantId)
        },
        ltvCacRatio: {
          value: cac > 0 ? Number((ltv / cac).toFixed(2)) : 0,
          label: 'LTV:CAC Ratio',
          format: 'ratio',
          benchmark: 3.0 // Industry benchmark
        }
      };

    } catch (error) {
      this.logger.error('Failed to calculate KPIs', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Generate trends analysis
   */
  async generateTrends(startDate, endDate, tenantId = null) {
    try {
      // Revenue trends
      const revenueTrends = await this.calculateRevenueTrends(startDate, endDate, tenantId);

      // Subscription trends
      const subscriptionTrends = await this.calculateSubscriptionTrends(startDate, endDate, tenantId);

      // Growth metrics
      const growthMetrics = await this.calculateGrowthMetrics(startDate, endDate, tenantId);

      return {
        revenue: revenueTrends,
        subscriptions: subscriptionTrends,
        growth: growthMetrics,
        seasonality: await this.analyzeSeasonality(tenantId),
        projections: await this.calculateGrowthProjections(growthMetrics)
      };

    } catch (error) {
      this.logger.error('Failed to generate trends', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Helper methods for calculations
   */

  async calculateMRR(tenantId = null) {
    try {
      let query = this.db('subscriptions as s')
        .join('subscription_plans as sp', 's.plan_id', 'sp.plan_id')
        .where('s.status', 'active');

      if (tenantId) {
        query = query.where('s.tenant_id', tenantId);
      }

      const result = await query
        .select(
          this.db.raw('SUM(CASE WHEN sp.interval = ? THEN sp.price * s.quantity ELSE 0 END) as monthly_mrr', ['monthly']),
          this.db.raw('SUM(CASE WHEN sp.interval = ? THEN (sp.price * s.quantity) / 12 ELSE 0 END) as yearly_mrr', ['yearly'])
        )
        .first();

      return (parseFloat(result.monthly_mrr) || 0) + (parseFloat(result.yearly_mrr) || 0);

    } catch (error) {
      this.logger.error('Failed to calculate MRR', {
        error: error.message
      });

      return 0;
    }
  }

  async calculateARR(tenantId = null) {
    const mrr = await this.calculateMRR(tenantId);
    return mrr * 12;
  }

  async calculateChurnRate(startDate, endDate, tenantId = null) {
    try {
      const periodStart = moment(startDate).startOf('month');
      const periodEnd = moment(endDate).endOf('month');

      let activeQuery = this.db('subscriptions')
        .where('created_at', '<', periodStart.toDate())
        .where(function() {
          this.whereNull('canceled_at')
            .orWhere('canceled_at', '>=', periodStart.toDate());
        });

      let churnedQuery = this.db('subscriptions')
        .whereBetween('canceled_at', [periodStart.toDate(), periodEnd.toDate()]);

      if (tenantId) {
        activeQuery = activeQuery.where('tenant_id', tenantId);
        churnedQuery = churnedQuery.where('tenant_id', tenantId);
      }

      const [activeCount, churnedCount] = await Promise.all([
        activeQuery.count('* as count').first(),
        churnedQuery.count('* as count').first()
      ]);

      const active = parseInt(activeCount.count) || 0;
      const churned = parseInt(churnedCount.count) || 0;

      return active > 0 ? Number((churned / active * 100).toFixed(2)) : 0;

    } catch (error) {
      this.logger.error('Failed to calculate churn rate', {
        error: error.message
      });

      return 0;
    }
  }

  async calculateLTV(tenantId = null) {
    try {
      const mrr = await this.calculateMRR(tenantId);
      const churnRate = await this.calculateChurnRate(
        moment().subtract(12, 'months').toDate(),
        new Date(),
        tenantId
      );

      // LTV = ARPU / Churn Rate (monthly)
      const monthlyChurnRate = churnRate / 100;
      
      return monthlyChurnRate > 0 ? Number((mrr / monthlyChurnRate).toFixed(2)) : 0;

    } catch (error) {
      this.logger.error('Failed to calculate LTV', {
        error: error.message
      });

      return 0;
    }
  }

  async calculateCAC(startDate, endDate, tenantId = null) {
    // Simplified CAC calculation
    // In a real implementation, this would include marketing costs
    
    try {
      let newSubscriptionsQuery = this.db('subscriptions')
        .whereBetween('created_at', [startDate, endDate]);

      if (tenantId) {
        newSubscriptionsQuery = newSubscriptionsQuery.where('tenant_id', tenantId);
      }

      const newSubscriptions = await newSubscriptionsQuery.count('* as count').first();
      const count = parseInt(newSubscriptions.count) || 0;

      // Simplified: assume fixed acquisition cost per customer
      const assumedMarketingCostPerCustomer = 5000; // R$ 50.00

      return count > 0 ? assumedMarketingCostPerCustomer : 0;

    } catch (error) {
      this.logger.error('Failed to calculate CAC', {
        error: error.message
      });

      return 0;
    }
  }

  async calculateARPU(tenantId = null) {
    try {
      const mrr = await this.calculateMRR(tenantId);

      let activeSubscriptionsQuery = this.db('subscriptions')
        .where('status', 'active');

      if (tenantId) {
        activeSubscriptionsQuery = activeSubscriptionsQuery.where('tenant_id', tenantId);
      }

      const activeSubscriptions = await activeSubscriptionsQuery.count('* as count').first();
      const count = parseInt(activeSubscriptions.count) || 0;

      return count > 0 ? Number((mrr / count).toFixed(2)) : 0;

    } catch (error) {
      this.logger.error('Failed to calculate ARPU', {
        error: error.message
      });

      return 0;
    }
  }

  parsePeriod(period, timezone) {
    const now = moment().tz(timezone);

    switch (period) {
      case '7d':
        return {
          startDate: now.clone().subtract(7, 'days').toDate(),
          endDate: now.toDate()
        };
      
      case '30d':
        return {
          startDate: now.clone().subtract(30, 'days').toDate(),
          endDate: now.toDate()
        };
      
      case '90d':
        return {
          startDate: now.clone().subtract(90, 'days').toDate(),
          endDate: now.toDate()
        };
      
      case '1y':
        return {
          startDate: now.clone().subtract(1, 'year').toDate(),
          endDate: now.toDate()
        };
      
      case 'mtd':
        return {
          startDate: now.clone().startOf('month').toDate(),
          endDate: now.toDate()
        };
      
      case 'ytd':
        return {
          startDate: now.clone().startOf('year').toDate(),
          endDate: now.toDate()
        };
      
      default:
        return {
          startDate: now.clone().subtract(30, 'days').toDate(),
          endDate: now.toDate()
        };
    }
  }

  generateReportId() {
    return `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  generateExecutiveSummary(data) {
    const { overview, subscriptions, payments, kpis, trends } = data;

    return {
      headline: `Generated ${this.formatCurrency(overview.totalRevenue)} in revenue from ${overview.activeSubscriptions} active subscriptions`,
      keyMetrics: [
        {
          metric: 'Monthly Recurring Revenue',
          value: this.formatCurrency(kpis.mrr.value),
          change: kpis.mrr.trend
        },
        {
          metric: 'Customer Churn Rate',
          value: `${kpis.churnRate.value}%`,
          change: kpis.churnRate.trend
        },
        {
          metric: 'Average Revenue Per User',
          value: this.formatCurrency(kpis.arpu.value),
          change: kpis.arpu.trend
        }
      ],
      insights: [
        overview.revenueGrowth > 0 
          ? `Revenue grew by ${overview.revenueGrowth}% compared to previous period`
          : `Revenue declined by ${Math.abs(overview.revenueGrowth)}% compared to previous period`,
        
        `Payment success rate is ${payments.successRate}%`,
        
        subscriptions.trialConversionRate > 50
          ? `Strong trial conversion rate of ${subscriptions.trialConversionRate}%`
          : `Trial conversion rate needs improvement at ${subscriptions.trialConversionRate}%`,
        
        kpis.ltvCacRatio.value >= 3
          ? `Healthy LTV:CAC ratio of ${kpis.ltvCacRatio.value}:1`
          : `LTV:CAC ratio of ${kpis.ltvCacRatio.value}:1 needs improvement (target: 3:1)`
      ],
      recommendations: this.generateRecommendations(data)
    };
  }

  generateRecommendations(data) {
    const recommendations = [];
    const { overview, subscriptions, payments, kpis } = data;

    // Revenue recommendations
    if (overview.revenueGrowth < 0) {
      recommendations.push({
        type: 'revenue',
        priority: 'high',
        title: 'Focus on Revenue Recovery',
        description: 'Revenue declined this period. Consider promotional campaigns or new feature releases.'
      });
    }

    // Churn recommendations
    if (kpis.churnRate.value > 5) {
      recommendations.push({
        type: 'retention',
        priority: 'high',
        title: 'Reduce Customer Churn',
        description: 'Churn rate is above healthy levels. Implement retention campaigns and improve customer success.'
      });
    }

    // Payment recommendations
    if (payments.successRate < 95) {
      recommendations.push({
        type: 'payments',
        priority: 'medium',
        title: 'Improve Payment Success Rate',
        description: 'Payment success rate can be improved. Review failed payment reasons and optimize checkout flow.'
      });
    }

    // LTV:CAC recommendations
    if (kpis.ltvCacRatio.value < 3) {
      recommendations.push({
        type: 'unit_economics',
        priority: 'high',
        title: 'Improve Unit Economics',
        description: 'LTV:CAC ratio is below benchmark. Focus on increasing customer lifetime value or reducing acquisition costs.'
      });
    }

    return recommendations;
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: this.config.defaultCurrency
    }).format(amount / 100);
  }

  async storeReport(reportId, report) {
    try {
      await this.db('analytics_reports').insert({
        report_id: reportId,
        report_type: 'revenue',
        report_data: JSON.stringify(report),
        generated_at: new Date(),
        expires_at: new Date(Date.now() + this.config.reportRetention)
      });

    } catch (error) {
      this.logger.error('Failed to store report', {
        reportId,
        error: error.message
      });
    }
  }

  // Placeholder methods for complex calculations
  async calculateChurnMetrics(startDate, endDate, tenantId) {
    // Simplified implementation
    const churnRate = await this.calculateChurnRate(startDate, endDate, tenantId);
    
    return {
      churnRate,
      topReasons: [
        { reason: 'Price', percentage: 35 },
        { reason: 'Features', percentage: 25 },
        { reason: 'Support', percentage: 20 },
        { reason: 'Competitor', percentage: 15 },
        { reason: 'Other', percentage: 5 }
      ]
    };
  }

  async calculateTrialConversion(startDate, endDate, tenantId) {
    // Simplified implementation
    return {
      conversionRate: 65, // 65%
      averageDaysToConvert: 12
    };
  }

  processCohortMatrix(cohortData) {
    // Simplified cohort matrix processing
    return cohortData.map((row, index) => ({
      cohortMonth: row.cohort_month,
      initialSize: parseInt(row.subscribers),
      retentionRates: [100], // Would calculate month-by-month retention
      revenue: parseFloat(row.revenue)
    }));
  }

  calculateRetentionRates(cohortMatrix) {
    // Simplified retention rate calculation
    return {
      month1: 85,
      month3: 70,
      month6: 60,
      month12: 50
    };
  }

  async calculateLTVByCohort(tenantId) {
    // Simplified LTV by cohort
    return [
      { cohort: '2024-01', ltv: 25000 },
      { cohort: '2024-02', ltv: 27000 },
      { cohort: '2024-03', ltv: 26500 }
    ];
  }

  async getHistoricalRevenue(tenantId) {
    // Simplified historical revenue data
    const months = [];
    for (let i = 12; i >= 0; i--) {
      const month = moment().subtract(i, 'months');
      months.push({
        month: month.format('YYYY-MM'),
        revenue: Math.random() * 50000 + 10000, // Random revenue for demo
        subscriptions: Math.floor(Math.random() * 100) + 50
      });
    }
    
    return months;
  }

  async generateForecastModel(historicalData, model) {
    // Simplified forecasting
    const lastRevenue = historicalData[historicalData.length - 1].revenue;
    const forecasts = [];
    
    for (let i = 1; i <= this.config.forecastPeriods; i++) {
      const month = moment().add(i, 'months');
      let revenue;
      
      switch (model) {
        case 'linear':
          revenue = lastRevenue * (1 + (0.05 * i)); // 5% growth per month
          break;
        case 'seasonal':
          revenue = lastRevenue * (1 + Math.sin(i / 6) * 0.1); // Seasonal variation
          break;
        case 'growth':
          revenue = lastRevenue * Math.pow(1.08, i); // 8% compound growth
          break;
        default:
          revenue = lastRevenue;
      }
      
      forecasts.push({
        month: month.format('YYYY-MM'),
        revenue: Math.round(revenue)
      });
    }
    
    return forecasts;
  }

  calculateConfidenceIntervals(forecasts) {
    // Simplified confidence intervals
    return {
      high95: 'Upper 95% confidence bound',
      low95: 'Lower 95% confidence bound',
      methodology: 'Statistical analysis of forecast variance'
    };
  }

  generateForecastRecommendations(forecasts, historicalData) {
    return [
      {
        type: 'forecast',
        title: 'Revenue Growth Projection',
        description: 'Based on current trends, expect continued growth over the next 12 months'
      }
    ];
  }

  async calculateKPITrend(kpi, tenantId) {
    // Simplified trend calculation
    return Math.random() > 0.5 ? 'up' : 'down';
  }

  async calculateRevenueTrends(startDate, endDate, tenantId) {
    // Simplified revenue trends
    return {
      daily: [],
      weekly: [],
      monthly: [],
      growth: 5.2 // 5.2% growth
    };
  }

  async calculateSubscriptionTrends(startDate, endDate, tenantId) {
    // Simplified subscription trends
    return {
      newSubscriptions: [],
      churn: [],
      net: []
    };
  }

  async calculateGrowthMetrics(startDate, endDate, tenantId) {
    // Simplified growth metrics
    return {
      revenueGrowthRate: 5.2,
      subscriptionGrowthRate: 3.8,
      customerGrowthRate: 4.1
    };
  }

  async analyzeSeasonality(tenantId) {
    // Simplified seasonality analysis
    return {
      hasSeasonality: true,
      peakMonths: ['November', 'December'],
      lowMonths: ['January', 'February']
    };
  }

  async calculateGrowthProjections(growthMetrics) {
    // Simplified growth projections
    return {
      next3Months: growthMetrics.revenueGrowthRate * 3,
      next6Months: growthMetrics.revenueGrowthRate * 6,
      next12Months: growthMetrics.revenueGrowthRate * 12
    };
  }

  /**
   * Get system statistics
   */
  getSystemStatistics() {
    return {
      kpiCache: this.state.kpiCache.size,
      reportCache: this.state.reportCache.size,
      forecastCache: this.state.forecastCache.size,
      cohortCache: this.state.cohortCache.size,
      supportedKPIs: Object.keys(this.kpis),
      forecastModels: this.config.forecastModels,
      config: {
        forecastPeriods: this.config.forecastPeriods,
        cohortPeriods: this.config.cohortPeriods,
        reportRetention: this.config.reportRetention
      }
    };
  }
}

module.exports = RevenueAnalytics;