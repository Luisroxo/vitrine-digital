/**
 * @fileoverview Predictive Analytics Engine with Machine Learning
 * @version 1.0.0
 * @description Motor de análises preditivas com algoritmos de ML
 * para forecasting, anomaly detection e trend prediction
 */

const EventEmitter = require('events');

class PredictiveAnalyticsEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      predictionWindow: options.predictionWindow || 30, // dias
      confidenceThreshold: options.confidenceThreshold || 0.8,
      anomalyThreshold: options.anomalyThreshold || 2.5, // desvios padrão
      trendMinSamples: options.trendMinSamples || 7,
      forecastHorizon: options.forecastHorizon || 90, // dias
      ...options
    };
    
    this.models = new Map();
    this.trainingData = new Map();
    this.predictions = new Map();
    this.anomalies = [];
    this.trends = new Map();
  }

  /**
   * Treinar modelo preditivo para uma métrica específica
   */
  async trainModel(metricName, historicalData, modelType = 'linear_regression') {
    try {
      const processedData = this.preprocessData(historicalData);
      
      let model;
      switch (modelType) {
        case 'linear_regression':
          model = this.trainLinearRegression(processedData);
          break;
        case 'moving_average':
          model = this.trainMovingAverage(processedData);
          break;
        case 'exponential_smoothing':
          model = this.trainExponentialSmoothing(processedData);
          break;
        case 'seasonal_decomposition':
          model = this.trainSeasonalDecomposition(processedData);
          break;
        default:
          throw new Error(`Unknown model type: ${modelType}`);
      }

      this.models.set(metricName, {
        type: modelType,
        model: model,
        accuracy: model.accuracy,
        trainedAt: new Date(),
        dataPoints: processedData.length
      });

      this.trainingData.set(metricName, processedData);
      
      this.emit('modelTrained', {
        metricName,
        modelType,
        accuracy: model.accuracy,
        dataPoints: processedData.length
      });

      return model;
    } catch (error) {
      this.emit('error', { operation: 'trainModel', error: error.message });
      throw error;
    }
  }

  /**
   * Gerar previsões para uma métrica
   */
  async generatePredictions(metricName, horizon = null) {
    try {
      const modelInfo = this.models.get(metricName);
      if (!modelInfo) {
        throw new Error(`No trained model found for metric: ${metricName}`);
      }

      const predictionHorizon = horizon || this.config.forecastHorizon;
      const predictions = this.predict(modelInfo, predictionHorizon);
      
      const predictionData = {
        metricName,
        predictions: predictions.values,
        confidence: predictions.confidence,
        horizon: predictionHorizon,
        generatedAt: new Date(),
        modelType: modelInfo.type,
        modelAccuracy: modelInfo.accuracy
      };

      this.predictions.set(metricName, predictionData);
      
      this.emit('predictionsGenerated', predictionData);
      
      return predictionData;
    } catch (error) {
      this.emit('error', { operation: 'generatePredictions', error: error.message });
      throw error;
    }
  }

  /**
   * Detectar anomalias em dados em tempo real
   */
  async detectAnomalies(metricName, recentData, historicalData) {
    try {
      const stats = this.calculateStatistics(historicalData);
      const anomalies = [];

      for (const dataPoint of recentData) {
        const zScore = Math.abs((dataPoint.value - stats.mean) / stats.standardDeviation);
        
        if (zScore > this.config.anomalyThreshold) {
          const anomaly = {
            metricName,
            timestamp: dataPoint.timestamp,
            value: dataPoint.value,
            expectedValue: stats.mean,
            zScore,
            severity: this.calculateAnomalySeverity(zScore),
            type: dataPoint.value > stats.mean ? 'spike' : 'drop',
            confidence: Math.min(zScore / this.config.anomalyThreshold, 1.0)
          };
          
          anomalies.push(anomaly);
          this.anomalies.push(anomaly);
        }
      }

      if (anomalies.length > 0) {
        this.emit('anomaliesDetected', { metricName, anomalies });
      }

      return anomalies;
    } catch (error) {
      this.emit('error', { operation: 'detectAnomalies', error: error.message });
      throw error;
    }
  }

  /**
   * Análise de tendências
   */
  async analyzeTrends(metricName, data, timeWindow = 30) {
    try {
      if (data.length < this.config.trendMinSamples) {
        throw new Error(`Insufficient data points for trend analysis. Need at least ${this.config.trendMinSamples}`);
      }

      const trend = this.calculateTrend(data, timeWindow);
      const seasonality = this.detectSeasonality(data);
      const cyclicity = this.detectCyclicity(data);
      
      const trendAnalysis = {
        metricName,
        trend: {
          direction: trend.slope > 0 ? 'upward' : trend.slope < 0 ? 'downward' : 'stable',
          strength: Math.abs(trend.correlation),
          slope: trend.slope,
          correlation: trend.correlation
        },
        seasonality: {
          detected: seasonality.isDetected,
          period: seasonality.period,
          strength: seasonality.strength
        },
        cyclicity: {
          detected: cyclicity.isDetected,
          cycles: cyclicity.cycles
        },
        volatility: this.calculateVolatility(data),
        analyzedAt: new Date(),
        dataPoints: data.length,
        timeWindow
      };

      this.trends.set(metricName, trendAnalysis);
      
      this.emit('trendAnalyzed', trendAnalysis);
      
      return trendAnalysis;
    } catch (error) {
      this.emit('error', { operation: 'analyzeTrends', error: error.message });
      throw error;
    }
  }

  /**
   * Previsão de receita com múltiplos cenários
   */
  async forecastRevenue(historicalRevenue, marketFactors = {}) {
    try {
      const baseModel = await this.trainModel('revenue', historicalRevenue, 'seasonal_decomposition');
      const baseForecast = await this.generatePredictions('revenue', 90);
      
      // Cenários: otimista, realista, pessimista
      const scenarios = {
        optimistic: this.applyScenarioFactors(baseForecast.predictions, {
          growthMultiplier: 1.2,
          seasonalBoost: 1.1,
          ...marketFactors.optimistic
        }),
        realistic: baseForecast.predictions,
        pessimistic: this.applyScenarioFactors(baseForecast.predictions, {
          growthMultiplier: 0.8,
          seasonalPenalty: 0.9,
          ...marketFactors.pessimistic
        })
      };

      const forecast = {
        metricName: 'revenue',
        scenarios,
        confidence: baseForecast.confidence,
        modelAccuracy: baseModel.accuracy,
        assumptions: marketFactors,
        generatedAt: new Date(),
        horizon: 90
      };

      this.emit('revenueForecast', forecast);
      
      return forecast;
    } catch (error) {
      this.emit('error', { operation: 'forecastRevenue', error: error.message });
      throw error;
    }
  }

  /**
   * Previsão de churn de clientes
   */
  async predictCustomerChurn(customerData, behaviorMetrics) {
    try {
      const churnFeatures = this.extractChurnFeatures(customerData, behaviorMetrics);
      const churnProbabilities = [];

      for (const customer of churnFeatures) {
        const churnScore = this.calculateChurnScore(customer);
        
        churnProbabilities.push({
          customerId: customer.customerId,
          churnProbability: churnScore.probability,
          riskLevel: churnScore.riskLevel,
          factors: churnScore.factors,
          recommendedActions: this.getChurnPreventionActions(churnScore)
        });
      }

      const churnAnalysis = {
        totalCustomers: customerData.length,
        highRiskCustomers: churnProbabilities.filter(c => c.riskLevel === 'high').length,
        mediumRiskCustomers: churnProbabilities.filter(c => c.riskLevel === 'medium').length,
        lowRiskCustomers: churnProbabilities.filter(c => c.riskLevel === 'low').length,
        averageChurnProbability: churnProbabilities.reduce((sum, c) => sum + c.churnProbability, 0) / churnProbabilities.length,
        predictions: churnProbabilities,
        analyzedAt: new Date()
      };

      this.emit('churnPredicted', churnAnalysis);
      
      return churnAnalysis;
    } catch (error) {
      this.emit('error', { operation: 'predictCustomerChurn', error: error.message });
      throw error;
    }
  }

  /**
   * Otimização de preços baseada em ML
   */
  async optimizePricing(productData, marketData, competitorData) {
    try {
      const pricingFeatures = this.extractPricingFeatures(productData, marketData, competitorData);
      const optimizations = [];

      for (const product of pricingFeatures) {
        const optimalPrice = this.calculateOptimalPrice(product);
        const priceElasticity = this.calculatePriceElasticity(product);
        
        optimizations.push({
          productId: product.productId,
          currentPrice: product.currentPrice,
          optimalPrice: optimalPrice.price,
          expectedRevenue: optimalPrice.expectedRevenue,
          priceElasticity: priceElasticity,
          confidence: optimalPrice.confidence,
          recommendedChange: this.getPriceChangeRecommendation(product.currentPrice, optimalPrice.price)
        });
      }

      const pricingOptimization = {
        totalProducts: productData.length,
        optimizations,
        aggregatedImpact: {
          totalRevenueIncrease: optimizations.reduce((sum, o) => sum + (o.expectedRevenue - o.currentPrice * (productData.find(p => p.id === o.productId)?.sales || 0)), 0),
          averageOptimalPriceChange: optimizations.reduce((sum, o) => sum + ((o.optimalPrice - o.currentPrice) / o.currentPrice), 0) / optimizations.length
        },
        analyzedAt: new Date()
      };

      this.emit('pricingOptimized', pricingOptimization);
      
      return pricingOptimization;
    } catch (error) {
      this.emit('error', { operation: 'optimizePricing', error: error.message });
      throw error;
    }
  }

  // Métodos auxiliares para algoritmos de ML

  preprocessData(data) {
    return data
      .filter(point => point.value !== null && point.value !== undefined)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map((point, index) => ({
        ...point,
        index,
        value: parseFloat(point.value)
      }));
  }

  trainLinearRegression(data) {
    const n = data.length;
    const sumX = data.reduce((sum, point, index) => sum + index, 0);
    const sumY = data.reduce((sum, point) => sum + point.value, 0);
    const sumXY = data.reduce((sum, point, index) => sum + index * point.value, 0);
    const sumXX = data.reduce((sum, point, index) => sum + index * index, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const predictions = data.map((point, index) => slope * index + intercept);
    const accuracy = this.calculateAccuracy(data.map(p => p.value), predictions);

    return {
      type: 'linear_regression',
      parameters: { slope, intercept },
      accuracy,
      predict: (x) => slope * x + intercept
    };
  }

  trainMovingAverage(data, window = 7) {
    const predictions = [];
    
    for (let i = window - 1; i < data.length; i++) {
      const windowData = data.slice(i - window + 1, i + 1);
      const average = windowData.reduce((sum, point) => sum + point.value, 0) / window;
      predictions.push(average);
    }

    const actualValues = data.slice(window - 1).map(p => p.value);
    const accuracy = this.calculateAccuracy(actualValues, predictions);

    return {
      type: 'moving_average',
      parameters: { window },
      accuracy,
      predict: (recentData) => {
        const recent = recentData.slice(-window);
        return recent.reduce((sum, point) => sum + point.value, 0) / recent.length;
      }
    };
  }

  trainExponentialSmoothing(data, alpha = 0.3) {
    const smoothed = [data[0].value];
    
    for (let i = 1; i < data.length; i++) {
      const smoothedValue = alpha * data[i].value + (1 - alpha) * smoothed[i - 1];
      smoothed.push(smoothedValue);
    }

    const accuracy = this.calculateAccuracy(data.map(p => p.value), smoothed);

    return {
      type: 'exponential_smoothing',
      parameters: { alpha },
      accuracy,
      predict: (lastSmoothed, newValue) => alpha * newValue + (1 - alpha) * lastSmoothed
    };
  }

  trainSeasonalDecomposition(data) {
    const seasonLength = this.detectSeasonalPeriod(data);
    const trend = this.extractTrend(data);
    const seasonal = this.extractSeasonal(data, seasonLength);
    
    const predictions = data.map((point, index) => {
      const trendValue = trend[index] || trend[trend.length - 1];
      const seasonalValue = seasonal[index % seasonLength] || 0;
      return trendValue + seasonalValue;
    });

    const accuracy = this.calculateAccuracy(data.map(p => p.value), predictions);

    return {
      type: 'seasonal_decomposition',
      parameters: { seasonLength, trend, seasonal },
      accuracy,
      predict: (index) => {
        const trendValue = trend[Math.min(index, trend.length - 1)];
        const seasonalValue = seasonal[index % seasonLength];
        return trendValue + seasonalValue;
      }
    };
  }

  predict(modelInfo, horizon) {
    const { model } = modelInfo;
    const predictions = [];
    const confidence = [];

    for (let i = 0; i < horizon; i++) {
      let prediction;
      
      switch (model.type) {
        case 'linear_regression':
          prediction = model.predict(this.trainingData.get('revenue')?.length + i || i);
          break;
        case 'seasonal_decomposition':
          prediction = model.predict(this.trainingData.get('revenue')?.length + i || i);
          break;
        default:
          prediction = 0;
      }

      predictions.push({
        date: this.addDays(new Date(), i + 1),
        value: Math.max(0, prediction),
        index: i
      });

      confidence.push(Math.max(0.1, model.accuracy - (i * 0.01))); // Confidence decreases over time
    }

    return { values: predictions, confidence };
  }

  calculateStatistics(data) {
    const values = data.map(d => d.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      mean,
      variance,
      standardDeviation,
      min: Math.min(...values),
      max: Math.max(...values),
      median: this.calculateMedian(values)
    };
  }

  calculateAccuracy(actual, predicted) {
    if (actual.length !== predicted.length) return 0;
    
    const mse = actual.reduce((sum, val, index) => {
      return sum + Math.pow(val - predicted[index], 2);
    }, 0) / actual.length;

    const variance = this.calculateStatistics(actual.map((val, index) => ({ value: val }))).variance;
    
    return Math.max(0, 1 - (mse / variance));
  }

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  // Métodos auxiliares específicos (simplificados para o contexto)
  
  calculateAnomalySeverity(zScore) {
    if (zScore > 4) return 'critical';
    if (zScore > 3) return 'high';
    if (zScore > 2.5) return 'medium';
    return 'low';
  }

  calculateTrend(data, window) {
    // Simplified linear trend calculation
    const recentData = data.slice(-window);
    const n = recentData.length;
    const sumX = recentData.reduce((sum, _, index) => sum + index, 0);
    const sumY = recentData.reduce((sum, point) => sum + point.value, 0);
    const sumXY = recentData.reduce((sum, point, index) => sum + index * point.value, 0);
    const sumXX = recentData.reduce((sum, _, index) => sum + index * index, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const correlation = slope; // Simplified correlation

    return { slope, correlation };
  }

  detectSeasonality(data) {
    // Simplified seasonality detection
    return {
      isDetected: data.length > 14,
      period: 7, // Weekly seasonality
      strength: 0.5
    };
  }

  detectCyclicity(data) {
    // Simplified cyclicity detection
    return {
      isDetected: false,
      cycles: []
    };
  }

  calculateVolatility(data) {
    const values = data.map(d => d.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
  }

  // Placeholder methods for complex ML operations
  
  applyScenarioFactors(predictions, factors) {
    return predictions.map(p => ({
      ...p,
      value: p.value * (factors.growthMultiplier || 1) * (factors.seasonalBoost || factors.seasonalPenalty || 1)
    }));
  }

  extractChurnFeatures(customerData, behaviorMetrics) {
    // Simplified feature extraction for churn prediction
    return customerData.map(customer => ({
      customerId: customer.id,
      features: {
        daysSinceLastOrder: customer.daysSinceLastOrder || 0,
        totalOrders: customer.totalOrders || 0,
        avgOrderValue: customer.avgOrderValue || 0,
        supportTickets: customer.supportTickets || 0
      }
    }));
  }

  calculateChurnScore(customer) {
    // Simplified churn scoring
    const { features } = customer;
    let score = 0;
    
    if (features.daysSinceLastOrder > 30) score += 0.3;
    if (features.totalOrders < 3) score += 0.2;
    if (features.avgOrderValue < 50) score += 0.1;
    if (features.supportTickets > 2) score += 0.4;

    return {
      probability: Math.min(score, 1.0),
      riskLevel: score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low',
      factors: Object.keys(features)
    };
  }

  getChurnPreventionActions(churnScore) {
    const actions = [];
    if (churnScore.probability > 0.7) {
      actions.push('Immediate personal outreach', 'Special discount offer', 'Priority support');
    } else if (churnScore.probability > 0.4) {
      actions.push('Email re-engagement campaign', 'Product recommendations');
    }
    return actions;
  }

  // Additional helper methods would be implemented here...
  detectSeasonalPeriod(data) { return 7; }
  extractTrend(data) { return data.map(d => d.value); }
  extractSeasonal(data, period) { return new Array(period).fill(0); }
  extractPricingFeatures(productData, marketData, competitorData) { return productData; }
  calculateOptimalPrice(product) { return { price: product.currentPrice * 1.1, expectedRevenue: 0, confidence: 0.8 }; }
  calculatePriceElasticity(product) { return -1.2; }
  getPriceChangeRecommendation(current, optimal) { return optimal > current ? 'increase' : optimal < current ? 'decrease' : 'maintain'; }
}

module.exports = PredictiveAnalyticsEngine;