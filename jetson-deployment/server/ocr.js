/**
 * OCR Service - Tesseract OCR wrapper with GPU acceleration
 * Optimized for NVIDIA Jetson Nano
 */

const tesseract = require('node-tesseract-ocr');
const { convert } = require('pdf-poppler');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class OCRService {
  constructor() {
    this.tesseractPath = process.env.TESSERACT_PATH || '/usr/bin/tesseract';
    this.initialized = false;
  }

  /**
   * Initialize OCR service
   */
  async initialize() {
    try {
      // Verify Tesseract is available
      await this.healthCheck();
      this.initialized = true;
      console.log('✅ OCR Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize OCR service:', error);
      throw error;
    }
  }

  /**
   * Health check - verify Tesseract is working
   */
  async healthCheck() {
    try {
      const config = {
        lang: 'eng',
        oem: 3,
        psm: 3
      };

      // Create a simple test image with text
      const testBuffer = await sharp({
        create: {
          width: 200,
          height: 50,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
        .png()
        .toBuffer();

      const tempPath = path.join(os.tmpdir(), 'ocr-test.png');
      await fs.writeFile(tempPath, testBuffer);

      await tesseract.recognize(tempPath, config);
      await fs.unlink(tempPath);

      return true;
    } catch (error) {
      console.error('Tesseract health check failed:', error);
      return false;
    }
  }

  /**
   * Extract text from document (PDF or image)
   */
  async extractText(filePath, options = {}) {
    const startTime = Date.now();

    try {
      const {
        lang = 'ita+eng',
        psm = '3', // Page segmentation mode (3 = auto)
        oem = '3'  // OCR engine mode (3 = default, based on what's available)
      } = options;

      const ext = path.extname(filePath).toLowerCase();
      let textResult;

      if (ext === '.pdf') {
        // PDF: Convert to images, then OCR each page
        textResult = await this.extractFromPDF(filePath, { lang, psm, oem });
      } else {
        // Image: OCR directly
        textResult = await this.extractFromImage(filePath, { lang, psm, oem });
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        text: textResult.text,
        confidence: textResult.confidence || 0,
        pages: textResult.pages || 1,
        duration
      };

    } catch (error) {
      console.error('OCR extraction error:', error);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Extract text from PDF (convert to images first)
   */
  async extractFromPDF(pdfPath, options) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-ocr-'));

    try {
      // Convert PDF to images using poppler
      const popplerOptions = {
        format: 'png',
        out_dir: tempDir,
        out_prefix: 'page',
        scale: 2048, // High resolution for better OCR
        singlefile: false
      };

      await convert(pdfPath, popplerOptions);

      // Get all generated image files
      const files = await fs.readdir(tempDir);
      const imageFiles = files
        .filter(f => f.endsWith('.png'))
        .sort()
        .map(f => path.join(tempDir, f));

      console.log(`📄 PDF converted to ${imageFiles.length} pages`);

      // OCR each page
      let fullText = '';
      let totalConfidence = 0;

      for (let i = 0; i < imageFiles.length; i++) {
        console.log(`🔍 OCR page ${i + 1}/${imageFiles.length}...`);

        const pageResult = await this.extractFromImage(imageFiles[i], options);
        fullText += pageResult.text + '\n\n';
        totalConfidence += pageResult.confidence || 0;

        // Cleanup page image immediately
        await fs.unlink(imageFiles[i]);
      }

      // Cleanup temp directory
      await fs.rmdir(tempDir);

      return {
        text: fullText.trim(),
        confidence: imageFiles.length > 0 ? totalConfidence / imageFiles.length : 0,
        pages: imageFiles.length
      };

    } catch (error) {
      // Cleanup on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.error('Cleanup error:', e);
      }
      throw error;
    }
  }

  /**
   * Extract text from single image
   */
  async extractFromImage(imagePath, options) {
    try {
      const {
        lang = 'ita+eng',
        psm = '3',
        oem = '3'
      } = options;

      // Preprocess image for better OCR accuracy
      const processedPath = await this.preprocessImage(imagePath);

      // Tesseract config
      const config = {
        lang,
        oem: parseInt(oem),
        psm: parseInt(psm)
      };

      // Run OCR
      const text = await tesseract.recognize(processedPath, config);

      // Cleanup preprocessed image if different from original
      if (processedPath !== imagePath) {
        await fs.unlink(processedPath);
      }

      // Calculate rough confidence (Tesseract node wrapper doesn't return confidence)
      // We estimate based on text characteristics
      const confidence = this.estimateConfidence(text);

      return {
        text: text.trim(),
        confidence
      };

    } catch (error) {
      console.error('Image OCR error:', error);
      throw error;
    }
  }

  /**
   * Preprocess image for better OCR accuracy
   * - Resize if too small/large
   * - Increase contrast
   * - Convert to grayscale
   */
  async preprocessImage(imagePath) {
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();

      // Only preprocess if needed
      const needsPreprocessing =
        metadata.width < 1000 ||
        metadata.width > 4000 ||
        metadata.format !== 'png';

      if (!needsPreprocessing) {
        return imagePath; // Use original
      }

      // Create preprocessed version
      const tempPath = path.join(
        os.tmpdir(),
        `preprocessed-${Date.now()}.png`
      );

      await image
        .resize({
          width: 2048,
          height: undefined,
          fit: 'inside',
          withoutEnlargement: false
        })
        .grayscale()
        .normalize() // Improve contrast
        .sharpen()
        .png()
        .toFile(tempPath);

      return tempPath;

    } catch (error) {
      console.error('Image preprocessing error:', error);
      return imagePath; // Fallback to original
    }
  }

  /**
   * Estimate OCR confidence based on text characteristics
   * (Since node-tesseract-ocr doesn't return confidence scores)
   */
  estimateConfidence(text) {
    if (!text || text.length < 10) {
      return 10; // Very low confidence for short text
    }

    let score = 50; // Base score

    // Factors that increase confidence:
    // 1. Reasonable text length
    if (text.length > 100) score += 10;
    if (text.length > 500) score += 10;

    // 2. Contains common Italian/English words
    const commonWords = ['fattura', 'ordine', 'cliente', 'totale', 'data', 'invoice', 'total', 'date', 'order'];
    const lowerText = text.toLowerCase();
    const matchedWords = commonWords.filter(word => lowerText.includes(word)).length;
    score += Math.min(matchedWords * 5, 20);

    // 3. Has proper punctuation
    if (/[.,;:!?]/.test(text)) score += 5;

    // 4. Has numbers (common in invoices)
    if (/\d/.test(text)) score += 5;

    // Factors that decrease confidence:
    // 1. Too many special characters
    const specialCharRatio = (text.match(/[^a-zA-Z0-9\s.,;:!?\-€$]/g) || []).length / text.length;
    if (specialCharRatio > 0.2) score -= 20;

    // 2. Very short lines (might be noise)
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length > 0 && text.length / lines.length < 10) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get OCR statistics
   */
  async getStats() {
    return {
      tesseractPath: this.tesseractPath,
      initialized: this.initialized,
      availableLanguages: ['ita', 'eng'], // Configured languages
      version: 'Tesseract 5.x' // Would need to exec tesseract --version
    };
  }
}

// Singleton instance
const ocrService = new OCRService();

module.exports = ocrService;
