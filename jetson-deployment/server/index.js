/**
 * Jetson OCR Server - Main Entry Point
 * GPU-accelerated document OCR and classification for Odoo integration
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const pino = require('pino');

const ocrService = require('./ocr');
const classifierService = require('./classifier');
const queueManager = require('./queue');

// Initialize logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3100;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`
    });
  });
  next();
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../storage/uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 10 // Max 10 files per request
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported: ${file.mimetype}`));
    }
  }
});

// ============================================
// API ROUTES
// ============================================

/**
 * GET /api/v1/health
 * Health check endpoint
 */
app.get('/api/v1/health', async (req, res) => {
  try {
    // Check Tesseract availability
    const tesseractOk = await ocrService.healthCheck();

    // Check Redis connection
    const redisOk = await queueManager.healthCheck();

    // Check disk space
    const storageInfo = await getStorageInfo();

    const status = tesseractOk && redisOk ? 'healthy' : 'degraded';

    res.json({
      status,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        tesseract: tesseractOk ? 'ok' : 'error',
        redis: redisOk ? 'ok' : 'error',
        kimiK2: process.env.KIMI_K2_API_KEY ? 'configured' : 'missing'
      },
      storage: storageInfo,
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/metrics
 * Prometheus-style metrics
 */
app.get('/api/v1/metrics', async (req, res) => {
  try {
    const metrics = await queueManager.getMetrics();

    res.set('Content-Type', 'text/plain');
    res.send(`
# HELP ocr_documents_processed_total Total number of documents processed
# TYPE ocr_documents_processed_total counter
ocr_documents_processed_total ${metrics.completed}

# HELP ocr_documents_failed_total Total number of failed documents
# TYPE ocr_documents_failed_total counter
ocr_documents_failed_total ${metrics.failed}

# HELP ocr_documents_pending Current number of pending documents
# TYPE ocr_documents_pending gauge
ocr_documents_pending ${metrics.pending}

# HELP ocr_processing_duration_seconds Average OCR processing duration
# TYPE ocr_processing_duration_seconds gauge
ocr_processing_duration_seconds ${metrics.avgDuration / 1000}
    `.trim());
  } catch (error) {
    logger.error('Metrics error:', error);
    res.status(500).send('# Error fetching metrics');
  }
});

/**
 * POST /api/v1/ocr/analyze
 * Analyze single document (sync or async)
 */
app.post('/api/v1/ocr/analyze', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  let tempFilePath = null;

  try {
    // Validate webhook secret if configured
    if (process.env.ODOO_WEBHOOK_SECRET) {
      const providedSecret = req.headers['x-webhook-secret'];
      if (providedSecret !== process.env.ODOO_WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Invalid webhook secret' });
      }
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    tempFilePath = req.file.path;
    logger.info(`Processing file: ${req.file.originalname} (${req.file.size} bytes)`);

    // Step 1: OCR - Extract text from document
    logger.info('Step 1: Running OCR...');
    const ocrResult = await ocrService.extractText(tempFilePath, {
      lang: req.body.language || 'ita+eng',
      psm: req.body.psm || '3' // Auto page segmentation
    });

    if (!ocrResult.success) {
      throw new Error(`OCR failed: ${ocrResult.error}`);
    }

    logger.info(`OCR completed: ${ocrResult.text.length} chars extracted in ${ocrResult.duration}ms`);

    // Step 2: Classification - Classify document with Kimi K2
    logger.info('Step 2: Classifying document...');
    const classification = await classifierService.classify(ocrResult.text);

    logger.info(`Classification: ${classification.type} (${classification.confidence}% confidence)`);

    // Step 3: Save processed document
    const processedPath = await saveProcessedDocument(
      req.file.originalname,
      ocrResult,
      classification
    );

    // Step 4: Cleanup temp file
    await fs.unlink(tempFilePath);
    tempFilePath = null;

    const totalDuration = Date.now() - startTime;

    // Return result
    res.json({
      success: true,
      filename: req.file.originalname,
      result: {
        type: classification.type,
        typeName: classification.typeName,
        confidence: classification.confidence,
        details: classification.details,
        extractedText: ocrResult.text.substring(0, 1000), // First 1000 chars
        fullTextLength: ocrResult.text.length
      },
      processing: {
        ocrDuration: ocrResult.duration,
        classificationDuration: classification.duration,
        totalDuration
      },
      processedFile: processedPath,
      timestamp: new Date().toISOString()
    });

    logger.info(`Document processed successfully in ${totalDuration}ms`);

  } catch (error) {
    logger.error('OCR analyze error:', error);

    // Cleanup temp file on error
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {
        logger.error('Failed to cleanup temp file:', e);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message,
      filename: req.file?.originalname
    });
  }
});

/**
 * POST /api/v1/ocr/batch
 * Batch processing (async with job queue)
 */
app.post('/api/v1/ocr/batch', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    logger.info(`Batch request: ${req.files.length} files`);

    // Add files to job queue
    const jobs = [];
    for (const file of req.files) {
      const job = await queueManager.addJob({
        filename: file.originalname,
        filepath: file.path,
        language: req.body.language || 'ita+eng'
      });
      jobs.push({
        jobId: job.id,
        filename: file.originalname
      });
    }

    res.json({
      success: true,
      message: `${jobs.length} documents queued for processing`,
      jobs,
      statusUrl: '/api/v1/ocr/status'
    });

  } catch (error) {
    logger.error('Batch upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/ocr/status/:jobId
 * Check job status
 */
app.get('/api/v1/ocr/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await queueManager.getJobStatus(jobId);

    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      jobId,
      status: status.state,
      progress: status.progress,
      result: status.returnvalue,
      error: status.failedReason,
      createdAt: status.timestamp,
      processedAt: status.processedOn,
      finishedAt: status.finishedOn
    });

  } catch (error) {
    logger.error('Status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/ocr/queue
 * Get queue statistics
 */
app.get('/api/v1/ocr/queue', async (req, res) => {
  try {
    const stats = await queueManager.getQueueStats();
    res.json(stats);
  } catch (error) {
    logger.error('Queue stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ERROR HANDLERS
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getStorageInfo() {
  try {
    const storagePath = path.join(__dirname, '../storage');
    const stats = await fs.stat(storagePath);

    // Simple size calculation (would need better implementation for actual disk space)
    return {
      path: storagePath,
      available: 'N/A', // Would need disk-space package
      used: 'N/A'
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function saveProcessedDocument(filename, ocrResult, classification) {
  const processedDir = path.join(__dirname, '../storage/processed');
  await fs.mkdir(processedDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const basename = path.parse(filename).name;
  const resultPath = path.join(processedDir, `${basename}-${timestamp}.json`);

  await fs.writeFile(resultPath, JSON.stringify({
    filename,
    timestamp: new Date().toISOString(),
    ocr: {
      text: ocrResult.text,
      duration: ocrResult.duration,
      confidence: ocrResult.confidence
    },
    classification
  }, null, 2));

  return resultPath;
}

// ============================================
// START SERVER
// ============================================

async function startServer() {
  try {
    // Initialize services
    logger.info('Initializing OCR service...');
    await ocrService.initialize();

    logger.info('Initializing classification service...');
    await classifierService.initialize();

    logger.info('Initializing job queue...');
    await queueManager.initialize();

    // Start HTTP server
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Jetson OCR Server running on port ${PORT}`);
      logger.info(`📍 Health check: http://localhost:${PORT}/api/v1/health`);
      logger.info(`📊 Metrics: http://localhost:${PORT}/api/v1/metrics`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await queueManager.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await queueManager.close();
  process.exit(0);
});

// Start the server
startServer();
