const redis = require('redis');
const { promisify } = require('util');

class AdvancedRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    this.max = options.max || 100;
    this.keyGenerator = options.keyGenerator || ((req) => req.ip);
    this.skipSuccessfulRequests = options.skipSuccessfulRequests || false;
    this.skipFailedRequests = options.skipFailedRequests || false;
    
    this.redisClient = redis.createClient({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
    });
    
    this.redisClient.on('error', (err) => {
      console.error('Redis error:', err);
      this.useRedis = false;
    });
    
    this.useRedis = true;
    this.localStore = new Map();
    
    // Rate limiter per API key
    this.apiKeyLimits = new Map();
    this.defaultApiKeyMax = 1000; // Default limit per API key
  }

  // Set rate limit for specific API key
  setApiKeyLimit(apiKey, maxRequests) {
    this.apiKeyLimits.set(apiKey, maxRequests);
  }

  // Get rate limit for API key
  getApiKeyLimit(apiKey) {
    return this.apiKeyLimits.get(apiKey) || this.defaultApiKeyMax;
  }

  async middleware(req, res, next) {
    try {
      const key = this.keyGenerator(req);
      const apiKey = req.headers['x-api-key'];
      
      // Use API key specific limit if available
      const maxRequests = apiKey ? this.getApiKeyLimit(apiKey) : this.max;
      
      const now = Date.now();
      const windowStart = now - this.windowMs;
      
      let current;
      let resetTime;
      
      if (this.useRedis) {
        try {
          const redisKey = `rate_limit:${key}`;
          const multi = this.redisClient.multi ? this.redisClient.multi() : null;

          // If the redis client does not provide the expected multi/zremrangebyscore API (some stubs/mocks),
          // fallback to in-memory logic to avoid throwing errors during tests or in unsupported clients.
          if (!multi || typeof multi.zremrangebyscore !== 'function') {
            if (!this.localStore.has(key)) {
              this.localStore.set(key, []);
            }

            const timestamps = this.localStore.get(key);
            const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
            current = validTimestamps.length || 0;
            resetTime = validTimestamps.length ? (Math.min(...validTimestamps) + this.windowMs) : now + this.windowMs;

            validTimestamps.push(now);
            this.localStore.set(key, validTimestamps);
          } else {
            // Remove old entries
            multi.zremrangebyscore(redisKey, 0, windowStart);
            // Count current entries
            multi.zcard(redisKey);
            // Add current request
            multi.zadd(redisKey, now, now.toString());
            // Set expiry
            multi.expire(redisKey, Math.ceil(this.windowMs / 1000));

            // node-redis v3 style execAsync may not exist; try exec() as fallback with Promise
            const execAsync = multi.execAsync || ((() => new Promise((resolve, reject) => {
              multi.exec((err, results) => err ? reject(err) : resolve(results));
            }))());

            const results = await execAsync;
            current = results[1] || 0;
            resetTime = now + this.windowMs;
          }
        } catch (err) {
          // If anything goes wrong with Redis interaction, fall back to local in-memory store
          console.warn('Rate limiter Redis interaction failed, falling back to in-memory store', err);

          if (!this.localStore.has(key)) {
            this.localStore.set(key, []);
          }

          const timestamps = this.localStore.get(key);
          const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
          current = validTimestamps.length || 0;
          resetTime = validTimestamps.length ? (Math.min(...validTimestamps) + this.windowMs) : now + this.windowMs;

          validTimestamps.push(now);
          this.localStore.set(key, validTimestamps);
        }
      } else {
        if (!this.localStore.has(key)) {
          this.localStore.set(key, []);
        }

        const timestamps = this.localStore.get(key);
        const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
        current = validTimestamps.length;
        resetTime = Math.min(...validTimestamps) + this.windowMs;

        validTimestamps.push(now);
        this.localStore.set(key, validTimestamps);
      }
      
      if (current >= maxRequests) {
        const retryAfter = Math.ceil((resetTime - now) / 1000);
        
        res.set({
          'Retry-After': retryAfter,
          'X-RateLimit-Limit': maxRequests,
          'X-RateLimit-Remaining': 0,
          'X-RateLimit-Reset': new Date(resetTime).toISOString()
        });
        
        return res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          retryAfter,
          limit: maxRequests,
          windowMs: this.windowMs
        });
      }
      
      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': maxRequests - current - 1,
        'X-RateLimit-Reset': new Date(resetTime).toISOString()
      });
      
      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fallback: allow request if rate limiter fails
      next();
    }
  }
}

// Pre-configured rate limiters
const apiLimiter = new AdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  keyGenerator: (req) => req.ip || req.connection.remoteAddress
});

const imageProcessingLimiter = new AdvancedRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 50, // limit each IP to 50 image processing requests per hour
  keyGenerator: (req) => `image:${req.ip || req.connection.remoteAddress}`
});

const authLimiter = new AdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 5, // limit each IP to 5 auth requests per windowMs
  keyGenerator: (req) => `auth:${req.ip || req.connection.remoteAddress}`
});

module.exports = {
  AdvancedRateLimiter,
  apiLimiter,
  imageProcessingLimiter,
  authLimiter
};