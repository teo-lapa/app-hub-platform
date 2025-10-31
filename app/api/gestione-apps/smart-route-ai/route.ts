import { NextResponse } from 'next/server';

export async function GET() {
  // Reindirizza direttamente all'app Smart Route AI
  return NextResponse.redirect(new URL('/smart-route-ai', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
}
