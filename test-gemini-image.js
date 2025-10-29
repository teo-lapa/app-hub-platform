// Test script per verificare la generazione di immagini con Gemini
// Run with: node test-gemini-image.js

require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiImageGeneration() {
  try {
    console.log('🔍 Testing Gemini 2.5 Flash Image generation...\n');

    // Check if API key is present
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ ERROR: No API key found!');
      console.log('Please set GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY in your .env file');
      return;
    }

    console.log('✅ API Key found:', apiKey.substring(0, 10) + '...');

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ GoogleGenerativeAI initialized');

    // Get the model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });
    console.log('✅ Model loaded: gemini-2.5-flash-image');

    // Simple test prompt
    const prompt = 'Professional product photography of a banana. Clean white background, e-commerce style, well-lit, centered, high quality.';
    console.log('\n📝 Testing with prompt:', prompt);

    console.log('\n⏳ Generating image... (this may take 30-60 seconds)\n');

    // Generate content
    const result = await model.generateContent(prompt);
    const response = result.response;

    console.log('✅ Response received!');
    console.log('\nResponse structure:');
    console.log('- candidates:', response.candidates?.length || 0);

    if (!response.candidates || response.candidates.length === 0) {
      console.error('\n❌ ERROR: No candidates in response!');
      console.log('Full response:', JSON.stringify(response, null, 2));
      return;
    }

    const candidate = response.candidates[0];
    console.log('- parts:', candidate.content?.parts?.length || 0);

    const parts = candidate.content?.parts || [];

    let hasImage = false;
    let hasText = false;

    for (const part of parts) {
      if (part.inlineData) {
        hasImage = true;
        console.log('\n✅ IMAGE FOUND!');
        console.log('- MIME type:', part.inlineData.mimeType);
        console.log('- Data size:', part.inlineData.data?.length || 0, 'characters');
        console.log('- Estimated image size:', Math.round((part.inlineData.data?.length || 0) * 0.75 / 1024), 'KB');
      }
      if (part.text) {
        hasText = true;
        console.log('\n📄 TEXT FOUND:', part.text.substring(0, 100));
      }
    }

    if (!hasImage) {
      console.error('\n❌ ERROR: No image found in response!');
      console.log('\nFull response structure:');
      console.log(JSON.stringify(response, null, 2));
    }

    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY:');
    console.log('='.repeat(60));
    console.log('API Key:', apiKey ? '✅ Present' : '❌ Missing');
    console.log('Model:', '✅ gemini-2.5-flash-image');
    console.log('Response:', response.candidates ? '✅ Received' : '❌ No response');
    console.log('Image:', hasImage ? '✅ Generated' : '❌ Not generated');
    console.log('Text:', hasText ? '✅ Present' : '❌ Not present');
    console.log('='.repeat(60));

    if (hasImage) {
      console.log('\n🎉 SUCCESS! Image generation is working!\n');
    } else {
      console.log('\n⚠️  FAILURE! Image was NOT generated.\n');
      console.log('Possible causes:');
      console.log('1. Model name is incorrect');
      console.log('2. API key lacks permissions');
      console.log('3. SDK version is incompatible');
      console.log('4. Google API quota exceeded');
      console.log('\nTry updating the SDK:');
      console.log('npm install @google/generative-ai@latest\n');
    }

  } catch (error) {
    console.error('\n❌ ERROR during test:', error.message);
    if (error.status) {
      console.error('HTTP Status:', error.status);
    }
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response, null, 2));
    }
    console.error('\nFull error:', error);
  }
}

testGeminiImageGeneration();
