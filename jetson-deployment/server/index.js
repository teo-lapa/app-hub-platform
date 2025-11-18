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
// Load correct classifier based on USE_OLLAMA env variable
const USE_OLLAMA = process.env.USE_OLLAMA === 'true';
const classifierService = USE_OLLAMA
  ? require('./classifier-ollama')
  : require('./classifier');
const queueManager = require('./queue');
const contactClassifier = require('./contact-classifier');

// Log which classifier is being used
console.log(`🤖 AI Classifier: ${USE_OLLAMA ? 'Ollama Llama 3.2 3B (Local)' : 'Cloud API'}`);

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

    // Check Ollama status (if using local AI)
    const ollamaStatus = USE_OLLAMA ? await checkOllamaStatus() : 'disabled';

    // Check disk space and memory
    const storageInfo = await getStorageInfo();
    const memoryInfo = getMemoryInfo();

    // Get queue metrics
    const metrics = await queueManager.getMetrics();

    const status = tesseractOk && redisOk ? 'healthy' : 'degraded';

    res.json({
      status,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        tesseract: tesseractOk ? 'ok' : 'error',
        redis: redisOk ? 'ok' : 'error',
        ollama: ollamaStatus
      },
      storage: storageInfo,
      memory: memoryInfo,
      metrics: {
        processed: metrics.completed,
        failed: metrics.failed,
        pending: metrics.pending
      },
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

    // Step 2: AI Classification - Classify document type
    logger.info('Step 2: Classifying document with AI...');
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

/**
 * POST /api/v1/chat
 * Chat with Ollama AI
 */
app.post('/api/v1/chat', async (req, res) => {
  try {
    const { message, conversation = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    logger.info(`Chat request: ${message.substring(0, 50)}...`);

    const response = await classifierService.chat(message, conversation);

    res.json({
      success: true,
      message: response.message,
      conversation: response.conversation
    });

  } catch (error) {
    logger.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/extract-data
 * Extract structured data from document
 */
app.post('/api/v1/extract-data', upload.single('file'), async (req, res) => {
  let tempFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    tempFilePath = req.file.path;
    logger.info(`Data extraction request: ${req.file.originalname}`);

    // Step 1: OCR
    const ocrResult = await ocrService.extractText(tempFilePath, {
      lang: req.body.language || 'ita+eng',
      psm: '3'
    });

    if (!ocrResult.success) {
      throw new Error(`OCR failed: ${ocrResult.error}`);
    }

    // Step 2: Extract structured data with AI
    const extractedData = await classifierService.extractData(ocrResult.text);

    // Cleanup
    await fs.unlink(tempFilePath);

    res.json({
      success: true,
      filename: req.file.originalname,
      data: extractedData,
      extractedText: ocrResult.text.substring(0, 500)
    });

  } catch (error) {
    logger.error('Data extraction error:', error);
    if (tempFilePath) {
      try { await fs.unlink(tempFilePath); } catch (e) {}
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/ask-document
 * Ask questions about a document
 */
app.post('/api/v1/ask-document', upload.single('file'), async (req, res) => {
  let tempFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question required' });
    }

    tempFilePath = req.file.path;
    logger.info(`Q&A request: ${question}`);

    // Step 1: OCR
    const ocrResult = await ocrService.extractText(tempFilePath, {
      lang: req.body.language || 'ita+eng',
      psm: '3'
    });

    if (!ocrResult.success) {
      throw new Error(`OCR failed: ${ocrResult.error}`);
    }

    // Step 2: Ask AI about the document
    const answer = await classifierService.askDocument(ocrResult.text, question);

    // Cleanup
    await fs.unlink(tempFilePath);

    res.json({
      success: true,
      filename: req.file.originalname,
      question,
      answer: answer.answer,
      confidence: answer.confidence
    });

  } catch (error) {
    logger.error('Document Q&A error:', error);
    if (tempFilePath) {
      try { await fs.unlink(tempFilePath); } catch (e) {}
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/extract-contact
 * Extract contact information from business cards/invoices using Llama 3.2
 */
app.post('/api/v1/extract-contact', upload.single('file'), async (req, res) => {
  let tempFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    tempFilePath = req.file.path;
    logger.info(`Contact extraction request: ${req.file.originalname}`);

    // Map language codes: 'it' -> 'ita' for Tesseract
    let tessLang = req.body.language || 'ita+eng';
    if (tessLang === 'it') tessLang = 'ita+eng';
    if (tessLang === 'en') tessLang = 'eng';
    if (tessLang === 'de') tessLang = 'deu';

    // Step 1: OCR text extraction
    const ocrResult = await ocrService.extractText(tempFilePath, {
      lang: tessLang,
      psm: '3'
    });

    if (!ocrResult.success) {
      throw new Error(`OCR failed: ${ocrResult.error}`);
    }

    // Step 2: Extract contact data with Llama AI
    const contactResult = await contactClassifier.extractContact(ocrResult.text, {
      mode: req.body.mode || 'auto'
    });

    // Cleanup
    await fs.unlink(tempFilePath);

    res.json({
      success: true,
      filename: req.file.originalname,
      rawText: ocrResult.text,
      contact: contactResult, // Fixed: contactResult already contains the contact data
      confidence: contactResult.confidence,
      extractionMethod: contactResult.extractionMethod,
      duration: contactResult.duration
    });

  } catch (error) {
    logger.error('Contact extraction error:', error);
    if (tempFilePath) {
      try { await fs.unlink(tempFilePath); } catch (e) {}
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
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

async function checkOllamaStatus() {
  try {
    const ollamaURL = process.env.OLLAMA_URL || 'http://localhost:11434';
    const response = await fetch(`${ollamaURL}/api/tags`, {
      signal: AbortSignal.timeout(3000) // 3s timeout
    });

    if (!response.ok) {
      return 'error';
    }

    const data = await response.json();
    const model = process.env.OLLAMA_MODEL || 'llama3.2:3b';
    const hasModel = data.models?.some(m => m.name === model);

    return hasModel ? 'ok' : 'model-missing';
  } catch (error) {
    return 'offline';
  }
}

function getMemoryInfo() {
  const totalMem = require('os').totalmem();
  const freeMem = require('os').freemem();
  const usedMem = totalMem - freeMem;

  return {
    total: Math.round(totalMem / 1024 / 1024), // MB
    used: Math.round(usedMem / 1024 / 1024), // MB
    free: Math.round(freeMem / 1024 / 1024), // MB
    usagePercent: Math.round((usedMem / totalMem) * 100)
  };
}

async function getStorageInfo() {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Get disk space info using df command (Linux)
    const { stdout } = await execAsync('df -BM / | tail -1');
    const parts = stdout.trim().split(/\s+/);

    // df output: Filesystem  1M-blocks  Used Available Use% Mounted
    const total = parts[1]; // e.g., "30000M"
    const used = parts[2];
    const available = parts[3];
    const usagePercent = parts[4]; // e.g., "45%"

    return {
      total,
      used,
      available,
      usagePercent
    };
  } catch (error) {
    // Fallback if df command fails
    return {
      total: 'N/A',
      used: 'N/A',
      available: 'N/A',
      usagePercent: 'N/A',
      error: error.message
    };
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

    logger.info('Initializing contact classifier...');
    await contactClassifier.initialize();

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
