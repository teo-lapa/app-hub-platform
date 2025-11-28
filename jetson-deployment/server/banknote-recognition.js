/**
 * Banknote Recognition Service
 * Uses Ollama LLaVA for CHF banknote denomination recognition
 */

const fs = require('fs').promises;
const path = require('path');

// Ollama configuration
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const VISION_MODEL = process.env.VISION_MODEL || 'llava:7b';

// Valid CHF denominations
const VALID_DENOMINATIONS = [10, 20, 50, 100, 200, 1000];

// CHF banknote colors for reference
const DENOMINATION_COLORS = {
  10: 'yellow/golden',
  20: 'red',
  50: 'green',
  100: 'blue',
  200: 'brown',
  1000: 'purple/violet'
};

let initialized = false;

/**
 * Initialize the banknote recognition service
 */
async function initialize() {
  try {
    console.log('🏦 Initializing banknote recognition service...');

    // Check Ollama availability
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error('Ollama not available');
    }

    const data = await response.json();
    const hasVisionModel = data.models?.some(m =>
      m.name.includes('llava') || m.name.includes('bakllava')
    );

    if (!hasVisionModel) {
      console.warn('⚠️ Vision model not found. Run: ollama pull llava:7b');
    } else {
      console.log('✅ Vision model available');
    }

    initialized = true;
    console.log('✅ Banknote recognition service initialized');

  } catch (error) {
    console.error('❌ Banknote service init error:', error.message);
    // Don't throw - service can still work with fallback
    initialized = true;
  }
}

/**
 * Recognize a CHF banknote from base64 image
 * @param {string} base64Image - Base64 encoded image
 * @param {object} options - Recognition options
 * @returns {object} Recognition result
 */
async function recognize(base64Image, options = {}) {
  const startTime = Date.now();

  try {
    if (!base64Image) {
      throw new Error('No image provided');
    }

    console.log(`📸 Processing banknote image (${Math.round(base64Image.length / 1024)}KB base64)`);

    // Build prompt for LLaVA
    const prompt = `You are a banknote recognition expert. Analyze this image carefully.

This should be a Swiss Franc (CHF) banknote. Your task is to identify the denomination.

Valid Swiss CHF banknote denominations and their colors:
- 10 CHF: Yellow/golden color, features Le Corbusier
- 20 CHF: Red color, features Arthur Honegger
- 50 CHF: Green color, features Sophie Taeuber-Arp
- 100 CHF: Blue color, features Alberto Giacometti
- 200 CHF: Brown color, features Charles Ferdinand Ramuz
- 1000 CHF: Purple/violet color, features Jacob Burckhardt

Look carefully at:
1. The large numeral showing the denomination (10, 20, 50, 100, 200, or 1000)
2. The dominant color of the banknote
3. The portrait and design elements

Respond ONLY with valid JSON in this exact format:
{"denomination": 100, "confidence": 0.95, "color": "blue", "details": "Identified Alberto Giacometti portrait"}

If this is NOT a Swiss banknote or you cannot identify it, respond:
{"denomination": 0, "confidence": 0, "error": "Cannot identify as CHF banknote"}`;

    // Call Ollama with vision model
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VISION_MODEL,
        prompt: prompt,
        images: [base64Image],
        stream: false,
        options: {
          temperature: 0.1, // Low temperature for more deterministic output
          num_predict: 200
        }
      }),
      signal: AbortSignal.timeout(60000) // 60s timeout for vision processing
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama error: ${ollamaResponse.status}`);
    }

    const ollamaData = await ollamaResponse.json();
    console.log('🤖 LLaVA response:', ollamaData.response);

    // Parse JSON from response
    const jsonMatch = ollamaData.response?.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from model response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const duration = Date.now() - startTime;

    // Validate denomination
    if (parsed.denomination && VALID_DENOMINATIONS.includes(parsed.denomination)) {
      console.log(`✅ Recognized: ${parsed.denomination} CHF (${parsed.confidence * 100}% confidence)`);

      return {
        success: true,
        denomination: parsed.denomination,
        confidence: parsed.confidence || 0.8,
        color: parsed.color || DENOMINATION_COLORS[parsed.denomination],
        details: parsed.details,
        method: 'llava',
        duration
      };
    } else {
      console.log('❌ Banknote not recognized');

      return {
        success: false,
        denomination: 0,
        confidence: 0,
        error: parsed.error || 'Banknote not recognized',
        method: 'llava',
        duration
      };
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Banknote recognition error:', error.message);

    return {
      success: false,
      denomination: 0,
      confidence: 0,
      error: error.message,
      method: 'llava',
      duration
    };
  }
}

/**
 * Recognize banknote from file path
 * @param {string} filePath - Path to image file
 * @returns {object} Recognition result
 */
async function recognizeFromFile(filePath) {
  try {
    const imageBuffer = await fs.readFile(filePath);
    const base64Image = imageBuffer.toString('base64');
    return recognize(base64Image);
  } catch (error) {
    return {
      success: false,
      error: `Failed to read file: ${error.message}`
    };
  }
}

/**
 * Health check for banknote service
 */
async function healthCheck() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.models?.some(m => m.name.includes('llava'));
  } catch {
    return false;
  }
}

module.exports = {
  initialize,
  recognize,
  recognizeFromFile,
  healthCheck,
  VALID_DENOMINATIONS,
  DENOMINATION_COLORS
};
