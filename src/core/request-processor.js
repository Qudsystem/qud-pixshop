const Queue = require('bull');
const os = require('os');
const logger = require('../utils/logger');
logger.info(`RequestProcessor loaded in NODE_ENV=${process.env.NODE_ENV}`);
const sessionManager = require('./session-manager');

class RequestProcessor {
  constructor() {
    // Initialize bull queue only in non-test environments
    if (process.env.NODE_ENV === 'test') {
      this.processingQueue = null;
    } else {
      this.processingQueue = new Queue('image-processing', {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD || undefined,
          // Fail fast when Redis is not available in local/test environments
          maxRetriesPerRequest: 1,
          connectTimeout: 1000
        }
      });

      this.setupQueueProcessors();
    }

    // Fallback local job store when Redis is unavailable (helps tests / local dev)
    this.localJobs = new Map();
  }

  setupQueueProcessors() {
    this.processingQueue.process('image-generation', 5, async (job) => {
      return await this.processImageGeneration(job.data);
    });

    this.processingQueue.on('completed', (job) => {
      logger.info(`Job ${job.id} completed`);
    });

    this.processingQueue.on('failed', (job, err) => {
      logger.error(`Job ${job.id} failed:`, err);
    });
  }

  async addImageGenerationRequest(requestData) {
    logger.info('addImageGenerationRequest called', { requestData });

    // If queue is not initialized (e.g., in test mode), use local fallback synchronously
    if (!this.processingQueue) {
      const fallbackJobId = `local-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const fallbackJob = {
        id: fallbackJobId,
        data: requestData,
        status: 'queued',
        returnvalue: null,
        failedReason: null,
        progress: () => 0
      };

      this.localJobs.set(fallbackJobId, fallbackJob);

      if (process.env.NODE_ENV === 'test') {
        try {
          const result = await this.processImageGeneration(requestData);
          fallbackJob.returnvalue = result;
          fallbackJob.status = 'completed';
          logger.info(`Local fallback job ${fallbackJob.id} completed (sync test mode)`);
        } catch (err) {
          fallbackJob.failedReason = err.message;
          fallbackJob.status = 'failed';
          logger.error(`Local fallback job ${fallbackJob.id} failed (sync test mode)`, err);
        }
      } else {
        setTimeout(async () => {
          try {
            const result = await this.processImageGeneration(requestData);
            fallbackJob.returnvalue = result;
            fallbackJob.status = 'completed';
            logger.info(`Local fallback job ${fallbackJob.id} completed`);
          } catch (err) {
            fallbackJob.failedReason = err.message;
            fallbackJob.status = 'failed';
            logger.error(`Local fallback job ${fallbackJob.id} failed`, err);
          }
        }, 500);
      }

      logger.info('Returning local fallback job (no queue)', { id: fallbackJobId });
      return fallbackJob;
    }

    try {
      // Try to add to the bull queue but don't wait excessively if Redis is down
      const addPromise = this.processingQueue.add('image-generation', requestData, {
        delay: 0,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      });

      const job = await this._promiseWithTimeout(addPromise, 1000).catch(() => null);

      if (job) {
        logger.info(`Added image generation job: ${job.id}`);
        return job;
      }

      // If adding to bull failed or timed out, create a local fallback job
      const fallbackJobId = `local-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const fallbackJob = {
        id: fallbackJobId,
        data: requestData,
        status: 'queued',
        returnvalue: null,
        failedReason: null,
        progress: () => 0
      };

      this.localJobs.set(fallbackJobId, fallbackJob);

      if (process.env.NODE_ENV === 'test') {
        // In tests run the processing synchronously to avoid background timers
        try {
          const result = await this.processImageGeneration(requestData);
          fallbackJob.returnvalue = result;
          fallbackJob.status = 'completed';
          logger.info(`Local fallback job ${fallbackJob.id} completed (sync test mode)`);
        } catch (err) {
          fallbackJob.failedReason = err.message;
          fallbackJob.status = 'failed';
          logger.error(`Local fallback job ${fallbackJob.id} failed (sync test mode)`, err);
        }
      } else {
        setTimeout(async () => {
          try {
            const result = await this.processImageGeneration(requestData);
            fallbackJob.returnvalue = result;
            fallbackJob.status = 'completed';
            logger.info(`Local fallback job ${fallbackJob.id} completed`);
          } catch (err) {
            fallbackJob.failedReason = err.message;
            fallbackJob.status = 'failed';
            logger.error(`Local fallback job ${fallbackJob.id} failed`, err);
          }
        }, 500);
      }

      logger.info('Returning local fallback job', { id: fallbackJobId });
      return fallbackJob;
    } catch (error) {
      logger.error('Failed to add job to queue, using local fallback', error);

      // Local fallback job (keeps behavior deterministic for tests / local dev)
      const jobId = `local-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const job = {
        id: jobId,
        data: requestData,
        status: 'queued',
        returnvalue: null,
        failedReason: null,
        progress: () => 0
      };

      this.localJobs.set(jobId, job);

      // Simulate async processing shortly after enqueueing
      if (process.env.NODE_ENV === 'test') {
        // Sync processing in test mode
        try {
          const result = await this.processImageGeneration(requestData);
          job.returnvalue = result;
          job.status = 'completed';
          logger.info(`Local fallback job ${job.id} completed (sync test mode)`);
        } catch (err) {
          job.failedReason = err.message;
          job.status = 'failed';
          logger.error(`Local fallback job ${job.id} failed (sync test mode)`, err);
        }
      } else {
        setTimeout(async () => {
          try {
            const result = await this.processImageGeneration(requestData);
            job.returnvalue = result;
            job.status = 'completed';
            logger.info(`Local fallback job ${job.id} completed`);
          } catch (err) {
            job.failedReason = err.message;
            job.status = 'failed';
            logger.error(`Local fallback job ${job.id} failed`, err);
          }
        }, 500);
      }

      logger.info('Returning local fallback job from catch', { id: jobId });
      return job;
    }
  }

  async processImageGeneration(data) {
    const { prompt, imageData, sessionId } = data;
    let session = null;

    try {
      // الحصول على جلسة
      session = await sessionManager.getSession(sessionId);
      logger.info('Obtained session for image generation', { sessionId: session ? session.id : null });

      if (!session.isAuthenticated) {
        logger.info('Session not authenticated, attempting authentication');
        const authenticated = await sessionManager.authenticateSession(
          session,
          process.env.GOOGLE_ACCOUNT_EMAIL,
          process.env.GOOGLE_ACCOUNT_PASSWORD
        );
        
        if (!authenticated) {
          throw new Error('Failed to authenticate session');
        }
        logger.info('Session authenticated successfully');
      }

      const { page } = session;
      
      // التنقل إلى AI Studio
      logger.info('Navigating to AI Studio');
      await page.goto(process.env.GOOGLE_AI_STUDIO_URL, { 
        waitUntil: 'networkidle' 
      });

      // رفع الصورة إذا تم توفيرها
      if (imageData) {
        logger.info('Uploading image to AI Studio');
        await this.uploadImage(page, imageData);
        logger.info('Image upload completed');
      }

      // إدخال النص التوضيحي
      logger.info('Entering prompt');
      await this.enterPrompt(page, prompt);
      logger.info('Prompt entered');

      // توليد الصورة
      logger.info('Starting image generation');
      const result = await this.generateImage(page);
      logger.info('Image generation finished');
      
      // تحديث آخر استخدام للجلسة
      session.lastUsed = new Date();
      
      logger.info(`Image generation completed for job`);
      return {
        success: true,
        result,
        sessionId: session.id
      };

    } catch (error) {
      logger.error('Image generation failed', error);
      throw error;
    }
  }

  async uploadImage(page, imageData) {
    try {
      // تحويل base64 إلى ملف مؤقت
      const buffer = Buffer.from(imageData, 'base64');
      
      // العثور على عنصر رفع الملفات
      const fileInput = await page.locator('input[type="file"]').first();
      
      // إنشاء ملف مؤقت
      const tempFile = require('path').join(__dirname, '../../temp', `upload_${Date.now()}.png`);
      require('fs').writeFileSync(tempFile, buffer);
      
      // رفع الملف
      await fileInput.setInputFiles(tempFile);
      
      // الانتظار حتى اكتمال الرفع
      await page.waitForTimeout(2000);
      
      // تنظيف الملف المؤقت
      require('fs').unlinkSync(tempFile);
      
      logger.info('Image uploaded successfully');
    } catch (error) {
      logger.error('Failed to upload image', error);
      throw error;
    }
  }

  async enterPrompt(page, prompt) {
    try {
      // العثور على حقل الإدخال
      const inputField = await page.locator('textarea[placeholder*="prompt"], input[placeholder*="prompt"]').first();
      
      if (inputField) {
        await inputField.fill(prompt);
        logger.info('Prompt entered successfully');
      } else {
        throw new Error('Could not find prompt input field');
      }
    } catch (error) {
      logger.error('Failed to enter prompt', error);
      throw error;
    }
  }

  async generateImage(page) {
    try {
      // النقر على زر التوليد
      const generateButton = await page.locator('button:has-text("Generate"), button:has-text("Create")').first();
      
      if (generateButton) {
        await generateButton.click();
        
        // الانتظار حتى اكتمال التوليد
        await page.waitForTimeout(10000); // انتظار 10 ثواني
        
        // استخراج النتيجة
        const result = await this.extractResult(page);
        
        return result;
      } else {
        throw new Error('Could not find generate button');
      }
    } catch (error) {
      logger.error('Failed to generate image', error);
      throw error;
    }
  }

  async extractResult(page) {
    try {
      // محاولة العثور على صورة النتيجة
      const imageElement = await page.locator('img[src*="generated"], img[alt*="generated"]').first();
      
      if (imageElement) {
        const imageUrl = await imageElement.getAttribute('src');
        return {
          type: 'image',
          url: imageUrl
        };
      }
      
      // إذا لم نجد صورة، نبحث عن نص النتيجة
      const textResult = await page.locator('div[class*="result"], div[class*="output"]').first().textContent();
      
      return {
        type: 'text',
        content: textResult || 'No result found'
      };
    } catch (error) {
      logger.error('Failed to extract result', error);
      return {
        type: 'error',
        message: 'Could not extract result'
      };
    }
  }

  // Helper to add a timeout to promises that may hang (e.g., when Redis is unavailable)
  _promiseWithTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
    ]);
  }

  async getJobStatus(jobId) {
    try {
      // If no processing queue (e.g., test mode), return from local store directly
      if (!this.processingQueue) {
        const local = this.localJobs.get(jobId);
        if (!local) {
          return {
            found: false,
            message: 'Job not found'
          };
        }

        return {
          found: true,
          id: local.id,
          status: local.status,
          data: local.data,
          result: local.returnvalue,
          failedReason: local.failedReason,
          progress: local.progress()
        };
      }

      // Try to get the job from bull, but don't hang for too long
      let job = null;
      try {
        job = await this._promiseWithTimeout(this.processingQueue.getJob(jobId), 2000).catch(() => null);
      } catch (e) {
        job = null;
      }

      if (!job) {
        // Check local fallback store
        const local = this.localJobs.get(jobId);
        if (!local) {
          return {
            found: false,
            message: 'Job not found'
          };
        }

        return {
          found: true,
          id: local.id,
          status: local.status,
          data: local.data,
          result: local.returnvalue,
          failedReason: local.failedReason,
          progress: local.progress()
        };
      }

      return {
        found: true,
        id: job.id,
        status: job.status,
        data: job.data,
        result: job.returnvalue,
        failedReason: job.failedReason,
        progress: job.progress()
      };
    } catch (error) {
      logger.error('Failed to get job status', error);
      throw error;
    }
  }
}

module.exports = new RequestProcessor();