/**
 * Simplified OCR Service - Uses system commands for ARM64 compatibility
 * No native npm dependencies - only shell commands
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const execAsync = promisify(exec);

class OCRService {
  constructor() {
    this.tesseractPath = process.env.TESSERACT_PATH || 'tesseract';
    this.initialized = false;
  }

  async initialize() {
    try {
      // Verify Tesseract is available
      const { stdout } = await execAsync(`${this.tesseractPath} --version`);
      console.log('✅ Tesseract version:', stdout.split('\n')[0]);
      this.initialized = true;
    } catch (error) {
      console.error('❌ Tesseract not found:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      await execAsync(`${this.tesseractPath} --version`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract text from document (PDF or image)
   */
  async extractText(filePath, options = {}) {
    const startTime = Date.now();

    try {
      const { lang = 'ita+eng', psm = '3' } = options;
      const ext = path.extname(filePath).toLowerCase();

      let text;
      if (ext === '.pdf') {
        text = await this.extractFromPDF(filePath, { lang, psm });
      } else {
        text = await this.extractFromImage(filePath, { lang, psm });
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        text: text,
        confidence: this.estimateConfidence(text),
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
   * Extract text from PDF using pdftoppm + tesseract
   */
  async extractFromPDF(pdfPath, options) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-ocr-'));

    try {
      // Convert PDF to PNG images (max 5 pages for speed)
      const pngPrefix = path.join(tempDir, 'page');
      await execAsync(`pdftoppm -png -l 5 -r 200 "${pdfPath}" "${pngPrefix}"`);

      // Get generated images
      const files = await fs.readdir(tempDir);
      const imageFiles = files
        .filter(f => f.endsWith('.png'))
        .sort()
        .map(f => path.join(tempDir, f));

      console.log(`📄 Converted PDF to ${imageFiles.length} pages`);

      // OCR each page
      let fullText = '';
      for (let i = 0; i < imageFiles.length; i++) {
        console.log(`🔍 OCR page ${i + 1}/${imageFiles.length}...`);
        const pageText = await this.extractFromImage(imageFiles[i], options);
        fullText += pageText + '\n\n';
      }

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      return fullText.trim();
    } catch (error) {
      // Cleanup on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (e) {}
      throw error;
    }
  }

  /**
   * Extract text from image using tesseract CLI
   */
  async extractFromImage(imagePath, options) {
    try {
      const { lang = 'ita+eng', psm = '3' } = options;

      // Create temp output file
      const outputBase = path.join(os.tmpdir(), `ocr-${Date.now()}`);

      // Run Tesseract
      const cmd = `${this.tesseractPath} "${imagePath}" "${outputBase}" -l ${lang} --psm ${psm}`;
      await execAsync(cmd);

      // Read result
      const textPath = `${outputBase}.txt`;
      const text = await fs.readFile(textPath, 'utf-8');

      // Cleanup
      await fs.unlink(textPath).catch(() => {});

      return text.trim();
    } catch (error) {
      console.error('Image OCR error:', error);
      throw error;
    }
  }

  /**
   * Estimate OCR confidence based on text characteristics
   */
  estimateConfidence(text) {
    if (!text || text.length < 10) return 10;

    let score = 50;

    // Length bonus
    if (text.length > 100) score += 10;
    if (text.length > 500) score += 10;

    // Common words
    const commonWords = ['fattura', 'ordine', 'cliente', 'totale', 'data', 'invoice', 'total', 'date'];
    const lowerText = text.toLowerCase();
    const matchedWords = commonWords.filter(w => lowerText.includes(w)).length;
    score += Math.min(matchedWords * 5, 20);

    // Punctuation and numbers
    if (/[.,;:!?]/.test(text)) score += 5;
    if (/\d/.test(text)) score += 5;

    // Special char penalty
    const specialCharRatio = (text.match(/[^a-zA-Z0-9\s.,;:!?\-€$]/g) || []).length / text.length;
    if (specialCharRatio > 0.2) score -= 20;

    return Math.max(0, Math.min(100, score));
  }
}

// Singleton
const ocrService = new OCRService();
module.exports = ocrService;
