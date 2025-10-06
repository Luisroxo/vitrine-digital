/**
 * Migration: Create Beta Onboarding System
 * 
 * This migration creates the necessary tables for the beta onboarding process,
 * tracking user progress through the setup steps and ensuring smooth production launch.
 */

exports.up = function(knex) {
    return knex.schema

        // Beta Onboarding Main Table
        .createTable('beta_onboarding', table => {
            table.uuid('id').primary();
            table.uuid('tenant_id').notNullable();
            table.string('user_type', 50).notNullable(); // 'supplier' or 'retailer'
            table.string('status', 50).defaultTo('started'); // started, in_progress, completed, abandoned
            table.integer('current_step').defaultTo(0);
            table.integer('total_steps').notNullable();
            table.json('steps_completed').defaultTo('[]');
            table.json('metadata').defaultTo('{}'); // Additional onboarding data
            table.timestamps(true, true);

            // Indexes
            table.index('tenant_id');
            table.index('user_type');
            table.index('status');
            table.index(['tenant_id', 'user_type']);

            // Foreign key
            table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
        })

        // Beta Onboarding Event Logs
        .createTable('beta_onboarding_logs', table => {
            table.uuid('id').primary();
            table.uuid('onboarding_id').notNullable();
            table.string('event_type', 100).notNullable(); // step_completed, error, milestone, etc.
            table.text('event_data').defaultTo('{}');
            table.timestamp('created_at').defaultTo(knex.fn.now());

            // Indexes
            table.index('onboarding_id');
            table.index('event_type');
            table.index('created_at');

            // Foreign key
            table.foreign('onboarding_id').references('id').inTable('beta_onboarding').onDelete('CASCADE');
        })

        // Beta User Feedback
        .createTable('beta_feedback', table => {
            table.uuid('id').primary();
            table.uuid('tenant_id').notNullable();
            table.string('feedback_type', 50).notNullable(); // 'bug', 'feature', 'improvement', 'praise'
            table.string('category', 100); // 'onboarding', 'ui', 'performance', 'integration'
            table.integer('rating'); // 1-5 rating
            table.text('title').notNullable();
            table.text('description');
            table.string('status', 50).defaultTo('open'); // open, in_review, resolved, closed
            table.string('priority', 50).defaultTo('medium'); // low, medium, high, critical
            table.text('metadata').defaultTo('{}'); // Screenshots, browser info, etc.
            table.timestamp('resolved_at');
            table.timestamps(true, true);

            // Indexes
            table.index('tenant_id');
            table.index('feedback_type');
            table.index('category');
            table.index('status');
            table.index('priority');
            table.index('rating');

            // Foreign key
            table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
        })

        // Beta Success Metrics
        .createTable('beta_metrics', table => {
            table.uuid('id').primary();
            table.uuid('tenant_id').notNullable();
            table.string('metric_type', 100).notNullable(); // 'login', 'product_sync', 'order_created', etc.
            table.string('metric_name', 200).notNullable();
            table.decimal('value', 15, 4).notNullable();
            table.string('unit', 50); // 'count', 'seconds', 'percentage', 'currency'
            table.text('dimensions').defaultTo('{}'); // Additional metric dimensions
            table.date('metric_date').notNullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());

            // Indexes
            table.index('tenant_id');
            table.index('metric_type');
            table.index('metric_name');
            table.index('metric_date');
            table.index(['tenant_id', 'metric_type']);
            table.index(['metric_date', 'metric_type']);

            // Foreign key
            table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
        })

        // Beta Support Tickets
        .createTable('beta_support_tickets', table => {
            table.uuid('id').primary();
            table.uuid('tenant_id').notNullable();
            table.string('ticket_number', 20).notNullable().unique();
            table.string('subject', 200).notNullable();
            table.text('description').notNullable();
            table.string('category', 100); // 'technical', 'billing', 'onboarding', 'general'
            table.string('priority', 50).defaultTo('medium'); // low, medium, high, urgent
            table.string('status', 50).defaultTo('open'); // open, in_progress, waiting, resolved, closed
            table.string('assigned_to', 100); // Support agent
            table.timestamp('first_response_at');
            table.timestamp('resolved_at');
            table.timestamp('closed_at');
            table.text('metadata').defaultTo('{}'); // Tags, attachments, etc.
            table.timestamps(true, true);

            // Indexes
            table.index('tenant_id');
            table.index('ticket_number');
            table.index('status');
            table.index('priority');
            table.index('category');
            table.index('assigned_to');

            // Foreign key
            table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
        })

        // Beta Performance Monitoring
        .createTable('beta_performance_logs', table => {
            table.uuid('id').primary();
            table.uuid('tenant_id');
            table.string('endpoint', 200).notNullable();
            table.string('method', 10).notNullable(); // GET, POST, PUT, DELETE
            table.integer('response_time').notNullable(); // milliseconds
            table.integer('status_code').notNullable();
            table.string('user_agent', 500);
            table.string('ip_address', 45);
            table.text('request_data').defaultTo('{}');
            table.text('error_data').defaultTo('{}');
            table.timestamp('created_at').defaultTo(knex.fn.now());

            // Indexes
            table.index('tenant_id');
            table.index('endpoint');
            table.index('method');
            table.index('status_code');
            table.index('created_at');
            table.index(['endpoint', 'method']);

            // Foreign key (nullable for system-wide endpoints)
            table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
        })

        // Add beta-related columns to existing tables
        .table('tenant_configs', table => {
            table.boolean('onboarding_completed').defaultTo(false);
            table.boolean('production_ready').defaultTo(false);
            table.timestamp('beta_started_at');
            table.timestamp('production_activated_at');
            table.text('beta_flags').defaultTo('{}'); // Feature flags for beta users
            table.text('beta_notes'); // Internal notes about the beta tenant
        });
};

exports.down = function(knex) {
    return knex.schema
        // Remove added columns first
        .table('tenant_configs', table => {
            table.dropColumn('onboarding_completed');
            table.dropColumn('production_ready');
            table.dropColumn('beta_started_at');
            table.dropColumn('production_activated_at');
            table.dropColumn('beta_flags');
            table.dropColumn('beta_notes');
        })
        
        // Drop tables in reverse order (respecting foreign keys)
        .dropTableIfExists('beta_performance_logs')
        .dropTableIfExists('beta_support_tickets')
        .dropTableIfExists('beta_metrics')
        .dropTableIfExists('beta_feedback')
        .dropTableIfExists('beta_onboarding_logs')
        .dropTableIfExists('beta_onboarding');
};