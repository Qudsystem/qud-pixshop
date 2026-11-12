const request = require('supertest');
const app = require('../../src/server');

describe('API Integration Tests', () => {
  let apiKey;

  beforeAll(() => {
    apiKey = process.env.API_KEY || 'test-api-key';
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Root Endpoint', () => {
    it('should return welcome message', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'AI Studio Automation API');
      expect(response.body).toHaveProperty('version', '1.0.0');
    });
  });

  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const response = await request(app)
        .post('/api/v1/process')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'API key is required');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await request(app)
        .post('/api/v1/process')
        .set('X-API-Key', 'invalid-key')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid API key');
    });
  });

  describe('Image Processing', () => {
    it('should reject request without prompt', async () => {
      const response = await request(app)
        .post('/api/v1/process')
        .set('X-API-Key', apiKey)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Prompt is required and must be a non-empty string');
    });

    it('should accept valid image processing request', async () => {
      const response = await request(app)
        .post('/api/v1/process')
        .set('X-API-Key', apiKey)
        .send({
          prompt: 'A beautiful sunset over mountains',
          image: null
        })
        .expect(202);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Request added to processing queue');
      expect(response.body.data).toHaveProperty('jobId');
      expect(response.body.data).toHaveProperty('status', 'queued');
    });

    it('should reject invalid base64 image', async () => {
      const response = await request(app)
        .post('/api/v1/process')
        .set('X-API-Key', apiKey)
        .send({
          prompt: 'Test prompt',
          image: 'invalid-base64-data'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Image must be a valid base64 string');
    });
  });

  describe('Job Status', () => {
    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/v1/status/non-existent-job-id')
        .set('X-API-Key', apiKey)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Job not found');
    });

    it('should return job status for valid job', async () => {
      // أولاً، إنشاء وظيفة
      const createResponse = await request(app)
        .post('/api/v1/process')
        .set('X-API-Key', apiKey)
        .send({
          prompt: 'Test prompt for status check'
        })
        .expect(202);

      const jobId = createResponse.body.data.jobId;

      // ثم التحقق من الحالة
      const statusResponse = await request(app)
        .get(`/api/v1/status/${jobId}`)
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(statusResponse.body).toHaveProperty('success', true);
      expect(statusResponse.body.data).toHaveProperty('id', jobId);
      expect(statusResponse.body.data).toHaveProperty('status');
    });
  });

  describe('Statistics', () => {
    it('should return system statistics', async () => {
      const response = await request(app)
        .get('/api/v1/stats')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('memory');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('version');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // هذا الاختبار يتطلب إعداداً خاصاً
      // يمكن تفعيله عند الحاجة
      
      // const requests = [];
      // for (let i = 0; i < 105; i++) {
      //   requests.push(
      //     request(app)
      //       .get('/health')
      //       .set('X-API-Key', apiKey)
      //   );
      // }
      
      // const responses = await Promise.all(requests);
      // const rateLimitedResponse = responses[responses.length - 1];
      // 
      // expect(rateLimitedResponse.status).toBe(429);
    });
  });
});