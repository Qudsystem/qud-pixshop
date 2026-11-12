const Queue = require('bull');
const { REDIS_HOST, REDIS_PORT } = process.env;
const logger = require('./logger');
logger.info(`Queue module loaded in NODE_ENV=${process.env.NODE_ENV}`);

// In test mode, use a very small in-memory queue to avoid connecting to Redis
if (process.env.NODE_ENV === 'test') {
  const requestQueue = {
    jobs: [],
    process() { /* no-op in test */ },
    async add(data) {
      const job = { id: `local-${Date.now()}-${Math.floor(Math.random() * 10000)}`, data, status: 'completed' };
      this.jobs.push(job);
      return job;
    },
    async count() { return this.jobs.length; },
    async getActive() { return []; },
    async getCompleted() { return this.jobs.filter(j => j.status === 'completed'); },
    async getFailed() { return this.jobs.filter(j => j.status === 'failed'); }
  };

  module.exports = requestQueue;
} else {
  // Create a real queue connected to Redis for non-test environments
  const requestQueue = new Queue('requestQueue', {
    redis: {
      host: REDIS_HOST || '127.0.0.1',
      port: REDIS_PORT || 6379,
      // Reduce retry attempts and connection timeout to fail fast when Redis is unreachable
      maxRetriesPerRequest: 1,
      connectTimeout: 1000
    },
  });

  // Process jobs in the queue
  requestQueue.process(async (job) => {
    try {
      console.log(`Processing job: ${job.id}`);
      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log(`Job completed: ${job.id}`);
      return Promise.resolve();
    } catch (error) {
      console.error(`Job failed: ${job.id}`, error);
      return Promise.reject(error);
    }
  });

  module.exports = requestQueue;
}