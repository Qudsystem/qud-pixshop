const EventEmitter = require('events');

class PerformanceMonitor extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      requests: 0,
      errors: 0,
      averageResponseTime: 0,
      activeSessions: 0,
      queueLength: 0,
      uptime: Date.now(),
    };
    this.responseTimes = [];
  }

  recordRequest(responseTime) {
    this.metrics.requests++;
    this.responseTimes.push(responseTime);
    
    // Keep only last 100 response times
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
    
    // Calculate average response time
    this.metrics.averageResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    
    this.emit('metric', { type: 'request', responseTime });
  }

  recordError() {
    this.metrics.errors++;
    this.emit('metric', { type: 'error' });
  }

  updateActiveSessions(count) {
    this.metrics.activeSessions = count;
    this.emit('metric', { type: 'sessions', count });
  }

  updateQueueLength(length) {
    this.metrics.queueLength = length;
    this.emit('metric', { type: 'queue', length });
  }

  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.uptime,
      errorRate: this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests) * 100 : 0,
    };
  }

  reset() {
    this.metrics = {
      requests: 0,
      errors: 0,
      averageResponseTime: 0,
      activeSessions: 0,
      queueLength: 0,
      uptime: Date.now(),
    };
    this.responseTimes = [];
  }
}

module.exports = new PerformanceMonitor();