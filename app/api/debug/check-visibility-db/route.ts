import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint per controllare cosa è salvato nel database Vercel KV
 * per Stella AI Assistant
 */
export async function GET() {
  try {
    console.log('🔍 Controllo database Vercel KV per Stella AI Assistant...');

    // Leggi le impostazioni per Stella AI Assistant (s17)
    const stellaData = await kv.get('app_visibility:s17');

    if (!stellaData) {
      return NextResponse.json({
        success: false,
        message: 'Nessun dato trovato per Stella AI Assistant (s17)'
      });
    }

    // Analizza i dati
    const analysis: any = {
      rawData: stellaData,
      excludedUsers: {
        total: 0,
        emails: [],
        ids: []
      },
      excludedCustomers: {
        total: 0,
        emails: [],
        ids: []
      }
    };

    if ((stellaData as any).excludedUsers) {
      const excludedUsers = (stellaData as any).excludedUsers;
      analysis.excludedUsers.total = excludedUsers.length;

      excludedUsers.forEach((item: string) => {
        if (item.includes('@')) {
          analysis.excludedUsers.emails.push(item);
        } else {
          analysis.excludedUsers.ids.push(item);
        }
      });
    }

    if ((stellaData as any).excludedCustomers) {
      const excludedCustomers = (stellaData as any).excludedCustomers;
      analysis.excludedCustomers.total = excludedCustomers.length;

      excludedCustomers.forEach((item: string) => {
        if (item.includes('@')) {
          analysis.excludedCustomers.emails.push(item);
        } else {
          analysis.excludedCustomers.ids.push(item);
        }
      });
    }

    // Determina il risultato
    const hasEmails = analysis.excludedUsers.emails.length > 0;
    const hasOnlyIds = analysis.excludedUsers.ids.length > 0 && analysis.excludedUsers.emails.length === 0;

    return NextResponse.json({
      success: true,
      message: hasEmails
        ? '✅ EMAIL SALVATE CORRETTAMENTE!'
        : hasOnlyIds
          ? '❌ SOLO ID NUMERICI - NESSUNA EMAIL'
          : '⚠️ NESSUN DATO DI ESCLUSIONE',
      analysis,
      verdict: {
        hasEmails,
        hasOnlyIds,
        emailCount: analysis.excludedUsers.emails.length,
        idCount: analysis.excludedUsers.ids.length
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
