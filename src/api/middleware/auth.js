const jwt = require('jsonwebtoken');
const logger = require('../../utils/logger');

/**
 * Middleware للتحقق من API Key
 */
const authenticateApiKey = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key is required',
        message: 'Please provide API key in X-API-Key header'
      });
    }

    // إزالة بادئة "Bearer " إذا كانت موجودة
    const cleanApiKey = apiKey.replace('Bearer ', '');

    // التحقق من صحة API Key
    if (cleanApiKey !== process.env.API_KEY) {
      logger.warn(`Invalid API key attempt: ${cleanApiKey}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      });
    }

    // تسجيل الاستخدام
    logger.info(`API request authenticated`, {
      endpoint: req.originalUrl,
      method: req.method,
      ip: req.ip
    });

    next();
  } catch (error) {
    logger.error('Authentication error', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: error.message
    });
  }
};

/**
 * Middleware للتحقق من JWT Token (اختياري)
 */
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token is required'
      });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }

      req.user = user;
      next();
    });
  } catch (error) {
    logger.error('Token verification error', error);
    res.status(500).json({
      success: false,
      error: 'Token verification failed'
    });
  }
};

/**
 * Middleware لحماية ضد الطلبات المتكررة
 */
const rateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // تنظيف الطلبات القديمة
    if (requests.has(key)) {
      requests.set(key, requests.get(key).filter(time => time > windowStart));
    } else {
      requests.set(key, []);
    }

    const userRequests = requests.get(key);

    // التحقق من تجاوز الحد
    if (userRequests.length >= max) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: `Rate limit exceeded. Maximum ${max} requests per ${windowMs / 1000} seconds`
      });
    }

    // إضافة الطلب الحالي
    userRequests.push(now);
    next();
  };
};

module.exports = {
  authenticateApiKey,
  authenticateToken,
  rateLimiter
};