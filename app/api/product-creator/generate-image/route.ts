import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

export async function POST(request: NextRequest) {
  try {
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida. Effettua il login.' },
        { status: 401 }
      );
    }

    const { prompt, productId } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt mancante' },
        { status: 400 }
      );
    }

    console.log('🎨 Generating image with OpenAI DALL-E for prompt:', prompt);

    // Use OpenAI DALL-E 3 for image generation
    const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: `Professional product photography: ${prompt}. Clean white background, e-commerce style, high quality, well-lit, centered.`,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      })
    });

    const imageData = await openaiResponse.json();

    if (!openaiResponse.ok || imageData.error) {
      console.error('❌ DALL-E error:', imageData.error);
      return NextResponse.json({
        success: false,
        error: imageData.error?.message || 'Errore generazione immagine'
      }, { status: 500 });
    }

    const imageUrl = imageData.data[0]?.url;

    if (!imageUrl) {
      return NextResponse.json({
        success: false,
        error: 'Nessuna immagine generata'
      }, { status: 500 });
    }

    console.log('✅ Image generated:', imageUrl);

    // If productId is provided, update product with image in Odoo
    if (productId) {
      try {
        // Download image and convert to base64
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');

        const odooUrl = process.env.ODOO_URL;

        // Update product with image
        const updateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'product.product',
              method: 'write',
              args: [
                [productId],
                { image_1920: base64Image }
              ],
              kwargs: {},
            },
            id: Math.floor(Math.random() * 1000000000)
          })
        });

        const updateData = await updateResponse.json();

        if (updateData.error) {
          console.error('⚠️ Error updating product image in Odoo:', updateData.error);
        } else {
          console.log('✅ Product image updated in Odoo');
        }
      } catch (odooError) {
        console.error('⚠️ Failed to upload image to Odoo:', odooError);
      }
    }

    return NextResponse.json({
      success: true,
      imageUrl: imageUrl,
    });

  } catch (error: any) {
    console.error('❌ Error generating image:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante la generazione dell\'immagine'
      },
      { status: 500 }
    );
  }
}
