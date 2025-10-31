import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = cookies();

    // Check if user is authenticated by looking for session cookie
    const sessionCookie = cookieStore.get('session_id');

    if (!sessionCookie) {
      return NextResponse.json({
        connected: false,
        userId: null,
        message: 'No session found'
      });
    }

    // Try to get user info from Odoo
    try {
      const odooUrl = process.env.ODOO_URL || 'https://lapa.odoo.com';
      const response = await fetch(`${odooUrl}/web/session/get_session_info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionCookie.value}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {},
          id: Math.floor(Math.random() * 1e9)
        })
      });

      if (!response.ok) {
        return NextResponse.json({
          connected: false,
          userId: null,
          message: 'Failed to get session info'
        });
      }

      const data = await response.json();

      if (data.result && data.result.uid) {
        return NextResponse.json({
          connected: true,
          userId: data.result.uid,
          sessionId: data.result.session_id,
          username: data.result.username || null,
          companyId: data.result.company_id || null
        });
      }

      return NextResponse.json({
        connected: false,
        userId: null,
        message: 'No user ID in session'
      });

    } catch (error: any) {
      console.error('Error checking Odoo session:', error);
      return NextResponse.json({
        connected: false,
        userId: null,
        message: 'Error checking session'
      });
    }

  } catch (error: any) {
    console.error('Error in session API:', error);
    return NextResponse.json({
      connected: false,
      userId: null,
      error: error.message
    });
  }
}
