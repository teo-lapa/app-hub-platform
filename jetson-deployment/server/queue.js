/**
 * Queue Manager - Bull job queue for batch processing
 * Handles asynchronous OCR + classification jobs
 */

const Queue = require('bull');
const Redis = require('ioredis');
const fs = require('fs').promises;
const ocrService = require('./ocr');
const classifierService = require('./classifier');

class QueueManager {
  constructor() {
    this.redisClient = null;
    this.ocrQueue = null;
    this.initialized = false;
  }

  /**
   * Initialize queue manager
   */
  async initialize() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      // Create Redis client
      this.redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false
      });

      // Create Bull queue
      this.ocrQueue = new Queue('ocr-jobs', redisUrl, {
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 50       // Keep last 50 failed jobs
        }
      });

      // Setup queue event handlers
      this.setupEventHandlers();

      // Setup job processor
      this.ocrQueue.process(
        parseInt(process.env.MAX_CONCURRENT_JOBS) || 4,
        this.processJob.bind(this)
      );

      this.initialized = true;
      console.log('✅ Queue Manager initialized');

    } catch (error) {
      console.error('Failed to initialize queue:', error);
      throw error;
    }
  }

  /**
   * Setup queue event handlers
   */
  setupEventHandlers() {
    this.ocrQueue.on('completed', (job, result) => {
      console.log(`✅ Job ${job.id} completed:`, result.filename);
    });

    this.ocrQueue.on('failed', (job, err) => {
      console.error(`❌ Job ${job.id} failed:`, err.message);
    });

    this.ocrQueue.on('stalled', (job) => {
      console.warn(`⚠️  Job ${job.id} stalled`);
    });

    this.ocrQueue.on('progress', (job, progress) => {
      console.log(`⏳ Job ${job.id} progress: ${progress}%`);
    });
  }

  /**
   * Process a single OCR job
   */
  async processJob(job) {
    const { filename, filepath, language } = job.data;

    try {
      console.log(`🔄 Processing job ${job.id}: ${filename}`);

      // Update progress: OCR starting
      await job.progress(10);

      // Step 1: OCR
      const ocrResult = await ocrService.extractText(filepath, {
        lang: language || 'ita+eng'
      });

      if (!ocrResult.success) {
        throw new Error(`OCR failed: ${ocrResult.error}`);
      }

      // Update progress: OCR complete
      await job.progress(50);

      // Step 2: Classification
      const classification = await classifierService.classify(ocrResult.text);

      // Update progress: Classification complete
      await job.progress(80);

      // Step 3: Cleanup temp file
      try {
        await fs.unlink(filepath);
      } catch (e) {
        console.warn(`Failed to cleanup temp file ${filepath}:`, e.message);
      }

      // Update progress: Complete
      await job.progress(100);

      // Return result
      return {
        success: true,
        filename,
        type: classification.type,
        typeName: classification.typeName,
        confidence: classification.confidence,
        details: classification.details,
        ocrDuration: ocrResult.duration,
        classificationDuration: classification.duration
      };

    } catch (error) {
      console.error(`Job ${job.id} processing error:`, error);

      // Cleanup on error
      try {
        await fs.unlink(filepath);
      } catch (e) {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  /**
   * Add a new job to the queue
   */
  async addJob(data) {
    if (!this.initialized) {
      throw new Error('Queue not initialized');
    }

    const job = await this.ocrQueue.add(data, {
      priority: data.priority || 0
    });

    console.log(`📥 Job ${job.id} added to queue: ${data.filename}`);

    return job;
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId) {
    if (!this.initialized) {
      throw new Error('Queue not initialized');
    }

    const job = await this.ocrQueue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job._progress;

    return {
      id: job.id,
      state,
      progress,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    if (!this.initialized) {
      throw new Error('Queue not initialized');
    }

    const [
      waiting,
      active,
      completed,
      failed,
      delayed
    ] = await Promise.all([
      this.ocrQueue.getWaitingCount(),
      this.ocrQueue.getActiveCount(),
      this.ocrQueue.getCompletedCount(),
      this.ocrQueue.getFailedCount(),
      this.ocrQueue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed
    };
  }

  /**
   * Get metrics for monitoring
   */
  async getMetrics() {
    const stats = await this.getQueueStats();

    // Get jobs from last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentJobs = await this.ocrQueue.getJobs(
      ['completed', 'failed'],
      0,
      1000,
      false
    );

    const recentCompleted = recentJobs.filter(
      j => j.finishedOn && j.finishedOn > oneHourAgo && j.returnvalue
    );

    const recentFailed = recentJobs.filter(
      j => j.finishedOn && j.finishedOn > oneHourAgo && j.failedReason
    );

    // Calculate average duration
    let avgDuration = 0;
    if (recentCompleted.length > 0) {
      const totalDuration = recentCompleted.reduce((sum, job) => {
        const duration = (job.finishedOn - job.processedOn) || 0;
        return sum + duration;
      }, 0);
      avgDuration = totalDuration / recentCompleted.length;
    }

    return {
      pending: stats.waiting,
      active: stats.active,
      completed: stats.completed,
      failed: stats.failed,
      completedLastHour: recentCompleted.length,
      failedLastHour: recentFailed.length,
      avgDuration: Math.round(avgDuration),
      throughput: recentCompleted.length // Jobs per hour
    };
  }

  /**
   * Health check - verify Redis connection
   */
  async healthCheck() {
    try {
      if (!this.redisClient) {
        return false;
      }

      await this.redisClient.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Clean old jobs
   */
  async cleanJobs(olderThan = 24 * 60 * 60 * 1000) {
    if (!this.initialized) {
      throw new Error('Queue not initialized');
    }

    const grace = olderThan; // Keep jobs from last 24h by default
    await this.ocrQueue.clean(grace, 'completed');
    await this.ocrQueue.clean(grace, 'failed');

    console.log(`🧹 Cleaned jobs older than ${grace}ms`);
  }

  /**
   * Close queue connections
   */
  async close() {
    if (this.ocrQueue) {
      await this.ocrQueue.close();
    }
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
    console.log('✅ Queue Manager closed');
  }
}

// Singleton instance
const queueManager = new QueueManager();

module.exports = queueManager;
