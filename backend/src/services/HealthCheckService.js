const express = require('express');
const { promisify } = require('util');

// Health Check Service for Production Monitoring
class HealthCheckService {
    constructor() {
        this.checks = new Map();
        this.setupDefaultChecks();
    }

    setupDefaultChecks() {
        // Database connectivity check
        this.checks.set('database', async () => {
            try {
                const db = require('../database/connection');
                await db.raw('SELECT 1');
                return { status: 'healthy', message: 'Database connection successful' };
            } catch (error) {
                return { status: 'unhealthy', message: `Database error: ${error.message}` };
            }
        });

        // Redis connectivity check
        this.checks.set('redis', async () => {
            try {
                const redis = require('redis');
                const client = redis.createClient(process.env.REDIS_URL);
                await client.connect();
                await client.ping();
                await client.quit();
                return { status: 'healthy', message: 'Redis connection successful' };
            } catch (error) {
                return { status: 'unhealthy', message: `Redis error: ${error.message}` };
            }
        });

        // Stripe connectivity check
        this.checks.set('stripe', async () => {
            try {
                const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                await stripe.accounts.retrieve();
                return { status: 'healthy', message: 'Stripe API accessible' };
            } catch (error) {
                return { status: 'unhealthy', message: `Stripe error: ${error.message}` };
            }
        });

        // Bling API connectivity check
        this.checks.set('bling', async () => {
            try {
                const axios = require('axios');
                const response = await axios.get('https://www.bling.com.br/Api/v3/situacoes/modulos', {
                    timeout: 5000,
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                return { status: 'healthy', message: 'Bling API accessible' };
            } catch (error) {
                return { status: 'unhealthy', message: `Bling API error: ${error.message}` };
            }
        });

        // File system check
        this.checks.set('filesystem', async () => {
            try {
                const fs = require('fs').promises;
                const path = require('path');
                const testFile = path.join('./uploads', '.health-check');
                
                await fs.writeFile(testFile, 'health-check');
                await fs.unlink(testFile);
                
                return { status: 'healthy', message: 'File system read/write successful' };
            } catch (error) {
                return { status: 'unhealthy', message: `File system error: ${error.message}` };
            }
        });

        // Memory usage check
        this.checks.set('memory', async () => {
            const used = process.memoryUsage();
            const totalMB = Math.round(used.rss / 1024 / 1024);
            const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
            const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
            
            const memoryThreshold = 1024; // 1GB threshold
            
            if (totalMB > memoryThreshold) {
                return {
                    status: 'warning',
                    message: `High memory usage: ${totalMB}MB (heap: ${heapUsedMB}/${heapTotalMB}MB)`
                };
            }
            
            return {
                status: 'healthy',
                message: `Memory usage: ${totalMB}MB (heap: ${heapUsedMB}/${heapTotalMB}MB)`
            };
        });

        // Uptime check
        this.checks.set('uptime', async () => {
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            
            return {
                status: 'healthy',
                message: `Uptime: ${days}d ${hours}h ${minutes}m`
            };
        });
    }

    // Add custom health check
    addCheck(name, checkFunction) {
        this.checks.set(name, checkFunction);
    }

    // Remove health check
    removeCheck(name) {
        this.checks.delete(name);
    }

    // Run individual health check
    async runCheck(name) {
        const check = this.checks.get(name);
        if (!check) {
            return { status: 'error', message: `Health check '${name}' not found` };
        }

        try {
            const result = await Promise.race([
                check(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Health check timeout')), 5000)
                )
            ]);
            
            return {
                name,
                timestamp: new Date().toISOString(),
                ...result
            };
        } catch (error) {
            return {
                name,
                timestamp: new Date().toISOString(),
                status: 'error',
                message: `Health check failed: ${error.message}`
            };
        }
    }

    // Run all health checks
    async runAllChecks() {
        const results = {};
        const promises = Array.from(this.checks.keys()).map(async (name) => {
            results[name] = await this.runCheck(name);
        });

        await Promise.all(promises);

        // Determine overall health status
        const statuses = Object.values(results).map(r => r.status);
        let overallStatus = 'healthy';
        
        if (statuses.includes('unhealthy') || statuses.includes('error')) {
            overallStatus = 'unhealthy';
        } else if (statuses.includes('warning')) {
            overallStatus = 'warning';
        }

        return {
            overall: overallStatus,
            timestamp: new Date().toISOString(),
            checks: results,
            summary: {
                healthy: statuses.filter(s => s === 'healthy').length,
                warning: statuses.filter(s => s === 'warning').length,
                unhealthy: statuses.filter(s => s === 'unhealthy').length,
                error: statuses.filter(s => s === 'error').length,
                total: statuses.length
            }
        };
    }

    // Get simple health status (for load balancer)
    async getSimpleHealth() {
        try {
            // Run only critical checks for simple health endpoint
            const criticalChecks = ['database', 'redis'];
            const results = await Promise.all(
                criticalChecks.map(name => this.runCheck(name))
            );

            const hasUnhealthy = results.some(r => 
                r.status === 'unhealthy' || r.status === 'error'
            );

            return {
                status: hasUnhealthy ? 'unhealthy' : 'healthy',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    // Setup Express routes for health checks
    setupRoutes(app) {
        // Simple health check for load balancers
        app.get('/health', async (req, res) => {
            try {
                const health = await this.getSimpleHealth();
                const statusCode = health.status === 'healthy' ? 200 : 503;
                res.status(statusCode).json(health);
            } catch (error) {
                res.status(503).json({
                    status: 'error',
                    timestamp: new Date().toISOString(),
                    error: error.message
                });
            }
        });

        // Detailed health check for monitoring
        app.get('/health/detailed', async (req, res) => {
            try {
                const health = await this.runAllChecks();
                const statusCode = health.overall === 'healthy' ? 200 : 
                                 health.overall === 'warning' ? 200 : 503;
                res.status(statusCode).json(health);
            } catch (error) {
                res.status(503).json({
                    status: 'error',
                    timestamp: new Date().toISOString(),
                    error: error.message
                });
            }
        });

        // Individual health check
        app.get('/health/:check', async (req, res) => {
            try {
                const result = await this.runCheck(req.params.check);
                const statusCode = result.status === 'healthy' ? 200 : 503;
                res.status(statusCode).json(result);
            } catch (error) {
                res.status(404).json({
                    status: 'error',
                    timestamp: new Date().toISOString(),
                    error: `Health check '${req.params.check}' not found`
                });
            }
        });

        // List available health checks
        app.get('/health-checks', (req, res) => {
            res.json({
                checks: Array.from(this.checks.keys()),
                count: this.checks.size
            });
        });
    }
}

module.exports = HealthCheckService;