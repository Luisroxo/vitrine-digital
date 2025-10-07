/**
 * @fileoverview Notification Service - Multi-channel alert system for SLA monitoring
 * @version 1.0.0
 * @description Sistema de notificações multi-canal com suporte a email, Slack, 
 * webhooks e escalação automática de alertas
 */

const nodemailer = require('nodemailer');
const axios = require('axios');

class NotificationService {
  constructor(options = {}) {
    this.config = {
      // Email configuration
      email: {
        enabled: options.email?.enabled || false,
        smtp: {
          host: options.email?.smtp?.host || process.env.SMTP_HOST,
          port: options.email?.smtp?.port || process.env.SMTP_PORT || 587,
          secure: options.email?.smtp?.secure || false,
          auth: {
            user: options.email?.smtp?.auth?.user || process.env.SMTP_USER,
            pass: options.email?.smtp?.auth?.pass || process.env.SMTP_PASS
          }
        },
        from: options.email?.from || process.env.SMTP_FROM || 'noreply@vitrine-digital.com',
        to: options.email?.to || process.env.ALERT_EMAIL_TO?.split(',') || []
      },

      // Slack configuration
      slack: {
        enabled: options.slack?.enabled || false,
        webhookUrl: options.slack?.webhookUrl || process.env.SLACK_WEBHOOK_URL,
        channel: options.slack?.channel || '#alerts',
        username: options.slack?.username || 'SLA Monitor',
        iconEmoji: options.slack?.iconEmoji || ':warning:'
      },

      // Webhook configuration
      webhook: {
        enabled: options.webhook?.enabled || false,
        urls: options.webhook?.urls || (process.env.WEBHOOK_URLS ? process.env.WEBHOOK_URLS.split(',') : []),
        timeout: options.webhook?.timeout || 5000,
        retries: options.webhook?.retries || 3
      },

      // Escalation configuration
      escalation: {
        enabled: options.escalation?.enabled || false,
        levels: options.escalation?.levels || [
          { level: 'warning', delay: 0 },
          { level: 'critical', delay: 300000 }, // 5 minutes
          { level: 'severe', delay: 900000 }   // 15 minutes
        ]
      }
    };

    this.logService = options.logService;
    this.initializeTransports();
  }

  /**
   * Initialize notification transports
   */
  initializeTransports() {
    // Initialize email transport
    if (this.config.email.enabled && this.config.email.smtp.host) {
      try {
        this.emailTransport = nodemailer.createTransporter({
          host: this.config.email.smtp.host,
          port: this.config.email.smtp.port,
          secure: this.config.email.smtp.secure,
          auth: this.config.email.smtp.auth
        });

        // Test connection
        this.emailTransport.verify((error) => {
          if (error) {
            console.error('Email transport verification failed:', error);
            this.config.email.enabled = false;
          } else if (this.logService) {
            this.logService.info('Email transport initialized successfully');
          }
        });
      } catch (error) {
        console.error('Failed to initialize email transport:', error);
        this.config.email.enabled = false;
      }
    }

    if (this.logService) {
      this.logService.info('Notification service initialized', {
        email: this.config.email.enabled,
        slack: this.config.slack.enabled,
        webhook: this.config.webhook.enabled,
        escalation: this.config.escalation.enabled
      });
    }
  }

