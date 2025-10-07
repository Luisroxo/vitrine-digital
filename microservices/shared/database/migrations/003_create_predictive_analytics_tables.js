/**
 * @fileoverview Predictive Analytics Database Schema
 * @version 1.0.0
 * @description Tabelas para análises preditivas, ML models, previsões e anomalias
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return Promise.all([
    
    // Tabela para armazenar previsões geradas
    knex.schema.createTable('analytics_predictions', (table) => {
      table.increments('id').primary();
      table.string('metric_name', 100).notNullable();
      table.integer('forecast_horizon').notNullable();
      table.string('model_type', 50).notNullable();
      table.json('predictions').notNullable();
      table.json('confidence_scores');
      table.decimal('model_accuracy', 5, 4);
      table.timestamp('generated_at').defaultTo(knex.fn.now());
      table.timestamp('expires_at');
      table.boolean('is_active').defaultTo(true);
      
      table.index(['metric_name', 'generated_at']);
      table.index(['expires_at']);
    }),

    // Tabela para anomalias detectadas
    knex.schema.createTable('analytics_anomalies', (table) => {
      table.increments('id').primary();
      table.string('metric_name', 100).notNullable();
      table.timestamp('timestamp').notNullable();
      table.decimal('actual_value', 15, 4).notNullable();
      table.decimal('expected_value', 15, 4);
      table.decimal('z_score', 8, 4);
      table.enum('severity', ['low', 'medium', 'high', 'critical']).defaultTo('medium');
      table.enum('anomaly_type', ['spike', 'drop', 'pattern']).defaultTo('spike');
      table.decimal('confidence', 5, 4);
      table.json('metadata');
      table.timestamp('detected_at').defaultTo(knex.fn.now());
      table.boolean('acknowledged').defaultTo(false);
      table.timestamp('acknowledged_at');
      table.string('acknowledged_by', 100);
      
      table.index(['metric_name', 'timestamp']);
      table.index(['severity', 'acknowledged']);
      table.index(['detected_at']);
    }),

    // Tabela para análises de tendências
    knex.schema.createTable('analytics_trends', (table) => {
      table.increments('id').primary();
      table.string('metric_name', 100).notNullable();
      table.enum('trend_direction', ['upward', 'downward', 'stable']).notNullable();
      table.decimal('trend_strength', 5, 4); // 0-1 correlation strength
      table.decimal('trend_slope', 15, 8);
      table.boolean('seasonality_detected').defaultTo(false);
      table.integer('seasonality_period');
      table.decimal('seasonality_strength', 5, 4);
      table.decimal('volatility', 8, 4);
      table.integer('analysis_window'); // days
      table.integer('data_points');
      table.timestamp('analyzed_at').defaultTo(knex.fn.now());
      
      table.index(['metric_name', 'analyzed_at']);
      table.index(['trend_direction']);
    }),

    // Tabela para previsões de receita
    knex.schema.createTable('analytics_revenue_forecasts', (table) => {
      table.increments('id').primary();
      table.integer('forecast_horizon').notNullable();
      table.json('optimistic_scenario').notNullable();
      table.json('realistic_scenario').notNullable();
      table.json('pessimistic_scenario').notNullable();
      table.decimal('model_accuracy', 5, 4);
      table.json('assumptions');
      table.json('market_factors');
      table.timestamp('generated_at').defaultTo(knex.fn.now());
      table.timestamp('valid_until');
      table.boolean('is_active').defaultTo(true);
      
      table.index(['generated_at']);
      table.index(['is_active']);
    }),

    // Tabela para previsões de churn
    knex.schema.createTable('analytics_churn_predictions', (table) => {
      table.increments('id').primary();
      table.string('customer_id', 100).notNullable();
      table.decimal('churn_probability', 5, 4).notNullable(); // 0-1
      table.enum('risk_level', ['low', 'medium', 'high']).notNullable();
      table.json('risk_factors');
      table.json('recommended_actions');
      table.json('customer_features');
      table.decimal('model_confidence', 5, 4);
      table.timestamp('predicted_at').defaultTo(knex.fn.now());
      table.timestamp('valid_until');
      table.boolean('action_taken').defaultTo(false);
      table.string('action_type', 100);
      table.timestamp('action_date');
      table.text('action_notes');
      
      table.index(['customer_id', 'predicted_at']);
      table.index(['risk_level', 'action_taken']);
      table.index(['predicted_at']);
    }),

    // Tabela para otimizações de preço
    knex.schema.createTable('analytics_pricing_optimizations', (table) => {
      table.increments('id').primary();
      table.string('product_id', 100).notNullable();
      table.decimal('current_price', 10, 2).notNullable();
      table.decimal('optimal_price', 10, 2).notNullable();
      table.decimal('expected_revenue', 15, 2);
      table.decimal('price_elasticity', 8, 4);
      table.decimal('confidence', 5, 4);
      table.enum('recommended_change', ['increase', 'decrease', 'maintain']).notNullable();
      table.decimal('recommended_change_percent', 8, 4);
      table.json('market_factors');
      table.json('competitor_analysis');
      table.timestamp('optimized_at').defaultTo(knex.fn.now());
      table.boolean('implemented').defaultTo(false);
      table.timestamp('implemented_at');
      table.decimal('actual_impact', 15, 2);
      
      table.index(['product_id', 'optimized_at']);
      table.index(['recommended_change']);
      table.index(['implemented']);
    }),

    // Tabela para modelos de ML treinados
    knex.schema.createTable('analytics_ml_models', (table) => {
      table.increments('id').primary();
      table.string('model_name', 100).notNullable();
      table.string('metric_name', 100).notNullable();
      table.string('model_type', 50).notNullable();
      table.json('model_parameters');
      table.decimal('accuracy', 5, 4);
      table.decimal('validation_score', 5, 4);
      table.integer('training_data_points');
      table.timestamp('trained_at').defaultTo(knex.fn.now());
      table.timestamp('last_used_at');
      table.integer('usage_count').defaultTo(0);
      table.boolean('is_active').defaultTo(true);
      table.json('hyperparameters');
      table.text('training_notes');
      
      table.unique(['model_name', 'metric_name']);
      table.index(['metric_name', 'is_active']);
      table.index(['model_type']);
      table.index(['trained_at']);
    }),

    // Tabela para feature importance (importância de features em ML)
    knex.schema.createTable('analytics_feature_importance', (table) => {
      table.increments('id').primary();
      table.integer('model_id').unsigned().notNullable();
      table.string('feature_name', 100).notNullable();
      table.decimal('importance_score', 8, 6).notNullable();
      table.integer('feature_rank');
      table.enum('feature_type', ['numerical', 'categorical', 'boolean', 'text']).defaultTo('numerical');
      table.text('feature_description');
      table.timestamp('calculated_at').defaultTo(knex.fn.now());
      
      table.foreign('model_id').references('id').inTable('analytics_ml_models').onDelete('CASCADE');
      table.index(['model_id', 'importance_score']);
      table.index(['feature_name']);
    }),

    // Tabela para alertas de IA
    knex.schema.createTable('analytics_ai_alerts', (table) => {
      table.increments('id').primary();
      table.string('alert_type', 50).notNullable(); // anomaly, forecast, churn, pricing
      table.string('metric_name', 100);
      table.enum('severity', ['info', 'warning', 'critical']).defaultTo('info');
      table.string('title', 200).notNullable();
      table.text('description').notNullable();
      table.json('alert_data');
      table.json('recommended_actions');
      table.timestamp('triggered_at').defaultTo(knex.fn.now());
      table.boolean('acknowledged').defaultTo(false);
      table.timestamp('acknowledged_at');
      table.string('acknowledged_by', 100);
      table.text('resolution_notes');
      table.boolean('auto_resolved').defaultTo(false);
      table.timestamp('resolved_at');
      
      table.index(['alert_type', 'severity']);
      table.index(['acknowledged', 'triggered_at']);
      table.index(['triggered_at']);
    })

  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('analytics_ai_alerts'),
    knex.schema.dropTableIfExists('analytics_feature_importance'),
    knex.schema.dropTableIfExists('analytics_ml_models'),
    knex.schema.dropTableIfExists('analytics_pricing_optimizations'),
    knex.schema.dropTableIfExists('analytics_churn_predictions'),
    knex.schema.dropTableIfExists('analytics_revenue_forecasts'),
    knex.schema.dropTableIfExists('analytics_trends'),
    knex.schema.dropTableIfExists('analytics_anomalies'),
    knex.schema.dropTableIfExists('analytics_predictions')
  ]);
};