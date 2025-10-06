const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Beta Onboarding Service for Production Launch
class BetaOnboardingService {
    constructor(db, emailService, blingService) {
        this.db = db;
        this.emailService = emailService;
        this.blingService = blingService;
        this.onboardingSteps = this.setupOnboardingSteps();
    }

    setupOnboardingSteps() {
        return {
            supplier: [
                { id: 'registration', name: 'Cadastro Inicial', required: true },
                { id: 'plan_selection', name: 'Seleção do Plano', required: true },
                { id: 'payment_setup', name: 'Configuração de Pagamento', required: true },
                { id: 'domain_setup', name: 'Configuração do Domínio', required: true },
                { id: 'bling_integration', name: 'Integração Bling ERP', required: true },
                { id: 'product_sync', name: 'Sincronização de Produtos', required: true },
                { id: 'branding_setup', name: 'Personalização Visual', required: false },
                { id: 'first_partnership', name: 'Primeira Parceria', required: false },
                { id: 'training_complete', name: 'Treinamento Concluído', required: true }
            ],
            retailer: [
                { id: 'registration', name: 'Cadastro Inicial', required: true },
                { id: 'bling_integration', name: 'Integração Bling ERP', required: true },
                { id: 'accept_partnership', name: 'Aceitar Convite de Parceria', required: true },
                { id: 'product_catalog', name: 'Verificar Catálogo', required: true },
                { id: 'first_order_test', name: 'Teste de Pedido', required: false },
                { id: 'training_complete', name: 'Treinamento Concluído', required: true }
            ]
        };
    }

    // Create beta onboarding record
    async createOnboarding(tenantId, userType, metadata = {}) {
        try {
            const onboardingId = uuidv4();
            const steps = this.onboardingSteps[userType] || [];

            const onboardingRecord = {
                id: onboardingId,
                tenant_id: tenantId,
                user_type: userType,
                status: 'started',
                current_step: 0,
                total_steps: steps.length,
                steps_completed: [],
                metadata: JSON.stringify(metadata),
                created_at: new Date(),
                updated_at: new Date()
            };

            await this.db('beta_onboarding').insert(onboardingRecord);

            // Send welcome email
            await this.sendWelcomeEmail(tenantId, userType);

            // Log onboarding start
            await this.logOnboardingEvent(onboardingId, 'onboarding_started', {
                user_type: userType,
                steps_total: steps.length
            });

            return {
                success: true,
                onboarding_id: onboardingId,
                steps: steps,
                message: 'Onboarding process started successfully'
            };

        } catch (error) {
            console.error('Error creating onboarding:', error);
            throw new Error(`Failed to create onboarding: ${error.message}`);
        }
    }

    // Complete onboarding step
    async completeStep(onboardingId, stepId, stepData = {}) {
        try {
            const onboarding = await this.db('beta_onboarding')
                .where('id', onboardingId)
                .first();

            if (!onboarding) {
                throw new Error('Onboarding record not found');
            }

            const stepsCompleted = onboarding.steps_completed || [];
            const userType = onboarding.user_type;
            const allSteps = this.onboardingSteps[userType] || [];

            // Check if step exists and is not already completed
            const stepExists = allSteps.find(step => step.id === stepId);
            if (!stepExists) {
                throw new Error(`Invalid step: ${stepId}`);
            }

            if (stepsCompleted.includes(stepId)) {
                return {
                    success: true,
                    message: 'Step already completed',
                    progress: this.calculateProgress(stepsCompleted, allSteps)
                };
            }

            // Process specific step logic
            await this.processStepLogic(stepId, stepData, onboarding);

            // Update onboarding record
            const updatedStepsCompleted = [...stepsCompleted, stepId];
            const progress = this.calculateProgress(updatedStepsCompleted, allSteps);
            
            await this.db('beta_onboarding')
                .where('id', onboardingId)
                .update({
                    steps_completed: JSON.stringify(updatedStepsCompleted),
                    current_step: updatedStepsCompleted.length,
                    status: progress.percentage === 100 ? 'completed' : 'in_progress',
                    updated_at: new Date()
                });

            // Log step completion
            await this.logOnboardingEvent(onboardingId, 'step_completed', {
                step_id: stepId,
                step_data: stepData,
                progress: progress
            });

            // Send progress email if significant milestone
            if (progress.percentage >= 50 && progress.percentage < 100) {
                await this.sendProgressEmail(onboarding.tenant_id, progress);
            }

            // Send completion email if onboarding is finished
            if (progress.percentage === 100) {
                await this.sendCompletionEmail(onboarding.tenant_id, userType);
                await this.activateProductionFeatures(onboarding.tenant_id);
            }

            return {
                success: true,
                message: `Step '${stepId}' completed successfully`,
                progress: progress,
                next_steps: this.getNextSteps(updatedStepsCompleted, allSteps)
            };

        } catch (error) {
            console.error('Error completing step:', error);
            throw new Error(`Failed to complete step: ${error.message}`);
        }
    }

    // Process specific step logic
    async processStepLogic(stepId, stepData, onboarding) {
        switch (stepId) {
            case 'payment_setup':
                await this.validatePaymentSetup(stepData, onboarding.tenant_id);
                break;

            case 'domain_setup':
                await this.configureDomain(stepData, onboarding.tenant_id);
                break;

            case 'bling_integration':
                await this.validateBlingIntegration(stepData, onboarding.tenant_id);
                break;

            case 'product_sync':
                await this.initiateProductSync(onboarding.tenant_id);
                break;

            case 'first_partnership':
                await this.validateFirstPartnership(onboarding.tenant_id);
                break;

            default:
                // Generic step completion - just log the data
                console.log(`Completed generic step: ${stepId}`, stepData);
        }
    }