  /**
   * Send alert through all configured channels
   */
  async sendAlert(alert) {
    const results = {
      email: null,
      slack: null,
      webhook: null,
      timestamp: new Date().toISOString()
    };

    try {
      // Send through all configured channels in parallel
      const promises = [];

      if (this.config.email.enabled) {
        promises.push(
          this.sendEmailAlert(alert)
            .then(result => { results.email = result; })
            .catch(error => { results.email = { success: false, error: error.message }; })
        );
      }

      if (this.config.slack.enabled) {
        promises.push(
          this.sendSlackAlert(alert)
            .then(result => { results.slack = result; })
            .catch(error => { results.slack = { success: false, error: error.message }; })
        );
      }

      if (this.config.webhook.enabled) {
        promises.push(
          this.sendWebhookAlert(alert)
            .then(result => { results.webhook = result; })
            .catch(error => { results.webhook = { success: false, error: error.message }; })
        );
      }

      await Promise.all(promises);

      if (this.logService) {
        this.logService.info('Alert sent through notification channels', {
          alertId: alert.id,
          results
        });
      }

      return results;

    } catch (error) {
      if (this.logService) {
        this.logService.error('Failed to send alert notifications', error, {
          alertId: alert.id
        });
      }
      throw error;
    }
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(alert) {
    if (!this.config.email.enabled || !this.emailTransport) {
      return { success: false, reason: 'Email not configured' };
    }

    try {
      const subject = this.generateEmailSubject(alert);
      const html = this.generateEmailHTML(alert);
      const text = this.generateEmailText(alert);

      const mailOptions = {
        from: this.config.email.from,
        to: this.config.email.to,
        subject,
        text,
        html
      };

      const info = await this.emailTransport.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: info.messageId,
        recipients: this.config.email.to.length
      };

    } catch (error) {
      console.error('Email send failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert) {
    if (!this.config.slack.enabled || !this.config.slack.webhookUrl) {
      return { success: false, reason: 'Slack not configured' };
    }

    try {
      const payload = this.generateSlackPayload(alert);
      
      const response = await axios.post(this.config.slack.webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      return {
        success: true,
        status: response.status,
        channel: this.config.slack.channel
      };

    } catch (error) {
      console.error('Slack send failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send webhook alert
   */
  async sendWebhookAlert(alert) {
    if (!this.config.webhook.enabled || this.config.webhook.urls.length === 0) {
      return { success: false, reason: 'Webhook not configured' };
    }

    const results = [];
    
    for (const url of this.config.webhook.urls) {
      try {
        const payload = this.generateWebhookPayload(alert);
        
        const response = await axios.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.config.webhook.timeout
        });

        results.push({
          url,
          success: true,
          status: response.status
        });

      } catch (error) {
        results.push({
          url,
          success: false,
          error: error.message
        });

        // Retry logic
        if (this.config.webhook.retries > 0) {
          await this.retryWebhook(url, alert, this.config.webhook.retries);
        }
      }
    }

    return {
      success: results.some(r => r.success),
      results,
      totalWebhooks: this.config.webhook.urls.length
    };
  }

  /**
   * Retry webhook with exponential backoff
   */
  async retryWebhook(url, alert, retriesLeft) {
    if (retriesLeft <= 0) return;

    const delay = Math.pow(2, this.config.webhook.retries - retriesLeft) * 1000;
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      const payload = this.generateWebhookPayload(alert);
      
      await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: this.config.webhook.timeout
      });

      if (this.logService) {
        this.logService.info('Webhook retry succeeded', { url, retriesLeft });
      }

    } catch (error) {
      if (this.logService) {
        this.logService.warn('Webhook retry failed', { url, retriesLeft, error: error.message });
      }
      
      if (retriesLeft > 1) {
        await this.retryWebhook(url, alert, retriesLeft - 1);
      }
    }
  }

  /**
   * Generate email subject
   */
  generateEmailSubject(alert) {
    const severity = alert.level.toUpperCase();
    const service = alert.service;
    const type = alert.type.replace('_', ' ').toUpperCase();
    
    return `[${severity}] SLA Alert: ${service} - ${type}`;
  }

  /**
   * Generate email HTML content
   */
  generateEmailHTML(alert) {
    const timestamp = new Date(alert.timestamp).toLocaleString();
    const severity = alert.level.toUpperCase();
    const severityColor = this.getSeverityColor(alert.level);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .alert-header { background-color: ${severityColor}; color: white; padding: 15px; border-radius: 5px; }
          .alert-content { padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin-top: 10px; }
          .detail-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .detail-table th, .detail-table td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          .detail-table th { background-color: #f5f5f5; }
        </style>
      </head>
      <body>
        <div class="alert-header">
          <h2>🚨 SLA Alert - ${severity}</h2>
          <p>Service: ${alert.service}</p>
        </div>
        
        <div class="alert-content">
          <p><strong>Alert Type:</strong> ${alert.type.replace('_', ' ').toUpperCase()}</p>
          <p><strong>Timestamp:</strong> ${timestamp}</p>
          <p><strong>Alert ID:</strong> ${alert.id}</p>
          
          <table class="detail-table">
            <tr><th>Metric</th><th>Value</th></tr>
            ${this.generateAlertDetailsRows(alert)}
          </table>
          
          <p style="margin-top: 20px; color: #666;">
            This is an automated SLA monitoring alert. Please investigate the issue promptly.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate email text content
   */
  generateEmailText(alert) {
    const timestamp = new Date(alert.timestamp).toLocaleString();
    const severity = alert.level.toUpperCase();
    
    return `
SLA ALERT - ${severity}

Service: ${alert.service}
Alert Type: ${alert.type.replace('_', ' ').toUpperCase()}
Timestamp: ${timestamp}
Alert ID: ${alert.id}

Details:
${this.generateAlertDetailsText(alert)}

This is an automated SLA monitoring alert. Please investigate the issue promptly.
    `.trim();
  }

  /**
   * Generate Slack payload
   */
  generateSlackPayload(alert) {
    const timestamp = new Date(alert.timestamp).toLocaleString();
    const severity = alert.level.toUpperCase();
    const color = this.getSeverityColor(alert.level);
    
    return {
      channel: this.config.slack.channel,
      username: this.config.slack.username,
      icon_emoji: this.config.slack.iconEmoji,
      attachments: [
        {
          color: color,
          title: `🚨 SLA Alert - ${severity}`,
          fields: [
            {
              title: 'Service',
              value: alert.service,
              short: true
            },
            {
              title: 'Alert Type',
              value: alert.type.replace('_', ' ').toUpperCase(),
              short: true
            },
            {
              title: 'Timestamp',
              value: timestamp,
              short: true
            },
            {
              title: 'Alert ID',
              value: alert.id,
              short: true
            }
          ],
          text: this.generateAlertDetailsText(alert),
          footer: 'SLA Monitor',
          ts: Math.floor(alert.timestamp / 1000)
        }
      ]
    };
  }

  /**
   * Generate webhook payload
   */
  generateWebhookPayload(alert) {
    return {
      event: 'sla_alert',
      alert: {
        id: alert.id,
        service: alert.service,
        type: alert.type,
        level: alert.level,
        timestamp: alert.timestamp,
        data: alert.data
      },
      metadata: {
        source: 'vitrine-digital-sla-monitor',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    };
  }

  /**
   * Generate alert detail rows for HTML table
   */
  generateAlertDetailsRows(alert) {
    const rows = [];
    
    if (alert.data) {
      Object.entries(alert.data).forEach(([key, value]) => {
        if (key !== 'service') {
          const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          let displayValue = value;
          
          if (typeof value === 'number') {
            if (key.includes('Time')) {
              displayValue = `${value}ms`;
            } else if (key.includes('Rate')) {
              displayValue = `${value.toFixed(2)}%`;
            }
          }
          
          rows.push(`<tr><td>${displayKey}</td><td>${displayValue}</td></tr>`);
        }
      });
    }
    
    return rows.join('');
  }

  /**
   * Generate alert details for text format
   */
  generateAlertDetailsText(alert) {
    const details = [];
    
    if (alert.data) {
      Object.entries(alert.data).forEach(([key, value]) => {
        if (key !== 'service') {
          const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          let displayValue = value;
          
          if (typeof value === 'number') {
            if (key.includes('Time')) {
              displayValue = `${value}ms`;
            } else if (key.includes('Rate')) {
              displayValue = `${value.toFixed(2)}%`;
            }
          }
          
          details.push(`${displayKey}: ${displayValue}`);
        }
      });
    }
    
    return details.join('\n');
  }

  /**
   * Get color for severity level
   */
  getSeverityColor(level) {
    const colors = {
      warning: '#ff9900',
      critical: '#ff4444',
      severe: '#cc0000',
      excellent: '#00cc44',
      good: '#00aa00',
      acceptable: '#ffaa00',
      slow: '#ff6600'
    };
    
    return colors[level] || '#666666';
  }

  /**
   * Send escalation notification
   */
  async sendEscalation(alert, escalationLevel) {
    if (!this.config.escalation.enabled) return;

    const escalatedAlert = {
      ...alert,
      id: `${alert.id}_escalation_${escalationLevel}`,
      type: `${alert.type}_escalation`,
      level: 'severe',
      data: {
        ...alert.data,
        originalAlertId: alert.id,
        escalationLevel
      }
    };

    return this.sendAlert(escalatedAlert);
  }

  /**
   * Send recovery notification
   */
  async sendRecovery(originalAlert, recoveryData = {}) {
    const recoveryAlert = {
      id: `${originalAlert.id}_recovery`,
      service: originalAlert.service,
      type: `${originalAlert.type}_recovery`,
      level: 'good',
      timestamp: Date.now(),
      data: {
        ...recoveryData,
        originalAlertId: originalAlert.id,
        recoveredAt: new Date().toISOString()
      }
    };

    return this.sendAlert(recoveryAlert);
  }

  /**
   * Test notification channels
   */
  async testNotifications() {
    const testAlert = {
      id: 'test_alert_' + Date.now(),
      service: 'test-service',
      type: 'test',
      level: 'warning',
      timestamp: Date.now(),
      data: {
        message: 'This is a test alert to verify notification channels',
        responseTime: 150,
        threshold: 100
      }
    };

    return this.sendAlert(testAlert);
  }
}

module.exports = NotificationService;