import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { Jimp } from 'jimp';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'File mancante' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const image = await Jimp.read(buffer);
    image.scaleToFit({ w: 1920, h: 1440 });
    const resizedBuffer = await image.getBuffer('image/jpeg', { quality: 80 });

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const blob = await put(`catalogo-foto/${timestamp}_${random}.jpg`, resizedBuffer, {
      access: 'public',
    });

    return NextResponse.json({ success: true, url: blob.url });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
