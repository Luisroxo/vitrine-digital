const BetaOnboardingService = require('../services/BetaOnboardingService');
const db = require('../database/connection');

// Função simples para gerar UUID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

class BetaOnboardingController {
    constructor() {
        this.onboardingService = new BetaOnboardingService(db);
    }

    // Start onboarding process
    async startOnboarding(req, res) {
        try {
            const { tenant_id } = req.user;
            const { user_type, metadata } = req.body;

            if (!user_type || !['supplier', 'retailer'].includes(user_type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid user_type (supplier or retailer) is required'
                });
            }

            const result = await this.onboardingService.createOnboarding(
                tenant_id, 
                user_type, 
                metadata
            );

            res.json(result);

        } catch (error) {
            console.error('Error starting onboarding:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Complete onboarding step
    async completeStep(req, res) {
        try {
            const { onboarding_id, step_id } = req.params;
            const stepData = req.body;

            const result = await this.onboardingService.completeStep(
                onboarding_id, 
                step_id, 
                stepData
            );

            res.json(result);

        } catch (error) {
            console.error('Error completing step:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get onboarding status
    async getOnboardingStatus(req, res) {
        try {
            const { tenant_id } = req.user;

            const status = await this.onboardingService.getOnboardingStatus(tenant_id);

            res.json({
                success: true,
                data: status
            });

        } catch (error) {
            console.error('Error getting onboarding status:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get onboarding steps for user type
    async getOnboardingSteps(req, res) {
        try {
            const { user_type } = req.params;

            if (!user_type || !['supplier', 'retailer'].includes(user_type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid user_type (supplier or retailer) is required'
                });
            }

            const steps = this.onboardingService.onboardingSteps[user_type] || [];

            res.json({
                success: true,
                data: {
                    user_type: user_type,
                    steps: steps,
                    total_steps: steps.length,
                    required_steps: steps.filter(s => s.required).length
                }
            });

        } catch (error) {
            console.error('Error getting onboarding steps:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Submit beta feedback
    async submitFeedback(req, res) {
        try {
            const { tenant_id } = req.user;
            const { feedback_type, category, rating, title, description, metadata } = req.body;

            if (!feedback_type || !title) {
                return res.status(400).json({
                    success: false,
                    message: 'feedback_type and title are required'
                });
            }

            const feedback = await db('beta_feedback').insert({
                id: generateId(),
                tenant_id,
                feedback_type,
                category,
                rating,
                title,
                description,
                metadata: JSON.stringify(metadata || {}),
                created_at: new Date(),
                updated_at: new Date()
            }).returning('*');

            res.json({
                success: true,
                message: 'Feedback submitted successfully',
                data: feedback[0]
            });

        } catch (error) {
            console.error('Error submitting feedback:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Create support ticket
    async createSupportTicket(req, res) {
        try {
            const { tenant_id } = req.user;
            const { subject, description, category, priority } = req.body;

            if (!subject || !description) {
                return res.status(400).json({
                    success: false,
                    message: 'subject and description are required'
                });
            }

            // Generate ticket number
            const ticketNumber = `VD-${Date.now().toString().slice(-6)}`;

            const ticket = await db('beta_support_tickets').insert({
                id: generateId(),
                tenant_id,
                ticket_number: ticketNumber,
                subject,
                description,
                category: category || 'general',
                priority: priority || 'medium',
                created_at: new Date(),
                updated_at: new Date()
            }).returning('*');

            res.json({
                success: true,
                message: 'Support ticket created successfully',
                data: ticket[0]
            });

        } catch (error) {
            console.error('Error creating support ticket:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get beta metrics dashboard
    async getBetaMetrics(req, res) {
        try {
            const { tenant_id } = req.user;
            const { start_date, end_date, metric_type } = req.query;

            let query = db('beta_metrics').where('tenant_id', tenant_id);

            if (start_date) {
                query = query.where('metric_date', '>=', start_date);
            }

            if (end_date) {
                query = query.where('metric_date', '<=', end_date);
            }

            if (metric_type) {
                query = query.where('metric_type', metric_type);
            }

            const metrics = await query.orderBy('metric_date', 'desc').limit(100);

            // Get summary statistics
            const summary = await db('beta_metrics')
                .where('tenant_id', tenant_id)
                .select('metric_type')
                .count('* as total')
                .sum('value as total_value')
                .avg('value as avg_value')
                .groupBy('metric_type');

            res.json({
                success: true,
                data: {
                    metrics,
                    summary,
                    total_records: metrics.length
                }
            });

        } catch (error) {
            console.error('Error getting beta metrics:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Record beta metric
    async recordMetric(req, res) {
        try {
            const { tenant_id } = req.user;
            const { metric_type, metric_name, value, unit, dimensions } = req.body;

            if (!metric_type || !metric_name || value === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'metric_type, metric_name, and value are required'
                });
            }

            const metric = await db('beta_metrics').insert({
                id: generateId(),
                tenant_id,
                metric_type,
                metric_name,
                value,
                unit,
                dimensions: JSON.stringify(dimensions || {}),
                metric_date: new Date().toISOString().split('T')[0], // Today's date
                created_at: new Date()
            }).returning('*');

            res.json({
                success: true,
                message: 'Metric recorded successfully',
                data: metric[0]
            });

        } catch (error) {
            console.error('Error recording metric:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get admin beta overview (for internal use)
    async getBetaOverview(req, res) {
        try {
            // This endpoint should be protected by admin authentication
            
            // Onboarding statistics
            const onboardingStats = await db('beta_onboarding')
                .select('status', 'user_type')
                .count('* as count')
                .groupBy('status', 'user_type');

            // Recent feedback
            const recentFeedback = await db('beta_feedback')
                .select('feedback_type', 'rating', 'title', 'created_at')
                .orderBy('created_at', 'desc')
                .limit(10);

            // Support tickets summary
            const supportStats = await db('beta_support_tickets')
                .select('status', 'priority')
                .count('* as count')
                .groupBy('status', 'priority');

            // Performance metrics
            const performanceStats = await db('beta_performance_logs')
                .select(
                    db.raw('AVG(response_time) as avg_response_time'),
                    db.raw('COUNT(*) as total_requests'),
                    db.raw('COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count')
                )
                .where('created_at', '>=', db.raw('NOW() - INTERVAL 24 HOUR'))
                .first();

            res.json({
                success: true,
                data: {
                    onboarding_stats: onboardingStats,
                    recent_feedback: recentFeedback,
                    support_stats: supportStats,
                    performance_stats: performanceStats
                }
            });

        } catch (error) {
            console.error('Error getting beta overview:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = BetaOnboardingController;