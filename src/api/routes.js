const express = require('express');
const Joi = require('joi');
const router = express.Router();
const requestProcessor = require('../core/request-processor');
const logger = require('../utils/logger');

// Schema للتحقق من البيانات
const processSchema = Joi.object({
  prompt: Joi.string().required().min(1).max(1000).trim(),
  image: Joi.string().allow(null).optional(),
  sessionId: Joi.string().optional()
});

/**
 * @route   POST /api/v1/process
 * @desc    معالجة صورة باستخدام Google AI Studio
 * @access  Private (API Key required)
 */
router.post('/process', async (req, res) => {
  try {
    // التحقق من صحة البيانات باستخدام Joi
    const { error, value } = processSchema.validate(req.body, { abortEarly: false });
    if (error) {
      // Log validation failure for easier debugging in tests
      logger.warn('Validation failed for /process', { body: req.body, details: error.details });

      // Use a friendly, specific error message for the response
      const firstDetail = error.details && error.details[0];
      let message = 'Validation error';

      if (firstDetail && firstDetail.path && firstDetail.path[0] === 'prompt') {
        message = 'Prompt is required and must be a non-empty string';
      } else if (firstDetail && firstDetail.message) {
        message = firstDetail.message.replace(/"/g, '');
      }

      return res.status(400).json({
        success: false,
        error: message,
        details: error.details.map(d => d.message)
      });
    }

    const { prompt, image, sessionId } = value;

    // التحقق من صحة Base64 إذا كانت الصورة موجودة
    if (image && !isValidBase64(image)) {
      return res.status(400).json({
        success: false,
        error: 'Image must be a valid base64 string',
        details: ['Image must be a valid base64 string']
      });
    }

    // إضافة الطلب إلى قائمة الانتظار
    const job = await requestProcessor.addImageGenerationRequest({
      prompt: prompt.trim(),
      imageData: image,
      sessionId: sessionId
    });

    logger.info(`Processing request added to queue: ${job.id}`);

    res.status(202).json({
      success: true,
      message: 'Request added to processing queue',
      data: {
        jobId: job.id,
        status: 'queued',
        estimatedTime: '30-60 seconds'
      }
    });

  } catch (error) {
    logger.error('Failed to process request', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/v1/status/:jobId
 * @desc    الحصول على حالة الطلب
 * @access  Private (API Key required)
 */
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
    }

    const status = await requestProcessor.getJobStatus(jobId);

    if (!status.found) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Failed to get job status', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/v1/stats
 * @desc    الحصول على إحصائيات النظام
 * @access  Private (API Key required)
 */
router.get('/stats', async (req, res) => {
  try {
    // يمكن إضافة إحصائيات أكثر هنا
    const stats = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Failed to get stats', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * دالة للتحقق من صحة Base64
 */
function isValidBase64(str) {
  try {
    if (!str || typeof str !== 'string') return false;
    // التحقق من الصيغة الأساسية
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(str) || str.length % 4 !== 0) return false;
    // محاولة فك التشفير للتأكد من صحة البيانات
    Buffer.from(str, 'base64').toString('utf8');
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = router;