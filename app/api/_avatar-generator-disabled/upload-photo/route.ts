import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, filename } = body;

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Immagine mancante' },
        { status: 400 }
      );
    }

    // Validate base64 image format
    const base64Pattern = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
    if (!base64Pattern.test(image)) {
      return NextResponse.json(
        { success: false, error: 'Formato immagine non valido. Accettati: jpeg, jpg, png, gif, webp' },
        { status: 400 }
      );
    }

    // Extract base64 data and mime type
    const matches = image.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { success: false, error: 'Formato base64 non valido' },
        { status: 400 }
      );
    }

    const mimeType = `image/${matches[1]}`;
    const base64Data = matches[2];

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (buffer.length > maxSize) {
      return NextResponse.json(
        { success: false, error: 'Immagine troppo grande. Massimo 10MB' },
        { status: 400 }
      );
    }

    // Generate filename if not provided
    const finalFilename = filename || `avatar-photo-${Date.now()}.${matches[1]}`;

    console.log('📤 Uploading photo to Vercel Blob:', finalFilename);

    // Upload to Vercel Blob
    const blob = await put(finalFilename, buffer, {
      access: 'public',
      contentType: mimeType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    console.log('✅ Photo uploaded successfully:', blob.url);

    return NextResponse.json({
      success: true,
      url: blob.url,
      filename: finalFilename,
      size: buffer.length,
      mimeType: mimeType
    });

  } catch (error: any) {
    console.error('❌ Error uploading photo:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante l\'upload della foto'
      },
      { status: 500 }
    );
  }
}
