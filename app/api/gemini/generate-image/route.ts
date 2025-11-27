import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const { prompt, aspectRatio, baseImage, tone, includeLogo, logoImage, companyMotto } = await request.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    console.log('Generating image with Gemini 2.5 Flash Image');
    console.log('Prompt:', prompt.substring(0, 100) + '...');
    console.log('Aspect Ratio:', aspectRatio);
    console.log('Tone:', tone);
    console.log('Include Logo:', includeLogo);
    console.log('Has base image:', !!baseImage);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

    // Build tone description
    const toneDescriptions: Record<string, string> = {
      professional: 'professional, clean, corporate style',
      casual: 'casual, relaxed, friendly atmosphere',
      fun: 'fun, playful, vibrant and colorful',
      luxury: 'luxury, elegant, premium high-end aesthetic'
    };
    const toneStyle = toneDescriptions[tone] || toneDescriptions.professional;

    // Build branding instructions
    let brandingInstructions = '';
    if (includeLogo && logoImage) {
      brandingInstructions = '\n\nLOGO: Add the provided company logo as a small, elegant watermark in the bottom right corner. The logo should be subtle but visible, maintaining professional quality.';
      if (companyMotto) {
        brandingInstructions += ` Also include the motto "${companyMotto}" near the logo in an elegant font.`;
      }
    } else if (includeLogo && companyMotto) {
      brandingInstructions = ` Include the motto "${companyMotto}" as elegant text in the image.`;
    } else if (includeLogo) {
      brandingInstructions = ' Include space for corporate branding elements in the bottom right corner.';
    }

    // Build prompt with aspect ratio, tone and branding
    const fullPrompt = `${prompt}. Style: ${toneStyle}. Image aspect ratio: ${aspectRatio || '1:1'}.${brandingInstructions}`;

    console.log('Full prompt:', fullPrompt);
    console.log('Has logo image:', !!logoImage);

    const startTime = Date.now();
    let result;

    // Build content array
    const contents: any[] = [];

    // Add base image if provided (image-to-image)
    if (baseImage) {
      const base64Data = baseImage.replace(/^data:image\/\w+;base64,/, '');
      const mimeMatch = baseImage.match(/^data:(image\/\w+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      contents.push({ inlineData: { mimeType, data: base64Data } });
    }

    // Add logo image if provided
    if (logoImage) {
      const cleanLogoBase64 = logoImage.replace(/^data:image\/\w+;base64,/, '');
      const logoMimeMatch = logoImage.match(/^data:(image\/\w+);base64,/);
      const logoMimeType = logoMimeMatch ? logoMimeMatch[1] : 'image/png';
      contents.push({ inlineData: { mimeType: logoMimeType, data: cleanLogoBase64 } });
      console.log('Logo added to request');
    }

    // Add the prompt
    contents.push(fullPrompt);

    // Generate content
    if (contents.length > 1) {
      // Has images (base image and/or logo)
      result = await model.generateContent(contents);
    } else {
      // Text only
      result = await model.generateContent(fullPrompt);
    }

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Gemini API responded in ${elapsedTime}s`);

    const response = result.response;

    if (!response?.candidates?.length) {
      console.error('No candidates in Gemini response');
      return NextResponse.json({ error: 'No image generated' }, { status: 500 });
    }

    const parts = response.candidates[0]?.content?.parts || [];

    let imageBase64 = null;
    let imageMimeType = 'image/png';

    for (const part of parts) {
      if (part.inlineData?.data) {
        imageBase64 = part.inlineData.data;
        imageMimeType = part.inlineData.mimeType || 'image/png';
        break;
      }
    }

    if (!imageBase64) {
      console.error('No image data in Gemini response parts');
      return NextResponse.json({ error: 'No image generated' }, { status: 500 });
    }

    console.log('Image generated successfully');
    console.log('Format:', imageMimeType);
    console.log('Size:', Math.round(imageBase64.length * 0.75 / 1024), 'KB');

    return NextResponse.json({
      success: true,
      image: { dataUrl: `data:${imageMimeType};base64,${imageBase64}` }
    });

  } catch (error: any) {
    console.error('Gemini image generation error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to generate image'
    }, { status: 500 });
  }
}
