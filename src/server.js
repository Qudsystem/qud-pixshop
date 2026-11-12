const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cluster = require('cluster');
const os = require('os');

const logger = require('./utils/logger');
const errorHandler = require('./utils/error-handler');
const apiRoutes = require('./api/routes');
const { authenticateApiKey } = require('./api/middleware/auth');
const requestQueue = require('./utils/queue');
const monitor = require('./utils/monitor');
const alertManager = require('./utils/alert');
const LoadBalancer = require('./utils/load-balancer');
const { apiLimiter, imageProcessingLimiter } = require('./api/middleware/rate-limiter');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize load balancer if in cluster mode
if (process.env.CLUSTER_MODE === 'true' && cluster.isMaster) {
  const loadBalancer = new LoadBalancer();
  loadBalancer.start();
  // Don't start the server in master process
  process.exit(0);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));

app.use(compression());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    monitor.recordRequest(duration);
    
    logger.info(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`, {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
    
    // Alert on errors
    if (res.statusCode >= 500) {
      alertManager.sendAlert(
        `Server error: ${req.method} ${req.url} returned ${res.statusCode}`,
        'error',
        { subject: 'Server Error Alert' }
      );
    }
  });
  
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api/', (req, res, next) => apiLimiter.middleware(req, res, next));
app.use('/api/v1/process', (req, res, next) => imageProcessingLimiter.middleware(req, res, next));

// Health check endpoint
app.get('/health', (req, res) => {
  const metrics = monitor.getMetrics();
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    metrics,
  });
});

// Metrics endpoint
app.get('/metrics', authenticateApiKey, (req, res) => {
  const metrics = monitor.getMetrics();
  res.status(200).json(metrics);
});

// API routes
app.use('/api/v1', authenticateApiKey, apiRoutes);

// Add a route to enqueue requests
app.post('/enqueue', async (req, res) => {
  try {
    const { data } = req.body;
    const job = await requestQueue.add({ data });
    monitor.updateQueueLength(await requestQueue.count());
    
    res.status(200).json({ 
      message: 'Request added to queue', 
      jobId: job.id,
      queuePosition: await requestQueue.count(),
    });
  } catch (error) {
    console.error('Error adding request to queue:', error);
    monitor.recordError();
    res.status(500).json({ error: 'Failed to enqueue request' });
  }
});

// Queue status endpoint
app.get('/queue/status', async (req, res) => {
  try {
    const waiting = await requestQueue.count();
    const active = await requestQueue.getActive();
    const completed = await requestQueue.getCompleted();
    const failed = await requestQueue.getFailed();
    
    monitor.updateQueueLength(waiting);
    
    res.status(200).json({
      waiting,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AI Studio Automation API',
    version: '1.0.0',
    environment: NODE_ENV,
    endpoints: {
      health: '/health',
      metrics: '/metrics (requires API key)',
      process: 'POST /api/v1/process (requires API key)',
      status: 'GET /api/v1/status/:jobId (requires API key)',
      stats: 'GET /api/v1/stats (requires API key)',
      enqueue: 'POST /enqueue',
      queueStatus: 'GET /queue/status',
    },
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${NODE_ENV} mode`);
  
  // Send startup alert
  alertManager.sendAlert(
    `AI Studio Automation API started on port ${PORT}`,
    'info',
    { subject: 'Server Startup' }
  );
});

module.exports = app;