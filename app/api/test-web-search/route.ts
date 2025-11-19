import { NextRequest, NextResponse } from 'next/server';
import { searchCompanyInfo } from '@/lib/services/web-search';

export async function POST(req: NextRequest) {
  try {
    const { companyName, location } = await req.json();

    if (!companyName) {
      return NextResponse.json(
        { error: 'companyName è obbligatorio' },
        { status: 400 }
      );
    }

    console.log('[TEST] Searching for:', companyName, location || '(no location)');

    const result = await searchCompanyInfo(companyName, location);

    console.log('[TEST] Result:', result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[TEST] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