    // Validate payment setup
    async validatePaymentSetup(stepData, tenantId) {
        try {
            const subscription = await this.db('billing_subscriptions')
                .where('tenant_id', tenantId)
                .where('status', 'active')
                .first();

            if (!subscription) {
                throw new Error('No active subscription found');
            }

            return { valid: true, subscription_id: subscription.id };
        } catch (error) {
            throw new Error(`Payment validation failed: ${error.message}`);
        }
    }

    // Configure domain
    async configureDomain(stepData, tenantId) {
        try {
            const { domain } = stepData;
            if (!domain) {
                throw new Error('Domain is required');
            }

            // Update tenant domain
            await this.db('domains')
                .where('tenant_id', tenantId)
                .update({
                    domain: domain,
                    ssl_enabled: true,
                    status: 'active',
                    updated_at: new Date()
                });

            return { configured: true, domain: domain };
        } catch (error) {
            throw new Error(`Domain configuration failed: ${error.message}`);
        }
    }

    // Validate Bling integration
    async validateBlingIntegration(stepData, tenantId) {
        try {
            const blingConfig = await this.db('bling_multi_tenant_configs')
                .where('tenant_id', tenantId)
                .first();

            if (!blingConfig || !blingConfig.access_token) {
                throw new Error('Bling integration not configured');
            }

            // Test Bling API connection
            const testResult = await this.blingService.testConnection(tenantId);
            if (!testResult.success) {
                throw new Error('Bling API connection test failed');
            }

            return { valid: true, bling_connected: true };
        } catch (error) {
            throw new Error(`Bling validation failed: ${error.message}`);
        }
    }

    // Initiate product sync
    async initiateProductSync(tenantId) {
        try {
            const syncResult = await this.blingService.syncProducts(tenantId);
            return { 
                synced: true, 
                products_count: syncResult.products_synced || 0 
            };
        } catch (error) {
            throw new Error(`Product sync failed: ${error.message}`);
        }
    }

    // Calculate progress
    calculateProgress(stepsCompleted, allSteps) {
        const requiredSteps = allSteps.filter(step => step.required);
        const completedRequired = stepsCompleted.filter(stepId => {
            const step = allSteps.find(s => s.id === stepId);
            return step && step.required;
        });

        const totalOptional = allSteps.length - requiredSteps.length;
        const completedOptional = stepsCompleted.length - completedRequired.length;

        return {
            completed: stepsCompleted.length,
            total: allSteps.length,
            required_completed: completedRequired.length,
            required_total: requiredSteps.length,
            optional_completed: completedOptional,
            optional_total: totalOptional,
            percentage: Math.round((stepsCompleted.length / allSteps.length) * 100),
            required_percentage: Math.round((completedRequired.length / requiredSteps.length) * 100)
        };
    }

    // Get next steps
    getNextSteps(stepsCompleted, allSteps) {
        return allSteps
            .filter(step => !stepsCompleted.includes(step.id))
            .slice(0, 3) // Next 3 steps
            .map(step => ({
                id: step.id,
                name: step.name,
                required: step.required
            }));
    }

    // Get onboarding status
    async getOnboardingStatus(tenantId) {
        try {
            const onboarding = await this.db('beta_onboarding')
                .where('tenant_id', tenantId)
                .first();

            if (!onboarding) {
                return { exists: false };
            }

            const stepsCompleted = JSON.parse(onboarding.steps_completed || '[]');
            const allSteps = this.onboardingSteps[onboarding.user_type] || [];
            const progress = this.calculateProgress(stepsCompleted, allSteps);

            return {
                exists: true,
                id: onboarding.id,
                status: onboarding.status,
                user_type: onboarding.user_type,
                progress: progress,
                next_steps: this.getNextSteps(stepsCompleted, allSteps),
                created_at: onboarding.created_at,
                updated_at: onboarding.updated_at
            };

        } catch (error) {
            console.error('Error getting onboarding status:', error);
            throw new Error(`Failed to get onboarding status: ${error.message}`);
        }
    }

    // Send welcome email
    async sendWelcomeEmail(tenantId, userType) {
        try {
            // Implementation depends on your email service
            console.log(`Sending welcome email for tenant ${tenantId}, type: ${userType}`);
        } catch (error) {
            console.error('Error sending welcome email:', error);
        }
    }

    // Send progress email
    async sendProgressEmail(tenantId, progress) {
        try {
            console.log(`Sending progress email for tenant ${tenantId}`, progress);
        } catch (error) {
            console.error('Error sending progress email:', error);
        }
    }

    // Send completion email
    async sendCompletionEmail(tenantId, userType) {
        try {
            console.log(`Sending completion email for tenant ${tenantId}, type: ${userType}`);
        } catch (error) {
            console.error('Error sending completion email:', error);
        }
    }

    // Log onboarding event
    async logOnboardingEvent(onboardingId, eventType, eventData) {
        try {
            await this.db('beta_onboarding_logs').insert({
                id: uuidv4(),
                onboarding_id: onboardingId,
                event_type: eventType,
                event_data: JSON.stringify(eventData),
                created_at: new Date()
            });
        } catch (error) {
            console.error('Error logging onboarding event:', error);
        }
    }

    // Activate production features
    async activateProductionFeatures(tenantId) {
        try {
            await this.db('tenant_configs')
                .where('tenant_id', tenantId)
                .update({
                    onboarding_completed: true,
                    production_ready: true,
                    updated_at: new Date()
                });

            console.log(`Production features activated for tenant ${tenantId}`);
        } catch (error) {
            console.error('Error activating production features:', error);
        }
    }
}

module.exports = BetaOnboardingService;