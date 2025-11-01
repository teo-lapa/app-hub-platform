import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({
        connected: false,
        userId: null
      }, { status: 200 });
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as any;

    if (decoded && decoded.id) {
      return NextResponse.json({
        connected: true,
        userId: decoded.id,
        userName: decoded.name || decoded.email || 'User'
      }, { status: 200 });
    }

    return NextResponse.json({
      connected: false,
      userId: null
    }, { status: 200 });
  } catch (error: any) {
    console.error('Session check error:', error);
    return NextResponse.json({
      connected: false,
      userId: null,
      error: error.message
    }, { status: 200 });
  }
}
