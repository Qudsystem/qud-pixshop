const https = require('https');
const nodemailer = require('nodemailer');

class AlertManager {
  constructor() {
    this.slackWebhook = process.env.SLACK_WEBHOOK_URL;
    this.alertEmail = process.env.ALERT_EMAIL;
    
    // Email transporter
    this.emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.ALERT_EMAIL_USER,
        pass: process.env.ALERT_EMAIL_PASS,
      },
    });
  }

  async sendSlackAlert(message, level = 'info') {
    if (!this.slackWebhook) {
      // No external webhook configured – silently ignore in tests / local dev
      return;
    }

    const payload = {
      text: message,
      username: 'AI Studio Monitor',
      icon_emoji: level === 'error' ? ':red_circle:' : ':warning:',
      channel: '#alerts',
    };

    try {
      await this.sendHttpRequest(this.slackWebhook, 'POST', payload);
      // keep logging internal via logger rather than console
      const logger = require('./logger');
      logger.info('Slack alert sent successfully');
    } catch (error) {
      const logger = require('./logger');
      logger.error('Failed to send Slack alert:', error);
    }
  }

  async sendEmailAlert(subject, message, level = 'info') {
    if (!this.alertEmail) {
      // No email configured – silently ignore in tests / local dev
      return;
    }

    const mailOptions = {
      from: process.env.ALERT_EMAIL_USER,
      to: this.alertEmail,
      subject: `[AI Studio] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: ${level === 'error' ? '#d32f2f' : '#f57c00'};">
            ${level === 'error' ? '🚨 Error Alert' : '⚠️ Warning Alert'}
          </h2>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>Message:</strong> ${message}</p>
          <hr>
          <p style="font-size: 12px; color: #666;">
            This is an automated alert from AI Studio Automation System
          </p>
        </div>
      `,
    };

    try {
      await this.emailTransporter.sendMail(mailOptions);
      const logger = require('./logger');
      logger.info('Email alert sent successfully');
    } catch (error) {
      const logger = require('./logger');
      logger.error('Failed to send email alert:', error);
    }
  }

  async sendAlert(message, level = 'info', options = {}) {
    // Send to both Slack and Email
    await Promise.all([
      this.sendSlackAlert(message, level),
      this.sendEmailAlert(options.subject || 'System Alert', message, level),
    ]);
  }

  sendHttpRequest(url, method, data) {
    return new Promise((resolve, reject) => {
      const dataString = JSON.stringify(data);
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': dataString.length,
        },
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(responseData);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(dataString);
      req.end();
    });
  }
}

module.exports = new AlertManager();