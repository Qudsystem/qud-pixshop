const sessionManager = require('../../src/core/session-manager');

describe('Session Manager Unit Tests', () => {
  afterAll(async () => {
    await sessionManager.cleanup();
  });

  describe('Session Creation', () => {
    it('should create a new session', async () => {
      const session = await sessionManager.createSession();

      expect(session).toBeDefined();
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('browser');
      expect(session).toHaveProperty('context');
      expect(session).toHaveProperty('page');
      expect(session).toHaveProperty('createdAt');
      expect(session).toHaveProperty('lastUsed');
      expect(session.isAuthenticated).toBe(false);
    });

    it('should generate unique session IDs', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('Session Retrieval', () => {
    it('should retrieve existing session', async () => {
      const createdSession = await sessionManager.createSession();
      const retrievedSession = await sessionManager.getSession(createdSession.id);

      expect(retrievedSession.id).toBe(createdSession.id);
    });

    it('should create new session if ID not found', async () => {
      const session = await sessionManager.getSession('non-existent-id');

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
    });

    it('should create new session if existing is invalid', async () => {
      const session = await sessionManager.createSession();
      
      // محاكاة جلسة غير صالحة
      session.page = null;

      const newSession = await sessionManager.getSession(session.id);

      expect(newSession.id).not.toBe(session.id);
    });
  });

  describe('Session Validation', () => {
    it('should validate active session', async () => {
      const session = await sessionManager.createSession();
      const isValid = await sessionManager.isSessionValid(session);

      expect(isValid).toBe(true);
    });

    it('should invalidate closed session', async () => {
      const session = await sessionManager.createSession();
      
      // إغلاق الصفحة
      await session.page.close();
      
      const isValid = await sessionManager.isSessionValid(session);

      expect(isValid).toBe(false);
    });

    it('should invalidate expired session', async () => {
      const session = await sessionManager.createSession();
      
      // محاكاة جلسة منتهية الصلاحية
      session.lastUsed = new Date(Date.now() - 60000); // منذ دقيقة
      
      const isValid = await sessionManager.isSessionValid(session);

      expect(isValid).toBe(false);
    });
  });

  describe('Session Cleanup', () => {
    it('should close session properly', async () => {
      const session = await sessionManager.createSession();
      const sessionId = session.id;

      await sessionManager.closeSession(sessionId);

      expect(sessionManager.sessions.has(sessionId)).toBe(false);
    });

    it('should handle cleanup of multiple sessions', async () => {
      const sessions = [];
      
      // إنشاء عدة جلسات
      for (let i = 0; i < 3; i++) {
        sessions.push(await sessionManager.createSession());
      }

      await sessionManager.cleanup();

      expect(sessionManager.sessions.size).toBe(0);
    });
  });

  describe('Session Authentication', () => {
    it('should handle authentication attempt', async () => {
      const session = await sessionManager.createSession();
      
      // هذه مجرد محاكاة لأن المصادقة الفعلية تتطلب بيانات Google
      const result = await sessionManager.authenticateSession(
        session,
        'test@example.com',
        'password'
      );

      // النتيجة ستكون false لأننا لا نستخدم بيانات حقيقية
      expect(typeof result).toBe('boolean');
    });
  });
});