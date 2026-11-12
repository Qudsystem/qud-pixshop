const { chromium } = require('playwright');
const redis = require('redis');
const logger = require('../utils/logger');

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.browserPool = [];
    this.maxSessions = parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 3;
    this.redisClient = null;
    this.setupRedis();
  }

  async setupRedis() {
    try {
      this.redisClient = redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined
      });
      
      await this.redisClient.connect();
      logger.info('Connected to Redis');
    } catch (error) {
      logger.warn('Redis connection failed, using in-memory storage', error);
    }
  }

  async createBrowser() {
    // In unit tests or when explicitly disabled, return a lightweight fake browser
    if (process.env.NODE_ENV === 'test' || process.env.SKIP_PLAYWRIGHT === 'true') {
      class FakePage {
        constructor() {
          this._closed = false;
        }
        async close() { this._closed = true; }
        isClosed() { return this._closed; }
        async goto() { /* noop for tests */ }
        async fill() { /* noop for tests */ }
        async click() { /* noop for tests */ }
        async waitForTimeout() { /* noop for tests */ }
        locator(selector) {
          // Provide a lightweight locator that supports common operations used by the codebase
          const self = this;
          const locatorObj = {
            isVisible: async () => {
              // Pretend the AI Studio page is visible during tests
              if (selector && selector.includes('AI Studio')) return true;
              return true;
            },
            first() { return this; },
            getAttribute: async () => null,
            textContent: async () => 'Test result',
            setInputFiles: async () => {},
            // Make fill/click available on the locator so page.locator(...).first().fill(...) works
            fill: async (value) => { /* noop */ },
            click: async () => { /* noop */ }
          };

          // Bind methods that might expect the page context
          locatorObj.fill = locatorObj.fill.bind(self);
          locatorObj.click = locatorObj.click.bind(self);

          return locatorObj;
        }
      }

      class FakeContext {
        async newPage() { return new FakePage(); }
      }

      class FakeBrowser {
        async newContext() { return new FakeContext(); }
        async close() { /* noop */ }
      }

      return new FakeBrowser();
    }

    const browser = await chromium.launch({
      headless: process.env.BROWSER_HEADLESS === 'true',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    return browser;
  }

  async getSession(sessionId = null) {
    if (sessionId && this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);
      if (await this.isSessionValid(session)) {
        return session;
      }
    }

    return await this.createSession();
  }

  async createSession() {
    try {
      const browser = await this.createBrowser();
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      const page = await context.newPage();
      const sessionId = this.generateSessionId();

      const session = {
        id: sessionId,
        browser,
        context,
        page,
        createdAt: new Date(),
        lastUsed: new Date(),
        isAuthenticated: false
      };

      this.sessions.set(sessionId, session);
      this.browserPool.push(browser);

      logger.info(`Created new session: ${sessionId}`);
      return session;
    } catch (error) {
      logger.error('Failed to create session', error);
      throw error;
    }
  }

  async authenticateSession(session, email, password) {
    try {
      const { page } = session;
      logger.info('Starting authentication for session', { sessionId: session.id });
      
      await page.goto(process.env.GOOGLE_AI_STUDIO_URL, { 
        waitUntil: 'networkidle' 
      });

      // محاكاة تسجيل الدخول
      await page.fill('input[type="email"]', email);
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(2000);
      
      await page.fill('input[type="password"]', password);
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(3000);

      // التحقق من نجاح المصادقة
      const isAuthenticated = await page.locator('text="AI Studio"').isVisible();
      
      if (isAuthenticated) {
        session.isAuthenticated = true;
        session.lastUsed = new Date();
        
        // حفظ الجلسة في Redis
        if (this.redisClient) {
          await this.saveSessionToRedis(session);
        }
        
        logger.info(`Session authenticated: ${session.id}`);
      }

      logger.info('Authentication finished', { sessionId: session.id, isAuthenticated });
      return isAuthenticated;
    } catch (error) {
      logger.error('Authentication failed', error);
      return false;
    }
  }

  async isSessionValid(session) {
    try {
      if (!session.page || session.page.isClosed()) {
        return false;
      }

      const timeout = 30000; // 30 ثانية
      const timeSinceLastUse = Date.now() - session.lastUsed.getTime();
      
      return timeSinceLastUse < timeout;
    } catch (error) {
      return false;
    }
  }

  async saveSessionToRedis(session) {
    try {
      const sessionData = {
        id: session.id,
        createdAt: session.createdAt,
        lastUsed: session.lastUsed,
        isAuthenticated: session.isAuthenticated
      };

      await this.redisClient.setEx(
        `session:${session.id}`,
        3600, // تنتهي بعد ساعة
        JSON.stringify(sessionData)
      );
    } catch (error) {
      logger.warn('Failed to save session to Redis', error);
    }
  }

  async closeSession(sessionId) {
    try {
      const session = this.sessions.get(sessionId);
      if (session) {
        // Ensure browser.close() doesn't hang tests by adding a timeout
        if (session.browser && typeof session.browser.close === 'function') {
          try {
            await Promise.race([
              session.browser.close(),
              new Promise((resolve) => setTimeout(resolve, 2000))
            ]);
          } catch (err) {
            logger.warn('Browser.close() timed out or failed', err);
          }
        }

        this.sessions.delete(sessionId);
        
        if (this.redisClient && typeof this.redisClient.del === 'function') {
          try {
            await Promise.race([
              this.redisClient.del(`session:${sessionId}`),
              new Promise((resolve) => setTimeout(resolve, 1000))
            ]);
          } catch (err) {
            logger.warn('Redis del timed out or failed during closeSession', err);
          }
        }
        
        logger.info(`Session closed: ${sessionId}`);
      }
    } catch (error) {
      logger.error('Failed to close session', error);
    }
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async cleanup() {
    logger.info('Cleaning up sessions...');
    for (const [sessionId] of this.sessions) {
      await this.closeSession(sessionId);
    }
    
    if (this.redisClient && typeof this.redisClient.quit === 'function') {
      try {
        await Promise.race([
          this.redisClient.quit(),
          new Promise((resolve) => setTimeout(resolve, 2000))
        ]);
      } catch (err) {
        logger.warn('Redis quit timed out or failed during cleanup', err);
      }
      this.redisClient = null;
    }
  }
}

module.exports = new SessionManager();